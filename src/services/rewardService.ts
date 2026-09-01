import api from './apiClient';

export type RewardType = 'EMPLOYEE_OF_MONTH' | 'ATTENDANCE_EXCELLENCE' | 'EMPLOYEE_OF_YEAR' | 'LOYALTY_MILESTONE' | 'EXCEPTIONAL_PERFORMANCE';

export interface RewardCaseEmployee {
    id: string;
    fullName: string;
    staffId?: string | null;
    position?: string | null;
    jobCategory?: string | null;
    jobGrade?: string | null;
    joinDate?: string | null;
    department?: { name: string; isOffice?: boolean } | null;
    division?: { name: string } | null;
    unit?: { name: string } | null;
}

export interface RewardCase {
    id: string;
    caseNumber: string;
    employeeId: string;
    employee?: RewardCaseEmployee;

    type: RewardType;
    period?: string | null;
    milestoneYears?: number | null;
    milestoneDate?: string | null;
    finalScoreSnapshot?: number | null;
    notes?: string | null;

    bonusLeaveDaysGranted: number;
    bonusPercent?: number | null;

    // The signed document upload is what actually applies the award — completedAt null means this
    // case is still a draft and bonusLeaveDaysGranted has NOT been credited to the employee yet.
    documentUrl?: string | null;
    documentName?: string | null;
    completedAt?: string | null;

    physicalRewardFulfilledAt?: string | null;
    physicalRewardNote?: string | null;

    appreciationLetterUrl?: string | null;
    appreciationLetterName?: string | null;
    appreciationLetterIssuedAt?: string | null;

    createdByName?: string | null;
    createdAt: string;
}

export interface RewardMonthCandidate {
    employeeId: string;
    employee: RewardCaseEmployee;
    finalScore: number;
    rank: number;
}

export interface AttendanceSummary {
    lateDays: number;
    unauthorizedAbsenceDays: number;
    maxConsecutiveAbsenceDays: number;
    earlyOutDays: number;
}
export interface RewardAttendanceCandidate {
    employeeId: string;
    employee: RewardCaseEmployee;
    attendanceSummary: AttendanceSummary;
    hasLeaveRequestFiled: false;
    hasConfirmedDisciplinaryRecord: false;
}
export interface RewardAttendanceExclusion {
    employeeId: string;
    employeeName: string;
    reason: 'NO_BIO_ID' | 'ATTENDANCE_FETCH_FAILED' | 'BIOTIME_UNREACHABLE';
}
export interface RewardAttendanceResult {
    month: string;
    cycleStart: string;
    cycleEnd: string;
    candidates: RewardAttendanceCandidate[];
    excluded: RewardAttendanceExclusion[];
}

export interface RewardLoyaltyCandidate {
    employeeId: string;
    employee: RewardCaseEmployee;
    milestoneYears: 5 | 10;
    milestoneDate: string;
    tenureMonths: number;
}
export interface RewardLoyaltyExclusion {
    employeeId: string;
    employeeName: string;
    reason: 'NO_BIO_ID' | 'ATTENDANCE_FETCH_FAILED';
}

export interface RewardYearCandidate {
    employeeId: string;
    employee: RewardCaseEmployee;
    tenureMonths: number;
    monthWinsThisYear: string[];
}

export const rewardService = {
    async getMonthCandidates(month?: string): Promise<{ month: string; candidates: RewardMonthCandidate[] }> {
        const response = await api.get('/reward-cases/candidates/month', { params: month ? { month } : undefined });
        return response.data;
    },

    async getAttendanceCandidates(month?: string): Promise<RewardAttendanceResult> {
        const response = await api.get('/reward-cases/candidates/attendance', { params: month ? { month } : undefined });
        return response.data;
    },

    async getLoyaltyCandidates(): Promise<{ candidates: RewardLoyaltyCandidate[]; excluded: RewardLoyaltyExclusion[] }> {
        const response = await api.get('/reward-cases/candidates/loyalty');
        return response.data;
    },

    async getYearCandidates(year?: string): Promise<{ year: string; candidates: RewardYearCandidate[] }> {
        const response = await api.get('/reward-cases/candidates/year', { params: year ? { year } : undefined });
        return response.data;
    },

    // Candidate review page — live re-computed detail for one candidate, nothing persisted.
    async getMonthCandidateDetail(employeeId: string, period: string): Promise<{ period: string; finalScore: number; rank: number }> {
        const response = await api.get(`/reward-cases/candidates/month/${employeeId}`, { params: { period } });
        return response.data;
    },

    async getAttendanceCandidateDetail(employeeId: string, period: string): Promise<{ period: string; cycleStart: string; cycleEnd: string; attendanceSummary: AttendanceSummary; hasLeaveRequestFiled: boolean; hasConfirmedDisciplinaryRecord: boolean }> {
        const response = await api.get(`/reward-cases/candidates/attendance/${employeeId}`, { params: { period } });
        return response.data;
    },

    async getLoyaltyCandidateDetail(employeeId: string, milestoneYears: 5 | 10): Promise<{ milestoneYears: 5 | 10; milestoneDate: string; tenureMonths: number }> {
        const response = await api.get(`/reward-cases/candidates/loyalty/${employeeId}`, { params: { milestoneYears } });
        return response.data;
    },

    async getYearCandidateDetail(employeeId: string, year: string): Promise<{ year: string; tenureMonths: number; monthWinsThisYear: string[] }> {
        const response = await api.get(`/reward-cases/candidates/year/${employeeId}`, { params: { year } });
        return response.data;
    },

    async list(params?: { type?: RewardType; employeeId?: string; period?: string }): Promise<RewardCase[]> {
        const response = await api.get('/reward-cases', { params });
        return response.data;
    },

    async get(id: string): Promise<RewardCase> {
        const response = await api.get(`/reward-cases/${id}`);
        return response.data;
    },

    // Opens a DRAFT case only — nothing is applied to the employee until complete() runs.
    async createMonthCase(employeeId: string, month: string): Promise<RewardCase> {
        const response = await api.post('/reward-cases/employee-of-month', { employeeId, month });
        return response.data;
    },

    async createAttendanceCase(employeeId: string, month: string): Promise<RewardCase> {
        const response = await api.post('/reward-cases/attendance-excellence', { employeeId, month });
        return response.data;
    },

    async createLoyaltyCase(employeeId: string, milestoneYears: 5 | 10): Promise<RewardCase> {
        const response = await api.post('/reward-cases/loyalty-milestone', { employeeId, milestoneYears });
        return response.data;
    },

    async createEmployeeOfYear(data: { employeeId: string; year?: string; notes?: string; bonusPercent?: number }): Promise<RewardCase> {
        const response = await api.post('/reward-cases/employee-of-year', data);
        return response.data;
    },

    async generateAppreciationLetter(id: string): Promise<Blob> {
        const response = await api.post(`/reward-cases/${id}/appreciation-letter`, {}, { responseType: 'blob' });
        return response.data;
    },

    // The signed document is what actually applies the award (credits bonusHolidays).
    async complete(id: string, data: { documentUrl: string; documentName?: string }): Promise<RewardCase> {
        const response = await api.post(`/reward-cases/${id}/complete`, data);
        return response.data;
    },

    async markPhysicalRewardFulfilled(id: string, note?: string): Promise<RewardCase> {
        const response = await api.post(`/reward-cases/${id}/physical-reward`, { note });
        return response.data;
    },
};
