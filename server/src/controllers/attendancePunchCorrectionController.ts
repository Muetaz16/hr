// Correcting a mis-typed punch, and writing down that we did.
//
// The correction is pushed into the attendance service and NOWHERE ELSE. Payroll, the presence
// score and the disciplinary rules keep reading that service, which is now right — so they all
// self-heal without knowing this module exists. AttendancePunchCorrection is a log, never an
// override: the moment a local totalWorkMins started competing with the service's, the Attendance
// screen and the payslip could disagree and nobody could say which was correct.
//
// Two rules run through everything below, both learned the hard way:
//
//  1. THE VOCABULARY IS FIXED AT THE BOUNDARY. `newState` on the attendance service is an
//     unvalidated string that silently accepts "2"/"3" (Break) and "4"/"5" (Overtime) with a 200
//     and a success message. attendanceApiProxy owns the Check In / Check Out whitelist; no code
//     here forwards a caller-supplied code.
//
//  2. NEVER TRUST THE WRITE. Every one of those wrong writes reported success. After each push the
//     day is re-read from the service and what the READ shows is what gets stored.
import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import {
    updateBioTimePunch, deleteBioTimePunch, readBioTimeDay, createBioTimeMissingPunch,
    isCorrectablePunchState, type CorrectablePunchState,
} from '../utils/attendanceApiProxy';
import { financialMonthRange, periodForDate } from '../utils/payrollPeriod';
import { invalidatePunchAnomalyScans } from '../utils/punchAnomalyScan';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_STEPS = 6;

/** One repair the caller is asking for. Deliberately small — this is not a general punch editor. */
interface CorrectionStep {
    action: 'RETYPE' | 'ADD' | 'DELETE';
    punchId?: number;                 // RETYPE / DELETE
    atTime?: string;                  // ADD, and a MANUAL punch being moved: 'HH:mm'
    toState?: CorrectablePunchState;  // RETYPE / ADD
}

/** A punch as the attendance service reports it on a day row. */
interface ServicePunch { id: number; punchTime: string; punchState: string; isManual: boolean }

/**
 * A stable summary of the day's punches, so the modal can prove it is acting on what it displayed.
 *
 * NOT a `@@unique` on the table — a day legitimately holds several punches and several
 * corrections. This is optimistic concurrency: two officers opening the same day would otherwise
 * both retype "the last punch", and the second would be retyping a punch the first already moved.
 */
const fingerprintOf = (punches: ServicePunch[]): string =>
    punches
        .map(p => `${p.id}:${p.punchTime}:${p.punchState}:${p.isManual ? 'M' : 'D'}`)
        .sort()
        .join('|');

const readDay = async (bioEmpId: number, workDate: string) => {
    const result = await readBioTimeDay({ bioEmpId, date: workDate });
    if (!result.ok) return { ok: false as const, message: result.message };
    const punches: ServicePunch[] = (result.day?.punches || []).map((p: any) => ({
        id: Number(p?.id),
        punchTime: String(p?.punchTime || '').slice(0, 5),
        punchState: String(p?.punchState || ''),
        isManual: !!p?.isManual,
    }));
    return {
        ok: true as const,
        punches,
        totalWorkMins: result.day?.totalWorkMins ?? 0,
        lateMins: result.day?.lateMins ?? 0,
    };
};

/**
 * POST /api/attendance-integration/punch-corrections
 *
 * Body: { empCode, workDate, reason, steps[], fingerprint?, anomalyKind? }
 *
 * `empCode` stays in the body on purpose — the audit middleware's existing
 * `attendance-integration` branch (middleware/audit.ts) resolves the subject employee from exactly
 * that field, with no change needed. Do not "tidy" it out of the payload; the audit entry would
 * lose the person it is about.
 */
export const createPunchCorrection = async (req: Request, res: Response) => {
    try {
        const user = (req as AuthRequest).user;
        const empCode = typeof req.body?.empCode === 'string' ? req.body.empCode.trim() : '';
        const workDate = typeof req.body?.workDate === 'string' ? req.body.workDate.trim() : '';
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        const anomalyKind = typeof req.body?.anomalyKind === 'string' ? req.body.anomalyKind : null;
        const clientFingerprint = typeof req.body?.fingerprint === 'string' ? req.body.fingerprint : '';
        const steps: CorrectionStep[] = Array.isArray(req.body?.steps) ? req.body.steps : [];

        if (!empCode) return res.status(400).json({ error: 'empCode is required.' });
        if (!DATE_RE.test(workDate)) return res.status(400).json({ error: 'workDate must be YYYY-MM-DD.' });
        // Required, and required to be more than a keystroke: this is the only part of a correction
        // a reviewer can actually assess later.
        if (reason.length < 5) return res.status(400).json({ error: 'A reason is required (at least 5 characters).' });
        if (!steps.length) return res.status(400).json({ error: 'At least one change is required.' });
        if (steps.length > MAX_STEPS) return res.status(400).json({ error: `At most ${MAX_STEPS} changes at a time.` });
        // A punch cannot be corrected before it has been made. Dates are compared as local calendar
        // strings, never through `new Date()`, so nothing shifts across the UTC boundary.
        const todayKey = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        if (workDate > todayKey) return res.status(400).json({ error: 'That date has not happened yet.' });

        const employee = await prisma.employee.findFirst({
            where: { staffId: empCode },
            select: { id: true, bioId: true, fullName: true, enrollmentStatus: true },
        });
        if (!employee) return res.status(404).json({ error: 'No employee is linked to that staff code.' });
        if (!employee.bioId) return res.status(400).json({ error: 'That employee has no attendance-system id.' });

        const before = await readDay(employee.bioId, workDate);
        if (!before.ok) return res.status(502).json({ error: before.message || 'Could not read that day from the attendance system.' });

        // Optimistic concurrency. Skipped only when the caller sends no fingerprint at all, which
        // is for a scripted/ad-hoc fix; the modal always sends one.
        if (clientFingerprint && clientFingerprint !== fingerprintOf(before.punches)) {
            return res.status(409).json({
                error: 'This day changed since it was opened. Reload it and check what is there now before correcting.',
            });
        }

        const byId = new Map(before.punches.map(p => [p.id, p]));

        // Validate EVERY step before pushing any of them. A half-applied correction on a day that
        // pays money is worse than a rejected one, and the validation is free.
        for (const step of steps) {
            if (step.action === 'RETYPE' || step.action === 'ADD') {
                if (!isCorrectablePunchState(step.toState)) {
                    return res.status(400).json({ error: 'A punch may only be set to Check In or Check Out.' });
                }
            }
            if (step.action === 'RETYPE' || step.action === 'DELETE') {
                const punch = byId.get(Number(step.punchId));
                if (!punch) return res.status(400).json({ error: `Punch ${step.punchId} is not on that day.` });
                // The service refuses to delete a device punch with a 404 — a refusal that reads
                // like "not found" and is easy to log as a success by accident. Refuse it here,
                // where the reason can be stated plainly.
                if (step.action === 'DELETE' && !punch.isManual) {
                    return res.status(400).json({ error: 'A punch that came off the terminal cannot be deleted — retype it instead.' });
                }
                // A device punch's TIME is protected by the service. Sending one anyway would get
                // a success reply describing a change that did not happen.
                if (step.action === 'RETYPE' && step.atTime && !punch.isManual) {
                    return res.status(400).json({ error: 'The time of a terminal punch cannot be changed — only its type.' });
                }
            }
            if (step.action === 'ADD' && !TIME_RE.test(String(step.atTime || ''))) {
                return res.status(400).json({ error: 'A new punch needs a time as HH:mm.' });
            }
            if (step.action === 'RETYPE' && step.atTime && !TIME_RE.test(step.atTime)) {
                return res.status(400).json({ error: 'A punch time must be HH:mm.' });
            }
            if (!['RETYPE', 'ADD', 'DELETE'].includes(step.action)) {
                return res.status(400).json({ error: `Unknown action "${step.action}".` });
            }
        }

        // 'YYYY-MM-DD' parsed as a LOCAL date. `new Date('2026-08-25')` is UTC midnight, which lands
        // on the 24th east of UTC and would file the correction under the previous payroll period.
        const period = periodForDate(new Date(`${workDate}T00:00:00`));

        // The blast radius AS IT IS NOW, captured before anything moves. Read later it would answer
        // a different question and lose the fact that the run was already approved at the time.
        const run = await prisma.payrollRun.findFirst({
            where: { period, status: { not: 'CANCELLED' } },
            select: { id: true, status: true, lockedAt: true },
        });
        const payrollWasLocked = !!run && ['IN_REVIEW', 'APPROVED', 'PAID'].includes(run.status);
        const evaluationWasFinalized = !!(await prisma.evaluationFinalization.findFirst({
            where: { employeeId: employee.id, month: period },
            select: { id: true },
        }));

        const created: any[] = [];
        const failures: string[] = [];
        let runningWorkMins = before.totalWorkMins;

        for (const step of steps) {
            const punch = step.punchId != null ? byId.get(Number(step.punchId)) : undefined;
            let result: { success: boolean; message?: string };
            let afterTime: string | null = null;
            let afterState: string | null = null;

            if (step.action === 'DELETE') {
                result = await deleteBioTimePunch({ punchId: Number(step.punchId) });
            } else if (step.action === 'RETYPE') {
                // A manual punch must be sent WITH a time or the service 500s; a device punch must
                // be sent WITHOUT one. The proxy enforces both — this just supplies where the
                // punch already sits, so "retype only" really does leave the time alone.
                result = await updateBioTimePunch({
                    punchId: Number(step.punchId),
                    toState: step.toState as CorrectablePunchState,
                    isManual: !!punch?.isManual,
                    currentTime: punch ? `${workDate}T${punch.punchTime}:00` : undefined,
                    newTime: step.atTime ? `${workDate}T${step.atTime}:00` : undefined,
                });
                afterTime = step.atTime || punch?.punchTime || null;
                afterState = step.toState as string;
            } else {
                // ADD goes through the missing-punch endpoint, the same write-back the approved
                // missing-punch request already uses. A bare local wall-clock string, never a Date:
                // routing it through toISOString() once recorded a 14:30 entry as 12:30.
                result = await createBioTimeMissingPunch({
                    empCode,
                    empId: employee.bioId as number,
                    punchTime: `${workDate}T${step.atTime}:00`,
                    punchState: step.toState === 'Check In' ? '0' : '1',
                });
                afterTime = step.atTime || null;
                afterState = step.toState as string;
            }

            // Rule 2: what the service SAID is recorded, but what re-reading the day SHOWS is the
            // evidence. These have already been observed to disagree.
            const observed = await readDay(employee.bioId as number, workDate);
            const observedPunch = observed.ok && step.punchId != null
                ? observed.punches.find(p => p.id === Number(step.punchId))
                : undefined;
            const verifiedState = step.action === 'DELETE'
                ? (observed.ok && !observedPunch ? 'DELETED' : 'STILL PRESENT')
                : (observedPunch?.punchState
                    ?? (step.action === 'ADD' && observed.ok
                        ? observed.punches.find(p => p.punchTime === step.atTime)?.punchState ?? null
                        : null));

            const workMinsBefore = runningWorkMins;
            const workMinsAfter = observed.ok ? observed.totalWorkMins : runningWorkMins;
            runningWorkMins = workMinsAfter;

            // A push that succeeded but did not produce the intended state is a FAILURE, whatever
            // the reply said. That distinction is the entire reason for the read-back.
            const landed = result.success
                && (step.action === 'DELETE' ? verifiedState === 'DELETED' : verifiedState === afterState);
            if (!landed) {
                failures.push(
                    `${step.action} ${step.punchId ?? step.atTime}: `
                    + (result.success ? `service reported success but the day now reads "${verifiedState}"` : result.message),
                );
            }

            created.push(await prisma.attendancePunchCorrection.create({
                data: {
                    empCode,
                    employeeId: employee.id,
                    bioEmpId: employee.bioId,
                    workDate,
                    period,
                    action: step.action,
                    anomalyKind,
                    sourcePunchId: step.punchId != null ? Number(step.punchId) : null,
                    wasManual: !!punch?.isManual,
                    beforeTime: punch?.punchTime ?? null,
                    beforeState: punch?.punchState ?? null,
                    afterTime,
                    afterState,
                    reason,
                    status: landed ? 'APPLIED' : 'FAILED',
                    sourceMessage: result.message ?? null,
                    verifiedState,
                    workMinsBefore,
                    workMinsAfter,
                    payrollRunId: run?.id ?? null,
                    payrollWasLocked,
                    evaluationWasFinalized,
                    correctedById: user?.id ?? null,
                    correctedByName: user?.fullName ?? null,
                },
            }));
        }

        const after = await readDay(employee.bioId as number, workDate);
        // The queue is a cached sweep; without this the day an officer just fixed would sit in the
        // list for another five minutes, and they would fix it twice.
        invalidatePunchAnomalyScans();

        // -----------------------------------------------------------------------------------
        // Blast radius. Everything below FLAGS; nothing recomputes, voids or pays anything.
        // -----------------------------------------------------------------------------------
        const recoveredMins = Math.max(0, (after.ok ? after.totalWorkMins : before.totalWorkMins) - before.totalWorkMins);

        // A run that is already signed can never absorb this correction. Rather than leave the
        // officer to work out what that means, point at the remedy that already exists — a
        // PREVIOUS_UNDERPAYMENT line on the NEXT run — and price it from the rate this employee
        // was actually paid at, not a guess. Deliberately NOT auto-created: that controller
        // requires a typed note and an explicit link to the prior line, and it is right to.
        let suggestedRecovery: {
            minutes: number; amount: number; currency: string; lineId: string; runNumber: string;
        } | null = null;
        if (payrollWasLocked && run && recoveredMins > 0) {
            const line = await prisma.payrollLine.findFirst({
                where: { runId: run.id, employeeId: employee.id },
                select: { id: true, hourlyRate: true, currency: true, run: { select: { runNumber: true } } },
            });
            if (line && line.hourlyRate > 0) {
                suggestedRecovery = {
                    minutes: recoveredMins,
                    amount: Math.round((recoveredMins / 60) * line.hourlyRate * 100) / 100,
                    currency: line.currency,
                    lineId: line.id,
                    runNumber: line.run.runNumber,
                };
            }
        }

        // An already-EXECUTED disciplinary case is the one consequence that does not self-heal:
        // future reads of the attendance service are correct, but a case opened off the old
        // figures is a formal HR record with the employee's name on it. Surfaced, never voided —
        // withdrawing a disciplinary action is a human decision with its own procedure.
        const { start: cycleStart, end: cycleEnd } = financialMonthRange(period);
        const relatedCases = await prisma.disciplinaryCase.findMany({
            where: {
                employeeId: employee.id,
                source: 'SYSTEM_ATTENDANCE',
                createdAt: { gte: cycleStart, lte: cycleEnd },
            },
            select: { id: true, caseNumber: true, stage: true, violationId: true },
        });

        // Facts, not a finished sentence — the screen is Arabic and this server writes English.
        res.locals.auditDetails = [
            `${employee.fullName} (${empCode})`,
            workDate,
            steps.map(s => `${s.action}${s.punchId ? ` #${s.punchId}` : ''}${s.toState ? ` -> ${s.toState}` : ''}${s.atTime ? ` @${s.atTime}` : ''}`).join('; '),
            `worked ${before.totalWorkMins} -> ${after.ok ? after.totalWorkMins : '?'} mins`,
            `reason: "${reason}"`,
        ].join(' — ');

        res.status(201).json({
            corrections: created,
            workedBefore: before.totalWorkMins,
            workedAfter: after.ok ? after.totalWorkMins : null,
            lateBefore: before.lateMins,
            lateAfter: after.ok ? after.lateMins : null,
            punches: after.ok ? after.punches : [],
            payrollWasLocked,
            payrollRunStatus: run?.status ?? null,
            evaluationWasFinalized,
            recoveredMins,
            suggestedRecovery,
            relatedCases,
            failures,
        });
    } catch (error) {
        console.error('Error correcting punch:', error);
        res.status(500).json({ error: 'Failed to record the correction.' });
    }
};

/**
 * GET /api/attendance-integration/punch-corrections?empCode=&workDate=&period=&limit=
 *
 * Read-only. There is deliberately no PUT and no DELETE: a wrong correction is superseded by
 * another one, never edited away. See the model comment for why that is not merely a discipline.
 */
export const listPunchCorrections = async (req: Request, res: Response) => {
    try {
        const empCode = typeof req.query.empCode === 'string' ? req.query.empCode.trim() : '';
        const workDate = typeof req.query.workDate === 'string' ? req.query.workDate.trim() : '';
        const period = typeof req.query.period === 'string' ? req.query.period.trim() : '';
        const limit = Math.min(Number(req.query.limit) || 100, 500);

        const corrections = await prisma.attendancePunchCorrection.findMany({
            where: {
                ...(empCode ? { empCode } : {}),
                ...(workDate ? { workDate } : {}),
                ...(period ? { period } : {}),
            },
            orderBy: { appliedAt: 'desc' },
            take: limit,
        });
        res.json({ corrections });
    } catch (error) {
        console.error('Error listing punch corrections:', error);
        res.status(500).json({ error: 'Failed to load punch corrections.' });
    }
};
