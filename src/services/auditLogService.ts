import api from './apiClient';

export interface AuditLog {
    id: string;
    userId?: string | null;
    userName?: string | null;
    userRole?: string | null;
    action: string;
    details?: string | null;
    method: string;
    path: string;
    statusCode?: number | null;
    createdAt: string;
}

export interface AuditLogPage {
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export const auditLogService = {
    async list(params: { q?: string; method?: string; from?: string; to?: string; page?: number; limit?: number } = {}): Promise<AuditLogPage> {
        const response = await api.get('/audit-logs', { params });
        return response.data;
    },
};
