// Approving overtime, and keeping a record of it.
//
// Only `totalApprovedOTMins` is paid; the punch-derived `totalOTMins` is a reference figure payroll
// ignores. So everything here writes wages, and three measured behaviours of the attendance service
// shape all of it:
//
//  1. AN APPROVAL PERIOD MUST NOT SPAN TWO FINANCIAL MONTHS. A report range that merely intersects
//     an approval counts its FULL value, with no pro-rating. One 8-hour approval for 20-30 Sep was
//     measured landing +480 minutes in financial month 09 AND +480 in month 10 — 16 hours paid for
//     8 worked. The guard is enforced here, not only in the browser.
//
//  2. APPROVALS STACK AND CANNOT BE DELETED. Re-posting the exact same period upserts, but any
//     other period — even an overlapping one — is a separate record and the two are summed. There
//     is no delete endpoint. That is why every push is logged: the log is the only way to find the
//     exact period again in order to neutralise it by re-posting it at zero.
//
//  3. AN UNKNOWN empCode RETURNS 200 "saved successfully". The service does not check that the
//     employee exists, so a typo silently creates an approval belonging to nobody. Every code is
//     checked against the live roster before anything is written.
import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ATTENDANCE_API_BASE, createBioTimeOvertime } from '../utils/attendanceApiProxy';
import { periodForDate } from '../utils/payrollPeriod';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 200;

interface ApprovalRow { empCode?: string; hours?: number; minutes?: number }

/** The roster, keyed by empCode — one call, used both to reject typos and to verify afterwards. */
const readRoster = async (start: string, end: string) => {
    const url = new URL('/api/attendance/summary', ATTENDANCE_API_BASE);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`the attendance system returned ${response.status}`);
    const data: any = await response.json();
    const rows: any[] = Array.isArray(data?.employees) ? data.employees : [];
    return new Map<string, any>(rows.map(r => [String(r.empCode), r]));
};

/**
 * POST /api/attendance-integration/overtime-approvals
 *
 * Body: { startDate, endDate, reason, headName?, notes?, rows: [{ empCode, hours, minutes }] }
 *
 * One period, many employees — which is how the approval actually arrives: a head replies about
 * their whole team for one span of days.
 *
 * `empCode` is kept on every row so the audit middleware's existing `attendance-integration` branch
 * can still name the subject employee; do not tidy it out of the payload.
 */
export const createOvertimeApprovals = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        const startDate = typeof req.body?.startDate === 'string' ? req.body.startDate.trim() : '';
        const endDate = typeof req.body?.endDate === 'string' ? req.body.endDate.trim() : '';
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        const headName = typeof req.body?.headName === 'string' ? req.body.headName.trim() : '';
        const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
        const rows: ApprovalRow[] = Array.isArray(req.body?.rows) ? req.body.rows : [];

        if (!DAY_RE.test(startDate) || !DAY_RE.test(endDate)) {
            return res.status(400).json({ error: 'startDate and endDate must be YYYY-MM-DD.' });
        }
        if (startDate > endDate) {
            return res.status(400).json({ error: 'The start of the period must not be after its end.' });
        }
        // Hazard 1. Local midnight, never a bare date string: that parses as UTC and can resolve to
        // the previous day, which would put the boundary in the wrong place.
        const startPeriod = periodForDate(new Date(`${startDate}T00:00:00`));
        const endPeriod = periodForDate(new Date(`${endDate}T00:00:00`));
        if (startPeriod !== endPeriod) {
            return res.status(400).json({
                error: `This period crosses the payroll boundary between ${startPeriod} and ${endPeriod}. `
                    + 'The attendance system counts an approval in full for every payroll run it touches, so '
                    + 'these hours would be paid twice. Split it into one approval per financial month.',
            });
        }
        if (reason.length < 3) {
            return res.status(400).json({ error: 'A reason is required — it is the record of who authorised these hours.' });
        }
        if (!rows.length) return res.status(400).json({ error: 'No employees to approve.' });
        if (rows.length > MAX_ROWS) return res.status(400).json({ error: `At most ${MAX_ROWS} employees at a time.` });

        // Validate EVERY row before writing any of them. A half-applied batch on a path that pays
        // wages is worse than a rejected one, and none of this validation costs a round trip.
        const seen = new Set<string>();
        for (const row of rows) {
            const code = String(row?.empCode || '').trim();
            if (!code) return res.status(400).json({ error: 'Every row needs an employee code.' });
            if (seen.has(code)) {
                // Two rows for one employee would post twice to the same period; the second upserts
                // over the first, so the officer would silently get only one of the two figures.
                return res.status(400).json({ error: `${code} appears twice in this batch.` });
            }
            seen.add(code);
            if (!Number.isInteger(row.hours) || (row.hours as number) < 0) {
                return res.status(400).json({ error: `${code}: hours must be a whole number of zero or more.` });
            }
            if (!Number.isInteger(row.minutes) || (row.minutes as number) < 0 || (row.minutes as number) > 59) {
                return res.status(400).json({ error: `${code}: minutes must be a whole number between 0 and 59.` });
            }
        }

        // Hazard 3 — reject unknown codes before writing, since the service will not.
        let roster: Map<string, any>;
        try {
            roster = await readRoster(startDate, endDate);
        } catch (error) {
            return res.status(502).json({ error: `Could not read the attendance roster, so nothing was approved: ${(error as Error).message}` });
        }
        const unknown = [...seen].filter(code => !roster.has(code));
        if (unknown.length) {
            return res.status(400).json({
                error: `The attendance system has no employee with ${unknown.length > 1 ? 'these codes' : 'this code'}: ${unknown.join(', ')}. `
                    + 'It would accept the approval anyway and file it against nobody, so nothing was written.',
            });
        }

        const employees = await prisma.employee.findMany({
            where: { staffId: { in: [...seen] } },
            select: { id: true, staffId: true, fullName: true },
        });
        const empByCode = new Map(employees.map(e => [e.staffId as string, e]));

        // Sequential, deliberately: the attendance service fails under concurrency — 7 of 12
        // back-to-back calls failed in one measurement (payrollAttendance.ts:9-12).
        const results: { empCode: string; minutes: number; ok: boolean; message?: string }[] = [];
        for (const row of rows) {
            const empCode = String(row.empCode).trim();
            const minutes = (row.hours as number) * 60 + (row.minutes as number);
            const pushed = await createBioTimeOvertime({
                empCode,
                startDate,
                endDate,
                hours: row.hours as number,
                minutes: row.minutes as number,
                reason,
                notes: notes || null,
            });
            results.push({ empCode, minutes, ok: pushed.success, message: pushed.message });
        }

        // Never trust the write: re-read the range and record what the service now actually shows.
        // Note what this figure IS — the employee's TOTAL approved minutes over this range, which
        // includes any earlier overlapping approval, not just the row we pushed. It is evidence the
        // write landed, not a restatement of it.
        let verified: Map<string, any> | null = null;
        try {
            verified = await readRoster(startDate, endDate);
        } catch { /* the log simply records no verification rather than failing the whole batch */ }

        const period = startPeriod;
        const created = await Promise.all(results.map(r => prisma.overtimeApproval.create({
            data: {
                empCode: r.empCode,
                employeeId: empByCode.get(r.empCode)?.id ?? null,
                startDate,
                endDate,
                period,
                minutes: r.minutes,
                reason,
                notes: notes || null,
                headName: headName || null,
                status: r.ok ? 'APPLIED' : 'FAILED',
                sourceMessage: r.message ?? null,
                verifiedMins: verified?.get(r.empCode)?.totalApprovedOTMins ?? null,
                createdById: user?.id ?? null,
                createdByName: user?.fullName ?? null,
            },
        })));

        const failures = results.filter(r => !r.ok);
        res.locals.auditDetails = [
            `${results.length} employee(s)`,
            `${startDate} to ${endDate} (${period})`,
            `${results.reduce((s, r) => s + r.minutes, 0)} minutes total`,
            headName ? `approved by ${headName}` : null,
            `reason: "${reason}"`,
            failures.length ? `${failures.length} FAILED` : null,
        ].filter(Boolean).join(' — ');

        res.status(201).json({
            approvals: created,
            period,
            applied: results.length - failures.length,
            failures: failures.map(f => `${f.empCode}: ${f.message || 'the attendance system refused it'}`),
        });
    } catch (error) {
        console.error('Error approving overtime:', error);
        res.status(500).json({ error: 'Failed to record the overtime approval.' });
    }
};

/**
 * GET /api/attendance-integration/overtime-approvals?period=&empCode=&start=&end=
 *
 * Our own log. Read-only and append-only: there is no edit and no delete, because the approval it
 * describes cannot be edited or deleted in the attendance system either.
 *
 * `start`/`end` select every approval whose period OVERLAPS the range — which is the question the
 * overlap warning actually asks, and matches how the service itself counts an intersecting period.
 */
export const listOvertimeApprovals = async (req: Request, res: Response) => {
    try {
        const period = typeof req.query.period === 'string' ? req.query.period.trim() : '';
        const empCode = typeof req.query.empCode === 'string' ? req.query.empCode.trim() : '';
        const start = typeof req.query.start === 'string' ? req.query.start.trim() : '';
        const end = typeof req.query.end === 'string' ? req.query.end.trim() : '';
        const limit = Math.min(Number(req.query.limit) || 500, 2000);

        const approvals = await prisma.overtimeApproval.findMany({
            where: {
                ...(period ? { period } : {}),
                ...(empCode ? { empCode } : {}),
                // Two periods overlap when each starts before the other ends. String comparison is
                // exact for ISO day strings, which is one reason these columns are TEXT.
                ...(DAY_RE.test(start) && DAY_RE.test(end)
                    ? { startDate: { lte: end }, endDate: { gte: start } }
                    : {}),
            },
            orderBy: [{ startDate: 'desc' }, { appliedAt: 'desc' }],
            take: limit,
        });
        res.json({ approvals });
    } catch (error) {
        console.error('Error listing overtime approvals:', error);
        res.status(500).json({ error: 'Failed to load the overtime approvals.' });
    }
};


/**
 * Re-posts one approval's period with a new figure, and records what happened.
 *
 * This is the ONLY way to change or undo an approval, and it works because re-posting the exact
 * same startDate+endDate upserts in the attendance service — verified live: 5h became 2h on the
 * same record id, and 0h left that record present at 00:00:00 paying nothing.
 *
 * So a "delete" is a REVOKE. The row survives in the attendance system at zero; there is no delete
 * endpoint and never was. Anything that told the user the record had been removed would be a lie.
 *
 * Our own log stays append-only: the original row is marked SUPERSEDED and a new row records the
 * new figure. Nothing that actually happened is ever overwritten.
 */
const reviseApproval = async (
    req: Request, res: Response, opts: { revoke: boolean },
) => {
    const user = (req as AuthRequest).user;
    const id = String(req.params.id || '');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    const original = await prisma.overtimeApproval.findUnique({ where: { id } });
    if (!original) return res.status(404).json({ error: 'That approval is not on record.' });
    if (original.status === 'SUPERSEDED') {
        return res.status(409).json({
            error: 'This approval has already been replaced by a later one. Act on the current entry instead.',
        });
    }
    if (reason.length < 3) {
        return res.status(400).json({ error: 'A reason is required — this changes what somebody is paid.' });
    }

    let hours = 0;
    let minutes = 0;
    if (!opts.revoke) {
        hours = Number(req.body?.hours);
        minutes = Number(req.body?.minutes);
        if (!Number.isInteger(hours) || hours < 0) {
            return res.status(400).json({ error: 'Hours must be a whole number of zero or more.' });
        }
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
            return res.status(400).json({ error: 'Minutes must be a whole number between 0 and 59.' });
        }
        if (hours === 0 && minutes === 0) {
            // Zero through the edit path would silently be a revoke, logged as an edit.
            return res.status(400).json({ error: 'Use revoke to set an approval to zero, so the record says that is what happened.' });
        }
    }

    // The SAME period, which is what makes the service upsert rather than add a second record.
    const pushed = await createBioTimeOvertime({
        empCode: original.empCode,
        startDate: original.startDate,
        endDate: original.endDate,
        hours,
        minutes,
        reason,
        notes: original.notes,
    });

    // Never trust the write: read the period back and record what the service now actually shows.
    let verifiedMins: number | null = null;
    try {
        const roster = await readRoster(original.startDate, original.endDate);
        verifiedMins = roster.get(original.empCode)?.totalApprovedOTMins ?? null;
    } catch { /* the log records no verification rather than failing the change */ }

    const newMinutes = hours * 60 + minutes;
    const [, replacement] = await prisma.$transaction([
        // The only field ever changed on an existing row: it says a later row replaced this one.
        prisma.overtimeApproval.update({ where: { id }, data: { status: 'SUPERSEDED' } }),
        prisma.overtimeApproval.create({
            data: {
                empCode: original.empCode,
                employeeId: original.employeeId,
                startDate: original.startDate,
                endDate: original.endDate,
                period: original.period,
                minutes: newMinutes,
                reason,
                notes: original.notes,
                headName: original.headName,
                status: pushed.success ? (opts.revoke ? 'REVOKED' : 'APPLIED') : 'FAILED',
                sourceMessage: pushed.message ?? null,
                verifiedMins,
                createdById: user?.id ?? null,
                createdByName: user?.fullName ?? null,
            },
        }),
    ]);

    res.locals.auditDetails = [
        original.empCode,
        `${original.startDate} to ${original.endDate}`,
        opts.revoke ? `revoked (was ${original.minutes} minutes)` : `${original.minutes} -> ${newMinutes} minutes`,
        `reason: "${reason}"`,
        pushed.success ? null : 'THE ATTENDANCE SYSTEM REFUSED IT',
    ].filter(Boolean).join(' — ');

    if (!pushed.success) {
        return res.status(502).json({
            error: `The attendance system refused the change: ${pushed.message || 'no reason given'}. It has been logged as failed.`,
            approval: replacement,
        });
    }
    res.json({ approval: replacement, verifiedMins });
};

/** PATCH /api/attendance-integration/overtime-approvals/:id — change the approved hours. */
export const editOvertimeApproval = async (req: Request, res: Response) => {
    try {
        await reviseApproval(req, res, { revoke: false });
    } catch (error) {
        console.error('Error editing an overtime approval:', error);
        res.status(500).json({ error: 'Failed to change the approval.' });
    }
};

/**
 * DELETE /api/attendance-integration/overtime-approvals/:id — revoke it.
 *
 * Sets the approved hours to zero so nothing is paid. The record itself remains in the attendance
 * system at 00:00:00: it has no delete endpoint, so this is as close to removal as exists.
 */
export const revokeOvertimeApproval = async (req: Request, res: Response) => {
    try {
        await reviseApproval(req, res, { revoke: true });
    } catch (error) {
        console.error('Error revoking an overtime approval:', error);
        res.status(500).json({ error: 'Failed to revoke the approval.' });
    }
};
