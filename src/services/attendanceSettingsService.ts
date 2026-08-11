import api from './apiClient';

// Rarely-changed admin config for the attendance system — lives as a "Settings" tab inside the
// Attendance & Leave Requests page, SUPER_ADMIN only. Separate service from attendanceService.ts
// (daily operational data) since this is a distinct resource set (system-settings). Work-Hour
// Settings and Leave Types are edit-only here (no create/delete) — see attendanceSettingsRoutes.ts.

export interface SystemSettingItem {
    id: number;
    key: string;
    value: string;
    description: string | null;
}

export interface LeaveTypeItem {
    id: number;
    name: string;
    isPaid: boolean;
}

// The full snapshot returned by GET /api/system-settings. We only read `systemSettings` and
// `leaveTypes` from it — the rest (employeeLeaves, holidays, outWorks, ...) is covered by other
// dedicated screens/endpoints.
export interface SystemSettingsSnapshot {
    systemSettings: SystemSettingItem[];
    leaveTypes: LeaveTypeItem[];
}

export interface HolidayItem {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
}

export interface MultiplierFactorItem {
    id: number;
    name: string;
    factorValue: number;
    type: string;
    dateStart: string;
    dateEnd: string;
    workStart: string | null;
    gracePeriod: string | null;
    workEnd: string | null;
    otThreshold: string | null;
}

export interface SaveSystemSettingInput {
    key: string;
    valueString: string;
    description?: string | null;
    isDuration: boolean;
}

export interface SaveLeaveTypeInput {
    name: string;
    isPaid: boolean;
}

export interface SaveHolidayInput {
    name: string;
    startDate: string;
    endDate: string;
}

export interface SaveMultiplierFactorInput {
    name: string;
    factorValue: string;
    type: string;
    dateStart: string;
    dateEnd: string;
    workStart?: string | null;
    gracePeriod?: string | null;
    workEnd?: string | null;
    otThreshold?: string | null;
}

type Ack = { success: boolean; message: string };

export const attendanceSettingsService = {
    async getSnapshot(): Promise<SystemSettingsSnapshot> {
        const response = await api.get('/attendance-settings/snapshot');
        return response.data;
    },
    async updateSetting(id: number, input: SaveSystemSettingInput): Promise<Ack> {
        const response = await api.put(`/attendance-settings/settings/${id}`, input);
        return response.data;
    },

    async updateLeaveType(id: number, input: SaveLeaveTypeInput): Promise<Ack> {
        const response = await api.put(`/attendance-settings/leave-types/${id}`, input);
        return response.data;
    },

    async getHolidays(): Promise<HolidayItem[]> {
        const response = await api.get('/attendance-settings/holidays');
        return response.data;
    },
    async createHoliday(input: SaveHolidayInput): Promise<Ack> {
        const response = await api.post('/attendance-settings/holidays', input);
        return response.data;
    },
    async updateHoliday(id: number, input: SaveHolidayInput): Promise<Ack> {
        const response = await api.put(`/attendance-settings/holidays/${id}`, input);
        return response.data;
    },
    async deleteHoliday(id: number): Promise<Ack> {
        const response = await api.delete(`/attendance-settings/holidays/${id}`);
        return response.data;
    },

    async getMultiplierFactors(): Promise<MultiplierFactorItem[]> {
        const response = await api.get('/attendance-settings/multiplier-factors');
        return response.data;
    },
    async createMultiplierFactor(input: SaveMultiplierFactorInput): Promise<Ack> {
        const response = await api.post('/attendance-settings/multiplier-factors', input);
        return response.data;
    },
    async updateMultiplierFactor(id: number, input: SaveMultiplierFactorInput): Promise<Ack> {
        const response = await api.put(`/attendance-settings/multiplier-factors/${id}`, input);
        return response.data;
    },
    async deleteMultiplierFactor(id: number): Promise<Ack> {
        const response = await api.delete(`/attendance-settings/multiplier-factors/${id}`);
        return response.data;
    },
};
