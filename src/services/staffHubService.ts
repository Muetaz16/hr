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
    attachmentUrl?: string;
    attachmentName?: string;
    managerNote?: string;
    hrNote?: string;
    // PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE only ever use PENDING/COMPLETED/REJECTED going
    // forward (see LeaveApprovalStep below for their per-stage chain); the APPROVED_BY_* values
    // remain valid for the other request types (LATE_COMING/EARLY_LEAVING/HOURS_LEAVE) and older history.
    status: 'PENDING' | 'APPROVED_BY_UNIT' | 'APPROVED_BY_DEPT' | 'APPROVED_BY_DIVISION' | 'APPROVED_BY_DIRECTOR' | 'REJECTED' | 'COMPLETED';
    createdAt: string;
}

// One (stage, required approver) row in a leave request's org-based approval chain — see
// resolveApprovalChain on the backend for how the chain is derived.
export interface LeaveApprovalStep {
    id: string;
    leaveRequestId: string;
    sequence: number;
    stage: 'UNIT_HEAD' | 'DEPT_HEAD' | 'DIVISION_HEAD' | 'HR_MANAGER' | 'ADMIN_DIRECTOR' | 'GENERAL_MANAGER';
    approverUserId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
    note?: string;
    decidedAt?: string;
    createdAt: string;
    leaveRequest?: LeaveRequest & { employee?: { fullName: string; staffId?: string } };
    approver?: { fullName: string };
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
    category: 'ASSIGNED' | 'SELF_REPORT';
    isReviewed: boolean;
    createdAt: string;
    updatedAt: string;
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
    attachmentUrl?: string;
    attachmentName?: string;
    expiryDate?: string;
    createdAt: string;
}

export const staffHubService = {
    // Requests
    async createRequest(data: FormData | Partial<LeaveRequest>) {
        const response = await api.post('/staff-hub/requests', data, {
            headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {}
        });
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
    async getPendingRequests(filters: { departmentId?: string; groupId?: string; unitId?: string; divisionId?: string; status?: string }) {
        const response = await api.get('/staff-hub/requests/pending', { params: filters });
        return response.data;
    },

    // New org-chain approval steps (PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE only) — identity-
    // scoped server-side, no role/org filtering needed client-side.
    async getMyPendingSteps(): Promise<LeaveApprovalStep[]> {
        const response = await api.get('/staff-hub/requests/my-pending-steps');
        return response.data;
    },
    async decideApprovalStep(requestId: string, stepId: string, decision: 'APPROVE' | 'REJECT', note?: string) {
        const response = await api.patch(`/staff-hub/requests/${requestId}/steps/${stepId}/decision`, { decision, note });
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
    async reviewTask(id: string) {
        const response = await api.patch(`/staff-hub/tasks/${id}/review`);
        return response.data;
    },


    // Announcements
    async createAnnouncement(data: FormData | Partial<Announcement>) {
        const response = await api.post('/staff-hub/announcements', data, {
            headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {}
        });
        return response.data;
    },
    async updateAnnouncement(id: string, data: FormData | Partial<Announcement>) {
        const response = await api.put(`/staff-hub/announcements/${id}`, data, {
            headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {}
        });
        return response.data;
    },
    async deleteAnnouncement(id: string) {
        const response = await api.delete(`/staff-hub/announcements/${id}`);
        return response.data;
    },
    async getAllAnnouncements() {
        const response = await api.get('/staff-hub/announcements/all');
        return response.data;
    },
    async getAnnouncements(userId: string, departmentId: string) {
        const response = await api.get(`/staff-hub/announcements/user/${userId}/${departmentId}`);
        return response.data;
    }
};
