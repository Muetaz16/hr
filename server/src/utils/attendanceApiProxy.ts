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
