import api from './apiClient';

export interface AppNotification {
    id: string;
    title: string;
    content: string;
    link?: string | null;
    isRead: boolean;
    createdAt: string;
}

export const notificationService = {
    getMine: async (): Promise<{ notifications: AppNotification[]; unread: number }> => {
        const res = await api.get('/notifications');
        return res.data;
    },
    markRead: async (id: string): Promise<void> => {
        await api.post(`/notifications/${id}/read`);
    },
    markAllRead: async (): Promise<void> => {
        await api.post('/notifications/read-all');
    },
};
