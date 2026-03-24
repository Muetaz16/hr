import api from './apiClient';
import type { User, UserRole } from '../types';

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
    }
};
