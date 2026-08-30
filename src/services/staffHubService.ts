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
    // Work Authorization (out-work) specifics — only set when type === 'WORK_AUTHORIZATION'.
    workOrderType?: string;
    placeOfAssignment?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    finalDocumentUrl?: string;   // document the GM uploaded to grant final approval
    finalDocumentName?: string;
    managerNote?: string;
    hrNote?: string;
    // Replacement (cover) employee nomination. replacementStatus: null = not required |
    // PENDING (awaiting the nominee) | APPROVED | REJECTED.
    replacementUserId?: string | null;
    replacementStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    replacementDecidedAt?: string | null;
    // PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE only ever use PENDING/COMPLETED/REJECTED going
    // forward (see LeaveApprovalStep below for their per-stage chain); the APPROVED_BY_* values
    // remain valid for the other request types (LATE_COMING/EARLY_LEAVING/HOURS_LEAVE) and older history.
    status: 'PENDING' | 'APPROVED_BY_UNIT' | 'APPROVED_BY_DEPT' | 'APPROVED_BY_DIVISION' | 'APPROVED_BY_DIRECTOR' | 'REJECTED' | 'COMPLETED';
    createdAt: string;
    updatedAt?: string;
    // Present on the org-chain leave types — the ordered approval trail (who signs, in what order).
    approvalSteps?: {
        id: string;
        sequence: number;
        stage: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
        decidedAt?: string;
        note?: string;
        approver?: { fullName: string; role: string };
    }[];
}

// A leave request joined with its employee — the shape returned by the list endpoints.
export type LeaveRequestWithEmployee = LeaveRequest & {
    employee?: { fullName: string; staffId?: string; bioId?: number; position?: string };
};

// One (stage, required approver) row in a leave request's org-based approval chain — see
// resolveApprovalChain on the backend for how the chain is derived.
export interface LeaveApprovalStep {
    id: string;
    leaveRequestId: string;
    sequence: number;
    stage: 'HEAD_ATTENDANCE' | 'UNIT_HEAD' | 'DEPT_HEAD' | 'DIVISION_HEAD' | 'HR_MANAGER' | 'DIRECTORATE' | 'GENERAL_MANAGER';
    // The printed form rows this one signature fills (smart signature: one person may hold several
    // posts and cover several rows with a single approval).
    coversStages?: string[];
    approverUserId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
    note?: string;
    decidedAt?: string;
    createdAt: string;
    leaveRequest?: LeaveRequest & { employee?: { fullName: string; staffId?: string } };
    approver?: { fullName: string };
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
    // Colleagues the requester may nominate as their leave replacement (same department, has a
    // login). Empty list => requester is the only account in their department, so it may be skipped.
    async getReplacementCandidates(employeeId: string): Promise<{ userId: string; employeeId: string; fullName: string; position: string }[]> {
        const response = await api.get('/staff-hub/replacement-candidates', { params: { employeeId } });
        return response.data;
    },
    // Leave requests where I've been nominated as the replacement and haven't responded yet.
    async getMyReplacementRequests(): Promise<LeaveRequestWithEmployee[]> {
        const response = await api.get('/staff-hub/my-replacement-requests');
        return response.data;
    },
    // Accept or decline a replacement nomination. Accepting stamps my signature on the form and
    // unblocks my colleague's approval chain.
    async decideReplacement(requestId: string, decision: 'ACCEPT' | 'DECLINE') {
        const response = await api.patch(`/staff-hub/requests/${requestId}/replacement-decision`, { decision });
        return response.data;
    },
    async getPendingRequests(filters: { departmentId?: string; groupId?: string; unitId?: string; divisionId?: string; status?: string }) {
        const response = await api.get('/staff-hub/requests/pending', { params: filters });
        return response.data;
    },
    // Fully-approved leaves — the saved record shown on the Approved Leaves page and the
    // Attendance overview. Reuses the pending-requests endpoint with a COMPLETED status filter.
    async getApprovedLeaves(): Promise<LeaveRequestWithEmployee[]> {
        const response = await api.get('/staff-hub/requests/pending', { params: { status: 'COMPLETED' } });
        return response.data;
    },
    // Downloads the official Leave Request Form (.docx) for a request, filled with the employee's
    // details, leave details, balances and each approver's signature so far. Works at any stage.
    async getLeaveForm(requestId: string): Promise<Blob> {
        const response = await api.get(`/staff-hub/requests/${requestId}/form`, { responseType: 'blob' });
        return response.data;
    },

    // New org-chain approval steps (PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE only) — identity-
    // scoped server-side, no role/org filtering needed client-side.
    async getMyPendingSteps(): Promise<LeaveApprovalStep[]> {
        const response = await api.get('/staff-hub/requests/my-pending-steps');
        return response.data;
    },
    async decideApprovalStep(requestId: string, stepId: string, decision: 'APPROVE' | 'REJECT', note?: string, document?: File | null) {
        if (document) {
            const fd = new FormData();
            fd.append('decision', decision);
            if (note) fd.append('note', note);
            fd.append('document', document);
            const response = await api.patch(`/staff-hub/requests/${requestId}/steps/${stepId}/decision`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        }
        const response = await api.patch(`/staff-hub/requests/${requestId}/steps/${stepId}/decision`, { decision, note });
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
