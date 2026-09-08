// Payroll deductions (الخصومات) — everything taken off a salary that is not an advance instalment.
//
// The categories are a CLOSED set, not free text, because each one is a printed row on the payslip
// template (public/PAYSLIP.docx). A category the template has no row for could never be shown to
// the employee, so it is rejected here rather than silently lost at print time.
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { round2 } from '../utils/payrollEngine';
import { isValidPeriod } from '../utils/payrollPeriod';

interface AuthRequest extends Request {
    user?: { id: string; role: string; fullName?: string };
}

// Each key is a row that exists on the payslip. The Arabic label is the template's own wording.
export const DEDUCTION_CATEGORIES: Record<string, { en: string; ar: string }> = {
    CASH_ADVANCE: { en: 'Cash Advance Deduction', ar: 'خصم سلفة الراتب' },
    TICKET_COST: { en: 'Ticket Cost Deduction', ar: 'خصم تكاليف التذاكر' },
    PENALTY: { en: 'Penalty Deduction', ar: 'خصم عقوبة' },
    HEALTH_INSURANCE_OVERRUN: { en: 'Health Insurance Cost Overruns', ar: 'تجاوزات تكاليف تأمين الصحة' },
    PREVIOUS_OVERPAYMENT: { en: 'Previous Miscalculation for Overpayment', ar: 'خطأ سابق في حساب دفع زائد' },
};

const CURRENCIES = ['LYD', 'USD', 'EUR'];

const EMPLOYEE_SELECT = {
    select: { id: true, fullName: true, staffId: true, position: true, contractType: true },
} as const;

/** The category list, for populating the picker without hardcoding it in the frontend too. */
export const listDeductionCategories = (_req: Request, res: Response) => {
    res.json(Object.entries(DEDUCTION_CATEGORIES).map(([key, v]) => ({ key, ...v })));
};

export const listDeductions = async (req: Request, res: Response) => {
    try {
        const { employeeId, period, status, category } = req.query as Record<string, string | undefined>;
        const where: any = {};
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        if (category) where.category = category;
        // A recurring deduction has no single period, so a period filter has to match either the
        // one-off period or a recurring window that covers it.
        if (period) {
            where.OR = [
                { period },
                { recurring: true, startPeriod: { lte: period }, OR: [{ endPeriod: null }, { endPeriod: { gte: period } }] },
            ];
        }

        const deductions = await prisma.employeeDeduction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { employee: EMPLOYEE_SELECT },
        });
        res.json(deductions);
    } catch (error) {
        console.error('Error listing deductions:', error);
        res.status(500).json({ error: 'Failed to load deductions' });
    }
};

export const createDeduction = async (req: AuthRequest, res: Response) => {
    try {
        const {
            employeeId, category, amount, currency, period, recurring, startPeriod, endPeriod,
            notes, documentUrl, documentName, label,
        } = req.body || {};

        if (!employeeId) return res.status(400).json({ error: 'Select an employee.' });
        const employee = await prisma.employee.findUnique({ where: { id: String(employeeId) } });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const cat = String(category || '').toUpperCase();
        if (!DEDUCTION_CATEGORIES[cat]) {
            return res.status(400).json({ error: `Category must be one of: ${Object.keys(DEDUCTION_CATEGORIES).join(', ')}.` });
        }

        const value = Number(amount);
        if (!isFinite(value) || value <= 0) return res.status(400).json({ error: 'The deduction amount must be greater than zero.' });

        const cur = String(currency || '').toUpperCase();
        if (!CURRENCIES.includes(cur)) return res.status(400).json({ error: `Currency must be one of: ${CURRENCIES.join(', ')}.` });

        const isRecurring = Boolean(recurring);
        if (isRecurring) {
            if (!isValidPeriod(String(startPeriod || ''))) return res.status(400).json({ error: 'A recurring deduction needs a valid start period (YYYY-MM).' });
            if (endPeriod && !isValidPeriod(String(endPeriod))) return res.status(400).json({ error: 'Invalid end period. Expected YYYY-MM.' });
            if (endPeriod && String(endPeriod) < String(startPeriod)) return res.status(400).json({ error: 'The end period cannot be before the start period.' });
        } else if (!isValidPeriod(String(period || ''))) {
            return res.status(400).json({ error: 'A one-off deduction needs a valid period (YYYY-MM).' });
        }

        const deduction = await prisma.employeeDeduction.create({
            data: {
                employeeId: employee.id,
                category: cat,
                label: label ? String(label).trim() : DEDUCTION_CATEGORIES[cat].en,
                labelArabic: DEDUCTION_CATEGORIES[cat].ar,
                currency: cur,
                amount: round2(value),
                period: isRecurring ? null : String(period),
                recurring: isRecurring,
                startPeriod: isRecurring ? String(startPeriod) : null,
                endPeriod: isRecurring && endPeriod ? String(endPeriod) : null,
                notes: notes ? String(notes).trim() : null,
                documentUrl: documentUrl ? String(documentUrl) : null,
                documentName: documentName ? String(documentName) : null,
                createdByName: req.user?.fullName || null,
            },
            include: { employee: EMPLOYEE_SELECT },
        });

        res.locals.auditDetails = `for ${employee.fullName} — ${DEDUCTION_CATEGORIES[cat].en}, ${cur} ${value}`;
        res.status(201).json(deduction);
    } catch (error) {
        console.error('Error creating deduction:', error);
        res.status(500).json({ error: 'Failed to create the deduction' });
    }
};

// Once a payroll run has collected a deduction it is part of a payslip someone has been handed —
// editing it afterwards would make the record disagree with the printed document.
const assertNotApplied = (d: { appliedInRunId: string | null; status: string }): string | null =>
    d.appliedInRunId || d.status === 'APPLIED'
        ? 'This deduction has already been applied in a payroll run and can no longer be changed.'
        : null;

export const updateDeduction = async (req: AuthRequest, res: Response) => {
    try {
        const found = await prisma.employeeDeduction.findUnique({ where: { id: req.params.id } });
        if (!found) return res.status(404).json({ error: 'Deduction not found' });
        const locked = assertNotApplied(found);
        if (locked) return res.status(409).json({ error: locked });

        const data: any = {};
        if (req.body?.amount !== undefined) {
            const value = Number(req.body.amount);
            if (!isFinite(value) || value <= 0) return res.status(400).json({ error: 'The deduction amount must be greater than zero.' });
            data.amount = round2(value);
        }
        if (req.body?.period !== undefined) {
            if (!isValidPeriod(String(req.body.period))) return res.status(400).json({ error: 'Invalid period. Expected YYYY-MM.' });
            data.period = String(req.body.period);
        }
        if (req.body?.notes !== undefined) data.notes = String(req.body.notes).trim() || null;
        if (req.body?.documentUrl !== undefined) data.documentUrl = req.body.documentUrl || null;
        if (req.body?.documentName !== undefined) data.documentName = req.body.documentName || null;
        if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update.' });

        const updated = await prisma.employeeDeduction.update({
            where: { id: found.id }, data, include: { employee: EMPLOYEE_SELECT },
        });
        // Both values, because "changed the amount" without the numbers answers nothing.
        res.locals.auditDetails =
            `${found.label} for ${updated.employee?.fullName || 'an employee'} — `
            + `${found.currency} ${found.amount} → ${updated.currency} ${updated.amount}, ${updated.period || updated.startPeriod}`;
        res.json(updated);
    } catch (error) {
        console.error('Error updating deduction:', error);
        res.status(500).json({ error: 'Failed to update the deduction' });
    }
};

// Approving is what makes a deduction eligible to be picked up by a payroll run.
export const approveDeduction = async (req: AuthRequest, res: Response) => {
    try {
        const found = await prisma.employeeDeduction.findUnique({ where: { id: req.params.id } });
        if (!found) return res.status(404).json({ error: 'Deduction not found' });
        if (found.status !== 'PENDING') {
            return res.status(409).json({ error: `This deduction is already ${found.status.toLowerCase()}.` });
        }

        const updated = await prisma.employeeDeduction.update({
            where: { id: found.id },
            data: { status: 'APPROVED', approvedAt: new Date(), approvedByName: req.user?.fullName || null },
            include: { employee: EMPLOYEE_SELECT },
        });
        res.locals.auditDetails = `${found.label} for the ${found.period || found.startPeriod} period`;
        res.json(updated);
    } catch (error) {
        console.error('Error approving deduction:', error);
        res.status(500).json({ error: 'Failed to approve the deduction' });
    }
};

export const cancelDeduction = async (req: AuthRequest, res: Response) => {
    try {
        const found = await prisma.employeeDeduction.findUnique({ where: { id: req.params.id } });
        if (!found) return res.status(404).json({ error: 'Deduction not found' });
        const locked = assertNotApplied(found);
        if (locked) return res.status(409).json({ error: locked });

        const updated = await prisma.employeeDeduction.update({
            where: { id: found.id }, data: { status: 'CANCELLED' }, include: { employee: EMPLOYEE_SELECT },
        });
        res.locals.auditDetails =
            `${found.label} for ${updated.employee?.fullName || 'an employee'} — ${found.currency} ${found.amount} no longer collected`;
        res.json(updated);
    } catch (error) {
        console.error('Error cancelling deduction:', error);
        res.status(500).json({ error: 'Failed to cancel the deduction' });
    }
};
