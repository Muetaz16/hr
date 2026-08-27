import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';

import { prisma } from '../lib/prisma';

export const createDirectorate = async (req: AuthRequest, res: Response) => {
    try {
        const { name, positionFactor } = req.body;
        const directorate = await prisma.directorate.create({
            data: { name, positionFactor: positionFactor ? parseFloat(positionFactor) : 1.0 }
        });
        res.status(201).json(directorate);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create directorate' });
    }
};

export const getAllDirectorates = async (req: AuthRequest, res: Response) => {
    try {
        const directorates = await prisma.directorate.findMany({
            include: { divisions: true }
        });
        res.json(directorates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch directorates' });
    }
};

export const updateDirectorate = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, positionFactor } = req.body;
        const directorate = await prisma.directorate.update({
            where: { id },
            data: { name, positionFactor: positionFactor ? parseFloat(positionFactor) : 1.0 }
        });
        res.json(directorate);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update directorate' });
    }
};

export const deleteDirectorate = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.directorate.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete directorate' });
    }
};
