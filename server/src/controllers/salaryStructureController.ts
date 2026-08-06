import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllSalaryStructures = async (req: Request, res: Response) => {
    try {
        const structures = await prisma.salaryStructure.findMany();
        res.json(structures);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch salary structures' });
    }
};

export const getSalaryStructure = async (req: Request, res: Response) => {
    try {
        const { jobCategory, jobGrade, structureLevel } = req.query;
        
        if (!jobCategory || !jobGrade || !structureLevel) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const structure = await prisma.salaryStructure.findUnique({
            where: {
                jobCategory_jobGrade_structureLevel: {
                    jobCategory: String(jobCategory),
                    jobGrade: String(jobGrade),
                    structureLevel: String(structureLevel)
                }
            }
        });

        if (!structure) {
            return res.status(404).json({ error: 'Salary structure not found' });
        }

        res.json(structure);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch salary structure' });
    }
};
