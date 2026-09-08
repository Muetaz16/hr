// Service Providers — the staffing companies that supply IPH's non-resident ("NONE RESDANT")
// employees. Before this module their names lived as a hardcoded array in careers/app.js and as a
// free-text box on the onboarding form, so nothing could be attached to them. They now carry a
// `percentage`: the provider's cut, charged to IPH ON TOP of the employee's total salary. It never
// touches the employee's pay and never appears on a payslip — payroll reads it for cost reporting.
import express from 'express';

import { prisma } from '../lib/prisma';
import { ACTIVE_ENROLLMENT_FILTER } from '../utils/employeeStatus';

const clean = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s.length ? s : null;
};

const parseDate = (v: unknown): Date | null => {
    if (!v || typeof v !== 'string') return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
};

// Percentages are entered as whole numbers (15 = 15%). Anything outside 0-100 is a typo, not a deal.
const parsePercentage = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    if (!isFinite(n) || n < 0 || n > 100) return null;
    return Math.round(n * 100) / 100;
};

const countsInclude = {
    _count: {
        select: {
            employees: { where: { enrollmentStatus: ACTIVE_ENROLLMENT_FILTER } },
            candidates: true,
        },
    },
} as const;

// GET /api/service-providers — full list, used by the admin screen and by every provider dropdown.
export const getServiceProviders = async (_req: express.Request, res: express.Response) => {
    try {
        const providers = await prisma.serviceProvider.findMany({
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
            include: countsInclude,
        });
        res.json(providers);
    } catch (error) {
        console.error('Error fetching service providers:', error);
        res.status(500).json({ error: 'Failed to fetch service providers' });
    }
};

export const createServiceProvider = async (req: express.Request, res: express.Response) => {
    try {
        const name = clean(req.body.name);
        if (!name) return res.status(400).json({ error: 'Provider name is required.' });

        const percentage = parsePercentage(req.body.percentage ?? 0);
        if (percentage === null) return res.status(400).json({ error: 'Percentage must be a number between 0 and 100.' });

        const existing = await prisma.serviceProvider.findUnique({ where: { name } });
        if (existing) return res.status(409).json({ error: `A service provider named "${name}" already exists.` });

        const provider = await prisma.serviceProvider.create({
            data: {
                name,
                nameArabic: clean(req.body.nameArabic),
                percentage,
                contactPerson: clean(req.body.contactPerson),
                phone: clean(req.body.phone),
                email: clean(req.body.email),
                address: clean(req.body.address),
                contractStart: parseDate(req.body.contractStart),
                contractEnd: parseDate(req.body.contractEnd),
                notes: clean(req.body.notes),
                isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
            },
            include: countsInclude,
        });
        res.status(201).json(provider);
    } catch (error) {
        console.error('Error creating service provider:', error);
        res.status(500).json({ error: 'Failed to create service provider' });
    }
};

export const updateServiceProvider = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const name = clean(req.body.name);
        if (!name) return res.status(400).json({ error: 'Provider name is required.' });

        const percentage = parsePercentage(req.body.percentage ?? 0);
        if (percentage === null) return res.status(400).json({ error: 'Percentage must be a number between 0 and 100.' });

        const clash = await prisma.serviceProvider.findUnique({ where: { name } });
        if (clash && clash.id !== id) return res.status(409).json({ error: `A service provider named "${name}" already exists.` });

        const provider = await prisma.serviceProvider.update({
            where: { id },
            data: {
                name,
                nameArabic: clean(req.body.nameArabic),
                percentage,
                contactPerson: clean(req.body.contactPerson),
                phone: clean(req.body.phone),
                email: clean(req.body.email),
                address: clean(req.body.address),
                contractStart: parseDate(req.body.contractStart),
                contractEnd: parseDate(req.body.contractEnd),
                notes: clean(req.body.notes),
                isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
            },
            include: countsInclude,
        });
        res.json(provider);
    } catch (error) {
        console.error('Error updating service provider:', error);
        res.status(500).json({ error: 'Failed to update service provider' });
    }
};

// The FK is ON DELETE SET NULL, so the database would happily orphan every linked record without a
// word. Refuse instead and point the caller at deactivation, which keeps the history intact.
export const deleteServiceProvider = async (req: express.Request, res: express.Response) => {
    try {
        const { id } = req.params;
        const [employees, candidates] = await Promise.all([
            prisma.employee.count({ where: { serviceProviderId: id } }),
            prisma.candidate.count({ where: { serviceProviderId: id } }),
        ]);
        if (employees || candidates) {
            return res.status(409).json({
                error: `This provider is linked to ${employees} employee(s) and ${candidates} candidate(s). Deactivate it instead of deleting — deleting would erase that link.`,
            });
        }
        await prisma.serviceProvider.delete({ where: { id } });
        res.json({ message: 'Service provider deleted successfully' });
    } catch (error) {
        console.error('Error deleting service provider:', error);
        res.status(500).json({ error: 'Failed to delete service provider' });
    }
};
