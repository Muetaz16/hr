import api from './apiClient';

// The money view of reward cases: which bonuses are owed, why, and in which payroll month.
// The cases themselves are managed in Personnel Relations (rewardService.ts).

export interface PayrollReward {
    id: string;
    caseNumber: string;
    type: string;
    typeLabel: string;
    /** 'YYYY-MM', 'YYYY' or "5 years" — what the award is FOR, not when it is paid. */
    awardedFor: string | null;
    justification: string | null;
    bonusPercent: number | null;
    completedAt: string | null;
    documentName: string | null;
    payoutPeriod: string | null;
    paidInRun: { id: string; runNumber: string; period: string; status: string } | null;
    paidAt: string | null;
    currency: string | null;
    /** From the contractual monthly basic — a forecast, never stored. */
    estimatedAmount: number | null;
    /** The figure the engine actually computed, once the period has been run. */
    actualAmount: number | null;
    monthlyBasic: number | null;
    employee: {
        id: string;
        staffId: string | null;
        fullName: string | null;
        fullNameArabic: string | null;
        departmentName: string | null;
        residencyType: string | null;
    };
    needsAttention: 'NOT_COMPLETED' | 'NO_PAYOUT_PERIOD' | null;
}

export type RewardState = '' | 'DUE' | 'PAID' | 'UNSCHEDULED';

export const payrollRewardService = {
    list: async (filters: { period?: string; state?: RewardState } = {}): Promise<PayrollReward[]> => {
        const params: Record<string, string> = {};
        if (filters.period) params.period = filters.period;
        if (filters.state) params.state = filters.state;
        return (await api.get('/payroll-rewards', { params })).data;
    },

    periods: async (): Promise<{ current: string; periods: { period: string; count: number }[] }> =>
        (await api.get('/payroll-rewards/periods')).data,

    /**
     * Move a bonus to a different payroll month.
     *
     * The month is DERIVED when the award completes — the Payroll Coverage month on the nomination,
     * or the month the case was approved — so this is a correction, not the normal way it is set.
     * Payroll keeps it because a month can be recorded wrongly and somebody has to be able to fix
     * it, and because a bonus whose month has closed has nowhere else to go.
     */
    setPayoutPeriod: async (id: string, payoutPeriod: string | null) =>
        (await api.patch(`/payroll-rewards/${id}`, { payoutPeriod })).data,
};
