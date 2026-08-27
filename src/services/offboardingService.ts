import api from './apiClient';
import type { ReasonForLeaving, RatingOption } from '../constants/offboardingExitInterview';

export type OffboardingStage = 'RESIGNATION_REQUEST' | 'CLEARANCE' | 'SEPARATION_LETTER' | 'CLOSED';
export type OffboardingType = 'VOLUNTARY' | 'INVOLUNTARY';
export type OffboardingSource = 'EMPLOYEE_RESIGNATION' | 'DISCIPLINARY_TERMINATION' | 'TERMINATION' | 'CONTRACT_NON_RENEWAL_EMPLOYEE' | 'CONTRACT_NON_RENEWAL_COMPANY';

export interface MyIdentitySnapshot {
    employeeId: string;
    employeeName: string;
    unit: string;
    department: string;
    position: string;
}

export interface ExitInterviewRatings {
    management: RatingOption;
    companyCulture: RatingOption;
    policies: RatingOption;
    workingConditions: RatingOption;
    careerDevelopment: RatingOption;
    salary: RatingOption;
    benefits: RatingOption;
    training: RatingOption;
}

export interface OffboardingCase {
    id: string;
    caseNumber: string;
    employeeId: string;
    employee?: { id: string; fullName: string; staffId?: string | null; position?: string | null; enrollmentStatus?: string };
    type: OffboardingType;
    source: OffboardingSource;
    linkedDisciplinaryCaseId?: string | null;
    reason?: string | null;

    stage: OffboardingStage;

    resignationFiledAt?: string | null;
    resignationReason?: string | null;
    resignationReasonAr?: string | null;
    resignationLetterText?: string | null;
    resignationLetterTextAr?: string | null;
    resignationAttachmentUrls?: string[];
    resignationAttachmentNames?: string[];
    resignationEffectiveDate?: string | null;
    resignationDocumentUrl?: string | null;
    resignationDocumentName?: string | null;
    resignationCompletedAt?: string | null;
    finalWorkingDate?: string | null;

    dateOfSeparation?: string | null;
    clearanceDocumentUrl?: string | null;
    clearanceDocumentName?: string | null;
    clearanceCompletedAt?: string | null;

    exitInterviewSubmittedAt?: string | null;
    exitInterviewReasonCategory?: ReasonForLeaving | null;
    exitInterviewReasonOther?: string | null;
    exitInterviewRatingManagement?: RatingOption | null;
    exitInterviewRatingCompanyCulture?: RatingOption | null;
    exitInterviewRatingPolicies?: RatingOption | null;
    exitInterviewRatingWorkingConditions?: RatingOption | null;
    exitInterviewRatingCareerDevelopment?: RatingOption | null;
    exitInterviewRatingSalary?: RatingOption | null;
    exitInterviewRatingBenefits?: RatingOption | null;
    exitInterviewRatingTraining?: RatingOption | null;
    exitInterviewAppreciatedMost?: string | null;
    exitInterviewLikedLeast?: string | null;
    exitInterviewImprovementSuggestions?: string | null;
    exitInterviewInterestedInReemployment?: boolean | null;
    exitInterviewWouldRecommend?: boolean | null;
    exitInterviewContactEmail?: string | null;
    exitInterviewContactNumber?: string | null;

    separationDocumentUrl?: string | null;
    separationDocumentName?: string | null;
    separationCompletedAt?: string | null;

    certificateIssuedAt?: string | null;

    closedAt?: string | null;
    createdByName?: string | null;
    createdAt: string;
}

// Slim projection for the "my cases" list on the Resignation Request page — coarse status only.
export interface MyOffboardingCase {
    id: string;
    caseNumber: string;
    type: OffboardingType;
    source: OffboardingSource;
    stage: OffboardingStage;
    resignationFiledAt?: string | null;
    exitInterviewSubmittedAt?: string | null;
    createdAt: string;
}

export interface SubmitExitInterviewData {
    effectiveDate: string;
    reasonCategory: ReasonForLeaving;
    reasonOther?: string;
    ratings: ExitInterviewRatings;
    appreciatedMost: string;
    likedLeast: string;
    improvementSuggestions: string;
    interestedInReemployment: boolean;
    wouldRecommend: boolean;
    contactEmail?: string;
    contactNumber?: string;
}

export const offboardingService = {
    async getMyIdentity(): Promise<MyIdentitySnapshot> {
        const response = await api.get('/offboarding-cases/my-identity');
        return response.data;
    },

    async createResignationRequest(data: { reason: string; letterText: string }): Promise<OffboardingCase> {
        const response = await api.post('/offboarding-cases/resignation-request', data);
        return response.data;
    },

    async uploadResignationAttachments(caseId: string, files: File[]): Promise<OffboardingCase> {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        const response = await api.post(`/offboarding-cases/${caseId}/resignation-attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    async submitExitInterview(data: SubmitExitInterviewData): Promise<OffboardingCase> {
        const response = await api.post('/offboarding-cases/exit-interview', data);
        return response.data;
    },

    async getMyCases(): Promise<MyOffboardingCase[]> {
        const response = await api.get('/offboarding-cases/mine');
        return response.data;
    },

    async list(params?: { stage?: OffboardingStage; type?: OffboardingType; source?: OffboardingSource; employeeId?: string }): Promise<OffboardingCase[]> {
        const response = await api.get('/offboarding-cases', { params });
        return response.data;
    },

    async get(id: string): Promise<OffboardingCase> {
        const response = await api.get(`/offboarding-cases/${id}`);
        return response.data;
    },

    async createManualCase(data: { employeeId: string; source: 'TERMINATION' | 'EMPLOYEE_RESIGNATION' | 'CONTRACT_NON_RENEWAL_EMPLOYEE' | 'CONTRACT_NON_RENEWAL_COMPANY'; reason?: string; dateOfSeparation?: string }): Promise<OffboardingCase> {
        const response = await api.post('/offboarding-cases/manual', data);
        return response.data;
    },

    async generateForm(id: string, stage: OffboardingStage, draft: Record<string, any>): Promise<Blob> {
        const response = await api.post(`/offboarding-cases/${id}/form/${stage}`, draft, { responseType: 'blob' });
        return response.data;
    },

    async issueCertificate(id: string): Promise<Blob> {
        const response = await api.get(`/offboarding-cases/${id}/certificate`, { responseType: 'blob' });
        return response.data;
    },

    async completeResignationRequest(id: string, data: { documentUrl: string; documentName?: string; finalWorkingDate?: string }): Promise<OffboardingCase> {
        const response = await api.post(`/offboarding-cases/${id}/complete-resignation-request`, data);
        return response.data;
    },

    async completeClearance(id: string, data: { documentUrl: string; documentName?: string }): Promise<OffboardingCase> {
        const response = await api.post(`/offboarding-cases/${id}/complete-clearance`, data);
        return response.data;
    },

    async completeSeparationLetter(id: string, data: { documentUrl: string; documentName?: string }): Promise<OffboardingCase> {
        const response = await api.post(`/offboarding-cases/${id}/complete-separation-letter`, data);
        return response.data;
    },
};
