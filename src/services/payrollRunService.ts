import api from './apiClient';

// NOTE: this is the real payroll module. The older `payrollService.ts` next to it is the
// Evaluations module's score export and is unrelated despite the name.

export type PayrollRunStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type PayrollLineStatus = 'OK' | 'BLOCKED' | 'EXCLUDED';

export interface PayrollRunTotal {
    id: string;
    currency: string;
    /** 'ALL' for the whole run, else one of the three canonical residency types. */
    residencyType: string;
    employeeCount: number;
    basicTotal: number;
    allowanceTotal: number;
    paidLeaveTotal: number;
    bonusTotal: number;
    deductionTotal: number;
    netTotal: number;
    serviceProviderFeeTotal: number;
    employerCostTotal: number;
}

export interface PayrollApprovalStep {
    id: string;
    sequence: number;
    stage: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
    note: string | null;
    decidedAt: string | null;
    approver?: { id: string; fullName: string; role: string } | null;
}

export interface PayrollAttendanceWarning {
    code: string;
    count?: number;
    detail?: string;
}

export interface PayrollRun {
    id: string;
    runNumber: string;
    period: string;
    revision: number;
    periodStart: string;
    periodEnd: string;
    cutoffAt: string | null;
    status: PayrollRunStatus;
    stage: string;
    lockedAt: string | null;
    approvedAt: string | null;
    paidAt: string | null;
    approvalDocumentUrl: string | null;
    approvalDocumentName: string | null;
    approvedByName: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    attendanceFetchedAt: string | null;
    attendanceSourceStart: string | null;
    attendanceSourceEnd: string | null;
    attendanceRowCount: number;
    // {code, count?, detail?} so the UI can translate them; code RAW carries a literal message.
    attendanceWarnings: PayrollAttendanceWarning[] | null;
    notes: string | null;
    createdByName: string | null;
    createdAt: string;
    totals?: PayrollRunTotal[];
    steps?: PayrollApprovalStep[];
    _count?: { lines: number };
    blockedCount?: number;
    excludedCount?: number;
    /** Blocked lines grouped by reason — a bare count says nothing about what to fix. */
    blockReasonCounts?: { code: string; count: number }[];
    /** Corrections saved since the last compute, so not yet in any amount. */
    pendingCorrections?: number;
    /**
     * Punches corrected in the attendance system AFTER this run read it. The attendance service is
     * now right and these figures are not — recomputing is what closes the gap. Only successfully
     * applied corrections are counted; a failed one changed nothing and makes nothing stale.
     */
    staleAttendanceCorrections?: number;
}

export interface PayrollLineItem {
    id: string;
    kind: 'EARNING' | 'DEDUCTION';
    category: string;
    label: string;
    labelArabic: string | null;
    amount: number;
    currency: string;
    percent: number | null;
    sourceType: string | null;
    correctionNote?: string | null;
}

export interface PayrollLine {
    id: string;
    employeeId: string | null;
    staffId: string | null;
    fullName: string | null;
    fullNameArabic: string | null;
    divisionName: string | null;
    departmentName: string | null;
    unitName: string | null;
    passportNumber: string | null;
    email: string | null;
    nationality: string | null;
    positionTitle: string | null;
    workLocation: string | null;
    contractEndDate: string | null;
    residencyType: string | null;

    jobCategory: string | null;
    jobGrade: string | null;
    structureLevel: string | null;
    currency: string;
    hourlyRate: number;

    positionFactor: number;
    siteFactor: number;
    skillFactor: number;
    languageFactor: number;
    factorF: number;

    attendanceMatched: boolean;
    empCode: string | null;
    workMins: number;
    otMins: number;
    approvedOtMins: number;
    paidLeaveMins: number;
    unpaidLeaveMins: number;
    absenceDays: number;
    suspensionDays: number;
    attendanceRaw: Record<string, unknown> | null;

    basicHours: number;
    overtimeHours: number;
    totalWorkingHours: number;
    paidAbsenceHours: number;
    unpaidHours: number;

    basicSalary: number;
    positionAllowance: number;
    siteAllowance: number;
    languageAllowance: number;
    skillAllowance: number;
    paidAbsenceAmount: number;
    bonusPercent: number;
    bonusAmount: number;
    totalEarnings: number;
    deductionsTotal: number;
    netSalary: number;
    remainingAdvanceBalance: number;

    serviceProviderId: string | null;
    serviceProviderName: string | null;
    serviceProviderPercentage: number | null;
    serviceProviderFee: number;
    employerTotalCost: number;

    presenceScore: number | null;
    execScore: number | null;
    adminScore: number | null;
    careScore: number | null;
    trainingScore: number | null;
    evaluationTotal: number | null;
    promotionEligibilityIndex: number | null;

    paidLeaveBalance: number | null;
    unpaidLeaveBalance: number | null;
    emergencyLeaveBalance: number | null;

    status: PayrollLineStatus;
    blockReasons: string[];
    excludeReason: string | null;
    reviewNote: string | null;

    items?: PayrollLineItem[];
    run?: Pick<PayrollRun, 'id' | 'period' | 'periodStart' | 'periodEnd' | 'status' | 'approvedAt' | 'lockedAt'>;
}

export interface PayrollLinePage {
    lines: PayrollLine[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface PayrollPreflight {
    period: string;
    label: string;
    periodStart: string;
    periodEnd: string;
    attendanceWindow: { start: string; end: string };
    eligibleCount: number;
    issues: { code: string; employees: { id: string; staffId: string | null; fullName: string | null }[] }[];
    /**
     * Days in this window whose punches did not pair, so they pay nothing. Counted in DAYS, not
     * employees, which is why it sits outside `issues` — those are all employee lists.
     *
     * `available: false` means the attendance system could not be swept, NOT that the period is
     * clean. Pre-flight still answers about salary structures and residency when it is down.
     */
    attendanceAnomalies?: {
        available: boolean;
        days: number;
        employees: number;
        zeroPayDays: number;
        phantomLateMins: number;
        scanned: number;
        unreadable: number;
    };
    existingRun: { id: string; runNumber: string; status: string; revision: number } | null;
}

export interface ComputeResult {
    ok: true;
    lineCount: number;
    blockedCount: number;
    excludedCount: number;
    attendanceRowCount: number;
    attendanceAttempts: number;
    warnings: PayrollAttendanceWarning[];
}

export interface PayrollLineFilters {
    page?: number;
    limit?: number;
    status?: PayrollLineStatus | '';
    currency?: string;
    residencyType?: string;
    search?: string;
}

export const payrollRunService = {
    list: async (): Promise<PayrollRun[]> => (await api.get('/payroll-runs')).data,

    get: async (id: string): Promise<PayrollRun> => (await api.get(`/payroll-runs/${id}`)).data,

    preflight: async (period: string): Promise<PayrollPreflight> =>
        (await api.get('/payroll-runs/preflight', { params: { period } })).data,

    create: async (period: string): Promise<PayrollRun> =>
        (await api.post('/payroll-runs', { period })).data,

    compute: async (id: string): Promise<ComputeResult> =>
        (await api.post(`/payroll-runs/${id}/compute`)).data,

    lines: async (id: string, filters: PayrollLineFilters = {}): Promise<PayrollLinePage> => {
        const params: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(filters)) if (v !== '' && v !== undefined) params[k] = v as string | number;
        return (await api.get(`/payroll-runs/${id}/lines`, { params })).data;
    },

    line: async (id: string, lineId: string): Promise<PayrollLine> =>
        (await api.get(`/payroll-runs/${id}/lines/${lineId}`)).data,

    updateLine: async (
        id: string, lineId: string, data: { excluded?: boolean; excludeReason?: string | null; reviewNote?: string | null },
    ): Promise<PayrollLine> => (await api.patch(`/payroll-runs/${id}/lines/${lineId}`, data)).data,

    remove: async (id: string): Promise<void> => { await api.delete(`/payroll-runs/${id}`); },

    // --- review & close --------------------------------------------------------------------

    /** Every line of the run, unpaginated, for the MASTER DATA review workbook. */
    masterData: async (id: string): Promise<{ run: PayrollRun; lines: PayrollLine[] }> =>
        (await api.get(`/payroll-runs/${id}/master-data`)).data,

    /** The Salary Approval memo, pre-filled from the run's totals, for wet signing. */
    approvalForm: async (id: string): Promise<Blob> =>
        (await api.get(`/payroll-runs/${id}/approval-form`, { responseType: 'blob' })).data,

    uploadDocument: async (id: string, file: File): Promise<{ url: string; name: string }> => {
        const fd = new FormData();
        fd.append('file', file);
        return (await api.post(`/payroll-runs/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },

    /** Freezes the period. Irreversible: a mistake is corrected by a new revision, not a re-open. */
    close: async (
        id: string,
        data: { documentUrl: string; documentName?: string; note?: string; acknowledgeBlocked?: boolean },
    ): Promise<PayrollRun> =>
        (await api.post(`/payroll-runs/${id}/close`, data)).data,
};
