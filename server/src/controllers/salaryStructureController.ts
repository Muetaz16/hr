import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

import { prisma } from '../lib/prisma';

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

// ---------------------------------------------------------------------------------------------
// Editing the rate card.
//
// The card is the origin of every salary in the system: hourlyRate x hours worked IS the basic pay,
// and monthlyRate is what the advance screen offers as "one basic salary". So an edit here silently
// changes what everyone on that rate is owed next month, and it is treated accordingly:
//
//   · monthlyRate is DERIVED, never typed. It is hourlyRate x 208 (the contractual month), the
//     relationship every existing row already satisfies. Letting both be typed is how the two drift
//     apart and two screens start quoting different salaries for the same person.
//   · A rate an employee is actually paid on cannot be deleted. Removing it does not lower their
//     salary — it stops them being payable at all, and they surface as blocked lines with no
//     obvious cause.
//   · Writes are gated on manage_payroll. The read routes stay open to any signed-in user because
//     the employee form, contract renewal and candidate offers all read them.
// ---------------------------------------------------------------------------------------------

/** Contractual hours in a month. The whole card satisfies monthlyRate = hourlyRate x 208. */
export const MONTHLY_HOURS = 208;

interface AuthRequest extends Request {
    user?: { id: string; role: string; fullName?: string };
}

const CURRENCY_SUFFIXES = ['LYD', 'USD', 'EUR'];

/** Rejects a level whose suffix is not a currency — the suffix is where payroll reads it from. */
const validateLevel = (level: string): string | null => {
    const suffix = level.trim().split('-').pop();
    if (!suffix || !CURRENCY_SUFFIXES.includes(suffix)) {
        return `Structure level must end in a currency (${CURRENCY_SUFFIXES.join(', ')}) — payroll reads the currency from that suffix.`;
    }
    return null;
};

const parseRate = (value: unknown): number | null => {
    const n = Number(value);
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(n * 10000) / 10000;
};

const monthlyFor = (hourlyRate: number) => Math.round(hourlyRate * MONTHLY_HOURS * 100) / 100;

// POST /api/salary-structures
export const createSalaryStructure = async (req: AuthRequest, res: Response) => {
    try {
        const jobCategory = String(req.body?.jobCategory || '').trim();
        const jobGrade = String(req.body?.jobGrade || '').trim();
        const structureLevel = String(req.body?.structureLevel || '').trim();
        if (!jobCategory || !jobGrade || !structureLevel) {
            return res.status(400).json({ error: 'Job category, job grade and structure level are all required.' });
        }
        const levelError = validateLevel(structureLevel);
        if (levelError) return res.status(400).json({ error: levelError });

        const hourlyRate = parseRate(req.body?.hourlyRate);
        if (hourlyRate === null) return res.status(400).json({ error: 'The hourly rate must be greater than zero.' });

        const existing = await prisma.salaryStructure.findUnique({
            where: { jobCategory_jobGrade_structureLevel: { jobCategory, jobGrade, structureLevel } },
        });
        if (existing) {
            return res.status(409).json({ error: 'That category, grade and structure already has a rate. Edit it instead.' });
        }

        const created = await prisma.salaryStructure.create({
            data: { jobCategory, jobGrade, structureLevel, hourlyRate, monthlyRate: monthlyFor(hourlyRate) },
        });
        res.locals.auditDetails = `${jobCategory} / ${jobGrade} / ${structureLevel} at ${hourlyRate}`;
        res.status(201).json(created);
    } catch (error) {
        console.error('Error creating salary structure:', error);
        res.status(500).json({ error: 'Failed to create the rate' });
    }
};

// PATCH /api/salary-structures/:id — only the rate is editable; the key identifies the row.
export const updateSalaryStructure = async (req: AuthRequest, res: Response) => {
    try {
        const found = await prisma.salaryStructure.findUnique({ where: { id: req.params.id } });
        if (!found) return res.status(404).json({ error: 'Rate not found' });

        const hourlyRate = parseRate(req.body?.hourlyRate);
        if (hourlyRate === null) return res.status(400).json({ error: 'The hourly rate must be greater than zero.' });

        const updated = await prisma.salaryStructure.update({
            where: { id: found.id },
            data: { hourlyRate, monthlyRate: monthlyFor(hourlyRate) },
        });
        res.locals.auditDetails =
            `${found.jobCategory} / ${found.jobGrade} / ${found.structureLevel}: ${found.hourlyRate} -> ${hourlyRate}`;
        res.json(updated);
    } catch (error) {
        console.error('Error updating salary structure:', error);
        res.status(500).json({ error: 'Failed to update the rate' });
    }
};

// DELETE /api/salary-structures/:id
export const deleteSalaryStructure = async (req: AuthRequest, res: Response) => {
    try {
        const found = await prisma.salaryStructure.findUnique({ where: { id: req.params.id } });
        if (!found) return res.status(404).json({ error: 'Rate not found' });

        const usedBy = await prisma.employee.count({
            where: {
                jobCategory: found.jobCategory,
                jobGrade: found.jobGrade,
                salaryStructureType: found.structureLevel,
            },
        });
        if (usedBy > 0) {
            return res.status(409).json({
                error: `${usedBy} employee(s) are paid on this rate. Move them to another grade or structure first.`,
                employeeCount: usedBy,
            });
        }

        await prisma.salaryStructure.delete({ where: { id: found.id } });
        res.locals.auditDetails = `${found.jobCategory} / ${found.jobGrade} / ${found.structureLevel}`;
        res.json({ ok: true });
    } catch (error) {
        console.error('Error deleting salary structure:', error);
        res.status(500).json({ error: 'Failed to delete the rate' });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/salary-structures/coverage
//
// Which rows exist, how many employees each one actually pays, and which combinations an employee
// points at that the card does not cover. That last list is the only kind of gap that costs
// anything — an unused hole in the grid costs nobody — and it is what settles whether a blocked
// payroll line is a rate-card problem or an employee-record one.
// ---------------------------------------------------------------------------------------------
export const getSalaryStructureCoverage = async (_req: Request, res: Response) => {
    try {
        const [structures, employees] = await Promise.all([
            prisma.salaryStructure.findMany(),
            prisma.employee.findMany({ select: { jobCategory: true, jobGrade: true, salaryStructureType: true } }),
        ]);

        const categories = [...new Set(structures.map(s => s.jobCategory))].sort();
        const grades = [...new Set(structures.map(s => s.jobGrade))].sort();
        const levels = [...new Set(structures.map(s => s.structureLevel))].sort();

        const key = (c: string, g: string, l: string) => `${c}|${g}|${l}`;
        const have = new Set(structures.map(s => key(s.jobCategory, s.jobGrade, s.structureLevel)));

        const usage = new Map<string, number>();
        for (const e of employees) {
            if (!e.jobCategory || !e.jobGrade || !e.salaryStructureType) continue;
            const k = key(e.jobCategory, e.jobGrade, e.salaryStructureType);
            usage.set(k, (usage.get(k) || 0) + 1);
        }

        const split = (k: string) => {
            const [jobCategory, jobGrade, structureLevel] = k.split('|');
            return { jobCategory, jobGrade, structureLevel };
        };

        res.json({
            total: structures.length,
            expected: categories.length * grades.length * levels.length,
            categories, grades, levels,
            usage: [...usage.entries()].map(([k, employeeCount]) => ({ ...split(k), employeeCount })),
            missingInUse: [...usage.keys()]
                .filter(k => !have.has(k))
                .map(k => ({ ...split(k), employeeCount: usage.get(k) || 0 })),
        });
    } catch (error) {
        console.error('Error building salary structure coverage:', error);
        res.status(500).json({ error: 'Failed to build the rate card coverage' });
    }
};
