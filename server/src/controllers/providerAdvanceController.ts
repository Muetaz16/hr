// Cash advances for employees hired through a service provider.
//
// These cannot be granted by IPH alone — the provider is the employer of record and has to consent
// in writing. The real-world round, in order:
//
//   1. Provider employees file their own requests           (advanceRequestController)
//   2. Payroll prints ONE Cash Advance Request form per provider, per currency, listing every
//      requester on it, and sends it to that provider
//   3. The provider signs; payroll uploads the signed form  -> APPROVED
//   4. The cash is handed over                              -> ACTIVE, and only now is the
//                                                              deduction scheduled
//   5. Payroll deducts it from the named salary month        (payrollCharges / period close)
//
// Why the instalment is created at step 4 and not step 3: the provider's signature is consent, not
// payment. If the money is never collected, nothing should ever be deducted — and a schedule that
// exists before the cash does is exactly how an employee gets charged for an advance they never
// received.
//
// One form covers one provider AND one currency, because the form totals a single sum and there is
// no exchange rate in this system to combine two.
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { round2 } from '../utils/payrollEngine';
import { currentPeriod, nextPeriod, periodLabel } from '../utils/payrollPeriod';
import { generateCashAdvanceDocx } from '../utils/cashAdvanceForm';
import { ACTIVE_ENROLLMENT_FILTER } from '../utils/employeeStatus';

interface AuthRequest extends Request {
    user?: { id: string; role: string; fullName?: string };
}

const PROVIDER_RESIDENCY = 'NONE RESDANT';

/** Requests waiting on the provider, or already signed off and waiting to be handed over. */
const OPEN_STATUSES = ['PENDING', 'APPROVED'];

const ADVANCE_SELECT = {
    id: true, requestNumber: true, currency: true, principal: true,
    firstDeductionPeriod: true, status: true, reason: true,
    whatsappNumber: true, contactEmail: true, requestSource: true,
    serviceProviderId: true, serviceProviderName: true,
    providerFormRef: true, providerFormIssuedAt: true,
    documentUrl: true, documentName: true,
    approvedAt: true, approvedByName: true, disbursedAt: true,
    createdAt: true,
    employee: { select: { id: true, staffId: true, fullName: true, fullNameArabic: true, passportNumber: true, position: true } },
} as const;

/**
 * The Head of HR whose name is printed in the form's signature block.
 *
 * Resolved from the approve_hr_manager permission — the same designation the leave chain uses —
 * with two deliberate narrowings, because this name goes onto a document that leaves the company
 * and is signed:
 *
 *   · NOT the blanket SUPER_ADMIN inclusion resolveUsersWithPermission applies. The system
 *     administrator is not the Head of HR.
 *   · Only holders who are an ACTIVE EMPLOYEE. A login account with no employee record, or one
 *     belonging to somebody who has left, is not a person who signs anything — and leftover
 *     accounts keep their functional hats long after the human stops using them.
 *
 * Still returns null unless exactly one person survives both, so a genuinely ambiguous
 * configuration leaves the template's own placeholder for the signer to fill in rather than
 * printing a guess.
 */
export const resolveHrManagerName = async (): Promise<string | null> => {
    const hats = await prisma.functionalHat.findMany({
        where: { permissions: { has: 'approve_hr_manager' } },
        select: { id: true },
    });
    const hatIds = hats.map(h => h.id);
    const holders = await prisma.user.findMany({
        where: {
            OR: [
                { permissions: { has: 'approve_hr_manager' } },
                ...(hatIds.length ? [{ functionalHatIds: { hasSome: hatIds } }] : []),
            ],
            employee: { is: { enrollmentStatus: ACTIVE_ENROLLMENT_FILTER } },
        },
        select: { fullName: true, employee: { select: { fullName: true } } },
        orderBy: { fullName: 'asc' },
    });
    if (holders.length !== 1) return null;
    // The employee record's name is the one HR maintains; the login's fullName can be a nickname.
    return holders[0].employee?.fullName || holders[0].fullName || null;
};

/**
 * The next form reference: the HIGHEST one already used, plus one.
 *
 * It used to count the rows carrying a reference, which is wrong twice over. A round covering three
 * employees advanced the counter by three, so references skipped numbers — cosmetic. But the count
 * also FALLS when a stamped row is removed, and the next form then reuses a reference that is still
 * on somebody else's round. Two different rounds sharing a reference merge back into one group,
 * which is precisely the mixing this separation exists to prevent, so the numbering is load-bearing
 * and not a formatting detail.
 *
 * Reading the maximum instead can never go backwards, whatever is deleted.
 */
const nextFormRef = async (): Promise<string> => {
    const used = await prisma.employeeAdvance.findMany({
        where: { providerFormRef: { not: null } },
        select: { providerFormRef: true },
        distinct: ['providerFormRef'],
    });
    const highest = used.reduce((max, r) => {
        const n = Number(/(\d+)$/.exec(String(r.providerFormRef))?.[1] ?? 0);
        return n > max ? n : max;
    }, 0);
    return `IPH-CCHR-FRM-CASHADV-${String(highest + 1).padStart(3, '0')}`;
};

/**
 * The earliest payroll month a NEW deduction can still land in.
 *
 * A request filed in September naming September is fine — until September is closed. After that the
 * instalment would sit in a frozen period and be deducted never. So the schedule is pushed past the
 * last closed period rather than honoured blindly.
 */
const firstOpenPeriod = async (preferred: string): Promise<string> => {
    const lastClosed = await prisma.payrollRun.findFirst({
        where: { status: { in: ['APPROVED', 'PAID'] } },
        orderBy: { period: 'desc' },
        select: { period: true },
    });
    const floor = lastClosed ? nextPeriod(lastClosed.period) : currentPeriod();
    return preferred > floor ? preferred : floor;
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-advances/provider-batches
//
// Every open provider request, grouped the way the paperwork is: ONE GROUP PER ROUND — provider,
// currency and form reference together — because that is exactly one piece of paper.
//
// It used to group on provider+currency alone, which put a round already away being signed and the
// requests that arrived after it into the same card. The screen then showed one form reference for
// the lot and offered a single Approve button, so approving the signed form also approved whoever
// had asked in the meantime, against a document that never listed them.
//
// The group with formRef === null is the one still collecting: the next form.
// ---------------------------------------------------------------------------------------------
export const listProviderBatches = async (_req: Request, res: Response) => {
    try {
        const advances = await prisma.employeeAdvance.findMany({
            where: {
                employee: { contractType: PROVIDER_RESIDENCY },
                status: { in: OPEN_STATUSES },
            },
            select: ADVANCE_SELECT,
            orderBy: { createdAt: 'asc' },
        });

        const groups = new Map<string, any>();
        for (const a of advances) {
            // An advance with no provider on it cannot be sent anywhere; it is surfaced under its
            // own group so it is fixed rather than quietly skipped.
            const providerId = a.serviceProviderId || 'UNASSIGNED';
            // The reference is part of the key. That is the whole separation: a sealed round and the
            // requests that arrived after it can never land in the same card again.
            const key = `${providerId}|${a.currency}|${a.providerFormRef ?? 'NEW'}`;
            let g = groups.get(key);
            if (!g) {
                g = {
                    key,
                    providerId: a.serviceProviderId,
                    providerName: a.serviceProviderName,
                    currency: a.currency,
                    total: 0,
                    pendingCount: 0,
                    approvedCount: 0,
                    formRef: a.providerFormRef,
                    formIssuedAt: a.providerFormIssuedAt,
                    signedDocumentUrl: null as string | null,
                    signedDocumentName: null as string | null,
                    advances: [] as any[],
                };
                groups.set(key, g);
            }
            g.total = round2(g.total + a.principal);
            if (a.status === 'PENDING') g.pendingCount += 1;
            else g.approvedCount += 1;
            if (a.documentUrl && !g.signedDocumentUrl) {
                g.signedDocumentUrl = a.documentUrl;
                g.signedDocumentName = a.documentName;
            }
            g.advances.push(a);
        }

        const batches = [...groups.values()].map(g => ({
            ...g,
            // Where this round has got to. Named rather than left for the screen to infer from
            // three counters, so both sides cannot disagree about what step is next.
            stage: !g.formRef
                ? 'COLLECTING'          // no form printed yet — still gathering requests
                : g.pendingCount > 0
                    ? 'AWAITING_PROVIDER' // printed and sent; the provider has not signed it back
                    : 'AWAITING_HANDOVER', // signed; the cash has not been recorded as handed over
        }));

        // Oldest round first, and the still-collecting group last: it is the only one with nothing
        // outstanding on somebody else's desk.
        const rank = (b: any) => (b.stage === 'AWAITING_HANDOVER' ? 0 : b.stage === 'AWAITING_PROVIDER' ? 1 : 2);
        batches.sort((x, y) => rank(x) - rank(y) || String(x.formRef || '').localeCompare(String(y.formRef || '')));

        // Returned alongside the groups so the screen can show whose name will be printed before
        // anything is sent, instead of that being discovered in the produced document.
        const hrManagerName = await resolveHrManagerName();
        res.json({ hrManagerName, batches });
    } catch (error) {
        console.error('Error listing provider advance batches:', error);
        res.status(500).json({ error: 'Failed to load the provider advance requests' });
    }
};

/**
 * A ROUND is the unit of this procedure, and its identity is the form reference.
 *
 * Requests do not arrive together. A form is printed for whoever has asked so far, sent to the
 * provider, and while it is away being signed more employees ask. Those late requests must not be
 * swept into the round already in flight: the provider signed a specific list of names and a
 * specific total, and approving somebody who is not on that paper approves money nobody authorised.
 *
 * So:
 *   providerFormRef IS NULL   not yet sent — the next round, still collecting
 *   providerFormRef = 'REF'   sealed at the moment that form was printed, and closed to newcomers
 *
 * Everything after printing — approving, recording the handover — is addressed to a REF, never to a
 * provider and currency, which is what let the two mix.
 */
const loadRound = async (providerId: string, currency: string, formRef: string | null, status: string | string[]) => {
    return prisma.employeeAdvance.findMany({
        where: {
            employee: { contractType: PROVIDER_RESIDENCY },
            status: Array.isArray(status) ? { in: status } : status,
            ...(currency ? { currency } : {}),
            serviceProviderId: providerId === 'UNASSIGNED' ? null : providerId,
            providerFormRef: formRef,
        },
        select: ADVANCE_SELECT,
        orderBy: { createdAt: 'asc' },
    });
};

/** The requests still collecting for the next form — those no form has been printed for yet. */
const loadUnsentGroup = (providerId: string, currency: string) =>
    loadRound(providerId, currency, null, 'PENDING');

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-advances/provider-batches/:providerId/form?currency=USD[&ref=REF]
//
// Without a ref: seals a NEW round from the requests no form has been printed for yet, and stamps
// each of them with the new reference. Anyone who asks after this moment belongs to the next round.
//
// With a ref: reprints that round exactly as it was sent — same reference, same names, same total,
// and no row is touched. Needed because the provider loses forms, and a reprint that quietly minted
// a new reference would leave the signed paper in their hands matching nothing.
// ---------------------------------------------------------------------------------------------
export const generateProviderForm = async (req: AuthRequest, res: Response) => {
    try {
        const { providerId } = req.params;
        const currency = String(req.query.currency || '').toUpperCase();
        if (!currency) return res.status(400).json({ error: 'Which currency? One form covers one currency.' });

        const reprintRef = req.query.ref ? String(req.query.ref) : null;

        const advances = reprintRef
            ? await loadRound(providerId, currency, reprintRef, OPEN_STATUSES)
            : await loadUnsentGroup(providerId, currency);
        if (advances.length === 0) {
            return res.status(400).json({
                error: reprintRef
                    ? `No open requests are on form ${reprintRef} for this provider and currency.`
                    : 'There are no new requests waiting for this provider in this currency. Requests already on a printed form belong to that form.',
            });
        }

        const provider = providerId === 'UNASSIGNED'
            ? null
            : await prisma.serviceProvider.findUnique({ where: { id: providerId }, select: { name: true } });

        // A reprint keeps the reference it was signed under; only a new round mints one.
        const ref = reprintRef ?? await nextFormRef();
        const now = new Date();

        const buffer = generateCashAdvanceDocx({
            date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            providerName: provider?.name || advances[0].serviceProviderName || '—',
            referenceNo: ref,
            currency,
            hrManagerName: await resolveHrManagerName(),
            lines: advances.map(a => ({
                staffId: a.employee?.staffId || '',
                fullName: a.employee?.fullName || '',
                // Printed so the provider can identify its own staff — a staff ID means nothing
                // to them, the passport does.
                passportNumber: a.employee?.passportNumber || '',
                amount: a.principal,
            })),
        });

        // A reprint changes nothing: the round was sealed when it was first printed.
        if (!reprintRef) {
            const ids = advances.map(a => a.id);
            await prisma.$transaction(async (tx) => {
                await tx.employeeAdvance.updateMany({
                    where: { id: { in: ids } },
                    data: { providerFormRef: ref, providerFormIssuedAt: now },
                });
                // Two clerks printing in the same instant would read the same maximum. If anything
                // outside this round now carries the reference, the two have collided — fail rather
                // than leave two rounds sharing one piece of paper's identity.
                const strays = await tx.employeeAdvance.count({
                    where: { providerFormRef: ref, id: { notIn: ids } },
                });
                if (strays > 0) throw new Error('FORM_REF_COLLISION');
            });
        }

        const safe = (provider?.name || 'provider').replace(/[^a-zA-Z0-9]+/g, '_');
        res.locals.auditDetails = `${ref} — ${advances.length} request(s) for ${provider?.name || 'unassigned'} in ${currency}`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Cash_Advance_${safe}_${currency}_${ref}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        if (error?.message === 'FORM_REF_COLLISION') {
            return res.status(409).json({ error: 'Another form was issued at the same moment. Nothing was changed — try again.' });
        }
        console.error('Error generating provider cash advance form:', error);
        res.status(500).json({ error: 'Failed to generate the cash advance form', details: error.message });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-advances/provider-batches/:providerId/approve
// Body { currency, documentUrl, documentName?, advanceIds?, note? }
//
// The provider has signed. Nothing is scheduled yet — see the note at the top of this file.
// `advanceIds` lets a provider decline part of a round: only the listed requests are approved and
// the rest stay PENDING for a later form.
// ---------------------------------------------------------------------------------------------
export const approveProviderBatch = async (req: AuthRequest, res: Response) => {
    try {
        const { providerId } = req.params;
        const { currency, documentUrl, documentName, advanceIds, note, formRef } = req.body || {};

        const cur = String(currency || '').toUpperCase();
        if (!cur) return res.status(400).json({ error: 'Which currency? One form covers one currency.' });
        if (!documentUrl) {
            return res.status(400).json({ error: "Attach the provider's signed Cash Advance Request form before approving." });
        }
        // The signed paper is a specific form. Approving has to name it, so only the people printed
        // on it are approved — not whoever has asked since it was sent.
        const ref = formRef ? String(formRef) : null;
        if (!ref) {
            return res.status(400).json({ error: 'Which form was signed? Print the form first — approval is recorded against its reference number.' });
        }

        const pending = await loadRound(providerId, cur, ref, 'PENDING');
        if (pending.length === 0) {
            return res.status(400).json({ error: `No requests are still awaiting the provider on form ${ref}. It may already have been approved.` });
        }

        const wanted = Array.isArray(advanceIds) && advanceIds.length
            ? pending.filter(a => advanceIds.includes(a.id))
            : pending;
        if (wanted.length === 0) {
            return res.status(400).json({ error: 'None of the selected requests are waiting for this provider.' });
        }

        const now = new Date();
        await prisma.employeeAdvance.updateMany({
            where: { id: { in: wanted.map(a => a.id) }, status: 'PENDING' },
            data: {
                status: 'APPROVED',
                approvedAt: now,
                approvedByName: req.user?.fullName || null,
                documentUrl: String(documentUrl),
                documentName: documentName ? String(documentName) : null,
                notes: note ? String(note).trim() : undefined,
            },
        });

        res.locals.auditDetails =
            `${ref} — ${wanted.length} provider advance(s) approved for ${wanted[0].serviceProviderName || 'unassigned'} in ${cur}`;
        res.json({
            approved: wanted.length,
            formRef: ref,
            // Said out loud because "approved" reads like "done" and it is not: nothing is
            // deducted until the cash is recorded as handed over.
            nextStep: 'DISBURSE',
        });
    } catch (error) {
        console.error('Error approving provider advance batch:', error);
        res.status(500).json({ error: 'Failed to approve the provider advances' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-advances/provider-batches/:providerId/disburse
// Body { currency, advanceIds?, note? }
//
// The cash has been handed over. THIS is what schedules the deduction.
// ---------------------------------------------------------------------------------------------
export const disburseProviderBatch = async (req: AuthRequest, res: Response) => {
    try {
        const { providerId } = req.params;
        const { currency, advanceIds, note, formRef } = req.body || {};
        const cur = String(currency || '').toUpperCase();
        if (!cur) return res.status(400).json({ error: 'Which currency?' });
        // The handover is of the cash for ONE signed form. Scoped the same way approval is, so a
        // second round signed later cannot be disbursed by a click meant for the first.
        const ref = formRef ? String(formRef) : null;
        if (!ref) {
            return res.status(400).json({ error: 'Which form is being handed over? The handover is recorded against a form reference.' });
        }

        const approved = await prisma.employeeAdvance.findMany({
            where: {
                employee: { contractType: PROVIDER_RESIDENCY },
                status: 'APPROVED',
                ...(cur ? { currency: cur } : {}),
                serviceProviderId: providerId === 'UNASSIGNED' ? null : providerId,
                providerFormRef: ref,
                ...(Array.isArray(advanceIds) && advanceIds.length ? { id: { in: advanceIds } } : {}),
            },
            select: { id: true, principal: true, firstDeductionPeriod: true, requestNumber: true, serviceProviderName: true },
        });
        if (approved.length === 0) {
            return res.status(400).json({ error: `No approved requests are waiting to be handed over on form ${ref}.` });
        }

        const now = new Date();
        const scheduled: { requestNumber: string; period: string; moved: boolean }[] = [];

        await prisma.$transaction(async (tx) => {
            for (const a of approved) {
                // A provider advance is recovered in full from one named salary month — no
                // instalments. If that month has already been closed the deduction is moved to the
                // first month still open, or it would be scheduled into a frozen period and lost.
                const period = await firstOpenPeriod(a.firstDeductionPeriod);
                scheduled.push({ requestNumber: a.requestNumber, period, moved: period !== a.firstDeductionPeriod });

                await tx.employeeAdvanceInstalment.create({
                    data: { advanceId: a.id, sequence: 1, period, amount: round2(a.principal), status: 'SCHEDULED' },
                });
                await tx.employeeAdvance.update({
                    where: { id: a.id },
                    data: {
                        status: 'ACTIVE',
                        disbursedAt: now,
                        outstandingAmount: round2(a.principal),
                        instalmentCount: 1,
                        firstDeductionPeriod: period,
                        notes: note ? String(note).trim() : undefined,
                    },
                });
            }
        });

        const moved = scheduled.filter(s => s.moved);
        res.locals.auditDetails =
            `${ref} — ${approved.length} provider advance(s) disbursed for ${approved[0].serviceProviderName || 'unassigned'} in ${cur}`;
        res.json({
            disbursed: approved.length,
            scheduled,
            // Surfaced rather than buried: a deduction landing in a different month from the one
            // the employee asked for is something they will notice on their payslip.
            movedPeriods: moved.map(m => ({ requestNumber: m.requestNumber, period: m.period, label: periodLabel(m.period) })),
        });
    } catch (error) {
        console.error('Error disbursing provider advance batch:', error);
        res.status(500).json({ error: 'Failed to record the disbursement' });
    }
};
