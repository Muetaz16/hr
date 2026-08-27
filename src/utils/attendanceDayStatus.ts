// Day-status derivation for the Daily Breakdown table — shared between the HR-facing Attendance
// page and the employee self-service My Attendance page (same convention as attendanceFormat.ts).
import { format } from 'date-fns';
import type { DailyAttendanceResult, EmployeeLeaveRecord } from '../services/attendanceService';
import { cleanReason } from './attendanceFormat';

// The only recognized weekly rest day (confirmed with HR) — JS Date#getDay(): 0=Sun..6=Sat.
const WEEKLY_OFF_DAYS = [5]; // Friday

// Confirmed from a real payload: a missing punch comes back as the literal string "--:--" (not
// an empty string). A few extra placeholder shapes are treated the same defensively.
const BLANK_PUNCH_VALUES = new Set(['', '-', '--', '--:--']);
const isBlankPunch = (v?: string | null) => BLANK_PUNCH_VALUES.has((v ?? '').trim());

// yyyy-MM-dd prefix comparison, deliberately NOT `new Date(iso)` — the API's date strings only
// need to compare as calendar days, and routing bare 'YYYY-MM-DD' through `new Date()` risks a
// UTC-midnight day shift depending on the browser's local offset.
const dayKey = (iso: string) => (iso || '').slice(0, 10);

export type DayStatusKind = 'suspended' | 'holiday' | 'outWork' | 'onLeavePaid' | 'onLeaveUnpaid' | 'absent' | 'incomplete' | 'present';

export interface DayStatus {
    kind: DayStatusKind;
    // Human-readable explanation, set for every non-'present' kind — replaces the day's normal
    // (otherwise meaningless/empty) Sessions/Late/Early-Out/OT/Worked columns in the table.
    reason: string;
    leave?: EmployeeLeaveRecord; // set only for onLeavePaid/onLeaveUnpaid
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
    };
}

/**
 * The attendance system only returns a row for a day it has SOME record for (a punch, a
 * holiday flag, an exception). A day it has nothing to say about is simply missing from
 * reportData entirely — which used to mean it silently never got evaluated for absence at
 * all, so a real no-show could never be caught. This reconstructs the full calendar range
 * and inserts a blank stand-in row for every missing weekday, so resolveDayStatus can catch
 * it below. Missing Fridays are deliberately NOT synthesized — they're the recognized weekly
 * off day, not a gap to investigate (a real Friday row, if one exists, is still kept as-is).
 */
export function fillMissingDays(reportData: DailyAttendanceResult[], rangeStart: string, rangeEnd: string): DailyAttendanceResult[] {
    const existing = new Map(reportData.map(d => [dayKey(d.date), d]));
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
        } else if (!WEEKLY_OFF_DAYS.includes(cursor.getDay())) {
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
    if (day.isHoliday) return { kind: 'holiday', reason: day.holidayName || 'Holiday' };
    if (day.isOutWork) {
        const outReason = cleanReason(day.outWorkReason);
        return { kind: 'outWork', reason: outReason ? `Out-Work — ${outReason}` : 'Out-Work' };
    }
    if (leave) {
        return { kind: leave.leaveType.isPaid ? 'onLeavePaid' : 'onLeaveUnpaid', reason: `On Leave — ${leave.leaveType.name}`, leave };
    }
    if (isWeeklyOff) return { kind: 'present', reason: '' }; // weekly off with no punches: not absent

    const hasAnyPunch = day.sessions.length > 0 || !isBlankPunch(day.firstPunch) || !isBlankPunch(day.lastPunch);
    if (!hasAnyPunch) {
        if (key > todayKey) return { kind: 'present', reason: '' }; // can't be absent on a day that hasn't happened
        return { kind: 'absent', reason: 'Absent — no punches recorded' };
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
