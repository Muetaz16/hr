import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getUnits = async (req: express.Request, res: express.Response) => {
    //
    try {
        const units = await prisma.unit.findMany({
            include: { department: true }
        });
        res.json(units);
    } catch (error) {
        console.error('Error fetching units:', error);
        res.status(500).json({ error: 'Failed to fetch units' });
    }
};

export const createUnit = async (req: express.Request, res: express.Response) => {
    try {
        const { name, departmentId } = req.body;
        const unit = await prisma.unit.create({
            data: { name, departmentId },
            include: { department: true }
        });
        res.status(201).json(unit);
    } catch (error) {
        console.error('Error creating unit:', error);
        res.status(500).json({ error: 'Failed to create unit' });
    }
};

export const updateUnit = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const { name, departmentId } = req.body;
        const unit = await prisma.unit.update({
            where: { id },
            data: { name, departmentId },
            include: { department: true }
        });
        res.json(unit);
    } catch (error) {
        console.error('Error updating unit:', error);
        res.status(500).json({ error: 'Failed to update unit' });
    }
};

export const deleteUnit = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        await prisma.unit.delete({ where: { id } });
        res.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        console.error('Error deleting unit:', error);
        res.status(500).json({ error: 'Failed to delete unit' });
    }
};
