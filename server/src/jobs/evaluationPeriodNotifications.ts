import { notify } from '../controllers/notificationController';
import { resolveUsersWithPermission } from '../utils/leaveApprovalChain';
import { prisma } from '../lib/prisma';
import { buildMonthlyAssignments, getIncompleteForManager } from '../utils/evaluationAssignments';
import { LEVEL_LABEL } from '../utils/evaluationHierarchy';
import { sendMail } from '../utils/mailer';

// Sent once, the day the evaluation window opens: every manager with at least
// one employee to evaluate this month gets a list of who they're responsible
// for, in-app and by email. Any manager with no org scope, or any org scope
// with nobody assigned to evaluate it, is reported to HR/SUPER_ADMIN instead
// of being silently skipped or mis-attributed.
export const sendPeriodOpenedNotifications = async (month: string): Promise<void> => {
    const { assignments, unscopedManagers, vacantScopes } = await buildMonthlyAssignments();

    await Promise.allSettled(assignments.map(async ({ user, level, required }) => {
        const names = required.map(e => e.fullName).join(', ');
        const title = `Evaluation window open for ${month}`;
        const content = `As ${LEVEL_LABEL[level]}, you are responsible for evaluating ${required.length} employee(s) this month: ${names}.`;
        await notify(user.id, title, content, '/evaluations');
        if (user.email) await sendMail({ to: user.email, subject: title, text: content });
    }));

    if (unscopedManagers.length || vacantScopes.length) {
        const lines = [
            ...unscopedManagers.map(m => `- ${m.user.fullName || m.user.email} (${LEVEL_LABEL[m.level]}) has no organizational scope assigned and was skipped from this month's evaluation batch.`),
            ...vacantScopes.map(v => `- No ${LEVEL_LABEL[v.level]} is assigned to evaluate employees such as "${v.sampleEmployeeName}".`),
        ];
        // Resolved by permission, not by role: notifyRoles() cannot see Functional Hats, so a
        // role-based lookup would now only ever reach SUPER_ADMIN.
        const recipients = await resolveUsersWithPermission(prisma, 'manage_evaluation_control');
        await Promise.all(recipients.map(id => notify(
            id,
            `Evaluation setup issues for ${month}`,
            lines.join('\n'),
            '/evaluation-control',
        )));
    }
};

// Sent once, 2 days before the window closes: only to managers who still
// have employees left to evaluate — a manager who already finished gets
// nothing.
export const sendCompletionReminders = async (month: string): Promise<void> => {
    const { assignments } = await buildMonthlyAssignments();

    await Promise.allSettled(assignments.map(async ({ user, level, required }) => {
        const incomplete = await getIncompleteForManager(level, month, required);
        if (!incomplete.length) return;
        const names = incomplete.map(e => e.fullName).join(', ');
        const title = `2 days left to submit evaluations for ${month}`;
        const content = `The evaluation window closes in 2 days. You still need to evaluate ${incomplete.length} employee(s): ${names}.`;
        await notify(user.id, title, content, '/evaluations');
        if (user.email) await sendMail({ to: user.email, subject: title, text: content });
    }));
};
