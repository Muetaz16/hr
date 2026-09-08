import api from './apiClient';
import type { ServiceProvider } from '../types';

export type ServiceProviderInput = Omit<ServiceProvider, 'id' | '_count'>;

export const serviceProviderService = {
    getAll: async (): Promise<ServiceProvider[]> => {
        const response = await api.get('/service-providers');
        return response.data;
    },

    create: async (data: ServiceProviderInput): Promise<ServiceProvider> => {
        const response = await api.post('/service-providers', data);
        return response.data;
    },

    update: async (id: string, data: Partial<ServiceProviderInput>): Promise<ServiceProvider> => {
        const response = await api.put(`/service-providers/${id}`, data);
        return response.data;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(`/service-providers/${id}`);
    },
};
