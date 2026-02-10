export type UserRole =
    | 'SUPER_ADMIN'
    | 'HEAD_DIRECTOR'
    | 'HEAD_DEPARTMENT'
    | 'HR_MANAGER'
    | 'EMPLOYEE';

export interface User {
    id: string;
    email: string;
    role: UserRole;
    groupId?: string;
    departmentId?: string;
    fullName: string;
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
    email: string; // Added for linking with Auth
    role: UserRole;
    departmentId: string;
    groupId: string;
    baseSalary: number;
    joinDate: string;
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
    
    // Presence criteria from HR evaluation
    absenceWithoutPermission: number; // days (max 7)
    delayAndEarlyDeparture: number; // minutes (max 180)
    emergencyLeaves: number; // days (max 3)
    unpaidLeave: number; // days (max 14)
    annualPaidLeave: number; // days (max 14)
    
    // Calculated presence score (0-10)
    presenceScore: number;
    
    // Metadata
    submittedAt: string;
    submittedBy: string; // HR Manager user ID
    status: 'draft' | 'submitted';
    comments?: string;
}

export interface DepartmentEvaluation {
    id: string;
    employeeId: string;
    month: string;
    performance: number; // 0-10 or similar scale
    discipline: number;
    teamwork: number;
    productivity: number;
    comments: string;
    submittedAt: string;
    submittedBy: string;
    hrEvaluationId: string; // Reference to HR evaluation
}

export interface DirectorEvaluation {
    id: string;
    employeeId: string;
    month: string;
    leadership: number;
    impact: number;
    finalScore: number;
    approvedAt?: string;
    lockedAt?: string;
    submittedBy: string;
    locked: boolean;
    departmentEvaluationId: string; // Reference to department evaluation
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
    csvGenerated: boolean;
    generatedAt: string;
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
