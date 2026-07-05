import api from './apiClient';
import type { Directorate } from '../types';

export const directorateService = {
    async getAllDirectorates(): Promise<Directorate[]> {
        const response = await api.get('/directorates');
        return response.data;
    },

    async createDirectorate(data: Partial<Directorate>): Promise<Directorate> {
        const response = await api.post('/directorates', data);
        return response.data;
    },

    async updateDirectorate(id: string, data: Partial<Directorate>): Promise<Directorate> {
        const response = await api.put(`/directorates/${id}`, data);
        return response.data;
    },

    async deleteDirectorate(id: string): Promise<void> {
        await api.delete(`/directorates/${id}`);
    }
};
