import { prisma } from '../lib/prisma';

// The leave policy numbers, read from the database rather than compiled in.
//
// Defaults match what the code used to hard-code, so a missing row behaves exactly as before rather
// than silently zeroing an allowance — a policy read that fails must never make everyone's balance
// look spent.

export interface LeavePolicyValues {
    /** Minimum days between filing and the first day of leave (Annual / Unpaid). */
    noticeDays: number;
    emergencyLeaveAllowance: number;
    unpaidLeaveAllowance: number;
}

export const LEAVE_POLICY_DEFAULTS: LeavePolicyValues = {
    noticeDays: 14,
    emergencyLeaveAllowance: 3,
    unpaidLeaveAllowance: 14,
};

const SINGLETON = 'singleton';

// Cached briefly: these are read on nearly every employee and leave endpoint, and they change a
// couple of times a year. Short enough that an edit shows up without a restart.
const TTL_MS = 30_000;
let cached: { at: number; values: LeavePolicyValues } | null = null;

export async function getLeavePolicy(): Promise<LeavePolicyValues> {
    if (cached && Date.now() - cached.at < TTL_MS) return cached.values;
    try {
        const row = await prisma.leavePolicy.findUnique({ where: { id: SINGLETON } });
        const values: LeavePolicyValues = row
            ? {
                noticeDays: row.noticeDays,
                emergencyLeaveAllowance: row.emergencyLeaveAllowance,
                unpaidLeaveAllowance: row.unpaidLeaveAllowance,
            }
            : LEAVE_POLICY_DEFAULTS;
        cached = { at: Date.now(), values };
        return values;
    } catch {
        // Never fail a leave or payroll request over a settings read.
        return cached?.values ?? LEAVE_POLICY_DEFAULTS;
    }
}

/** Drop the cache so an edit takes effect immediately for the person who made it. */
export function invalidateLeavePolicyCache(): void {
    cached = null;
}

export async function updateLeavePolicy(values: Partial<LeavePolicyValues>, updatedById?: string): Promise<LeavePolicyValues> {
    // Every number is a count of days: whole, positive, and small enough to be a real policy rather
    // than a typo that would let somebody file leave 10 years out or hand out a 9,999-day allowance.
    const clean = (v: unknown, fallback: number): number => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 0 && n <= 365 ? n : fallback;
    };
    const current = await getLeavePolicy();
    const next: LeavePolicyValues = {
        noticeDays: clean(values.noticeDays, current.noticeDays),
        emergencyLeaveAllowance: clean(values.emergencyLeaveAllowance, current.emergencyLeaveAllowance),
        unpaidLeaveAllowance: clean(values.unpaidLeaveAllowance, current.unpaidLeaveAllowance),
    };
    await prisma.leavePolicy.upsert({
        where: { id: SINGLETON },
        update: { ...next, updatedById: updatedById ?? null },
        create: { id: SINGLETON, ...next, updatedById: updatedById ?? null },
    });
    invalidateLeavePolicyCache();
    return next;
}
