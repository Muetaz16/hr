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

        let oldScore = 0;
        if (existing) {
            oldScore = existing.finalScore || 0;
            const updated = await prisma.payrollResult.update({
                where: { id: existing.id },
                data
            });
            // Update employee points
            const diff = (data.finalScore || 0) - oldScore;
            if (diff !== 0) {
                const emp = await prisma.employee.findUnique({ where: { id: employeeId }});
                if (emp) {
                    const newPoints = (emp.evaluationPoints || 0) + (diff / 100);
                    await prisma.employee.update({
                        where: { id: employeeId },
                        data: { evaluationPoints: newPoints }
                    });
                    
                    // Check for promotion notification
                    let isEligible = false;
                    let eligibilityReason = '';
                    
                    const promotionThreshold = emp.jobGrade === 'Intern' ? 3 : 18;
                    const reachedPoints = newPoints >= promotionThreshold && (emp.evaluationPoints || 0) < promotionThreshold;
                    
                    let reachedMonths = false;
                    if (emp.jobGrade === 'Intern' && emp.contractStartDate) {
                        const start = new Date(emp.contractStartDate);
                        const now = new Date();
                        const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
                        if (monthsDiff >= 3) reachedMonths = true;
                    }
                    
                    if (reachedPoints && !(emp as any).promotionNotified) {
                        isEligible = true;
                        eligibilityReason = 'Evaluation Index';
                    } else if (reachedMonths && !(emp as any).promotionNotified) {
                        isEligible = true;
                        eligibilityReason = '3 Months Elapsed';
                    }
                    
                    if (isEligible) {
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
                                    content: `Employee ${emp.fullName} (${emp.jobGrade || 'Employee'}) is eligible for promotion based on: ${eligibilityReason}.`,
                                    link: '/employees'
                                }
                            });
                        }
                    }
                }
            }
            res.json(updated);
        } else {
            const created = await prisma.payrollResult.create({
                data
            });
            // Add employee points for new record
            const addedScore = data.finalScore || 0;
            if (addedScore > 0) {
                const emp = await prisma.employee.findUnique({ where: { id: employeeId }});
                if (emp) {
                    const newPoints = (emp.evaluationPoints || 0) + (addedScore / 100);
                    await prisma.employee.update({
                        where: { id: employeeId },
                        data: { evaluationPoints: newPoints }
                    });
                    
                    // Check for promotion notification
                    let isEligible = false;
                    let eligibilityReason = '';
                    
                    const promotionThreshold = emp.jobGrade === 'Intern' ? 3 : 18;
                    const reachedPoints = newPoints >= promotionThreshold && (emp.evaluationPoints || 0) < promotionThreshold;
                    
                    let reachedMonths = false;
                    if (emp.jobGrade === 'Intern' && emp.contractStartDate) {
                        const start = new Date(emp.contractStartDate);
                        const now = new Date();
                        const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
                        if (monthsDiff >= 3) reachedMonths = true;
                    }
                    
                    if (reachedPoints && !(emp as any).promotionNotified) {
                        isEligible = true;
                        eligibilityReason = 'Evaluation Index';
                    } else if (reachedMonths && !(emp as any).promotionNotified) {
                        isEligible = true;
                        eligibilityReason = '3 Months Elapsed';
                    }
                    
                    if (isEligible) {
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
                                    content: `Employee ${emp.fullName} (${emp.jobGrade || 'Employee'}) is eligible for promotion based on: ${eligibilityReason}.`,
                                    link: '/employees'
                                }
                            });
                        }
                    }
                }
            }
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
