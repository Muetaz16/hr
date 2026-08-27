import api from './apiClient';

export interface DashboardAnalytics {
    workforce: {
        active: number;
        pendingEnrollment: number;
        transferred: number;
        newHiresThisYear: number;
    };
    recruitmentFunnel: { stage: string; label: string; count: number }[];
    recruitment: {
        openRequisitions: number;
        positionsToFill: number;
        rejected: number;
        withdrawn: number;
    };
    headcountByDepartment: { name: string; count: number }[];
    contractExpiry: { bucket: string; label: string; count: number }[];
    leaveByType: { type: string; label: string; count: number }[];
}

export const dashboardService = {
    async getAnalytics(): Promise<DashboardAnalytics> {
        const res = await api.get('/dashboard/analytics');
        return res.data;
    },
};
