export type UserRole =
    | 'SUPER_ADMIN'
    | 'CHAIRMAN'
    | 'GENERAL_MANAGER'
    | 'HEAD_DIVISION'
    | 'HEAD_OFFICE'
    | 'HEAD_DIRECTOR'
    | 'HEAD_DEPARTMENT'
    | 'HEAD_UNIT'
    | 'HR_MANAGER'
    | 'EMPLOYEE'
    | 'PERSONNEL';
    
export const JOB_CATEGORIES = [
    'Administrative Officer',
    'Engineer',
    'Financial Officer',
    'Operation Officer',
    'Support Officer',
    'Supervisor',
    'Technician'
] as const;

export type JobCategory = typeof JOB_CATEGORIES[number];

export const JOB_GRADES = [
    'Trainee',
    'Intern',
    'Junior',
    'Lead',
    'Senior',
    'Associate Consultant',
    'Lead Consultant',
    'Senior consultant'
] as const;

export type JobGrade = typeof JOB_GRADES[number];

export interface User {
    id: string;
    email: string;
    role: UserRole;
    groupId?: string;
    divisionId?: string;
    departmentId?: string;
    unitId?: string;
    departmentIds?: string[];
    fullName: string;
    employeeId?: string; // Link to HR record
    permissions?: string[]; // Granular access permissions
    signature?: string | null; // Drawn signature stored as a PNG data URL
}

export interface Unit {
    id: string;
    name: string;
    departmentId: string;
    headcount: number;
    _count?: {
        employees: number;
    };
}

export interface Group {
    id: string;
    name: string;
}

export interface Directorate {
    id: string;
    name: string;
}

export interface Division {
    id: string;
    name: string;
    directorateId?: string;
    _count?: {
        departments: number;
        employees: number;
    };
}

export interface Department {
    id: string;
    name: string;
    groupId: string;
    divisionId?: string;
    isOffice?: boolean;
}

export interface JDSection {
    en?: string;
    ar?: string;
}

export interface JobDescriptionDetails {
    jobPurpose?: JDSection;
    keyResponsibilities?: JDSection;
    kpi?: JDSection;
    education?: JDSection;
    experience?: JDSection;
    skills?: JDSection;
    trainingLicenses?: JDSection;
    workingConditions?: JDSection;
    reportsTo?: string; // "Reports To" — written by whoever requests/creates the JD
}

export interface JobDescription {
    id: string;
    title: string;
    description?: string;
    isHead: boolean;
    plannedCount: number;
    jobCategories?: JobCategory[];
    workLocations?: string[]; // 'OFFICE' | 'SITE'
    details?: JobDescriptionDetails;
    directorateId?: string;
    divisionId?: string;
    departmentId?: string;
    unitId?: string;
    createdAt?: string;
    updatedAt?: string;
    directorate?: { id: string; name: string };
    division?: { id: string; name: string };
    department?: { id: string; name: string };
    unit?: { id: string; name: string };
    _count?: {
        employees: number;
    };
}

export interface Employee {
    id: string;
    fullName: string;
    email?: string; // Added for linking with Auth (Optional now)
    role: UserRole;
    directorateId?: string;
    divisionId?: string;
    departmentId: string;
    unitId?: string;
    groupId: string;
    baseSalary: number;
    joinDate: string;
    staffId?: string; // Manual Employee ID (e.g. EMP-001)
    bioId?: number; // BioTime attendance system's own numeric employee id, once auto-provisioned
    enrollmentStatus?: string; // "ACTIVE" | "PENDING_ENROLLMENT" (BioTime-imported stub awaiting enrolment)
    position?: string;
    placeOfWork?: string; // Office / Site — locked from the job description at onboarding
    fullNameArabic?: string;
    passportNumber?: string;
    contractNumber?: string;
    nationality?: string;

    // Extended Identity Details (recruitment intake form)
    dateOfBirth?: string;
    placeOfBirth?: string;
    nationalId?: string;
    academicQualification?: string;
    gender?: string;
    bloodType?: string;
    idCardNumber?: string;
    idPlaceOfIssue?: string;
    idIssueDate?: string;
    passportPlaceOfIssue?: string;
    passportExpiryDate?: string;
    drivingLicenseType?: string;
    drivingLicenseNumber?: string;
    drivingLicenseExpiry?: string;
    drivingLicensePlaceOfIssue?: string;
    personalPhone?: string;
    personalEmail?: string;
    emergencyContactNumber?: string;
    residentialAddress?: string;
    workedBefore?: string;
    hasRelativesInCompany?: string;
    relativesNames?: string;
    bankName?: string;
    bankBranchName?: string;
    bankAccountNumber?: string;
    arrivalDate?: string;
    cvUrl?: string;
    degreeUrl?: string;
    birthCertUrl?: string;
    passportCopyUrl?: string;
    bankCheckUrl?: string;
    photoUrl?: string;
    idCardUrl?: string;
    jobOfferUrl?: string;
    healthCertUrl?: string;

    // Arabic counterparts of the bilingual onboarding fields
    placeOfBirthArabic?: string;
    nationalityArabic?: string;
    academicQualificationArabic?: string;
    idPlaceOfIssueArabic?: string;
    passportPlaceOfIssueArabic?: string;
    drivingLicenseTypeArabic?: string;
    drivingLicensePlaceOfIssueArabic?: string;
    residentialAddressArabic?: string;
    relativesNamesArabic?: string;
    bankNameArabic?: string;
    bankBranchNameArabic?: string;

    // Onboarding-only fields (self-service onboarding form)
    serviceProviderCompany?: string;
    employeeTravelDate?: string;
    employeeStartDate?: string;
    ticketUrl?: string;
    residencyDocumentUrl?: string;
    interviewEvaluationUrl?: string;

    jobCategory?: string;
    jobGrade?: string;
    salaryStructureType?: string;
    positionFactor?: number;
    skillFactor?: number;
    siteFactor?: number;
    languageFactor?: number;
    roleCategory?: string;
    evaluationPoints?: number;

    // Contract Details
    contractStartDate?: string;
    contractEndDate?: string;
    contractType?: string;
    contractStatus?: string;
    holidaysUsed: number;
    emergencyHolidaysUsed?: number;
    unpaidHolidaysUsed?: number;
    bonusHolidays: number;
    bonusEmergencyHolidays?: number;
    accruedHolidays?: number;
    earnedHolidays?: number;
    remainingHolidays?: number;
    userId?: string; // Link to Auth record
    permissions?: string[]; // Granular access permissions
    contracts?: Contract[];
    jobDescriptionId?: string;
    jobDescription?: JobDescription;
}

// A free-form document attached to an employee beyond the fixed onboarding slots (CV, degree...).
export interface EmployeeDocument {
    id: string;
    employeeId: string;
    name: string;
    fileUrl: string;
    fileName?: string;
    uploadedByName?: string;
    createdAt: string;
}

export interface Contract {
    id: string;
    employeeId: string;
    contractNumber?: string;
    startDate: string;
    endDate?: string;
    type?: string;
    status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'ARCHIVED';
    salary: number;
    notes?: string;
    position?: string;
    jobCategory?: string;
    jobGrade?: string;
    holidaysUsed: number;
    emergencyHolidaysUsed: number;
    unpaidHolidaysUsed: number;
    documentUrl?: string;
    createdAt: string;
    updatedAt: string;
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

export interface DivisionEvaluation extends EvaluationMetrics {
    id: string;
    employeeId: string;
    month: string;
    comments: string;
    submittedAt: string;
    submittedBy: string;
    totalScore: number;
    departmentEvaluationId?: string;
}

export interface GMEvaluation {
    id: string;
    employeeId: string;
    month: string;
    finalScore: number;
    comments?: string;
    locked: boolean;
    lockedAt?: string;
    submittedBy: string;
}

export interface ChairmanEvaluation {
    id: string;
    employeeId: string;
    month: string;
    finalScore: number;
    comments?: string;
    locked: boolean;
    lockedAt?: string;
    submittedBy: string;
}

export interface PayrollResult {
    id: string;
    employeeId: string;
    month: string;
    totalHours: number;
    overtime: number;
    absences: number;
    departmentScore: number;
    divisionScore?: number;
    directorScore: number;
    gmScore?: number;
    chairmanScore?: number;
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

export interface RecruitmentRequest {
    id: string;
    requesterId: string;
    unitId?: string;
    departmentId?: string;
    divisionId?: string;
    jobTitle: string;
    reason?: string;
    type?: 'HIRE' | 'JD_CHANGE';
    jobDescriptionId?: string;
    jdPayload?: any;
    quantity?: number;
    hiredCount?: number;
    filled?: boolean;
    filledAt?: string;
    status: 'PENDING' | 'DEPT_APPROVED' | 'DIV_APPROVED' | 'HRMGR_APPROVED' | 'HRREC_APPROVED' | 'HR_APPROVED' | 'FULLY_APPROVED' | 'REJECTED';
    // PRF (Personnel Requisition Form) fields — HIRE requisitions
    employmentType?: string;
    typeOfRequest?: string;
    languageEn?: string;
    languageAr?: string;
    prfApprovals?: Record<string, { byId?: string; byName?: string; signature?: string | null; at?: string; note?: string | null; rejected?: boolean }>;
    deptNote?: string;
    hrNote?: string;
    gmNote?: string;
    deptApprovedById?: string;
    hrApprovedById?: string;
    gmApprovedById?: string;
    deptApprovedAt?: string;
    hrApprovedAt?: string;
    gmApprovedAt?: string;
    createdAt: string;
    updatedAt: string;

    // Included Relations
    requester?: { id: string; fullName: string; role: string };
    unit?: { id: string; name: string };
    department?: { id: string; name: string };
    division?: { id: string; name: string };
    jobDescription?: { id: string; title: string; plannedCount: number; workLocations?: string[]; _count?: { employees: number } };
    deptApprovedBy?: { id: string; fullName: string };
    hrApprovedBy?: { id: string; fullName: string };
    gmApprovedBy?: { id: string; fullName: string };
}

export type CandidateStage = 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';

export interface Candidate {
    id: string;
    requisitionId: string;
    fullName: string;
    phone?: string;
    email?: string;
    cvPath?: string;
    degreePath?: string;
    portfolioPath?: string;
    source?: string;
    speciality?: string;
    yearsExperience?: string;
    salaryExpectation?: string;
    nationality?: string;
    dateOfBirth?: string;
    placeOfLiving?: string;
    stage: CandidateStage;

    // Screening (requesting head)
    screenDecision?: 'ACCEPTED' | 'REJECTED';
    screenNote?: string;
    screenById?: string;
    screenAt?: string;

    // Interview
    interviewAt?: string;
    interviewLocation?: string;
    interviewNote?: string;

    // HR evaluation
    hrScore?: number;
    hrRecommend?: boolean;
    hrNote?: string;
    hrCriteria?: Record<string, number>;
    hrEvalById?: string;
    hrEvalAt?: string;

    // Technical evaluation (requesting head)
    techScore?: number;
    techRecommend?: boolean;
    techNote?: string;
    techCriteria?: Record<string, number>;
    techEvalById?: string;
    techEvalAt?: string;

    // Final decision + offer / onboarding
    finalDecision?: 'ACCEPTED' | 'REJECTED';
    finalNote?: string;
    offerDecision?: 'ACCEPTED' | 'DECLINED';
    offerNote?: string;
    offerAt?: string;

    // Job-offer parameters captured on the hiring list
    salaryStructure?: string;
    jobGrade?: string;
    placeOfWork?: string;
    contractMonths?: number;
    residentStatus?: string; // RESDANT | DIRCT NONE RESDANT | NONE RESDANT
    jobCategory?: string;
    offerGeneratedAt?: string;

    // Self-service onboarding
    onboardingToken?: string;
    onboardingStatus?: 'PENDING' | 'SUBMITTED' | 'ENROLLED';
    onboardingData?: Record<string, any>;
    onboardingSubmittedAt?: string;

    employeeId?: string;
    events?: Array<{
        action: string;
        performedBy: string;
        timestamp: string;
        note?: string;
    }>;
    createdById?: string;
    createdAt: string;
    updatedAt: string;

    // Included relations
    requisition?: RecruitmentRequest & {
        jobDescription?: { id: string; title: string; plannedCount: number; isHead?: boolean; jobCategories?: string[]; workLocations?: string[]; _count?: { employees: number } };
    };
    createdBy?: { id: string; fullName: string };
    screenBy?: { id: string; fullName: string };
    hrEvalBy?: { id: string; fullName: string };
    techEvalBy?: { id: string; fullName: string };
}
