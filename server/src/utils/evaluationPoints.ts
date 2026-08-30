import { PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma';

// Extracted from the points/threshold/notification logic that used to live in
// payrollController.ts's savePayrollResult (triggered by payroll compilation).
// Now the sole trigger is evaluation finalization (server/src/controllers/evaluationController.ts's
// finalizeEvaluations) — payroll no longer touches evaluationPoints at all. Promotion eligibility
// itself (including the Evaluation Index threshold) is now computed live by
// promotionController.getCandidates (see server/src/utils/jobGrades.ts) rather than tracked via a
// one-shot notification flag here.
export async function awardEvaluationPoints(employeeId: string, finalScore: number): Promise<void> {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return;

    const newPoints = (emp.evaluationPoints || 0) + (finalScore / 100);
    await prisma.employee.update({
        where: { id: employeeId },
        data: { evaluationPoints: newPoints },
    });
}
