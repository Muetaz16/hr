-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL,
    "departmentId" TEXT,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unitId" TEXT,
    "divisionId" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "functionalHatIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signature" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunctionalHat" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionalHat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT,
    "divisionId" TEXT,
    "isOffice" BOOLEAN NOT NULL DEFAULT false,
    "positionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Directorate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "positionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "Directorate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "directorateId" TEXT,
    "positionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "plannedCount" INTEGER NOT NULL DEFAULT 1,
    "jobCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "details" JSONB,
    "directorateId" TEXT,
    "divisionId" TEXT,
    "departmentId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "enrollmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "transferredCompany" TEXT,
    "transferredAt" TIMESTAMP(3),
    "departmentId" TEXT,
    "groupId" TEXT,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "staffId" TEXT,
    "bioId" INTEGER,
    "contractEndDate" TIMESTAMP(3),
    "contractStartDate" TIMESTAMP(3),
    "contractStatus" TEXT,
    "contractType" TEXT,
    "contractWorkType" TEXT DEFAULT 'Full Time',
    "holidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusHolidays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userId" TEXT,
    "unitId" TEXT,
    "position" TEXT,
    "placeOfWork" TEXT,
    "contractNumber" TEXT,
    "emergencyHolidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fullNameArabic" TEXT,
    "jobCategory" TEXT,
    "jobGrade" TEXT,
    "salaryStructureType" TEXT,
    "nationality" TEXT,
    "passportNumber" TEXT,
    "unpaidHolidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "siteFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "skillFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "languageFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "evaluationPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "promotionNotified" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "nationalId" TEXT,
    "academicQualification" TEXT,
    "gender" TEXT,
    "bloodType" TEXT,
    "idCardNumber" TEXT,
    "idPlaceOfIssue" TEXT,
    "idIssueDate" TIMESTAMP(3),
    "passportPlaceOfIssue" TEXT,
    "passportExpiryDate" TIMESTAMP(3),
    "drivingLicenseType" TEXT,
    "drivingLicenseNumber" TEXT,
    "drivingLicenseExpiry" TIMESTAMP(3),
    "drivingLicensePlaceOfIssue" TEXT,
    "personalPhone" TEXT,
    "personalEmail" TEXT,
    "emergencyContactNumber" TEXT,
    "residentialAddress" TEXT,
    "workedBefore" TEXT,
    "hasRelativesInCompany" TEXT,
    "relativesNames" TEXT,
    "bankName" TEXT,
    "bankBranchName" TEXT,
    "bankAccountNumber" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "cvUrl" TEXT,
    "degreeUrl" TEXT,
    "birthCertUrl" TEXT,
    "passportCopyUrl" TEXT,
    "bankCheckUrl" TEXT,
    "photoUrl" TEXT,
    "idCardUrl" TEXT,
    "jobOfferUrl" TEXT,
    "healthCertUrl" TEXT,
    "placeOfBirthArabic" TEXT,
    "nationalityArabic" TEXT,
    "academicQualificationArabic" TEXT,
    "idPlaceOfIssueArabic" TEXT,
    "passportPlaceOfIssueArabic" TEXT,
    "drivingLicenseTypeArabic" TEXT,
    "drivingLicensePlaceOfIssueArabic" TEXT,
    "residentialAddressArabic" TEXT,
    "relativesNamesArabic" TEXT,
    "bankNameArabic" TEXT,
    "bankBranchNameArabic" TEXT,
    "serviceProviderCompany" TEXT,
    "employeeTravelDate" TIMESTAMP(3),
    "employeeStartDate" TIMESTAMP(3),
    "ticketUrl" TEXT,
    "residencyDocumentUrl" TEXT,
    "interviewEvaluationUrl" TEXT,
    "jobDescriptionId" TEXT,
    "divisionId" TEXT,
    "directorateId" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelActionForm" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'TRANSFER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentDivision" TEXT,
    "currentDepartment" TEXT,
    "currentUnit" TEXT,
    "currentPosition" TEXT,
    "currentJobCategory" TEXT,
    "currentJobGrade" TEXT,
    "currentPlaceOfWork" TEXT,
    "newJobDescriptionId" TEXT,
    "newDivisionId" TEXT,
    "newDepartmentId" TEXT,
    "newUnitId" TEXT,
    "newPositionTitle" TEXT,
    "newJobCategory" TEXT,
    "newJobGrade" TEXT,
    "newPlaceOfWork" TEXT,
    "reportsTo" TEXT,
    "newCompany" TEXT,
    "newDivisionName" TEXT,
    "newDepartmentName" TEXT,
    "newUnitName" TEXT,
    "englishFactor" DOUBLE PRECISION,
    "positionFactor" DOUBLE PRECISION,
    "locationFactor" DOUBLE PRECISION,
    "skillFactor" DOUBLE PRECISION,
    "typeOfTransfer" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "justification" TEXT,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "createdByName" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonnelActionForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emergencyHolidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jobCategory" TEXT,
    "jobGrade" TEXT,
    "position" TEXT,
    "unpaidHolidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationPeriod" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "departmentId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledById" TEXT,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "isAutoManaged" BOOLEAN NOT NULL DEFAULT true,
    "disabledById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "openNotifiedAt" TIMESTAMP(3),
    "reminderNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "EvaluationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "assignedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absences" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HREvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "absenceUnauthorized" INTEGER NOT NULL DEFAULT 0,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "emergencyLeaves" INTEGER NOT NULL DEFAULT 0,
    "unpaidLeaves" INTEGER NOT NULL DEFAULT 0,
    "annualPaidLeaves" INTEGER NOT NULL DEFAULT 0,
    "absenceScore" DOUBLE PRECISION,
    "delayScore" DOUBLE PRECISION,
    "emergencyScore" DOUBLE PRECISION,
    "unpaidScore" DOUBLE PRECISION,
    "violationScore" DOUBLE PRECISION,
    "presenceScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,

    CONSTRAINT "HREvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "relColleagues" DOUBLE PRECISION,
    "teamwork" DOUBLE PRECISION,
    "workOrg" DOUBLE PRECISION,
    "commSkills" DOUBLE PRECISION,
    "regCompliance" DOUBLE PRECISION,
    "taskQuality" DOUBLE PRECISION,
    "timeCommit" DOUBLE PRECISION,
    "orgCompliance" DOUBLE PRECISION,
    "probSolving" DOUBLE PRECISION,
    "pressureHandling" DOUBLE PRECISION,
    "contDev" DOUBLE PRECISION,
    "regAdherence" DOUBLE PRECISION,
    "safetyAdherence" DOUBLE PRECISION,
    "appearance" DOUBLE PRECISION,
    "resPreservation" DOUBLE PRECISION,
    "dataPrivacy" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,

    CONSTRAINT "UnitEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "relColleagues" DOUBLE PRECISION,
    "teamwork" DOUBLE PRECISION,
    "workOrg" DOUBLE PRECISION,
    "commSkills" DOUBLE PRECISION,
    "regCompliance" DOUBLE PRECISION,
    "taskQuality" DOUBLE PRECISION,
    "timeCommit" DOUBLE PRECISION,
    "orgCompliance" DOUBLE PRECISION,
    "probSolving" DOUBLE PRECISION,
    "pressureHandling" DOUBLE PRECISION,
    "contDev" DOUBLE PRECISION,
    "regAdherence" DOUBLE PRECISION,
    "safetyAdherence" DOUBLE PRECISION,
    "appearance" DOUBLE PRECISION,
    "resPreservation" DOUBLE PRECISION,
    "dataPrivacy" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,

    CONSTRAINT "DepartmentEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "appearance" DOUBLE PRECISION,
    "commSkills" DOUBLE PRECISION,
    "contDev" DOUBLE PRECISION,
    "dataPrivacy" DOUBLE PRECISION,
    "orgCompliance" DOUBLE PRECISION,
    "pressureHandling" DOUBLE PRECISION,
    "probSolving" DOUBLE PRECISION,
    "regAdherence" DOUBLE PRECISION,
    "regCompliance" DOUBLE PRECISION,
    "relColleagues" DOUBLE PRECISION,
    "resPreservation" DOUBLE PRECISION,
    "safetyAdherence" DOUBLE PRECISION,
    "taskQuality" DOUBLE PRECISION,
    "teamwork" DOUBLE PRECISION,
    "timeCommit" DOUBLE PRECISION,
    "workOrg" DOUBLE PRECISION,

    CONSTRAINT "DirectorEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "warningMessages" INTEGER NOT NULL DEFAULT 0,
    "disciplinaryDeduction" INTEGER NOT NULL DEFAULT 0,
    "appreciationMessages" INTEGER NOT NULL DEFAULT 0,
    "exceptionalAssignments" INTEGER NOT NULL DEFAULT 0,
    "specializedTraining" BOOLEAN NOT NULL DEFAULT false,
    "supportingTraining" BOOLEAN NOT NULL DEFAULT false,
    "languageTraining" BOOLEAN NOT NULL DEFAULT false,
    "softwareTraining" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT,

    CONSTRAINT "PersonnelEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationFinalization" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedById" TEXT,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EvaluationFinalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollResult" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absences" INTEGER NOT NULL DEFAULT 0,
    "hrPresenceScore" DOUBLE PRECISION,
    "hrAbsenceDays" INTEGER NOT NULL DEFAULT 0,
    "hrDelayMinutes" INTEGER NOT NULL DEFAULT 0,
    "adminScore" DOUBLE PRECISION,
    "executiveScore" DOUBLE PRECISION,
    "careScore" DOUBLE PRECISION,
    "deptPerformance" DOUBLE PRECISION,
    "deptDiscipline" DOUBLE PRECISION,
    "departmentScore" DOUBLE PRECISION,
    "directorLeadership" DOUBLE PRECISION,
    "directorImpact" DOUBLE PRECISION,
    "directorScore" DOUBLE PRECISION,
    "divisionScore" DOUBLE PRECISION,
    "gmScore" DOUBLE PRECISION,
    "chairmanScore" DOUBLE PRECISION,
    "personnelScore" DOUBLE PRECISION,
    "personnelDeductionDays" DOUBLE PRECISION,
    "personnelBonusDays" DOUBLE PRECISION,
    "exceptionalScore" DOUBLE PRECISION,
    "trainingScore" DOUBLE PRECISION,
    "trainingSummary" TEXT,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "finalSalary" DOUBLE PRECISION NOT NULL,
    "csvGenerated" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appearance" DOUBLE PRECISION,
    "commSkills" DOUBLE PRECISION,
    "contDev" DOUBLE PRECISION,
    "dataPrivacy" DOUBLE PRECISION,
    "hrAnnualPaidLeaves" INTEGER NOT NULL DEFAULT 0,
    "hrEmergencyDays" INTEGER NOT NULL DEFAULT 0,
    "hrUnpaidLeaves" INTEGER NOT NULL DEFAULT 0,
    "orgCompliance" DOUBLE PRECISION,
    "pressureHandling" DOUBLE PRECISION,
    "probSolving" DOUBLE PRECISION,
    "regAdherence" DOUBLE PRECISION,
    "regCompliance" DOUBLE PRECISION,
    "relColleagues" DOUBLE PRECISION,
    "resPreservation" DOUBLE PRECISION,
    "safetyAdherence" DOUBLE PRECISION,
    "taskQuality" DOUBLE PRECISION,
    "teamwork" DOUBLE PRECISION,
    "timeCommit" DOUBLE PRECISION,
    "workOrg" DOUBLE PRECISION,

    CONSTRAINT "PayrollResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "finalDocumentUrl" TEXT,
    "finalDocumentName" TEXT,
    "managerNote" TEXT,
    "hrNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "replacementUserId" TEXT,
    "replacementStatus" TEXT,
    "replacementDecidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deptApprovedById" TEXT,
    "divisionApprovedById" TEXT,
    "directorApprovedById" TEXT,
    "unitApprovedById" TEXT,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalStep" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "coversStages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approverUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTask" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "assigneeId" TEXT,
    "departmentId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "deadline" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "category" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,
    "estimatedReadyAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "unitId" TEXT,
    "departmentId" TEXT,
    "divisionId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "reason" TEXT,
    "type" TEXT NOT NULL DEFAULT 'HIRE',
    "jobDescriptionId" TEXT,
    "jdPayload" JSONB,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "filled" BOOLEAN NOT NULL DEFAULT false,
    "filledAt" TIMESTAMP(3),
    "publishedToCareers" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "hrNote" TEXT,
    "gmNote" TEXT,
    "hrApprovedById" TEXT,
    "gmApprovedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deptApprovedById" TEXT,
    "deptNote" TEXT,
    "deptApprovedAt" TIMESTAMP(3),
    "hrApprovedAt" TIMESTAMP(3),
    "gmApprovedAt" TIMESTAMP(3),
    "reportsTo" TEXT,
    "employmentType" TEXT,
    "typeOfRequest" TEXT,
    "languageEn" TEXT,
    "languageAr" TEXT,
    "prfApprovals" JSONB,

    CONSTRAINT "RecruitmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "cvPath" TEXT,
    "source" TEXT,
    "appliedViaCareers" BOOLEAN NOT NULL DEFAULT false,
    "degreePath" TEXT,
    "portfolioPath" TEXT,
    "speciality" TEXT,
    "educationLevel" TEXT,
    "yearsExperience" TEXT,
    "salaryExpectation" TEXT,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfLiving" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'SCREENING',
    "onboardingToken" TEXT,
    "onboardingStatus" TEXT,
    "onboardingData" JSONB,
    "onboardingSubmittedAt" TIMESTAMP(3),
    "screenDecision" TEXT,
    "screenNote" TEXT,
    "screenById" TEXT,
    "screenAt" TIMESTAMP(3),
    "interviewAt" TIMESTAMP(3),
    "interviewLocation" TEXT,
    "interviewNote" TEXT,
    "hrScore" INTEGER,
    "hrRecommend" BOOLEAN,
    "hrNote" TEXT,
    "hrCriteria" JSONB,
    "hrEvalById" TEXT,
    "hrEvalAt" TIMESTAMP(3),
    "techScore" INTEGER,
    "techRecommend" BOOLEAN,
    "techNote" TEXT,
    "techCriteria" JSONB,
    "techEvalById" TEXT,
    "techEvalAt" TIMESTAMP(3),
    "finalDecision" TEXT,
    "finalNote" TEXT,
    "offerDecision" TEXT,
    "offerNote" TEXT,
    "offerAt" TIMESTAMP(3),
    "salaryStructure" TEXT,
    "jobGrade" TEXT,
    "jobCategory" TEXT,
    "placeOfWork" TEXT,
    "contractMonths" INTEGER,
    "residentStatus" TEXT,
    "offerGeneratedAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "events" JSONB DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "relColleagues" DOUBLE PRECISION,
    "teamwork" DOUBLE PRECISION,
    "workOrg" DOUBLE PRECISION,
    "commSkills" DOUBLE PRECISION,
    "regCompliance" DOUBLE PRECISION,
    "taskQuality" DOUBLE PRECISION,
    "timeCommit" DOUBLE PRECISION,
    "orgCompliance" DOUBLE PRECISION,
    "probSolving" DOUBLE PRECISION,
    "pressureHandling" DOUBLE PRECISION,
    "contDev" DOUBLE PRECISION,
    "regAdherence" DOUBLE PRECISION,
    "safetyAdherence" DOUBLE PRECISION,
    "appearance" DOUBLE PRECISION,
    "resPreservation" DOUBLE PRECISION,
    "dataPrivacy" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,

    CONSTRAINT "DivisionEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GMEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION,
    "comments" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "submittedById" TEXT,

    CONSTRAINT "GMEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChairmanEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION,
    "comments" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "submittedById" TEXT,

    CONSTRAINT "ChairmanEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "jobCategory" TEXT NOT NULL,
    "jobGrade" TEXT NOT NULL,
    "structureLevel" TEXT NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "monthlyRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionalHat_key_key" ON "FunctionalHat"("key");

-- CreateIndex
CREATE INDEX "JobDescription_directorateId_idx" ON "JobDescription"("directorateId");

-- CreateIndex
CREATE INDEX "JobDescription_divisionId_idx" ON "JobDescription"("divisionId");

-- CreateIndex
CREATE INDEX "JobDescription_departmentId_idx" ON "JobDescription"("departmentId");

-- CreateIndex
CREATE INDEX "JobDescription_unitId_idx" ON "JobDescription"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_unitId_idx" ON "Employee"("unitId");

-- CreateIndex
CREATE INDEX "Employee_groupId_idx" ON "Employee"("groupId");

-- CreateIndex
CREATE INDEX "Employee_jobDescriptionId_idx" ON "Employee"("jobDescriptionId");

-- CreateIndex
CREATE INDEX "Employee_bioId_idx" ON "Employee"("bioId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");

-- CreateIndex
CREATE INDEX "PersonnelActionForm_employeeId_idx" ON "PersonnelActionForm"("employeeId");

-- CreateIndex
CREATE INDEX "PersonnelActionForm_status_idx" ON "PersonnelActionForm"("status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Contract_employeeId_idx" ON "Contract"("employeeId");

-- CreateIndex
CREATE INDEX "TimeRecord_employeeId_month_idx" ON "TimeRecord"("employeeId", "month");

-- CreateIndex
CREATE INDEX "HREvaluation_employeeId_month_idx" ON "HREvaluation"("employeeId", "month");

-- CreateIndex
CREATE INDEX "UnitEvaluation_employeeId_month_idx" ON "UnitEvaluation"("employeeId", "month");

-- CreateIndex
CREATE INDEX "DepartmentEvaluation_employeeId_month_idx" ON "DepartmentEvaluation"("employeeId", "month");

-- CreateIndex
CREATE INDEX "DirectorEvaluation_employeeId_month_idx" ON "DirectorEvaluation"("employeeId", "month");

-- CreateIndex
CREATE INDEX "PersonnelEvaluation_employeeId_month_idx" ON "PersonnelEvaluation"("employeeId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationFinalization_employeeId_month_key" ON "EvaluationFinalization"("employeeId", "month");

-- CreateIndex
CREATE INDEX "PayrollResult_employeeId_month_idx" ON "PayrollResult"("employeeId", "month");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_replacementUserId_idx" ON "LeaveRequest"("replacementUserId");

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_leaveRequestId_idx" ON "LeaveApprovalStep"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_approverUserId_status_idx" ON "LeaveApprovalStep"("approverUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalStep_leaveRequestId_sequence_approverUserId_key" ON "LeaveApprovalStep"("leaveRequestId", "sequence", "approverUserId");

-- CreateIndex
CREATE INDEX "StaffTask_assigneeId_idx" ON "StaffTask"("assigneeId");

-- CreateIndex
CREATE INDEX "StaffTask_status_idx" ON "StaffTask"("status");

-- CreateIndex
CREATE INDEX "StaffTask_category_idx" ON "StaffTask"("category");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "AssetRequest_employeeId_idx" ON "AssetRequest"("employeeId");

-- CreateIndex
CREATE INDEX "AssetRequest_status_idx" ON "AssetRequest"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_requesterId_idx" ON "SupportTicket"("requesterId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_assigneeId_idx" ON "SupportTicket"("assigneeId");

-- CreateIndex
CREATE INDEX "RecruitmentRequest_status_idx" ON "RecruitmentRequest"("status");

-- CreateIndex
CREATE INDEX "RecruitmentRequest_type_idx" ON "RecruitmentRequest"("type");

-- CreateIndex
CREATE INDEX "RecruitmentRequest_publishedToCareers_filled_idx" ON "RecruitmentRequest"("publishedToCareers", "filled");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_onboardingToken_key" ON "Candidate"("onboardingToken");

-- CreateIndex
CREATE INDEX "Candidate_requisitionId_idx" ON "Candidate"("requisitionId");

-- CreateIndex
CREATE INDEX "Candidate_stage_idx" ON "Candidate"("stage");

-- CreateIndex
CREATE INDEX "DivisionEvaluation_employeeId_month_idx" ON "DivisionEvaluation"("employeeId", "month");

-- CreateIndex
CREATE INDEX "GMEvaluation_employeeId_month_idx" ON "GMEvaluation"("employeeId", "month");

-- CreateIndex
CREATE INDEX "ChairmanEvaluation_employeeId_month_idx" ON "ChairmanEvaluation"("employeeId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_jobCategory_jobGrade_structureLevel_key" ON "SalaryStructure"("jobCategory", "jobGrade", "structureLevel");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "Directorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "Directorate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES "Directorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelActionForm" ADD CONSTRAINT "PersonnelActionForm_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_enabledById_fkey" FOREIGN KEY ("enabledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HREvaluation" ADD CONSTRAINT "HREvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HREvaluation" ADD CONSTRAINT "HREvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitEvaluation" ADD CONSTRAINT "UnitEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitEvaluation" ADD CONSTRAINT "UnitEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentEvaluation" ADD CONSTRAINT "DepartmentEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentEvaluation" ADD CONSTRAINT "DepartmentEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorEvaluation" ADD CONSTRAINT "DirectorEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorEvaluation" ADD CONSTRAINT "DirectorEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelEvaluation" ADD CONSTRAINT "PersonnelEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelEvaluation" ADD CONSTRAINT "PersonnelEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationFinalization" ADD CONSTRAINT "EvaluationFinalization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationFinalization" ADD CONSTRAINT "EvaluationFinalization_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollResult" ADD CONSTRAINT "PayrollResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_replacementUserId_fkey" FOREIGN KEY ("replacementUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_deptApprovedById_fkey" FOREIGN KEY ("deptApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_divisionApprovedById_fkey" FOREIGN KEY ("divisionApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_directorApprovedById_fkey" FOREIGN KEY ("directorApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_unitApprovedById_fkey" FOREIGN KEY ("unitApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRequest" ADD CONSTRAINT "AssetRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_deptApprovedById_fkey" FOREIGN KEY ("deptApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_gmApprovedById_fkey" FOREIGN KEY ("gmApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_hrApprovedById_fkey" FOREIGN KEY ("hrApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "RecruitmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_screenById_fkey" FOREIGN KEY ("screenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_hrEvalById_fkey" FOREIGN KEY ("hrEvalById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_techEvalById_fkey" FOREIGN KEY ("techEvalById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionEvaluation" ADD CONSTRAINT "DivisionEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionEvaluation" ADD CONSTRAINT "DivisionEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GMEvaluation" ADD CONSTRAINT "GMEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GMEvaluation" ADD CONSTRAINT "GMEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairmanEvaluation" ADD CONSTRAINT "ChairmanEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairmanEvaluation" ADD CONSTRAINT "ChairmanEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

