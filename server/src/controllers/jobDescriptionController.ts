import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const cleanId = (val: any): string | null => (val === '' || val === 'null' || val === 'undefined' || !val) ? null : val;

// For a nullable Json column: pass the object, or JsonNull to explicitly clear it.
const cleanJson = (val: any) => (val === undefined || val === null) ? Prisma.JsonNull : val;

export const getAllJobDescriptions = async (req: Request, res: Response) => {
    try {
        const jobDescriptions = await prisma.jobDescription.findMany({
            include: {
                directorate: { select: { id: true, name: true } },
                division: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                unit: { select: { id: true, name: true } },
                _count: { select: { employees: true } }
            },
            orderBy: { title: 'asc' }
        });
        res.json(jobDescriptions);
    } catch (error) {
        console.error('Error fetching job descriptions:', error);
        res.status(500).json({ error: 'Failed to fetch job descriptions' });
    }
};

export const createJobDescription = async (req: Request, res: Response) => {
    try {
        const { title, description, isHead, plannedCount, directorateId, divisionId, departmentId, unitId, jobCategories, workLocations, details } = req.body;

        const cleanDirectorateId = cleanId(directorateId);
        const cleanDivisionId = cleanId(divisionId);
        const cleanDepartmentId = cleanId(departmentId);
        const cleanUnitId = cleanId(unitId);

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        if (!cleanDirectorateId && !cleanDivisionId && !cleanDepartmentId && !cleanUnitId) {
            return res.status(400).json({ error: 'A Job Description must be assigned to exactly one organizational scope (Directorate, Division, Department, or Unit)' });
        }

        // A Head position can only ever have one holder.
        const resolvedPlannedCount = Boolean(isHead) ? 1 : (parseInt(plannedCount) || 1);

        const jobDescription = await prisma.jobDescription.create({
            data: {
                title,
                description: description || null,
                isHead: Boolean(isHead),
                plannedCount: resolvedPlannedCount,
                jobCategories: Array.isArray(jobCategories) ? jobCategories : [],
                workLocations: Array.isArray(workLocations) ? workLocations : [],
                details: cleanJson(details),
                directorateId: cleanDirectorateId,
                divisionId: cleanDivisionId,
                departmentId: cleanDepartmentId,
                unitId: cleanUnitId
            }
        });
        res.status(201).json(jobDescription);
    } catch (error) {
        console.error('Error creating job description:', error);
        res.status(500).json({ error: 'Failed to create job description' });
    }
};

export const updateJobDescription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, isHead, plannedCount, directorateId, divisionId, departmentId, unitId, jobCategories, workLocations, details } = req.body;

        const cleanDirectorateId = cleanId(directorateId);
        const cleanDivisionId = cleanId(divisionId);
        const cleanDepartmentId = cleanId(departmentId);
        const cleanUnitId = cleanId(unitId);

        if (!cleanDirectorateId && !cleanDivisionId && !cleanDepartmentId && !cleanUnitId) {
            return res.status(400).json({ error: 'A Job Description must be assigned to exactly one organizational scope (Directorate, Division, Department, or Unit)' });
        }

        // A Head position can only ever have one holder.
        const resolvedPlannedCount = Boolean(isHead) ? 1 : (parseInt(plannedCount) || 1);

        const jobDescription = await prisma.jobDescription.update({
            where: { id },
            data: {
                title,
                description: description || null,
                isHead: Boolean(isHead),
                plannedCount: resolvedPlannedCount,
                jobCategories: Array.isArray(jobCategories) ? jobCategories : [],
                workLocations: Array.isArray(workLocations) ? workLocations : [],
                details: cleanJson(details),
                directorateId: cleanDirectorateId,
                divisionId: cleanDivisionId,
                departmentId: cleanDepartmentId,
                unitId: cleanUnitId
            }
        });
        res.json(jobDescription);
    } catch (error) {
        console.error('Error updating job description:', error);
        res.status(500).json({ error: 'Failed to update job description' });
    }
};

export const deleteJobDescription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const employeeCount = await prisma.employee.count({ where: { jobDescriptionId: id } });
        if (employeeCount > 0) {
            return res.status(409).json({ error: `Cannot delete: ${employeeCount} employee(s) are currently assigned to this Job Description.` });
        }
        await prisma.jobDescription.delete({ where: { id } });
        res.json({ message: 'Job description deleted successfully' });
    } catch (error) {
        console.error('Error deleting job description:', error);
        res.status(500).json({ error: 'Failed to delete job description' });
    }
};
