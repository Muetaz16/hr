// Review and close a payroll period.
//
// Three steps of one real-world procedure, in order:
//   1. GET /:id/master-data   — every line, unpaginated, so the client can build the MASTER DATA
//                               review workbook handed to Internal Audit and the Finance Division.
//   2. GET /:id/approval-form — the "Salary Approval" memo, pre-filled from the run's own totals,
//                               printed and signed by HR / Finance / Internal Audit / the
//                               Administrative Director.
//   3. POST /:id/close        — the signed memo comes back as a file, and only then does the period
//                               freeze. No document, no close (standing rule: nothing that moves
//                               money completes on a single click).
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import PizZip from 'pizzip';
import { fillTemplate } from '../utils/docxFormHelpers';
import { periodLabel, periodMonthName, periodMonthNameArabic, periodYear } from '../utils/payrollPeriod';

interface AuthRequest extends Request {
    user?: { userId: string; fullName?: string; role?: string };
}

const TEMPLATE = 'Salary Approval .docx';

const fmtMoney = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// The memo has exactly five amount rows. Anything the run totals that does not land in one of them
// would be silently left off a signed document, so the slots are declared once and the leftovers
// are reported back rather than dropped.
//
// Residents and directly-contracted non-residents are paid their NET. Service providers are
// invoiced net + fee, which is why their two rows use employerCostTotal — the fee is IPH's cost and
// never appears on an employee payslip.
const FORM_SLOTS = [
    { label: 'Amount for cash distribution for residents in LYD', residency: 'RESDANT', currency: 'LYD', field: 'netTotal' },
    { label: 'Amount for cash distribution for direct contract non residents in Euro', residency: 'DIRCT NONE RESDANT', currency: 'EUR', field: 'netTotal' },
    { label: 'Amount for cash distribution for direct contract non residents in USD', residency: 'DIRCT NONE RESDANT', currency: 'USD', field: 'netTotal' },
    { label: 'Amount for bank transaction Service providers in EUR', residency: 'NONE RESDANT', currency: 'EUR', field: 'employerCostTotal' },
    { label: 'Amount for bank transaction Service providers in USD', residency: 'NONE RESDANT', currency: 'USD', field: 'employerCostTotal' },
] as const;

/** Currency x residency combinations carrying money that the memo has no printed row for. */
export const uncoveredTotals = (totals: { currency: string; residencyType: string; netTotal: number; employerCostTotal: number }[]) =>
    totals
        .filter(t => t.residencyType !== 'ALL' && (t.netTotal !== 0 || t.employerCostTotal !== 0))
        .filter(t => !FORM_SLOTS.some(s => s.residency === t.residencyType && s.currency === t.currency))
        .map(t => ({ residencyType: t.residencyType, currency: t.currency, netTotal: t.netTotal }));

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id/master-data
//
// Deliberately unpaginated: the review sheet is one row per employee and a partial sheet is worse
// than no sheet. The workbook itself is built on the client, where the xlsx dependency already
// lives — the server has none and adding one for a single export would be a poor trade.
// ---------------------------------------------------------------------------------------------
export const getPayrollMasterData = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const run = await prisma.payrollRun.findUnique({
            where: { id },
            include: { totals: { orderBy: [{ currency: 'asc' }, { residencyType: 'asc' }] } },
        });
        if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

        const lines = await prisma.payrollLine.findMany({
            where: { runId: id },
            include: { items: { orderBy: { createdAt: 'asc' } } },
            // Blocked first, so whoever reviews the sheet meets the unpayable rows before the rest.
            orderBy: [{ status: 'desc' }, { fullName: 'asc' }],
        });

        res.json({ run, lines });
    } catch (error: any) {
        console.error('Error building payroll master data:', error);
        res.status(500).json({ error: 'Failed to build the payroll review sheet' });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id/approval-form — the Salary Approval memo, filled from the run's totals.
// ---------------------------------------------------------------------------------------------
export const generateSalaryApprovalForm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const run = await prisma.payrollRun.findUnique({
            where: { id },
            include: { totals: true },
        });
        if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
        if (!run.attendanceFetchedAt) {
            return res.status(400).json({ error: 'Compute this period before requesting the approval form — the memo prints its totals.' });
        }

        const totalFor = (residency: string, currency: string, field: 'netTotal' | 'employerCostTotal'): number => {
            const row = run.totals.find(t => t.residencyType === residency && t.currency === currency);
            return row ? (row[field] as number) : 0;
        };

        const fields = [
            { label: 'Date:', value: fmtDate(new Date()) },
            { label: 'Reference No:', value: run.runNumber },
            { label: 'Salary range dates covered:', value: `${fmtDate(run.periodStart)} - ${fmtDate(run.periodEnd)}` },
            ...FORM_SLOTS.map(slot => ({
                label: slot.label,
                // A slot with no employees prints "0.00" rather than an empty box: a blank amount on
                // a signed memo reads as an oversight, an explicit zero reads as a decision.
                value: fmtMoney(totalFor(slot.residency, slot.currency, slot.field)),
            })),
        ];

        let buffer = fillTemplate(TEMPLATE, fields);

        // The subject line carries "(month name) 2026" inline in its own run — a label/value cell
        // fill cannot reach it, so the placeholder runs are swapped directly.
        buffer = replaceSubjectMonth(buffer, run.period);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Salary_Approval_${run.period}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating salary approval form:', error);
        res.status(500).json({ error: 'Failed to generate the salary approval form', details: error.message });
    }
};

/** Swaps the template's "(month name) 2026" / "(اسم الشهر) 2026" placeholders for the real period. */
const replaceSubjectMonth = (buffer: Buffer, period: string): Buffer => {
    const zip = new PizZip(buffer);
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText() as string;
    const year = String(periodYear(period));

    xml = xml.replace(/>\(month name\)</g, `>${periodMonthName(period)}<`);
    xml = xml.replace(/>\(اسم الشهر\)</g, `>${periodMonthNameArabic(period)}<`);
    // The year is hard-typed in the template. Only touch it when it is actually wrong, so a
    // 2026 run comes out byte-identical to the form Finance already knows.
    if (year !== '2026') {
        xml = xml.replace(/> 2026 \(IPH\)</g, `> ${year} (IPH)<`);
        xml = xml.replace(/> 2026 </g, `> ${year} <`);
    }

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-runs/:id/documents — stores the signed memo and returns its URL. Payroll has
// its own upload endpoint because /employees/upload-document is gated on employee-registration
// permissions, which a payroll specialist has no reason to hold.
// ---------------------------------------------------------------------------------------------
export const uploadPayrollDocument = async (req: Request, res: Response) => {
    try {
        const file = (req as any).file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({ url: `/uploads/documents/${file.filename}`, name: file.originalname });
    } catch (error) {
        console.error('Error uploading payroll document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-runs/:id/close — body { documentUrl, documentName?, note? }
//
// Closing is the point of no return: it sets approvedAt, which the database trigger reads to refuse
// every later UPDATE or DELETE on the run's lines, items and totals. There is deliberately no
// re-open — a mistake is corrected by cancelling the run and computing a new revision, so the
// superseded numbers stay on record.
// ---------------------------------------------------------------------------------------------
export const closePayrollRun = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName, note, acknowledgeBlocked } = req.body as {
            documentUrl?: string; documentName?: string; note?: string; acknowledgeBlocked?: boolean;
        };

        const run = await prisma.payrollRun.findUnique({
            where: { id },
            include: { _count: { select: { lines: true } } },
        });
        if (!run) return res.status(404).json({ error: 'Payroll run not found.' });

        if (run.status === 'CANCELLED') return res.status(400).json({ error: 'This period was cancelled and cannot be closed.' });
        if (run.approvedAt) return res.status(400).json({ error: 'This period is already closed.' });
        if (!run.attendanceFetchedAt || run._count.lines === 0) {
            return res.status(400).json({ error: 'Compute this period before closing it.' });
        }
        if (!documentUrl) {
            return res.status(400).json({ error: 'Attach the signed Salary Approval form before closing this period.' });
        }

        // A blocked line is worth zero because one of its inputs is missing. That is a warning, not
        // a wall: while employee records are still being completed, most of a period can be blocked
        // and payroll must still be able to pay the people whose data IS complete.
        //
        // What it is not allowed to be is silent. Closing with blocked lines needs an explicit
        // acknowledgement, and the count is written into the run's notes, so the record shows the
        // period was closed knowing those employees would be paid nothing.
        const blocked = await prisma.payrollLine.count({ where: { runId: id, status: 'BLOCKED' } });
        if (blocked > 0 && acknowledgeBlocked !== true) {
            return res.status(400).json({
                error: `${blocked} line(s) are blocked and will be paid nothing. Confirm you want to close the period anyway.`,
                blockedCount: blocked,
                needsAcknowledgement: true,
            });
        }

        // What this run actually charged and paid out. Read before the freeze, because after
        // approvedAt is set the database trigger refuses to touch these rows.
        const items = await prisma.payrollLineItem.findMany({
            where: { line: { runId: id, status: 'OK' } },
            select: { advanceInstalmentId: true, rewardCaseId: true, sourceType: true, sourceId: true, amount: true, category: true },
        });
        const instalmentIds = items.map(i => i.advanceInstalmentId).filter((x): x is string => !!x);
        const rewardCaseIds = items.map(i => i.rewardCaseId).filter((x): x is string => !!x);
        const deductionIds = items.filter(i => i.sourceType === 'DEDUCTION' && i.sourceId).map(i => i.sourceId as string);

        const now = new Date();
        const updated = await prisma.$transaction(async (tx) => {
        const runRow = await tx.payrollRun.update({
            where: { id },
            data: {
                status: 'APPROVED',
                stage: 'COMPLETED',
                // Both freezes land together here: this system's approval happens on the signed
                // paper memo, so there is no in-system review window to lock separately.
                lockedAt: run.lockedAt ?? now,
                approvedAt: now,
                approvalDocumentUrl: documentUrl,
                approvalDocumentName: documentName || null,
                approvedByName: req.user?.fullName || null,
                notes: [
                    run.notes,
                    note,
                    blocked > 0 ? `Closed with ${blocked} blocked line(s), acknowledged as unpaid.` : null,
                ].filter(Boolean).join('\n') || null,
            },
            include: { totals: { orderBy: [{ currency: 'asc' }, { residencyType: 'asc' }] } },
        });

        // --- consume what the period charged -------------------------------------------------
        //
        // This happens at close and nowhere earlier, which is exactly what makes Compute safe to
        // press any number of times: a recompute rebuilds the charge rows from the registers, and
        // the registers are only marked spent once the period is signed off.
        if (instalmentIds.length) {
            await tx.employeeAdvanceInstalment.updateMany({
                where: { id: { in: instalmentIds }, status: 'SCHEDULED' },
                data: { status: 'DEDUCTED', deductedInRunId: id, deductedAt: now },
            });

            // Draw each affected advance's outstanding balance down by what was actually taken, and
            // settle it when nothing is left. Recomputed from the instalment rows rather than by
            // subtracting, so a deferred or waived instalment can never leave the balance wrong.
            const touched = await tx.employeeAdvanceInstalment.findMany({
                where: { id: { in: instalmentIds } },
                select: { advanceId: true },
            });
            for (const advanceId of new Set(touched.map(t => t.advanceId))) {
                const remaining = await tx.employeeAdvanceInstalment.aggregate({
                    where: { advanceId, status: { in: ['SCHEDULED', 'DEFERRED'] } },
                    _sum: { amount: true },
                });
                const outstanding = Number(remaining._sum.amount || 0);
                await tx.employeeAdvance.update({
                    where: { id: advanceId },
                    data: {
                        outstandingAmount: outstanding,
                        status: outstanding <= 0 ? 'SETTLED' : 'ACTIVE',
                        settledAt: outstanding <= 0 ? now : null,
                    },
                });
            }
        }

        if (deductionIds.length) {
            // Recurring deductions keep running; only one-off ones are spent by a single period.
            await tx.employeeDeduction.updateMany({
                where: { id: { in: deductionIds }, status: 'APPROVED', recurring: false },
                data: { status: 'APPLIED', appliedInRunId: id },
            });
        }

        if (rewardCaseIds.length) {
            await tx.rewardCase.updateMany({
                where: { id: { in: rewardCaseIds }, paidInRunId: null },
                data: { paidInRunId: id, paidAt: now },
            });
        }

        return runRow;
        });

        res.locals.auditDetails =
            `closed payroll period ${periodLabel(run.period)} (${run.runNumber}) — `
            + `${instalmentIds.length} instalment(s), ${deductionIds.length} deduction(s), ${rewardCaseIds.length} bonus(es) consumed`;
        res.json(updated);
    } catch (error: any) {
        console.error('Error closing payroll run:', error);
        res.status(500).json({ error: 'Failed to close the payroll period' });
    }
};
