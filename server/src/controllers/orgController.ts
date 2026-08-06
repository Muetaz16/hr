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
                },
                division: true
            }
        });
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

export const createDepartment = async (req: Request, res: Response) => {
    try {
        const { id, name, groupId, divisionId, isOffice, positionFactor } = req.body;

        const data: any = { name, groupId, divisionId, isOffice: !!isOffice, positionFactor: positionFactor ? parseFloat(positionFactor) : 1.0 };
        if (id) data.id = id;

        const department = await prisma.department.create({
            data
        });
        res.status(201).json(department);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create department' });
    }
};

export const deleteDepartment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.department.delete({ where: { id } });
        res.json({ message: 'Department deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete department' });
    }
};

export const updateDepartment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, groupId, divisionId, isOffice, positionFactor } = req.body;
        const department = await prisma.department.update({
            where: { id },
            data: { name, groupId, divisionId, isOffice: !!isOffice, positionFactor: positionFactor ? parseFloat(positionFactor) : 1.0 }
        });
        res.json(department);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update department' });
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

export const updateGroup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const group = await prisma.group.update({
            where: { id },
            data: { name }
        });
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update group' });
    }
};


// --- Divisions ---

export const getDivisions = async (req: Request, res: Response) => {
    try {
        const divisions = await prisma.division.findMany({
            include: {
                _count: {
                    select: { departments: true, employees: true }
                }
            }
        });
        res.json(divisions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch divisions' });
    }
};

export const createDivision = async (req: Request, res: Response) => {
    try {
        const { id, name, directorateId, positionFactor } = req.body;

        const data: any = { name, directorateId: directorateId || undefined, positionFactor: positionFactor ? parseFloat(positionFactor) : 1.0 };
        if (id) data.id = id;

        const division = await prisma.division.create({
            data
        });
        res.status(201).json(division);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create division' });
    }
};

export const updateDivision = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, directorateId, positionFactor } = req.body;
        const division = await prisma.division.update({
            where: { id },
            data: { name, directorateId: directorateId || undefined, positionFactor: positionFactor ? parseFloat(positionFactor) : 1.0 }
        });
        res.json(division);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update division' });
    }
};

export const deleteDivision = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.division.delete({ where: { id } });
        res.json({ message: 'Division deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete division' });
    }
};
