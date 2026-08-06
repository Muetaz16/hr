import api from './apiClient';
import type { Candidate } from '../types';

export const candidateService = {
    getCandidates: async (params?: { requisitionId?: string; stage?: string }): Promise<Candidate[]> => {
        const response = await api.get('/candidates', { params });
        return response.data;
    },

    createCandidate: async (data: {
        requisitionId: string; fullName: string; phone?: string; email?: string;
        source?: string; speciality?: string; yearsExperience?: string; salaryExpectation?: string;
        nationality?: string; dateOfBirth?: string; placeOfLiving?: string;
        salaryStructure?: string; jobGrade?: string; placeOfWork?: string; contractMonths?: number | string;
        residentStatus?: string;
        cv?: File | null; degree?: File | null; portfolio?: File | null;
    }): Promise<Candidate> => {
        const form = new FormData();
        form.append('requisitionId', data.requisitionId);
        form.append('fullName', data.fullName);
        const textFields: (keyof typeof data)[] = ['phone', 'email', 'source', 'speciality', 'yearsExperience', 'salaryExpectation', 'nationality', 'dateOfBirth', 'placeOfLiving', 'salaryStructure', 'jobGrade', 'placeOfWork', 'contractMonths', 'residentStatus'];
        textFields.forEach(k => { const v = data[k]; if (v !== undefined && v !== null && v !== '') form.append(k as string, String(v)); });
        if (data.cv) form.append('cv', data.cv);
        if (data.degree) form.append('degree', data.degree);
        if (data.portfolio) form.append('portfolio', data.portfolio);
        const response = await api.post('/candidates', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data;
    },

    screen: async (id: string, decision: 'ACCEPTED' | 'REJECTED', note?: string): Promise<Candidate> => {
        const response = await api.post(`/candidates/${id}/screen`, { decision, note });
        return response.data;
    },

    scheduleInterview: async (id: string, data: { interviewAt: string; interviewLocation?: string; interviewNote?: string }): Promise<Candidate> => {
        const response = await api.post(`/candidates/${id}/interview`, data);
        return response.data;
    },

    submitHrEval: async (id: string, data: { criteria: Record<string, number>; recommend: boolean; note?: string }): Promise<Candidate> => {
        const response = await api.post(`/candidates/${id}/hr-eval`, data);
        return response.data;
    },

    submitTechEval: async (id: string, data: { criteria: Record<string, number>; recommend: boolean; note?: string }): Promise<Candidate> => {
        const response = await api.post(`/candidates/${id}/tech-eval`, data);
        return response.data;
    },

    finalize: async (id: string, decision: 'ACCEPTED' | 'REJECTED', note?: string): Promise<Candidate> => {
        const response = await api.post(`/candidates/${id}/finalize`, { decision, note });
        return response.data;
    },

    recordOffer: async (id: string, decision: 'ACCEPTED' | 'DECLINED', note?: string): Promise<Candidate> => {
        const response = await api.post(`/candidates/${id}/offer`, { decision, note });
        return response.data;
    },

    markHired: async (id: string, employeeId: string): Promise<Candidate> => {
        const response = await api.post(`/candidates/${id}/hire`, { employeeId });
        return response.data;
    },

    // Downloads the pre-filled bilingual job-offer .docx (built from the details captured
    // when the candidate was added to the hiring list).
    generateOffer: async (id: string): Promise<Blob> => {
        const response = await api.get(`/candidates/${id}/offer`, { responseType: 'blob' });
        return response.data;
    },

    // Downloads the pre-filled bilingual Interview Evaluation Form .docx.
    generateEvaluation: async (id: string): Promise<Blob> => {
        const response = await api.get(`/candidates/${id}/evaluation`, { responseType: 'blob' });
        return response.data;
    },

    // Completes the offer parameters (salary structure, grade, residency, place of work, contract length).
    updateOfferDetails: async (id: string, data: {
        salaryStructure?: string; jobGrade?: string; placeOfWork?: string;
        contractMonths?: number; residentStatus?: string; yearsExperience?: string; salaryExpectation?: string; jobCategory?: string;
    }): Promise<Candidate> => {
        const response = await api.patch(`/candidates/${id}/offer-details`, data);
        return response.data;
    },

    getCandidateById: async (id: string): Promise<Candidate> => {
        const response = await api.get(`/candidates/${id}`);
        return response.data;
    },

    // Generates (or re-fetches) the private onboarding link token for a candidate.
    generateOnboardingLink: async (id: string): Promise<{ token: string; status: string }> => {
        const response = await api.post(`/candidates/${id}/onboarding-link`);
        return response.data;
    },

    deleteCandidate: async (id: string): Promise<void> => {
        await api.delete(`/candidates/${id}`);
    },
};
