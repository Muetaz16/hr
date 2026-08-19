import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        // server/src/utils/evaluationPoints.ts). Only the Intern "3 months since contract
        // start" promotion path remains here, since it's unrelated to evaluation points.
        const checkInternTenurePromotion = async () => {
            const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!emp || emp.jobGrade !== 'Intern' || !emp.contractStartDate || (emp as any).promotionNotified) return;

            const start = new Date(emp.contractStartDate);
            const now = new Date();
            const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
            if (monthsDiff < 3) return;

            await prisma.employee.update({
                where: { id: employeeId },
                data: { promotionNotified: true }
            });

            const admins = await prisma.user.findMany({
                where: { role: { in: ['SUPER_ADMIN', 'HR_MANAGER'] } }
            });
            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        userId: admin.id,
                        title: 'Promotion Eligibility',
                        content: `Employee ${emp.fullName} (${emp.jobGrade || 'Employee'}) is eligible for promotion based on: 3 Months Elapsed.`,
                        link: '/employees'
                    }
                });
            }
        };

        if (existing) {
            const updated = await prisma.payrollResult.update({
                where: { id: existing.id },
                data
            });
            await checkInternTenurePromotion();
            res.json(updated);
        } else {
            const created = await prisma.payrollResult.create({
                data
            });
            await checkInternTenurePromotion();
            res.json(created);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save payroll result' });
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
