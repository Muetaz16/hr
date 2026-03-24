import api from './apiClient';
import type { Unit } from '../types';

export const unitService = {
    getAllUnits: async (): Promise<Unit[]> => {
        const response = await api.get('/units');
        return response.data;
    },

    createUnit: async (data: Omit<Unit, 'id'>): Promise<Unit> => {
        const response = await api.post('/units', data);
        return response.data;
    },

    updateUnit: async (id: string, data: Partial<Unit>): Promise<Unit> => {
        const response = await api.put(`/units/${id}`, data);
        return response.data;
    },

    deleteUnit: async (id: string): Promise<void> => {
        await api.delete(`/units/${id}`);
    }
};
