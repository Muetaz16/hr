import api from './apiClient';

export interface PersonnelActionForm {
    id: string;
    employeeId: string;
    employee?: { id: string; fullName: string; staffId?: string | null };
    actionType: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    currentDivision?: string | null;
    currentDepartment?: string | null;
    currentUnit?: string | null;
    currentPosition?: string | null;
    newJobDescriptionId?: string | null;
    newDivisionId?: string | null;
    newDepartmentId?: string | null;
    newUnitId?: string | null;
    newPositionTitle?: string | null;
    newJobCategory?: string | null;
    newJobGrade?: string | null;
    newPlaceOfWork?: string | null;
    reportsTo?: string | null;
    // Inter-company transfer (actionType === 'INTER_COMPANY_TRANSFER') — free-text destination + factors.
    newCompany?: string | null;
    newDivisionName?: string | null;
    newDepartmentName?: string | null;
    newUnitName?: string | null;
    englishFactor?: number | null;
    positionFactor?: number | null;
    locationFactor?: number | null;
    skillFactor?: number | null;
    typeOfTransfer?: string | null;
    effectiveDate?: string | null;
    justification?: string | null;
    documentUrl?: string | null;
    documentName?: string | null;
    createdByName?: string | null;
    decidedByName?: string | null;
    decidedAt?: string | null;
    createdAt: string;
}

export const personnelActionService = {
    async list(status?: string): Promise<PersonnelActionForm[]> {
        const response = await api.get('/personnel-actions', { params: status ? { status } : undefined });
        return response.data;
    },

    // One employee's transfer history (Lifecycle detail tree).
    async getByEmployee(employeeId: string): Promise<PersonnelActionForm[]> {
        const response = await api.get(`/personnel-actions/employee/${employeeId}`);
        return response.data;
    },

    // A single personnel action for the full-page transfer detail view. For internal moves the
    // backend resolves the target org ids into the *Name fields so the page renders uniformly.
    async getById(id: string): Promise<PersonnelActionForm> {
        const response = await api.get(`/personnel-actions/${id}`);
        return response.data;
    },

    async create(data: any): Promise<PersonnelActionForm> {
        const response = await api.post('/personnel-actions', data);
        return response.data;
    },

    // Create an inter-company transfer (free-text destination + entered factors). Accepting it marks
    // the employee TRANSFERRED.
    async createInterCompany(data: any): Promise<PersonnelActionForm> {
        const response = await api.post('/personnel-actions/inter-company', data);
        return response.data;
    },

    // Generate the filled Personnel Action Form (.docx) as a Blob for download.
    async generateForm(id: string): Promise<Blob> {
        const response = await api.get(`/personnel-actions/${id}/form`, { responseType: 'blob' });
        return response.data;
    },

    // Accept (applies the transfer) or reject the form. Accept requires the signed document URL.
    async decide(id: string, data: { decision: 'ACCEPT' | 'REJECT'; documentUrl?: string; documentName?: string; newCompany?: string }): Promise<PersonnelActionForm> {
        const response = await api.post(`/personnel-actions/${id}/decide`, data);
        return response.data;
    },
};
