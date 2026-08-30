import api from './apiClient';

export type PromotionStage = 'PROMOTION_REPORT' | 'NOTICE_OF_PROMOTION' | 'CLOSED';
export type PromotionBasis = 'TENURE' | 'EVALUATION' | 'EXCEPTIONAL';

export interface PromotionCaseEmployee {
    id: string;
    fullName: string;
    staffId?: string | null;
    position?: string | null;
    enrollmentStatus?: string;
    jobCategory?: string | null;
    jobGrade?: string | null;
    currentGradeSince?: string | null;
    evaluationPoints?: number;
    contractStartDate?: string | null;
    joinDate?: string | null;
    department?: { name: string; isOffice?: boolean } | null;
    division?: { name: string } | null;
    unit?: { name: string } | null;
}

export interface PromotionCase {
    id: string;
    caseNumber: string;
    employeeId: string;
    employee?: PromotionCaseEmployee;

    isExceptional: boolean;
    toGrade: string;
    basis?: PromotionBasis | null;
    reason?: string | null;
    effectiveDate?: string | null;
    newJobTitle?: string | null;
    newJobCategory?: string | null;

    stage: PromotionStage;

    performanceMarch?: string | null;
    performanceApril?: string | null;
    performanceMay?: string | null;
    overallPerformanceRating?: string | null;
    promotionReportDocumentUrl?: string | null;
    promotionReportDocumentName?: string | null;
    promotionReportCompletedAt?: string | null;

    noticeOfPromotionDocumentUrl?: string | null;
    noticeOfPromotionDocumentName?: string | null;
    noticeOfPromotionCompletedAt?: string | null;

    closedAt?: string | null;
    createdByName?: string | null;
    createdAt: string;
}

export interface PromotionCandidate {
    employeeId: string;
    employee: PromotionCaseEmployee;
    toGrade: string;
    basis: 'TENURE' | 'EVALUATION';
    progress: { months: number; required: number } | { points: number; required: number };
}

export const promotionService = {
    async getCandidates(): Promise<PromotionCandidate[]> {
        const response = await api.get('/promotion-cases/candidates');
        return response.data;
    },

    async list(params?: { stage?: PromotionStage; employeeId?: string }): Promise<PromotionCase[]> {
        const response = await api.get('/promotion-cases', { params });
        return response.data;
    },

    async get(id: string): Promise<PromotionCase> {
        const response = await api.get(`/promotion-cases/${id}`);
        return response.data;
    },

    async createFromCandidate(employeeId: string): Promise<PromotionCase> {
        const response = await api.post('/promotion-cases/from-candidate', { employeeId });
        return response.data;
    },

    async createExceptional(data: { employeeId: string; toGrade: string }): Promise<PromotionCase> {
        const response = await api.post('/promotion-cases/exceptional', data);
        return response.data;
    },

    async generateForm(id: string, stage: PromotionStage, draft: Record<string, any>): Promise<Blob> {
        const response = await api.post(`/promotion-cases/${id}/form/${stage}`, draft, { responseType: 'blob' });
        return response.data;
    },

    async completePromotionReport(id: string, data: { documentUrl: string; documentName?: string }): Promise<PromotionCase> {
        const response = await api.post(`/promotion-cases/${id}/complete-promotion-report`, data);
        return response.data;
    },

    async completeNoticeOfPromotion(id: string, data: { documentUrl: string; documentName?: string }): Promise<PromotionCase> {
        const response = await api.post(`/promotion-cases/${id}/complete-notice-of-promotion`, data);
        return response.data;
    },
};
