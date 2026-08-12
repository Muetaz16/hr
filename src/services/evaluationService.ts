import api from './apiClient';
import type {
    UnitEvaluation, DepartmentEvaluation, DivisionEvaluation,
    DirectorEvaluation, GMEvaluation, ChairmanEvaluation, PersonnelEvaluation
} from '../types';

// Generic GET helpers keep the per-level methods tiny and consistent.
const getOne = async <T>(path: string, employeeId: string, month: string): Promise<T | null> => {
    try {
        const response = await api.get(`/evaluations/${path}?employeeId=${employeeId}&month=${month}`);
        return response.data || null;
    } catch (error) {
        return null;
    }
};

const getByMonth = async <T>(path: string, month: string): Promise<T[]> => {
    const response = await api.get(`/evaluations/${path}/month/${month}`);
    return response.data;
};

export const evaluationService = {
    // --- Bulk fetch helpers (Analytics / Payroll) ---
    getUnitEvaluationsByMonth: (month: string) => getByMonth<UnitEvaluation>('unit', month),
    getDeptEvaluationsByMonth: (month: string) => getByMonth<DepartmentEvaluation>('dept', month),
    getDivisionEvaluationsByMonth: (month: string) => getByMonth<DivisionEvaluation>('division', month),
    getDirectorEvaluationsByMonth: (month: string) => getByMonth<DirectorEvaluation>('director', month),
    getGMEvaluationsByMonth: (month: string) => getByMonth<GMEvaluation>('gm', month),
    getChairmanEvaluationsByMonth: (month: string) => getByMonth<ChairmanEvaluation>('chairman', month),
    getPersonnelEvaluationsByMonth: (month: string) => getByMonth<PersonnelEvaluation>('personnel', month),

    // --- Per-employee fetch ---
    getUnitEvaluation: (employeeId: string, month: string) => getOne<UnitEvaluation>('unit', employeeId, month),
    getDeptEvaluation: (employeeId: string, month: string) => getOne<DepartmentEvaluation>('dept', employeeId, month),
    getDivisionEvaluation: (employeeId: string, month: string) => getOne<DivisionEvaluation>('division', employeeId, month),
    getDirectorEvaluation: (employeeId: string, month: string) => getOne<DirectorEvaluation>('director', employeeId, month),
    getGMEvaluation: (employeeId: string, month: string) => getOne<GMEvaluation>('gm', employeeId, month),
    getChairmanEvaluation: (employeeId: string, month: string) => getOne<ChairmanEvaluation>('chairman', employeeId, month),
    getPersonnelEvaluation: (employeeId: string, month: string) => getOne<PersonnelEvaluation>('personnel', employeeId, month),

    // --- Save (metric-based levels). totalScore is (re)computed server-side. ---
    async saveUnitEvaluation(evalData: Omit<UnitEvaluation, 'id'>) {
        await api.post('/evaluations/unit', evalData);
    },
    async saveDeptEvaluation(evalData: Omit<DepartmentEvaluation, 'id'>) {
        await api.post('/evaluations/dept', evalData);
    },
    async saveDivisionEvaluation(evalData: Omit<DivisionEvaluation, 'id'>) {
        await api.post('/evaluations/division', evalData);
    },
    async saveDirectorEvaluation(evalData: Omit<DirectorEvaluation, 'id' | 'locked' | 'lockedAt'>) {
        const res = await api.post('/evaluations/director', evalData);
        return res.data.id;
    },

    // --- Save (score-only top levels) ---
    async saveGMEvaluation(evalData: Omit<GMEvaluation, 'id' | 'locked' | 'lockedAt'>) {
        const res = await api.post('/evaluations/gm', evalData);
        return res.data.id;
    },
    async saveChairmanEvaluation(evalData: Omit<ChairmanEvaluation, 'id' | 'locked' | 'lockedAt'>) {
        const res = await api.post('/evaluations/chairman', evalData);
        return res.data.id;
    },

    async savePersonnelEvaluation(evalData: Omit<PersonnelEvaluation, 'id'>) {
        const response = await api.post('/evaluations/personnel', evalData);
        return response.data;
    },

    // Retained for backwards compatibility; locking is no longer part of the flow.
    async lockEvaluation(id: string) {
        await api.post('/evaluations/director/lock', { id });
    },

    // --- Delete (Super Admin) ---
    deleteHREvaluation: (id: string) => api.delete(`/evaluations/hr/${id}`),
    deleteUnitEvaluation: (id: string) => api.delete(`/evaluations/unit/${id}`),
    deleteDeptEvaluation: (id: string) => api.delete(`/evaluations/dept/${id}`),
    deleteDivisionEvaluation: (id: string) => api.delete(`/evaluations/division/${id}`),
    deleteDirectorEvaluation: (id: string) => api.delete(`/evaluations/director/${id}`),
    deleteGMEvaluation: (id: string) => api.delete(`/evaluations/gm/${id}`),
    deleteChairmanEvaluation: (id: string) => api.delete(`/evaluations/chairman/${id}`),
    deletePersonnelEvaluation: (id: string) => api.delete(`/evaluations/personnel/${id}`),
};
