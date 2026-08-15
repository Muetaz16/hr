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

        // Any manual enable/disable takes this month's period out of the
        // day-15/day-20 auto schedule, so the daily reconciliation job stops
        // touching it (see server/src/jobs/evaluationPeriodCron.ts).
        if (existing) {
            const updated = await prisma.evaluationPeriod.update({
                where: { id: existing.id },
                data: {
                    enabled: true,
                    enabledById,
                    enabledAt: new Date(),
                    notes,
                    isAutoManaged: false,
                    disabledById: null,
                    disabledAt: null
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
                notes,
                isAutoManaged: false
            }
        });
        res.json(created);

    } catch (error) {
        console.error("Error enabling period:", error);
        res.status(500).json({ error: 'Failed to enable period' });
    }
};

// Disable a period. This used to delete the row outright, which silently
// destroyed history the Monitor UI relies on — now it's a status update, same
// as enable, so a disabled period stays visible (and out of the auto schedule).
export const disableEvaluationPeriod = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const disabledById = (req as any).user?.id;
        const updated = await prisma.evaluationPeriod.update({
            where: { id },
            data: { enabled: false, isAutoManaged: false, disabledById, disabledAt: new Date() }
        });
        res.json(updated);
    } catch (error) {
        console.error("Error disabling period:", error);
        res.status(500).json({ error: 'Failed to disable period' });
    }
};
