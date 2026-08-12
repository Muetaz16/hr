import api from './apiClient';
import type { JobDescription } from '../types';

export const jobDescriptionService = {
    async getAllJobDescriptions(): Promise<JobDescription[]> {
        const response = await api.get('/job-descriptions');
        return response.data;
    },

    async createJobDescription(data: Partial<JobDescription>): Promise<JobDescription> {
        const response = await api.post('/job-descriptions', data);
        return response.data;
    },

    async updateJobDescription(id: string, data: Partial<JobDescription>): Promise<JobDescription> {
        const response = await api.put(`/job-descriptions/${id}`, data);
        return response.data;
    },

    async deleteJobDescription(id: string): Promise<void> {
        await api.delete(`/job-descriptions/${id}`);
    },

    // Downloads the filled bilingual Job Description .docx. variant: 'general' (with approval
    // signatures) or 'emp' (employee copy with acknowledgment).
    async generateDocument(id: string, variant: 'general' | 'emp'): Promise<Blob> {
        const response = await api.get(`/job-descriptions/${id}/document`, {
            params: { variant },
            responseType: 'blob',
        });
        return response.data;
    }
};
