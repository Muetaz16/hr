import api from './apiClient';

export type DisciplinaryStage = 'INCIDENT_REPORT' | 'NOTICE_TO_EXPLAIN' | 'INVESTIGATION_RESULT' | 'DISCIPLINARY_ACTION' | 'CLOSED';

export type DisciplinaryActionType =
    | 'VERBAL_WARNING' | 'WRITTEN_WARNING' | 'SUSPENSION_3_DAYS' | 'SUSPENSION_5_DAYS'
    | 'SUSPENSION_7_DAYS' | 'SUSPENSION_10_DAYS' | 'TERMINATION';

export type DisciplinaryOutcome = 'NON_VIOLATION' | 'MINOR' | 'SERIOUS' | 'MAJOR';

export interface DisciplinaryEvidence {
    id: string;
    fileUrl: string;
    fileName?: string | null;
    uploadedByName?: string | null;
    createdAt: string;
}

export interface DisciplinaryCase {
    id: string;
    caseNumber: string;
    employeeId: string;
    employee?: { id: string; fullName: string; staffId?: string | null };
    source: 'EMPLOYEE_REPORT' | 'SYSTEM_ATTENDANCE';
    reportedById?: string | null;
    reportedByName?: string | null;
    reportedByEmail?: string | null;
    reportedDate?: string | null;
    preparedByName?: string | null;
    preparedByNameAr?: string | null;

    subjectPositionTitle?: string | null;
    subjectPositionTitleAr?: string | null;
    subjectDepartment?: string | null;
    subjectDepartmentAr?: string | null;

    incidentDate?: string | null;
    incidentPlace?: string | null;
    incidentPlaceAr?: string | null;
    incidentDescription?: string | null;
    incidentDescriptionAr?: string | null;
    violationId?: string | null;
    category?: 'MINOR' | 'SERIOUS' | 'MAJOR' | null;
    offenseNumber?: number | null;
    closureReason?: string | null;

    stage: DisciplinaryStage;

    incidentReportDocumentUrl?: string | null;
    incidentReportDocumentName?: string | null;
    incidentReportCompletedAt?: string | null;

    noticeToExplainDescription?: string | null;
    noticeToExplainDescriptionAr?: string | null;
    noticeToExplainDocumentUrl?: string | null;
    noticeToExplainDocumentName?: string | null;
    noticeToExplainCompletedAt?: string | null;

    investigationOutcome?: DisciplinaryOutcome | null;
    investigationResult?: string | null;
    investigationResultAr?: string | null;
    investigationRecommendation?: string | null;
    investigationRecommendationAr?: string | null;
    investigationActionTaken?: string | null;
    investigationActionTakenAr?: string | null;
    investigationDocumentUrl?: string | null;
    investigationDocumentName?: string | null;
    investigationCompletedAt?: string | null;

    actionType?: DisciplinaryActionType | null;
    actionEffectiveDate?: string | null;
    actionAdditionalInfo?: string | null;
    actionDocumentUrl?: string | null;
    actionDocumentName?: string | null;
    actionCompletedAt?: string | null;

    closedAt?: string | null;
    createdByName?: string | null;
    createdAt: string;
    evidence?: DisciplinaryEvidence[];
}

// Slim projection for the "my reports" list on the Report an Incident page — coarse status only,
// no investigation details (the reporting employee never sees anything beyond this).
export interface MyDisciplinaryReport {
    id: string;
    caseNumber: string;
    reportedDate?: string | null;
    incidentDate?: string | null;
    stage: DisciplinaryStage;
    closureReason?: string | null;
    createdAt: string;
}

export interface AttendanceCandidate {
    employeeId: string;
    employeeName: string;
    staffId?: string | null;
    violationId: string;
    violationLabel: string;
    detail: string;
}

export const disciplinaryService = {
    async createIncidentReport(data: {
        employeeId: string; reportedDate?: string; incidentDate: string; incidentPlace: string;
        incidentDescription: string; subjectPositionTitle?: string; subjectDepartment?: string;
        isAnonymous?: boolean;
    }): Promise<DisciplinaryCase> {
        const response = await api.post('/disciplinary-cases/incident-report', data);
        return response.data;
    },

    async getMyReports(): Promise<MyDisciplinaryReport[]> {
        const response = await api.get('/disciplinary-cases/mine');
        return response.data;
    },

    async list(params?: { stage?: DisciplinaryStage; source?: string }): Promise<DisciplinaryCase[]> {
        const response = await api.get('/disciplinary-cases', { params });
        return response.data;
    },

    async getByEmployee(employeeId: string): Promise<DisciplinaryCase[]> {
        const response = await api.get(`/disciplinary-cases/employee/${employeeId}`);
        return response.data;
    },

    async get(id: string): Promise<DisciplinaryCase> {
        const response = await api.get(`/disciplinary-cases/${id}`);
        return response.data;
    },

    async updateDetails(id: string, data: {
        reportedDate?: string; reportedByName?: string; reportedByEmail?: string; preparedByName?: string; preparedByNameAr?: string; incidentDate?: string;
        subjectPositionTitle?: string; subjectPositionTitleAr?: string;
        subjectDepartment?: string; subjectDepartmentAr?: string;
        incidentPlace?: string; incidentPlaceAr?: string;
        incidentDescription?: string; incidentDescriptionAr?: string;
        noticeToExplainDescription?: string; noticeToExplainDescriptionAr?: string;
        investigationOutcome?: DisciplinaryOutcome;
        investigationResult?: string; investigationResultAr?: string;
        investigationRecommendation?: string; investigationRecommendationAr?: string;
        investigationActionTaken?: string; investigationActionTakenAr?: string;
        actionType?: DisciplinaryActionType;
    }): Promise<DisciplinaryCase> {
        const response = await api.patch(`/disciplinary-cases/${id}`, data);
        return response.data;
    },

    async addEvidence(id: string, files: File[]): Promise<{ count: number; evidence: DisciplinaryEvidence[] }> {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        const response = await api.post(`/disciplinary-cases/${id}/evidence`, formData);
        return response.data;
    },

    // Downloads the filled .docx for the given stage as a Blob (ready for physical signing).
    // `draft` carries whatever the HR user has typed so far for this stage's fields — they aren't
    // persisted until the matching complete* call, so the generated document needs them passed in.
    async generateForm(id: string, stage: DisciplinaryStage, draft?: Record<string, any>): Promise<Blob> {
        const response = await api.post(`/disciplinary-cases/${id}/form/${stage}`, draft || {}, { responseType: 'blob' });
        return response.data;
    },

    async completeIncidentReport(id: string, data: { documentUrl: string; documentName?: string }): Promise<DisciplinaryCase> {
        const response = await api.post(`/disciplinary-cases/${id}/complete-incident-report`, data);
        return response.data;
    },

    async dismissIncidentReport(id: string, data: { documentUrl: string; documentName?: string; closureReason: string }): Promise<DisciplinaryCase> {
        const response = await api.post(`/disciplinary-cases/${id}/dismiss-incident-report`, data);
        return response.data;
    },

    async completeNoticeToExplain(id: string, data: { noticeToExplainDescription?: string; noticeToExplainDescriptionAr?: string; documentUrl: string; documentName?: string }): Promise<DisciplinaryCase> {
        const response = await api.post(`/disciplinary-cases/${id}/complete-notice-to-explain`, data);
        return response.data;
    },

    async completeInvestigationResult(id: string, data: {
        confirmedViolationId?: string; investigationOutcome: DisciplinaryOutcome;
        investigationResult?: string; investigationResultAr?: string;
        investigationRecommendation?: string; investigationRecommendationAr?: string;
        investigationActionTaken?: string; investigationActionTakenAr?: string;
        actionType?: DisciplinaryActionType;
        documentUrl: string; documentName?: string;
    }): Promise<DisciplinaryCase> {
        const response = await api.post(`/disciplinary-cases/${id}/complete-investigation-result`, data);
        return response.data;
    },

    async completeDisciplinaryAction(id: string, data: {
        actionType: DisciplinaryActionType; actionEffectiveDate?: string; actionAdditionalInfo?: string;
        documentUrl: string; documentName?: string;
    }): Promise<DisciplinaryCase & { biotimeSuspensionSynced?: boolean; offboardingCase?: { id: string; caseNumber: string } | null }> {
        const response = await api.post(`/disciplinary-cases/${id}/complete-disciplinary-action`, data);
        return response.data;
    },

    async getAttendanceCandidates(month?: string): Promise<{ month: string; cycleStart: string; cycleEnd: string; candidates: AttendanceCandidate[] }> {
        const response = await api.get('/disciplinary-cases/attendance-candidates', { params: month ? { month } : undefined });
        return response.data;
    },

    async executeAttendanceCase(employeeId: string, violationId: string, month?: string): Promise<DisciplinaryCase> {
        const response = await api.post(`/disciplinary-cases/attendance-candidates/${employeeId}/execute`, { violationId, month });
        return response.data;
    },
};
