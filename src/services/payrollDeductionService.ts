import api from './apiClient';

export type DeductionStatus = 'PENDING' | 'APPROVED' | 'APPLIED' | 'CANCELLED';

/** Each category is a printed row on the payslip template, which is why the set is closed. */
export interface DeductionCategory {
    key: string;
    en: string;
    ar: string;
}

export interface EmployeeDeduction {
    id: string;
    employeeId: string;
    employee?: { id: string; fullName: string; staffId: string | null; position: string | null; contractType: string | null } | null;
    category: string;
    label: string;
    labelArabic: string | null;
    currency: string;
    amount: number;
    period: string | null;
    recurring: boolean;
    startPeriod: string | null;
    endPeriod: string | null;
    status: DeductionStatus;
    approvedAt: string | null;
    approvedByName: string | null;
    appliedInRunId: string | null;
    documentUrl: string | null;
    documentName: string | null;
    notes: string | null;
    createdByName: string | null;
    createdAt: string;
}

export interface CreateDeductionInput {
    employeeId: string;
    category: string;
    amount: number;
    currency: string;
    period?: string;
    recurring?: boolean;
    startPeriod?: string;
    endPeriod?: string;
    notes?: string;
    documentUrl?: string;
    documentName?: string;
}

export const payrollDeductionService = {
    categories: async (): Promise<DeductionCategory[]> => {
        const res = await api.get('/payroll-deductions/categories');
        return res.data;
    },
    list: async (params?: { employeeId?: string; period?: string; status?: string; category?: string }): Promise<EmployeeDeduction[]> => {
        const res = await api.get('/payroll-deductions', { params });
        return res.data;
    },
    create: async (data: CreateDeductionInput): Promise<EmployeeDeduction> => {
        const res = await api.post('/payroll-deductions', data);
        return res.data;
    },
    update: async (id: string, data: Partial<CreateDeductionInput>): Promise<EmployeeDeduction> => {
        const res = await api.patch(`/payroll-deductions/${id}`, data);
        return res.data;
    },
    approve: async (id: string): Promise<EmployeeDeduction> => {
        const res = await api.post(`/payroll-deductions/${id}/approve`);
        return res.data;
    },
    cancel: async (id: string): Promise<EmployeeDeduction> => {
        const res = await api.post(`/payroll-deductions/${id}/cancel`);
        return res.data;
    },
};
