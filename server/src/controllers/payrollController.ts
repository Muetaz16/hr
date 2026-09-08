import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { generateMonthlyEvaluationDocx } from '../utils/monthlyEvaluationForm';
import { loadMonthlyEvaluationScores, pickCriteria } from '../utils/monthlyEvaluationScores';

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

        // One scorer, shared with the payslip — see utils/monthlyEvaluationScores.ts. Two copies of
        // this formula is how the form and the payslip start disagreeing about the same month.
        const scores = await loadMonthlyEvaluationScores(prisma, employeeId, month);
        const { presence, presenceTotal, finalCriteria, personnel, finalScore } = scores;

        const buffer = generateMonthlyEvaluationDocx({
            employeeId: employee.staffId || '',
            employeeName: employee.fullName || '',
            department: employee.department?.name || '',
            position: employee.position || '',
            directSupervisor: scores.directSupervisorName,
            nextAuthority: scores.nextAuthorityName,
            monthLabel: monthLabel(month),
            final: finalCriteria,
            presence,
            directEval: scores.directEval ? pickCriteria(scores.directEval) : null,
            nextEval: scores.nextEval ? pickCriteria(scores.nextEval) : null,
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
