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
    }
};
