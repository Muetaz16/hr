import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma';

export const getTimeRecordsByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const records = await prisma.timeRecord.findMany({
            where: { month }
        });
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch time records' });
    }
};

// GET /api/time/employee/:employeeId — one employee's attendance history for the Lifecycle detail
// view. Deliberately ungated beyond authentication, unlike /month/:month (a bulk cross-company
// dump) — same exposure level as the Leave Balances already shown ungated on that screen.
export const getTimeRecordsByEmployee = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const records = await prisma.timeRecord.findMany({
            where: { employeeId },
            orderBy: { month: 'desc' },
        });
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch time records' });
    }
};

export const createOrUpdateTimeRecord = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const { employeeId, month } = data;

        const existing = await prisma.timeRecord.findFirst({
            where: { employeeId, month }
        });

        if (existing) {
            const updated = await prisma.timeRecord.update({
                where: { id: existing.id },
                data
            });
            res.json(updated);
        } else {
            const created = await prisma.timeRecord.create({
                data
            });
            res.json(created);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save time record' });
    }
};
