import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendCompletionReminders, sendPeriodOpenedNotifications } from './evaluationPeriodNotifications';

const prisma = new PrismaClient();

// Libya doesn't observe DST, so a fixed IANA zone is safe to hardcode — the
// server itself may be hosted anywhere, so we can't rely on its local time.
const TIMEZONE = 'Africa/Tripoli';
const OPEN_DAY = 15;
const CLOSE_DAY = 20; // inclusive — the window is closed starting day 21
const REMINDER_DAY = 18; // 2 days before CLOSE_DAY

const todayInTripoli = (): { day: number; month: string } => {
    // en-CA formats as YYYY-MM-DD, handing us both the day-of-month and the
    // "YYYY-MM" key EvaluationPeriod.month already uses, computed in the
    // target timezone rather than the server's own local time.
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()).split('-');
    return { day: Number(d), month: `${y}-${m}` };
};

// Idempotent by design: safe to run any number of times, from any downtime
// scenario, because it always re-derives what should happen from persisted
// state + the current date rather than assuming a single fire is never missed.
export const reconcileEvaluationPeriods = async (): Promise<void> => {
    try {
        const { day, month } = todayInTripoli();
        let period = await prisma.evaluationPeriod.findFirst({ where: { month, departmentId: null } });

        if (!period && day >= OPEN_DAY && day <= CLOSE_DAY) {
            period = await prisma.evaluationPeriod.create({
                data: { month, departmentId: null, enabled: true, isAutoManaged: true, enabledAt: new Date() },
            });
        } else if (period && period.isAutoManaged) {
            if (day >= OPEN_DAY && day <= CLOSE_DAY && !period.enabled) {
                period = await prisma.evaluationPeriod.update({
                    where: { id: period.id },
                    data: { enabled: true, enabledAt: new Date() },
                });
            } else if (day > CLOSE_DAY && period.enabled) {
                period = await prisma.evaluationPeriod.update({
                    where: { id: period.id },
                    data: { enabled: false, disabledAt: new Date() },
                });
            }
        }
        // period && !period.isAutoManaged: HR/SUPER_ADMIN has manually taken
        // over this month's global period — leave `enabled` exactly as they
        // set it, regardless of what day it is.

        // Safety sweep: close any OTHER month's auto-managed period still open
        // (recovers a multi-month server outage without needing a backlog of ticks).
        await prisma.evaluationPeriod.updateMany({
            where: { isAutoManaged: true, enabled: true, month: { not: month } },
            data: { enabled: false, disabledAt: new Date() },
        });

        if (!period) return;

        // Notifications are tied to the calendar milestones, not to who
        // flipped the toggle or when — so a manually-opened period still
        // gets the same day-15/day-18 notifications an auto-opened one would.
        if (period.enabled && day >= OPEN_DAY && !period.openNotifiedAt) {
            const claim = await prisma.evaluationPeriod.updateMany({
                where: { id: period.id, openNotifiedAt: null },
                data: { openNotifiedAt: new Date() },
            });
            if (claim.count === 1) await sendPeriodOpenedNotifications(month);
        }

        if (period.enabled && day >= REMINDER_DAY && !period.reminderNotifiedAt) {
            const claim = await prisma.evaluationPeriod.updateMany({
                where: { id: period.id, reminderNotifiedAt: null },
                data: { reminderNotifiedAt: new Date() },
            });
            if (claim.count === 1) await sendCompletionReminders(month);
        }
    } catch (err) {
        console.error('[EVAL_CRON] Reconciliation failed:', err);
    }
};

export const initEvaluationPeriodScheduler = (): void => {
    // Catch up immediately in case the server was down across a milestone,
    // then keep checking daily just after Tripoli midnight.
    reconcileEvaluationPeriods();
    cron.schedule('10 0 * * *', reconcileEvaluationPeriods, { timezone: TIMEZONE });
    console.log(`[EVAL_CRON] Evaluation period scheduler initialized (${TIMEZONE}, opens day ${OPEN_DAY}, closes day ${CLOSE_DAY}).`);
};
