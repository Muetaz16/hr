import api from './apiClient';
import type { Employee, EmployeeDocument } from '../types';

export const employeeService = {
    async getAllEmployees(): Promise<Employee[]> {
        try {
            const response = await api.get('/employees');
            return response.data;
        } catch (e) {
            console.error("getAllEmployees FAILED in frontend:", e);
            throw e;
        }
    },

    async getMyEmployeeRecord(): Promise<Employee> {
        const response = await api.get('/employees/me');
        return response.data;
    },

    // Auto Staff ID: IPH-<residencyDigit><YY>-<SEQ> (e.g. IPH-126-001 for a 2026 resident).
    async getNextStaffId(residentStatus: string, year?: string | number): Promise<{ prefix: string; nextSeq: number; staffId: string }> {
        const response = await api.get('/employees/next-staff-id', { params: { residentStatus, year } });
        return response.data;
    },

    async getEmployeeById(id: string): Promise<Employee> {
        const response = await api.get(`/employees/${id}`);
        return response.data;
    },

    async getEmployeesByDepartment(deptId: string): Promise<Employee[]> {
        const response = await api.get('/employees');
        const all: Employee[] = response.data;
        return all.filter(e => e.departmentId === deptId);
    },

    async getEmployeesByUnit(unitId: string): Promise<Employee[]> {
        const response = await api.get('/employees');
        const all: Employee[] = response.data;
        return all.filter(e => e.unitId === unitId);
    },

    async getEmployeesByGroup(groupId: string): Promise<Employee[]> {
        const response = await api.get('/employees');
        const all: Employee[] = response.data;
        return all.filter(e => e.groupId === groupId);
    },

    async getEmployeeByEmail(email: string): Promise<Employee | null> {
        // This might be inefficient if list is large, but for now filtering client side or adding query param
        const response = await api.get('/employees');
        const all: Employee[] = response.data;
        return all.find(e => e.email === email) || null;
    },

    async createEmployee(emp: Omit<Employee, 'id'> & { password?: string }) {
        const response = await api.post('/employees', emp);
        return response.data;
    },

    async updateEmployee(id: string, data: Partial<Employee>) {
        await api.put(`/employees/${id}`, data);
    },

    async deleteEmployee(id: string) {
        await api.delete(`/employees/${id}`);
    },

    // Upload a single document file; returns its stored public URL (e.g. /uploads/documents/xyz.pdf).
    async uploadDocument(file: File): Promise<{ url: string; name: string }> {
        const fd = new FormData();
        fd.append('file', file);
        const response = await api.post('/employees/upload-document', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    async getExpiringContracts(days: number = 30): Promise<Employee[]> {
        const response = await api.get(`/employees/contracts/expiring?days=${days}`);
        return response.data;
    },

    async renewContract(id: string, data: any) {
        const response = await api.post(`/employees/${id}/renew`, data);
        return response.data;
    },

    async terminateEmployee(id: string, data: any) {
        const response = await api.post(`/employees/${id}/terminate`, data);
        return response.data;
    },

    // Free-form documents attached to an employee beyond the fixed CV/degree/etc. slots.
    async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
        const response = await api.get(`/employees/${employeeId}/documents`);
        return response.data;
    },

    async addEmployeeDocument(employeeId: string, name: string, fileUrl: string, fileName?: string): Promise<EmployeeDocument> {
        const response = await api.post(`/employees/${employeeId}/documents`, { name, fileUrl, fileName });
        return response.data;
    },

    async deleteEmployeeDocument(employeeId: string, docId: string) {
        await api.delete(`/employees/${employeeId}/documents/${docId}`);
    }
};
