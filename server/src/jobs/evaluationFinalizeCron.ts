import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { finalizeOneEmployee } from '../utils/evaluationFinalize';

import { prisma } from '../lib/prisma';

// Same fixed zone as the other evaluation crons — Libya doesn't observe DST.
const TIMEZONE = 'Africa/Tripoli';

// Not all months have a "day 31", so rather than watching for a specific day number,
// we auto-finalize the *previous* calendar month every day — by the time we're in a
// new month at all, that previous month's day-25→30 grace window has unambiguously
// elapsed (day 30 of any month always falls before the 1st of the next one).
const previousMonth = (month: string): string => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1); // m is 1-based; m-2 lands on the previous month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const todayInTripoli = (): string => {
    const [y, m] = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()).split('-');
    return `${y}-${m}`;
};

// Idempotent by design, same as the other evaluation crons: only acts on employees who
// don't have an EvaluationFinalization row yet for the target month, so a missed day,
// a server restart, or running this any number of times all just mean "try again" —
// already-finalized employees are always skipped (finalizeOneEmployee's own guard).
export const reconcileEvaluationFinalization = async (): Promise<void> => {
    try {
        const month = previousMonth(todayInTripoli());

        const employees = await prisma.employee.findMany({ where: { enrollmentStatus: 'ACTIVE' } });
        if (employees.length === 0) return;

        const already = await prisma.evaluationFinalization.findMany({
            where: { month, employeeId: { in: employees.map(e => e.id) } },
            select: { employeeId: true },
        });
        const done = new Set(already.map(e => e.employeeId));
        const pending = employees.filter(e => !done.has(e.id));
        if (pending.length === 0) return;

        console.log(`[FINALIZE_CRON] Auto-finalizing ${pending.length} employee(s) for month ${month}...`);
        let finalized = 0;
        for (const emp of pending) {
            const result = await finalizeOneEmployee(emp as any, month, null, true);
            if (result.status === 'finalized') finalized++;
        }
        console.log(`[FINALIZE_CRON] Done: ${finalized} finalized for ${month}.`);
    } catch (err) {
        console.error('[FINALIZE_CRON] Reconciliation failed:', err);
    }
};

export const initEvaluationFinalizeScheduler = (): void => {
    reconcileEvaluationFinalization();
    cron.schedule('45 0 * * *', reconcileEvaluationFinalization, { timezone: TIMEZONE });
    console.log(`[FINALIZE_CRON] Evaluation auto-finalize scheduler initialized (${TIMEZONE}).`);
};
