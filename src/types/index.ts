export type UserRole =
    | 'SUPER_ADMIN'
    | 'HEAD_DIRECTOR'
    | 'HEAD_DEPARTMENT'
    | 'HEAD_UNIT'
    | 'HR_MANAGER'
    | 'EMPLOYEE'
    | 'PERSONNEL';

export interface User {
    id: string;
    email: string;
    role: UserRole;
    groupId?: string;
    departmentId?: string;
    unitId?: string;
    departmentIds?: string[];
    fullName: string;
    employeeId?: string; // Link to HR record
}

export interface Unit {
    id: string;
    name: string;
    departmentId: string;
}

export interface Group {
    id: string;
    name: string;
}

export interface Department {
    id: string;
    name: string;
    groupId: string;
}

export interface Employee {
    id: string;
    fullName: string;
    email?: string; // Added for linking with Auth (Optional now)
    role: UserRole;
    departmentId: string;
    unitId?: string;
    groupId: string;
    baseSalary: number;
    joinDate: string;
    staffId?: string; // Manual Employee ID (e.g. EMP-001)
    position?: string;
    fullNameArabic?: string;
    passportNumber?: string;
    contractNumber?: string;
    nationality?: string;
    jobCategory?: string;
    jobGrade?: string;

    // Contract Details
    contractStartDate?: string;
    contractEndDate?: string;
    contractType?: string;
    contractStatus?: string;
    holidaysUsed: number;
    emergencyHolidaysUsed?: number;
    unpaidHolidaysUsed?: number;
    bonusHolidays: number;
    accruedHolidays?: number;
    earnedHolidays?: number;
    remainingHolidays?: number;
    userId?: string; // Link to Auth record
}

export interface TimeRecord {
    id: string;
    employeeId: string;
    month: string; // YYYY-MM
    assignedHours: number;
    workedHours: number;
    overtime: number;
    absences: number;
    lateMinutes: number;
    status: 'draft' | 'approved';
    updatedAt: string;
}

export interface HREvaluation {
    id: string;
    employeeId: string;
    month: string; // YYYY-MM

    // Presence Metrics (Counts/Minutes - for record)
    absenceWithoutPermission: number;
    delayAndEarlyDeparture: number;
    emergencyLeaves: number;
    unpaidLeave: number;
    annualPaidLeave: number;

    // Presence Scores (0-100 Manual Grading)
    // Weights: Absence(7), Delay(7), Emergency(2), Unpaid(2), Violation(2)
    absenceScoreValue?: number;
    delayScoreValue?: number;
    emergencyScoreValue?: number;
    unpaidScoreValue?: number;
    violationScoreValue?: number;

    // Calculated presence score
    presenceScore: number;

    // Metadata
    submittedAt: string;
    submittedBy: string; // HR Manager user ID
    status: 'draft' | 'submitted';
    comments?: string;
}

export interface EvaluationMetrics {
    // Administrative Behavior (25%)
    relationshipWithColleagues: number; // 5%
    teamworkParticipation: number; // 5%
    workOrganization: number; // 5%
    communicationSkills: number; // 5%
    regulatoryCompliance: number; // 5%

    // Executive Performance (40%)
    taskQuality: number; // 7%
    timeCommitment: number; // 7%
    organizationalCompliance: number; // 7%
    problemSolving: number; // 6%
    pressureHandling: number; // 7%
    continuousDevelopment: number; // 6%

    // Care and Discipline (35%)
    regulationsAdherence: number; // 7%
    safetyAdherence: number; // 7%
    appearanceCommitment: number; // 7%
    resourcePreservation: number; // 7%
    dataPrivacy: number; // 7%
}

export interface UnitEvaluation extends EvaluationMetrics {
    id: string;
    employeeId: string;
    month: string;
    comments: string;
    submittedAt: string;
    submittedBy: string;
    totalScore: number;
}

export interface DepartmentEvaluation extends EvaluationMetrics {
    id: string;
    employeeId: string;
    month: string;
    comments: string;
    submittedAt: string;
    submittedBy: string;
    totalScore: number; // Calculated sum
    unitEvaluationId?: string;
}

export interface DirectorEvaluation extends EvaluationMetrics {
    id: string;
    employeeId: string;
    month: string;
    finalScore: number; // Calculated sum
    approvedAt?: string;
    lockedAt?: string;
    submittedBy: string;
    locked: boolean;
    departmentEvaluationId?: string;
}

export interface PayrollResult {
    id: string;
    employeeId: string;
    month: string;
    totalHours: number;
    overtime: number;
    absences: number;
    departmentScore: number;
    directorScore: number;
    finalScore: number;
    finalSalary: number;

    // Category Scores (matches user request for detailed breakdown)
    hrPresenceScore?: number; // Out of 20 directly
    hrAbsenceDays?: number;   // Detail
    hrDelayMinutes?: number;  // Detail
    hrEmergencyDays?: number; // Detail
    hrUnpaidLeaves?: number;  // Detail
    hrAnnualPaidLeaves?: number; // Detail

    adminScore?: number;      // /25
    relColleagues?: number;
    teamwork?: number;
    workOrg?: number;
    commSkills?: number;
    regCompliance?: number;

    executiveScore?: number;  // /40
    taskQuality?: number;
    timeCommit?: number;
    orgCompliance?: number;
    probSolving?: number;
    pressureHandling?: number;
    contDev?: number;

    careScore?: number;       // /15
    regAdherence?: number;
    safetyAdherence?: number;
    appearance?: number;
    resPreservation?: number;
    dataPrivacy?: number;
    // personnelScore removed from here to avoid duplicate with Personnel Metrics section below

    // Legacy/Aggregate
    deptPerformance?: number;
    deptDiscipline?: number;
    directorLeadership?: number;
    directorImpact?: number;

    // Personnel Metrics
    personnelScore?: number; // Kept here
    personnelDeductionDays?: number;
    personnelBonusDays?: number;
    trainingSummary?: string; // New field for CSV/Display

    csvGenerated: boolean;
    generatedAt: string;
}

export interface PersonnelEvaluation {
    id: string;
    employeeId: string;
    month: string;

    // Activity & Discipline
    warningMessages: number;      // Max 3
    disciplinaryDeduction: number; // Max 14 days
    appreciationMessages: number; // Max 3
    exceptionalAssignments: number; // Max 30 days

    // Training & Development (Boolean)
    specializedTraining: boolean;
    supportingTraining: boolean;
    languageTraining: boolean;
    softwareTraining: boolean;

    submittedAt: string;
    submittedBy: string;
}

export interface EvaluationPeriod {
    id: string;
    month: string; // YYYY-MM
    departmentId?: string; // Optional - if null, applies to all departments
    groupId?: string; // Optional - if null, applies to all groups
    enabled: boolean;
    enabledBy: string; // HR Manager user ID
    enabledAt: string;
    notes?: string;
}
