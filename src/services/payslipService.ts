import api from './apiClient';

// Payslips. The employee-facing routes only ever return the caller's own, and only for periods that
// have been signed off — a draft period is rebuilt on every recompute.

export interface MyPayslip {
    runId: string;
    period: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    status: 'APPROVED' | 'PAID' | string;
    approvedAt: string | null;
    paidAt: string | null;
    currency: string;
    totalWorkingHours: number;
    basicSalary: number;
    bonusAmount: number;
    totalEarnings: number;
    deductionsTotal: number;
    netSalary: number;
}

export const payslipService = {
    mine: async (): Promise<MyPayslip[]> => (await api.get('/payslips/me')).data,

    /** Returns a PDF, not a Word file — an editable payslip in an employee's hands is forgeable. */
    myDocument: async (period: string): Promise<Blob> =>
        (await api.get(`/payslips/me/${period}`, { responseType: 'blob' })).data,

    /** Every payable employee's payslip in one printable document, one per page. */
    forRun: async (runId: string): Promise<Blob> =>
        (await api.get(`/payroll-runs/${runId}/payslips`, { responseType: 'blob' })).data,

    /** Payroll-side: one line's payslip. Accepts the employee id in place of the line id. */
    forLine: async (runId: string, lineId: string): Promise<Blob> =>
        (await api.get(`/payroll-runs/${runId}/lines/${lineId}/payslip`, { responseType: 'blob' })).data,
};
