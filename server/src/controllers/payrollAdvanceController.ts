// Salary advances and loans (السلف).
//
// The flow is request -> approve -> instalments, and it obeys the project's standing rule for
// anything that moves money: nothing is granted by a single click. An advance only becomes real
// when someone with manage_payroll approves it AND attaches the signed agreement; only then are the
// instalments created.
//
// Instalments are materialised as rows up front rather than derived on the fly. That makes
// "defer this month", "waive the rest" and "which run collected this one" ordinary queries instead
// of arithmetic, and it lets the LAST instalment absorb the rounding remainder so the instalments
// always add back up to the principal exactly.
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { round2 } from '../utils/payrollEngine';
import { isValidPeriod, currentPeriod } from '../utils/payrollPeriod';

interface AuthRequest extends Request {
    user?: { id: string; role: string; fullName?: string };
}

const ADVANCE_TYPES = ['SALARY_ADVANCE', 'LOAN', 'TRAVEL_TICKET', 'OTHER'];
const CURRENCIES = ['LYD', 'USD', 'EUR'];

const EMPLOYEE_SELECT = {
    select: { id: true, fullName: true, staffId: true, position: true, contractType: true },
} as const;

const nextRequestNumber = async (): Promise<string> => {
    const count = await prisma.employeeAdvance.count();
    return `IPH-CCHR-FRM-ADVNC-${String(count + 1).padStart(3, '0')}`;
};

/** Adds `n` months to a 'YYYY-MM' period label. */
const addMonths = (period: string, n: number): string => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Splits a principal into equal instalments, with the remainder folded into the LAST one so the
 * parts always sum back to the whole. Splitting 1000 over 3 gives 333.33 / 333.33 / 333.34.
 */
export const buildInstalmentSchedule = (
    principal: number, count: number, firstPeriod: string,
): { sequence: number; period: string; amount: number }[] => {
    const n = Math.max(1, Math.floor(count));
    const each = round2(principal / n);
    const rows = Array.from({ length: n }, (_, i) => ({
        sequence: i + 1,
        period: addMonths(firstPeriod, i),
        amount: each,
    }));
    const drift = round2(principal - round2(each * n));
    if (drift !== 0) rows[n - 1].amount = round2(rows[n - 1].amount + drift);
    return rows;
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-advances
// ---------------------------------------------------------------------------------------------
export const listAdvances = async (req: Request, res: Response) => {
    try {
        const { status, employeeId, scope } = req.query as Record<string, string | undefined>;
        const where: any = {};
        if (status) where.status = status;
        if (employeeId) where.employeeId = employeeId;

        // Provider advances follow a different procedure (the provider signs, then the cash is
        // handed over) and live on their own screen. Keyed off the EMPLOYEE's contract type rather
        // than the advance's residency snapshot, because an advance entered by payroll on someone's
        // behalf carries no snapshot — filtering on that would leak those rows into both screens.
        if (scope === 'direct') where.employee = { contractType: { not: 'NONE RESDANT' } };
        if (scope === 'provider') where.employee = { contractType: 'NONE RESDANT' };

        const advances = await prisma.employeeAdvance.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                employee: EMPLOYEE_SELECT,
                instalments: { orderBy: { sequence: 'asc' } },
            },
        });
        res.json(advances);
    } catch (error) {
        console.error('Error listing advances:', error);
        res.status(500).json({ error: 'Failed to load advances' });
    }
};

export const getAdvance = async (req: Request, res: Response) => {
    try {
        const advance = await prisma.employeeAdvance.findUnique({
            where: { id: req.params.id },
            include: { employee: EMPLOYEE_SELECT, instalments: { orderBy: { sequence: 'asc' } } },
        });
        if (!advance) return res.status(404).json({ error: 'Advance not found' });
        res.json(advance);
    } catch (error) {
        console.error('Error loading advance:', error);
        res.status(500).json({ error: 'Failed to load the advance' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-advances — raise the request. Creates no instalments and moves no money.
// ---------------------------------------------------------------------------------------------
export const createAdvance = async (req: AuthRequest, res: Response) => {
    try {
        const { employeeId, type, currency, principal, instalmentCount, firstDeductionPeriod, reason, notes } = req.body || {};

        if (!employeeId) return res.status(400).json({ error: 'Select an employee.' });
        const employee = await prisma.employee.findUnique({ where: { id: String(employeeId) } });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const amount = Number(principal);
        if (!isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'The advance amount must be greater than zero.' });

        const count = Number(instalmentCount) || 1;
        if (!Number.isInteger(count) || count < 1 || count > 60) {
            return res.status(400).json({ error: 'The number of instalments must be a whole number between 1 and 60.' });
        }

        const period = String(firstDeductionPeriod || currentPeriod());
        if (!isValidPeriod(period)) return res.status(400).json({ error: 'Invalid first deduction period. Expected YYYY-MM.' });

        const cur = String(currency || '').toUpperCase();
        if (!CURRENCIES.includes(cur)) return res.status(400).json({ error: `Currency must be one of: ${CURRENCIES.join(', ')}.` });

        const advanceType = String(type || 'SALARY_ADVANCE').toUpperCase();
        if (!ADVANCE_TYPES.includes(advanceType)) return res.status(400).json({ error: `Type must be one of: ${ADVANCE_TYPES.join(', ')}.` });

        // Snapshotted so a payroll-entered advance is grouped and routed exactly like a
        // self-filed one, instead of being invisible to the provider screen.
        const providerName = employee.serviceProviderId
            ? (await prisma.serviceProvider.findUnique({
                where: { id: employee.serviceProviderId }, select: { name: true },
            }))?.name ?? null
            : null;

        const advance = await prisma.employeeAdvance.create({
            data: {
                requestNumber: await nextRequestNumber(),
                employeeId: employee.id,
                residencyType: employee.contractType,
                serviceProviderId: employee.serviceProviderId,
                serviceProviderName: providerName,
                type: advanceType,
                currency: cur,
                principal: round2(amount),
                instalmentCount: count,
                firstDeductionPeriod: period,
                outstandingAmount: round2(amount),
                reason: reason ? String(reason).trim() : null,
                notes: notes ? String(notes).trim() : null,
                createdByName: req.user?.fullName || null,
            },
            include: { employee: EMPLOYEE_SELECT, instalments: true },
        });

        res.locals.auditDetails = `for ${employee.fullName} (${employee.staffId || 'no staff id'}) — ${cur} ${amount}`;
        res.status(201).json(advance);
    } catch (error) {
        console.error('Error creating advance:', error);
        res.status(500).json({ error: 'Failed to create the advance' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-advances/:id/approve — requires the signed agreement, then schedules the
// instalments. This is the step that makes the advance real; there is no one-click grant.
// ---------------------------------------------------------------------------------------------
export const approveAdvance = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName } = req.body || {};
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed advance agreement before approving.' });

        const found = await prisma.employeeAdvance.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Advance not found' });
        if (found.status !== 'PENDING') {
            return res.status(409).json({ error: `This advance is already ${found.status.toLowerCase()} and cannot be approved again.` });
        }

        const schedule = buildInstalmentSchedule(found.principal, found.instalmentCount, found.firstDeductionPeriod);

        const [advance] = await prisma.$transaction([
            prisma.employeeAdvance.update({
                where: { id },
                data: {
                    status: 'ACTIVE',
                    approvedAt: new Date(),
                    approvedByName: req.user?.fullName || null,
                    documentUrl: String(documentUrl),
                    documentName: documentName ? String(documentName) : null,
                    outstandingAmount: round2(found.principal),
                },
                include: { employee: EMPLOYEE_SELECT, instalments: { orderBy: { sequence: 'asc' } } },
            }),
            prisma.employeeAdvanceInstalment.createMany({
                data: schedule.map(s => ({ ...s, advanceId: id })),
            }),
        ]);

        const withSchedule = await prisma.employeeAdvance.findUnique({
            where: { id },
            include: { employee: EMPLOYEE_SELECT, instalments: { orderBy: { sequence: 'asc' } } },
        });
        res.locals.auditDetails = `${advance.requestNumber} — ${schedule.length} instalment(s) scheduled from ${found.firstDeductionPeriod}`;
        res.json(withSchedule);
    } catch (error) {
        console.error('Error approving advance:', error);
        res.status(500).json({ error: 'Failed to approve the advance' });
    }
};

export const rejectAdvance = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const reason = req.body?.rejectionReason ? String(req.body.rejectionReason).trim() : '';
        if (!reason) return res.status(400).json({ error: 'Give a reason for rejecting this advance.' });

        const found = await prisma.employeeAdvance.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Advance not found' });
        if (found.status !== 'PENDING') {
            return res.status(409).json({ error: `Only a pending advance can be rejected (this one is ${found.status.toLowerCase()}).` });
        }

        const advance = await prisma.employeeAdvance.update({
            where: { id },
            data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason },
            include: { employee: EMPLOYEE_SELECT, instalments: true },
        });
        res.json(advance);
    } catch (error) {
        console.error('Error rejecting advance:', error);
        res.status(500).json({ error: 'Failed to reject the advance' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-advances/:id/cancel — stop collecting the rest. Instalments already taken by a
// payroll run are left exactly as they are; only the scheduled ones are dropped.
// ---------------------------------------------------------------------------------------------
export const cancelAdvance = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const found = await prisma.employeeAdvance.findUnique({ where: { id }, include: { instalments: true } });
        if (!found) return res.status(404).json({ error: 'Advance not found' });
        if (['SETTLED', 'CANCELLED', 'REJECTED'].includes(found.status)) {
            return res.status(409).json({ error: `This advance is already ${found.status.toLowerCase()}.` });
        }

        await prisma.$transaction([
            prisma.employeeAdvanceInstalment.updateMany({
                where: { advanceId: id, status: 'SCHEDULED' },
                data: { status: 'WAIVED', note: 'Advance cancelled' },
            }),
            prisma.employeeAdvance.update({
                where: { id },
                data: { status: 'CANCELLED', notes: req.body?.notes ? String(req.body.notes) : found.notes },
            }),
        ]);

        const advance = await prisma.employeeAdvance.findUnique({
            where: { id },
            include: { employee: EMPLOYEE_SELECT, instalments: { orderBy: { sequence: 'asc' } } },
        });
        res.json(advance);
    } catch (error) {
        console.error('Error cancelling advance:', error);
        res.status(500).json({ error: 'Failed to cancel the advance' });
    }
};

// ---------------------------------------------------------------------------------------------
// PATCH /api/payroll-advances/:id/instalments/:instalmentId — defer to a later month or waive it.
// An instalment a payroll run has already collected is immutable.
// ---------------------------------------------------------------------------------------------
export const updateInstalment = async (req: AuthRequest, res: Response) => {
    try {
        const { id, instalmentId } = req.params;
        const instalment = await prisma.employeeAdvanceInstalment.findFirst({ where: { id: instalmentId, advanceId: id } });
        if (!instalment) return res.status(404).json({ error: 'Instalment not found' });
        if (instalment.status === 'DEDUCTED') {
            return res.status(409).json({ error: 'This instalment has already been collected by a payroll run and cannot be changed.' });
        }

        const data: any = {};
        if (req.body?.period !== undefined) {
            const period = String(req.body.period);
            if (!isValidPeriod(period)) return res.status(400).json({ error: 'Invalid period. Expected YYYY-MM.' });
            data.period = period;
            data.status = 'DEFERRED';
        }
        if (req.body?.status !== undefined) {
            const status = String(req.body.status).toUpperCase();
            if (!['SCHEDULED', 'WAIVED', 'DEFERRED'].includes(status)) {
                return res.status(400).json({ error: 'Status must be SCHEDULED, WAIVED or DEFERRED.' });
            }
            data.status = status;
        }
        if (req.body?.note !== undefined) data.note = String(req.body.note).trim() || null;
        if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update.' });

        const updated = await prisma.employeeAdvanceInstalment.update({ where: { id: instalmentId }, data });
        res.json(updated);
    } catch (error) {
        console.error('Error updating instalment:', error);
        res.status(500).json({ error: 'Failed to update the instalment' });
    }
};
