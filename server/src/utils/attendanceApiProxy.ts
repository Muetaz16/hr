import { Response } from 'express';

// The dedicated attendance/time-clock system (separate .NET application) that the Personnel
// team uses for punches, leave, overtime, settings, etc. We proxy through our own backend rather
// than calling it directly from the browser, so the frontend only ever talks to one API.
export const ATTENDANCE_API_BASE = process.env.ATTENDANCE_API_BASE_URL || 'http://localhost:5119';

// Generic passthrough — forwards the response body as-is, mapping non-2xx to 404 (pass through)
// or 502 (everything else), same shape used by every attendance-system handler.
export const proxy = async (res: Response, path: string, init?: RequestInit) => {
    try {
        const response = await fetch(new URL(path, ATTENDANCE_API_BASE).toString(), init);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const status = response.status === 404 ? 404 : 502;
            return res.status(status).json({ error: (data as any)?.message || `The attendance system returned an error (${response.status}).` });
        }
        res.json(data);
    } catch (error) {
        console.error(`Error proxying to attendance system (${path}):`, error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

export const jsonPost = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

export const jsonPut = (body: unknown): RequestInit => ({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

// Plain (non-Express) result shape for internal callers that need to branch on success/failure
// themselves rather than writing straight to an HTTP response (e.g. side effects inside
// createEmployee). Mirrors what BioTime itself returns from its create endpoint.
export interface BioTimeResult {
    success: boolean;
    message?: string;
}

// Creates an employee record inside BioTime. Never throws — callers get {success:false, message}
// on any failure (empCode collision, BioTime unreachable, etc.) and decide what to do, since this
// is used as a fail-soft side effect, not a user-facing request/response.
export async function createBioTimeEmployeeRecord(params: { empCode: string; firstName: string; positionId: number }): Promise<BioTimeResult> {
    try {
        const response = await fetch(new URL('/api/attendance/employees', ATTENDANCE_API_BASE).toString(), jsonPost(params));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

// Looks up BioTime's own numeric employee id for a given empCode, via the same
// roster-summary-and-find pattern already used by getMyMonthlyReport / getAttendanceSummary.
// Returns null if not found or if BioTime is unreachable — never throws.
export async function findBioTimeEmpIdByCode(empCode: string): Promise<number | null> {
    try {
        const response = await fetch(new URL('/api/attendance/summary', ATTENDANCE_API_BASE).toString());
        if (!response.ok) return null;
        const data: any = await response.json();
        const match = (data.employees || []).find((e: any) => e.empCode === empCode);
        return match?.empId ?? match?.id ?? null;
    } catch {
        return null;
    }
}

// One employee as returned by BioTime's roster endpoint (GET /api/attendance).
export interface BioTimeRosterEmployee {
    id: number;            // BioTime's own numeric id -> our Employee.bioId
    empCode: string;       // staff code -> our Employee.staffId
    firstName: string;     // -> our Employee.fullName
    positionName: string | null; // -> our Employee.position (free text)
    // BioTime's own residency classification — 4=Resident, 5=Non-Resident, 6=Exception,
    // 7=Higher-Management, 8=Logistics. Not stored anywhere in our own database (attendance staff can
    // reclassify this directly in BioTime via the Attendance page's Employees tab, independent of
    // our Employee.contractType), so this is the only authoritative source for it.
    positionId: number | null;
}

// Fetches the full employee roster from BioTime (GET /api/attendance). Normalises BioTime's
// snake_case DTO ({ id, emp_code, first_name, position: { position_name } }) into the camelCase
// shape above. Returns [] and never throws if BioTime is unreachable or the payload is malformed —
// callers (the bulk sync) decide how to treat an empty roster.
export async function fetchBioTimeRoster(): Promise<BioTimeRosterEmployee[]> {
    try {
        const response = await fetch(new URL('/api/attendance', ATTENDANCE_API_BASE).toString());
        if (!response.ok) return [];
        const data: any = await response.json();
        const rows: any[] = Array.isArray(data?.employees) ? data.employees : [];
        return rows
            .map((e) => ({
                id: Number(e?.id),
                empCode: String(e?.emp_code ?? '').trim(),
                firstName: String(e?.first_name ?? '').trim(),
                positionName: e?.position?.position_name ?? null,
                positionId: e?.position?.id != null ? Number(e.position.id) : null,
            }))
            .filter((e) => Number.isFinite(e.id) && e.empCode.length > 0);
    } catch (error) {
        console.error('[BioTime] Failed to fetch roster:', error);
        return [];
    }
}

// Registers a leave in BioTime once a leave request's approval chain fully completes. Never
// throws — this is a fail-soft side effect (mirrors createBioTimeEmployeeRecord above), called
// after the completing approval's DB transaction has already committed.
export async function createBioTimeLeaveRecord(params: { empCode: string; leaveTypeId: number; startDate: Date | string; endDate: Date | string; notes?: string }): Promise<BioTimeResult> {
    try {
        const response = await fetch(new URL('/api/attendance/leaves', ATTENDANCE_API_BASE).toString(), jsonPost(params));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

// Registers an out-work (out-of-office / field-work) period in BioTime once a Work Authorization
// request's approval chain fully completes — it lands in BioTime's `outworks` table. Never throws:
// fail-soft side effect (mirrors createBioTimeLeaveRecord above), called after the completing
// approval's DB transaction has already committed.
export async function createBioTimeOutWork(params: { empCode: string; startDate: Date | string; endDate: Date | string; reason?: string }): Promise<BioTimeResult> {
    try {
        const response = await fetch(new URL('/api/attendance/out-works', ATTENDANCE_API_BASE).toString(), jsonPost(params));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

// Adds `minutes` to an "HH:mm" or "HH:mm:ss" time string, wrapping past midnight. Used to derive
// an Employee Shift's grace-period / OT-threshold defaults from its own work hours when the
// caller doesn't explicitly set them (see createBioTimeEmployeeShift below).
export function addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

// Registers a per-employee shift override in BioTime once a "Change of Schedule" Work
// Authorization request's approval chain fully completes — BioTime then computes that employee's
// late/early/OT for the covered date range against workStart/workEnd instead of the system-wide
// default or an active multiplier factor (resolution priority: employee shift > multiplier factor
// > system default). Fail-soft, never throws — same convention as createBioTimeOutWork above.
// When not explicitly given, gracePeriod defaults to workStart+5min and otThreshold to
// workEnd+30min — a sensible per-shift default rather than leaving them blank (which would fall
// back to whatever BioTime's own system-wide default is, not this shift's actual hours).
export async function createBioTimeEmployeeShift(params: {
    empCode: string; startDate: Date | string; endDate: Date | string;
    workStart: string; workEnd: string; gracePeriod?: string; otThreshold?: string; reason?: string;
}): Promise<BioTimeResult> {
    try {
        const payload = {
            ...params,
            gracePeriod: params.gracePeriod || addMinutesToTime(params.workStart, 5),
            otThreshold: params.otThreshold || addMinutesToTime(params.workEnd, 30),
        };
        const response = await fetch(new URL('/api/system-settings/employee-shifts', ATTENDANCE_API_BASE).toString(), jsonPost(payload));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

// Adds a forgotten biometric punch to BioTime once a Missing Biometric Log request's approval
// chain fully completes — lands as a real check-in (punchState "0") or check-out (punchState "1")
// at the given punchTime. Fail-soft, never throws — same convention as the other write-backs above;
// called after the completing approval's DB transaction has already committed.
export async function createBioTimeMissingPunch(params: { empCode: string; empId: number; punchTime: string; punchState: '0' | '1' }): Promise<BioTimeResult> {
    try {
        const response = await fetch(new URL('/api/attendance/missing-punches', ATTENDANCE_API_BASE).toString(), jsonPost({
            empCode: params.empCode,
            empId: params.empId,
            punchTime: params.punchTime,
            punchState: params.punchState,
            startDate: null,
            endDate: null,
        }));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

// Registers a disciplinary suspension in BioTime once a Suspension-type disciplinary action closes.
// A day covered by a suspension is excluded from that employee's absence count and reports as
// unpaid (totalWorkMins: 0) rather than a normal paid day. Fail-soft, never throws — same
// convention as createBioTimeLeaveRecord above.
export async function createBioTimeSuspension(params: { empCode: string; startDate: Date | string; endDate: Date | string; reason: string }): Promise<BioTimeResult> {
    try {
        const response = await fetch(new URL('/api/system-settings/suspensions', ATTENDANCE_API_BASE).toString(), jsonPost(params));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

// Registers an excused late / excused early-out in BioTime once an approved attendance-permission
// request completes, so the employee isn't penalised. Fail-soft, never throws.
async function postExcused(path: string, params: { empCode: string; date: Date | string; excusedMinutes: number; reason?: string }): Promise<BioTimeResult> {
    try {
        const response = await fetch(new URL(path, ATTENDANCE_API_BASE).toString(), jsonPost(params));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}
export const createBioTimeExcusedLate = (p: { empCode: string; date: Date | string; excusedMinutes: number; reason?: string }) =>
    postExcused('/api/attendance/excused-lates', p);
export const createBioTimeExcusedEarlyOut = (p: { empCode: string; date: Date | string; excusedMinutes: number; reason?: string }) =>
    postExcused('/api/attendance/excused-early-outs', p);

export interface ScheduledWorkHours { workStart: string; workEnd: string; source: 'shift' | 'multiplier' | 'default' }

const toDateOnly = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);
const inDateRange = (target: string, start: string, end: string) => target >= toDateOnly(start) && target <= toDateOnly(end);
const hhmm = (t: string) => t.slice(0, 5);

// Resolves an employee's expected work-start/work-end for a specific date, following the same
// priority BioTime itself applies when it computes lateness/early-out/OT for a punch: an active
// per-employee Shift override (createBioTimeEmployeeShift above / the Employee Shifts admin
// screen) > an active date-ranged Multiplier Factor override (e.g. Ramadan hours) that itself
// carries a workStart/workEnd > the system-wide default (SystemSettings WorkStart/WorkEnd). Used
// wherever WE decide a punch time ourselves instead of BioTime doing it (e.g. Missing Biometric
// Log), so the written-back punch matches what BioTime would actually expect for that employee on
// that date rather than assuming everyone works a fixed 9-to-5. Fail-soft at every tier — never
// throws, falls through to the next tier (and ultimately a hardcoded 09:00–17:00) if BioTime is
// unreachable or a tier has no applicable override.
export async function resolveScheduledWorkHours(empCode: string, date: Date | string): Promise<ScheduledWorkHours> {
    const targetDate = toDateOnly(date);

    try {
        const res = await fetch(new URL('/api/system-settings/employee-shifts', ATTENDANCE_API_BASE).toString());
        if (res.ok) {
            const shifts: any[] = await res.json().catch(() => []);
            const match = (Array.isArray(shifts) ? shifts : []).find((s) =>
                s?.empCode === empCode && s?.workStart && s?.workEnd && inDateRange(targetDate, s.startDate, s.endDate));
            if (match) return { workStart: hhmm(match.workStart), workEnd: hhmm(match.workEnd), source: 'shift' };
        }
    } catch { /* fall through to the multiplier-factor tier */ }

    try {
        const res = await fetch(new URL('/api/system-settings/multiplier-factors', ATTENDANCE_API_BASE).toString());
        if (res.ok) {
            const factors: any[] = await res.json().catch(() => []);
            const match = (Array.isArray(factors) ? factors : []).find((f) =>
                f?.workStart && f?.workEnd && inDateRange(targetDate, f.dateStart, f.dateEnd));
            if (match) return { workStart: hhmm(match.workStart), workEnd: hhmm(match.workEnd), source: 'multiplier' };
        }
    } catch { /* fall through to the system default */ }

    try {
        const res = await fetch(new URL('/api/system-settings', ATTENDANCE_API_BASE).toString());
        if (res.ok) {
            const snapshot: any = await res.json().catch(() => ({}));
            const settings: any[] = Array.isArray(snapshot?.systemSettings) ? snapshot.systemSettings : [];
            const workStart = settings.find((s) => s?.key === 'WorkStart')?.value;
            const workEnd = settings.find((s) => s?.key === 'WorkEnd')?.value;
            if (workStart && workEnd) return { workStart: hhmm(workStart), workEnd: hhmm(workEnd), source: 'default' };
        }
    } catch { /* fall through to the hardcoded last resort */ }

    // Absolute last resort — BioTime unreachable or no WorkStart/WorkEnd system setting configured
    // at all yet. Keeps this fail-soft, same convention as every write-back function above.
    return { workStart: '09:00', workEnd: '17:00', source: 'default' };
}

/** Resolves a schedule synchronously, from tiers already loaded. See loadScheduleResolver. */
export type ScheduleResolver = (empCode: string, date: Date | string) => ScheduledWorkHours;

/**
 * Loads all three schedule tiers ONCE and hands back a synchronous resolver applying exactly the
 * priority resolveScheduledWorkHours above applies: per-employee shift > date-ranged multiplier
 * factor (Ramadan hours) > the system-wide WorkStart/WorkEnd.
 *
 * resolveScheduledWorkHours costs up to three HTTP round-trips PER LOOKUP. A scan across the whole
 * roster would pay that per employee — 120 calls for 40 people, against a service measured failing
 * 7 of 12 concurrent requests (payrollAttendance.ts:9-12). This pays it three times in total.
 *
 * Fail-soft at every tier, same as the per-lookup version: an unreachable tier is simply skipped
 * and the next one answers, ending at the hardcoded 09:00-17:00 last resort.
 */
export async function loadScheduleResolver(): Promise<ScheduleResolver> {
    const getJson = async (path: string): Promise<any> => {
        try {
            const res = await fetch(new URL(path, ATTENDANCE_API_BASE).toString());
            if (!res.ok) return null;
            return await res.json().catch(() => null);
        } catch { return null; }
    };

    const [shiftsRaw, factorsRaw, snapshot] = [
        await getJson('/api/system-settings/employee-shifts'),
        await getJson('/api/system-settings/multiplier-factors'),
        await getJson('/api/system-settings'),
    ];
    const shifts: any[] = Array.isArray(shiftsRaw) ? shiftsRaw : [];
    const factors: any[] = Array.isArray(factorsRaw) ? factorsRaw : [];
    const settings: any[] = Array.isArray(snapshot?.systemSettings) ? snapshot.systemSettings : [];
    const defaultStart = settings.find((s) => s?.key === 'WorkStart')?.value;
    const defaultEnd = settings.find((s) => s?.key === 'WorkEnd')?.value;

    // Unlike the per-lookup version, nothing here is wrapped in a try/catch at call time, so a row
    // with a null date bound must not be allowed to throw out of the resolver — it is skipped.
    const covers = (target: string, start: unknown, end: unknown) =>
        typeof start === 'string' && typeof end === 'string' && inDateRange(target, start, end);

    return (empCode, date) => {
        const targetDate = toDateOnly(date);
        const shift = shifts.find((s) =>
            s?.empCode === empCode && s?.workStart && s?.workEnd && covers(targetDate, s.startDate, s.endDate));
        if (shift) return { workStart: hhmm(shift.workStart), workEnd: hhmm(shift.workEnd), source: 'shift' };

        const factor = factors.find((f) =>
            f?.workStart && f?.workEnd && covers(targetDate, f.dateStart, f.dateEnd));
        if (factor) return { workStart: hhmm(factor.workStart), workEnd: hhmm(factor.workEnd), source: 'multiplier' };

        if (defaultStart && defaultEnd) {
            return { workStart: hhmm(defaultStart), workEnd: hhmm(defaultEnd), source: 'default' };
        }
        return { workStart: '09:00', workEnd: '17:00', source: 'default' };
    };
}

// -------------------------------------------------------------------------------------------
// Correcting an existing punch
// -------------------------------------------------------------------------------------------

/**
 * The ONLY two punch types this system will ever write.
 *
 * `newState` on the attendance service is an UNVALIDATED free string that takes BioTime's whole
 * code set and applies it silently: "2"/"3" set Break Out/Break In and "4"/"5" set Overtime
 * In/Overtime Out, each answering 200 with a cheerful success message. That was found the hard
 * way — a probe sending "2" then "3" turned a real employee's punch into `Break In` and put their
 * day back to zero worked minutes, with nothing anywhere reporting a problem.
 *
 * So the vocabulary is fixed HERE, at the boundary, not in a dropdown: a caller-supplied code is
 * never forwarded. An off-by-one in some future UI can then only fail, never mis-set somebody's
 * day. Note the cost of that choice, which is deliberate: `Overtime Out` cannot be written back,
 * so undoing a correction means recording a superseding one, never restoring the old state.
 */
export const PUNCH_STATE_CODES = { 'Check In': '0', 'Check Out': '1' } as const;
export type CorrectablePunchState = keyof typeof PUNCH_STATE_CODES;

export const isCorrectablePunchState = (v: unknown): v is CorrectablePunchState =>
    typeof v === 'string' && Object.prototype.hasOwnProperty.call(PUNCH_STATE_CODES, v);

/**
 * Retypes an existing punch, and optionally moves it.
 *
 * THE TWO PUNCH KINDS BEHAVE DIFFERENTLY, and not the way the endpoint's shape suggests. Measured
 * against the live service on a throwaway employee:
 *
 * | call                            | device punch                    | manual punch          |
 * |---------------------------------|---------------------------------|-----------------------|
 * | PATCH {newState}                | 200, state applied, time kept   | **500, nothing done** |
 * | PATCH {newState, newTime}       | 200, state only (time protected)| 200, both applied     |
 * | DELETE                          | 404, protected                  | 200                   |
 *
 * So a manual punch cannot be retyped by state alone — the service's update path needs the time
 * field present. `isManual` therefore is not decoration: for a manual punch this function sends
 * the time it is ALREADY AT when the caller does not want to move it, which changes nothing and
 * is simply what the service requires to accept the call. For a device punch it sends no time at
 * all, because the time is protected and passing one only invites a success message describing a
 * change that did not happen.
 *
 * `newTime`/`currentTime` must be a bare local wall-clock string, 'YYYY-MM-DDTHH:mm:ss', with no
 * timezone suffix. The service stores those digits literally, so a `Date`/`toISOString()` here
 * would shift the punch by the server's UTC offset — the exact bug that once recorded a 14:30
 * entry as 12:30.
 *
 * Fail-soft like every write-back in this file. And note what a `success: true` does and does not
 * mean: it means the service accepted the call, nothing more. Every one of the wrong writes above
 * returned success too, which is why the caller re-reads the day instead of believing this.
 */
export async function updateBioTimePunch(params: {
    punchId: number;
    toState: CorrectablePunchState;
    isManual: boolean;
    /** Where the punch already sits, 'YYYY-MM-DDTHH:mm:ss'. Required for a manual punch. */
    currentTime?: string;
    /** Only for a manual punch the caller genuinely wants to move. */
    newTime?: string;
}): Promise<BioTimeResult> {
    if (!isCorrectablePunchState(params.toState)) {
        return { success: false, message: `Refusing to write punch state "${params.toState}".` };
    }
    const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    for (const value of [params.newTime, params.currentTime]) {
        if (value !== undefined && !WALL_CLOCK.test(value)) {
            return { success: false, message: 'Punch times must be local YYYY-MM-DDTHH:mm:ss strings.' };
        }
    }
    if (!params.isManual && params.newTime) {
        return { success: false, message: 'A terminal punch keeps its original time; it cannot be moved.' };
    }
    // The time a manual punch must carry: where the caller is moving it, or where it already is.
    const timeForManual = params.newTime || params.currentTime;
    if (params.isManual && !timeForManual) {
        return { success: false, message: 'A manual punch can only be retyped together with its time.' };
    }
    try {
        const body: Record<string, string> = { newState: PUNCH_STATE_CODES[params.toState] };
        if (params.isManual && timeForManual) body.newTime = timeForManual;
        const response = await fetch(
            new URL(`/api/attendance/punches/${params.punchId}`, ATTENDANCE_API_BASE).toString(),
            { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

/**
 * Deletes a punch. MANUAL punches only — the service refuses a device punch with a 404, and the
 * correction controller must not offer or attempt it: a refusal that reads as "not found" is easy
 * to log as a success by accident.
 */
export async function deleteBioTimePunch(params: { punchId: number }): Promise<BioTimeResult> {
    try {
        const response = await fetch(
            new URL(`/api/attendance/punches/${params.punchId}`, ATTENDANCE_API_BASE).toString(),
            { method: 'DELETE' },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

/**
 * Re-reads ONE day for one employee straight from the attendance service.
 *
 * This is the verification step, and it exists because the service's reply cannot be trusted to
 * describe what it did. Every write auto-invalidates its transactions cache, so this reflects the
 * correction immediately.
 */
export async function readBioTimeDay(params: { bioEmpId: number; date: string }): Promise<{
    ok: boolean;
    message?: string;
    day?: { date: string; totalWorkMins: number; lateMins: number; punches: any[] } | null;
}> {
    try {
        const url = new URL(`/api/attendance/monthly-report/${params.bioEmpId}`, ATTENDANCE_API_BASE);
        url.searchParams.set('start', params.date);
        url.searchParams.set('end', params.date);
        const response = await fetch(url.toString());
        if (!response.ok) return { ok: false, message: `BioTime returned ${response.status}` };
        const report: any = await response.json().catch(() => null);
        const rows: any[] = Array.isArray(report?.reportData) ? report.reportData : [];
        const day = rows.find(r => String(r?.date || '').slice(0, 10) === params.date) || null;
        if (!day) return { ok: true, day: null };
        return {
            ok: true,
            day: {
                date: params.date,
                totalWorkMins: Number(day.totalWorkMins) || 0,
                lateMins: Number(day.lateMins) || 0,
                punches: Array.isArray(day.punches) ? day.punches : [],
            },
        };
    } catch (error: any) {
        return { ok: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

// -------------------------------------------------------------------------------------------
// Approved overtime
// -------------------------------------------------------------------------------------------

/**
 * Records approved overtime for a PERIOD.
 *
 * Only `totalApprovedOTMins` is ever paid — the punch-derived `totalOTMins` is a reference figure
 * payroll ignores — so this function writes the number that becomes somebody's wage. `hours` and
 * `minutes` are the TOTAL for the whole period, not a daily rate.
 *
 * Three behaviours were measured against the live service and every caller depends on them:
 *
 *  1. Re-posting the EXACT same startDate+endDate upserts. Any other period, even an overlapping
 *     one, is a separate record and the two are SUMMED: 1-10 Sep at 4h then 1-15 Sep at 1h reads
 *     back as 5h. There is no delete endpoint, so a wrong approval can only be neutralised by
 *     re-posting its exact period at zero.
 *  2. A report range that merely INTERSECTS the period counts its full value, with no pro-rating.
 *     One 8-hour approval for 20-30 Sep therefore lands in full in BOTH payroll runs — measured:
 *     +480 in financial month 09 and +480 in month 10, 960 minutes paid for 8 hours worked. The
 *     caller must keep a period inside one financial month.
 *  3. An UNKNOWN empCode returns 200 "saved successfully" and creates a record belonging to
 *     nobody. The service does not check that the employee exists, so the caller must.
 *
 * Dates are bare local 'YYYY-MM-DD' strings. Never a Date or toISOString(): the service stores the
 * digits it is given, and that is how a 14:30 punch was once recorded as 12:30.
 */
export async function createBioTimeOvertime(params: {
    empCode: string;
    startDate: string;
    endDate: string;
    hours: number;
    minutes: number;
    reason?: string | null;
    notes?: string | null;
}): Promise<BioTimeResult> {
    const DAY = /^\d{4}-\d{2}-\d{2}$/;
    if (!params.empCode?.trim()) return { success: false, message: 'An employee code is required.' };
    if (!DAY.test(params.startDate) || !DAY.test(params.endDate)) {
        return { success: false, message: 'Overtime dates must be local YYYY-MM-DD strings.' };
    }
    // String comparison is safe and correct for ISO day strings, and avoids a Date round-trip.
    if (params.startDate > params.endDate) {
        return { success: false, message: 'The start of the period must not be after its end.' };
    }
    if (!Number.isInteger(params.hours) || params.hours < 0) {
        return { success: false, message: 'Hours must be a whole number of zero or more.' };
    }
    if (!Number.isInteger(params.minutes) || params.minutes < 0 || params.minutes > 59) {
        return { success: false, message: 'Minutes must be a whole number between 0 and 59.' };
    }

    try {
        const response = await fetch(
            new URL('/api/attendance/overtimes', ATTENDANCE_API_BASE).toString(),
            jsonPost({
                empCode: params.empCode,
                startDate: params.startDate,
                endDate: params.endDate,
                hours: params.hours,
                minutes: params.minutes,
                reason: params.reason ?? null,
                notes: params.notes ?? null,
            }),
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, message: (data as any)?.message || `BioTime returned ${response.status}` };
        }
        return { success: true, message: (data as any)?.message };
    } catch (error: any) {
        return { success: false, message: error?.message || 'Failed to reach the attendance system.' };
    }
}

/** One approved-overtime record as the monthly report returns it on `empOvertimes`. */
export interface BioTimeOvertimeRecord {
    id: number;
    empCode: string;
    approvedMinutes: string; // "HH:mm:ss"
    reason: string | null;
    notes: string | null;
    createdBy: string | null;
    createdAt: string;
    approvedBy: string | null;
    approvedAt: string | null;
    startDate: string;
    endDate: string;
}

/**
 * The approval records the service holds for one employee over a range.
 *
 * There is no list endpoint for overtime — `/api/attendance/overtimes` is POST-only — but the
 * monthly report carries the records themselves on `empOvertimes`, and they DO carry the period
 * (verified live: `startDate`/`endDate`, not the single `date` the old shape used). That makes the
 * service, not just our own log, able to answer "what has already been approved here".
 */
export async function readBioTimeOvertimes(params: {
    bioEmpId: number; start: string; end: string;
}): Promise<{ ok: boolean; message?: string; records: BioTimeOvertimeRecord[] }> {
    try {
        const url = new URL(`/api/attendance/monthly-report/${params.bioEmpId}`, ATTENDANCE_API_BASE);
        url.searchParams.set('start', params.start);
        url.searchParams.set('end', params.end);
        const response = await fetch(url.toString());
        if (!response.ok) return { ok: false, message: `BioTime returned ${response.status}`, records: [] };
        const report: any = await response.json().catch(() => null);
        return { ok: true, records: Array.isArray(report?.empOvertimes) ? report.empOvertimes : [] };
    } catch (error: any) {
        return { ok: false, message: error?.message || 'Failed to reach the attendance system.', records: [] };
    }
}
