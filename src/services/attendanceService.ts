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
    // totalWorkMins is ALREADY net of leave: the attendance system credits a leave day a full
    // day's minutes in its daily rows, then subtracts that credit back out of the roll-up and
    // parks it in totalPaidMins. Verified arithmetically (sum of daily minutes - totalPaidMins ==
    // grandTotalWork). So totalPaidMins and totalUnpaidLeaveMins are DISJOINT from totalWorkMins —
    // never subtract totalUnpaidLeaveMins from it, that would deduct the same absence twice.
    totalWorkMins: number;
    // Paid-leave minutes, covering annual AND emergency leave together (both leave types are
    // isPaid). There is no breakdown in this figure. Payroll multiplies it by the hourly rate
    // WITHOUT the salary factors. Present on every API row but previously missing from this
    // interface, so TypeScript could not see it.
    totalPaidMins: number;
    // Unpaid-leave minutes. Display only — see the note on totalWorkMins.
    totalUnpaidLeaveMins: number;
    totalLateMins: number;
    totalEarlyOutMins: number;
    totalLeaveMins: number;
    totalOTMins: number;
    totalApprovedOTMins: number;
    // WARNING: paidLeaveDays and emergencyLeaveDays are SWAPPED by the attendance service —
    // paidLeaveDays actually counts Emergency Leave days and emergencyLeaveDays counts Annual
    // Leave days (verified by isolating one employee's two adjacent leave records). paidLeaveDays
    // also double-counts duplicate leave records. Prefer totalPaidMins, which is correct.
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    emergencyLeaveDays: number;
    holidayDays: number;
    outWorkDays: number;
    suspensionDays: number;
    absenceDays: number;
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

// One raw punch as the attendance service reports it. This is what makes a correction possible at
// all: it carries the punch id to act on, its recorded TYPE (the thing that is wrong when somebody
// taps the wrong key), and whether it came from the device — a device punch may have its type
// corrected but never its time, and may never be deleted.
export interface PunchRef {
    id: number;
    date: string;
    punchTime: string;      // HH:mm
    punchState: string;     // Check In | Check Out | Overtime Out | ...
    isManual: boolean;
}

export type PunchAnomalyKind =
    | 'UNPAIRED_PUNCH' | 'SAME_STATE_ONLY' | 'DOUBLE_TAP'
    | 'OVERTIME_OUT_UNCLOSED' | 'ZERO_WORK_WITH_PUNCHES' | 'SUSPICIOUSLY_SHORT';

export interface PunchRepairStep {
    action: 'RETYPE' | 'ADD';
    punchId?: number;
    atTime?: string;
    toState: string;
    why: string;
}

// The server's verdict on a day, decided in server/src/utils/attendanceAnomaly.ts and attached at
// the proxy boundary. The client NEVER re-derives it — that is how the screens stay in agreement,
// and why there is no further copy of the rules to drift.
// null means "checked, nothing wrong"; undefined means the payload predates annotation.
/** The raw facts behind a verdict, so the sentence can be written in the reader's language. */
export interface PunchAnomalyFacts {
    count: number;
    times: string;
    state?: string;
    at?: string;
    inAt?: string;
    workedMins?: number;
    scheduledMins?: number;
}

export interface DayPunchAnomaly {
    kind: PunchAnomalyKind;
    severity: 'blocking' | 'advisory';
    /** English prose from the server — for logs. Never rendered; see punchAnomalyText. */
    detail: string;
    facts: PunchAnomalyFacts;
    phantomLateMins: number;
    suggested: PunchRepairStep[];
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
    isSuspended: boolean;
    suspensionReason: string | null;
    isExcusedLate: boolean;
    excusedLateReason: string | null;
    isExcusedEarlyOut: boolean;
    excusedEarlyOutReason: string | null;
    lateTimeStr: string;
    earlyOutStr: string;
    overTimeStr: string;
    // --- Overnight shift stitching ---
    // A night shift that crosses midnight used to be reported as two broken days: one with no
    // worked hours and one with a phantom "early out" of several hundred minutes. It is now
    // reported entirely on the day the shift STARTED, and the next day — which held nothing but
    // the check-out punch — is dropped from reportData completely.
    //
    // Consequences worth knowing when reading these rows:
    //   · `lastPunch` and `sessions[].checkOut` hold the REAL check-out time, which belongs to
    //     `overnightCheckoutDate`, not to this row's own date. Printed without that context a
    //     session reads as though the employee left one minute after arriving.
    //   · `otMins` covers the whole stretch from end of shift to that check-out.
    //   · a day named by `overnightCheckoutDate` must never be synthesised as missing — see
    //     fillMissingDays.
    /** Every raw punch recorded on this date, with ids — the handle a correction acts on. */
    punches?: PunchRef[] | null;
    /** Server verdict: is this day broken, and what would repair it. Never re-derived here. */
    anomaly?: DayPunchAnomaly | null;
    isOvernightStitched?: boolean;
    overnightCheckoutDate?: string | null;
    /**
     * A finished sentence from the attendance system explaining the merge — ARABIC ONLY.
     *
     * Not rendered: the table composes its own from `overnightCheckoutDate` + `overTimeStr` so the
     * line follows the reader's language instead of forcing Arabic prose into an English page,
     * where it also broke bidirectionally (the full stop migrated to the start of the line).
     * Kept on the type because it is part of the API contract and is useful when debugging.
     */
    overnightNote?: string | null;
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

/** One broken day in the cross-employee queue: who, when, and the verdict already made server-side. */
export interface PunchAnomalyRow {
    employeeId: string;
    employeeName: string;
    /** Our staffId == the attendance service's empCode. */
    empCode: string;
    /** The attendance service's numeric id, needed to open the day for correction. */
    bioEmpId: number;
    department: string | null;
    date: string;
    /** The financial month this day is paid in (25th → 24th, labelled by the END month). */
    period: string;
    totalWorkMins: number;
    lateMins: number;
    punches: PunchRef[];
    anomaly: DayPunchAnomaly;
    /** What this employee was scheduled for on this date, and which tier decided it. */
    scheduled: { workStart: string; workEnd: string; source: 'shift' | 'multiplier' | 'default' };
}

/** One repair pushed into the attendance service, as the correction log stores it. */
export interface PunchCorrectionStep {
    action: 'RETYPE' | 'ADD' | 'DELETE';
    punchId?: number;
    atTime?: string;                        // 'HH:mm'
    toState?: 'Check In' | 'Check Out';
}

export interface PunchCorrectionRecord {
    id: string;
    empCode: string;
    workDate: string;
    period: string;
    action: string;
    anomalyKind: string | null;
    sourcePunchId: number | null;
    wasManual: boolean;
    beforeTime: string | null;
    beforeState: string | null;
    afterTime: string | null;
    afterState: string | null;
    reason: string;
    status: string;                         // APPLIED | FAILED | SUPERSEDED
    sourceMessage: string | null;
    /** What re-reading the day showed. This, not sourceMessage, is the evidence it landed. */
    verifiedState: string | null;
    workMinsBefore: number | null;
    workMinsAfter: number | null;
    payrollWasLocked: boolean;
    evaluationWasFinalized: boolean;
    correctedByName: string | null;
    appliedAt: string;
}

export interface PunchCorrectionResult {
    corrections: PunchCorrectionRecord[];
    workedBefore: number;
    workedAfter: number | null;
    lateBefore: number;
    lateAfter: number | null;
    punches: { id: number; punchTime: string; punchState: string; isManual: boolean }[];
    payrollWasLocked: boolean;
    payrollRunStatus: string | null;
    evaluationWasFinalized: boolean;
    /** Minutes this correction gave back. Zero when the day was already paying what it should. */
    recoveredMins: number;
    /**
     * Only when the run is already signed and cannot absorb the change. Priced from the rate the
     * employee was actually paid at. A SUGGESTION — creating the line is a separate, typed act.
     */
    suggestedRecovery: {
        minutes: number; amount: number; currency: string; lineId: string; runNumber: string;
    } | null;
    /** Attendance-driven disciplinary cases opened in the same cycle. Surfaced, never voided. */
    relatedCases: { id: string; caseNumber: string; stage: string; violationId: string | null }[];
    /** Non-empty when a push did not land. The service reports success even when it does not. */
    failures: string[];
}

export interface PunchAnomalyScanResult {
    start: string;
    end: string;
    rows: PunchAnomalyRow[];
    /** Employees actually read. `scanned + unreadable` is the roster the sweep set out to cover. */
    scanned: number;
    /** Employees the attendance service would not answer for — the queue is short by this many. */
    unreadable: number;
    warnings: string[];
    fetchedAt: string;
    /** True when this answer came from the server's short-lived cache rather than a fresh sweep. */
    cached?: boolean;
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

/** One employee's line in an approval batch. Hours/minutes are the TOTAL for the whole period. */
export interface OvertimeApprovalRow {
    empCode: string;
    hours: number;
    minutes: number;
}

/**
 * One period, many employees — which is how an approval actually arrives: a head replies about
 * their whole team for one span of days.
 *
 * The period must not cross a payroll boundary. The attendance system counts an approval in FULL
 * for every payroll run its period touches, with no pro-rating, so one 8-hour approval spanning
 * 20-30 Sep was measured being paid in both September and October. The server rejects it.
 */
export interface OvertimeApprovalInput {
    startDate: string;
    endDate: string;
    reason: string;
    headName?: string;
    notes?: string;
    rows: OvertimeApprovalRow[];
}

export interface OvertimeApprovalRecord {
    id: string;
    empCode: string;
    startDate: string;
    endDate: string;
    period: string;
    minutes: number;
    reason: string;
    notes: string | null;
    headName: string | null;
    status: string;
    sourceMessage: string | null;
    /**
     * The employee's TOTAL approved minutes over the period as read back afterwards — which
     * includes any earlier overlapping approval, not only this one. Evidence the write landed,
     * not a restatement of it.
     */
    verifiedMins: number | null;
    createdByName: string | null;
    appliedAt: string;
}

export interface OvertimeReportRow {
    empCode: string;
    employeeId: string | null;
    name: string;
    nameArabic: string | null;
    placement: { unit: string | null; department: string | null; division: string | null; directorate: string | null };
    recordedMins: number;
    approvedMins: number;
    approvals: { startDate: string; endDate: string; minutes: number; status: string; headName: string | null; appliedAt: string }[];
}

export interface OvertimeReportGroup {
    key: string;
    label: string;
    /** `unassigned` and `notLinked` are not org nodes — they are the two ways out of one. */
    kind: 'unit' | 'department' | 'division' | 'all' | 'unassigned' | 'notLinked';
    rows: OvertimeReportRow[];
    recordedMins: number;
    approvedMins: number;
}

/** A day of an individual's overtime. `dayKind` is why the hours exist at all. */
export interface OvertimeDetailDay {
    date: string;
    dayKind: 'weekday' | 'restDay' | 'holiday';
    holidayName: string | null;
    punches: string[];
    otMins: number;
    workMins: number;
}

export interface OvertimeReport {
    start: string;
    end: string;
    period: string | null;
    /** True when the range spans two financial months: reportable, but not approvable as one period. */
    crossesPayrollBoundary: boolean;
    totals: { employees: number; recordedMins: number; approvedMins: number; unplaced: number; notLinked: number };
    groups: OvertimeReportGroup[];
    detail: OvertimeDetailDay[] | null;
    warnings: string[];
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

    /**
     * The cross-employee queue of days whose punches did not come out as a working day.
     *
     * Ask by `period` ('YYYY-MM', a financial month) or by an explicit `start`/`end` pair — the
     * server rejects both at once. The 25th → 24th arithmetic deliberately lives server-side; a
     * copy of it here is how the boundary would start disagreeing with payroll. With neither, the
     * answer covers the current financial month.
     *
     * `refresh` skips a ~5-minute server cache; the sweep is one sequential call per employee, so
     * a cached answer is the normal one.
     */
    async getPunchAnomalies(params: { period?: string; start?: string; end?: string; empCode?: string; refresh?: boolean } = {}): Promise<PunchAnomalyScanResult> {
        const response = await api.get('/attendance-integration/punch-anomalies', {
            params: {
                period: params.period || undefined,
                start: params.start || undefined,
                end: params.end || undefined,
                empCode: params.empCode || undefined,
                refresh: params.refresh ? 'true' : undefined,
            },
        });
        return response.data;
    },

    /**
     * Pushes one day's repairs into the attendance service and logs them.
     *
     * `fingerprint` is the day's punches as the screen displayed them; the server refuses with 409
     * if they have changed since. `empCode` must stay in the body — the audit middleware resolves
     * the subject employee from exactly that field.
     */
    async correctPunches(input: {
        empCode: string;
        workDate: string;
        reason: string;
        steps: PunchCorrectionStep[];
        fingerprint?: string;
        anomalyKind?: string | null;
    }): Promise<PunchCorrectionResult> {
        const response = await api.post('/attendance-integration/punch-corrections', input);
        return response.data;
    },

    async getPunchCorrections(params: { empCode?: string; workDate?: string; period?: string } = {}): Promise<{ corrections: PunchCorrectionRecord[] }> {
        const response = await api.get('/attendance-integration/punch-corrections', { params });
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

    /**
     * Records approved overtime for one period across many employees.
     *
     * Only approved overtime is ever paid; the punch-derived figure is a reference payroll ignores.
     * The server validates the whole batch before writing any of it, rejects a period that crosses
     * a payroll boundary, and rejects an employee code the attendance system does not know — it
     * would otherwise answer 200 and file the approval against nobody.
     */
    async approveOvertime(input: OvertimeApprovalInput): Promise<{
        approvals: OvertimeApprovalRecord[]; period: string; applied: number; failures: string[];
    }> {
        const response = await api.post('/attendance-integration/overtime-approvals', input);
        return response.data;
    },

    async getOvertimeApprovals(params: { period?: string; empCode?: string; start?: string; end?: string } = {}): Promise<{ approvals: OvertimeApprovalRecord[] }> {
        const response = await api.get('/attendance-integration/overtime-approvals', { params });
        return response.data;
    },

    /**
     * Changes an approval's hours by re-posting its exact period, which the attendance service
     * upserts. The old log row is marked SUPERSEDED and a new one records the new figure.
     */
    async editOvertimeApproval(id: string, input: { hours: number; minutes: number; reason: string }): Promise<{ approval: OvertimeApprovalRecord }> {
        const response = await api.patch(`/attendance-integration/overtime-approvals/${id}`, input);
        return response.data;
    },

    /**
     * Revokes an approval — sets its hours to ZERO so nothing is paid.
     *
     * Deliberately not called 'delete': the attendance system has no delete endpoint for
     * overtime, so the record survives there at 00:00:00. Verified live.
     */
    async revokeOvertimeApproval(id: string, input: { reason: string }): Promise<{ approval: OvertimeApprovalRecord }> {
        const response = await api.delete(`/attendance-integration/overtime-approvals/${id}`, { data: input });
        return response.data;
    },

    /** Recorded overtime for a range, grouped for whoever approves it. */
    async getOvertimeReport(params: { start: string; end: string; scope?: string; scopeId?: string; empCode?: string }): Promise<OvertimeReport> {
        const response = await api.get('/attendance-integration/overtime-report', { params });
        return response.data;
    },

    /** The same report as a signable Word document — one file per group. */
    async getOvertimeReportDoc(params: { start: string; end: string; scope?: string; scopeId?: string }): Promise<Blob> {
        const response = await api.get('/attendance-integration/overtime-report/document', { params, responseType: 'blob' });
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
