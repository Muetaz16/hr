import api from './apiClient';
import type { Department, Group } from '../types';

export const departmentService = {
    async getAllDepartments(): Promise<Department[]> {
        const response = await api.get('/departments');
        return response.data;
    },

    async createDepartment(dept: Omit<Department, 'id'>) {
        await api.post('/departments', dept);
    },

    async updateDepartment(_id: string, _data: Partial<Department>) {
        // Not implemented in backend yet, but placeholder
        // await api.put(\`/departments/${id}\`, data);
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

    async updateGroup(_id: string, _data: Partial<Group>) {
        // Not implemented in backend yet, but placeholder
        // await api.put(\`/groups/${id}\`, data);
    },

    async deleteGroup(id: string) {
        await api.delete(`/groups/${id}`);
    }
};
