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

export const deletePayrollResult = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.payrollResult.delete({ where: { id } });
        res.json({ message: 'Payroll record deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete payroll record' });
    }
};
