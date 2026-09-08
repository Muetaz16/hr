// Payslips.
//
// Three ways one is asked for, all reading the same stored PayrollLine:
//
//   GET /payroll-runs/:id/lines/:lineId/payslip   one employee, for payroll to check before it goes out
//   GET /payslips/me                              the employee's own list — CLOSED periods only
//   GET /payslips/me/:period                      the employee's own payslip for one month
//
// The employee-facing routes deliberately refuse anything not yet closed. A draft period is rebuilt
// on every press of Recompute; handing someone a figure that changes tomorrow is worse than making
// them wait for the month to be signed off.
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { generatePayslipDocx, generatePayslipBookDocx, PayslipLine } from '../utils/payslipForm';
import { periodLabel } from '../utils/payrollPeriod';
import { findRunLine } from './payrollRunController';
import { docxToPdf, PdfConversionUnavailable } from '../utils/docxToPdf';

interface AuthRequest extends Request {
    user?: { id: string; email?: string; role: string; fullName?: string };
}

const LINE_INCLUDE = {
    items: { select: { kind: true, category: true, amount: true } },
} as const;

const send = (res: Response, line: any, period: string) => {
    const buffer = generatePayslipDocx(line as PayslipLine, period);
    const safe = (line.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Payslip_${safe}_${period}.docx"`);
    res.send(buffer);
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id/lines/:lineId/payslip
//
// Accepts an employee id as :lineId too, because a recompute changes every line's id and a payroll
// specialist should not lose their place for having pressed Recompute.
// ---------------------------------------------------------------------------------------------
export const getLinePayslip = async (req: Request, res: Response) => {
    try {
        const { id, lineId } = req.params;
        const run = await prisma.payrollRun.findUnique({ where: { id }, select: { period: true } });
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });

        const line = await findRunLine(id, lineId, LINE_INCLUDE);
        if (!line) return res.status(404).json({ error: 'Payroll line not found' });

        // A blocked line has every amount forced to zero. Printing it would produce a document
        // stating the employee earned nothing, which is the single most damaging thing this module
        // could hand over.
        if (line.status === 'BLOCKED') {
            return res.status(400).json({
                error: 'This line cannot be paid yet, so its payslip would print zeros. Fix the blocking reasons first.',
                blockReasons: line.blockReasons,
            });
        }
        if (line.status === 'EXCLUDED') {
            return res.status(400).json({ error: 'This employee is excluded from the run, so there is no payslip for them this period.' });
        }

        res.locals.auditDetails =
            `for ${line.fullName || 'an employee'}${line.staffId ? ` (${line.staffId})` : ''} — ${run.period}`;
        send(res, line, run.period);
    } catch (error: any) {
        console.error('Error generating payslip:', error);
        res.status(500).json({ error: 'Failed to generate the payslip', details: error.message });
    }
};

/** The employee behind the signed-in user; self-heals the link by e-mail the way /employees/me does. */
const resolveSelfEmployee = async (user: { id: string; email?: string }) => {
    const direct = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (direct) return direct;
    if (!user.email) return null;
    const byEmail = await prisma.employee.findFirst({ where: { email: user.email }, select: { id: true } });
    if (!byEmail) return null;
    await prisma.employee.update({ where: { id: byEmail.id }, data: { userId: user.id } });
    return byEmail;
};

/** Only signed-off periods are visible to the employee whose salary they describe. */
const CLOSED_RUN = { status: { in: ['APPROVED', 'PAID'] } };

// ---------------------------------------------------------------------------------------------
// GET /api/payslips/me
// ---------------------------------------------------------------------------------------------
export const listMyPayslips = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
        const emp = await resolveSelfEmployee(req.user);
        if (!emp) return res.json([]);

        const lines = await prisma.payrollLine.findMany({
            where: { employeeId: emp.id, status: 'OK', run: CLOSED_RUN },
            select: {
                currency: true, netSalary: true, totalEarnings: true, deductionsTotal: true,
                totalWorkingHours: true, basicSalary: true, bonusAmount: true,
                run: { select: { id: true, period: true, periodStart: true, periodEnd: true, status: true, approvedAt: true, paidAt: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(lines.map(l => ({
            runId: l.run.id,
            period: l.run.period,
            periodLabel: periodLabel(l.run.period),
            periodStart: l.run.periodStart,
            periodEnd: l.run.periodEnd,
            status: l.run.status,
            approvedAt: l.run.approvedAt,
            paidAt: l.run.paidAt,
            currency: l.currency,
            totalWorkingHours: l.totalWorkingHours,
            basicSalary: l.basicSalary,
            bonusAmount: l.bonusAmount,
            totalEarnings: l.totalEarnings,
            deductionsTotal: l.deductionsTotal,
            netSalary: l.netSalary,
        })));
    } catch (error) {
        console.error('Error listing own payslips:', error);
        res.status(500).json({ error: 'Failed to load your payslips' });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/payslips/me/:period
// ---------------------------------------------------------------------------------------------
export const getMyPayslip = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
        const emp = await resolveSelfEmployee(req.user);
        if (!emp) return res.status(404).json({ error: 'No employee record is linked to your account.' });

        const line = await prisma.payrollLine.findFirst({
            where: {
                employeeId: emp.id,
                status: 'OK',
                run: { period: req.params.period, ...CLOSED_RUN },
            },
            include: LINE_INCLUDE,
        });
        if (!line) return res.status(404).json({ error: 'You have no payslip for that month yet.' });

        // PDF, not Word, and only on this route. A .docx handed to an employee is editable: anyone
        // can change their own net salary in Word and forward it as if payroll had issued it. The
        // payroll-side routes stay .docx because that side reviews and prints internally.
        const docx = generatePayslipDocx(line as unknown as PayslipLine, req.params.period);
        const pdf = await docxToPdf(docx, `Payslip_${line.staffId || 'employee'}_${req.params.period}`);

        const safe = (line.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Payslip_${safe}_${req.params.period}.pdf"`);
        res.send(pdf);
    } catch (error: any) {
        // Never fall back to the .docx here: silently handing over an editable payslip would
        // undo the whole reason this route converts.
        if (error instanceof PdfConversionUnavailable) {
            console.error('Payslip PDF requested but LibreOffice is missing:', error.message);
            return res.status(503).json({
                error: 'Payslips are issued as PDF and the converter is not available on the server right now. Contact Human Resources.',
            });
        }
        console.error('Error generating own payslip:', error);
        res.status(500).json({ error: 'Failed to generate your payslip', details: error.message });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id/payslips
//
// Every payable employee's payslip in ONE document, one per page, for printing and handing out.
//
// Blocked and excluded lines are left out rather than printed as zeros — the same rule as the
// single payslip. The count of what was skipped goes back in a response header so the screen can
// say it out loud; the screen also knows the blocked count already and warns before the click.
// ---------------------------------------------------------------------------------------------
export const getRunPayslips = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const run = await prisma.payrollRun.findUnique({
            where: { id },
            select: { period: true, runNumber: true, attendanceFetchedAt: true },
        });
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        if (!run.attendanceFetchedAt) {
            return res.status(400).json({ error: 'Compute this period before printing its payslips.' });
        }

        const [lines, skipped] = await Promise.all([
            prisma.payrollLine.findMany({
                where: { runId: id, status: 'OK' },
                include: LINE_INCLUDE,
                // Printed in the order they will be handed out: by department, then by name.
                orderBy: [{ departmentName: 'asc' }, { fullName: 'asc' }],
            }),
            prisma.payrollLine.count({ where: { runId: id, status: { not: 'OK' } } }),
        ]);

        if (lines.length === 0) {
            return res.status(400).json({
                error: 'No employee in this period can be paid yet, so there is nothing to print.',
                skipped,
            });
        }

        const buffer = generatePayslipBookDocx(lines as unknown as PayslipLine[], run.period);

        res.locals.auditDetails = `${lines.length} payslip(s) for ${run.period} (${skipped} not payable)`;
        res.setHeader('X-Payslips-Included', String(lines.length));
        res.setHeader('X-Payslips-Skipped', String(skipped));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Payslips_${run.period}_${run.runNumber}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating the payslip book:', error);
        res.status(500).json({ error: 'Failed to generate the payslips', details: error.message });
    }
};
