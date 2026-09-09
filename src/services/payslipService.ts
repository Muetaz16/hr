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

/** One row of the payslip, with the template's own bilingual labels. */
export interface PayslipRow {
    label: string;
    labelAr: string;
    value: string;
}

/** A heading inside a section — SALARY INFORMATION has two. */
export interface PayslipSubheading {
    subheading: string;
    subheadingAr: string;
}

export interface PayslipSection {
    key: string;
    title: string;
    titleAr: string;
    valueHeader?: string;
    rows: (PayslipRow | PayslipSubheading)[];
}

export interface PayslipView {
    period: string;
    periodLabel: string;
    monthNameArabic: string;
    periodStart: string;
    periodEnd: string;
    status: 'APPROVED' | 'PAID' | string;
    approvedAt: string | null;
    paidAt: string | null;
    currency: string;
    netSalary: number;
    sections: PayslipSection[];
}

export const isSubheading = (r: PayslipRow | PayslipSubheading): r is PayslipSubheading =>
    'subheading' in r;

export const payslipService = {
    mine: async (): Promise<MyPayslip[]> => (await api.get('/payslips/me')).data,

    /**
     * The payslip as data, for the screen that shows it. Built from the same list on the server that
     * fills the Word document, so the screen and the file cannot show different numbers.
     */
    myView: async (period: string): Promise<PayslipView> =>
        (await api.get(`/payslips/me/${period}/view`)).data,

    /** The payslip document (.docx), generated from the same template the payroll side prints. */
    myDocument: async (period: string): Promise<Blob> =>
        (await api.get(`/payslips/me/${period}`, { responseType: 'blob' })).data,

    /** Every payable employee's payslip in one printable document, one per page. */
    forRun: async (runId: string): Promise<Blob> =>
        (await api.get(`/payroll-runs/${runId}/payslips`, { responseType: 'blob' })).data,

    /** Payroll-side: one line's payslip. Accepts the employee id in place of the line id. */
    forLine: async (runId: string, lineId: string): Promise<Blob> =>
        (await api.get(`/payroll-runs/${runId}/lines/${lineId}/payslip`, { responseType: 'blob' })).data,
};
