import api from './apiClient';
import type { RecruitmentRequest } from '../types';

export const recruitmentService = {
    getAllRequests: async (params?: { status?: string; departmentId?: string }): Promise<RecruitmentRequest[]> => {
        const response = await api.get('/recruitment', { params });
        return response.data;
    },

    createRequest: async (data: Partial<RecruitmentRequest> & { reason?: string }): Promise<RecruitmentRequest> => {
        const response = await api.post('/recruitment', { ...data });
        return response.data;
    },

    updateRequest: async (id: string, data: Partial<RecruitmentRequest>): Promise<RecruitmentRequest> => {
        const response = await api.put(`/recruitment/${id}`, { ...data });
        return response.data;
    },

    updateStatus: async (id: string, status: string, note?: string): Promise<RecruitmentRequest> => {
        const response = await api.put(`/recruitment/${id}/status`, { status, note });
        return response.data;
    },

    markFilled: async (id: string): Promise<RecruitmentRequest> => {
        const response = await api.put(`/recruitment/${id}/status`, { status: 'FILLED' });
        return response.data;
    },

    // Advance the current stage of a HIRE requisition's PRF approval flow. The GM's final
    // approval must include the signed document (sent as multipart).
    prfApprove: async (id: string, decision: 'approve' | 'reject', note?: string, file?: File | null): Promise<RecruitmentRequest> => {
        if (file) {
            const fd = new FormData();
            fd.append('decision', decision);
            if (note) fd.append('note', note);
            fd.append('document', file);
            const response = await api.post(`/recruitment/${id}/prf-approve`, fd);
            return response.data;
        }
        const response = await api.post(`/recruitment/${id}/prf-approve`, { decision, note });
        return response.data;
    },

    // Download the Personnel Requisition Form (.docx) for a requisition.
    generatePrf: async (id: string): Promise<Blob> => {
        const response = await api.get(`/recruitment/${id}/prf`, { responseType: 'blob' });
        return response.data;
    },

    deleteRequest: async (id: string): Promise<void> => {
        await api.delete(`/recruitment/${id}`);
    }
};
