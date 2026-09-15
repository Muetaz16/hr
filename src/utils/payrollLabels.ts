// Server-side payroll codes and what they read as to a person. Shared, because the run detail
// screen, the close card and the Excel export all have to name the same thing the same way — and
// three private copies of this map is how they start disagreeing.
//
// Every entry has a matching `payroll_block_<CODE>` / `residency_<CODE>` translation key; these are
// the English fallbacks.

export const BLOCK_LABELS: Record<string, string> = {
    NO_STRUCTURE_LEVEL: 'No salary structure',
    NO_JOB_CATEGORY: 'No job category',
    NO_JOB_GRADE: 'No job grade',
    NO_RATE_FOR_COMBINATION: 'Rate card has no such row',
    NO_ATTENDANCE: 'No attendance record',
    NO_RESIDENCY: 'No residency set',
    NEGATIVE_NET: 'Negative net pay',
    BONUS_CAP_EXCEEDED: 'Bonus over 100%',
    GRADE_CHANGED_MID_PERIOD: 'Grade changed mid-period',
    FINAL_SETTLEMENT_PENDING: 'Leaving this period',
    JOINED_MID_PERIOD: 'Joined mid-period',
};

// Where to go and fix each one. A count on its own tells nobody what to do about it, and the two
// rate problems in particular are fixed by different people on different screens.
export const BLOCK_FIXES: Record<string, string> = {
    NO_STRUCTURE_LEVEL: 'Set the salary structure on the employee record.',
    NO_JOB_CATEGORY: 'Set the job category on the employee record.',
    NO_JOB_GRADE: 'Set the job grade on the employee record.',
    NO_RATE_FOR_COMBINATION: 'This category / grade / structure has no row in the rate card. Add it under Salary Structures.',
    NO_ATTENDANCE: 'No row came back from the attendance system for this staff ID.',
    NO_RESIDENCY: 'Set the contract type on the employee record.',
    NEGATIVE_NET: 'Deductions exceed earnings — defer an instalment.',
    BONUS_CAP_EXCEEDED: 'Check the reward case percentages.',
    GRADE_CHANGED_MID_PERIOD: 'The whole period pays at the new grade; confirm that is intended.',
    FINAL_SETTLEMENT_PENDING: 'The final settlement is handled outside payroll.',
    JOINED_MID_PERIOD: 'Pay is by hours worked, so this is already pro-rated.',
};

/** The three canonical contract types, as they read to a person rather than as stored. */
export const RESIDENCY_LABELS: Record<string, string> = {
    RESDANT: 'Resident',
    'DIRCT NONE RESDANT': 'Direct non-resident',
    'NONE RESDANT': 'Service provider',
};

/**
 * "2026-09" as a person reads it: "September 2026", translated.
 *
 * The stored form is a sort key, not something to show. It was being printed raw in the provider
 * advances table while every other screen named the month, so the same month appeared in two
 * different languages depending on where you looked.
 */
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export const periodLabel = (period: string | null | undefined, t: (k: string, o?: any) => string): string => {
    if (!period) return '—';
    const [y, m] = String(period).split('-').map(Number);
    const name = MONTH_NAMES[m - 1];
    if (!y || !name) return String(period);   // not a period after all — show it rather than lie
    return `${t(`month_${name.toLowerCase()}`, { defaultValue: name })} ${y}`;
};

/**
 * The last `n` financial months as 'YYYY-MM', newest first — for a period picker.
 *
 * Only the month LABELS are built here. The 25th → 24th boundary they stand for is resolved
 * server-side from the same payrollPeriod module payroll itself uses; a second copy of that
 * arithmetic in the browser is how a screen's window quietly drifts out of step with the run.
 */
export const recentPeriods = (n: number, today: Date = new Date()): string[] => {
    // On or after the 25th, today already belongs to NEXT month's payroll — so that is the month a
    // picker should open on: the run not yet computed, and therefore the one still worth fixing.
    const anchor = new Date(today.getFullYear(), today.getMonth() + (today.getDate() >= 25 ? 1 : 0), 1);
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
};
