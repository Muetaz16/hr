import { ATTENDANCE_API_BASE } from './attendanceApiProxy';
import { getPresenceWindow } from './presenceScoring';

export { getPresenceWindow };

// Backend port of src/utils/attendanceDayStatus.ts's day-classification logic — this repo doesn't
// share code between server/ and src/, so it's re-implemented here rather than imported. Only the
// pieces needed to classify a day as "absent" are ported (no UI reason strings / present/incomplete
// distinction, since only absence matters for SER-09/MAJ-07 below).
const WEEKLY_OFF_DAYS = [5]; // Friday — matches attendanceDayStatus.ts
// Confirmed from a real payload: a missing punch comes back as the literal string "--:--".
const BLANK_PUNCH_VALUES = new Set(['', '-', '--', '--:--']);
const isBlankPunch = (v?: string | null) => BLANK_PUNCH_VALUES.has((v ?? '').trim());
const dayKey = (iso: string) => (iso || '').slice(0, 10);
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface RawDay {
    date: string;
    sessions?: { checkIn: string; checkOut: string }[];
    firstPunch?: string;
    lastPunch?: string;
    lateMins?: number;
    earlyOutMins?: number;
    isExcusedEarlyOut?: boolean;
    isHoliday?: boolean;
    isOutWork?: boolean;
    isSuspended?: boolean;
}
interface RawLeave {
    startDate: string;
    endDate?: string;
}

const findLeaveForDay = (key: string, leaves: RawLeave[]): boolean =>
    leaves.some(l => {
        const start = dayKey(l.startDate);
        const end = l.endDate ? dayKey(l.endDate) : start;
        return key >= start && key <= end;
    });

// Same priority order as resolveDayStatus: a confirmed suspension takes priority over everything
// else (it's HR's own authoritative fact — never silently overridden), then holiday/out-work/
// on-leave/weekly-off take priority over the punch-based check, and a day that hasn't happened yet
// within the window can't be absent.
const isAbsentDay = (day: RawDay, leaves: RawLeave[], todayKey: string): boolean => {
    const key = dayKey(day.date);
    if (day.isSuspended) return false;
    if (day.isHoliday) return false;
    if (day.isOutWork) return false;
    if (findLeaveForDay(key, leaves)) return false;
    if (WEEKLY_OFF_DAYS.includes(new Date(day.date).getDay())) return false;
    const hasAnyPunch = (day.sessions?.length || 0) > 0 || !isBlankPunch(day.firstPunch) || !isBlankPunch(day.lastPunch);
    if (hasAnyPunch) return false;
    if (key > todayKey) return false;
    return true;
};

// Reconstructs the full calendar range so a real no-show (missing from reportData entirely, not
// present with blank values) is still caught — mirrors fillMissingDays on the frontend. Missing
// Fridays are deliberately not synthesized (the weekly off day, not a gap to investigate); a real
// Friday row, if one exists, is kept as-is (isAbsentDay resolves it to not-absent regardless).
const fillMissingDays = (reportData: RawDay[], rangeStart: string, rangeEnd: string): RawDay[] => {
    const existing = new Map(reportData.map(d => [dayKey(d.date), d]));
    const filled: RawDay[] = [];
    const cursor = new Date(`${rangeStart}T00:00:00`);
    const end = new Date(`${rangeEnd}T00:00:00`);
    while (cursor <= end) {
        const key = fmt(cursor);
        const existingDay = existing.get(key);
        if (existingDay) {
            filled.push(existingDay);
        } else if (!WEEKLY_OFF_DAYS.includes(cursor.getDay())) {
            filled.push({ date: key, sessions: [], firstPunch: '--:--', lastPunch: '--:--', lateMins: 0, isHoliday: false, isOutWork: false, isSuspended: false });
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return filled;
};

export interface AttendanceSummary {
    lateDays: number;
    unauthorizedAbsenceDays: number;
    maxConsecutiveAbsenceDays: number;
    earlyOutDays: number;
}

// Single monthly-report fetch, classified into the 3 Annex I signals the Attendance Candidates
// screen detects: tardiness (MIN-02), a single unauthorized absence (SER-09), and a 3+ consecutive
// unauthorized absence streak (MAJ-07). Fail-soft (null on any error), same convention as the rest
// of the attendance integration.
export async function fetchAttendanceSummary(bioId: number, start: string, end: string): Promise<AttendanceSummary | null> {
    try {
        const url = new URL(`/api/attendance/monthly-report/${bioId}`, ATTENDANCE_API_BASE);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
        const response = await fetch(url.toString());
        if (!response.ok) return null;
        const data: any = await response.json();
        const rawReportData: RawDay[] = Array.isArray(data?.reportData) ? data.reportData : [];
        const leaves: RawLeave[] = Array.isArray(data?.empLeaves) ? data.empLeaves : [];

        const lateDays = rawReportData.filter(d => Number(d?.lateMins) > 0 && !d?.isHoliday && !d?.isSuspended).length;
        // Symmetric to lateDays — BioTime returns earlyOutMins/isExcusedEarlyOut per day already
        // (same payload, no extra call), same as the frontend's DailyAttendanceResult already
        // surfaces. An EXCUSED early-out went through the approval workflow, so it doesn't count.
        const earlyOutDays = rawReportData.filter(d => Number(d?.earlyOutMins) > 0 && !d?.isExcusedEarlyOut && !d?.isHoliday && !d?.isSuspended).length;

        const todayKey = fmt(new Date());
        const days = fillMissingDays(rawReportData, start, end)
            // Drop the weekly off day entirely (rather than keeping it as a "not absent" entry) so
            // it can never break a real absence streak spanning across it.
            .filter(d => !WEEKLY_OFF_DAYS.includes(new Date(d.date).getDay()));
        const absentFlags = days.map(d => isAbsentDay(d, leaves, todayKey));
        const unauthorizedAbsenceDays = absentFlags.filter(Boolean).length;

        let maxConsecutiveAbsenceDays = 0;
        let currentStreak = 0;
        for (const absent of absentFlags) {
            currentStreak = absent ? currentStreak + 1 : 0;
            maxConsecutiveAbsenceDays = Math.max(maxConsecutiveAbsenceDays, currentStreak);
        }

        return { lateDays, unauthorizedAbsenceDays, maxConsecutiveAbsenceDays, earlyOutDays };
    } catch (error) {
        console.error(`[DISCIPLINARY][ATTENDANCE] Failed to fetch monthly report for bioId ${bioId}:`, error);
        return null;
    }
}

// The current 25th-to-24th cycle, based on today's date (Africa/Tripoli), expressed the same way
// getPresenceWindow expects ("YYYY-MM" for the month whose window ends on that month's 24th).
export function currentCycleMonth(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const y = Number(parts.find(p => p.type === 'year')?.value);
    const m = Number(parts.find(p => p.type === 'month')?.value);
    const d = Number(parts.find(p => p.type === 'day')?.value);
    // On or after the 25th, we're already inside NEXT month's cycle window.
    const cycleMonth = d >= 25 ? m + 1 : m;
    const cycleYear = cycleMonth > 12 ? y + 1 : y;
    const normalizedMonth = ((cycleMonth - 1) % 12) + 1;
    return `${cycleYear}-${String(normalizedMonth).padStart(2, '0')}`;
}
