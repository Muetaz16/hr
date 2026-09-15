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
    // Exceptional Performance Award only — the bonus % (5-25) the nominating Head proposed, plus
    // the 2 other fields required by the real "EXCEPTIONAL CONTRIBUTION REWARD" template.
    proposedBonusPercent?: number | null;
    natureOfContribution?: string | null;
    payrollCoverageMonth?: string | null;
    // Missing Biometric Log (missing-punch) specifics — only set when type === 'MISSING_PUNCH'.
    missingPunchType?: string;       // CHECK_IN | CHECK_OUT | BOTH
    missingPunchReason?: string;     // FORGOT | DEVICE_ISSUE | POWER_OUTAGE | OTHERS
    // Attendance permissions only — the reason box ticked on the printed form.
    permissionReason?: string;       // PERSONAL | FAMILY | HEALTH_MEDICAL | OTHERS
    // Direct register entry — recorded by an officer against a signed authorisation, with no
    // approval chain. deductFromBalance says whether the days were charged to the employee.
    directEntry?: boolean;
    directEntryByName?: string | null;
    deductFromBalance?: boolean;
    // The punch time. startTime/endTime hold what the employee asked for; approvedStartTime/
    // approvedEndTime hold an approver's correction and stay null while untouched. The effective
    // time is `approved ?? requested`, falling back to the employee's schedule when both are absent.
    // Why this leave was filed inside the notice window. Non-null means an exception was
    // taken and the attachment is the letter authorising it.
    shortNoticeReason?: string | null;
    approvedStartTime?: string | null;
    approvedEndTime?: string | null;
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
    status: 'PENDING' | 'APPROVED_BY_UNIT' | 'APPROVED_BY_DEPT' | 'APPROVED_BY_DIVISION' | 'APPROVED_BY_DIRECTOR' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
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
    leaveRequest?: LeaveRequest & {
        employee?: { fullName: string; staffId?: string };
        // Who has to accept the cover before the chain starts. Sent so an approver can be told the
        // request is parked on that person rather than on them.
        replacementUser?: { id: string; fullName?: string | null; email?: string | null } | null;
    };
    approver?: { fullName: string };
}

// A nomination team member — the shape of one employee returned by getMyNominationTeam.
export interface NominationTeamEmployee {
    id: string;
    fullName: string;
    staffId?: string | null;
    position?: string | null;
    department?: { name: string } | null;
}

export interface ExceptionalPerformanceEligibility {
    eligible: boolean;
    isResident: boolean;
    isFullTime: boolean;
    grantedCount: number;
    contractStartDate?: string | null;
    reasons: string[];
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
    // The creator withdraws their own in-flight request (any type). Only works while the request is
    // still PENDING — the server rejects cancelling a finalised (completed/rejected) request.
    async cancelRequest(requestId: string) {
        const response = await api.patch(`/staff-hub/requests/${requestId}/cancel`);
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
        // attendanceOnly: the register promises every row reached the attendance system, so types
        // that complete elsewhere (an Exceptional Performance nomination becomes a RewardCase) are
        // excluded server-side rather than hidden here.
        const response = await api.get('/staff-hub/requests/pending', { params: { status: 'COMPLETED', attendanceOnly: 1 } });
        return response.data;
    },
    // Record a leave granted on paper outside the system: no notice rule, no balance check, no
    // approval chain. The signed authorisation is mandatory and the server refuses without it.
    async recordDirectLeave(data: FormData) {
        const response = await api.post('/staff-hub/requests/direct-leave', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data as { id: string; dayCount: number; attendanceWarning?: string | null };
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

    /** This user's OWN decision record — steps they approved or rejected, newest first. */
    async getMyDecidedSteps(): Promise<LeaveApprovalStep[]> {
        const response = await api.get('/staff-hub/requests/my-decided-steps');
        return response.data;
    },
    // `punch` carries a Missing Biometric Log time correction. It rides on the approval instead of
    // having its own save call, so a time can never be stored against a request nobody approved.
    async decideApprovalStep(
        requestId: string,
        stepId: string,
        decision: 'APPROVE' | 'REJECT',
        note?: string,
        document?: File | null,
        punch?: { startTime?: string; endTime?: string } | null,
    ) {
        if (document) {
            const fd = new FormData();
            fd.append('decision', decision);
            if (note) fd.append('note', note);
            if (punch?.startTime) fd.append('missingPunchStartTime', punch.startTime);
            if (punch?.endTime) fd.append('missingPunchEndTime', punch.endTime);
            fd.append('document', document);
            const response = await api.patch(`/staff-hub/requests/${requestId}/steps/${stepId}/decision`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        }
        const response = await api.patch(`/staff-hub/requests/${requestId}/steps/${stepId}/decision`, {
            decision, note,
            ...(punch?.startTime ? { missingPunchStartTime: punch.startTime } : {}),
            ...(punch?.endTime ? { missingPunchEndTime: punch.endTime } : {}),
        });
        return response.data;
    },

    // Exceptional Performance Award — a Head's own team (for the nomination picker), a live
    // eligibility preview, and the Head's own submitted nominations (employeeId there is the
    // nominee, not the submitter, so getMyRequests can't be reused for this).
    async getMyNominationTeam(): Promise<{ employees: NominationTeamEmployee[] }> {
        const response = await api.get('/staff-hub/my-nomination-team');
        return response.data;
    },
    async getExceptionalPerformanceEligibility(employeeId: string): Promise<ExceptionalPerformanceEligibility> {
        const response = await api.get(`/staff-hub/exceptional-performance-eligibility/${employeeId}`);
        return response.data;
    },
    async getMySubmittedNominations(): Promise<LeaveRequestWithEmployee[]> {
        const response = await api.get('/staff-hub/my-submitted-nominations');
        return response.data;
    },
    // Every Exceptional Performance nomination ever submitted — the dedicated award screen's
    // History tab (broad visibility: HR Manager/Personnel/General Manager/Super Admin).
    async getExceptionalPerformanceHistory(): Promise<LeaveRequest[]> {
        const response = await api.get('/staff-hub/exceptional-performance/history');
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
