// The payroll side of rewards: which bonuses are owed, why, in which month they are paid, and
// whether they have been paid yet.
//
// The reward cases themselves are raised and signed off in Personnel Relations. This is the money
// view of the same rows — a payroll specialist needs to know what is going to land on a payslip and
// be able to move it to a different month, and nothing else.
//
// The estimated amount is exactly what the engine will compute: bonusPercent % of BASIC salary,
// where basic = hourlyRate x (hours worked + approved overtime). Since the hours are not known
// until the period is computed, the figure shown here uses the contractual monthly basic and is
// labelled an estimate. It is never stored.
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { round2 } from '../utils/payrollEngine';
import { isValidPeriod, currentPeriod } from '../utils/payrollPeriod';
import { currencyOf } from './payrollRunController';

interface AuthRequest extends Request {
    user?: { id: string; role: string; fullName?: string };
}

const AWARD_TITLES: Record<string, string> = {
    EMPLOYEE_OF_MONTH: 'Employee of the Month',
    ATTENDANCE_EXCELLENCE: 'Attendance and Timeliness Excellence',
    EMPLOYEE_OF_YEAR: 'Employee of the Year',
    LOYALTY_MILESTONE: 'Loyalty & Service Milestone',
    EXCEPTIONAL_PERFORMANCE: 'Exceptional Performance / Contribution',
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-rewards?period=YYYY-MM&state=DUE|PAID|UNSCHEDULED
//
// Only cases that carry money are listed. A reward of extra leave days or a plaque is not payroll's
// business and would only be noise on this screen.
// ---------------------------------------------------------------------------------------------
export const listPayrollRewards = async (req: Request, res: Response) => {
    try {
        const { period, state } = req.query as Record<string, string | undefined>;

        const where: any = { bonusPercent: { gt: 0 } };
        if (state === 'PAID') where.paidInRunId = { not: null };
        if (state === 'DUE') { where.paidInRunId = null; where.payoutPeriod = { not: null }; }
        if (state === 'UNSCHEDULED') where.payoutPeriod = null;
        if (period) where.payoutPeriod = period;

        const cases = await prisma.rewardCase.findMany({
            where,
            select: {
                id: true, caseNumber: true, type: true, period: true, milestoneYears: true,
                bonusPercent: true, notes: true, natureOfContribution: true,
                completedAt: true, documentName: true,
                payoutPeriod: true, paidInRunId: true, paidAt: true,
                createdAt: true,
                employee: {
                    select: {
                        id: true, staffId: true, fullName: true, fullNameArabic: true,
                        jobCategory: true, jobGrade: true, salaryStructureType: true,
                        contractType: true,
                        department: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ payoutPeriod: 'desc' }, { createdAt: 'desc' }],
        });

        // One lookup of the whole rate card, then an in-memory join — 280 rows, and the alternative
        // is a query per case.
        const structures = await prisma.salaryStructure.findMany();
        const rateKey = (c: string, g: string, l: string) => `${c}|${g}|${l}`;
        const rates = new Map(structures.map(s => [rateKey(s.jobCategory, s.jobGrade, s.structureLevel), s]));

        const runIds = [...new Set(cases.map(c => c.paidInRunId).filter((x): x is string => !!x))];
        const runs = runIds.length
            ? await prisma.payrollRun.findMany({ where: { id: { in: runIds } }, select: { id: true, runNumber: true, period: true, status: true } })
            : [];
        const runMap = new Map(runs.map(r => [r.id, r]));

        // What the bonus will actually be worth once the period is computed. Read from the stored
        // line when the run exists, so a paid bonus shows the real figure rather than the estimate.
        const paidLines = cases.length
            ? await prisma.payrollLineItem.findMany({
                where: { rewardCaseId: { in: cases.map(c => c.id) } },
                select: { rewardCaseId: true, amount: true, currency: true },
            })
            : [];
        const paidMap = new Map(paidLines.map(i => [i.rewardCaseId as string, i]));

        res.json(cases.map(c => {
            const emp = c.employee;
            const structure = emp.jobCategory && emp.jobGrade && emp.salaryStructureType
                ? rates.get(rateKey(emp.jobCategory, emp.jobGrade, emp.salaryStructureType))
                : undefined;
            let currency: string | null = null;
            try { currency = currencyOf(emp.salaryStructureType); } catch { currency = null; }

            const actual = paidMap.get(c.id);

            return {
                id: c.id,
                caseNumber: c.caseNumber,
                type: c.type,
                typeLabel: AWARD_TITLES[c.type] || c.type,
                awardedFor: c.period || (c.milestoneYears ? `${c.milestoneYears} years` : null),
                // Why this employee is owed money, in their own reviewer's words. The nomination
                // justification is the more specific of the two, so it wins when present.
                justification: c.natureOfContribution || c.notes || null,
                bonusPercent: c.bonusPercent,
                completedAt: c.completedAt,
                documentName: c.documentName,
                payoutPeriod: c.payoutPeriod,
                paidInRun: c.paidInRunId ? runMap.get(c.paidInRunId) ?? null : null,
                paidAt: c.paidAt,
                currency: actual?.currency ?? currency,
                // Estimated from the contractual monthly basic; the real figure replaces it once
                // the period is computed and the item exists.
                estimatedAmount: structure ? round2(structure.monthlyRate * (c.bonusPercent || 0) / 100) : null,
                actualAmount: actual?.amount ?? null,
                monthlyBasic: structure ? round2(structure.monthlyRate) : null,
                employee: {
                    id: emp.id, staffId: emp.staffId, fullName: emp.fullName, fullNameArabic: emp.fullNameArabic,
                    departmentName: emp.department?.name ?? null,
                    residencyType: emp.contractType,
                },
                // A completed case with no payout period will never be picked up by any run — the
                // engine's single predicate requires it. That is the state this screen exists to catch.
                needsAttention: !c.completedAt ? 'NOT_COMPLETED' : !c.payoutPeriod ? 'NO_PAYOUT_PERIOD' : null,
            };
        }));
    } catch (error) {
        console.error('Error listing payroll rewards:', error);
        res.status(500).json({ error: 'Failed to load the reward bonuses' });
    }
};

// ---------------------------------------------------------------------------------------------
// PATCH /api/payroll-rewards/:id — body { payoutPeriod: 'YYYY-MM' | null }
//
// Moving a bonus to a different month is the one edit payroll needs: an award signed off on the
// 26th misses that period's cut-off and has to be carried to the next one. Once it has actually
// been paid it is frozen — the money is on a signed payslip.
// ---------------------------------------------------------------------------------------------
export const setRewardPayoutPeriod = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const raw = (req.body || {}).payoutPeriod;
        const payoutPeriod = raw === null || raw === '' ? null : String(raw);
        if (payoutPeriod !== null && !isValidPeriod(payoutPeriod)) {
            return res.status(400).json({ error: 'Invalid payout period. Expected YYYY-MM.' });
        }

        const found = await prisma.rewardCase.findUnique({
            where: { id },
            select: { id: true, caseNumber: true, paidInRunId: true, completedAt: true, bonusPercent: true },
        });
        if (!found) return res.status(404).json({ error: 'Reward case not found.' });
        if (!found.bonusPercent) return res.status(400).json({ error: 'This award carries no bonus, so it has no payout month.' });
        if (found.paidInRunId) {
            return res.status(409).json({ error: 'This bonus has already been paid and its month can no longer be changed.' });
        }

        // A bonus is only picked up by a run once the reward case itself is complete (its signed
        // document attached). Scheduling one that is not complete would promise money nobody
        // has approved, so it is refused rather than allowed and quietly ignored by the engine.
        if (payoutPeriod && !found.completedAt) {
            return res.status(400).json({
                error: 'This reward case is not complete yet — attach its signed document first, or the bonus will never be picked up by a payroll run.',
            });
        }

        const updated = await prisma.rewardCase.update({
            where: { id },
            data: { payoutPeriod },
            select: { id: true, caseNumber: true, payoutPeriod: true },
        });

        res.locals.auditDetails = `${found.caseNumber} — bonus payout month set to ${payoutPeriod || 'none'}`;
        res.json(updated);
    } catch (error) {
        console.error('Error setting reward payout period:', error);
        res.status(500).json({ error: 'Failed to change the payout month' });
    }
};

/** GET /api/payroll-rewards/periods — the months that have bonuses, for the filter. */
export const listRewardPeriods = async (_req: Request, res: Response) => {
    try {
        const rows = await prisma.rewardCase.groupBy({
            by: ['payoutPeriod'],
            where: { bonusPercent: { gt: 0 }, payoutPeriod: { not: null } },
            _count: { _all: true },
            orderBy: { payoutPeriod: 'desc' },
        });
        res.json({
            current: currentPeriod(),
            periods: rows.map(r => ({ period: r.payoutPeriod as string, count: r._count._all })),
        });
    } catch (error) {
        console.error('Error listing reward periods:', error);
        res.status(500).json({ error: 'Failed to load the reward periods' });
    }
};
