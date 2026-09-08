import api from './apiClient';

// The rate card every salary is computed from. Reads are open to any signed-in user (the employee
// form, contract renewal and candidate offers all need them); writes are payroll-only, because a
// changed rate silently changes what everyone on it earns next month.

export interface SalaryStructureRow {
    id: string;
    jobCategory: string;
    jobGrade: string;
    structureLevel: string;
    hourlyRate: number;
    /** Derived server-side as hourlyRate x 208. Never sent. */
    monthlyRate: number;
}

export interface RateCoverage {
    total: number;
    /** categories x grades x levels — how many rows a fully dense card would have. */
    expected: number;
    categories: string[];
    grades: string[];
    levels: string[];
    /** How many employees are actually paid on each existing combination. */
    usage: { jobCategory: string; jobGrade: string; structureLevel: string; employeeCount: number }[];
    /** Combinations employees point at that the card does not cover — the only gaps that cost anything. */
    missingInUse: { jobCategory: string; jobGrade: string; structureLevel: string; employeeCount: number }[];
}

export const salaryStructureService = {
    list: async (): Promise<SalaryStructureRow[]> => (await api.get('/salary-structures')).data,

    coverage: async (): Promise<RateCoverage> => (await api.get('/salary-structures/coverage')).data,

    create: async (data: {
        jobCategory: string; jobGrade: string; structureLevel: string; hourlyRate: number;
    }): Promise<SalaryStructureRow> => (await api.post('/salary-structures', data)).data,

    /** Only the rate is editable — the category, grade and level identify the row. */
    update: async (id: string, hourlyRate: number): Promise<SalaryStructureRow> =>
        (await api.patch(`/salary-structures/${id}`, { hourlyRate })).data,

    remove: async (id: string): Promise<void> => { await api.delete(`/salary-structures/${id}`); },
};
