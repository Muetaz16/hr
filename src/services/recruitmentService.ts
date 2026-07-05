import api from './apiClient';
import type { RecruitmentRequest } from '../types';

export const recruitmentService = {
    getAllRequests: async (params?: { status?: string; departmentId?: string }): Promise<RecruitmentRequest[]> => {
        const response = await api.get('/recruitment', { params });
        return response.data;
    },

    createRequest: async (data: { jobTitle: string; reason?: string; unitId?: string; departmentId: string }): Promise<RecruitmentRequest> => {
        const response = await api.post('/recruitment', { ...data });
        return response.data;
    },

    updateRequest: async (id: string, data: { jobTitle: string; reason?: string; unitId?: string; departmentId: string }): Promise<RecruitmentRequest> => {
        const response = await api.put(`/recruitment/${id}`, { ...data });
        return response.data;
    },

    updateStatus: async (id: string, status: string, note?: string): Promise<RecruitmentRequest> => {
        const response = await api.put(`/recruitment/${id}/status`, { status, note });
        return response.data;
    },

    deleteRequest: async (id: string): Promise<void> => {
        await api.delete(`/recruitment/${id}`);
    }
};
