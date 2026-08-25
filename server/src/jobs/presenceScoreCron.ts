import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { computeAndStorePresence } from '../utils/presenceScoring';

const prisma = new PrismaClient();

// Same fixed zone as evaluationPeriodCron.ts — Libya doesn't observe DST, and the
// server itself may be hosted anywhere, so we can't rely on its local time.
const TIMEZONE = 'Africa/Tripoli';
const RUN_FROM_DAY = 25; // the presence window for this month only finishes on the 24th

const todayInTripoli = (): { day: number; month: string } => {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()).split('-');
    return { day: Number(d), month: `${y}-${m}` };
};

// Idempotent by design, same as reconcileEvaluationPeriods: only acts on employees who
// don't have an HREvaluation row for this month yet, so a missed day, a server restart,
// or a transient attendance-system outage all just mean "try again on the next tick" —
// no separate retry/backoff bookkeeping needed.
export const reconcilePresenceScores = async (): Promise<void> => {
    try {
        const { day, month } = todayInTripoli();
        if (day < RUN_FROM_DAY) return;

        const employees = await prisma.employee.findMany({
            // Transferred (inter-company) staff remain in attendance/presence tracking.
            where: { bioId: { not: null } },
            select: { id: true, bioId: true },
        });
        if (employees.length === 0) return;

        const already = await prisma.hREvaluation.findMany({
            where: { month, employeeId: { in: employees.map(e => e.id) } },
            select: { employeeId: true },
        });
        const done = new Set(already.map(e => e.employeeId));
        const pending = employees.filter(e => !done.has(e.id));
        if (pending.length === 0) return;

        console.log(`[PRESENCE_CRON] Computing presence for ${pending.length} employee(s), month ${month}...`);
        let stored = 0, skipped = 0;
        for (const emp of pending) {
            const result = await computeAndStorePresence({ employeeId: emp.id, bioId: emp.bioId as number, month });
            if (result.status === 'stored') stored++; else skipped++;
        }
        console.log(`[PRESENCE_CRON] Done: ${stored} stored, ${skipped} skipped (will retry next tick).`);
    } catch (err) {
        console.error('[PRESENCE_CRON] Reconciliation failed:', err);
    }
};

export const initPresenceScoreScheduler = (): void => {
    reconcilePresenceScores();
    cron.schedule('30 0 * * *', reconcilePresenceScores, { timezone: TIMEZONE });
    console.log(`[PRESENCE_CRON] Presence score scheduler initialized (${TIMEZONE}, runs from day ${RUN_FROM_DAY}).`);
};
