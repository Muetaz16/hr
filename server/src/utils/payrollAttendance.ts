// Fetching the attendance figures a payroll run is computed from.
//
// This calls the external biometric service DIRECTLY rather than going through our own
// /api/attendance-integration/summary. A server-to-self HTTP hop would add latency and a second
// failure mode for no benefit — the proxy exists so the *browser* only talks to one API.
//
// Two things this module exists to get right:
//
//  1. RETRIES. The .NET service returns intermittent 500s under load — in one measurement, 7 of 12
//     back-to-back summary calls failed, and every one of them succeeded on a serial retry. A
//     payroll run reads the whole company at once, so it is exactly the caller that trips this.
//
//  2. THE PARAMETER NAMES. The service takes `start` and `end`. It does not validate unknown
//     parameters — pass `startDate`/`endDate` and it silently ignores them and answers for a
//     rolling "last 7 days" window instead, which would look like a successful run for the wrong
//     period. Only `toApiDate` output goes on the wire, never `toISOString()`.
import { ATTENDANCE_API_BASE } from './attendanceApiProxy';

/**
 * One row of the attendance summary, as the external service actually returns it.
 *
 * `totalWorkMins` is ALREADY net of leave: a leave day appears in the daily rows with a full day's
 * minutes credited, and the roll-up then subtracts that credit back out and parks it in
 * `totalPaidMins`. Verified arithmetically. So `totalPaidMins` and `totalUnpaidLeaveMins` are
 * disjoint from `totalWorkMins` — subtracting either from it would deduct the same absence twice.
 */
export interface PayrollAttendanceRow {
    empId: number;
    empCode: string;
    empName: string;
    department: string;
    positionName: string;
    totalEarlyPunchMins: number;
    totalWorkMins: number;
    /** Annual AND emergency paid leave combined. There is no breakdown in this figure. */
    totalPaidMins: number;
    /** Display only — see the note above. */
    totalUnpaidLeaveMins: number;
    totalLateMins: number;
    totalEarlyOutMins: number;
    totalLeaveMins: number;
    /** Punch-derived overtime. Informational: payroll pays `totalApprovedOTMins`. */
    totalOTMins: number;
    /** Hand-entered approved overtime. Independent of totalOTMins and can exceed it. */
    totalApprovedOTMins: number;
    // The two day counters below are SWAPPED by the service (paidLeaveDays counts emergency days
    // and vice versa) and paidLeaveDays double-counts duplicate records. Payroll does not use them.
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    emergencyLeaveDays: number;
    holidayDays: number;
    outWorkDays: number;
    /** A suspended day contributes no minutes to any bucket — it is not deducted again. */
    suspensionDays: number;
    absenceDays: number;
    totalExcusedMins: number;
    totalExcusedEarlyOutMins: number;
}

export interface PayrollAttendanceResult {
    rows: PayrollAttendanceRow[];
    /** Keyed by empCode, for matching against Employee.staffId. */
    byEmpCode: Map<string, PayrollAttendanceRow>;
    attempts: number;
    warnings: string[];
    fetchedAt: Date;
    sourceStart: string;
    sourceEnd: string;
}

const ATTEMPTS = 4;
const BACKOFF_MS = [500, 1500, 4500];
const TIMEOUT_MS = 60_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** A 5xx or a network failure is worth retrying; a 4xx means we asked wrong and never will be. */
class RetryableError extends Error {}

const fetchOnce = async (url: string): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            const message = `attendance service returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
            if (response.status >= 500) throw new RetryableError(message);
            throw new Error(message);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Reads the attendance summary for a payroll window.
 *
 * `start` and `end` must already be local `YYYY-MM-DD` strings from `payrollPeriod.toApiDate`.
 * Throws if the service cannot be read after every retry — the caller must then abort the whole
 * compute and write nothing, because a partial run is worse than no run.
 */
export const fetchPayrollAttendance = async (
    start: string, end: string,
): Promise<PayrollAttendanceResult> => {
    const url = new URL('/api/attendance/summary', ATTENDANCE_API_BASE);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    const target = url.toString();

    const warnings: string[] = [];
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
            const payload: any = await fetchOnce(target);
            const raw = Array.isArray(payload) ? payload
                : Array.isArray(payload?.employees) ? payload.employees
                    : null;
            if (!raw) {
                // A 200 with an unrecognisable body is not something a retry will fix.
                throw new Error('attendance service returned an unrecognised payload shape');
            }

            const rows = raw.map(normalizeRow);
            const byEmpCode = new Map<string, PayrollAttendanceRow>();
            for (const row of rows) {
                if (!row.empCode) continue;
                // Two rows for one code would silently halve someone's pay; surface it instead.
                if (byEmpCode.has(row.empCode)) {
                    warnings.push(`Duplicate attendance row for employee code ${row.empCode}; kept the first.`);
                    continue;
                }
                byEmpCode.set(row.empCode, row);
            }

            return {
                rows, byEmpCode, attempts: attempt, warnings,
                fetchedAt: new Date(), sourceStart: start, sourceEnd: end,
            };
        } catch (error) {
            lastError = error;
            const retryable = error instanceof RetryableError
                || (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch')));
            if (!retryable || attempt === ATTEMPTS) break;
            warnings.push(`Attempt ${attempt} failed (${(error as Error).message}); retrying.`);
            // Jitter so a retry storm from several callers does not re-synchronise on the service.
            await sleep(BACKOFF_MS[attempt - 1] + Math.floor(Math.random() * 250));
        }
    }

    throw new Error(
        `Could not read attendance for ${start} to ${end} after ${ATTEMPTS} attempts. `
        + `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
};

const num = (v: unknown): number => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const normalizeRow = (r: any): PayrollAttendanceRow => ({
    empId: num(r?.empId),
    empCode: str(r?.empCode).trim(),
    empName: str(r?.empName),
    department: str(r?.department),
    positionName: str(r?.positionName),
    totalEarlyPunchMins: num(r?.totalEarlyPunchMins),
    totalWorkMins: num(r?.totalWorkMins),
    totalPaidMins: num(r?.totalPaidMins),
    totalUnpaidLeaveMins: num(r?.totalUnpaidLeaveMins),
    totalLateMins: num(r?.totalLateMins),
    totalEarlyOutMins: num(r?.totalEarlyOutMins),
    totalLeaveMins: num(r?.totalLeaveMins),
    totalOTMins: num(r?.totalOTMins),
    totalApprovedOTMins: num(r?.totalApprovedOTMins),
    paidLeaveDays: num(r?.paidLeaveDays),
    unpaidLeaveDays: num(r?.unpaidLeaveDays),
    emergencyLeaveDays: num(r?.emergencyLeaveDays),
    holidayDays: num(r?.holidayDays),
    outWorkDays: num(r?.outWorkDays),
    suspensionDays: num(r?.suspensionDays),
    absenceDays: num(r?.absenceDays),
    totalExcusedMins: num(r?.totalExcusedMins),
    totalExcusedEarlyOutMins: num(r?.totalExcusedEarlyOutMins),
});
