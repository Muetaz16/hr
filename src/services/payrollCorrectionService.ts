import api from './apiClient';

// "Previous Miscalculation" corrections on one payroll line. Stored on the run's override record,
// so they survive a recompute — which is why they are a separate endpoint from the line's items.

export interface PayrollCorrection {
    kind: 'EARNING' | 'DEDUCTION';
    category: 'PREVIOUS_UNDERPAYMENT' | 'PREVIOUS_OVERPAYMENT' | string;
    label: string;
    labelArabic: string | null;
    amount: number;
    currency: string;
    sourceType: string;
    sourceId: string | null;
    correctedRunId: string | null;
    correctedLineId: string | null;
    correctionNote: string | null;
}

export interface PriorLine {
    lineId: string;
    runId: string;
    period: string;
    runNumber: string;
    runStatus: string;
    netSalary: number;
    totalEarnings: number;
    currency: string;
}

export const payrollCorrectionService = {
    list: async (runId: string, lineId: string): Promise<{ currency: string; corrections: PayrollCorrection[]; priorLines: PriorLine[] }> =>
        (await api.get(`/payroll-runs/${runId}/lines/${lineId}/corrections`)).data,

    add: async (runId: string, lineId: string, data: {
        direction: 'UNDERPAYMENT' | 'OVERPAYMENT';
        amount: number;
        correctedLineId: string;
        note: string;
    }): Promise<{ corrections: PayrollCorrection[]; requiresRecompute: boolean }> =>
        (await api.post(`/payroll-runs/${runId}/lines/${lineId}/corrections`, data)).data,

    remove: async (runId: string, lineId: string, correctionId: string): Promise<{ corrections: PayrollCorrection[] }> =>
        (await api.delete(`/payroll-runs/${runId}/lines/${lineId}/corrections/${correctionId}`)).data,
};
