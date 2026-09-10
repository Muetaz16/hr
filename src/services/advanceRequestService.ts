import api from './apiClient';

// Self-service advance requests. The payroll-side register lives in payrollAdvanceService.ts; this
// file is only ever called by the employee's own screen.

export interface AdvanceInstalment {
    id: string;
    sequence: number;
    period: string;
    amount: number;
    status: 'SCHEDULED' | 'DEDUCTED' | 'WAIVED' | 'DEFERRED';
}

export interface MyAdvance {
    id: string;
    requestNumber: string;
    type: string;
    currency: string;
    principal: number;
    instalmentCount: number;
    firstDeductionPeriod: string;
    outstandingAmount: number;
    basicSalaryMonths: number | null;
    basicSalarySnapshot: number | null;
    residencyType: string | null;
    serviceProviderName: string | null;
    /** Set once the Cash Advance Request form carrying this name has gone to the provider. */
    providerFormRef: string | null;
    providerFormIssuedAt: string | null;
    whatsappNumber: string | null;
    contactEmail: string | null;
    reason: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SETTLED' | 'CANCELLED';
    approvedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    documentName: string | null;
    createdAt: string;
    requestSource: string;
    requestedByName: string | null;
    instalments: AdvanceInstalment[];
}

export interface AdvanceContext {
    employee: {
        id: string;
        staffId: string | null;
        fullName: string | null;
        fullNameArabic: string | null;
        position: string | null;
        email: string | null;
        personalPhone: string | null;
    };
    residencyType: string | null;
    /** Provider employees type an amount and name one salary month; everyone else picks 1/2/3 basics. */
    viaProvider: boolean;
    serviceProvider: { id: string; name: string; nameArabic: string | null } | null;
    currency: string | null;
    monthlyBasic: number | null;
    /** Provider employees only: the most that may be requested — one month's salary. */
    maxAdvance: number | null;
    options: {
        months: number;
        amount: number;
        /** N months of basic pay cannot be repaid in fewer than N months. Set by the server. */
        minInstalments: number;
        /** The instalment at that floor — one whole basic salary. */
        maxInstalmentAmount: number;
    }[];
    maxInstalments: number;
    /** The contract end, and the last payroll month anything can be deducted from. */
    contractEndDate: string | null;
    lastDeductionPeriod: string | null;
    lastDeductionPeriodLabel: string | null;
    defaultPeriod: string;
    defaultPeriodLabel: string;
    openRequests: number;
    blockedReason: 'NO_CURRENCY' | 'NO_BASIC_SALARY' | null;
}

export const advanceRequestService = {
    context: async (): Promise<AdvanceContext> => (await api.get('/advance-requests/me/context')).data,

    mine: async (): Promise<MyAdvance[]> => (await api.get('/advance-requests/me')).data,

    /** Preset path: basicSalaryMonths + instalmentCount. Provider path: amount + salaryMonth. */
    create: async (data: {
        whatsappNumber: string;
        reason?: string;
        basicSalaryMonths?: number;
        instalmentCount?: number;
        amount?: number;
        salaryMonth?: string;
    }): Promise<MyAdvance> => (await api.post('/advance-requests/me', data)).data,

    withdraw: async (id: string): Promise<MyAdvance> =>
        (await api.post(`/advance-requests/me/${id}/withdraw`)).data,
};
