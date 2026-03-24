import api from './apiClient';

export interface LeaveRequest {
    id: string;
    employeeId: string;
    userId: string;
    type: string;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
    managerNote?: string;
    hrNote?: string;
    status: 'PENDING' | 'APPROVED_BY_MANAGER' | 'REJECTED' | 'COMPLETED';
    createdAt: string;
}

export interface StaffTask {
    id: string;
    authorId: string;
    assigneeId?: string;
    departmentId?: string;
    title: string;
    content?: string;
    deadline?: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
    createdAt: string;
    author?: { fullName: string; role: string };
    assignee?: { fullName: string; role: string };
    department?: { name: string };
}

export interface Announcement {
    id: string;
    authorId: string;
    targetType: 'GLOBAL' | 'DEPARTMENT' | 'INDIVIDUAL';
    targetId?: string;
    title: string;
    content: string;
    expiryDate?: string;
    createdAt: string;
}

export const staffHubService = {
    // Requests
    async createRequest(data: Partial<LeaveRequest>) {
        const response = await api.post('/staff-hub/requests', data);
        return response.data;
    },
    async updateRequestStatus(id: string, statusData: { status: string; managerNote?: string; hrNote?: string }) {
        const response = await api.patch(`/staff-hub/requests/${id}/status`, statusData);
        return response.data;
    },
    async getMyRequests(employeeId: string) {
        const response = await api.get(`/staff-hub/requests/employee/${employeeId}`);
        return response.data;
    },
    async getPendingRequests(filters: { departmentId?: string; groupId?: string; unitId?: string; status?: string }) {
        const response = await api.get('/staff-hub/requests/pending', { params: filters });
        return response.data;
    },

    // Tasks
    async createTask(data: Partial<StaffTask>) {
        const response = await api.post('/staff-hub/tasks', data);
        return response.data;
    },
    async updateTaskStatus(id: string, status: string) {
        const response = await api.patch(`/staff-hub/tasks/${id}/status`, { status });
        return response.data;
    },
    async getMyTasks(userId: string, departmentId: string) {
        const response = await api.get(`/staff-hub/tasks/user/${userId}/${departmentId}`);
        return response.data;
    },
    async getScopedTasks(status?: string) {
        const response = await api.get('/staff-hub/tasks/scoped', { params: { status } });
        return response.data;
    },


    // Announcements
    async createAnnouncement(data: Partial<Announcement>) {
        const response = await api.post('/staff-hub/announcements', data);
        return response.data;
    },
    async getAnnouncements(userId: string, departmentId: string) {
        const response = await api.get(`/staff-hub/announcements/user/${userId}/${departmentId}`);
        return response.data;
    }
};
