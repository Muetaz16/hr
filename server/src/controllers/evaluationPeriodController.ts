import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all periods
export const getEvaluationPeriods = async (req: Request, res: Response) => {
    try {
        const { month } = req.query;
        const where = month ? { month: String(month) } : {};
        const periods = await prisma.evaluationPeriod.findMany({
            where,
            orderBy: { month: 'desc' }
        });
        res.json(periods);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch evaluation periods' });
    }
};

// Enable a period
export const enableEvaluationPeriod = async (req: Request, res: Response) => {
    try {
        const { month, departmentId, notes } = req.body;
        const enabledById = (req as any).user?.id;

        if (!month || !enabledById) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Logic: 
        // If departmentId is provided, enable for that specific dept.
        // If NOT provided, it might mean "All Departments". 
        // The original Firebase logic used composite IDs like "2026-01_all_all".
        // In SQL, we can either use a generic record or explicit records.
        // The schema supports nullable departmentId.

        // Check if exists
        const existing = await prisma.evaluationPeriod.findFirst({
            where: {
                month,
                departmentId: departmentId || null
            }
        });

        if (existing) {
            const updated = await prisma.evaluationPeriod.update({
                where: { id: existing.id },
                data: {
                    enabled: true,
                    enabledById,
                    enabledAt: new Date(),
                    notes
                }
            });
            return res.json(updated);
        }

        const created = await prisma.evaluationPeriod.create({
            data: {
                month,
                departmentId: departmentId || null,
                enabled: true,
                enabledById,
                notes
            }
        });
        res.json(created);

    } catch (error) {
        console.error("Error enabling period:", error);
        res.status(500).json({ error: 'Failed to enable period' });
    }
};

// Disable a period
export const disableEvaluationPeriod = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.evaluationPeriod.delete({ where: { id } });
        res.json({ message: 'Period disabled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disable period' });
    }
};
