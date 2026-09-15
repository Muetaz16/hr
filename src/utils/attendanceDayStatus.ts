// Day-status derivation for the Daily Breakdown table — shared between the HR-facing Attendance
// page and the employee self-service My Attendance page (same convention as attendanceFormat.ts).
import { format } from 'date-fns';
import type { DailyAttendanceResult, EmployeeLeaveRecord } from '../services/attendanceService';
import { cleanReason } from './attendanceFormat';
import { formatLeaveTypeName } from './leaveTypeName';

// The only recognized weekly rest day (confirmed with HR) — JS Date#getDay(): 0=Sun..6=Sat.
const WEEKLY_OFF_DAYS = [5]; // Friday

// Confirmed from a real payload: a missing punch comes back as the literal string "--:--" (not
// an empty string). A few extra placeholder shapes are treated the same defensively.
const BLANK_PUNCH_VALUES = new Set(['', '-', '--', '--:--']);
const isBlankPunch = (v?: string | null) => BLANK_PUNCH_VALUES.has((v ?? '').trim());

/** Did the employee turn up at all? The holiday branch needs this as well as the punch checks. */
const hasAnyPunch = (day: DailyAttendanceResult) =>
    day.sessions.length > 0 || !isBlankPunch(day.firstPunch) || !isBlankPunch(day.lastPunch);

// yyyy-MM-dd prefix comparison, deliberately NOT `new Date(iso)` — the API's date strings only
// need to compare as calendar days, and routing bare 'YYYY-MM-DD' through `new Date()` risks a
// UTC-midnight day shift depending on the browser's local offset.
const dayKey = (iso: string) => (iso || '').slice(0, 10);

export type DayStatusKind = 'suspended' | 'holiday' | 'outWork' | 'onLeavePaid' | 'onLeaveUnpaid' | 'absent' | 'incomplete' | 'present' | 'weeklyOff';

export interface DayStatus {
    kind: DayStatusKind;
    // Human-readable explanation, set for every non-'present' kind — replaces the day's normal
    // (otherwise meaningless/empty) Sessions/Late/Early-Out/OT/Worked columns in the table.
    reason: string;
    leave?: EmployeeLeaveRecord; // set only for onLeavePaid/onLeaveUnpaid
    // Overtime minutes worked on a day that is not a working day — the weekly rest day or a
    // public holiday. Set only when the employee actually turned up.
    //
    // Read from otMins, NOT totalWorkMins: the attendance service books work on these days
    // entirely as overtime (a real holiday returned totalWorkMins = 0 with otMins = 301), so the
    // ordinary-hours field is the wrong one and would report a worked day as empty.
    overtimeMins?: number;
}

// Row tint + text color, keyed the same way ApprovedLeaves.tsx's TYPE_META already is — a
// Record over every DayStatusKind so TypeScript flags any status missing a style entry.
// Colors per the user's own mapping (red=absent, blue=leave, orange→amber=holiday, this app has
// no literal "orange" anywhere) — and specifically the "-600" text shade, not "-700": this app's
// dark-theme stylesheet (index.css) recolors status badges for legibility on the dark surface,
// but only has coverage for the "-600" shade of each bucket (a "-700" text color falls through
// uncovered and silently inherits the dark-theme's default text color instead).
export const DAY_STATUS_META: Record<DayStatusKind, { rowClassName: string; textClassName: string }> = {
    // Purple, not the red/rose already used by 'absent' — a confirmed disciplinary suspension is a
    // materially different fact from an unauthorized absence and must never read the same in this
    // table (rose also renders identically to red in dark mode, so it wouldn't be distinct either).
    suspended: { rowClassName: 'bg-purple-50', textClassName: 'text-purple-600' },
    holiday: { rowClassName: 'bg-amber-50', textClassName: 'text-amber-600' },
    outWork: { rowClassName: 'bg-indigo-50', textClassName: 'text-indigo-600' },
    onLeavePaid: { rowClassName: 'bg-blue-50', textClassName: 'text-blue-600' },
    onLeaveUnpaid: { rowClassName: 'bg-blue-50', textClassName: 'text-blue-600' },
    absent: { rowClassName: 'bg-red-50', textClassName: 'text-red-600' },
    incomplete: { rowClassName: 'bg-slate-50', textClassName: 'text-slate-600' },
    present: { rowClassName: '', textClassName: '' },
    // Emerald, and specifically emerald: every other bucket here is already spoken for, and of the
    // remaining palettes only emerald-600 is recolored by the dark theme in index.css — teal/cyan/
    // sky fall through uncovered and would inherit the default text color on the dark surface.
    weeklyOff: { rowClassName: 'bg-emerald-50', textClassName: 'text-emerald-600' },
};

// A day the attendance system has literally nothing to say about (no punches, no exception, no
// leave push) — synthesized purely to stand in for a day missing from reportData below.
function makeBlankDay(key: string): DailyAttendanceResult {
    return {
        date: key, empName: '', firstPunch: '--:--', lastPunch: '--:--', earlyPunch: 0,
        overtimeIn: '--:--', overtimeOut: '--:--', breakIn: '--:--', breakOut: '--:--',
        totalLeaveMins: 0, totalLeaveTime: '0m', sessions: [],
        midDayGapMins: 0, midDayGapTime: '0m', lateMins: 0, earlyOutMins: 0, otMins: 0, totalWorkMins: 0,
        isHoliday: false, holidayName: null, isOutWork: false, outWorkReason: null,
        isSuspended: false, suspensionReason: null,
        isExcusedLate: false, excusedLateReason: null, isExcusedEarlyOut: false, excusedEarlyOutReason: null,
        lateTimeStr: '0m', earlyOutStr: '0m', overTimeStr: '0m',
        punches: [],
        // `anomaly` is deliberately NOT set. undefined means "never judged" — this row was
        // invented here and the server has never seen it — so resolveDayStatus falls through to
        // the punch heuristic instead of reading a clean verdict off a day that does not exist.
    };
}

/**
 * The attendance system only returns a row for a day it has SOME record for (a punch, a
 * holiday flag, an exception). A day it has nothing to say about is simply missing from
 * reportData entirely — which used to mean it silently never got evaluated for absence at
 * all, so a real no-show could never be caught. This reconstructs the full calendar range
 * and inserts a blank stand-in row for every missing weekday, so resolveDayStatus can catch
 * it below.
 *
 * Fridays ARE synthesized, and that is a change: they used to be skipped, which meant a Friday
 * with no punches simply did not exist in the table. The month appeared to jump from Thursday to
 * Saturday, and there was no way to tell "the rest day" from "a day the system knows nothing
 * about". They are now stood in for like any other day and resolve to the `weeklyOff` status —
 * never to `absent`, which resolveDayStatus guarantees below.
 */
export function fillMissingDays(reportData: DailyAttendanceResult[], rangeStart: string, rangeEnd: string): DailyAttendanceResult[] {
    const existing = new Map(reportData.map(d => [dayKey(d.date), d]));
    // A day absorbed by an overnight shift is missing from reportData BY DESIGN — it was merged
    // into the day that shift began. Standing a blank row in for it would report an absence for
    // somebody who was at work through the night, and that absence goes on to drive the Presence
    // score and the absence count.
    const absorbed = new Set(
        reportData
            .filter(d => d.isOvernightStitched && d.overnightCheckoutDate)
            .map(d => dayKey(d.overnightCheckoutDate as string)),
    );
    const startKey = dayKey(rangeStart);
    const endKey = dayKey(rangeEnd);
    if (!startKey || !endKey) return reportData;

    const filled: DailyAttendanceResult[] = [];
    const cursor = new Date(`${startKey}T00:00:00`);
    const end = new Date(`${endKey}T00:00:00`);
    while (cursor <= end) {
        const key = format(cursor, 'yyyy-MM-dd');
        const existingDay = existing.get(key);
        if (existingDay) {
            filled.push(existingDay);
        } else if (!absorbed.has(key)) {
            filled.push(makeBlankDay(key));
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return filled;
}

function findLeaveForDay(key: string, leaves: EmployeeLeaveRecord[]): EmployeeLeaveRecord | undefined {
    return leaves.find(l => {
        const start = dayKey(l.startDate);
        const end = l.endDate ? dayKey(l.endDate) : start; // defensive fallback for a single-day leave
        return key >= start && key <= end;
    });
}

/**
 * Resolves the ONE status a day is in. A confirmed disciplinary Suspension is HR's own
 * authoritative fact and takes priority over everything else — it must never be silently
 * overridden even if the upstream API also happens to mark that same day Holiday/Out-Work/On-
 * Leave. Holiday / Out-Work / On-Leave days are themselves schedule facts that make the day's
 * punch columns meaningless regardless of what punch data (if any) came back for them, so they
 * take priority over the punch-based checks below — a holiday with zero punches must never read
 * as Absent. Only when none of those apply do we look at the actual punches to tell Absent (none
 * at all) from Incomplete (only one side recorded) apart.
 */
export function resolveDayStatus(day: DailyAttendanceResult, leaves: EmployeeLeaveRecord[], todayKey: string): DayStatus {
    const key = dayKey(day.date);
    const leave = findLeaveForDay(key, leaves);
    const isWeeklyOff = WEEKLY_OFF_DAYS.includes(new Date(day.date).getDay());

    if (day.isSuspended) {
        const suspendReason = cleanReason(day.suspensionReason);
        return { kind: 'suspended', reason: suspendReason ? `Suspended — ${suspendReason}` : 'Suspended' };
    }
    // A public holiday. Somebody may still have come in, and those hours are overtime — exactly
    // the same rule as the weekly rest day. This row used to print only the holiday's NAME, so
    // five hours of eid overtime sat on screen as the single word "eid".
    if (day.isHoliday) {
        return {
            kind: 'holiday',
            reason: day.holidayName || 'Holiday',
            ...(hasAnyPunch(day) ? { overtimeMins: day.otMins || 0 } : {}),
        };
    }
    if (day.isOutWork) {
        const outReason = cleanReason(day.outWorkReason);
        return { kind: 'outWork', reason: outReason ? `Out-Work — ${outReason}` : 'Out-Work' };
    }
    if (leave) {
        return { kind: leave.leaveType.isPaid ? 'onLeavePaid' : 'onLeaveUnpaid', reason: `On Leave — ${formatLeaveTypeName(leave.leaveType.name)}`, leave };
    }
    const punched = hasAnyPunch(day);

    // The weekly rest day, and it OWNS the row from here on — no lateness, no early-out, no
    // absence, and no anomaly verdict. There is no scheduled start to be late for, so the
    // attendance service's own late/early figures for this day are meaningless: one real Friday
    // came back with 108 minutes of "lateness" purely because the punch was after the weekday
    // work-start it does not have.
    //
    // Hours worked here are OVERTIME, not ordinary hours. This returns the minutes rather than a
    // sentence so the screen can say that in the reader's own language.
    if (isWeeklyOff) {
        return {
            kind: 'weeklyOff',
            reason: 'Friday — weekly rest day',
            ...(punched ? { overtimeMins: day.otMins || 0 } : {}),
        };
    }
    if (!punched) {
        if (key > todayKey) return { kind: 'present', reason: '' }; // can't be absent on a day that hasn't happened
        return { kind: 'absent', reason: 'Absent — no punches recorded' };
    }

    // The server has already judged this day (server/src/utils/attendanceAnomaly.ts) and attached
    // its verdict at the proxy boundary. Trust it over the local heuristic below, which can only
    // see a HALF-missing day: two punches of the same type leave both firstPunch and lastPunch
    // populated, so the XOR misses them entirely and a day that paid nothing reported as a normal
    // working day. Measured on live data: 39 such days, and the XOR caught 16 of them.
    //
    // `undefined` means the payload predates annotation, so the heuristic remains as the fallback.
    if (day.anomaly !== undefined) {
        if (day.anomaly && day.anomaly.severity === 'blocking') {
            // The reason string is only a fallback for callers that do not render the anomaly
            // themselves; DailyBreakdownTable builds a translated sentence from `facts` instead.
            return { kind: 'incomplete', reason: `Needs correction — ${day.anomaly.detail}` };
        }
        return { kind: 'present', reason: '' };
    }

    const brokenSession = day.sessions.find(s => isBlankPunch(s.checkIn) !== isBlankPunch(s.checkOut));
    const onlyOneRawPunch = day.sessions.length === 0 && (isBlankPunch(day.firstPunch) !== isBlankPunch(day.lastPunch));
    if (brokenSession || onlyOneRawPunch) {
        let detail = '';
        if (brokenSession) {
            detail = isBlankPunch(brokenSession.checkIn) ? `no check-in, checked out ${brokenSession.checkOut}` : `checked in ${brokenSession.checkIn}, no check-out`;
        } else {
            detail = isBlankPunch(day.firstPunch) ? `no check-in, checked out ${day.lastPunch}` : `checked in ${day.firstPunch}, no check-out`;
        }
        return { kind: 'incomplete', reason: `Incomplete Punch — ${detail}` };
    }

    return { kind: 'present', reason: '' };
}
