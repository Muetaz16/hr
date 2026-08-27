import { PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma';

// Extracted from the points/threshold/notification logic that used to live in
// payrollController.ts's savePayrollResult (triggered by payroll compilation).
// Now the sole trigger is evaluation finalization (server/src/controllers/evaluationController.ts's
// finalizeEvaluations) — payroll no longer touches evaluationPoints at all. The Intern
// "3 months since contract start" promotion path is unrelated to evaluation points and
// still lives in payrollController.ts, sharing the same promotionNotified one-shot flag.
export async function awardEvaluationPoints(employeeId: string, finalScore: number): Promise<void> {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return;

    const newPoints = (emp.evaluationPoints || 0) + (finalScore / 100);
    await prisma.employee.update({
        where: { id: employeeId },
        data: { evaluationPoints: newPoints },
    });

    const promotionThreshold = emp.jobGrade === 'Intern' ? 3 : 18;
    const reachedPoints = newPoints >= promotionThreshold && (emp.evaluationPoints || 0) < promotionThreshold;

    if (reachedPoints && !(emp as any).promotionNotified) {
        await prisma.employee.update({
            where: { id: employeeId },
            data: { promotionNotified: true },
        });

        const admins = await prisma.user.findMany({
            where: { role: { in: ['SUPER_ADMIN', 'HR_MANAGER'] } },
        });
        for (const admin of admins) {
            await prisma.notification.create({
                data: {
                    userId: admin.id,
                    title: 'Promotion Eligibility',
                    content: `Employee ${emp.fullName} (${emp.jobGrade || 'Employee'}) is eligible for promotion based on: Evaluation Index.`,
                    link: '/employees',
                },
            });
        }
    }
}
