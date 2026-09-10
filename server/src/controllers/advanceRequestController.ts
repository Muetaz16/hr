// Self-service salary advance requests — the screen that replaces the Google Form.
//
// The form asked for eight things. Six of them the system already holds (staff ID, name, position,
// e-mail, service provider, currency) and are no longer typed: retyping a staff ID is how a request
// ends up attached to the wrong person. What is actually asked for is what only the employee knows:
// how much, over how long, and which number to reach them on.
//
// The two request types are genuinely different documents, not one form with a hidden field:
//
//   RESDANT / DIRCT NONE RESDANT — pick one, two or three months of BASIC salary (never a typed
//     figure), repaid over 1–12 instalments. The basic comes from the salary structure, so the
//     amount is derived and cannot be inflated.
//
//   NONE RESDANT (through a service provider) — a typed amount in the employee's own currency,
//     recovered in full from ONE named salary month. No instalments; the provider is invoiced.
//
// Filing a request moves no money and creates no instalments. It lands as PENDING.
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { round2 } from '../utils/payrollEngine';
import { isValidPeriod, currentPeriod, periodLabel, periodForDate } from '../utils/payrollPeriod';
import { currencyOf } from './payrollRunController';
import { advanceKindFor, PROVIDER_RESIDENCY as PROVIDER_RESIDENCY_VALUE } from '../utils/advanceKind';

interface AuthRequest extends Request {
    user?: { id: string; email?: string; role: string; fullName?: string };
}

/** The preset multiples the old form offered. A typed figure is deliberately not accepted. */
export const BASIC_SALARY_MULTIPLES = [1, 2, 3];
const MAX_INSTALMENTS = 12;

/**
 * An advance of N months of basic pay cannot be repaid in fewer than N months: the instalment
 * would exceed the salary it is deducted from, and the line would land NEGATIVE_NET. So the floor
 * on the repayment period is the multiple itself — three basics repay over three months at minimum.
 *
 * Even at the floor the instalment equals a whole basic salary, which leaves the employee only
 * their allowances. That is the company's call to approve, not the form's to prevent — but paying
 * back more per month than a basic salary is arithmetically impossible, so that is refused here.
 */
export const minInstalmentsFor = (basicSalaryMonths: number): number =>
    Math.max(1, Math.min(MAX_INSTALMENTS, Math.floor(basicSalaryMonths)));

// Re-exported from the shared rule rather than declared again — this file used to own the
// constant, and a second copy is how the label and the procedure drift apart.
const PROVIDER_RESIDENCY = PROVIDER_RESIDENCY_VALUE;

const ADVANCE_SELECT = {
    id: true, requestNumber: true, type: true, currency: true, principal: true,
    instalmentCount: true, firstDeductionPeriod: true, outstandingAmount: true,
    basicSalaryMonths: true, basicSalarySnapshot: true,
    residencyType: true, serviceProviderName: true,
    // Sent so the employee's screen can show WHY withdrawing is closed, rather than offering a
    // button that fails.
    providerFormRef: true, providerFormIssuedAt: true,
    whatsappNumber: true, contactEmail: true, reason: true,
    status: true, approvedAt: true, rejectedAt: true, rejectionReason: true,
    documentName: true, createdAt: true, requestSource: true, requestedByName: true,
    instalments: { orderBy: { sequence: 'asc' as const }, select: { id: true, sequence: true, period: true, amount: true, status: true } },
} as const;

const nextRequestNumber = async (): Promise<string> => {
    const count = await prisma.employeeAdvance.count();
    return `IPH-CCHR-FRM-ADVNC-${String(count + 1).padStart(3, '0')}`;
};

/** The employee behind the signed-in user; self-heals the link by e-mail the way /employees/me does. */
const resolveSelfEmployee = async (user: { id: string; email?: string }) => {
    const direct = await prisma.employee.findUnique({
        where: { userId: user.id },
        include: { serviceProvider: { select: { id: true, name: true, nameArabic: true } } },
    });
    if (direct) return direct;
    if (!user.email) return null;
    const byEmail = await prisma.employee.findFirst({ where: { email: user.email } });
    if (!byEmail) return null;
    return prisma.employee.update({
        where: { id: byEmail.id },
        data: { userId: user.id },
        include: { serviceProvider: { select: { id: true, name: true, nameArabic: true } } },
    });
};

/** Contractual monthly basic from the rate card — NOT last month's pay, which moves with hours. */
export const monthlyBasicFor = async (emp: { jobCategory: string | null; jobGrade: string | null; salaryStructureType: string | null }) => {
    if (!emp.jobCategory || !emp.jobGrade || !emp.salaryStructureType) return null;
    const row = await prisma.salaryStructure.findUnique({
        where: {
            jobCategory_jobGrade_structureLevel: {
                jobCategory: emp.jobCategory, jobGrade: emp.jobGrade, structureLevel: emp.salaryStructureType,
            },
        },
        select: { monthlyRate: true, hourlyRate: true },
    });
    return row ? round2(row.monthlyRate) : null;
};

/** The payroll month a deduction can first land in — the one currently being worked on. */
const nextDeductionPeriod = () => currentPeriod();

/**
 * The LAST payroll month anything can be deducted from: the financial month the contract ends in.
 *
 * Money can only come off a salary that is going to be paid. A deduction scheduled past the end of
 * the contract lands in a month with no payroll for this person and is never collected.
 *
 * Used by the ADVANCE path only. Loans are left alone by agreement until their rules arrive, so
 * nothing here bounds a repayment plan — see [[project_payroll_section]] for what is parked.
 *
 * periodForDate handles the 25th boundary, so a contract ending on the 28th belongs to the NEXT
 * month's payroll. That month is still worked and still paid, so it still counts.
 *
 * Null when the contract has no end date — which is most of the roster (14 of 97 active employees
 * carry one today). No end date means no last month, so nothing is capped rather than guessed.
 */
const lastDeductiblePeriod = (emp: { contractEndDate: Date | null }): string | null =>
    (emp.contractEndDate ? periodForDate(new Date(emp.contractEndDate)) : null);

// ---------------------------------------------------------------------------------------------
// GET /api/advance-requests/me/context
//
// Everything the form needs to render itself: who you are, which of the two forms you get, and —
// for the preset path — the three amounts you may choose from. Returning the amounts from the
// server rather than computing them in the browser keeps one definition of "one basic salary".
// ---------------------------------------------------------------------------------------------
export const getMyAdvanceContext = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
        const emp = await resolveSelfEmployee(req.user);
        if (!emp) {
            return res.status(404).json({ error: 'Your user account is not linked to an employee record. Contact Human Resources.' });
        }

        const viaProvider = emp.contractType === PROVIDER_RESIDENCY;
        let currency: string | null = null;
        try { currency = currencyOf(emp.salaryStructureType); } catch { currency = null; }

        // Resolved for provider employees too, now that it is their ceiling: an advance may not be
        // larger than one month's salary. It used to be skipped for them because they type a free
        // amount and nothing bounded it.
        const monthlyBasic = await monthlyBasicFor(emp);

        // An ADVANCE is recovered from one named salary month, and that month cannot be past the
        // end of the contract — there would be no payroll to take it from. Loans are deliberately
        // left alone: their rules are the user's to define, and nothing here touches them.
        const lastPeriod = lastDeductiblePeriod(emp);

        // An open request is one still being decided or still being repaid. A second advance on top
        // of an unpaid one is a decision for payroll, not something the form should quietly allow.
        const open = await prisma.employeeAdvance.count({
            where: { employeeId: emp.id, status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
        });

        res.json({
            employee: {
                id: emp.id,
                staffId: emp.staffId,
                fullName: emp.fullName,
                fullNameArabic: emp.fullNameArabic,
                position: emp.position,
                email: emp.email,
                personalPhone: emp.personalPhone,
                departmentId: emp.departmentId,
            },
            residencyType: emp.contractType,
            viaProvider,
            serviceProvider: emp.serviceProvider ? { id: emp.serviceProvider.id, name: emp.serviceProvider.name, nameArabic: emp.serviceProvider.nameArabic } : null,
            currency,
            monthlyBasic,
            // The most a provider employee may ask for: one month's salary, recovered in one go.
            // Sent so the form can show and enforce the same number the server checks.
            maxAdvance: viaProvider ? monthlyBasic : null,
            // Empty for provider employees (they type an amount) and for anyone whose rate cannot be
            // resolved — the screen says why rather than offering a broken dropdown.
            options: monthlyBasic
                ? BASIC_SALARY_MULTIPLES.map(m => ({
                    months: m,
                    amount: round2(monthlyBasic * m),
                    // Shipped with each option so the picker cannot disagree with the validator.
                    minInstalments: minInstalmentsFor(m),
                    maxInstalmentAmount: round2((monthlyBasic * m) / minInstalmentsFor(m)),
                }))
                : [],
            maxInstalments: MAX_INSTALMENTS,
            // The contract end, and the last payroll month it can still be deducted from. Null for
            // an open-ended contract — most of the roster — where nothing is capped.
            contractEndDate: emp.contractEndDate,
            lastDeductionPeriod: lastPeriod,
            lastDeductionPeriodLabel: lastPeriod ? periodLabel(lastPeriod) : null,
            defaultPeriod: nextDeductionPeriod(),
            defaultPeriodLabel: periodLabel(nextDeductionPeriod()),
            openRequests: open,
            // Why the form cannot be used, if it cannot. Checked again on submit.
            // A provider employee with no resolvable salary now has no ceiling either, so the form
            // cannot be used until payroll fixes the rate — the same bar the other path already had.
            blockedReason: monthlyBasic
                ? (currency ? null : 'NO_CURRENCY')
                : 'NO_BASIC_SALARY',
        });
    } catch (error) {
        console.error('Error building advance request context:', error);
        res.status(500).json({ error: 'Failed to load your advance request form' });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/advance-requests/me — the employee's own history and repayment schedule.
// ---------------------------------------------------------------------------------------------
export const listMyAdvances = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
        const emp = await resolveSelfEmployee(req.user);
        if (!emp) return res.json([]);

        res.json(await prisma.employeeAdvance.findMany({
            where: { employeeId: emp.id },
            select: ADVANCE_SELECT,
            orderBy: { createdAt: 'desc' },
        }));
    } catch (error) {
        console.error('Error listing own advances:', error);
        res.status(500).json({ error: 'Failed to load your advance requests' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/advance-requests/me
//
// Body, preset path:   { basicSalaryMonths: 1|2|3, instalmentCount: 1..12, whatsappNumber, reason? }
// Body, provider path: { amount, salaryMonth: 'YYYY-MM', whatsappNumber, reason? }
//
// Every identity, currency and amount value is re-derived here from the employee record. Nothing
// the browser sends about who the employee is or what they earn is trusted.
// ---------------------------------------------------------------------------------------------
export const createMyAdvanceRequest = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
        const emp = await resolveSelfEmployee(req.user);
        if (!emp) {
            return res.status(404).json({ error: 'Your user account is not linked to an employee record. Contact Human Resources.' });
        }

        const { whatsappNumber, reason } = req.body || {};
        const whatsapp = String(whatsappNumber || '').trim();
        if (!whatsapp) return res.status(400).json({ error: 'A WhatsApp number is required.' });

        const open = await prisma.employeeAdvance.findFirst({
            where: { employeeId: emp.id, status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
            select: { requestNumber: true, status: true },
        });
        if (open) {
            return res.status(409).json({
                error: `You already have an advance in progress (${open.requestNumber}, ${open.status.toLowerCase()}). It has to be settled or cancelled before a new one can be requested.`,
            });
        }

        const viaProvider = emp.contractType === PROVIDER_RESIDENCY;
        let currency: string;
        try { currency = currencyOf(emp.salaryStructureType); }
        catch {
            return res.status(400).json({ error: 'Your salary structure is not set, so the currency of an advance cannot be determined. Contact Human Resources.' });
        }

        let principal: number;
        let instalmentCount: number;
        let firstPeriod: string;
        let basicSalaryMonths: number | null = null;
        let basicSalarySnapshot: number | null = null;

        if (viaProvider) {
            // Typed amount, one named salary month, recovered in full.
            const amount = Number(req.body?.amount);
            if (!isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Enter the amount you are requesting.' });

            // An advance is taken back out of ONE salary, so anything above a month's salary could
            // not be recovered as agreed — it would leave a negative net or an unpaid remainder.
            const ceiling = await monthlyBasicFor(emp);
            if (!ceiling) {
                return res.status(400).json({ error: 'Your salary cannot be worked out from your job category, grade and salary structure, so the most you may request cannot be determined. Contact Human Resources.' });
            }
            if (round2(amount) > ceiling) {
                return res.status(400).json({
                    error: `An advance cannot be more than one month's salary (${ceiling} ${currency}). It is recovered from a single salary month.`,
                    maxAdvance: ceiling,
                });
            }

            const month = String(req.body?.salaryMonth || '');
            if (!isValidPeriod(month)) return res.status(400).json({ error: 'Choose the salary month this amount is taken from.' });
            const contractLast = lastDeductiblePeriod(emp);
            if (contractLast && month > contractLast) {
                return res.status(400).json({
                    error: `Your contract ends before that month, so nothing could be deducted from it. The last salary it can come out of is ${periodLabel(contractLast)}.`,
                    lastDeductionPeriod: contractLast,
                });
            }
            principal = round2(amount);
            instalmentCount = 1;
            firstPeriod = month;
        } else {
            // Preset multiple of the contractual basic. The figure is derived here, never accepted.
            const months = Number(req.body?.basicSalaryMonths);
            if (!BASIC_SALARY_MULTIPLES.includes(months)) {
                return res.status(400).json({ error: `Choose one, two or three months of basic salary.` });
            }
            const monthlyBasic = await monthlyBasicFor(emp);
            if (!monthlyBasic) {
                return res.status(400).json({ error: 'Your basic salary cannot be worked out from your job category, grade and salary structure. Contact Human Resources.' });
            }
            const minInstalments = minInstalmentsFor(months);
            const count = Number(req.body?.instalmentCount);
            if (!Number.isInteger(count) || count < minInstalments || count > MAX_INSTALMENTS) {
                return res.status(400).json({
                    error: months === 1
                        ? `Choose a repayment period between 1 and ${MAX_INSTALMENTS} months.`
                        : `${months} months of basic salary cannot be repaid in fewer than ${minInstalments} months — the instalment would be larger than the salary it comes out of. Choose between ${minInstalments} and ${MAX_INSTALMENTS} months.`,
                    minInstalments,
                });
            }
            principal = round2(monthlyBasic * months);
            instalmentCount = count;
            firstPeriod = nextDeductionPeriod();
            basicSalaryMonths = months;
            basicSalarySnapshot = monthlyBasic;
        }

        const advance = await prisma.employeeAdvance.create({
            data: {
                requestNumber: await nextRequestNumber(),
                employeeId: emp.id,
                // Loan or advance is decided by the contract type, not by anything asked here.
                type: advanceKindFor(emp.contractType),
                currency,
                principal,
                instalmentCount,
                firstDeductionPeriod: firstPeriod,
                outstandingAmount: principal,
                reason: reason ? String(reason).trim().slice(0, 1000) : null,
                status: 'PENDING',

                requestSource: 'SELF',
                requestedByUserId: req.user.id,
                requestedByName: req.user.fullName || emp.fullName,
                contactEmail: emp.email,
                whatsappNumber: whatsapp,
                basicSalaryMonths,
                basicSalarySnapshot,
                residencyType: emp.contractType,
                serviceProviderId: emp.serviceProviderId,
                serviceProviderName: emp.serviceProvider?.name ?? null,
                createdByName: req.user.fullName || emp.fullName,
            },
            select: ADVANCE_SELECT,
        });

        res.locals.auditDetails = `${advance.requestNumber} — ${currency} ${principal} over ${instalmentCount} instalment(s)`;
        res.status(201).json(advance);
    } catch (error) {
        console.error('Error creating self-service advance request:', error);
        res.status(500).json({ error: 'Failed to submit your advance request' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/advance-requests/me/:id/withdraw — the employee can take back their own request, but
// only while nobody has acted on it.
// ---------------------------------------------------------------------------------------------
export const withdrawMyAdvanceRequest = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
        const emp = await resolveSelfEmployee(req.user);
        if (!emp) return res.status(404).json({ error: 'No employee record linked to your account.' });

        const found = await prisma.employeeAdvance.findUnique({ where: { id: req.params.id } });
        if (!found || found.employeeId !== emp.id) return res.status(404).json({ error: 'Request not found.' });
        if (found.status !== 'PENDING') {
            return res.status(409).json({ error: 'This request has already been decided and can no longer be withdrawn.' });
        }
        // Once the form carrying this name has gone to the provider it can no longer be taken back
        // here. The provider is being asked to sign a specific list and a specific total; a name
        // quietly disappearing from our side after that leaves the paper they signed describing
        // something that never happened. Payroll can still cancel it — with a record of who did.
        if (found.providerFormRef) {
            return res.status(409).json({
                error: 'Your request is already on the Cash Advance Request form sent to your service provider, so it can no longer be withdrawn here. Contact Payroll if it has to be cancelled.',
                providerFormRef: found.providerFormRef,
            });
        }

        res.locals.auditDetails = `${found.requestNumber} — ${found.currency} ${found.principal}`;
        res.json(await prisma.employeeAdvance.update({
            where: { id: found.id },
            data: { status: 'CANCELLED', notes: [found.notes, 'Withdrawn by the employee.'].filter(Boolean).join('\n') },
            select: ADVANCE_SELECT,
        }));
    } catch (error) {
        console.error('Error withdrawing advance request:', error);
        res.status(500).json({ error: 'Failed to withdraw the request' });
    }
};
