import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { generateMonthlyEvaluationDocx } from '../utils/monthlyEvaluationForm';

export const getPayrollByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const results = await prisma.payrollResult.findMany({
            where: { month }
        });
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payroll' });
    }
};

export const savePayrollResult = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const { employeeId, month } = data;

        const existing = await prisma.payrollResult.findFirst({
            where: { employeeId, month }
        });

        // Evaluation Index (Employee.evaluationPoints) is no longer credited from payroll
        // compilation — that now happens once, when an employee's evaluation is finalized
        // (server/src/controllers/evaluationController.ts's finalizeEvaluations, via
        // server/src/utils/evaluationPoints.ts). Promotion eligibility (tenure- and
        // evaluation-index-based alike) is computed live by promotionController.getCandidates.

        if (existing) {
            const updated = await prisma.payrollResult.update({
                where: { id: existing.id },
                data
            });
            res.json(updated);
        } else {
            const created = await prisma.payrollResult.create({
                data
            });
            res.json(created);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save payroll result' });
    }
};

// Metric criteria shared by every manager-evaluation level.
const METRIC_KEYS = [
    'relColleagues', 'teamwork', 'workOrg', 'commSkills', 'regCompliance',
    'taskQuality', 'timeCommit', 'orgCompliance', 'probSolving', 'pressureHandling', 'contDev',
    'regAdherence', 'safetyAdherence', 'appearance', 'resPreservation', 'dataPrivacy',
] as const;
const ADMIN_KEYS = ['relColleagues', 'teamwork', 'workOrg', 'commSkills', 'regCompliance'];
const EXEC_KEYS = ['taskQuality', 'timeCommit', 'orgCompliance', 'probSolving', 'pressureHandling', 'contDev'];
const CARE_KEYS = ['regAdherence', 'safetyAdherence', 'appearance', 'resPreservation', 'dataPrivacy'];

const pickCriteria = (src: any): Record<string, number | null | undefined> => {
    const out: Record<string, number | null | undefined> = {};
    if (!src) return out;
    for (const k of METRIC_KEYS) out[k] = src[k];
    return out;
};

// Average the two evaluators' scores for one criterion, following the same "one present → use it,
// none present → null" rule the payroll compile uses.
const combine = (a: any, b: any): number | null => {
    const an = a ?? null, bn = b ?? null;
    if (an !== null && bn !== null) return (an + bn) / 2;
    if (an !== null) return an;
    if (bn !== null) return bn;
    return null;
};

const monthLabel = (month: string): string => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

// Generates the official IPH Monthly (Efficiency) Evaluation Word form for one employee + month.
// Everything is computed LIVE from the source records — the HR presence evaluation, the two manager
// evaluations, and the Personnel (exceptional / training) record — so the form always reflects what
// was actually submitted, independent of whether the payroll report has been (re)compiled.
export const getMonthlyEvaluationDoc = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.params;

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { department: { select: { name: true } } },
        });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const [hr, personnel, unit, dept, division, director] = await Promise.all([
            prisma.hREvaluation.findFirst({ where: { employeeId, month } }),
            prisma.personnelEvaluation.findFirst({ where: { employeeId, month } }),
            prisma.unitEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
            prisma.departmentEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
            prisma.divisionEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
            prisma.directorEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
        ]);

        // The two managers who actually evaluated, ordered shallow→deep (direct manager, then skip-level).
        const presentMetricEvals = [unit, dept, division, director].filter(Boolean) as any[];
        const directEvalRec = presentMetricEvals[0] || null;
        const nextEvalRec = presentMetricEvals[1] || null;

        // Per-criterion FINAL = average of the two evaluators (computed live from the source records).
        const finalCriteria: Record<string, number | null> = {};
        for (const k of METRIC_KEYS) finalCriteria[k] = combine(directEvalRec?.[k], nextEvalRec?.[k]);
        const categorySum = (keys: string[]): number | null => {
            const vals = keys.map(k => finalCriteria[k]).filter(v => v !== null) as number[];
            return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
        };
        const adminScore = categorySum(ADMIN_KEYS);
        const execScore = categorySum(EXEC_KEYS);
        const careScore = categorySum(CARE_KEYS);

        // Presence per-item points, computed from the HR evaluation's real counts.
        const h: any = hr || {};
        const presence = hr ? {
            absence: Math.max(0, 7 - (h.absenceUnauthorized || 0)),
            delay: Math.max(0, 7 - ((h.delayMinutes || 0) / 180 * 7)),
            emergency: Math.max(0, 2 - ((h.emergencyLeaves || 0) / 3 * 2)),
            unpaid: Math.max(0, 2 - ((h.unpaidLeaves || 0) / 14 * 2)),
            annual: Math.max(0, 2 - ((h.annualPaidLeaves || 0) / 14 * 2)),
        } : { absence: null, delay: null, emergency: null, unpaid: null, annual: null };
        const presenceTotal = hr
            ? (presence.absence! + presence.delay! + presence.emergency! + presence.unpaid! + presence.annual!)
            : null;

        // Exceptional performance (±20%) and Training (+10%) contributions — same formula as the compile.
        let exceptionalScore = 0;
        let trainingScore = 0;
        if (personnel) {
            exceptionalScore += 5 * Math.min(1, (personnel.appreciationMessages || 0) / 3);
            exceptionalScore += 5 * Math.min(1, (personnel.exceptionalAssignments || 0) / 30);
            exceptionalScore -= 5 * Math.min(1, (personnel.warningMessages || 0) / 3);
            exceptionalScore -= 5 * Math.min(1, (personnel.disciplinaryDeduction || 0) / 14);
            if (personnel.specializedTraining) trainingScore += 3;
            if (personnel.supportingTraining) trainingScore += 3;
            if (personnel.languageTraining) trainingScore += 2;
            if (personnel.softwareTraining) trainingScore += 2;
        }

        const hasAnyData = hr || personnel || directEvalRec || nextEvalRec;
        const finalScore = hasAnyData
            ? (presenceTotal || 0) + (adminScore || 0) + (execScore || 0) + (careScore || 0) + exceptionalScore + trainingScore
            : null;

        const buffer = generateMonthlyEvaluationDocx({
            employeeId: employee.staffId || '',
            employeeName: employee.fullName || '',
            department: employee.department?.name || '',
            position: employee.position || '',
            directSupervisor: directEvalRec?.submittedBy?.fullName || '',
            nextAuthority: nextEvalRec?.submittedBy?.fullName || '',
            monthLabel: monthLabel(month),
            final: finalCriteria,
            presence,
            directEval: directEvalRec ? pickCriteria(directEvalRec) : null,
            nextEval: nextEvalRec ? pickCriteria(nextEvalRec) : null,
            exceptional: personnel ? {
                warnings: personnel.warningMessages,
                discipline: personnel.disciplinaryDeduction,
                appreciation: personnel.appreciationMessages,
                assignments: personnel.exceptionalAssignments,
            } : null,
            training: personnel ? {
                specialized: personnel.specializedTraining,
                supporting: personnel.supportingTraining,
                language: personnel.languageTraining,
                software: personnel.softwareTraining,
            } : null,
            totalPercent: finalScore,
            totalWithoutPresence: finalScore !== null ? finalScore - (presenceTotal || 0) : null,
            employeeResult: finalScore,
        });

        const safeName = (employee.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Monthly_Evaluation_${safeName}_${month}.docx"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error generating monthly evaluation form:', error);
        res.status(500).json({ error: 'Failed to generate monthly evaluation form' });
    }
};

export const deletePayrollResult = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.payrollResult.delete({ where: { id } });
        res.json({ message: 'Payroll record deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete payroll record' });
    }
};
