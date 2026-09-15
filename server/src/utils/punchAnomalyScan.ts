// The cross-employee sweep behind the Punch Anomalies queue.
//
// attendanceAnomaly.ts answers "is THIS day broken"; this answers "which days, across everybody,
// are broken right now". The per-day verdict is not recomputed here — the exact same
// detectDayAnomaly runs, via annotateReportDays, so the queue can never disagree with the flag on
// the employee's own daily breakdown.
//
// Two constraints shape the whole file:
//
//  1. SEQUENTIAL, deliberately. The attendance service fails under concurrency — 7 of 12
//     back-to-back summary calls failed in one measurement (payrollAttendance.ts:9-12). Forty
//     parallel monthly-report calls would return a queue that is short by an unknown number of
//     employees, which is worse than a slow one because nothing on screen would say so.
//
//  2. A PARTIAL ANSWER MUST SAY SO. Every employee we could not read is named in `warnings` and
//     counted in `unreadable`. An attendance officer clearing this queue is entitled to know the
//     list is complete before they believe it is.
import { ATTENDANCE_API_BASE, loadScheduleResolver } from './attendanceApiProxy';
import { annotateReportDays, type DayPunchAnomaly, type PunchRef } from './attendanceAnomaly';
import { periodForDate } from './payrollPeriod';
import { prisma } from '../lib/prisma';

/** One broken day, flattened for the queue: the employee, the date, and the verdict. */
export interface PunchAnomalyRow {
    employeeId: string;
    employeeName: string;
    /** Our staffId == the attendance service's empCode. Kept flat so it survives re-linking. */
    empCode: string;
    /** The attendance service's own numeric id, needed to open the day for correction. */
    bioEmpId: number;
    department: string | null;
    /** 'YYYY-MM-DD', local. Never a Date — see payrollPeriod.ts:8-11 on why. */
    date: string;
    /** The financial month this day is paid in, so the queue can show the run's status. */
    period: string;
    totalWorkMins: number;
    lateMins: number;
    punches: PunchRef[];
    anomaly: DayPunchAnomaly;
    /**
     * The hours THIS employee was scheduled for on THIS date, and which tier decided them.
     *
     * Carried on the row rather than looked up again by the correction screen: a Ramadan day is
     * not a 9-to-5, and an officer being asked to approve a suggested check-out needs to see what
     * the day was actually supposed to be. The tiers are already in memory during the sweep, so
     * this costs nothing.
     */
    scheduled: { workStart: string; workEnd: string; source: 'shift' | 'multiplier' | 'default' };
}

export interface PunchAnomalyScanResult {
    start: string;
    end: string;
    rows: PunchAnomalyRow[];
    /** Employees actually read. `scanned + unreadable` is the roster size we set out to cover. */
    scanned: number;
    unreadable: number;
    /** One line per employee the attendance service would not answer for. */
    warnings: string[];
    /** Wall-clock of the scan, so a cached answer can say how old it is. */
    fetchedAt: string;
}

/** The employee rows the scan walks. */
export interface ScanEmployee {
    id: string;
    bioId: number;
    fullName: string;
    staffId: string | null;
    department: string | null;
    joinDate: Date | string | null;
    separationDate: Date | string | null;
}

const localDayKey = (d: Date | string | null): string | null => {
    if (!d) return null;
    if (typeof d === 'string') return d.slice(0, 10);
    // Local calendar fields, not toISOString(): east of UTC that shifts the boundary back a day,
    // which would let a joining day or a separation day slip through the employment-window filter.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TIMEOUT_MS = 30_000;
const ATTEMPTS = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One employee's monthly report, with a single serial retry.
 *
 * A 404 is a real answer — that employee simply has no attendance data in the range — and returns
 * null without a warning. Anything else that survives the retry is reported as unreadable.
 */
const fetchReport = async (bioEmpId: number, start: string, end: string): Promise<any | null> => {
    const url = new URL(`/api/attendance/monthly-report/${bioEmpId}`, ATTENDANCE_API_BASE);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(url.toString(), { signal: controller.signal });
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`returned ${res.status}`);
            return await res.json();
        } catch (error) {
            lastError = error;
            if (attempt < ATTEMPTS) await sleep(400);
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

/**
 * Sweeps the given employees over [start, end] and returns every day carrying an anomaly.
 *
 * `start`/`end` must already be local 'YYYY-MM-DD' strings (payrollPeriod.toApiDate). The
 * attendance service takes `start`/`end` and silently ignores unknown parameter names, answering
 * for a rolling last-7-days window instead — so a typo there produces a plausible wrong answer
 * rather than an error.
 */
export const scanPunchAnomalies = async (
    employees: ScanEmployee[], start: string, end: string, todayKey: string,
): Promise<PunchAnomalyScanResult> => {
    const scheduleFor = await loadScheduleResolver();

    const rows: PunchAnomalyRow[] = [];
    const warnings: string[] = [];
    let scanned = 0;
    let unreadable = 0;

    for (const emp of employees) {
        let report: any = null;
        try {
            report = await fetchReport(emp.bioId, start, end);
        } catch (error) {
            unreadable++;
            warnings.push(`${emp.fullName} (${emp.staffId || emp.bioId}): ${(error as Error).message}`);
            continue;
        }
        scanned++;
        if (!report || !Array.isArray(report.reportData)) continue;

        const empCode = emp.staffId || String(report.empCode || '');

        // Resolved PER DAY, not once per employee. The tiers are already in memory so it is a
        // couple of array scans, and a range that crosses a date-ranged multiplier factor genuinely
        // has two different schedules in it — Ramadan hours next to ordinary ones. Suggesting a
        // 17:00 check-out on a day that ends at 16:00 would have an officer approve an hour of
        // work nobody did.
        annotateReportDays(report, {
            todayKey,
            scheduleFor: (dayKey) => scheduleFor(empCode, dayKey),
            joinKey: localDayKey(emp.joinDate),
            separationKey: localDayKey(emp.separationDate),
        });

        for (const day of report.reportData as any[]) {
            const date = String(day.date || '').slice(0, 10);
            if (!date) continue;

            const anomaly: DayPunchAnomaly | null | undefined = day.anomaly;
            if (!anomaly) continue;
            rows.push({
                employeeId: emp.id,
                employeeName: emp.fullName,
                empCode,
                bioEmpId: emp.bioId,
                department: emp.department,
                date,
                // 'YYYY-MM-DD' parsed as a LOCAL date; `new Date('2026-08-25')` is UTC midnight and
                // would land on the 24th here, moving the day into the previous payroll period.
                period: periodForDate(new Date(`${date}T00:00:00`)),
                totalWorkMins: Number(day.totalWorkMins) || 0,
                lateMins: Number(day.lateMins) || 0,
                punches: Array.isArray(day.punches) ? day.punches : [],
                anomaly,
                scheduled: scheduleFor(empCode, date),
            });
        }
    }

    // Worst first: a blocking day cost somebody a day's pay, an advisory one only needs a look.
    rows.sort((a, b) => {
        if (a.anomaly.severity !== b.anomaly.severity) return a.anomaly.severity === 'blocking' ? -1 : 1;
        if (a.date !== b.date) return a.date < b.date ? 1 : -1; // newest first within a severity
        return a.employeeName.localeCompare(b.employeeName);
    });

    return { start, end, rows, scanned, unreadable, warnings, fetchedAt: new Date().toISOString() };
};

// ---------------------------------------------------------------------------------------------
// The shared, cached entry point
// ---------------------------------------------------------------------------------------------
//
// Two callers want the same sweep: the Punch Anomalies queue on the Attendance screen, and the
// payroll pre-flight. They were each loading the roster and running their own sweep — which is
// ~40 sequential HTTP calls, roughly ten seconds, duplicated. Worse, pre-flight ran uncached, so
// a screen that used to answer instantly began taking ten seconds every time it was opened.
//
// One cache, keyed by the window, so opening the queue and then pre-flighting the same period is
// free the second time.

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; result: PunchAnomalyScanResult }>();
// Two callers arriving at once would otherwise start two sweeps in parallel, which is exactly the
// concurrency the sequential loop exists to avoid. The second waits on the first one's promise.
const inFlight = new Map<string, Promise<PunchAnomalyScanResult>>();

/** Drops every cached sweep, so a correction pushed now disappears from the next read. */
export const invalidatePunchAnomalyScans = () => { cache.clear(); };

/** The roster the sweep walks: active employees the attendance system knows about. */
export const loadScanEmployees = async (empCode?: string): Promise<ScanEmployee[]> => {
    const rows = await prisma.employee.findMany({
        where: {
            bioId: { not: null },
            enrollmentStatus: 'ACTIVE',
            ...(empCode ? { staffId: empCode } : {}),
        },
        select: {
            id: true, bioId: true, fullName: true, staffId: true,
            joinDate: true, separationDate: true,
            department: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
    });
    return rows.map(e => ({
        id: e.id,
        bioId: e.bioId as number,
        fullName: e.fullName,
        staffId: e.staffId,
        department: e.department?.name ?? null,
        joinDate: e.joinDate,
        separationDate: e.separationDate,
    }));
};

/** Today as a LOCAL calendar day — never toISOString(), which reads as yesterday east of UTC. */
export const localTodayKey = (d: Date = new Date()): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The whole-roster sweep, cached for a few minutes and de-duplicated across concurrent callers.
 *
 * Pass `refresh` to skip the cache — that is the Rescan button, pressed precisely because
 * something was just corrected.
 */
export const cachedScanPunchAnomalies = async (
    start: string, end: string, opts: { refresh?: boolean } = {},
): Promise<PunchAnomalyScanResult & { cached: boolean }> => {
    const key = `${start}|${end}`;
    if (!opts.refresh) {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) return { ...hit.result, cached: true };
    }

    let pending = inFlight.get(key);
    if (!pending) {
        pending = loadScanEmployees()
            .then(employees => scanPunchAnomalies(employees, start, end, localTodayKey()))
            .then(result => {
                cache.set(key, { at: Date.now(), result });
                return result;
            })
            .finally(() => { inFlight.delete(key); });
        inFlight.set(key, pending);
    }
    return { ...(await pending), cached: false };
};
