import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { applyEmployeeSeparation } from '../controllers/offboardingController';

const prisma = new PrismaClient();

// Same fixed zone as the other HR crons — Libya doesn't observe DST.
const TIMEZONE = 'Africa/Tripoli';

// A closed offboarding case whose separation date is still in the future means the employee is
// serving a notice period — completeSeparationLetter deliberately leaves them ACTIVE (full login,
// standing permissions) until that date actually arrives. This is what makes that day arrive: once
// dateOfSeparation is today or earlier, apply the real separation effects. Guarded on
// enrollmentStatus still being ACTIVE, so a case is only ever processed once no matter how many
// times this runs (missed day, server restart, etc. all just mean "try again").
export const reconcileOffboardingSeparations = async (): Promise<void> => {
    try {
        const due = await prisma.offboardingCase.findMany({
            where: {
                stage: 'CLOSED',
                dateOfSeparation: { lte: new Date() },
                employee: { enrollmentStatus: 'ACTIVE' },
            },
            select: { id: true, employeeId: true, dateOfSeparation: true, caseNumber: true },
        });
        if (due.length === 0) return;

        console.log(`[OFFBOARDING_SEPARATION_CRON] ${due.length} case(s) reached their separation date...`);
        for (const c of due) {
            await applyEmployeeSeparation(c.employeeId, c.dateOfSeparation!);
            console.log(`[OFFBOARDING_SEPARATION_CRON] Separated employee for case ${c.caseNumber}.`);
        }
    } catch (err) {
        console.error('[OFFBOARDING_SEPARATION_CRON] Reconciliation failed:', err);
    }
};

export const initOffboardingSeparationScheduler = (): void => {
    reconcileOffboardingSeparations();
    cron.schedule('50 0 * * *', reconcileOffboardingSeparations, { timezone: TIMEZONE });
    console.log(`[OFFBOARDING_SEPARATION_CRON] Offboarding separation-date scheduler initialized (${TIMEZONE}).`);
};
