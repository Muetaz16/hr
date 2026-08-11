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
