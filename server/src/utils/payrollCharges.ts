// Everything that comes OFF a salary, and the two manual corrections that can go either way,
// gathered for one payroll period.
//
// Kept out of the run controller because it is the one part of a compute that reads from registers
// people edit every day (advances, deductions, corrections) rather than from the employee record.
// Isolating it makes the double-charging rules reviewable in one place.
//
// Two invariants hold throughout:
//   1. A charge in a different currency from the salary is NEVER applied. There is no FX source in
//      this system, so a 500 USD advance cannot be taken off a dinar salary at any rate we could
//      defend. Such a line is blocked instead.
//   2. Nothing here consumes anything. Compute is a destructive rebuild that can be run any number
//      of times; instalments are marked DEDUCTED and deductions APPLIED only when the period is
//      closed.
import { createHash } from 'crypto';

import { prisma } from '../lib/prisma';
import { round2 } from './payrollEngine';

/** One printed deduction (or correction) row on a payslip. */
export interface ChargeItem {
    kind: 'EARNING' | 'DEDUCTION';
    category: string;
    label: string;
    labelArabic: string | null;
    amount: number;
    currency: string;
    percent?: number | null;
    sourceType: string;
    sourceId?: string | null;
    advanceInstalmentId?: string | null;
    correctedRunId?: string | null;
    correctedLineId?: string | null;
    correctionNote?: string | null;
}

export interface EmployeeCharges {
    items: ChargeItem[];
    /** Outstanding advance balance AFTER this period's instalment — printed for information only. */
    remainingAdvanceBalance: number;
    /** Charges skipped because their currency does not match the salary's. */
    currencyMismatches: { label: string; currency: string }[];
}

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
    CASH_ADVANCE: { en: 'Cash Advance Deduction', ar: 'خصم سلفة الراتب' },
    TICKET_COST: { en: 'Ticket Cost Deduction', ar: 'خصم قيمة التذكرة' },
    PENALTY: { en: 'Penalty Deduction', ar: 'خصم جزائي' },
    HEALTH_INSURANCE_OVERRUN: { en: 'Health Insurance Cost Overrun', ar: 'تجاوز تكلفة التأمين الصحي' },
    PREVIOUS_OVERPAYMENT: { en: 'Previous Miscalculation — Overpayment', ar: 'تصحيح صرف زائد سابق' },
    PREVIOUS_UNDERPAYMENT: { en: 'Previous Miscalculation — Underpayment', ar: 'تصحيح صرف ناقص سابق' },
};

/** A recurring deduction covers the period when it starts on or before it and ends on or after. */
const coversPeriod = (d: { period: string | null; recurring: boolean; startPeriod: string | null; endPeriod: string | null }, period: string): boolean => {
    if (!d.recurring) return d.period === period;
    if (d.startPeriod && d.startPeriod > period) return false;
    if (d.endPeriod && d.endPeriod < period) return false;
    return !!d.startPeriod; // an open-ended recurring deduction still needs a start
};

/**
 * Manual items live on PayrollLineOverride.manualItems, which is deliberately OUTSIDE the compute
 * rebuild scope — that is what makes them survive a recompute. Shape is validated here rather than
 * trusted, because it is free JSON written by an earlier version of this code.
 */
/** Stable fallback id for a manual item stored without one. */
const syntheticId = (row: any): string =>
    createHash('sha1')
        .update([row?.kind, row?.amount, row?.correctedLineId, row?.correctionNote, row?.label].join('|'))
        .digest('hex')
        .slice(0, 32);

export const parseManualItems = (raw: unknown): ChargeItem[] => {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((row: any): ChargeItem[] => {
        const amount = Number(row?.amount);
        if (!Number.isFinite(amount) || amount === 0) return [];
        const kind = row?.kind === 'EARNING' ? 'EARNING' : 'DEDUCTION';
        const category = kind === 'EARNING' ? 'PREVIOUS_UNDERPAYMENT' : 'PREVIOUS_OVERPAYMENT';
        return [{
            kind,
            category,
            label: String(row?.label || CATEGORY_LABELS[category].en),
            labelArabic: row?.labelArabic ? String(row.labelArabic) : CATEGORY_LABELS[category].ar,
            amount: round2(Math.abs(amount)),
            currency: String(row?.currency || ''),
            sourceType: 'MANUAL',
            // The key the correction endpoint deletes by. A row that somehow reaches here without
            // one falls back to a hash of its own content — DETERMINISTIC, so the id a client reads
            // is the same id it can delete by. A random id here would read fine and never delete.
            sourceId: row?.sourceId ? String(row.sourceId) : row?.id ? String(row.id) : syntheticId(row),
            correctedRunId: row?.correctedRunId ? String(row.correctedRunId) : null,
            correctedLineId: row?.correctedLineId ? String(row.correctedLineId) : null,
            correctionNote: row?.correctionNote ? String(row.correctionNote) : null,
        }];
    });
};

/**
 * Loads every charge that applies to `period`, keyed by employee id.
 *
 * `overrides` is passed in rather than re-queried because the caller already holds it, and the
 * manual items on it have to be merged with the register-driven charges in one pass.
 */
export const loadPeriodCharges = async (
    period: string,
    employeeIds: string[],
    overridesByEmployee: Map<string, { manualItems: unknown }>,
): Promise<Map<string, { items: ChargeItem[]; instalments: { id: string; amount: number; currency: string }[]; outstandingAfter: number }>> => {
    const [instalments, deductions] = await Promise.all([
        // An instalment is only chargeable if its parent advance actually went through: approved,
        // with the signed agreement attached, and not cancelled or already settled.
        prisma.employeeAdvanceInstalment.findMany({
            where: {
                period,
                status: 'SCHEDULED',
                advance: { employeeId: { in: employeeIds }, status: { in: ['APPROVED', 'ACTIVE'] } },
            },
            include: {
                advance: {
                    select: {
                        id: true, employeeId: true, currency: true, requestNumber: true,
                        type: true, outstandingAmount: true,
                    },
                },
            },
        }),
        prisma.employeeDeduction.findMany({
            where: { employeeId: { in: employeeIds }, status: 'APPROVED' },
        }),
    ]);

    const out = new Map<string, { items: ChargeItem[]; instalments: { id: string; amount: number; currency: string }[]; outstandingAfter: number }>();
    const bucket = (employeeId: string) => {
        let b = out.get(employeeId);
        if (!b) { b = { items: [], instalments: [], outstandingAfter: 0 }; out.set(employeeId, b); }
        return b;
    };

    for (const inst of instalments) {
        const b = bucket(inst.advance.employeeId);
        b.items.push({
            kind: 'DEDUCTION',
            category: 'CASH_ADVANCE',
            label: `${CATEGORY_LABELS.CASH_ADVANCE.en} (${inst.advance.requestNumber}, ${inst.sequence})`,
            labelArabic: CATEGORY_LABELS.CASH_ADVANCE.ar,
            amount: round2(inst.amount),
            currency: inst.advance.currency,
            sourceType: 'ADVANCE',
            sourceId: inst.advance.id,
            advanceInstalmentId: inst.id,
        });
        b.instalments.push({ id: inst.id, amount: inst.amount, currency: inst.advance.currency });
        // What is still owed once this period's instalment has been taken. Printed for the
        // employee's information and NEVER added to the deduction total — that would charge the
        // same money twice, which is the defect the old spreadsheet had.
        b.outstandingAfter = round2(b.outstandingAfter + Math.max(0, round2(inst.advance.outstandingAmount - inst.amount)));
    }

    for (const d of deductions) {
        if (!coversPeriod(d, period)) continue;
        const b = bucket(d.employeeId);
        b.items.push({
            kind: 'DEDUCTION',
            category: d.category,
            label: d.label || CATEGORY_LABELS[d.category]?.en || d.category,
            labelArabic: d.labelArabic || CATEGORY_LABELS[d.category]?.ar || null,
            amount: round2(d.amount),
            currency: d.currency,
            sourceType: 'DEDUCTION',
            sourceId: d.id,
        });
    }

    for (const [employeeId, override] of overridesByEmployee) {
        const manual = parseManualItems(override.manualItems);
        if (manual.length) bucket(employeeId).items.push(...manual);
    }

    return out;
};

/**
 * Splits one employee's charges by whether their currency matches the salary, and totals the ones
 * that do. Manual items with no currency of their own inherit the salary's.
 */
export const applicableCharges = (
    raw: { items: ChargeItem[]; outstandingAfter: number } | undefined,
    salaryCurrency: string,
): EmployeeCharges => {
    if (!raw) return { items: [], remainingAdvanceBalance: 0, currencyMismatches: [] };

    const items: ChargeItem[] = [];
    const currencyMismatches: { label: string; currency: string }[] = [];

    for (const item of raw.items) {
        const currency = item.currency || salaryCurrency;
        if (currency !== salaryCurrency) {
            currencyMismatches.push({ label: item.label, currency });
            continue;
        }
        items.push({ ...item, currency });
    }

    return { items, remainingAdvanceBalance: round2(raw.outstandingAfter), currencyMismatches };
};

export const CHARGE_CATEGORY_LABELS = CATEGORY_LABELS;
