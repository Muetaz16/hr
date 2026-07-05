import apiClient from './apiClient';

export interface AssetRequest {
    id: string;
    employeeId: string;
    requesterId: string;
    itemType: string;
    status: 'PENDING' | 'PREPARING' | 'READY' | 'ASSIGNED' | 'REJECTED';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    notes?: string;
    createdAt: string;
    employee?: {
        fullName: string;
        staffId: string;
        position?: string;
        department?: { name: string };
        unit?: { name: string };
    };
    requester?: {
        fullName: string;
        role: string;
    };
}

export interface SupportTicket {
    id: string;
    requesterId: string;
    title: string;
    description: string;
    category: 'IT' | 'FACILITY' | 'HR';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    resolution?: string;
    createdAt: string;
    estimatedReadyAt?: string;
    assigneeId?: string;
    assignee?: {
        fullName: string;
        role: string;
    };
    requester?: {
        fullName: string;
        email?: string;
        role: string;
        employee?: {
            staffId: string;
            position?: string;
            department?: { name: string };
            unit?: { name: string };
        }
    };
}

export const operationsService = {
    // Assets
    createAssetRequest: async (data: Partial<AssetRequest>) => {
        const response = await apiClient.post('/operations/assets', data);
        return response.data;
    },
    updateAssetStatus: async (id: string, status: string, notes?: string, priority?: string) => {
        const response = await apiClient.patch(`/operations/assets/${id}`, { status, notes, priority });
        return response.data;
    },
    getAssetRequests: async (status?: string) => {
        const response = await apiClient.get('/operations/assets', { params: { status } });
        return response.data as AssetRequest[];
    },

    // Support Tickets
    createTicket: async (data: Partial<SupportTicket>) => {
        const response = await apiClient.post('/operations/tickets', data);
        return response.data;
    },
    updateTicketStatus: async (id: string, status: string, resolution?: string, priority?: string) => {
        const response = await apiClient.patch(`/operations/tickets/${id}`, { status, resolution, priority });
        return response.data;
    },
    assignTicket: async (id: string, assigneeId: string, estimatedReadyAt?: string) => {
        const response = await apiClient.patch(`/operations/tickets/${id}/assign`, { assigneeId, estimatedReadyAt });
        return response.data;
    },
    getTickets: async (params?: { status?: string; category?: string }) => {
        const response = await apiClient.get('/operations/tickets', { params });
        return response.data as SupportTicket[];
    },
    deleteTicket: async (id: string) => {
        const response = await apiClient.delete(`/operations/tickets/${id}`);
        return response.data;
    }
};
