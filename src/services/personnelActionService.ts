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

    async create(data: any): Promise<PersonnelActionForm> {
        const response = await api.post('/personnel-actions', data);
        return response.data;
    },

    // Generate the filled Personnel Action Form (.docx) as a Blob for download.
    async generateForm(id: string): Promise<Blob> {
        const response = await api.get(`/personnel-actions/${id}/form`, { responseType: 'blob' });
        return response.data;
    },

    // Accept (applies the transfer) or reject the form. Accept requires the signed document URL.
    async decide(id: string, data: { decision: 'ACCEPT' | 'REJECT'; documentUrl?: string; documentName?: string }): Promise<PersonnelActionForm> {
        const response = await api.post(`/personnel-actions/${id}/decide`, data);
        return response.data;
    },
};
