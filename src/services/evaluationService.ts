import api from './apiClient';
import type { UnitEvaluation, DepartmentEvaluation, DirectorEvaluation, PersonnelEvaluation } from '../types';

export const evaluationService = {
    // Bulk fetch helpers for Analytics
    async getDirectorEvaluationsByMonth(month: string): Promise<DirectorEvaluation[]> {
        const response = await api.get(`/evaluations/director/month/${month}`);
        return response.data;
    },

    async getDeptEvaluationsByMonth(month: string): Promise<DepartmentEvaluation[]> {
        const response = await api.get(`/evaluations/dept/month/${month}`);
        return response.data;
    },

    async getPersonnelEvaluationsByMonth(month: string): Promise<PersonnelEvaluation[]> {
        const response = await api.get(`/evaluations/personnel/month/${month}`);
        return response.data;
    },

    async getPersonnelEvaluation(employeeId: string, month: string): Promise<PersonnelEvaluation | null> {
        try {
            const response = await api.get(`/evaluations/personnel?employeeId=${employeeId}&month=${month}`);
            return response.data || null;
        } catch (error) {
            return null;
        }
    },

    async savePersonnelEvaluation(evalData: Omit<PersonnelEvaluation, 'id'>) {
        const response = await api.post('/evaluations/personnel', evalData);
        return response.data;
    },

    async getDeptEvaluation(employeeId: string, month: string): Promise<DepartmentEvaluation | null> {
        try {
            const response = await api.get(`/evaluations/dept?employeeId=${employeeId}&month=${month}`);
            return response.data || null;
        } catch (error) {
            return null;
        }
    },

    async getUnitEvaluation(employeeId: string, month: string): Promise<UnitEvaluation | null> {
        try {
            const response = await api.get(`/evaluations/unit?employeeId=${employeeId}&month=${month}`);
            return response.data || null;
        } catch (error) {
            return null;
        }
    },

    async saveUnitEvaluation(evalData: Omit<UnitEvaluation, 'id'>) {
        const totalScore =
            (evalData.relationshipWithColleagues || 0) +
            (evalData.teamworkParticipation || 0) +
            (evalData.workOrganization || 0) +
            (evalData.communicationSkills || 0) +
            (evalData.regulatoryCompliance || 0) +
            (evalData.taskQuality || 0) +
            (evalData.timeCommitment || 0) +
            (evalData.organizationalCompliance || 0) +
            (evalData.problemSolving || 0) +
            (evalData.pressureHandling || 0) +
            (evalData.continuousDevelopment || 0) +
            (evalData.regulationsAdherence || 0) +
            (evalData.safetyAdherence || 0) +
            (evalData.appearanceCommitment || 0) +
            (evalData.resourcePreservation || 0) +
            (evalData.dataPrivacy || 0);

        const dataToSave = { ...evalData, totalScore };
        await api.post('/evaluations/unit', dataToSave);
    },

    async saveDeptEvaluation(evalData: Omit<DepartmentEvaluation, 'id'>) {
        // Logic for totalScore calculation should be in Backend ideally, or keep here.
        // Keeping here to match payload structure.
        const totalScore =
            (evalData.relationshipWithColleagues || 0) +
            (evalData.teamworkParticipation || 0) +
            (evalData.workOrganization || 0) +
            (evalData.communicationSkills || 0) +
            (evalData.regulatoryCompliance || 0) +
            (evalData.taskQuality || 0) +
            (evalData.timeCommitment || 0) +
            (evalData.organizationalCompliance || 0) +
            (evalData.problemSolving || 0) +
            (evalData.pressureHandling || 0) +
            (evalData.continuousDevelopment || 0) +
            (evalData.regulationsAdherence || 0) +
            (evalData.safetyAdherence || 0) +
            (evalData.appearanceCommitment || 0) +
            (evalData.resourcePreservation || 0) +
            (evalData.dataPrivacy || 0);

        const dataToSave = { ...evalData, totalScore };
        await api.post('/evaluations/dept', dataToSave);
    },

    async getDirectorEvaluation(employeeId: string, month: string): Promise<DirectorEvaluation | null> {
        try {
            const response = await api.get(`/evaluations/director?employeeId=${employeeId}&month=${month}`);
            return response.data || null;
        } catch (error) {
            return null;
        }
    },

    async saveDirectorEvaluation(evalData: Omit<DirectorEvaluation, 'id' | 'locked' | 'lockedAt'>) {
        const finalScore =
            (evalData.relationshipWithColleagues || 0) +
            (evalData.teamworkParticipation || 0) +
            (evalData.workOrganization || 0) +
            (evalData.communicationSkills || 0) +
            (evalData.regulatoryCompliance || 0) +
            (evalData.taskQuality || 0) +
            (evalData.timeCommitment || 0) +
            (evalData.organizationalCompliance || 0) +
            (evalData.problemSolving || 0) +
            (evalData.pressureHandling || 0) +
            (evalData.continuousDevelopment || 0) +
            (evalData.regulationsAdherence || 0) +
            (evalData.safetyAdherence || 0) +
            (evalData.appearanceCommitment || 0) +
            (evalData.resourcePreservation || 0) +
            (evalData.dataPrivacy || 0);

        const dataToSave = { ...evalData, finalScore };
        const res = await api.post('/evaluations/director', dataToSave);
        return res.data.id;
    },

    async lockEvaluation(id: string) {
        await api.post('/evaluations/director/lock', { id });
    },

    // Delete Methods (Super Admin)
    async deleteHREvaluation(id: string) {
        return api.delete(`/evaluations/hr/${id}`);
    },

    async deleteDeptEvaluation(id: string) {
        return api.delete(`/evaluations/dept/${id}`);
    },

    async deleteUnitEvaluation(id: string) {
        return api.delete(`/evaluations/unit/${id}`);
    },

    async deleteDirectorEvaluation(id: string) {
        return api.delete(`/evaluations/director/${id}`);
    },

    async deletePersonnelEvaluation(id: string) {
        return api.delete(`/evaluations/personnel/${id}`);
    }
};
