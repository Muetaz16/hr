import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Departments ---

export const getDepartments = async (req: Request, res: Response) => {
    try {
        const departments = await prisma.department.findMany({
            include: {
                _count: {
                    select: { employees: true }
                }
            }
        });
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

export const createDepartment = async (req: Request, res: Response) => {
    try {
        const { id, name, groupId } = req.body;

        const data: any = { name, groupId };
        if (id) data.id = id;

        const department = await prisma.department.create({
            data
        });
        res.status(201).json(department);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create department' });
    }
};

// ... (deleteDepartment) -> Restoring implementation
export const deleteDepartment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.department.delete({ where: { id } });
        res.json({ message: 'Department deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete department' });
    }
};

// --- Groups ---

export const getGroups = async (req: Request, res: Response) => {
    try {
        const groups = await prisma.group.findMany();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
};

export const createGroup = async (req: Request, res: Response) => {
    try {
        const { id, name } = req.body;

        const data: any = { name };
        if (id) data.id = id;

        const group = await prisma.group.create({
            data
        });
        res.status(201).json(group);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create group' });
    }
};

export const deleteGroup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.group.delete({ where: { id } });
        res.json({ message: 'Group deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete group' });
    }
};


