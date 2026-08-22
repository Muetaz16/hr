import api from './apiClient';
import type { User, UserRole, FunctionalHat, AccessCatalog } from '../types';

export const userService = {
    // Create or Update user (sync with Auth) - For local, we usually just update
    async syncUser(uid: string, data: Partial<User>) {
        if (!uid) return;
        // In local setup, users are created via the users management page
        // or during seeding. Sync might just be an update.
        await api.put(`/users/${uid}`, data);
    },

    async getUser(_uid: string): Promise<User | null> {
        // Implement if needed, or fetched via list
        // const response = await api.get(\`/users/${uid}\`);
        // return response.data;
        return null; // Not heavily used individually in current flow
    },

    async getAllUsers(): Promise<User[]> {
        const response = await api.get('/users');
        return response.data;
    },

    async getUsersByRole(role: UserRole): Promise<User[]> {
        const response = await api.get('/users');
        const allUsers: User[] = response.data;
        return allUsers.filter(u => u.role === role);
    },

    async createUser(data: Partial<User> & { password?: string }) {
        const response = await api.post('/users', data);
        return response.data;
    },

    async updateUser(uid: string, data: Partial<User>) {
        if (!uid) throw new Error("User ID is required for update");
        await api.put(`/users/${uid}`, data);
    },

    async deleteUser(uid: string) {
        await api.delete(`/users/${uid}`);
    },

    // --- Access catalog & functional hats (Access Management) ---
    async getAccessCatalog(): Promise<AccessCatalog> {
        const response = await api.get('/access-catalog');
        return response.data;
    },

    async getFunctionalHats(): Promise<FunctionalHat[]> {
        const response = await api.get('/functional-hats');
        return response.data;
    },

    async createHat(data: Pick<FunctionalHat, 'name' | 'description' | 'permissions'>): Promise<FunctionalHat> {
        const response = await api.post('/functional-hats', data);
        return response.data;
    },

    async updateHat(id: string, data: Partial<Pick<FunctionalHat, 'name' | 'description' | 'permissions'>>): Promise<FunctionalHat> {
        const response = await api.put(`/functional-hats/${id}`, data);
        return response.data;
    },

    async deleteHat(id: string) {
        await api.delete(`/functional-hats/${id}`);
    }
};
