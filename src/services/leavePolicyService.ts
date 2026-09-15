import api from './apiClient';

// The leave policy numbers. Readable by every signed-in user — the request screen needs the notice
// window to warn about it before submitting — and editable with manage_leaves.
export interface LeavePolicy {
    noticeDays: number;
    emergencyLeaveAllowance: number;
    unpaidLeaveAllowance: number;
}

// Matches the server's fallbacks. Used only when the read fails, so a settings outage degrades to
// the familiar rule instead of to "no notice required at all".
export const LEAVE_POLICY_DEFAULTS: LeavePolicy = {
    noticeDays: 14,
    emergencyLeaveAllowance: 3,
    unpaidLeaveAllowance: 14,
};

export const leavePolicyService = {
    async get(): Promise<LeavePolicy> {
        const res = await api.get('/leave-policy');
        return res.data;
    },
    async update(values: Partial<LeavePolicy>): Promise<LeavePolicy> {
        const res = await api.patch('/leave-policy', values);
        return res.data;
    },
};
