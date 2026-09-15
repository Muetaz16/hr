import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import { ATTENDANCE_API_BASE, proxy, jsonPost, findBioTimeEmpIdByCode, fetchBioTimeRoster } from '../utils/attendanceApiProxy';
import { resolveScheduledWorkHours } from '../utils/attendanceApiProxy';
import { annotateReportDays } from '../utils/attendanceAnomaly';
import {
    scanPunchAnomalies, cachedScanPunchAnomalies, loadScanEmployees, localTodayKey,
} from '../utils/punchAnomalyScan';
import { currentPeriod, financialMonthRange, isValidPeriod, toApiDate } from '../utils/payrollPeriod';

import { prisma } from '../lib/prisma';

// Resolves the logged-in user's own Employee record — same lookup chain as
// employeeController.getMyEmployeeRecord's primary path (by userId, falling back to email).
const resolveMyEmployee = async (req: AuthRequest) => {
    if (!req.user?.id) return null;
    let employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee && req.user.email) {
        employee = await prisma.employee.findFirst({ where: { email: req.user.email } });
    }
    return employee;
};

// Today as the LOCAL calendar day. Deliberately not toISOString().slice(0,10): that is UTC, and
// between midnight and 02:00 Tripoli time it still reads yesterday — which would make the real
// today look like a future date and get a still-in-progress day flagged as broken. Same shape as
// disciplinaryAttendance.ts's own `fmt`.
const localDayKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Attaches the punch-anomaly verdict to every day of a monthly report before it leaves the server.
//
// Doing it here rather than in each screen is the whole point: server/ and src/ share no code, and
// the one existing hand-port (disciplinaryAttendance.ts) has already drifted from its original. With
// the verdict on the payload, the HR screen, the employee's own page and the correction queue can
// never disagree about whether a day is broken.
//
// The schedule is resolved ONCE per report, not per day — see annotateReportDays for why. Failure to
// resolve it is not fatal: the anomaly rules that need it simply degrade (no suggested time for an
// ADD, no short-day advisory), and a report is never withheld because a settings lookup failed.
const withAnomalies = async (report: any, empCode?: string | null) => {
    let workStart: string | undefined;
    let workEnd: string | undefined;
    if (empCode) {
        try {
            const first = report?.reportData?.[0]?.date;
            const schedule = await resolveScheduledWorkHours(empCode, first ? String(first).slice(0, 10) : new Date());
            workStart = schedule.workStart;
            workEnd = schedule.workEnd;
        } catch { /* degrade, never fail the report */ }
    }
    return annotateReportDays(report, { todayKey: localDayKey(new Date()), workStart, workEnd });
};

// GET /api/attendance-integration/me/monthly-report?start=&end=
// Self-service: the logged-in employee's own daily breakdown for a date range — same shape as
// getAttendanceMonthlyReport below, just resolving "me" to a BioTime empId instead of taking one
// as a path param. Any authenticated employee can call this (not just attendance-permission holders).
export const getMyMonthlyReport = async (req: Request, res: Response) => {
    try {
        const employee = await resolveMyEmployee(req as AuthRequest);
        if (!employee?.staffId) {
            return res.status(404).json({ error: 'No attendance record is linked to your account yet — contact HR.' });
        }

        const { start, end } = req.query;
        // Their per-employee endpoints take BioTime's own numeric id, not our staffId/empCode —
        // resolve it by matching staffId against the roster summary first.
        const rosterUrl = new URL('/api/attendance/summary', ATTENDANCE_API_BASE);
        if (start) rosterUrl.searchParams.set('start', String(start));
        if (end) rosterUrl.searchParams.set('end', String(end));
        const rosterResponse = await fetch(rosterUrl.toString());
        if (!rosterResponse.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${rosterResponse.status}).` });
        }
        const rosterData: any = await rosterResponse.json();
        const mine = (rosterData.employees || []).find((e: any) => e.empCode === employee.staffId);
        if (!mine) {
            return res.status(404).json({ error: 'No attendance data found for you in this date range.' });
        }

        const url = new URL(`/api/attendance/monthly-report/${mine.empId}`, ATTENDANCE_API_BASE);
        if (start) url.searchParams.set('start', String(start));
        if (end) url.searchParams.set('end', String(end));
        const response = await fetch(url.toString());
        if (response.status === 404) {
            return res.status(404).json({ error: 'No attendance data found for you in this date range.' });
        }
        if (!response.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${response.status}).` });
        }
        res.json(await withAnomalies(await response.json(), employee.staffId));
    } catch (error) {
        console.error('Error fetching my monthly report:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// GET /api/attendance-integration/summary?start=&end=
// Proxies the attendance system's per-employee summary for a date range and joins it onto our
// own Employee records — matched by staffId (ours) <-> empCode (theirs, e.g. "IPH-0125-001").
export const getAttendanceSummary = async (req: Request, res: Response) => {
    try {
        const { start, end } = req.query;
        const url = new URL('/api/attendance/summary', ATTENDANCE_API_BASE);
        if (start) url.searchParams.set('start', String(start));
        if (end) url.searchParams.set('end', String(end));

        const response = await fetch(url.toString());
        if (!response.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${response.status}).` });
        }
        const data: any = await response.json();

        const employees = await prisma.employee.findMany({
            // Transferred (inter-company) staff ARE still tracked in attendance.
            where: { staffId: { not: null } },
            select: { id: true, staffId: true, fullName: true, departmentId: true, position: true },
        });
        const byStaffId = new Map(employees.map(e => [e.staffId, e]));

        const merged = (data.employees || []).map((att: any) => {
            const matched = byStaffId.get(att.empCode);
            return {
                ...att,
                employeeId: matched?.id || null,
                matchedFullName: matched?.fullName || null,
                departmentId: matched?.departmentId || null,
                position: matched?.position || null,
            };
        });

        res.json({ startDate: data.startDate, endDate: data.endDate, employees: merged });
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// GET /api/attendance-integration/leave-types — passthrough reference list.
export const getAttendanceLeaveTypes = async (req: Request, res: Response) => {
    try {
        const response = await fetch(new URL('/api/attendance/leave-types', ATTENDANCE_API_BASE).toString());
        if (!response.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${response.status}).` });
        }
        res.json(await response.json());
    } catch (error) {
        console.error('Error fetching attendance leave types:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// GET /api/attendance-integration/dashboard — note: on the attendance system this lives at
// /api/dashboard, a separate controller from /api/attendance/* (per their API.md).
export const getAttendanceDashboard = async (req: Request, res: Response) => {
    try {
        const response = await fetch(new URL('/api/dashboard', ATTENDANCE_API_BASE).toString());
        if (!response.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${response.status}).` });
        }
        res.json(await response.json());
    } catch (error) {
        console.error('Error fetching attendance dashboard:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// GET /api/attendance-integration/history/:empId?start=&end=
// Per-employee totals + a daily first-punch/last-punch breakdown. :empId is the attendance
// system's own numeric BioTime id (e.g. the `empId` field returned by the summary endpoint) —
// NOT our staffId/empCode.
export const getAttendanceHistory = async (req: Request, res: Response) => {
    try {
        const { empId } = req.params;
        const { start, end } = req.query;
        const url = new URL(`/api/attendance/history/${encodeURIComponent(empId)}`, ATTENDANCE_API_BASE);
        if (start) url.searchParams.set('start', String(start));
        if (end) url.searchParams.set('end', String(end));

        const response = await fetch(url.toString());
        if (!response.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${response.status}).` });
        }
        res.json(await response.json());
    } catch (error) {
        console.error('Error fetching attendance history:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// GET /api/attendance-integration/monthly-report/:empId?start=&end=
// Full per-day breakdown (late/early/OT/leave/holiday/out-work/excused-late) for one employee.
// :empId is the attendance system's numeric BioTime id, same as getAttendanceHistory above.
export const getAttendanceMonthlyReport = async (req: Request, res: Response) => {
    try {
        const { empId } = req.params;
        const { start, end } = req.query;
        const url = new URL(`/api/attendance/monthly-report/${encodeURIComponent(empId)}`, ATTENDANCE_API_BASE);
        if (start) url.searchParams.set('start', String(start));
        if (end) url.searchParams.set('end', String(end));

        const response = await fetch(url.toString());
        if (response.status === 404) {
            return res.status(404).json({ error: 'Employee not found in the attendance system.' });
        }
        if (!response.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${response.status}).` });
        }
        const report: any = await response.json();
        // empCode is not a path param here, but the report carries it — needed to resolve the
        // employee's own shift rather than falling back to the company default.
        res.json(await withAnomalies(report, report?.empCode));
    } catch (error) {
        console.error('Error fetching attendance monthly report:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// GET /api/attendance-integration/manual-transactions?start=&end=&searchTerm=
// Punches whose terminal alias is "manual" — i.e. entries that were hand-corrected rather than
// coming straight off a BioTime device. This is the attendance officer's daily exception queue.
export const getManualTransactions = async (req: Request, res: Response) => {
    try {
        const { start, end, searchTerm } = req.query;
        const url = new URL('/api/attendance/manual-transactions', ATTENDANCE_API_BASE);
        if (start) url.searchParams.set('start', String(start));
        if (end) url.searchParams.set('end', String(end));
        if (searchTerm) url.searchParams.set('searchTerm', String(searchTerm));

        const response = await fetch(url.toString());
        if (!response.ok) {
            return res.status(502).json({ error: `The attendance system returned an error (${response.status}).` });
        }
        res.json(await response.json());
    } catch (error) {
        console.error('Error fetching manual transactions:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// POST /api/attendance-integration/missing-punches
// Logs a forgotten punch (check-in or check-out) for an employee straight into BioTime.
export const addMissingPunch = async (req: Request, res: Response) => {
    try {
        const { empCode, empId, punchTime, punchState, startDate, endDate } = req.body;
        if (!empCode || !empId || !punchTime || (punchState !== '0' && punchState !== '1')) {
            return res.status(400).json({ error: 'empCode, empId, punchTime and a valid punchState (0=check-in, 1=check-out) are required.' });
        }

        const response = await fetch(new URL('/api/attendance/missing-punches', ATTENDANCE_API_BASE).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empCode, empId, punchTime, punchState, startDate: startDate || null, endDate: endDate || null }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return res.status(502).json({ error: (data as any)?.message || `The attendance system rejected the request (${response.status}).` });
        }
        res.json(data);
    } catch (error) {
        console.error('Error adding missing punch:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

// --- Daily Logging ---------------------------------------------------------------------------
// Create goes through the quick /api/attendance/* endpoints; list/delete go through
// /api/system-settings/* — those are the only ones that expose GET/DELETE for this data.
// (There is no documented list/delete endpoint for overtimes, only the quick-add below.)

// POST /api/attendance-integration/leaves — register + auto-approve a leave.
export const addLeave = (req: Request, res: Response) => {
    const { empCode, leaveTypeId, startDate, endDate, notes } = req.body;
    if (!empCode || !leaveTypeId || !startDate || !endDate) {
        return res.status(400).json({ error: 'empCode, leaveTypeId, startDate and endDate are required.' });
    }
    return proxy(res, '/api/attendance/leaves', jsonPost({ empCode, leaveTypeId, startDate, endDate, notes }));
};

// GET /api/attendance-integration/employee-leaves — review list (newest first).
export const getEmployeeLeaves = (req: Request, res: Response) => proxy(res, '/api/system-settings/employee-leaves');

// DELETE /api/attendance-integration/employee-leaves/:id
export const deleteEmployeeLeave = (req: Request, res: Response) =>
    proxy(res, `/api/system-settings/employee-leaves/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });

// Approved overtime moved to attendanceOvertimeController. The handler that stood here sent the
// service's OLD single-`date` shape, which it no longer accepts — it takes a startDate/endDate
// period now — so it is removed rather than left for somebody to re-route.

// POST /api/attendance-integration/out-works — register an out-of-office/field-work period.
export const addOutWork = (req: Request, res: Response) => {
    const { empCode, startDate, endDate, reason } = req.body;
    if (!empCode || !startDate || !endDate) {
        return res.status(400).json({ error: 'empCode, startDate and endDate are required.' });
    }
    return proxy(res, '/api/attendance/out-works', jsonPost({ empCode, startDate, endDate, reason }));
};

// GET /api/attendance-integration/out-works — review list (newest first).
export const getOutWorks = (req: Request, res: Response) => proxy(res, '/api/system-settings/out-works');

// DELETE /api/attendance-integration/out-works/:id
export const deleteOutWork = (req: Request, res: Response) =>
    proxy(res, `/api/system-settings/out-works/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });

// POST /api/attendance-integration/excused-lates — register an excused-late allowance for a
// single day (their AddExcusedLateDto — updated to a single `date`, not a startDate/endDate range).
export const addExcusedLate = (req: Request, res: Response) => {
    const { empCode, date, excusedMinutes, reason } = req.body;
    if (!empCode || !excusedMinutes) {
        return res.status(400).json({ error: 'empCode and excusedMinutes are required.' });
    }
    return proxy(res, '/api/attendance/excused-lates', jsonPost({ empCode, date, excusedMinutes, reason }));
};

// GET /api/attendance-integration/excused-lates — review list (newest first). Now returns a
// single `date` per record (matching the quick-add DTO change), not a startDate/endDate range.
export const getExcusedLates = (req: Request, res: Response) => proxy(res, '/api/system-settings/excused-lates');

// POST /api/attendance-integration/excused-early-outs — register an excused early-out (early
// leave) allowance for a single day.
export const addExcusedEarlyOut = (req: Request, res: Response) => {
    const { empCode, date, excusedMinutes, reason } = req.body;
    if (!empCode || !excusedMinutes) {
        return res.status(400).json({ error: 'empCode and excusedMinutes are required.' });
    }
    return proxy(res, '/api/attendance/excused-early-outs', jsonPost({ empCode, date, excusedMinutes, reason }));
};

// DELETE /api/attendance-integration/excused-lates/:id
export const deleteExcusedLate = (req: Request, res: Response) =>
    proxy(res, `/api/system-settings/excused-lates/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });

// GET /api/attendance-integration/excused-early-outs — review list (newest first).
export const getExcusedEarlyOuts = (req: Request, res: Response) => proxy(res, '/api/system-settings/excused-early-outs');

// DELETE /api/attendance-integration/excused-early-outs/:id
export const deleteExcusedEarlyOut = (req: Request, res: Response) =>
    proxy(res, `/api/system-settings/excused-early-outs/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });

// --- Employees (BioTime roster CRUD) ---------------------------------------------------------
// These manage the employee record inside the attendance system itself (its own numeric id +
// position), not our Employee table. There is no lookup endpoint for positions/departments — the
// attendance system only exposes 4 fixed positions, discovered by inspecting the live roster.

// GET /api/attendance-integration/biotime-employees?searchTerm=
export const getBioTimeEmployees = (req: Request, res: Response) => {
    const { searchTerm } = req.query;
    const qs = searchTerm ? `?searchTerm=${encodeURIComponent(String(searchTerm))}` : '';
    return proxy(res, `/api/attendance${qs}`);
};

// POST /api/attendance-integration/biotime-employees
export const createBioTimeEmployee = async (req: Request, res: Response) => {
    const { empCode, firstName, positionId } = req.body;
    if (!empCode || !firstName || !positionId) {
        return res.status(400).json({ error: 'empCode, firstName and positionId are required.' });
    }
    await proxy(res, '/api/attendance/employees', jsonPost({ empCode, firstName, positionId }));
    // Backfill our own Employee.bioId if this empCode matches a staffId that's still waiting on
    // one — e.g. auto-provisioning failed at Employee-creation time (BioTime was down) and
    // attendance staff are now finishing the link manually here. Runs after proxy() has already
    // sent the response, so it never touches `res` again — and runs regardless of whether the
    // create above succeeded or reported "already exists", since either way the empCode should
    // now resolve in BioTime's roster.
    try {
        const employee = await prisma.employee.findFirst({ where: { staffId: empCode, bioId: null } });
        if (employee) {
            const bioId = await findBioTimeEmpIdByCode(empCode);
            if (bioId != null) {
                await prisma.employee.update({ where: { id: employee.id }, data: { bioId } });
            }
        }
    } catch (e) {
        console.error('[BioTime] Backfill lookup failed after manual employee creation:', e);
    }
};

// PATCH /api/attendance-integration/biotime-employees/:id
export const updateBioTimeEmployee = (req: Request, res: Response) => {
    const { firstName, positionId } = req.body;
    return proxy(res, `/api/attendance/employees/${encodeURIComponent(req.params.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, positionId }),
    });
};

// DELETE /api/attendance-integration/biotime-employees/:id
export const deleteBioTimeEmployee = (req: Request, res: Response) =>
    proxy(res, `/api/attendance/employees/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });

// POST /api/attendance-integration/sync-employees
// Pulls the full BioTime roster into our HR system as linked employee records. This is the
// reverse of the per-hire HR -> BioTime push in employeeController.createEmployee: here the
// employees already exist in BioTime (the biometric devices are the source of truth for the
// real staff), and we backfill them into HR so Payroll/Evaluations/etc. can reference them.
//
// Matching is by BioTime numeric id (Employee.bioId) first, then by staff code
// (Employee.staffId == emp_code). The operation is idempotent and safe to re-run:
//   - already-linked employees are left untouched (only a missing bioId is backfilled),
//   - new BioTime employees are created as PENDING_ENROLLMENT stubs with NO login account and
//     NO Job Description — HR completes their enrolment later (which is when the account/email
//     and JD/role/department are assigned). Pending stubs are kept out of payroll/eval lists.
export const syncEmployeesFromBioTime = async (req: Request, res: Response) => {
    try {
        const roster = await fetchBioTimeRoster();
        if (roster.length === 0) {
            return res.status(502).json({ error: 'Could not read any employees from the attendance system. Is it running?' });
        }

        // Load existing HR employees once so matching is in-memory rather than a query per row.
        const existing = await prisma.employee.findMany({
            select: { id: true, staffId: true, bioId: true },
        });
        const byBioId = new Map<number, { id: string; bioId: number | null }>();
        const byStaffId = new Map<string, { id: string; bioId: number | null }>();
        for (const e of existing) {
            if (e.bioId != null) byBioId.set(e.bioId, e);
            if (e.staffId) byStaffId.set(e.staffId, e);
        }

        const result = { created: 0, linked: 0, unchanged: 0, createdNames: [] as string[] };

        for (const emp of roster) {
            const match = byBioId.get(emp.id) || byStaffId.get(emp.empCode);

            if (match) {
                // Existing HR employee — backfill the BioTime id if it isn't linked yet, otherwise
                // leave the record exactly as HR maintains it.
                if (match.bioId == null) {
                    await prisma.employee.update({ where: { id: match.id }, data: { bioId: emp.id } });
                    result.linked++;
                } else {
                    result.unchanged++;
                }
                continue;
            }

            // New person from BioTime — create an identity-only pending stub. No User account and
            // no Job Description (position is left unset, not BioTime's residency classification —
            // that's a different concept entirely): those are created when HR completes the enrolment.
            await prisma.employee.create({
                data: {
                    fullName: emp.firstName || emp.empCode,
                    staffId: emp.empCode,
                    bioId: emp.id,
                    role: 'EMPLOYEE',
                    enrollmentStatus: 'PENDING_ENROLLMENT',
                    joinDate: new Date(),
                    contractStatus: 'Pending',
                },
            });
            result.created++;
            if (result.createdNames.length < 50) result.createdNames.push(emp.firstName || emp.empCode);
        }

        return res.json({
            message: `Imported ${result.created} new employee(s), linked ${result.linked}, ${result.unchanged} already up to date.`,
            rosterCount: roster.length,
            ...result,
        });
    } catch (error: any) {
        console.error('[BioTime] Employee sync failed:', error);
        return res.status(500).json({ error: error?.message || 'Failed to sync employees from the attendance system.' });
    }
};

// ---------------------------------------------------------------------------------------------
// Punch anomalies — the cross-employee queue
// ---------------------------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/attendance-integration/punch-anomalies?period=|start=&end=&empCode=&refresh=true
 *
 * Every day, across the roster, whose punches did not come out as a working day. Ask by `period`
 * (YYYY-MM, a financial month) or by an explicit `start`/`end` pair. With neither, it answers for
 * the current financial month (25th -> 24th), which is the window a payroll run will read — the
 * point of the queue is to clear it BEFORE that run computes.
 *
 * `empCode` narrows the sweep to one employee and bypasses the cache: it is what the correction
 * screen calls to re-check its own work immediately after pushing a fix.
 */
export const getPunchAnomalies = async (req: Request, res: Response) => {
    try {
        const rawStart = typeof req.query.start === 'string' ? req.query.start : '';
        const rawEnd = typeof req.query.end === 'string' ? req.query.end : '';
        const rawPeriod = typeof req.query.period === 'string' ? req.query.period.trim() : '';
        const empCode = typeof req.query.empCode === 'string' ? req.query.empCode.trim() : '';
        const refresh = String(req.query.refresh || '') === 'true';

        let start: string;
        let end: string;
        if (rawPeriod) {
            // `period=YYYY-MM` is the normal way to ask, because a financial month is the unit that
            // actually decides anything here: a day corrected before its run computes costs nobody
            // a thing, the same day corrected after means a correction against an approved run.
            // The 25th->24th arithmetic stays on THIS side deliberately — a second copy of it in
            // the client is how the boundary quietly starts disagreeing with payroll.
            if (!isValidPeriod(rawPeriod)) {
                return res.status(400).json({ error: 'period must be YYYY-MM.' });
            }
            if (rawStart || rawEnd) {
                return res.status(400).json({ error: 'Pass either period or start/end, not both.' });
            }
            const range = financialMonthRange(rawPeriod);
            start = toApiDate(range.start);
            end = toApiDate(range.end);
        } else if (DATE_RE.test(rawStart) && DATE_RE.test(rawEnd)) {
            start = rawStart;
            end = rawEnd;
        } else if (rawStart || rawEnd) {
            // Half a range, or a malformed one, is not something to guess at: the attendance
            // service ignores parameters it cannot parse and answers for a rolling last-7-days
            // window instead, so a silent fallback would show a confidently wrong queue.
            return res.status(400).json({ error: 'start and end must both be YYYY-MM-DD dates.' });
        } else {
            const range = financialMonthRange(currentPeriod());
            start = toApiDate(range.start);
            end = toApiDate(range.end);
        }
        if (start > end) return res.status(400).json({ error: 'start must not be after end.' });

        // A single-employee sweep is one HTTP call, and it deliberately bypasses the cache: the
        // caller asking for one employee is the correction screen, checking its own work landed.
        if (empCode) {
            const employees = await loadScanEmployees(empCode);
            if (employees.length === 0) {
                return res.status(404).json({ error: 'No active employee is linked to that staff code.' });
            }
            const result = await scanPunchAnomalies(employees, start, end, localTodayKey());
            return res.json({ ...result, cached: false });
        }

        res.json(await cachedScanPunchAnomalies(start, end, { refresh }));
    } catch (error) {
        console.error('Error scanning punch anomalies:', error);
        res.status(502).json({ error: 'Failed to reach the attendance system. Is it running?' });
    }
};

