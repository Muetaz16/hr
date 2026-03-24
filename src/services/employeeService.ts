import api from './apiClient';
import type { Employee } from '../types';

export const employeeService = {
    async getAllEmployees(): Promise<Employee[]> {
        const response = await api.get('/employees');
        return response.data;
    },

    async getMyEmployeeRecord(): Promise<Employee> {
        const response = await api.get('/employees/me');
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

    async getExpiringContracts(days: number = 30): Promise<Employee[]> {
        const response = await api.get(`/employees/contracts/expiring?days=${days}`);
        return response.data;
    }
};
