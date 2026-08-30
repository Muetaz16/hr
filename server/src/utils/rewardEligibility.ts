import { PrismaClient } from '@prisma/client';
import { monthsSince } from './jobGrades';
import { fetchAttendanceSummary, currentCycleMonth, getPresenceWindow, type AttendanceSummary } from './disciplinaryAttendance';
import { fetchBioTimeRoster } from './attendanceApiProxy';

export { currentCycleMonth };

const prisma = new PrismaClient();

// role/unitId/departmentId/divisionId/directorateId are needed by the frontend's
// fetchEvaluationBreakdown util (its OrgPlacement type), used on the candidate review page.
const EMPLOYEE_SELECT = {
    id: true, fullName: true, staffId: true, position: true, bioId: true,
    jobCategory: true, jobGrade: true, joinDate: true, contractWorkType: true,
    role: true, unitId: true, departmentId: true, divisionId: true, directorateId: true,
    department: { select: { name: true, isOffice: true } },
    division: { select: { name: true } },
    unit: { select: { name: true } },
} as const;

// "Confirmed against the employee" — the same definition already used for the disciplinary record
// shown on the Employee Lifecycle tree (PersonnelRelations.tsx's detailDisciplinaryRecord filter):
// only a case that actually completed the Disciplinary Action stage counts, not one still in
// progress, dismissed at intake, or concluded Non Violation.
export async function hasConfirmedDisciplinaryRecord(employeeId: string, sinceDate: Date): Promise<boolean> {
    const found = await prisma.disciplinaryCase.findFirst({
        where: { employeeId, actionCompletedAt: { gte: sinceDate } },
        select: { id: true },
    });
    return !!found;
}

// Any non-rejected LeaveRequest overlapping the window counts as "filed" — a rejected request never
// actually took the employee off the floor, so it shouldn't disqualify them.
export async function hasLeaveRequestFiledInWindow(employeeId: string, start: string, end: string): Promise<boolean> {
    const windowStart = new Date(`${start}T00:00:00.000Z`);
    const windowEnd = new Date(`${end}T23:59:59.999Z`);
    const found = await prisma.leaveRequest.findFirst({
        where: {
            employeeId,
            status: { not: 'REJECTED' },
            startDate: { lte: windowEnd },
            OR: [
                { endDate: null, startDate: { gte: windowStart } },
                { endDate: { gte: windowStart } },
            ],
        },
        select: { id: true },
    });
    return !!found;
}

export interface RewardMonthCandidate {
    employeeId: string;
    employee: any;
    finalScore: number;
    rank: number; // 1-based position among the eligible list below, not among all scored employees
}

// Employee of the Month — the full ranked, eligible list for `month` (a single number 1st place
// isn't picked here; ties surface naturally and HR's grant click IS the tie-break, since the PDF's
// "attendance / supervisor recommendation" isn't a concrete formula to auto-resolve).
export async function computeMonthCandidates(month: string): Promise<RewardMonthCandidate[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const finalizations = await prisma.evaluationFinalization.findMany({
        where: { month },
        orderBy: { finalScore: 'desc' },
    });

    const out: Omit<RewardMonthCandidate, 'rank'>[] = [];
    for (const f of finalizations) {
        const employee = await prisma.employee.findUnique({ where: { id: f.employeeId }, select: { ...EMPLOYEE_SELECT, enrollmentStatus: true } });
        if (!employee) continue;
        if (employee.enrollmentStatus !== 'ACTIVE') continue;
        if (employee.contractWorkType !== 'Full Time') continue;
        if (monthsSince(employee.joinDate) < 6) continue;
        if (await hasConfirmedDisciplinaryRecord(f.employeeId, sixMonthsAgo)) continue;
        out.push({ employeeId: f.employeeId, employee, finalScore: f.finalScore });
    }
    return out.map((c, i) => ({ ...c, rank: i + 1 }));
}

export type AttendanceExclusionReason = 'NO_BIO_ID' | 'ATTENDANCE_FETCH_FAILED' | 'BIOTIME_UNREACHABLE';
export interface RewardAttendanceCandidate {
    employeeId: string;
    employee: any;
    attendanceSummary: AttendanceSummary;
    // Both always true for anyone in `candidates` (they wouldn't be here otherwise) — surfaced
    // explicitly as positive evidence for the candidate review page's "why they qualify" checklist,
    // not as a filter.
    hasLeaveRequestFiled: false;
    hasConfirmedDisciplinaryRecord: false;
}
export interface RewardAttendanceExclusion { employeeId: string; employeeName: string; reason: AttendanceExclusionReason; }
export interface RewardAttendanceResult {
    month: string; cycleStart: string; cycleEnd: string;
    candidates: RewardAttendanceCandidate[];
    excluded: RewardAttendanceExclusion[];
}

// "Employees using transportation provided by the company are excluded" — resolved live against
// BioTime's own residency classification (position id 4 = Resident), never our HR database: BioTime
// is the authoritative source here since attendance staff can reclassify an employee (Resident /
// Non-Resident / Exception / Higher-Management) directly in BioTime via the Attendance page's
// Employees tab, independent of Employee.contractType. One bulk roster call covers every employee.
async function fetchResidentStaffIds(): Promise<Set<string> | null> {
    const roster = await fetchBioTimeRoster();
    if (roster.length === 0) return null; // BioTime unreachable — fetchBioTimeRoster fails soft to []
    return new Set(roster.filter(r => r.positionId === 4).map(r => r.empCode));
}

// Monthly Attendance and Timeliness Excellence Award — a threshold award, not a ranking: every
// employee who clears the bar qualifies, not just one winner. Uses the same 25th-of-prior-month to
// 24th-of-target-month cycle the presence/disciplinary attendance systems already use, for
// consistency with how "month" is defined everywhere else attendance data is read.
export async function computeAttendanceCandidates(month: string): Promise<RewardAttendanceResult> {
    const { start, end } = getPresenceWindow(month);
    const windowStart = new Date(`${start}T00:00:00.000Z`);

    const employees = await prisma.employee.findMany({
        where: { enrollmentStatus: 'ACTIVE', contractWorkType: 'Full Time' },
        select: { ...EMPLOYEE_SELECT },
    });

    const residentStaffIds = await fetchResidentStaffIds();
    const candidates: RewardAttendanceCandidate[] = [];
    const excluded: RewardAttendanceExclusion[] = [];

    if (residentStaffIds === null) {
        // Don't silently produce an empty/wrong candidate list — make the real cause visible.
        for (const employee of employees) {
            excluded.push({ employeeId: employee.id, employeeName: employee.fullName, reason: 'BIOTIME_UNREACHABLE' });
        }
        return { month, cycleStart: start, cycleEnd: end, candidates, excluded };
    }

    for (const employee of employees) {
        if (!employee.staffId || !residentStaffIds.has(employee.staffId)) continue; // non-resident — uses company transportation, not a candidate at all
        if (!employee.bioId) {
            excluded.push({ employeeId: employee.id, employeeName: employee.fullName, reason: 'NO_BIO_ID' });
            continue;
        }
        const summary = await fetchAttendanceSummary(employee.bioId, start, end);
        if (!summary) {
            excluded.push({ employeeId: employee.id, employeeName: employee.fullName, reason: 'ATTENDANCE_FETCH_FAILED' });
            continue;
        }
        if (summary.lateDays > 0 || summary.unauthorizedAbsenceDays > 0) continue;
        // Disqualifies APPROVED leave too, not just unauthorized absence — the award's "no leave or
        // absences filed... whether authorized or unauthorized" is stricter than the attendance
        // system's own absence tally.
        if (await hasLeaveRequestFiledInWindow(employee.id, start, end)) continue;
        if (await hasConfirmedDisciplinaryRecord(employee.id, windowStart)) continue;
        candidates.push({ employeeId: employee.id, employee, attendanceSummary: summary, hasLeaveRequestFiled: false, hasConfirmedDisciplinaryRecord: false });
    }

    return { month, cycleStart: start, cycleEnd: end, candidates, excluded };
}

export interface RewardLoyaltyCandidate {
    employeeId: string;
    employee: any;
    milestoneYears: 5 | 10;
    milestoneDate: Date;
    tenureMonths: number;
}

// Loyalty & Service Milestone Award — an 11-year employee correctly surfaces for BOTH the 5-year and
// 10-year milestone the first time this is ever run (expected on a brand-new feature, not a bug);
// each is only granted once thanks to RewardCase's per-employee-per-milestoneYears unique constraint.
export async function checkLoyaltyMilestones(): Promise<RewardLoyaltyCandidate[]> {
    const employees = await prisma.employee.findMany({
        where: { enrollmentStatus: 'ACTIVE' },
        select: { ...EMPLOYEE_SELECT },
    });

    const grantedRows = await prisma.rewardCase.findMany({
        where: { type: 'LOYALTY_MILESTONE' },
        select: { employeeId: true, milestoneYears: true },
    });
    const grantedKeys = new Set(grantedRows.map(r => `${r.employeeId}:${r.milestoneYears}`));

    const out: RewardLoyaltyCandidate[] = [];
    for (const employee of employees) {
        if (!employee.joinDate) continue;
        const tenureMonths = monthsSince(employee.joinDate);
        for (const milestoneYears of [5, 10] as const) {
            if (grantedKeys.has(`${employee.id}:${milestoneYears}`)) continue;
            if (tenureMonths < milestoneYears * 12) continue;
            const milestoneDate = new Date(employee.joinDate);
            milestoneDate.setFullYear(milestoneDate.getFullYear() + milestoneYears);
            out.push({ employeeId: employee.id, employee, milestoneYears, milestoneDate, tenureMonths });
        }
    }
    return out;
}
