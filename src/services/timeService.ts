import api from './apiClient';
import type { TimeRecord } from '../types';

export const timeService = {
    // Get records for a specific month (YYYY-MM)
    async getTimeRecordsByMonth(month: string, _departmentId?: string): Promise<TimeRecord[]> {
        const response = await api.get(`/time/month/${month}`);
        return response.data;
    },

    async getEmployeeTimeRecord(employeeId: string, month: string): Promise<TimeRecord | null> {
        const response = await api.get(`/time/month/${month}`);
        const records = response.data;
        return records.find((r: TimeRecord) => r.employeeId === employeeId) || null;
    },

    async createOrUpdateTimeRecord(record: Partial<TimeRecord> & { employeeId: string, month: string }) {
        await api.post('/time', record);
    }
};
