import api from './apiClient';

// One employee's row from the attendance system's summary, enriched with our own Employee
// record (matched server-side by staffId <-> empCode) when a match is found.
export interface AttendanceSummaryEmployee {
    empId: number;
    empCode: string;
    empName: string;
    department: string;
    positionName: string;
    totalEarlyPunchMins: number;
    totalWorkMins: number;
    totalLateMins: number;
    totalEarlyOutMins: number;
    totalLeaveMins: number;
    totalOTMins: number;
    totalApprovedOTMins: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    emergencyLeaveDays: number;
    holidayDays: number;
    outWorkDays: number;
    totalExcusedMins: number;
    totalExcusedEarlyOutMins: number;
    employeeId: string | null;
    matchedFullName: string | null;
    departmentId: string | null;
    position: string | null;
}

export interface AttendanceSummary {
    startDate: string;
    endDate: string;
    employees: AttendanceSummaryEmployee[];
}

export interface AttendanceLeaveType {
    id: number;
    name: string;
}

export interface AttendanceDashboard {
    totalEmployees: number;
    onLeaveToday: number;
    punchesToday: number;
    overtimesToday: number;
    error: string | null;
}

// A single check-in/check-out pair within a day — a day can have more than one (e.g. leaving
// for lunch and coming back), which is why `sessions` exists alongside firstPunch/lastPunch.
export interface DailyAttendanceSession {
    checkIn: string;
    checkOut: string;
}

// One day's row inside a monthly report — includes the day's first/last punch, so this single
// endpoint covers both "per employee attendance" and "first and last punch" in one call.
export interface DailyAttendanceResult {
    date: string;
    empName: string;
    firstPunch: string;
    lastPunch: string;
    earlyPunch: number;
    overtimeIn: string;
    overtimeOut: string;
    breakIn: string;
    breakOut: string;
    totalLeaveMins: number;
    totalLeaveTime: string;
    sessions: DailyAttendanceSession[];
    midDayGapMins: number;
    midDayGapTime: string;
    lateMins: number;
    earlyOutMins: number;
    otMins: number;
    totalWorkMins: number;
    isHoliday: boolean;
    holidayName: string | null;
    isOutWork: boolean;
    outWorkReason: string | null;
    isExcusedLate: boolean;
    excusedLateReason: string | null;
    isExcusedEarlyOut: boolean;
    excusedEarlyOutReason: string | null;
    lateTimeStr: string;
    earlyOutStr: string;
    overTimeStr: string;
}

export interface EmployeeLeaveRecord {
    id: number;
    empCode: string;
    leaveTypeId: number;
    leaveType: { id: number; name: string; isPaid: boolean };
    startDate: string;
    endDate: string;
    daysCount: number;
    notes: string;
    createdBy: string;
    createdAt: string;
    approvedBy: string;
    approvedAt: string;
}

export interface EmployeeOvertimeRecord {
    id: number;
    empCode: string;
    approvedMinutes: string; // "HH:MM:SS"
    reason: string | null;
    notes: string | null;
    createdBy: string | null;
    createdAt: string;
    approvedBy: string | null;
    approvedAt: string | null;
    date: string;
}

export interface MonthlyReport {
    currentEmpId: number;
    empCode: string;
    currentEmpName: string;
    position: string;
    startDate: string;
    endDate: string;
    totalLate: number;
    totalEarly: number;
    totalLeave: number;
    totalDeduction: number;
    totalOT: string;
    grandTotalWork: string;
    formattedApprovedOT: string;
    outWorkDays: number;
    totalExcusedMins: number;
    totalExcusedEarlyOutMins: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    emergencyLeaveDays: number;
    empLeaves: EmployeeLeaveRecord[];
    empOvertimes: EmployeeOvertimeRecord[];
    reportData: DailyAttendanceResult[];
}

// A punch whose terminal alias is "manual" — i.e. hand-corrected rather than a raw device punch.
export interface ManualTransaction {
    id: number;
    first_name: string;
    terminal_alias: string;
    emp_code: string;
    dept_name: string;
    position_name: string;
    att_date: string;
    punch_time: string;
    punch_state: string;
}

export interface ManualTransactionsResponse {
    startDate: string;
    endDate: string;
    searchTerm: string | null;
    totalCount: number;
    transactions: ManualTransaction[];
}

export interface MissingPunchInput {
    empCode: string;
    empId: number;
    punchTime: string; // ISO datetime
    punchState: '0' | '1'; // 0 = check-in, 1 = check-out
    startDate?: string | null;
    endDate?: string | null;
}

// --- Daily Logging ---------------------------------------------------------------------------

export interface EmployeeLeaveListItem {
    id: number;
    empCode: string;
    empName: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    notes: string;
    approvedBy: string;
    approvedAt: string;
}

export interface OutWorkListItem {
    id: number;
    empCode: string;
    empName: string;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
    approvedBy: string;
    approvedAt: string;
}

// Single-day record — the API used to return a startDate/endDate range here, but it now matches
// the quick-add DTO (a single `date`).
export interface ExcusedLateListItem {
    id: number;
    empCode: string;
    empName: string;
    date: string;
    excusedMinutes: number;
    reason: string;
    approvedBy: string;
    approvedAt: string;
}

export interface AddLeaveInput {
    empCode: string;
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    notes?: string;
}

export interface AddOvertimeInput {
    empCode: string;
    date: string;
    hours: number;
    minutes: number;
    reason?: string;
}

export interface AddOutWorkInput {
    empCode: string;
    startDate: string;
    endDate: string;
    reason?: string;
}

export interface AddExcusedLateInput {
    empCode: string;
    date: string;
    excusedMinutes: number;
    reason?: string;
}

export interface AddExcusedEarlyOutInput {
    empCode: string;
    date: string;
    excusedMinutes: number;
    reason?: string;
}

export interface ExcusedEarlyOutListItem {
    id: number;
    empCode: string;
    empName: string;
    date: string;
    excusedMinutes: number;
    reason: string;
    approvedBy: string;
    approvedAt: string;
}

// --- Employees (BioTime roster) --------------------------------------------------------------

export interface BioTimeEmployee {
    id: number;
    emp_code: string;
    first_name: string;
    position: { id: number; position_code: string; position_name: string } | null;
}

export interface BioTimeEmployeeList {
    searchTerm: string | null;
    employees: BioTimeEmployee[];
}

export interface CreateBioTimeEmployeeInput {
    empCode: string;
    firstName: string;
    positionId: number;
}

export interface UpdateBioTimeEmployeeInput {
    firstName: string;
    positionId: number;
}

export const attendanceService = {
    async getSummary(start?: string, end?: string): Promise<AttendanceSummary> {
        const response = await api.get('/attendance-integration/summary', { params: { start, end } });
        return response.data;
    },

    async getLeaveTypes(): Promise<AttendanceLeaveType[]> {
        const response = await api.get('/attendance-integration/leave-types');
        return response.data;
    },

    async getDashboard(): Promise<AttendanceDashboard> {
        const response = await api.get('/attendance-integration/dashboard');
        return response.data;
    },

    // empId is the attendance system's own numeric BioTime id (e.g. AttendanceSummaryEmployee.empId),
    // not our staffId/empCode.
    async getMonthlyReport(empId: number, start?: string, end?: string): Promise<MonthlyReport> {
        const response = await api.get(`/attendance-integration/monthly-report/${empId}`, { params: { start, end } });
        return response.data;
    },

    // Self-service: any authenticated employee's own attendance — resolved server-side from
    // their own staffId, no empId needed.
    async getMyMonthlyReport(start?: string, end?: string): Promise<MonthlyReport> {
        const response = await api.get('/attendance-integration/me/monthly-report', { params: { start, end } });
        return response.data;
    },

    async getManualTransactions(start?: string, end?: string, searchTerm?: string): Promise<ManualTransactionsResponse> {
        const response = await api.get('/attendance-integration/manual-transactions', { params: { start, end, searchTerm } });
        return response.data;
    },

    async addMissingPunch(input: MissingPunchInput): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/attendance-integration/missing-punches', input);
        return response.data;
    },

    // --- Daily Logging ---
    async addLeave(input: AddLeaveInput): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/attendance-integration/leaves', input);
        return response.data;
    },
    async getEmployeeLeaves(): Promise<EmployeeLeaveListItem[]> {
        const response = await api.get('/attendance-integration/employee-leaves');
        return response.data;
    },
    async deleteEmployeeLeave(id: number): Promise<void> {
        await api.delete(`/attendance-integration/employee-leaves/${id}`);
    },

    async addOvertime(input: AddOvertimeInput): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/attendance-integration/overtimes', input);
        return response.data;
    },

    async addOutWork(input: AddOutWorkInput): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/attendance-integration/out-works', input);
        return response.data;
    },
    async getOutWorks(): Promise<OutWorkListItem[]> {
        const response = await api.get('/attendance-integration/out-works');
        return response.data;
    },
    async deleteOutWork(id: number): Promise<void> {
        await api.delete(`/attendance-integration/out-works/${id}`);
    },

    async addExcusedLate(input: AddExcusedLateInput): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/attendance-integration/excused-lates', input);
        return response.data;
    },
    async getExcusedLates(): Promise<ExcusedLateListItem[]> {
        const response = await api.get('/attendance-integration/excused-lates');
        return response.data;
    },
    async deleteExcusedLate(id: number): Promise<void> {
        await api.delete(`/attendance-integration/excused-lates/${id}`);
    },

    async addExcusedEarlyOut(input: AddExcusedEarlyOutInput): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/attendance-integration/excused-early-outs', input);
        return response.data;
    },
    async getExcusedEarlyOuts(): Promise<ExcusedEarlyOutListItem[]> {
        const response = await api.get('/attendance-integration/excused-early-outs');
        return response.data;
    },
    async deleteExcusedEarlyOut(id: number): Promise<void> {
        await api.delete(`/attendance-integration/excused-early-outs/${id}`);
    },

    // --- Employees (BioTime roster) ---
    async getBioTimeEmployees(searchTerm?: string): Promise<BioTimeEmployeeList> {
        const response = await api.get('/attendance-integration/biotime-employees', { params: { searchTerm: searchTerm || undefined } });
        return response.data;
    },
    async createBioTimeEmployee(input: CreateBioTimeEmployeeInput): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/attendance-integration/biotime-employees', input);
        return response.data;
    },
    async updateBioTimeEmployee(id: number, input: UpdateBioTimeEmployeeInput): Promise<{ success: boolean; message: string }> {
        const response = await api.patch(`/attendance-integration/biotime-employees/${id}`, input);
        return response.data;
    },
    async deleteBioTimeEmployee(id: number): Promise<{ success: boolean; message: string }> {
        const response = await api.delete(`/attendance-integration/biotime-employees/${id}`);
        return response.data;
    },
};
