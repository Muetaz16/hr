// Manual pay corrections — "Previous Miscalculation", the two rows on the payslip that fix a
// mistake made in an earlier month.
//
// Positive (an underpayment) is added to Total Earnings. Negative (an overpayment) is taken off in
// Total Deduction. They are the same object with opposite signs, so they are one endpoint.
//
// Two rules make this trustworthy rather than a free-text "adjust anything" box:
//
//   1. A correction MUST name the run and the line it is correcting. Without that link, next year
//      nobody can say what a 412.30 addition on a signed payslip was for. The prior line is
//      verified to belong to the same employee — you cannot correct someone else's month.
//
//   2. Corrections are stored on PayrollLineOverride.manualItems, deliberately OUTSIDE the compute
//      rebuild scope. Compute deletes and re-creates every line and item; the override survives and
//      is replayed. That is what lets a specialist add a correction and then still press Recompute.
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

import { prisma } from '../lib/prisma';
import { round2 } from '../utils/payrollEngine';
import { periodLabel } from '../utils/payrollPeriod';
import { parseManualItems } from '../utils/payrollCharges';
import { findRunLine } from './payrollRunController';

interface AuthRequest extends Request {
    user?: { id: string; role: string; fullName?: string };
}

/** Same three-state gate the rest of the run uses: a locked or approved run takes no edits. */
const assertMutable = (run: { status: string; lockedAt: Date | null; approvedAt: Date | null }): string | null => {
    if (run.approvedAt) return 'This payroll period is closed and frozen. Correct it in a new revision instead.';
    if (run.lockedAt) return 'This payroll period has been locked and can no longer be changed.';
    if (run.status !== 'DRAFT') return `This payroll period is ${run.status.toLowerCase()} and can no longer be changed.`;
    return null;
};

const loadContext = async (runId: string, lineId: string) => {
    const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
    if (!run) return { ok: false as const, error: { code: 404, message: 'Payroll run not found' } };
    // Accepts the employee id too, so a correction survives the recompute that follows it.
    const line = await findRunLine(runId, lineId);
    if (!line) return { ok: false as const, error: { code: 404, message: 'Payroll line not found' } };
    if (!line.employeeId) return { ok: false as const, error: { code: 400, message: 'This line is no longer linked to an employee and cannot be corrected.' } };
    return { ok: true as const, run, line, employeeId: line.employeeId };
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id/lines/:lineId/corrections
//
// Also returns the employee's own earlier payroll lines, which is what the "which month are you
// correcting?" picker is filled from. Offering a list rather than a free-text reference is what
// makes the mandatory link usable instead of annoying.
// ---------------------------------------------------------------------------------------------
export const listLineCorrections = async (req: Request, res: Response) => {
    try {
        const { id, lineId } = req.params;
        const ctx = await loadContext(id, lineId);
        if (!ctx.ok) return res.status(ctx.error.code).json({ error: ctx.error.message });

        const [override, priorLines] = await Promise.all([
            prisma.payrollLineOverride.findUnique({
                where: { runId_employeeId: { runId: id, employeeId: ctx.employeeId } },
                select: { manualItems: true },
            }),
            prisma.payrollLine.findMany({
                where: {
                    employeeId: ctx.employeeId,
                    runId: { not: id },
                    run: { status: { not: 'CANCELLED' } },
                },
                select: {
                    id: true, netSalary: true, totalEarnings: true, currency: true,
                    run: { select: { id: true, period: true, runNumber: true, status: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 24,
            }),
        ]);

        res.json({
            currency: ctx.line.currency,
            corrections: parseManualItems(override?.manualItems),
            priorLines: priorLines.map(l => ({
                lineId: l.id,
                runId: l.run.id,
                period: l.run.period,
                runNumber: l.run.runNumber,
                runStatus: l.run.status,
                netSalary: l.netSalary,
                totalEarnings: l.totalEarnings,
                currency: l.currency,
            })),
        });
    } catch (error) {
        console.error('Error listing payroll corrections:', error);
        res.status(500).json({ error: 'Failed to load the corrections' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-runs/:id/lines/:lineId/corrections
// Body { direction: 'UNDERPAYMENT' | 'OVERPAYMENT', amount, correctedLineId, note }
// ---------------------------------------------------------------------------------------------
export const addLineCorrection = async (req: AuthRequest, res: Response) => {
    try {
        const { id, lineId } = req.params;
        const ctx = await loadContext(id, lineId);
        if (!ctx.ok) return res.status(ctx.error.code).json({ error: ctx.error.message });

        const immutable = assertMutable(ctx.run);
        if (immutable) return res.status(409).json({ error: immutable });

        const direction = String(req.body?.direction || '').toUpperCase();
        if (!['UNDERPAYMENT', 'OVERPAYMENT'].includes(direction)) {
            return res.status(400).json({ error: 'Say whether this corrects an underpayment (money owed) or an overpayment (money to recover).' });
        }

        const amount = Number(req.body?.amount);
        if (!isFinite(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Enter the amount to correct, as a positive figure. The direction sets the sign.' });
        }

        const note = String(req.body?.note || '').trim();
        if (!note) {
            return res.status(400).json({ error: 'Explain what is being corrected. This is printed on the payslip trail.' });
        }

        // The mandatory link, and the check that it points at the SAME employee. Without this an
        // off-by-one in a dropdown would attach a correction to the wrong person's history.
        const correctedLineId = String(req.body?.correctedLineId || '');
        if (!correctedLineId) {
            return res.status(400).json({ error: 'Choose the earlier payroll month this corrects.' });
        }
        const prior = await prisma.payrollLine.findUnique({
            where: { id: correctedLineId },
            select: { id: true, runId: true, employeeId: true, currency: true, run: { select: { period: true } } },
        });
        if (!prior || prior.employeeId !== ctx.employeeId) {
            return res.status(400).json({ error: 'That earlier payroll month does not belong to this employee.' });
        }
        if (prior.runId === id) {
            return res.status(400).json({ error: 'A period cannot correct itself. Choose an earlier month.' });
        }
        // Correcting across currencies is meaningless without an exchange rate, and there is none.
        if (prior.currency !== ctx.line.currency) {
            return res.status(400).json({
                error: `That month was paid in ${prior.currency} and this one in ${ctx.line.currency}. A correction cannot cross currencies.`,
            });
        }

        const existing = await prisma.payrollLineOverride.findUnique({
            where: { runId_employeeId: { runId: id, employeeId: ctx.employeeId } },
            select: { manualItems: true, excluded: true, excludeReason: true, reviewNote: true },
        });
        const items = parseManualItems(existing?.manualItems);

        items.push({
            kind: direction === 'UNDERPAYMENT' ? 'EARNING' : 'DEDUCTION',
            category: direction === 'UNDERPAYMENT' ? 'PREVIOUS_UNDERPAYMENT' : 'PREVIOUS_OVERPAYMENT',
            label: direction === 'UNDERPAYMENT'
                ? `Previous Miscalculation — Underpayment (${prior.run.period})`
                : `Previous Miscalculation — Overpayment (${prior.run.period})`,
            labelArabic: direction === 'UNDERPAYMENT' ? 'تصحيح صرف ناقص سابق' : 'تصحيح صرف زائد سابق',
            amount: round2(amount),
            currency: ctx.line.currency,
            sourceType: 'MANUAL',
            sourceId: randomUUID(),
            correctedRunId: prior.runId,
            correctedLineId: prior.id,
            correctionNote: note,
        });

        await prisma.payrollLineOverride.upsert({
            where: { runId_employeeId: { runId: id, employeeId: ctx.employeeId } },
            update: { manualItems: items as any, createdByName: req.user?.fullName || null },
            create: {
                runId: id, employeeId: ctx.employeeId,
                manualItems: items as any,
                createdByName: req.user?.fullName || null,
            },
        });

        res.locals.auditDetails =
            `${direction.toLowerCase()} correction of ${ctx.line.currency} ${round2(amount)} for `
            + `${ctx.line.fullName || 'an employee'} in ${periodLabel(ctx.run.period)}, correcting ${prior.run.period}`;

        // The amounts only move once the period is recomputed, and saying so avoids the reasonable
        // assumption that the net on screen already includes this.
        res.status(201).json({ corrections: items, requiresRecompute: true });
    } catch (error) {
        console.error('Error adding payroll correction:', error);
        res.status(500).json({ error: 'Failed to add the correction' });
    }
};

// ---------------------------------------------------------------------------------------------
// DELETE /api/payroll-runs/:id/lines/:lineId/corrections/:correctionId
// ---------------------------------------------------------------------------------------------
export const removeLineCorrection = async (req: AuthRequest, res: Response) => {
    try {
        const { id, lineId, correctionId } = req.params;
        const ctx = await loadContext(id, lineId);
        if (!ctx.ok) return res.status(ctx.error.code).json({ error: ctx.error.message });

        const immutable = assertMutable(ctx.run);
        if (immutable) return res.status(409).json({ error: immutable });

        const existing = await prisma.payrollLineOverride.findUnique({
            where: { runId_employeeId: { runId: id, employeeId: ctx.employeeId } },
            select: { manualItems: true },
        });
        const items = parseManualItems(existing?.manualItems);
        const kept = items.filter(i => i.sourceId !== correctionId);
        if (kept.length === items.length) return res.status(404).json({ error: 'Correction not found' });

        await prisma.payrollLineOverride.update({
            where: { runId_employeeId: { runId: id, employeeId: ctx.employeeId } },
            data: { manualItems: kept as any, createdByName: req.user?.fullName || null },
        });

        res.locals.auditDetails = `removed a correction for ${ctx.line.fullName || 'an employee'} in ${periodLabel(ctx.run.period)}`;
        res.json({ corrections: kept, requiresRecompute: true });
    } catch (error) {
        console.error('Error removing payroll correction:', error);
        res.status(500).json({ error: 'Failed to remove the correction' });
    }
};
