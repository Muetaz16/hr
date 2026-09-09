import api from './apiClient';

export type AdvanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'SETTLED' | 'CANCELLED';
export type InstalmentStatus = 'SCHEDULED' | 'DEDUCTED' | 'WAIVED' | 'DEFERRED';

export interface AdvanceInstalment {
    id: string;
    sequence: number;
    period: string;
    amount: number;
    status: InstalmentStatus;
    deductedInRunId: string | null;
    deductedAt: string | null;
    note: string | null;
}

export interface EmployeeAdvance {
    id: string;
    requestNumber: string;
    employeeId: string;
    employee?: { id: string; fullName: string; staffId: string | null; position: string | null; contractType: string | null } | null;
    type: string;
    currency: string;
    principal: number;
    instalmentCount: number;
    firstDeductionPeriod: string;
    outstandingAmount: number;
    reason: string | null;
    status: AdvanceStatus;
    approvedAt: string | null;
    approvedByName: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    settledAt: string | null;
    documentUrl: string | null;
    documentName: string | null;
    notes: string | null;
    createdByName: string | null;
    createdAt: string;

    // --- filled when the employee filed the request themselves -----------------------------
    /** SELF = the employee's own screen. HR = payroll entered it for them. */
    requestSource: string;
    requestedByName: string | null;
    contactEmail: string | null;
    whatsappNumber: string | null;
    /** 1, 2 or 3 — how many months of basic pay were chosen, and the basic at the time. */
    basicSalaryMonths: number | null;
    basicSalarySnapshot: number | null;
    residencyType: string | null;
    serviceProviderName: string | null;
    instalments: AdvanceInstalment[];
}

/**
 * Loan or salary advance. Mirrors server/src/utils/advanceKind.ts, which is where the rule lives —
 * the server derives the kind and stores it; this is only for showing the clerk what it will be
 * before they submit, and for labelling rows in the list.
 *
 *   RESDANT / DIRCT NONE RESDANT      LOAN     a multiple of basic pay, repaid over months
 *   NONE RESDANT (service provider)   ADVANCE  one amount, recovered from one salary month
 */
export const PROVIDER_RESIDENCY = 'NONE RESDANT';

export type AdvanceKind = 'LOAN' | 'SALARY_ADVANCE';

export const advanceKindFor = (contractType?: string | null): AdvanceKind =>
    contractType === PROVIDER_RESIDENCY ? 'SALARY_ADVANCE' : 'LOAN';

export const ADVANCE_KIND_LABELS: Record<string, { en: string; ar: string }> = {
    LOAN: { en: 'Loan', ar: 'قرض' },
    SALARY_ADVANCE: { en: 'Salary advance', ar: 'سلفة' },
};

export interface CreateAdvanceInput {
    employeeId: string;
    // No `type`: the server derives it from the employee's contract type.
    currency: string;
    principal: number;
    instalmentCount: number;
    firstDeductionPeriod: string;
    reason?: string;
    notes?: string;
}

export const payrollAdvanceService = {
    /** `scope: 'direct'` excludes provider employees, who have their own screen and procedure. */
    list: async (params?: { status?: string; employeeId?: string; scope?: 'direct' | 'provider' }): Promise<EmployeeAdvance[]> => {
        const res = await api.get('/payroll-advances', { params });
        return res.data;
    },
    get: async (id: string): Promise<EmployeeAdvance> => {
        const res = await api.get(`/payroll-advances/${id}`);
        return res.data;
    },
    create: async (data: CreateAdvanceInput): Promise<EmployeeAdvance> => {
        const res = await api.post('/payroll-advances', data);
        return res.data;
    },
    // The signed agreement is mandatory — the server refuses an approval without it.
    approve: async (id: string, data: { documentUrl: string; documentName?: string }): Promise<EmployeeAdvance> => {
        const res = await api.post(`/payroll-advances/${id}/approve`, data);
        return res.data;
    },
    reject: async (id: string, rejectionReason: string): Promise<EmployeeAdvance> => {
        const res = await api.post(`/payroll-advances/${id}/reject`, { rejectionReason });
        return res.data;
    },
    cancel: async (id: string, notes?: string): Promise<EmployeeAdvance> => {
        const res = await api.post(`/payroll-advances/${id}/cancel`, { notes });
        return res.data;
    },
    /** Payroll-gated upload for signed agreements and provider consent forms. */
    uploadDocument: async (file: File): Promise<{ url: string; name: string }> => {
        const fd = new FormData();
        fd.append('file', file);
        return (await api.post('/payroll-advances/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },

    updateInstalment: async (
        advanceId: string, instalmentId: string, data: { period?: string; status?: InstalmentStatus; note?: string },
    ): Promise<AdvanceInstalment> => {
        const res = await api.patch(`/payroll-advances/${advanceId}/instalments/${instalmentId}`, data);
        return res.data;
    },
};

// --- provider rounds ---------------------------------------------------------------------------
//
// A provider employee's advance needs the provider's written consent, collected on ONE Cash Advance
// Request form per provider per currency. Approval is consent; the deduction is only scheduled once
// the cash is recorded as handed over.

export interface ProviderBatchAdvance {
    id: string;
    requestNumber: string;
    currency: string;
    principal: number;
    firstDeductionPeriod: string;
    status: AdvanceStatus;
    reason: string | null;
    whatsappNumber: string | null;
    contactEmail: string | null;
    requestSource: string;
    serviceProviderId: string | null;
    serviceProviderName: string | null;
    providerFormRef: string | null;
    providerFormIssuedAt: string | null;
    documentUrl: string | null;
    documentName: string | null;
    approvedAt: string | null;
    approvedByName: string | null;
    disbursedAt: string | null;
    createdAt: string;
    employee: {
        id: string; staffId: string | null; fullName: string | null;
        fullNameArabic: string | null; passportNumber: string | null; position: string | null;
    } | null;
}

/**
 * One ROUND: one provider, one currency, one printed form.
 *
 *   COLLECTING          no form printed yet — requests still gathering (formRef is null)
 *   AWAITING_PROVIDER   printed and sent; waiting for the signed form back
 *   AWAITING_HANDOVER   signed; waiting for the cash handover to be recorded
 *
 * Rounds are separate cards on purpose: a form away being signed is closed to anyone who asks
 * afterwards, so approving it cannot approve people it never listed.
 */
export type ProviderRoundStage = 'COLLECTING' | 'AWAITING_PROVIDER' | 'AWAITING_HANDOVER';

export interface ProviderBatch {
    key: string;
    stage: ProviderRoundStage;
    providerId: string | null;
    providerName: string | null;
    currency: string;
    total: number;
    pendingCount: number;
    approvedCount: number;
    formRef: string | null;
    formIssuedAt: string | null;
    signedDocumentUrl: string | null;
    signedDocumentName: string | null;
    advances: ProviderBatchAdvance[];
}

export const providerAdvanceService = {
    /** Also returns whose name the form will carry, so it is visible before anything is sent. */
    batches: async (): Promise<{ hrManagerName: string | null; batches: ProviderBatch[] }> =>
        (await api.get('/payroll-advances/provider-batches')).data,

    /**
     * Without `ref`: seals a NEW round from the requests no form covers yet, and stamps them with
     * the new reference. With `ref`: reprints that round untouched, under the same reference — the
     * provider loses forms, and a reprint under a new number would orphan the signed paper.
     */
    form: async (providerId: string, currency: string, ref?: string | null): Promise<Blob> =>
        (await api.post(
            `/payroll-advances/provider-batches/${providerId}/form`,
            {},
            { params: { currency, ...(ref ? { ref } : {}) }, responseType: 'blob' },
        )).data,

    /** `formRef` is required: approval is recorded against the form that was actually signed. */
    approve: async (providerId: string, data: {
        currency: string; formRef: string; documentUrl: string; documentName?: string; advanceIds?: string[]; note?: string;
    }): Promise<{ approved: number; formRef: string; nextStep: string }> =>
        (await api.post(`/payroll-advances/provider-batches/${providerId}/approve`, data)).data,

    disburse: async (providerId: string, data: { currency: string; formRef: string; advanceIds?: string[]; note?: string }): Promise<{
        disbursed: number;
        movedPeriods: { requestNumber: string; period: string; label: string }[];
    }> => (await api.post(`/payroll-advances/provider-batches/${providerId}/disburse`, data)).data,
};
