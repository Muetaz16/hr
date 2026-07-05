import api from './apiClient';
import type { Department, Group, Division } from '../types';

export const departmentService = {
    async getAllDepartments(): Promise<Department[]> {
        const response = await api.get('/departments');
        return response.data;
    },

    async createDepartment(dept: Omit<Department, 'id'>) {
        await api.post('/departments', dept);
    },

    async updateDepartment(id: string, data: Partial<Department>) {
        await api.put(`/departments/${id}`, data);
    },

    async deleteDepartment(id: string) {
        await api.delete(`/departments/${id}`);
    }
};

export const groupService = {
    async getAllGroups(): Promise<Group[]> {
        const response = await api.get('/groups');
        return response.data;
    },

    async createGroup(group: Omit<Group, 'id'>) {
        await api.post('/groups', group);
    },

    async updateGroup(id: string, data: Partial<Group>) {
        await api.put(`/groups/${id}`, data);
    },

    async deleteGroup(id: string) {
        await api.delete(`/groups/${id}`);
    }
};

export const divisionService = {
    async getAllDivisions(): Promise<Division[]> {
        const response = await api.get('/divisions');
        return response.data;
    },

    async createDivision(division: Omit<Division, 'id' | '_count'>) {
        await api.post('/divisions', division);
    },

    async updateDivision(id: string, data: Partial<Division>) {
        await api.put(`/divisions/${id}`, data);
    },

    async deleteDivision(id: string) {
        await api.delete(`/divisions/${id}`);
    }
};
