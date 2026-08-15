--
-- PostgreSQL database dump
--

\restrict dU9wrmW2Tcf8sXlsb5K0aBypc2rxu1mdX6q58XDqcJpKig2zgJn2KDA8BDCEPEx

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Announcement; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Announcement" (
    id text NOT NULL,
    "authorId" text,
    "targetType" text NOT NULL,
    "targetId" text,
    title text NOT NULL,
    content text NOT NULL,
    "expiryDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "attachmentName" text,
    "attachmentUrl" text
);


ALTER TABLE public."Announcement" OWNER TO postgres;

--
-- Name: AssetRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AssetRequest" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "requesterId" text NOT NULL,
    "itemType" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AssetRequest" OWNER TO postgres;

--
-- Name: Candidate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Candidate" (
    id text NOT NULL,
    "requisitionId" text NOT NULL,
    "fullName" text NOT NULL,
    phone text,
    email text,
    "cvPath" text,
    stage text DEFAULT 'SCREENING'::text NOT NULL,
    "screenDecision" text,
    "screenNote" text,
    "screenById" text,
    "screenAt" timestamp(3) without time zone,
    "interviewAt" timestamp(3) without time zone,
    "interviewLocation" text,
    "interviewNote" text,
    "hrScore" integer,
    "hrRecommend" boolean,
    "hrNote" text,
    "hrEvalById" text,
    "hrEvalAt" timestamp(3) without time zone,
    "techScore" integer,
    "techRecommend" boolean,
    "techNote" text,
    "techEvalById" text,
    "techEvalAt" timestamp(3) without time zone,
    "finalDecision" text,
    "finalNote" text,
    "offerDecision" text,
    "offerNote" text,
    "offerAt" timestamp(3) without time zone,
    "employeeId" text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    source text,
    "degreePath" text,
    "portfolioPath" text,
    speciality text,
    "yearsExperience" text,
    "salaryExpectation" text,
    nationality text,
    "dateOfBirth" timestamp(3) without time zone,
    "placeOfLiving" text,
    "salaryStructure" text,
    "jobGrade" text,
    "placeOfWork" text,
    "contractMonths" integer,
    "hrCriteria" jsonb,
    "techCriteria" jsonb,
    "residentStatus" text,
    "offerGeneratedAt" timestamp(3) without time zone,
    "appliedViaCareers" boolean DEFAULT false NOT NULL,
    "educationLevel" text,
    "onboardingToken" text,
    "onboardingStatus" text,
    "onboardingData" jsonb,
    "onboardingSubmittedAt" timestamp(3) without time zone,
    "jobCategory" text,
    events jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public."Candidate" OWNER TO postgres;

--
-- Name: ChairmanEvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ChairmanEvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "finalScore" double precision,
    comments text,
    locked boolean DEFAULT false NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "submittedById" text
);


ALTER TABLE public."ChairmanEvaluation" OWNER TO postgres;

--
-- Name: Contract; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Contract" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "contractNumber" text,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    type text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    salary double precision DEFAULT 0 NOT NULL,
    notes text,
    "documentUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "emergencyHolidaysUsed" double precision DEFAULT 0 NOT NULL,
    "holidaysUsed" double precision DEFAULT 0 NOT NULL,
    "jobCategory" text,
    "jobGrade" text,
    "position" text,
    "unpaidHolidaysUsed" double precision DEFAULT 0 NOT NULL
);


ALTER TABLE public."Contract" OWNER TO postgres;

--
-- Name: Department; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Department" (
    id text NOT NULL,
    name text NOT NULL,
    "groupId" text,
    "divisionId" text,
    "isOffice" boolean DEFAULT false NOT NULL,
    "positionFactor" double precision DEFAULT 1.0 NOT NULL
);


ALTER TABLE public."Department" OWNER TO postgres;

--
-- Name: DepartmentEvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DepartmentEvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "relColleagues" double precision,
    teamwork double precision,
    "workOrg" double precision,
    "commSkills" double precision,
    "regCompliance" double precision,
    "taskQuality" double precision,
    "timeCommit" double precision,
    "orgCompliance" double precision,
    "probSolving" double precision,
    "pressureHandling" double precision,
    "contDev" double precision,
    "regAdherence" double precision,
    "safetyAdherence" double precision,
    appearance double precision,
    "resPreservation" double precision,
    "dataPrivacy" double precision,
    "totalScore" double precision,
    comments text,
    "submittedAt" timestamp(3) without time zone,
    "submittedById" text
);


ALTER TABLE public."DepartmentEvaluation" OWNER TO postgres;

--
-- Name: DirectorEvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DirectorEvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "finalScore" double precision,
    locked boolean DEFAULT false NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "submittedById" text,
    appearance double precision,
    "commSkills" double precision,
    "contDev" double precision,
    "dataPrivacy" double precision,
    "orgCompliance" double precision,
    "pressureHandling" double precision,
    "probSolving" double precision,
    "regAdherence" double precision,
    "regCompliance" double precision,
    "relColleagues" double precision,
    "resPreservation" double precision,
    "safetyAdherence" double precision,
    "taskQuality" double precision,
    teamwork double precision,
    "timeCommit" double precision,
    "workOrg" double precision
);


ALTER TABLE public."DirectorEvaluation" OWNER TO postgres;

--
-- Name: Directorate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Directorate" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "positionFactor" double precision DEFAULT 1.0 NOT NULL
);


ALTER TABLE public."Directorate" OWNER TO postgres;

--
-- Name: Division; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Division" (
    id text NOT NULL,
    name text NOT NULL,
    "directorateId" text,
    "positionFactor" double precision DEFAULT 1.0 NOT NULL
);


ALTER TABLE public."Division" OWNER TO postgres;

--
-- Name: DivisionEvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DivisionEvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "relColleagues" double precision,
    teamwork double precision,
    "workOrg" double precision,
    "commSkills" double precision,
    "regCompliance" double precision,
    "taskQuality" double precision,
    "timeCommit" double precision,
    "orgCompliance" double precision,
    "probSolving" double precision,
    "pressureHandling" double precision,
    "contDev" double precision,
    "regAdherence" double precision,
    "safetyAdherence" double precision,
    appearance double precision,
    "resPreservation" double precision,
    "dataPrivacy" double precision,
    "totalScore" double precision,
    comments text,
    "submittedAt" timestamp(3) without time zone,
    "submittedById" text
);


ALTER TABLE public."DivisionEvaluation" OWNER TO postgres;

--
-- Name: Employee; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Employee" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    email text,
    role text DEFAULT 'EMPLOYEE'::text NOT NULL,
    "departmentId" text,
    "groupId" text,
    "baseSalary" double precision DEFAULT 0 NOT NULL,
    "joinDate" timestamp(3) without time zone NOT NULL,
    "staffId" text,
    "contractEndDate" timestamp(3) without time zone,
    "contractStartDate" timestamp(3) without time zone,
    "contractStatus" text,
    "contractType" text,
    "holidaysUsed" double precision DEFAULT 0 NOT NULL,
    "bonusHolidays" double precision DEFAULT 0 NOT NULL,
    "userId" text,
    "unitId" text,
    "position" text,
    "contractNumber" text,
    "emergencyHolidaysUsed" double precision DEFAULT 0 NOT NULL,
    "fullNameArabic" text,
    "jobCategory" text,
    "jobGrade" text,
    nationality text,
    "passportNumber" text,
    "unpaidHolidaysUsed" double precision DEFAULT 0 NOT NULL,
    "accruedHolidays" double precision DEFAULT 0 NOT NULL,
    "bonusEmergencyHolidays" double precision DEFAULT 0 NOT NULL,
    "earnedHolidays" double precision DEFAULT 0 NOT NULL,
    "remainingHolidays" double precision DEFAULT 0 NOT NULL,
    "positionFactor" double precision DEFAULT 1.0 NOT NULL,
    "roleCategory" text DEFAULT 'Support'::text,
    "siteFactor" double precision DEFAULT 1.0 NOT NULL,
    "skillFactor" double precision DEFAULT 1.0 NOT NULL,
    "languageFactor" double precision DEFAULT 1.0 NOT NULL,
    "divisionId" text,
    "directorateId" text,
    "evaluationPoints" double precision DEFAULT 0 NOT NULL,
    "promotionNotified" boolean DEFAULT false NOT NULL,
    "salaryStructureType" text,
    "jobDescriptionId" text,
    "placeOfWork" text,
    "dateOfBirth" timestamp(3) without time zone,
    "placeOfBirth" text,
    "nationalId" text,
    "academicQualification" text,
    gender text,
    "bloodType" text,
    "idCardNumber" text,
    "idPlaceOfIssue" text,
    "idIssueDate" timestamp(3) without time zone,
    "passportPlaceOfIssue" text,
    "passportExpiryDate" timestamp(3) without time zone,
    "drivingLicenseType" text,
    "drivingLicenseNumber" text,
    "drivingLicenseExpiry" timestamp(3) without time zone,
    "drivingLicensePlaceOfIssue" text,
    "personalPhone" text,
    "personalEmail" text,
    "emergencyContactNumber" text,
    "residentialAddress" text,
    "workedBefore" text,
    "hasRelativesInCompany" text,
    "relativesNames" text,
    "bankName" text,
    "bankBranchName" text,
    "bankAccountNumber" text,
    "arrivalDate" timestamp(3) without time zone,
    "cvUrl" text,
    "degreeUrl" text,
    "birthCertUrl" text,
    "passportCopyUrl" text,
    "bankCheckUrl" text,
    "photoUrl" text,
    "idCardUrl" text,
    "jobOfferUrl" text,
    "healthCertUrl" text,
    "academicQualificationArabic" text,
    "bankBranchNameArabic" text,
    "bankNameArabic" text,
    "drivingLicensePlaceOfIssueArabic" text,
    "drivingLicenseTypeArabic" text,
    "employeeStartDate" timestamp(3) without time zone,
    "employeeTravelDate" timestamp(3) without time zone,
    "idPlaceOfIssueArabic" text,
    "interviewEvaluationUrl" text,
    "nationalityArabic" text,
    "passportPlaceOfIssueArabic" text,
    "placeOfBirthArabic" text,
    "relativesNamesArabic" text,
    "residencyDocumentUrl" text,
    "residentialAddressArabic" text,
    "serviceProviderCompany" text,
    "ticketUrl" text,
    "bioId" integer,
    "enrollmentStatus" text DEFAULT 'ACTIVE'::text NOT NULL
);


ALTER TABLE public."Employee" OWNER TO postgres;

--
-- Name: EmployeeDocument; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."EmployeeDocument" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    name text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileName" text,
    "uploadedByName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."EmployeeDocument" OWNER TO postgres;

--
-- Name: EvaluationPeriod; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."EvaluationPeriod" (
    id text NOT NULL,
    month text NOT NULL,
    "departmentId" text,
    enabled boolean DEFAULT false NOT NULL,
    "enabledById" text,
    "enabledAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);


ALTER TABLE public."EvaluationPeriod" OWNER TO postgres;

--
-- Name: GMEvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."GMEvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "finalScore" double precision,
    comments text,
    locked boolean DEFAULT false NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "submittedById" text
);


ALTER TABLE public."GMEvaluation" OWNER TO postgres;

--
-- Name: Group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Group" (
    id text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public."Group" OWNER TO postgres;

--
-- Name: HREvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HREvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "absenceUnauthorized" integer DEFAULT 0 NOT NULL,
    "delayMinutes" integer DEFAULT 0 NOT NULL,
    "emergencyLeaves" integer DEFAULT 0 NOT NULL,
    "unpaidLeaves" integer DEFAULT 0 NOT NULL,
    "annualPaidLeaves" integer DEFAULT 0 NOT NULL,
    "absenceScore" double precision,
    "delayScore" double precision,
    "emergencyScore" double precision,
    "unpaidScore" double precision,
    "violationScore" double precision,
    "presenceScore" double precision,
    status text DEFAULT 'draft'::text NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    "submittedById" text
);


ALTER TABLE public."HREvaluation" OWNER TO postgres;

--
-- Name: JobDescription; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."JobDescription" (
    id text NOT NULL,
    title text NOT NULL,
    "isHead" boolean DEFAULT false NOT NULL,
    "plannedCount" integer DEFAULT 1 NOT NULL,
    "directorateId" text,
    "divisionId" text,
    "departmentId" text,
    "unitId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "jobCategories" text[] DEFAULT ARRAY[]::text[],
    description text,
    details jsonb,
    "workLocations" text[] DEFAULT ARRAY[]::text[]
);


ALTER TABLE public."JobDescription" OWNER TO postgres;

--
-- Name: LeaveApprovalStep; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LeaveApprovalStep" (
    id text NOT NULL,
    "leaveRequestId" text NOT NULL,
    sequence integer NOT NULL,
    stage text NOT NULL,
    "approverUserId" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    note text,
    "decidedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LeaveApprovalStep" OWNER TO postgres;

--
-- Name: LeaveRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LeaveRequest" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "startTime" text,
    "endTime" text,
    reason text,
    "managerNote" text,
    "hrNote" text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deptApprovedById" text,
    "directorApprovedById" text,
    "unitApprovedById" text,
    "attachmentUrl" text,
    "attachmentName" text,
    "divisionApprovedById" text
);


ALTER TABLE public."LeaveRequest" OWNER TO postgres;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    link text,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO postgres;

--
-- Name: PayrollResult; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PayrollResult" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "totalHours" double precision DEFAULT 0 NOT NULL,
    overtime double precision DEFAULT 0 NOT NULL,
    absences integer DEFAULT 0 NOT NULL,
    "hrPresenceScore" double precision,
    "hrAbsenceDays" integer DEFAULT 0 NOT NULL,
    "hrDelayMinutes" integer DEFAULT 0 NOT NULL,
    "adminScore" double precision,
    "executiveScore" double precision,
    "careScore" double precision,
    "deptPerformance" double precision,
    "deptDiscipline" double precision,
    "departmentScore" double precision,
    "directorLeadership" double precision,
    "directorImpact" double precision,
    "directorScore" double precision,
    "personnelScore" double precision,
    "personnelDeductionDays" double precision,
    "personnelBonusDays" double precision,
    "trainingSummary" text,
    "finalScore" double precision NOT NULL,
    "finalSalary" double precision NOT NULL,
    "csvGenerated" boolean DEFAULT false NOT NULL,
    "generatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    appearance double precision,
    "commSkills" double precision,
    "contDev" double precision,
    "dataPrivacy" double precision,
    "hrAnnualPaidLeaves" integer DEFAULT 0 NOT NULL,
    "hrEmergencyDays" integer DEFAULT 0 NOT NULL,
    "hrUnpaidLeaves" integer DEFAULT 0 NOT NULL,
    "orgCompliance" double precision,
    "pressureHandling" double precision,
    "probSolving" double precision,
    "regAdherence" double precision,
    "regCompliance" double precision,
    "relColleagues" double precision,
    "resPreservation" double precision,
    "safetyAdherence" double precision,
    "taskQuality" double precision,
    teamwork double precision,
    "timeCommit" double precision,
    "workOrg" double precision,
    "chairmanScore" double precision,
    "divisionScore" double precision,
    "gmScore" double precision
);


ALTER TABLE public."PayrollResult" OWNER TO postgres;

--
-- Name: PersonnelEvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PersonnelEvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "warningMessages" integer DEFAULT 0 NOT NULL,
    "disciplinaryDeduction" integer DEFAULT 0 NOT NULL,
    "appreciationMessages" integer DEFAULT 0 NOT NULL,
    "exceptionalAssignments" integer DEFAULT 0 NOT NULL,
    "specializedTraining" boolean DEFAULT false NOT NULL,
    "supportingTraining" boolean DEFAULT false NOT NULL,
    "languageTraining" boolean DEFAULT false NOT NULL,
    "softwareTraining" boolean DEFAULT false NOT NULL,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedById" text
);


ALTER TABLE public."PersonnelEvaluation" OWNER TO postgres;

--
-- Name: RecruitmentRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RecruitmentRequest" (
    id text NOT NULL,
    "requesterId" text NOT NULL,
    "unitId" text,
    "departmentId" text,
    "jobTitle" text NOT NULL,
    reason text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "hrNote" text,
    "gmNote" text,
    "hrApprovedById" text,
    "gmApprovedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deptApprovedById" text,
    "deptNote" text,
    "divisionId" text,
    "jdPayload" jsonb,
    "jobDescriptionId" text,
    type text DEFAULT 'HIRE'::text NOT NULL,
    filled boolean DEFAULT false NOT NULL,
    "filledAt" timestamp(3) without time zone,
    quantity integer DEFAULT 1 NOT NULL,
    "deptApprovedAt" timestamp(3) without time zone,
    "hrApprovedAt" timestamp(3) without time zone,
    "gmApprovedAt" timestamp(3) without time zone,
    "publishedToCareers" boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "employmentType" text,
    "typeOfRequest" text,
    "languageEn" text,
    "languageAr" text,
    "prfApprovals" jsonb,
    "reportsTo" text
);


ALTER TABLE public."RecruitmentRequest" OWNER TO postgres;

--
-- Name: SalaryStructure; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SalaryStructure" (
    id text NOT NULL,
    "jobCategory" text NOT NULL,
    "jobGrade" text NOT NULL,
    "structureLevel" text NOT NULL,
    "hourlyRate" double precision NOT NULL,
    "monthlyRate" double precision NOT NULL
);


ALTER TABLE public."SalaryStructure" OWNER TO postgres;

--
-- Name: StaffTask; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."StaffTask" (
    id text NOT NULL,
    "authorId" text,
    "assigneeId" text,
    "departmentId" text,
    title text NOT NULL,
    content text,
    deadline timestamp(3) without time zone,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    category text DEFAULT 'ASSIGNED'::text NOT NULL,
    "isReviewed" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."StaffTask" OWNER TO postgres;

--
-- Name: SupportTicket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SupportTicket" (
    id text NOT NULL,
    "requesterId" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    resolution text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assigneeId" text,
    "estimatedReadyAt" timestamp(3) without time zone
);


ALTER TABLE public."SupportTicket" OWNER TO postgres;

--
-- Name: TimeRecord; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TimeRecord" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "assignedHours" double precision DEFAULT 0 NOT NULL,
    "workedHours" double precision DEFAULT 0 NOT NULL,
    "overtimeHours" double precision DEFAULT 0 NOT NULL,
    absences integer DEFAULT 0 NOT NULL,
    "lateMinutes" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TimeRecord" OWNER TO postgres;

--
-- Name: Unit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Unit" (
    id text NOT NULL,
    name text NOT NULL,
    "departmentId" text NOT NULL,
    headcount integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."Unit" OWNER TO postgres;

--
-- Name: UnitEvaluation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UnitEvaluation" (
    id text NOT NULL,
    "employeeId" text NOT NULL,
    month text NOT NULL,
    "relColleagues" double precision,
    teamwork double precision,
    "workOrg" double precision,
    "commSkills" double precision,
    "regCompliance" double precision,
    "taskQuality" double precision,
    "timeCommit" double precision,
    "orgCompliance" double precision,
    "probSolving" double precision,
    "pressureHandling" double precision,
    "contDev" double precision,
    "regAdherence" double precision,
    "safetyAdherence" double precision,
    appearance double precision,
    "resPreservation" double precision,
    "dataPrivacy" double precision,
    "totalScore" double precision,
    comments text,
    "submittedAt" timestamp(3) without time zone,
    "submittedById" text
);


ALTER TABLE public."UnitEvaluation" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "fullName" text,
    role text NOT NULL,
    "departmentId" text,
    "groupId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "departmentIds" text[] DEFAULT ARRAY[]::text[],
    "unitId" text,
    permissions text[] DEFAULT ARRAY[]::text[],
    signature text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: Announcement; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Announcement" (id, "authorId", "targetType", "targetId", title, content, "expiryDate", "createdAt", "attachmentName", "attachmentUrl") FROM stdin;
a6dcd101-6c65-42a6-bf86-8a9d91713e43	fe156c64-c6d6-4bdf-8c8d-105530165a0d	GLOBAL	\N	hhhh	hhh	2027-11-12 00:00:00	2026-07-12 19:42:59.977	Position Factor List  (2).xlsx	/uploads/announcements/1783885379969-619025222.xlsx
\.


--
-- Data for Name: AssetRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AssetRequest" (id, "employeeId", "requesterId", "itemType", status, priority, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Candidate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Candidate" (id, "requisitionId", "fullName", phone, email, "cvPath", stage, "screenDecision", "screenNote", "screenById", "screenAt", "interviewAt", "interviewLocation", "interviewNote", "hrScore", "hrRecommend", "hrNote", "hrEvalById", "hrEvalAt", "techScore", "techRecommend", "techNote", "techEvalById", "techEvalAt", "finalDecision", "finalNote", "offerDecision", "offerNote", "offerAt", "employeeId", "createdById", "createdAt", "updatedAt", source, "degreePath", "portfolioPath", speciality, "yearsExperience", "salaryExpectation", nationality, "dateOfBirth", "placeOfLiving", "salaryStructure", "jobGrade", "placeOfWork", "contractMonths", "hrCriteria", "techCriteria", "residentStatus", "offerGeneratedAt", "appliedViaCareers", "educationLevel", "onboardingToken", "onboardingStatus", "onboardingData", "onboardingSubmittedAt", "jobCategory", events) FROM stdin;
21d9fff9-f4c2-43de-b86c-2de5e0cdf992	c8580126-4426-4699-91a3-ebc32cc2b4f1	Muetaz layyas	+218928175897	motaz.layas999@gmail.com	/uploads/careers/1786309944035-386997471.docx	HIRED	ACCEPTED	\N	fe156c64-c6d6-4bdf-8c8d-105530165a0d	2026-08-09 21:12:29.913	2026-08-09 21:12:00	\N	\N	3	t	\N	fe156c64-c6d6-4bdf-8c8d-105530165a0d	2026-08-09 21:12:37.05	5	t	\N	fe156c64-c6d6-4bdf-8c8d-105530165a0d	2026-08-09 21:12:55.14	ACCEPTED	\N	ACCEPTED	\N	2026-08-09 21:13:18.234	d9651aa6-b890-4dfc-8fa3-4a6eff46da21	\N	2026-08-09 21:12:24.052	2026-08-09 21:16:41.368	Service Provider - Pure Pharma	\N	\N	reg	5 - 9 Years	435	Bosnian	2026-08-09 00:00:00	teh	SS-01-LYD	Intern	SITE	6	{"motivation": 3, "culturalFit": 3, "communication": 3, "professionalism": 3, "englishProficiency": 3}	{"problemSolving": 5, "relevantExperience": 3, "technicalKnowledge": 5, "softwareProficiency": 5, "learningAdaptability": 5}	RESDANT	2026-08-09 21:13:15.232	t	Primary School	cd01be1a526b37c0cf8dd7e4066db6655e371272c0104605	ENROLLED	{"gender": "Male", "bankName": "test", "fullName": "Muetaz layyas", "bloodType": "A+", "nationalId": "test", "dateOfBirth": "2026-08-09", "idIssueDate": "2026-08-09", "nationality": "Bosnian", "idCardNumber": "test", "placeOfBirth": "test", "workedBefore": "Yes", "personalEmail": "motaz.layas999@gmail.com", "personalPhone": "+218928175897", "bankBranchName": "test", "bankNameArabic": "test", "fullNameArabic": "Muetaz layyas", "idPlaceOfIssue": "test", "passportNumber": "test", "relativesNames": "test", "bankAccountNumber": "test", "employeeStartDate": "2026-08-09", "nationalityArabic": "test", "drivingLicenseType": "test", "passportExpiryDate": "2026-08-09", "placeOfBirthArabic": "test", "residentialAddress": "benghazi", "bankBranchNameArabic": "test", "drivingLicenseExpiry": "2026-08-09", "drivingLicenseNumber": "test", "idPlaceOfIssueArabic": "test", "passportPlaceOfIssue": "test", "relativesNamesArabic": "test", "academicQualification": "Primary School - reg", "hasRelativesInCompany": "Yes", "emergencyContactNumber": "0928175897", "drivingLicenseTypeArabic": "test", "residentialAddressArabic": "test", "drivingLicensePlaceOfIssue": "test", "passportPlaceOfIssueArabic": "test", "academicQualificationArabic": "test", "drivingLicensePlaceOfIssueArabic": "test"}	2026-08-09 21:14:59.253	Engineer	[{"note": "Decision: ACCEPTED", "action": "SCREENED", "timestamp": "2026-08-09T21:12:29.913Z", "performedBy": "System Admin"}, {"action": "INTERVIEW_SCHEDULED", "timestamp": "2026-08-09T21:12:35.065Z", "performedBy": "System Admin"}, {"note": "Recommend: true", "action": "HR_EVALUATED", "timestamp": "2026-08-09T21:12:37.050Z", "performedBy": "System Admin"}, {"note": "Recommend: true", "action": "TECH_EVALUATED", "timestamp": "2026-08-09T21:12:55.140Z", "performedBy": "System Admin"}, {"note": "Decision: ACCEPTED", "action": "FINAL_DECISION", "timestamp": "2026-08-09T21:13:01.009Z", "performedBy": "System Admin"}, {"note": "Edited offer parameters", "action": "EDIT_OFFER_DETAILS", "timestamp": "2026-08-09T21:13:12.658Z", "performedBy": "System Admin"}, {"action": "OFFER_GENERATED", "timestamp": "2026-08-09T21:13:15.232Z", "performedBy": "System Admin"}, {"note": "Decision: ACCEPTED", "action": "OFFER_RESPONSE", "timestamp": "2026-08-09T21:13:18.234Z", "performedBy": "System Admin"}, {"action": "HIRED", "timestamp": "2026-08-09T21:16:41.366Z", "performedBy": "System Admin"}]
94934d24-5eb7-4b70-939e-5042b7a3a7cc	a963fe3a-3552-441a-bf28-8f9eb0ae4fba	Muetaz layyas	+218928175897	motaz.layas999@gmail.com	/uploads/careers/1786558852711-959287649.pdf	HIRED	ACCEPTED	\N	fe156c64-c6d6-4bdf-8c8d-105530165a0d	2026-08-12 18:21:00.33	2026-08-12 18:21:00	\N	\N	3	t	\N	fe156c64-c6d6-4bdf-8c8d-105530165a0d	2026-08-12 18:21:12.468	3	t	\N	fe156c64-c6d6-4bdf-8c8d-105530165a0d	2026-08-12 18:21:14.125	ACCEPTED	\N	ACCEPTED	\N	2026-08-12 18:21:33.033	b75a64f3-ebae-4863-a523-5dea76ae026c	\N	2026-08-12 18:20:52.727	2026-08-12 18:24:17.138	Service Provider - Montenegro Warmth	\N	\N	reg	0 - 6 Months	435	Bosnian	2026-08-12 00:00:00	erg	SS-02-USD	Intern	OFFICE	6	{"motivation": 3, "culturalFit": 3, "communication": 3, "professionalism": 3, "englishProficiency": 3}	{"problemSolving": 3, "relevantExperience": 3, "technicalKnowledge": 3, "softwareProficiency": 3, "learningAdaptability": 3}	NONE RESDANT	\N	t	Master's Degree	d685e5d9a97a71b85aaf82e04abf6588ff77ad2642e591bd	ENROLLED	{"fullName": "Muetaz layyas", "bloodType": "O+", "dateOfBirth": "2026-08-12", "nationality": "Bosnian", "placeOfBirth": "test", "workedBefore": "Yes", "personalEmail": "motaz.layas999@gmail.com", "personalPhone": "+218928175897", "passportNumber": "Muetaz layyas", "employeeStartDate": "2026-08-12", "employeeTravelDate": "2026-08-12", "passportExpiryDate": "2026-08-13", "residentialAddress": "benghazi", "academicQualification": "Master's Degree - reg", "emergencyContactNumber": null, "serviceProviderCompany": "rtyjh"}	2026-08-12 18:22:14.105	Engineer	[{"note": "Decision: ACCEPTED", "action": "SCREENED", "timestamp": "2026-08-12T18:21:00.330Z", "performedBy": "System Admin"}, {"action": "INTERVIEW_SCHEDULED", "timestamp": "2026-08-12T18:21:10.609Z", "performedBy": "System Admin"}, {"note": "Recommend: true", "action": "HR_EVALUATED", "timestamp": "2026-08-12T18:21:12.468Z", "performedBy": "System Admin"}, {"note": "Recommend: true", "action": "TECH_EVALUATED", "timestamp": "2026-08-12T18:21:14.125Z", "performedBy": "System Admin"}, {"note": "Decision: ACCEPTED", "action": "FINAL_DECISION", "timestamp": "2026-08-12T18:21:16.161Z", "performedBy": "System Admin"}, {"note": "Edited offer parameters", "action": "EDIT_OFFER_DETAILS", "timestamp": "2026-08-12T18:21:30.423Z", "performedBy": "System Admin"}, {"note": "Decision: ACCEPTED", "action": "OFFER_RESPONSE", "timestamp": "2026-08-12T18:21:33.033Z", "performedBy": "System Admin"}, {"action": "HIRED", "timestamp": "2026-08-12T18:24:17.137Z", "performedBy": "System Admin"}]
\.


--
-- Data for Name: ChairmanEvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ChairmanEvaluation" (id, "employeeId", month, "finalScore", comments, locked, "lockedAt", "submittedById") FROM stdin;
\.


--
-- Data for Name: Contract; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Contract" (id, "employeeId", "contractNumber", "startDate", "endDate", type, status, salary, notes, "documentUrl", "createdAt", "updatedAt", "emergencyHolidaysUsed", "holidaysUsed", "jobCategory", "jobGrade", "position", "unpaidHolidaysUsed") FROM stdin;
\.


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Department" (id, name, "groupId", "divisionId", "isOffice", "positionFactor") FROM stdin;
2cd246ca-f3a8-4641-9817-54d67cd25df0	Facility & Logistic Services Department	default-group-id	cf99cba0-8e6e-4e56-a47d-2169ca6a853a	f	1.25
db8fda70-9e72-485d-b0dd-95afd5753e61	Treasury & Cash Management Department	default-group-id	ea1ddc99-77c7-4682-a93f-b91585f4ee6f	f	1.4
293b57c8-1168-4c79-979c-b1cd6e81949e	Recrutiment Department	default-group-id	a08a2b84-9d2c-40ea-acb7-31941741025c	f	1.4
e2fed8e8-eebf-4ddf-adfc-ae5f6fe45a35	Asset Control Department	default-group-id	ea1ddc99-77c7-4682-a93f-b91585f4ee6f	f	1.4
cb3076ba-2444-4a4b-aa4c-531791cac3e8	Digital Transformation Department	default-group-id	240f7e0e-c5a1-4635-bd96-3d4098d9a502	f	1.4
ae4f1567-1325-4c24-92b4-170c0b8d05c1	Enterprise Planning Department	default-group-id	240f7e0e-c5a1-4635-bd96-3d4098d9a502	f	1.4
d370160a-b5e8-4bff-843a-439b7aaa6eb4	Process Analysis & Optimization Department	default-group-id	240f7e0e-c5a1-4635-bd96-3d4098d9a502	f	1.4
59ce7f55-bfa6-4e8c-88cb-f9f108df3300	Internal Audit Office	default-group-id	\N	t	1.45
1d24df7e-5298-404a-a079-e03eecef10dc	Quality Office	default-group-id	\N	t	1.45
96b4c640-6663-4b09-82b0-713856c33edb	Preparation & Review Department	default-group-id	ea1ddc99-77c7-4682-a93f-b91585f4ee6f	f	1.4
c5e3c01a-1548-4b81-9459-2a9b857d7927	Document Control Department	default-group-id	cf99cba0-8e6e-4e56-a47d-2169ca6a853a	f	1.3
4bfa3d9b-ff8d-47d0-9e78-0e9eebbfb25e	Asset Management Department	default-group-id	cf99cba0-8e6e-4e56-a47d-2169ca6a853a	f	1.4
c2d2ae2f-c819-4e60-ac37-467637f7ec70	IT Support Services Department	default-group-id	cf99cba0-8e6e-4e56-a47d-2169ca6a853a	f	1.3
6c78304b-3955-493d-8d13-b06b4dbd93ba	Procurement and Warehousing Department	default-group-id	cf99cba0-8e6e-4e56-a47d-2169ca6a853a	f	1.4
6f2fa4e9-36bf-4669-a7b3-838a61148aac	Corporate Compliance Department	default-group-id	ada872b3-f41e-4b91-8688-3700ca06fc76	f	1.4
0561233d-765b-474b-a8da-9866961b3bac	Special Reviews & Investigations Department	default-group-id	ada872b3-f41e-4b91-8688-3700ca06fc76	f	1.4
24e8f2e8-8073-4855-bae1-7458c7ea52c4	Financial Reporting & Ananlysis Department	default-group-id	ea1ddc99-77c7-4682-a93f-b91585f4ee6f	f	1.4
bd592868-486d-429e-883a-60c1b3343888	Network & Cybersecurity Department	default-group-id	83d55b52-12a1-4d3b-9246-ce08a3fe7c20	f	1.4
fec2dae5-8486-4151-bcd3-52889738f25d	Personnel Relations Department	default-group-id	a08a2b84-9d2c-40ea-acb7-31941741025c	f	1.3
d3931c0d-c988-4eda-9d54-30558d69f5b2	Business Projects Complience Department	default-group-id	ada872b3-f41e-4b91-8688-3700ca06fc76	f	1.4
24f3a947-38e1-43df-a29d-7c9cae198ee9	Policies & SOP Standards Department	default-group-id	240f7e0e-c5a1-4635-bd96-3d4098d9a502	f	1.4
dea27c9f-6701-4a80-afd3-22e5e9231bcd	Investment Office	default-group-id	\N	t	1.6
4837bdb3-722b-4878-a612-a36f3ad21ea0	Legal Affairs Office	default-group-id	\N	t	1.55
3a171957-7912-4215-bb1e-df6131e2c544	General Management Office	default-group-id	\N	t	1.25
0a00823f-f675-427d-baf3-705a622580de	Public Relations Office	default-group-id	\N	t	1.45
818c3460-0ff8-46c0-a8d9-d71c0bc99b8f	Payroll & Compensations Department	default-group-id	a08a2b84-9d2c-40ea-acb7-31941741025c	f	1.3
b7cc129d-ba41-4cc2-a734-d09879009598	HR Corporate Compliance Department	default-group-id	a08a2b84-9d2c-40ea-acb7-31941741025c	f	1.4
c156e319-a1c1-4d0f-b709-7b49f925b736	Accounting & Recordkeeping Department	default-group-id	ea1ddc99-77c7-4682-a93f-b91585f4ee6f	f	1.4
\.


--
-- Data for Name: DepartmentEvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DepartmentEvaluation" (id, "employeeId", month, "relColleagues", teamwork, "workOrg", "commSkills", "regCompliance", "taskQuality", "timeCommit", "orgCompliance", "probSolving", "pressureHandling", "contDev", "regAdherence", "safetyAdherence", appearance, "resPreservation", "dataPrivacy", "totalScore", comments, "submittedAt", "submittedById") FROM stdin;
\.


--
-- Data for Name: DirectorEvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DirectorEvaluation" (id, "employeeId", month, "finalScore", locked, "lockedAt", "submittedById", appearance, "commSkills", "contDev", "dataPrivacy", "orgCompliance", "pressureHandling", "probSolving", "regAdherence", "regCompliance", "relColleagues", "resPreservation", "safetyAdherence", "taskQuality", teamwork, "timeCommit", "workOrg") FROM stdin;
\.


--
-- Data for Name: Directorate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Directorate" (id, name, "createdAt", "updatedAt", "positionFactor") FROM stdin;
1032142f-abdb-4596-a9ce-5b971da067a7	Administrative Director	2026-06-21 21:12:30.423	2026-06-21 21:12:30.423	1
e14e49f8-f2b1-45a0-8603-464f8f9a7e55	Chief Executive Officer	2026-06-21 21:13:05.547	2026-06-21 21:13:05.547	1
\.


--
-- Data for Name: Division; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Division" (id, name, "directorateId", "positionFactor") FROM stdin;
240f7e0e-c5a1-4635-bd96-3d4098d9a502	Enterprise Development Division	1032142f-abdb-4596-a9ce-5b971da067a7	1.5
83d55b52-12a1-4d3b-9246-ce08a3fe7c20	Operations Support Division	e14e49f8-f2b1-45a0-8603-464f8f9a7e55	1.5
a08a2b84-9d2c-40ea-acb7-31941741025c	Human Resources Division	1032142f-abdb-4596-a9ce-5b971da067a7	1.5
cf99cba0-8e6e-4e56-a47d-2169ca6a853a	Administrative Affairs Division	1032142f-abdb-4596-a9ce-5b971da067a7	1.5
ea1ddc99-77c7-4682-a93f-b91585f4ee6f	Financial Affairs Division	1032142f-abdb-4596-a9ce-5b971da067a7	1.5
ada872b3-f41e-4b91-8688-3700ca06fc76	Compliance & Monitoring Division	e14e49f8-f2b1-45a0-8603-464f8f9a7e55	1.5
80db4e7f-e527-4650-ac69-89cc2b272880	test	1032142f-abdb-4596-a9ce-5b971da067a7	1.7
\.


--
-- Data for Name: DivisionEvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DivisionEvaluation" (id, "employeeId", month, "relColleagues", teamwork, "workOrg", "commSkills", "regCompliance", "taskQuality", "timeCommit", "orgCompliance", "probSolving", "pressureHandling", "contDev", "regAdherence", "safetyAdherence", appearance, "resPreservation", "dataPrivacy", "totalScore", comments, "submittedAt", "submittedById") FROM stdin;
\.


--
-- Data for Name: Employee; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Employee" (id, "fullName", email, role, "departmentId", "groupId", "baseSalary", "joinDate", "staffId", "contractEndDate", "contractStartDate", "contractStatus", "contractType", "holidaysUsed", "bonusHolidays", "userId", "unitId", "position", "contractNumber", "emergencyHolidaysUsed", "fullNameArabic", "jobCategory", "jobGrade", nationality, "passportNumber", "unpaidHolidaysUsed", "accruedHolidays", "bonusEmergencyHolidays", "earnedHolidays", "remainingHolidays", "positionFactor", "roleCategory", "siteFactor", "skillFactor", "languageFactor", "divisionId", "directorateId", "evaluationPoints", "promotionNotified", "salaryStructureType", "jobDescriptionId", "placeOfWork", "dateOfBirth", "placeOfBirth", "nationalId", "academicQualification", gender, "bloodType", "idCardNumber", "idPlaceOfIssue", "idIssueDate", "passportPlaceOfIssue", "passportExpiryDate", "drivingLicenseType", "drivingLicenseNumber", "drivingLicenseExpiry", "drivingLicensePlaceOfIssue", "personalPhone", "personalEmail", "emergencyContactNumber", "residentialAddress", "workedBefore", "hasRelativesInCompany", "relativesNames", "bankName", "bankBranchName", "bankAccountNumber", "arrivalDate", "cvUrl", "degreeUrl", "birthCertUrl", "passportCopyUrl", "bankCheckUrl", "photoUrl", "idCardUrl", "jobOfferUrl", "healthCertUrl", "academicQualificationArabic", "bankBranchNameArabic", "bankNameArabic", "drivingLicensePlaceOfIssueArabic", "drivingLicenseTypeArabic", "employeeStartDate", "employeeTravelDate", "idPlaceOfIssueArabic", "interviewEvaluationUrl", "nationalityArabic", "passportPlaceOfIssueArabic", "placeOfBirthArabic", "relativesNamesArabic", "residencyDocumentUrl", "residentialAddressArabic", "serviceProviderCompany", "ticketUrl", "bioId", "enrollmentStatus") FROM stdin;
ee76e751-fc97-40d7-86cf-977639ffb0b4	MUETAZS MOHAMMED LAYYAS	m.layyas@iph.com	HEAD_DEPARTMENT	cb3076ba-2444-4a4b-aa4c-531791cac3e8	default-group-id	4368	2026-08-12 00:00:00	IPH-0125-036	2026-08-07 00:00:00	2026-02-07 00:00:00	Pending	\N	0	0	0368c34f-66e7-4fff-9fbb-ea892785c792	\N	Resident	1st	0	معتز محمد لياس	Engineer	Junior	123123	HH51NF6Y	0	0	0	0	0	1.4	Support	1	1	1	240f7e0e-c5a1-4635-bd96-3d4098d9a502	1032142f-abdb-4596-a9ce-5b971da067a7	5.6	f	SS-01-LYD	a771b019-cc67-46ae-a438-603a16e4ea5a	OFFICE	1999-08-02 00:00:00	BENGHAZI	BENGHAZI	SO GOOD	Male	A+	123456789	123456789	2026-08-12 00:00:00	1232456789	2026-08-12 00:00:00	123456789	123456789	2026-08-12 00:00:00	123456789	+218928175897	motaz.layas999@gmail.com	+218928175897	benghazi	No	No	\N	121346	123456	123456	2026-08-12 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	SO GOOD	123456	123456	123456789	123456789	2026-08-12 00:00:00	2026-08-12 00:00:00	123456789	\N	123123	123456789	BENGHAZI	\N	\N	houri	123456	\N	20	ACTIVE
afe21b7b-7950-444d-98c2-e74db6e873e3	Hazem Adam Hussein	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.11	IPH-0125-001	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	PENDING_ENROLLMENT
44459a02-33e9-4763-887b-b67249efe5f8	test-case	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.088	1001	\N	\N	Pending	\N	0	0	\N	\N	Higher-Management	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	75	PENDING_ENROLLMENT
e41eae65-bb37-459f-9343-6322647a587f	admin	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.102	200	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	PENDING_ENROLLMENT
e618578d-3f84-4ae2-87a4-7cb587901195	ali	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.106	2002	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	112	PENDING_ENROLLMENT
71394524-e3aa-4121-8bc5-71191f957fb5	Ahmed Saad Saleh Al-Taei	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.113	IPH-0125-002	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	PENDING_ENROLLMENT
71ce6e43-8216-4d40-9c97-900f4aa025b6	Abdul Rahman Al-Nakhat	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.117	IPH-0125-003	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	PENDING_ENROLLMENT
16177ebb-f35d-45ec-a6d8-e4e7592c3940	Samah Khalil Abdullah	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.121	IPH-0125-004	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	PENDING_ENROLLMENT
fc02ec68-3118-4eaa-b021-84a177306a03	Yarob Mustafa Omran Bens	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.124	IPH-0125-008	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	PENDING_ENROLLMENT
4b8c3eb0-f840-498d-9741-531ad1ffcee0	Abdulhadi Mahmoud Jalloul Al-Majbari	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.126	IPH-0125-009	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	57	PENDING_ENROLLMENT
e5b1c35f-6733-42ea-a3fb-0b5df2f6257c	Ahmed Al-Siddiq Al-Bashi	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.129	IPH-0125-013	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	55	PENDING_ENROLLMENT
ba46ff3a-77d6-4f9a-9876-16ef590e16de	Walid Hamouda Faraj Amba	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.132	IPH-0125-014	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	PENDING_ENROLLMENT
5a0b1c00-f25c-42d1-943f-98a6aaa18eb2	Mohammad Gouda Muqallad	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.135	IPH-0125-020	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	51	PENDING_ENROLLMENT
e498e145-f627-43d0-9e1f-66b9e0221a66	Mohammad Mohammad Mohamm	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.138	IPH-0125-021	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	56	PENDING_ENROLLMENT
1f3cd8c0-b411-4378-8c42-58e3c21dfa04	Mohammad Salem Mohammad	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.141	IPH-0125-022	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	PENDING_ENROLLMENT
a01e6b9b-16e2-4ebf-93af-4287bb1a37b8	Muftah Salem Salem Alshi	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.143	IPH-0125-024	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	52	PENDING_ENROLLMENT
670c15ef-5f22-4f04-b27b-df14ffa0ed1d	Nasser Muftah Mohammad S	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.147	IPH-0125-026	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	53	PENDING_ENROLLMENT
e9074e2d-450b-4774-aca1-8d245dd23634	Ramzi Ramadan Abdul Sala	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.15	IPH-0125-028	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	23	PENDING_ENROLLMENT
c3427e2c-6b7e-46e8-b94f-a248726c4d05	Ahmed Abd-alsalam Aqila	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.152	IPH-0125-033	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	PENDING_ENROLLMENT
774e8746-25df-402a-a58c-bf6f02401e6e	Ahmed Khalifa Saleh Abdu	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.154	IPH-0125-034	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	54	PENDING_ENROLLMENT
467942ff-4899-44b7-bed2-e4545c3b130a	Ahmed Salem Mohamed Yous	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.156	IPH-0125-035	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	PENDING_ENROLLMENT
14e788c1-fbcc-4917-bb57-6c1cb5b39d9d	Muhammed Almahdi Alshari	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.16	IPH-0125-037	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	PENDING_ENROLLMENT
5984b17c-a05e-4769-82b2-fc05dbb355bd	Abdelnaser O Rashwan	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.162	IPH-0125-039	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	PENDING_ENROLLMENT
8434fe0e-52b6-4de3-98c3-4c5eec686f5f	MOHAMMED FARAG MOHAMMED	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.164	IPH-0125-040	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	27	PENDING_ENROLLMENT
1ba6775c-edb6-4655-b232-891d51aa674b	Abdulrraziq Abdulwanis A	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.165	IPH-0125-044	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	28	PENDING_ENROLLMENT
158e6059-155e-4311-8b22-9ff38cd0a227	Asraa Almahdi	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.167	IPH-0125-046	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	30	PENDING_ENROLLMENT
96a96f3b-bb71-4478-b7e0-140c3d377c85	MOHAMMED ABD ELSALAM ALI SATI	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.169	IPH-0125-047	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	PENDING_ENROLLMENT
3b1a2645-2fc8-4cf5-a877-0af86b9d7440	Amani Nagib Salem Bushaa	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.171	IPH-0125-048	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	PENDING_ENROLLMENT
7443e086-fea2-4c18-83c5-7cc057c57c86	AHMED HASAN MOHAMMED ALW	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.173	IPH-0125-049	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	PENDING_ENROLLMENT
f17bc4cf-1c53-41de-ad97-965d726cf1bf	Yousef Moktar A Bengezy	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.174	IPH-0125-050	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	38	PENDING_ENROLLMENT
3b9b406b-6db9-4bab-a63b-3b9ac95e38bd	ADREES MOHAMMED ALFADHIL	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.176	IPH-0125-051	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	39	PENDING_ENROLLMENT
1ab372ac-6cc9-4a0a-b9cf-68862487fca6	Ahmed mohamed jarbou alm	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.178	IPH-0125-052	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	40	PENDING_ENROLLMENT
b0158abf-a985-4ee0-9e06-b134f991a427	MUETAZ RAMADHAN ABRAHEEM	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.18	IPH-0125-053	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	41	PENDING_ENROLLMENT
df2025f6-dcdb-45f2-996a-8b9549ae0877	Alaeddin Saleh Ali Elnaw	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.181	IPH-0125-054	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	46	PENDING_ENROLLMENT
348b825e-cc3f-40b0-824c-8b17999f873d	Suhail Mustafa kamel Elf	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.183	IPH-0125-055	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	PENDING_ENROLLMENT
4552b883-16f2-486d-ba83-7d2e7c098777	MUETAZ AHMED MOHAMMED	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.185	IPH-0125-056	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	PENDING_ENROLLMENT
cec39b14-a7e9-424d-a04c-79ca310eb39c	Mohammed Adim Abdulaziz Alfakhri	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.187	IPH-0125-058	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	49	PENDING_ENROLLMENT
94378355-cf05-4490-8650-c2c51bfcfa26	Mohammed Marwan Mohammed	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.188	IPH-0125-059	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	44	PENDING_ENROLLMENT
3ff4105a-e7aa-4ba4-a034-6fd8982b8427	Abdulbasit Mohamed Abdulsalam Albadri	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.19	IPH-0125-060	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	45	PENDING_ENROLLMENT
472163fe-ddfc-4d1b-bf75-3dff4855d7da	Osama Mustafa Omer Alkezza	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.192	IPH-0125-061	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	PENDING_ENROLLMENT
d7ad35be-4c74-4a27-abbb-bd068611af61	Ahmed Othman Ghafir	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.193	IPH-0125-062	\N	\N	Pending	\N	0	0	\N	\N	Exception	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	48	PENDING_ENROLLMENT
d58218e1-1099-4749-bf3d-0bb30d16c817	Sara Mohamed Hamed Swien	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.195	IPH-0126-065	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	58	PENDING_ENROLLMENT
9b8d7937-eb01-47de-aa05-a863198004ed	Khalil Faysil Mohammed A	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.197	IPH-0126-066	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	59	PENDING_ENROLLMENT
7f49f520-1a7e-4b27-a76b-68af7295a2d2	HIBAH ALRAHMAN ABDELSALA	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.199	IPH-0126-068	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	60	PENDING_ENROLLMENT
c412a54c-f294-47e9-9026-51a2006aa35d	MOHAMMED MUSTAFA MOHAMME	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.201	IPH-0126-069	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	61	PENDING_ENROLLMENT
084572de-b91e-42d3-ae00-0523f3bcf830	MOHAMMED ALI MOHAMMED AB	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.202	IPH-0126-070	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	62	PENDING_ENROLLMENT
1dbb8b6e-d510-4a37-b47b-e6289159bd66	RASHA ZOUHAIR MOHAMMED K	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.204	IPH-0126-074	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	64	PENDING_ENROLLMENT
393c6608-00e8-43fa-83eb-4da2af0d9794	RAZAN ZOUHAIR MOHAMMED K	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.206	IPH-0126-075	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	65	PENDING_ENROLLMENT
0edf35f5-cbce-4f1a-a8f8-95294ab84a8e	ABDELRAHMAN MOHAMED MOHA	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.208	IPH-0126-076	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	66	PENDING_ENROLLMENT
8d1347c2-4501-4ceb-8dd1-8881857cba38	MOHAMED SALEM MOHAMED EL	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.21	IPH-0126-077	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	68	PENDING_ENROLLMENT
a7265a92-939a-4ffe-b467-d7745af1d297	Mustafa miftah Aldali	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.212	IPH-0126-079	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	90	PENDING_ENROLLMENT
e575b894-5668-491a-963a-121416b3d2c7	ANAS AHMED ALI HUSAYN	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.215	IPH-0126-082	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	77	PENDING_ENROLLMENT
1bb32c5e-272d-41ed-bef1-80208490fc4a	Mohammed Saad Adam Saleh	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.217	IPH-0126-083	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	78	PENDING_ENROLLMENT
39781575-b744-4a5c-8976-4d0576bcfb1c	DALEELAH ABRAHEEM SALIH	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.219	IPH-0126-085	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	79	PENDING_ENROLLMENT
48b6e0b2-01e4-434c-bfa6-e5779cedec44	Naseebah Mousa Nasr Alou	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.221	IPH-0126-086	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	80	PENDING_ENROLLMENT
bb3a63a4-86bf-4c4f-9a80-c275dd44b118	Ali Mare Ali Alariyb	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.223	IPH-0126-087	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	81	PENDING_ENROLLMENT
e818f0e3-c477-46f9-b1a6-bcc2f5c46ec8	Wael Saied Khaleefah	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.225	IPH-0126-088	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	82	PENDING_ENROLLMENT
ac1821d2-afb2-427a-b8bf-d129ec59bec7	Waneesa Mohammed Adam Al	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.226	IPH-0126-089	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	83	PENDING_ENROLLMENT
7c262d3a-bba8-43d3-8966-1e44a9251f40	Moudah Mahmoud Mohammed	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.228	IPH-0126-090	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	84	PENDING_ENROLLMENT
3829799c-dd24-4b87-b367-c4baa9b1591e	Sarah Khalid Mohammed Al	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.23	IPH-0126-091	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	85	PENDING_ENROLLMENT
908e472f-c91e-4dd8-a78b-4f4dfec8e7c9	YASMEN FARAJ MOHAMED ABE	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.232	IPH-0126-092	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	86	PENDING_ENROLLMENT
aaba84b5-91f3-4220-ade2-3d8b3c7da711	Muad Ali Khalifa Alsheeb	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.234	IPH-0126-093	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	87	PENDING_ENROLLMENT
b1bb8ebb-b4f7-46dd-9be4-256d4dc004ad	MARAM SALEEM MOHAMED ALF	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.235	IPH-0126-094	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	88	PENDING_ENROLLMENT
1c6da740-b66c-4a64-a7fc-eef34902967a	MUSAB MOHAMMED SAED	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.237	IPH-0126-097	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	92	PENDING_ENROLLMENT
85eed0c1-d6a8-474b-abdc-e4077a029f10	ABDULHAMID ABDULBASET A YOUNES	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.239	IPH-0126-098	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	93	PENDING_ENROLLMENT
fc99627a-184e-4a1b-9a0b-53227bf9f103	NASIR BALEID HUSSEIN ELOGALY	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.241	IPH-0126-099	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	96	PENDING_ENROLLMENT
19855f2f-4aed-4b0a-a59b-625394eaa526	KHAWLAH ABRAHEEM FARAJ ISWEESI	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.242	IPH-0126-100	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	97	PENDING_ENROLLMENT
0e72ccca-5102-400b-bdf2-7387db8a0e08	Ayah Mohamed Masoud	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.244	IPH-0126-101	\N	\N	Pending	\N	0	0	\N	\N	Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	98	PENDING_ENROLLMENT
23eae357-ca89-4095-8aca-a4d1d1d6439d	Roubeen Albaejah	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.246	IPH-0126-108	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	106	PENDING_ENROLLMENT
a1129260-5f43-46ce-b874-08b7f95faf13	Farag Musadak Al Salhin	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.248	IPH-0126-109	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	107	PENDING_ENROLLMENT
5ccca095-149d-4e48-9793-65e2bbbcf479	Rafaa Ali Rafaa Elawami	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.25	IPH-0126-113	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	110	PENDING_ENROLLMENT
f2d35c02-41a8-4030-83ea-f8717953e420	Valerija Stanisic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.252	IPH-0225-001	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	PENDING_ENROLLMENT
fcccde3f-be19-441a-9187-c2759fd251e8	Zoran Pesut	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.253	IPH-0325-001	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	PENDING_ENROLLMENT
f1307dc6-f300-4089-9efc-ed75041c869b	Cheri Ann Nufiro Aglibat	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.255	IPH-0325-002	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	PENDING_ENROLLMENT
283065eb-b5e9-4ba1-8738-3c0cad67952a	Daryl Jun Gabriel	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.257	IPH-0325-004	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	24	PENDING_ENROLLMENT
c4a98db5-6f8e-4132-9995-30a3422df9b0	Dorde Vuksanovic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.259	IPH-0325-005	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	PENDING_ENROLLMENT
9723714c-f44d-4455-ae7a-1967e74a55c7	Bojan Rakic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.261	IPH-0325-006	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	32	PENDING_ENROLLMENT
6e20680e-9c37-4130-a398-dc432c827ada	Dragan Stoiljkovic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.263	IPH-0325-007	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	PENDING_ENROLLMENT
a1e80269-03c2-4407-925a-f9829d0f180b	Andrija Majsorovic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.265	IPH-0325-008	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	PENDING_ENROLLMENT
2f78fc7c-d651-4155-b17d-ff03371f200c	Milica Prazic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.267	IPH-0326-009	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	50	PENDING_ENROLLMENT
33c0f01f-1d97-4c0f-bc5c-cbb30bd12d82	Dhyren Juanites	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.269	IPH-0326-010	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	69	PENDING_ENROLLMENT
d6a689af-49b6-4950-9ec2-d86d5b71d4ee	Ramadan Berisha	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.27	IPH-0326-011	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	89	PENDING_ENROLLMENT
b317936a-bbdd-4497-9807-22de0df6f73c	Olgica Bulatovic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.272	IPH-0326-012	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	91	PENDING_ENROLLMENT
7ea9ee99-09e5-4358-990c-cf0e69bfd546	Princess Veronica De Guzman	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.274	IPH-0326-013	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	94	PENDING_ENROLLMENT
f6b59b43-dce0-4690-a723-9abc813377b8	Teodora Stankovic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.275	IPH-0326-014	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	95	PENDING_ENROLLMENT
a7dea0a9-44b7-405b-b74b-dc023d351814	Almir Bajraktarevic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.277	IPH-0326-015	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	100	PENDING_ENROLLMENT
5454f84f-eb91-4a7e-833a-444b2b2d02e4	Nikolina Markovic	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.28	IPH-0326-016	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	99	PENDING_ENROLLMENT
2b5bc4b7-0484-4d12-b10e-8925e17d45e5	Soriano Anthony Morta	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.282	IPH-0326-017	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	104	PENDING_ENROLLMENT
b2aef4ed-1aba-4482-94b0-ac029f51079f	Kristine Reyes Canivel	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.283	IPH-0326-018	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	102	PENDING_ENROLLMENT
615cb3f0-84df-4fc5-b8fa-93d9673c8f51	Ksenija Krivokapić	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.286	IPH-0326-019	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	101	PENDING_ENROLLMENT
c1bd0917-939c-432f-80d3-e6d46525fbed	ARTURO A. RODA JR.	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.289	IPH-0326-020	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	103	PENDING_ENROLLMENT
af08359f-e0f4-4f26-9fa7-644343cfe073	Aleksandar Bogavac	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.291	IPH-0326-021	\N	\N	Pending	\N	0	0	\N	\N	\N	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	105	PENDING_ENROLLMENT
47f3500f-f5eb-499c-9faa-ee140eb4c058	mo	\N	EMPLOYEE	\N	\N	0	2026-08-12 19:11:00.293	IPH-226-111	\N	\N	Pending	\N	0	0	\N	\N	Non-Resident	\N	0	\N	\N	\N	\N	\N	0	0	0	0	0	1	Support	1	1	1	\N	\N	0	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	114	PENDING_ENROLLMENT
\.


--
-- Data for Name: EmployeeDocument; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."EmployeeDocument" (id, "employeeId", name, "fileUrl", "fileName", "uploadedByName", "createdAt") FROM stdin;
\.


--
-- Data for Name: EvaluationPeriod; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."EvaluationPeriod" (id, month, "departmentId", enabled, "enabledById", "enabledAt", notes) FROM stdin;
70aaa554-df3a-4711-82bc-f2d9187246df	2026-05	\N	t	fe156c64-c6d6-4bdf-8c8d-105530165a0d	2026-05-17 18:24:46.849	All departments enabled
\.


--
-- Data for Name: GMEvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."GMEvaluation" (id, "employeeId", month, "finalScore", comments, locked, "lockedAt", "submittedById") FROM stdin;
\.


--
-- Data for Name: Group; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Group" (id, name) FROM stdin;
default-group-id	IPH Holding
\.


--
-- Data for Name: HREvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HREvaluation" (id, "employeeId", month, "absenceUnauthorized", "delayMinutes", "emergencyLeaves", "unpaidLeaves", "annualPaidLeaves", "absenceScore", "delayScore", "emergencyScore", "unpaidScore", "violationScore", "presenceScore", status, "submittedAt", "submittedById") FROM stdin;
\.


--
-- Data for Name: JobDescription; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."JobDescription" (id, title, "isHead", "plannedCount", "directorateId", "divisionId", "departmentId", "unitId", "createdAt", "updatedAt", "jobCategories", description, details, "workLocations") FROM stdin;
a771b019-cc67-46ae-a438-603a16e4ea5a	Head of DTD	t	1	\N	\N	cb3076ba-2444-4a4b-aa4c-531791cac3e8	\N	2026-07-18 18:31:52.54	2026-07-18 18:35:07.871	{Engineer,"Operation Officer"}	SOFTWARE	\N	{}
5bd35e2b-8d36-442e-a357-d7835463c8dd	Head of Division EDD	t	1	\N	240f7e0e-c5a1-4635-bd96-3d4098d9a502	\N	\N	2026-07-18 18:46:11.144	2026-07-18 18:46:11.144	{Engineer}	Head of Division EDD	\N	{}
8a03d480-21a2-4367-b85a-fddf96967fea	HEAD OF EPD	t	1	\N	\N	ae4f1567-1325-4c24-92b4-170c0b8d05c1	\N	2026-07-18 18:46:51.768	2026-07-18 18:46:51.768	{Engineer}	HEAD OF EPD	\N	{}
3844df55-4277-4c86-a487-88622d80eeec	HEAD OF Administrative Director	t	1	1032142f-abdb-4596-a9ce-5b971da067a7	\N	\N	\N	2026-07-18 18:48:00.759	2026-07-18 18:48:00.759	{Engineer}	HEAD OF Administrative Director	\N	{}
9dfc8e7f-4424-4411-95af-bb6beaf80a8d	ERP	f	2	\N	\N	cb3076ba-2444-4a4b-aa4c-531791cac3e8	\N	2026-07-26 19:30:15.107	2026-07-26 19:30:15.107	{Engineer,"Administrative Officer"}	ERP	{"kpi": {"ar": "", "en": "ERP"}, "skills": {"ar": "", "en": "ERP"}, "education": {"ar": "", "en": "ERP"}, "experience": {"ar": "", "en": "ERP"}, "jobPurpose": {"ar": "", "en": "ERP"}, "trainingLicenses": {"ar": "", "en": "ERP"}, "workingConditions": {"ar": "", "en": "ERP"}, "keyResponsibilities": {"ar": "", "en": "ERP"}}	{OFFICE}
bec97624-2a7a-45be-8fba-508f044f89b6	head of department 	t	1	\N	\N	293b57c8-1168-4c79-979c-b1cd6e81949e	\N	2026-08-01 20:22:14.688	2026-08-01 20:22:14.688	{"Administrative Officer"}	head of department 	{"kpi": {"ar": "", "en": "head of department "}, "skills": {"ar": "", "en": "head of department "}, "education": {"ar": "", "en": "head of department "}, "experience": {"ar": "", "en": "head of department "}, "jobPurpose": {"ar": "", "en": "head of department "}, "trainingLicenses": {"ar": "", "en": "head of department "}, "workingConditions": {"ar": "", "en": "head of department "}, "keyResponsibilities": {"ar": "", "en": "head of department "}}	{OFFICE}
a0760106-e4b8-433e-94bb-37de575d9a3d	software developer	f	5	\N	\N	cb3076ba-2444-4a4b-aa4c-531791cac3e8	\N	2026-07-18 18:36:12.484	2026-07-18 19:21:05.264	{Engineer,"Administrative Officer","Financial Officer"}	\N	null	{}
26ed1173-7bcf-4ff4-a39a-001836741efc	hi	f	1	\N	\N	cb3076ba-2444-4a4b-aa4c-531791cac3e8	\N	2026-08-10 18:24:31.693	2026-08-10 18:24:31.693	{}	hi	{"kpi": {"ar": "hi", "en": "hi"}, "skills": {"ar": "hi", "en": "hi"}, "education": {"ar": "hi", "en": "hi"}, "experience": {"ar": "vv", "en": "hi"}, "jobPurpose": {"ar": "hi", "en": "hi"}, "trainingLicenses": {"ar": "hi", "en": "gg"}, "workingConditions": {"ar": "hi", "en": "hi"}, "keyResponsibilities": {"ar": "hi", "en": "hi"}}	{}
65c1ed1c-7ea5-4f59-9f78-393754536e4c	we	f	1	\N	\N	cb3076ba-2444-4a4b-aa4c-531791cac3e8	\N	2026-08-10 18:28:55.625	2026-08-10 19:08:49.786	{}	wewe	{"kpi": {"ar": "er", "en": "erer"}, "skills": {"ar": "wer", "en": "we"}, "education": {"ar": "er", "en": "er"}, "reportsTo": "HEAD", "experience": {"ar": "ewr", "en": "we"}, "jobPurpose": {"ar": "er", "en": "we"}, "trainingLicenses": {"ar": "rwqe", "en": "we"}, "workingConditions": {"ar": "twer", "en": "we"}, "keyResponsibilities": {"ar": "er", "en": "er"}}	{OFFICE}
\.


--
-- Data for Name: LeaveApprovalStep; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LeaveApprovalStep" (id, "leaveRequestId", sequence, stage, "approverUserId", status, note, "decidedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: LeaveRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LeaveRequest" (id, "employeeId", "userId", type, "startDate", "endDate", "startTime", "endTime", reason, "managerNote", "hrNote", status, "createdAt", "updatedAt", "deptApprovedById", "directorApprovedById", "unitApprovedById", "attachmentUrl", "attachmentName", "divisionApprovedById") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notification" (id, "userId", title, content, link, "isRead", "createdAt") FROM stdin;
b8bd22ce-b99b-458b-b799-9abe0653c2fd	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP" and is ready to enroll.	/recruitment/onboarding	f	2026-08-06 23:25:33.993
ba8f62a8-88e7-49c0-8b66-87bcf6006130	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP".	/recruitment/onboarding	t	2026-08-06 23:25:33.987
5c7f77d8-795c-4cd5-9900-5bafc5a9c178	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position published to Careers	"ERP" is now live on the public Careers page. Applications will appear in the applicant list.	/recruitment/hiring	f	2026-08-08 18:25:30.043
1dc8d008-deef-4195-8837-48b2bc935628	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-08 18:26:07.51
973cc490-7484-4899-8550-7c087449049c	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "esra" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-01 20:49:19.947
0e1bfc52-8288-4d0c-aa72-5921d9b12eb8	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	t	2026-08-01 19:29:49.4
2affefaa-240f-4fba-b55d-9b8521b6e7c3	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	t	2026-08-01 19:30:02.863
abaa6207-c3b5-40c1-8059-d3733940718d	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "esra" is fully approved.	/recruitment/requests	t	2026-08-01 20:49:22.079
5a357877-1d34-4845-9c92-61f1b2cdf036	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	t	2026-08-01 20:46:12.436
5fa1260e-266c-446a-9d2a-b43c3873a2b3	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	t	2026-08-01 20:47:54.338
52262c48-1f7a-491b-9969-15004ff28ced	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"esra" is approved — you can start sourcing candidates.	/recruitment/hiring	t	2026-08-01 20:48:08.873
2d4802e2-28a0-4d13-b5b0-c4a64425a7aa	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	t	2026-08-01 20:49:19.949
7f60fa17-1a9d-47a7-b13c-fb9eb4cf182b	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"esra" is approved — you can start sourcing candidates.	/recruitment/hiring	t	2026-08-01 20:49:22.08
c012a0d4-2d52-4320-82d0-9c4a619b418d	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	t	2026-08-01 20:51:37.031
fc4b98b3-85e6-4fae-a00a-49b5b2e89680	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"esra" is approved — you can start sourcing candidates.	/recruitment/hiring	t	2026-08-01 20:51:56.538
3f8575ea-17ef-4f49-9391-78dea60a28ba	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-05 19:17:24.935
793848e2-2ecb-49ac-be88-3e79494612ad	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-05 19:17:27.124
b8880176-a89e-4773-b3e6-39d258808b3e	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-06 17:59:56.138
35a856f1-479d-4a0d-ac96-026951a42ae0	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-06 17:59:58.502
ab3fd27c-c91b-46f8-9477-3f2b20b7f28a	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position published to Careers	"ERP" is now live on the public Careers page. Applications will appear in the hiring list.	/recruitment/hiring	f	2026-08-06 17:59:58.505
7b9acaa7-2de7-4df7-9e66-7afae0afaea7	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-06 18:13:48.369
b2d894a7-7eb6-4bc8-87ae-2a9b758dac71	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP".	/recruitment/onboarding	t	2026-08-08 18:38:08.584
5b010a5b-16cc-461e-8322-cdd95f56520f	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-06 18:13:50.803
9666e28a-ce39-4cfa-9599-d99ed6331c54	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position published to Careers	"ERP" is now live on the public Careers page. Applications will appear in the hiring list.	/recruitment/hiring	f	2026-08-06 18:13:50.806
2427bb33-b3fb-4292-85cf-7f37ef167487	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	ertygh applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-06 18:18:28.645
a5a37033-b064-49cd-a988-97252c152466	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-06 18:50:47.347
e609ad0c-d343-47ce-8925-df9351bc4d9f	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	grw applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-06 19:03:39.308
bccac3bd-b550-4e98-bdc7-6fdf4bd0c4aa	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-06 19:16:54.745
a3125714-877e-457c-a993-a64361065e86	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-06 20:40:11.883
2851420d-67ec-4062-981e-b0b4ec1dd3bc	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "ERP" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-05 19:17:24.932
92e3c2f9-8db1-40e7-81a3-5fbea4bdc8e8	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "ERP" is fully approved.	/recruitment/requests	t	2026-08-05 19:17:27.122
62c2128a-870b-40f1-8879-987f1e0636d9	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "ERP" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-06 17:59:56.135
f81c0578-980d-4cb0-901d-138e576f89a2	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "ERP" is fully approved.	/recruitment/requests	t	2026-08-06 17:59:58.497
e2b2ebd7-de9d-4036-90f0-cf61551103b4	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Position published to Careers	"ERP" is now open for public applications on the Careers page.	/recruitment/hiring	t	2026-08-06 17:59:58.507
63163ad3-89c3-4dc1-98aa-2313fc3ff382	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Position closed on Careers	"ERP" is now filled and has been removed from the public Careers page.	/recruitment/requests	t	2026-08-06 18:13:02.985
c74b5309-b431-40dd-a0d0-27d056153699	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "ERP" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-06 18:13:48.366
f73f7532-d13a-4e27-a92c-29696dc8b3d9	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "ERP" is fully approved.	/recruitment/requests	t	2026-08-06 18:13:50.801
13b44b9d-3e30-4d4c-ade3-1834338c3af7	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Position published to Careers	"ERP" is now open for public applications on the Careers page.	/recruitment/hiring	t	2026-08-06 18:13:50.806
b3f6c7e0-21a9-4ebe-8432-d9bcb30ebd04	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	ertygh applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-06 18:18:28.635
62d4d2ff-c733-4f23-80d1-87c853fc0041	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-06 18:50:47.342
ea951e4b-27e9-49f2-8e78-dc8137b39d3d	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	grw applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-06 19:03:39.304
679e42dd-0cfd-41d2-a9a5-42855e0eb303	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-06 19:16:54.74
567df3fa-2364-47be-b829-504e77fc761d	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-06 20:40:11.878
648b1efb-5922-499a-b797-463539b3fe60	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	kahlil applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-06 22:56:40.02
8de6ad3d-dc73-46f1-93db-599697fddccd	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	kahlil applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-06 22:58:01.604
b5f6102a-5e69-463b-b023-541d37b67678	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	kahlil completed their onboarding form for "ERP" and is ready to enroll.	/recruitment/onboarding	f	2026-08-06 23:23:01.156
46db0809-e216-4fe0-8e00-9cb9d5457d06	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP" and is ready to enroll.	/recruitment/onboarding	f	2026-08-06 23:24:06.164
4a75a0f8-3969-4217-9187-b3a8a4f26649	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	kahlil applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-06 22:56:39.997
5a7f938d-558b-4967-b4b7-57170ade845a	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	kahlil applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-06 22:58:01.602
df62ceb4-b818-4db7-863e-c36406e22b01	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	kahlil completed their onboarding form for "ERP".	/recruitment/onboarding	t	2026-08-06 23:23:01.152
db348b87-4512-43f3-8630-b8b7adbf1886	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP".	/recruitment/onboarding	t	2026-08-06 23:24:06.162
cdc7426c-4310-43a8-8c67-4bd7cdc06a01	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-08 18:25:27.934
60e4eee3-b670-4a17-8128-8bdf383299a8	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-08 18:25:30.042
c722d0f5-2de3-407f-b9d9-b50aa0910d4c	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP" and is ready to enroll.	/recruitment/onboarding	f	2026-08-08 18:38:08.618
cea236fa-20d4-4de4-b1e4-a6532a210073	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "ERP" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-08 18:25:27.933
d7264aef-6222-4eae-b144-1e43725e6a1f	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "ERP" is fully approved.	/recruitment/requests	t	2026-08-08 18:25:30.04
3e6db687-4b01-4b63-bd85-a47b16991e4d	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Position published to Careers	"ERP" is now open for public applications on the Careers page.	/recruitment/hiring	t	2026-08-08 18:25:30.044
735b90bc-163c-48d7-bdbb-6fa98a4fcc74	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-08 18:26:07.505
3473a794-e7ff-469f-bb51-deef1d0ca8c3	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-09 17:19:26.017
8777ef63-ce26-4031-97f3-ebcd440a46fd	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Motaz Layas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-09 17:27:41.81
a2bc7846-a9c6-4225-b093-a800468464fc	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-09 17:44:20.597
1c7e8a36-8cec-4441-94a8-41c45a62fc0c	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-09 18:12:19.21
6dddd7a3-5fcd-400d-84bd-d0ea9cae6f21	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	test applied for "ERP" via the Careers page.	/recruitment/hiring	f	2026-08-09 18:14:12.594
a5e85904-d4a6-4569-a869-8aa4971cfcce	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-09 17:19:26.013
e94fe2eb-2318-43f8-9259-cd4ac1791958	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Motaz Layas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-09 17:27:41.806
5acd2f5f-7c1b-403b-afe2-6d304652ed21	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-09 17:44:20.586
0a248f1e-f6b9-4c0a-9d30-67eee7327d13	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-09 18:12:19.201
40dc2193-6aeb-479a-82b7-4229415631e8	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	test applied for "ERP" via the Careers page.	/recruitment/hiring	t	2026-08-09 18:14:12.591
e6e05aef-3b1b-4f03-9f61-22cabf8f42f9	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	test completed their onboarding form for "ERP" and is ready to enroll.	/recruitment/onboarding	f	2026-08-09 20:01:41.137
e4c73a84-edf9-4850-88fd-f1ae0060ce03	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	test completed their onboarding form for "ERP".	/recruitment/onboarding	t	2026-08-09 20:01:41.126
12f16d7d-9e21-4f76-ae9d-7e41804783a0	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP" and is ready to enroll.	/recruitment/onboarding	f	2026-08-09 20:54:45.773
701153d2-1e5d-4af5-83ba-db3f1f1c795d	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	Muetaz layyas completed their onboarding form for "ERP".	/recruitment/onboarding	t	2026-08-09 20:54:45.765
8164486e-4e86-4b9b-9fc2-e72509a8ea2b	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "software developer" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-09 21:11:34.095
ce78baf0-d030-4f57-99c9-f5d8bff2360f	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"software developer" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-09 21:11:34.097
d6d926dc-f091-470d-b64c-11da141606cb	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "software developer" is fully approved.	/recruitment/requests	t	2026-08-09 21:11:35.878
671e0903-8d4b-41cf-b2a3-d0288ed44cd5	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"software developer" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-09 21:11:35.88
57a298f8-703c-46ac-9bf6-f776dbd8333c	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position published to Careers	"software developer" is now live on the public Careers page. Applications will appear in the applicant list.	/recruitment/hiring	f	2026-08-09 21:11:35.881
cab7703b-bf03-43dc-9387-c23c75a1c653	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "software developer" via the Careers page.	/recruitment/hiring	f	2026-08-09 21:12:24.203
c6cfcf58-0794-49f0-ac55-e8f8f61b3724	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	Muetaz layyas completed their onboarding form for "software developer" and is ready to enroll.	/recruitment/onboarding	f	2026-08-09 21:14:59.262
0ce80de0-68f9-4db9-93f6-15ded43f2d25	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Position published to Careers	"software developer" is now open for public applications on the Careers page.	/recruitment/hiring	t	2026-08-09 21:11:35.882
89259a64-eade-4e73-affa-aa2266464844	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "software developer" via the Careers page.	/recruitment/hiring	t	2026-08-09 21:12:24.064
43aabdb4-42f4-44d5-b9f6-18aeb508c0d2	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	Muetaz layyas completed their onboarding form for "software developer".	/recruitment/onboarding	t	2026-08-09 21:14:59.259
7b83f07f-446f-4ed7-b8f3-7a8ce6ecc80a	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"TEST" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-10 17:15:51.373
bc9f8353-d551-436b-b26d-95a356e79681	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"hi" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-10 18:24:26.275
8f5a19a0-b994-4171-bb92-4a5c36a281c8	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"we" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-10 18:27:16.584
7b6f9430-3a2a-4a3e-b114-4408c3cc153a	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "TEST" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-10 17:15:51.371
eb2e4d58-3cb2-45cb-8621-50c5e0922f76	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your JD change "TEST" was approved by HR and is now with the GM / Directorate Head.	/recruitment/requests	t	2026-08-10 17:16:14.193
8e579c6a-075c-45e1-b931-f006a1f67ef2	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "TEST" is fully approved.	/recruitment/requests	t	2026-08-10 17:17:10.759
6dc7f846-b32a-4c84-b075-71c7124c66d1	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "hi" was approved by the Head of Division and is now with HR.	/recruitment/requests	t	2026-08-10 18:24:26.273
21532ab3-466b-45d7-b1d7-ec98b86e2613	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your JD change "hi" was approved by HR and is now with the Head of Directorate.	/recruitment/requests	t	2026-08-10 18:24:29.056
19b2851f-de5e-46e7-9206-17172514fb1a	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "hi" is fully approved.	/recruitment/requests	t	2026-08-10 18:24:31.694
2850dc39-1009-41ef-a41b-b8f1c187c6ec	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"hi" is fully approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-10 21:03:24.713
0126385e-8a87-4e0b-979b-0ce7e5dc8cd0	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"hi" is fully approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-10 21:34:27.4
9bbeabd9-8d7b-47df-bf3b-39e5bfb3e85d	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of Department stage.	/recruitment/requests	t	2026-08-10 21:02:29.177
1e2624ee-200c-4345-834b-5002439b919e	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of Division/Office stage.	/recruitment/requests	t	2026-08-10 21:02:33.561
cdebe780-0d70-48ba-a9e1-afe754ca1a69	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of HR stage.	/recruitment/requests	t	2026-08-10 21:02:38.016
9e6482b2-7b6a-4ba9-b0ee-4c65f427753a	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of Hiring Unit stage.	/recruitment/requests	t	2026-08-10 21:02:41.233
8ada5caa-d59b-4fb2-8dad-e8b167dcf646	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition fully approved	Your hire requisition "hi" is fully approved and open for sourcing.	/recruitment/requests	t	2026-08-10 21:03:24.71
16496b9b-8489-4d9f-ba58-43fc08ede38e	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of Department stage.	/recruitment/requests	t	2026-08-10 21:15:31.38
0d39bebf-9fc1-49a8-a3ce-6fe6ed164e4a	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of Division/Office stage.	/recruitment/requests	t	2026-08-10 21:15:33.838
86d90f93-123d-46f8-b162-9d2894e79847	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of HR stage.	/recruitment/requests	t	2026-08-10 21:15:36.709
04cb45fd-fa0c-4435-8488-bbe23818e33e	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your hire requisition "hi" was approved at the Head of Hiring Unit stage.	/recruitment/requests	t	2026-08-10 21:15:39.855
28a19c37-2bb5-4342-ad7a-990553085b71	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition fully approved	Your hire requisition "hi" is fully approved and open for sourcing.	/recruitment/requests	t	2026-08-10 21:34:27.369
1fc0f869-05bc-4e79-98f7-31c65b086ccf	fe156c64-c6d6-4bdf-8c8d-105530165a0d	New application received	Muetaz layyas applied for "hi" via the Careers page.	/recruitment/hiring	f	2026-08-12 18:20:52.748
0027ab16-6bf3-4025-8f82-bf0b5baca286	0484aa74-4af7-4526-b357-8d5b3b9463aa	New application received	Muetaz layyas applied for "hi" via the Careers page.	/recruitment/hiring	f	2026-08-12 18:20:52.887
de9ea410-70c6-4ed4-ac5e-acb120d1aaa0	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Onboarding submitted	Muetaz layyas completed their onboarding form for "hi".	/recruitment/onboarding	f	2026-08-12 18:22:14.109
4acd866c-8ee1-4522-a136-0da239345dc4	0484aa74-4af7-4526-b357-8d5b3b9463aa	Onboarding submitted	Muetaz layyas completed their onboarding form for "hi" and is ready to enroll.	/recruitment/onboarding	f	2026-08-12 18:22:14.115
\.


--
-- Data for Name: PayrollResult; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PayrollResult" (id, "employeeId", month, "totalHours", overtime, absences, "hrPresenceScore", "hrAbsenceDays", "hrDelayMinutes", "adminScore", "executiveScore", "careScore", "deptPerformance", "deptDiscipline", "departmentScore", "directorLeadership", "directorImpact", "directorScore", "personnelScore", "personnelDeductionDays", "personnelBonusDays", "trainingSummary", "finalScore", "finalSalary", "csvGenerated", "generatedAt", appearance, "commSkills", "contDev", "dataPrivacy", "hrAnnualPaidLeaves", "hrEmergencyDays", "hrUnpaidLeaves", "orgCompliance", "pressureHandling", "probSolving", "regAdherence", "regCompliance", "relColleagues", "resPreservation", "safetyAdherence", "taskQuality", teamwork, "timeCommit", "workOrg", "chairmanScore", "divisionScore", "gmScore") FROM stdin;
\.


--
-- Data for Name: PersonnelEvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PersonnelEvaluation" (id, "employeeId", month, "warningMessages", "disciplinaryDeduction", "appreciationMessages", "exceptionalAssignments", "specializedTraining", "supportingTraining", "languageTraining", "softwareTraining", "submittedAt", "submittedById") FROM stdin;
\.


--
-- Data for Name: RecruitmentRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RecruitmentRequest" (id, "requesterId", "unitId", "departmentId", "jobTitle", reason, status, "hrNote", "gmNote", "hrApprovedById", "gmApprovedById", "createdAt", "updatedAt", "deptApprovedById", "deptNote", "divisionId", "jdPayload", "jobDescriptionId", type, filled, "filledAt", quantity, "deptApprovedAt", "hrApprovedAt", "gmApprovedAt", "publishedToCareers", "publishedAt", "employmentType", "typeOfRequest", "languageEn", "languageAr", "prfApprovals", "reportsTo") FROM stdin;
c8580126-4426-4699-91a3-ebc32cc2b4f1	fe156c64-c6d6-4bdf-8c8d-105530165a0d	\N	cb3076ba-2444-4a4b-aa4c-531791cac3e8	software developer	ggg	FULLY_APPROVED		\N	fe156c64-c6d6-4bdf-8c8d-105530165a0d	\N	2026-08-09 21:11:31.132	2026-08-09 21:11:35.874	fe156c64-c6d6-4bdf-8c8d-105530165a0d		\N	null	a0760106-e4b8-433e-94bb-37de575d9a3d	HIRE	f	\N	5	2026-08-09 21:11:34.089	2026-08-09 21:11:35.872	\N	t	2026-08-09 21:11:35.872	\N	\N	\N	\N	\N	\N
a963fe3a-3552-441a-bf28-8f9eb0ae4fba	fe156c64-c6d6-4bdf-8c8d-105530165a0d	\N	cb3076ba-2444-4a4b-aa4c-531791cac3e8	hi	WE NNED	FULLY_APPROVED	\N	\N	\N	\N	2026-08-10 21:15:23.564	2026-08-12 18:24:17.141	\N	\N	\N	null	26ed1173-7bcf-4ff4-a39a-001836741efc	HIRE	t	2026-08-12 18:24:17.14	1	\N	\N	\N	f	2026-08-10 21:34:27.348	Full-time	New Position	GOOD	VERY GOOD	{"gm": {"at": "2026-08-10T21:34:27.348Z", "byId": "fe156c64-c6d6-4bdf-8c8d-105530165a0d", "note": null, "byName": "System Admin", "document": "/uploads/requisitions/1786397667302-592478026.docx", "signature": "data:image/png;base64,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"}, "divHead": {"at": "2026-08-10T21:15:33.831Z", "byId": "fe156c64-c6d6-4bdf-8c8d-105530165a0d", "note": null, "byName": "System Admin", "document": null, "signature": "data:image/png;base64,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"}, "deptHead": {"at": "2026-08-10T21:15:31.362Z", "byId": "fe156c64-c6d6-4bdf-8c8d-105530165a0d", "note": null, "byName": "System Admin", "document": null, "signature": "data:image/png;base64,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"}, "hrManager": {"at": "2026-08-10T21:15:36.702Z", "byId": "fe156c64-c6d6-4bdf-8c8d-105530165a0d", "note": null, "byName": "System Admin", "document": null, "signature": "data:image/png;base64,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"}, "hrRecruitment": {"at": "2026-08-10T21:15:39.847Z", "byId": "fe156c64-c6d6-4bdf-8c8d-105530165a0d", "note": null, "byName": "System Admin", "document": null, "signature": "data:image/png;base64,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"}}	MOTAZ
\.


--
-- Data for Name: SalaryStructure; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SalaryStructure" (id, "jobCategory", "jobGrade", "structureLevel", "hourlyRate", "monthlyRate") FROM stdin;
3550815a-08cd-4a61-a24c-ab4467fb8196	Engineer	Senior consultant	SS-01-LYD	29.5	6136
edc5eed2-8a63-4993-9563-e6a68b349c8e	Engineer	Senior consultant	SS-02-USD	11.5	2392
8c4ed53b-2b44-4905-aa78-b360e73a15ee	Engineer	Senior consultant	SS-03-USD	20.5	4264
ba8b2653-6c5e-4375-b8b6-8a2abd701e6e	Engineer	Senior consultant	SS-04-EUR	24.5	5096
80197499-d4d7-4a94-b9ab-24cc9613df95	Engineer	Senior consultant	SS-05-EUR	34.5	7176
77f7026e-a0ef-4528-beba-839ca3f99a77	Engineer	Lead Consultant	SS-01-LYD	27.5	5720
67da9d05-948f-4045-b954-b12393e3cb04	Engineer	Lead Consultant	SS-02-USD	11	2288
2d9c2de4-dee1-4a63-b0ad-fd95e0217cd8	Engineer	Lead Consultant	SS-03-USD	18.5	3848
c1130a51-076a-4abd-af74-13d827082ac6	Engineer	Lead Consultant	SS-04-EUR	22.5	4680
79cd7848-6919-40af-bc60-f5aba1851992	Engineer	Lead Consultant	SS-05-EUR	32.5	6760
b1ac2cda-aacd-4593-9acf-5c8bb1109b74	Engineer	Associate Consultant	SS-01-LYD	25.5	5304
32a579a7-6d57-49d5-8050-c1038ec07917	Engineer	Associate Consultant	SS-02-USD	10.5	2184
a001cf6f-7d7c-4347-b6a8-3253539e122c	Engineer	Associate Consultant	SS-03-USD	16.5	3432
387dd704-58b7-4253-9518-be681d0c5973	Engineer	Associate Consultant	SS-04-EUR	20.5	4264
973038e2-8414-47d0-9d19-f4a88679247a	Engineer	Associate Consultant	SS-05-EUR	30.5	6344
cc7399e2-f30f-4b8d-9b2b-b2eab7aa80a2	Engineer	Senior	SS-01-LYD	25	5200
e985950f-aa22-4829-99c6-0dd2bf5166a6	Engineer	Senior	SS-02-USD	10	2080
fba7ead3-3bf4-4dda-a098-90f3469c44bc	Engineer	Senior	SS-03-USD	14.5	3016
22161366-9266-4a52-af07-cc2e6ccddf4d	Engineer	Senior	SS-04-EUR	18.5	3848
c7eea200-7170-4d2e-9387-44e4368ab2e4	Engineer	Senior	SS-05-EUR	28.5	5928
b2bc1d4b-9962-4738-904c-cba5c8877d06	Engineer	Lead	SS-01-LYD	23	4784
7c26b548-3075-4f6d-885a-7d7e9e363902	Engineer	Lead	SS-02-USD	9	1872
6869a69e-f06d-4b9b-aa63-b10112aa4eb2	Engineer	Lead	SS-03-USD	12.5	2600
ec678e3a-f340-41a0-8db9-a35d9313cd82	Engineer	Lead	SS-04-EUR	16.5	3432
6d7076ca-c250-4db7-86f8-4a598eebfe2d	Engineer	Lead	SS-05-EUR	26.5	5512
29325487-bcc6-48a3-8b05-d8d45528b6eb	Engineer	Junior	SS-01-LYD	21	4368
8bbd8636-a372-4afd-8b6f-c1373831947f	Engineer	Junior	SS-02-USD	6.5	1352
223282e3-303d-4d85-8cdf-f602bf1d5185	Engineer	Junior	SS-03-USD	10.5	2184
106bfe34-8d7d-4d85-a2c0-c60373afb94c	Engineer	Junior	SS-04-EUR	14.5	3016
cc0aaaca-7ee9-447f-9a32-9cc36878a54b	Engineer	Junior	SS-05-EUR	24.5	5096
d76bb974-d990-4dba-830c-50c77087b10a	Engineer	Intern	SS-01-LYD	13.5	2808
008718ec-c199-43f5-b1e1-5c944c129686	Engineer	Intern	SS-02-USD	6	1248
7dd4bcf7-816f-42e6-b7e6-a905d0872e6a	Engineer	Intern	SS-03-USD	8.5	1768
911a5bcb-68ec-4653-9a96-3b1fbb37d925	Engineer	Intern	SS-04-EUR	12.5	2600
b9895f7e-fc54-4252-abb3-eff32f473b55	Engineer	Intern	SS-05-EUR	12.5	2600
cd09a481-ddbd-4186-9ef2-33075931c937	Engineer	Trainee	SS-01-LYD	11.5	2392
e5e26a66-d81c-44dd-a609-4ae481c5b68a	Engineer	Trainee	SS-02-USD	5.5	1144
e85d53b0-8e73-4652-beb7-f1bacdc508de	Engineer	Trainee	SS-03-USD	6.5	1352
ab905555-3768-4aa0-a513-41f9a128ded2	Engineer	Trainee	SS-04-EUR	10.5	2184
a9c840dd-ecd8-4dbb-9a33-ba4e2a02eb7f	Engineer	Trainee	SS-05-EUR	10.5	2184
4e66d42c-bd0d-4398-be71-950fe5649898	Financial Officer	Senior consultant	SS-01-LYD	26	5408
ec294242-4b07-4aef-b75b-0d9163e24a6e	Financial Officer	Senior consultant	SS-02-USD	8.5	1768
58ebae58-49f7-4849-829b-d44472b6a7d3	Financial Officer	Senior consultant	SS-03-USD	17	3536
a58d1bf8-ab11-4d76-b83a-8a8565d7cacb	Financial Officer	Senior consultant	SS-04-EUR	21	4368
037803ce-3e3d-4065-b163-a92cd4499c94	Financial Officer	Senior consultant	SS-05-EUR	31	6448
0e670bf0-cbf1-4e86-8626-d4bd0759bacc	Financial Officer	Lead Consultant	SS-01-LYD	24.5	5096
e5571324-8d43-4051-97f7-09b43db0dae3	Financial Officer	Lead Consultant	SS-02-USD	8	1664
71f83f8f-b8e8-442f-8bb3-90ac61fff6b5	Financial Officer	Lead Consultant	SS-03-USD	15.5	3224
41fd3254-4b12-4374-a527-8b4ff65d0f02	Financial Officer	Lead Consultant	SS-04-EUR	19.5	4056
649a1695-2145-4714-aaed-fdd4a584063a	Financial Officer	Lead Consultant	SS-05-EUR	29.5	6136
dbeeb48a-61fc-4011-a3be-5a5de8aceb8b	Financial Officer	Associate Consultant	SS-01-LYD	23	4784
f96cb910-978b-4df0-9a7f-86d2f34a089f	Financial Officer	Associate Consultant	SS-02-USD	7.5	1560
f6702f1c-b98e-4ea1-b7c9-d2dfa1d5a276	Financial Officer	Associate Consultant	SS-03-USD	14	2912
d55c1c47-3562-4124-b7fd-29965fbd524a	Financial Officer	Associate Consultant	SS-04-EUR	18	3744
7913ec2f-5bc4-4301-9f8b-33930b5c4c06	Financial Officer	Associate Consultant	SS-05-EUR	28	5824
40246b92-9424-44ab-8768-f69a6f9d7d38	Financial Officer	Senior	SS-01-LYD	22	4576
b4644611-e79d-4f2f-98f1-ea7bfbff43d5	Financial Officer	Senior	SS-02-USD	7	1456
73ea0e6d-066a-4170-92d3-5ad3a150e238	Financial Officer	Senior	SS-03-USD	12.5	2600
3d966a53-63e7-402a-b619-0b9c200a7aaa	Financial Officer	Senior	SS-04-EUR	16.5	3432
a5c5ce64-c5c6-4ff2-ba0f-b2520112436a	Financial Officer	Senior	SS-05-EUR	26.5	5512
56aec02b-de2d-4d37-afe6-fe6dfdb8b795	Financial Officer	Lead	SS-01-LYD	20.5	4264
e83c4b3d-107f-4eb6-a669-24ead496903b	Financial Officer	Lead	SS-02-USD	6.5	1352
5c31680e-51fa-459f-831b-609bbd2838a5	Financial Officer	Lead	SS-03-USD	11	2288
84762169-baa3-436e-853d-69295a7eb31f	Financial Officer	Lead	SS-04-EUR	15	3120
7e0778e8-99fc-4773-8f0c-50bf73297e10	Financial Officer	Lead	SS-05-EUR	25	5200
30272b3f-939b-4d8a-b59e-8aea0fcf3fd8	Financial Officer	Junior	SS-01-LYD	19	3952
ea667c3f-3d62-416d-bf67-c71b99c9db9a	Financial Officer	Junior	SS-02-USD	6	1248
c48b2d2e-9e13-4eb6-a3b3-2300be1b7d85	Financial Officer	Junior	SS-03-USD	9.5	1976
2941c1cc-1286-4266-a438-0545a184e260	Financial Officer	Junior	SS-04-EUR	13.5	2808
1654d477-28a6-4574-8190-abbe57e2b414	Financial Officer	Junior	SS-05-EUR	23.5	4888
4e2b38f9-37c8-4c11-81a9-05c196eaee37	Financial Officer	Intern	SS-01-LYD	13.5	2808
d290a7f8-0856-42d9-9e2e-1e6c89bf8899	Financial Officer	Intern	SS-02-USD	5.5	1144
854f7a46-89a9-4d28-b23c-ba86df4a979c	Financial Officer	Intern	SS-03-USD	8	1664
d4937b04-2e69-469a-8295-6fec3172630c	Financial Officer	Intern	SS-04-EUR	12	2496
757d4bb1-a5de-4360-9028-042f8d1ac3f7	Financial Officer	Intern	SS-05-EUR	12	2496
fa1fbfa7-d3f2-4f21-bec0-d2a42481e4a9	Financial Officer	Trainee	SS-01-LYD	11.5	2392
bc32e600-7e43-44cc-8c35-96f31792ac8c	Financial Officer	Trainee	SS-02-USD	5	1040
c2031e07-0e6c-4e62-b1ca-e56e06fe526c	Financial Officer	Trainee	SS-03-USD	6.5	1352
43a83647-1a4c-4e8f-a92f-be2679c1612b	Financial Officer	Trainee	SS-04-EUR	10.5	2184
91dc4e44-165c-4d8e-aadb-b082e45adcfd	Financial Officer	Trainee	SS-05-EUR	10.5	2184
92af03e8-77d5-41a5-8ff4-abc09b3cfb5c	Operation Officer	Senior consultant	SS-01-LYD	24.5	5096
69822637-e8a1-4667-93cd-684a796934ce	Operation Officer	Senior consultant	SS-02-USD	8	1664
3678bea5-60e3-4514-8f7d-119a14ab3ceb	Operation Officer	Senior consultant	SS-03-USD	16.5	3432
9ea2c146-4b78-4cc5-87f7-494031a89b13	Operation Officer	Senior consultant	SS-04-EUR	20.5	4264
331d25a5-06eb-43a4-8316-daf2401d5cf0	Operation Officer	Senior consultant	SS-05-EUR	30.5	6344
bde2c4bc-1781-47cb-9a53-23bffadbd9e5	Operation Officer	Lead Consultant	SS-01-LYD	23	4784
0e4e3e7f-1f4d-4262-b9ed-b303f3b92f6c	Operation Officer	Lead Consultant	SS-02-USD	7.5	1560
e0a523a8-af72-4814-8706-7d368fecca1c	Operation Officer	Lead Consultant	SS-03-USD	15	3120
5c376a36-399c-48ac-9cb7-6f4edf7c9e08	Operation Officer	Lead Consultant	SS-04-EUR	19	3952
edbf1cac-de82-4497-bef0-466e13696327	Operation Officer	Lead Consultant	SS-05-EUR	29	6032
312869cb-7c40-49f4-b5fa-aab6769fc3c2	Operation Officer	Associate Consultant	SS-01-LYD	21.5	4472
ce512ae4-3942-4abe-a8d4-3ab43ccae697	Operation Officer	Associate Consultant	SS-02-USD	7	1456
15c52517-e8e4-4c96-ae95-7a32f8137679	Operation Officer	Associate Consultant	SS-03-USD	13.5	2808
0e051054-c236-4ce5-b422-4a56b9776037	Operation Officer	Associate Consultant	SS-04-EUR	17.5	3640
4149cc2e-2f29-4f34-a044-ec11e7da2cc4	Operation Officer	Associate Consultant	SS-05-EUR	27.5	5720
a8566fe6-fae3-4537-ba9d-0d640c18be88	Operation Officer	Senior	SS-01-LYD	20.5	4264
82c58302-9678-4600-bbfd-4521df5b9d6f	Operation Officer	Senior	SS-02-USD	6.5	1352
07064a1f-8a7b-406e-b571-5b47998174cf	Operation Officer	Senior	SS-03-USD	12	2496
aeac5a18-1006-46d9-9448-4d124fce0cc2	Operation Officer	Senior	SS-04-EUR	16	3328
570aebae-03e7-4f90-b4d4-e9e4b5e64fe2	Operation Officer	Senior	SS-05-EUR	26	5408
fdb91f13-8802-44d2-8516-a71f470dc57a	Operation Officer	Lead	SS-01-LYD	19	3952
329c49ec-32de-4cc8-9506-f7505e968216	Operation Officer	Lead	SS-02-USD	6	1248
976892a9-7cc2-4944-84a9-db628808b827	Operation Officer	Lead	SS-03-USD	10.5	2184
1484380b-f4cc-43dd-b252-cd05a45a05b7	Operation Officer	Lead	SS-04-EUR	14.5	3016
d9e88760-0c4a-4617-8ed9-a60e83ef14d6	Operation Officer	Lead	SS-05-EUR	24.5	5096
6d03968a-86bc-4232-9865-af7984667bdb	Operation Officer	Junior	SS-01-LYD	17.5	3640
229b6680-8e6b-4bac-8640-a6d521a6a18e	Operation Officer	Junior	SS-02-USD	5.5	1144
a22d1552-edde-45fa-a7f9-adea447c94a6	Operation Officer	Junior	SS-03-USD	9	1872
3ba1235a-2b73-438b-a8da-82e551f52832	Operation Officer	Junior	SS-04-EUR	13	2704
e6f0c659-23d2-4986-aeca-4ba73d374448	Operation Officer	Junior	SS-05-EUR	23	4784
323c5647-d2dc-4e87-a852-a67d2a10544c	Operation Officer	Intern	SS-01-LYD	12.5	2600
25400ccb-ee2b-4a90-9ca2-af40bb0c2c93	Operation Officer	Intern	SS-02-USD	5	1040
055d6387-1297-4b57-8a15-c685b7ccdf30	Operation Officer	Intern	SS-03-USD	7.5	1560
a5067b81-4690-4693-8250-9bb11f6704ff	Operation Officer	Intern	SS-04-EUR	11.5	2392
c163ffdd-0d68-4a7a-9764-2c4ce8657494	Operation Officer	Intern	SS-05-EUR	11.5	2392
c603f0f1-9715-4b6b-a3d0-1258e929e82c	Operation Officer	Trainee	SS-01-LYD	11	2288
4e11de67-d6c0-4c44-a401-8e7b2a64de23	Operation Officer	Trainee	SS-02-USD	4.5	936
dc9af98c-ce66-4841-98cc-0c732e5bdb56	Operation Officer	Trainee	SS-03-USD	6	1248
59f25164-d3f7-43bc-99ac-ebde6f3f763c	Operation Officer	Trainee	SS-04-EUR	10	2080
af5b036d-e934-4f7b-a707-3ebda93f9c12	Operation Officer	Trainee	SS-05-EUR	10	2080
e61275d6-3f67-49de-a577-7fba10263e17	Administrative Officer	Senior consultant	SS-01-LYD	22.5	4680
cfd2127f-869f-4c9f-8c90-68197710e785	Administrative Officer	Senior consultant	SS-02-USD	7.5	1560
2c75731e-9363-4c3a-b61c-a764c9aedc70	Administrative Officer	Senior consultant	SS-03-USD	15.5	3224
6ee0787b-fcc8-4e62-81c3-e40b1a7a6bd3	Administrative Officer	Senior consultant	SS-04-EUR	19.5	4056
9b6bbc70-e65b-417c-be2a-e6626057b85c	Administrative Officer	Senior consultant	SS-05-EUR	29.5	6136
572add0d-be80-418b-8780-7eaee476d243	Administrative Officer	Lead Consultant	SS-01-LYD	22.5	4680
1af5aa64-4de1-4376-81e6-b29a54578060	Administrative Officer	Lead Consultant	SS-02-USD	7	1456
e648b2a0-81ca-4e06-9437-e99f4cb27e82	Administrative Officer	Lead Consultant	SS-03-USD	14	2912
f2b91b54-5aba-4cb7-b35a-6332e17ad5e0	Administrative Officer	Lead Consultant	SS-04-EUR	18	3744
2fc04da6-e086-47f7-a409-b4b4812ab8e3	Administrative Officer	Lead Consultant	SS-05-EUR	28	5824
1816a6f0-b4e8-4c66-8b44-79a9744ed7c9	Administrative Officer	Associate Consultant	SS-01-LYD	20	4160
9ddf93ef-147c-4bfd-aefb-39f4acf42342	Administrative Officer	Associate Consultant	SS-02-USD	6.5	1352
e3c02dbb-1146-410b-921f-466fdcea2387	Administrative Officer	Associate Consultant	SS-03-USD	12.5	2600
b9d42b70-d499-46ef-b09e-9796ea26627d	Administrative Officer	Associate Consultant	SS-04-EUR	16.5	3432
195dd7ea-686b-4a81-b2dd-80ad7de33c00	Administrative Officer	Associate Consultant	SS-05-EUR	26.5	5512
9add07ba-1188-4f2d-a353-bf2771618fd1	Administrative Officer	Senior	SS-01-LYD	19.5	4056
e559dca4-3827-4dba-8850-fbb52ecfa466	Administrative Officer	Senior	SS-02-USD	6	1248
4279fc53-43d0-4006-b40a-d8864d52c65c	Administrative Officer	Senior	SS-03-USD	11	2288
67ef3325-d3d4-4764-a8f9-fec7d8c2a469	Administrative Officer	Senior	SS-04-EUR	15	3120
926d2868-20ab-44b5-87df-647f3f94b90f	Administrative Officer	Senior	SS-05-EUR	25	5200
0ae49f65-7e8e-4ab4-bbd3-76a74ef290fc	Administrative Officer	Lead	SS-01-LYD	18	3744
70147373-996d-4243-95fa-3eb4db519918	Administrative Officer	Lead	SS-02-USD	5.5	1144
b89c95b5-694f-48e6-b64d-626a6a521baf	Administrative Officer	Lead	SS-03-USD	9.5	1976
adc4a556-5b58-4ea2-8446-f73b935cd188	Administrative Officer	Lead	SS-04-EUR	13.5	2808
679c9684-782a-4223-a398-cabd9a338dac	Administrative Officer	Lead	SS-05-EUR	23.5	4888
4637c29a-b5e4-4290-85ea-72f0868f6c3e	Administrative Officer	Junior	SS-01-LYD	16.5	3432
48bcd2a2-4413-4b7f-b0df-6f2b94df22ba	Administrative Officer	Junior	SS-02-USD	5	1040
7159ff83-e710-4f99-89a8-0dd58334af69	Administrative Officer	Junior	SS-03-USD	8	1664
7f8818cc-31ae-4e93-b6e8-2d34055c3765	Administrative Officer	Junior	SS-04-EUR	12	2496
76f468ae-a040-45d0-b27c-7acc3cec81f4	Administrative Officer	Junior	SS-05-EUR	22	4576
fee74543-19a6-4192-9686-3c0af2e1c4bc	Administrative Officer	Intern	SS-01-LYD	12	2496
2c5b5ec9-13e6-46c4-819d-0a18074c071c	Administrative Officer	Intern	SS-02-USD	4.5	936
db5b2b94-b217-41bc-8689-5b76ef07a2f2	Administrative Officer	Intern	SS-03-USD	6.5	1352
4a20a256-84f5-4cf2-9954-b84b7630fff6	Administrative Officer	Intern	SS-04-EUR	10.5	2184
3d766415-5db5-444e-b0d5-7feac035a116	Administrative Officer	Intern	SS-05-EUR	10.5	2184
63c8eb68-367d-4f63-98bf-5e5475a6b105	Administrative Officer	Trainee	SS-01-LYD	10.5	2184
e383cd7d-a238-4cb9-b401-7e2c8a96efc1	Administrative Officer	Trainee	SS-02-USD	4	832
348997f6-55dc-426d-b66c-be09425cae2b	Administrative Officer	Trainee	SS-03-USD	5	1040
1f3c0fac-ed67-4c18-b07d-b480fbe73e11	Administrative Officer	Trainee	SS-04-EUR	9	1872
7da8b9bc-50e7-4651-8547-a10249882d0c	Administrative Officer	Trainee	SS-05-EUR	9	1872
db51090b-abf5-4bed-ba46-7748dd0ca715	Supervisor	Senior consultant	SS-01-LYD	19.5	4056
2e656860-b744-4fd2-8a3c-c760bb60910a	Supervisor	Senior consultant	SS-02-USD	8	1664
9a5c72e9-d652-4376-be2a-ca44cff81b91	Supervisor	Senior consultant	SS-03-USD	12	2496
e78da1ce-8bc7-46d3-9d12-4015b75a55e2	Supervisor	Senior consultant	SS-04-EUR	16	3328
45e75ea5-7745-4232-886e-80e49b8ad9b3	Supervisor	Senior consultant	SS-05-EUR	26	5408
ba83e417-6122-40ee-9db9-6fd32af7d4ff	Supervisor	Lead Consultant	SS-01-LYD	19	3952
def7674c-8290-4571-9f14-5675b6d6c3e3	Supervisor	Lead Consultant	SS-02-USD	7.5	1560
6653f689-2b63-476e-82e5-0d5ba7898201	Supervisor	Lead Consultant	SS-03-USD	11	2288
aec50304-7ad0-4ec9-9ca5-489fc5638a43	Supervisor	Lead Consultant	SS-04-EUR	15	3120
0468536d-be0a-4fa6-a58a-dc7abf136e64	Supervisor	Lead Consultant	SS-05-EUR	25	5200
530d18de-ab2a-4fa3-b94d-876089413d27	Supervisor	Associate Consultant	SS-01-LYD	18.5	3848
3961d95f-6af6-46b8-a8aa-62428c076075	Supervisor	Associate Consultant	SS-02-USD	7	1456
9ce4a551-7cc1-44b8-ac61-122b3f7c3f3a	Supervisor	Associate Consultant	SS-03-USD	10	2080
ce7fd8b3-7e18-4eb6-af93-05d1b7e20692	Supervisor	Associate Consultant	SS-04-EUR	14	2912
c7a2c8cb-bef3-434e-924f-8c65b4a95334	Supervisor	Associate Consultant	SS-05-EUR	24	4992
6251c466-2c8b-4810-a2e2-27b6721572c4	Supervisor	Senior	SS-01-LYD	18	3744
93ccfd44-0de9-478f-a414-d8a9a786492a	Supervisor	Senior	SS-02-USD	6.5	1352
d9247328-472d-4bf6-8cad-9b482ed1c62c	Supervisor	Senior	SS-03-USD	9	1872
dfd7f9c4-2d31-410f-befd-58e6a44a1331	Supervisor	Senior	SS-04-EUR	13	2704
aab5bbb3-0354-4325-99fc-9d149aa7fb9c	Supervisor	Senior	SS-05-EUR	23	4784
130f4d13-eca0-45c9-b7bc-d4bdad1eece9	Supervisor	Lead	SS-01-LYD	17	3536
9ec39df2-fc30-45d1-af62-872f83f52381	Supervisor	Lead	SS-02-USD	6	1248
6bfff679-7c39-4381-90bb-33f7f4febdb3	Supervisor	Lead	SS-03-USD	8	1664
74807c6d-bbd5-426c-b413-163b4e46d2fa	Supervisor	Lead	SS-04-EUR	12	2496
b74309b8-10ee-4b0d-8108-61e8a7665118	Supervisor	Lead	SS-05-EUR	22	4576
425c8b49-2c0c-4d6c-bb11-2107b19c0c9e	Supervisor	Junior	SS-01-LYD	16	3328
6c8b956d-530a-4c91-82bc-26240a9b3ca7	Supervisor	Junior	SS-02-USD	5.5	1144
2c6d17eb-a003-49f7-950f-31b738496aa3	Supervisor	Junior	SS-03-USD	7	1456
8505fc84-fcc7-4097-96da-da2cbd1b6f10	Supervisor	Junior	SS-04-EUR	11	2288
b19207d6-ea3f-44e9-82af-8168464f27e8	Supervisor	Junior	SS-05-EUR	21	4368
d9e087a4-21c4-4884-9680-b3b8b14273c4	Supervisor	Intern	SS-01-LYD	11	2288
55def148-32e5-456c-909a-f1dd1f639001	Supervisor	Intern	SS-02-USD	4.5	936
5abf1160-6939-4a6c-8b77-f98a59b2eb29	Supervisor	Intern	SS-03-USD	6	1248
34dc6c99-0a18-4068-884f-a414fd7e333b	Supervisor	Intern	SS-04-EUR	10	2080
b5b01844-bdec-4020-ae30-864f428dedd1	Supervisor	Intern	SS-05-EUR	10	2080
1f0ac579-ee5b-4290-ae44-b85fc36b9f69	Supervisor	Trainee	SS-01-LYD	10	2080
f8c4391d-6a0e-4d8c-9bbf-6b15173e1b93	Supervisor	Trainee	SS-02-USD	3.5	728
895e15c2-011d-496d-bd1a-ebc91349a236	Supervisor	Trainee	SS-03-USD	5	1040
668e69a1-bd78-444e-8040-919d757a0cf0	Supervisor	Trainee	SS-04-EUR	9	1872
48fdb9ab-5291-439f-9f96-5ab5ac1c8965	Supervisor	Trainee	SS-05-EUR	9	1872
3266f940-22ca-440f-8c28-e8e128a851bc	Technician	Senior consultant	SS-01-LYD	18.5	3848
94e98719-bd73-48ce-9018-c23156d7552f	Technician	Senior consultant	SS-02-USD	7.5	1560
4d0ed279-52e0-4576-a05f-2b8d5949b86c	Technician	Senior consultant	SS-03-USD	11	2288
a38585d6-deb5-476c-9594-a6341b33b7e1	Technician	Senior consultant	SS-04-EUR	15	3120
e61f501e-939d-429a-a831-37031fa67717	Technician	Senior consultant	SS-05-EUR	25	5200
cf8295bf-6dbf-4225-878f-4090ed70fb92	Technician	Lead Consultant	SS-01-LYD	17.5	3640
50097207-b82f-409b-962c-de8e6424f9f3	Technician	Lead Consultant	SS-02-USD	7	1456
3319f7d3-099f-40e4-bc9d-c1469768bbd4	Technician	Lead Consultant	SS-03-USD	10	2080
6c7186f3-aeb9-4cbc-a4f2-144fcafdfcc1	Technician	Lead Consultant	SS-04-EUR	14	2912
8129833d-32b5-4ddb-ae4d-5f23fa82cd1b	Technician	Lead Consultant	SS-05-EUR	24	4992
7ab8129a-c64b-452f-b5a3-350edbcc04dc	Technician	Associate Consultant	SS-01-LYD	16.5	3432
ee00472e-cd7d-4987-bef3-8e1966686eaa	Technician	Associate Consultant	SS-02-USD	6.5	1352
fdc98ddd-0e09-435e-a627-b27a0409823a	Technician	Associate Consultant	SS-03-USD	9	1872
6e7917f5-929f-48f1-8760-38b468b4e8c2	Technician	Associate Consultant	SS-04-EUR	13	2704
7ab73e75-0a68-46d5-9e87-979d82b9e681	Technician	Associate Consultant	SS-05-EUR	23	4784
85704cf7-a7a3-4982-8785-37d51c5e545a	Technician	Senior	SS-01-LYD	16	3328
1827688d-94e7-4e31-b72b-ee42b3b3d42b	Technician	Senior	SS-02-USD	6	1248
bef27dbe-d5c3-4764-89b3-3b9487c20095	Technician	Senior	SS-03-USD	8	1664
db302de3-e778-4035-bc42-abb4bd32997e	Technician	Senior	SS-04-EUR	12	2496
001a5a4b-7195-4f16-9e97-7666d5f099f9	Technician	Senior	SS-05-EUR	22	4576
cf61b7fd-0314-43bd-9b62-6d9afe15101a	Technician	Lead	SS-01-LYD	15	3120
2f314615-d456-45bb-ba50-6c7a0c662761	Technician	Lead	SS-02-USD	5.5	1144
bb4554cc-25c6-4310-b33e-618e7f1ad8aa	Technician	Lead	SS-03-USD	7	1456
bb75bbd8-1069-4377-9c12-e6537d885486	Technician	Lead	SS-04-EUR	11	2288
f90682ae-62a2-4616-978a-2985d807287a	Technician	Lead	SS-05-EUR	21	4368
27def7d1-7f2f-48eb-93be-11be035a6fbd	Technician	Junior	SS-01-LYD	14	2912
dc1c21c4-6751-4e1e-aaf4-5dda75d0f47e	Technician	Junior	SS-02-USD	5	1040
4cd774a8-ec8a-44e6-a437-c9ca34063303	Technician	Junior	SS-03-USD	6	1248
fc19d593-6b38-4e38-b563-d1cdf811dd99	Technician	Junior	SS-04-EUR	10	2080
f1b99ec0-66b7-4a8d-a622-a97cd3e61c24	Technician	Junior	SS-05-EUR	20	4160
03fe800f-510b-4726-8e81-4f2d8c567ae2	Technician	Intern	SS-01-LYD	10.5	2184
58456e38-49cd-4a94-870a-810936b8acc0	Technician	Intern	SS-02-USD	4	832
2b38b4bc-055d-4008-8bd1-914cfebe42fe	Technician	Intern	SS-03-USD	5	1040
8978a12a-b8a7-4e3a-81f6-e72309edcbd5	Technician	Intern	SS-04-EUR	9	1872
b8629474-f9fe-4493-b316-2572eb1f2da6	Technician	Intern	SS-05-EUR	9	1872
5df08d65-ff29-453e-bddc-58ea56cc36a9	Technician	Trainee	SS-01-LYD	9.5	1976
a2b93a0f-cda6-4a99-81cb-5553ae2156c0	Technician	Trainee	SS-02-USD	3	624
c7f3f715-f5f0-4554-9f88-6952d5964292	Technician	Trainee	SS-03-USD	4	832
fb8f96a5-366e-4caf-9c3a-6433b54a8d34	Technician	Trainee	SS-04-EUR	8	1664
b9be2c3a-ecb8-4a13-9ac2-c3d8c59bdda7	Technician	Trainee	SS-05-EUR	8	1664
30b1123f-2d5e-4fbc-835a-9314aa193ed7	Support Officer	Senior consultant	SS-01-LYD	16.5	3432
d9827fdc-25ee-4a26-9fe5-f447753e9eeb	Support Officer	Senior consultant	SS-02-USD	6	1248
62a26f54-a177-423c-af29-8af764b6fc6f	Support Officer	Senior consultant	SS-03-USD	10	2080
8035cfbb-1e49-4dde-b60e-54f04412a008	Support Officer	Senior consultant	SS-04-EUR	14	2912
19421d96-c34c-4257-982a-bbf9a8e44eee	Support Officer	Senior consultant	SS-05-EUR	14	2912
319d872f-459a-4476-9d06-de250b8de2ae	Support Officer	Lead Consultant	SS-01-LYD	16	3328
2dda0148-08e9-4c0e-8c02-51dc67274547	Support Officer	Lead Consultant	SS-02-USD	5.5	1144
9edbb8fd-e591-4a3d-bb45-750c444d326f	Support Officer	Lead Consultant	SS-03-USD	9	1872
821d1a93-c0d4-4516-b2a7-9e06f8eb7f80	Support Officer	Lead Consultant	SS-04-EUR	13	2704
77ecc48c-45b0-4404-a3fd-174355391b54	Support Officer	Lead Consultant	SS-05-EUR	13	2704
b856bb90-d30b-4a21-b45b-84e0b74022d3	Support Officer	Associate Consultant	SS-01-LYD	15.5	3224
07392668-2912-4008-8a82-0f949c0af718	Support Officer	Associate Consultant	SS-02-USD	5	1040
a9e778d2-3132-43c0-8022-4734595a3385	Support Officer	Associate Consultant	SS-03-USD	8	1664
6e627d76-df33-4840-858f-9f25989ae135	Support Officer	Associate Consultant	SS-04-EUR	12	2496
b9a25b81-4e57-4c92-ae05-26fceb651849	Support Officer	Associate Consultant	SS-05-EUR	12	2496
2b5c09cb-1e43-447e-9125-b2e9f535b28e	Support Officer	Senior	SS-01-LYD	15	3120
da922590-e101-4aaa-96dd-29319841095b	Support Officer	Senior	SS-02-USD	4.5	936
921aa16f-6082-4e6d-8075-05d9887d7fcd	Support Officer	Senior	SS-03-USD	7	1456
a05b9e02-f1fa-4108-aa68-861722c2eb51	Support Officer	Senior	SS-04-EUR	11	2288
5f5f68d1-3c16-454a-967e-eb711a3b0429	Support Officer	Senior	SS-05-EUR	11	2288
08ae66eb-865d-4332-8a68-b54bc7051d26	Support Officer	Lead	SS-01-LYD	14	2912
663588d6-63f2-41fa-80cf-6512655fa821	Support Officer	Lead	SS-02-USD	4	832
027b06ac-cfc6-47a9-9bcd-e417fa504cc1	Support Officer	Lead	SS-03-USD	6	1248
6a5550bd-683b-415f-a5de-2375e2dcaaa3	Support Officer	Lead	SS-04-EUR	10	2080
15042fa9-de4e-40e7-93f3-21748da3c97b	Support Officer	Lead	SS-05-EUR	10	2080
719c6167-fd2e-400e-9b0b-5121c753f5cc	Support Officer	Junior	SS-01-LYD	13	2704
a0acc9fa-80f1-4b21-a85c-f100ebdbc8db	Support Officer	Junior	SS-02-USD	3.5	728
01e0ef26-9755-435d-94d8-93f0118d0c42	Support Officer	Junior	SS-03-USD	5	1040
f39bd03a-1e2a-4777-b825-002c17736e73	Support Officer	Junior	SS-04-EUR	9	1872
4cfa8832-534a-41cf-8669-ffa37ba3457b	Support Officer	Junior	SS-05-EUR	9	1872
ad5dc6bd-39a5-4115-b2f9-19aa0cc63916	Support Officer	Intern	SS-01-LYD	10	2080
24113181-076f-4aab-b9c9-cbbf0d320935	Support Officer	Intern	SS-02-USD	3	624
f50cb6d6-bf3c-4df4-b122-7d503dea128e	Support Officer	Intern	SS-03-USD	4	832
0a6cd10f-029d-4dfc-9016-8dc0d64a6660	Support Officer	Intern	SS-04-EUR	8	1664
bd756dc7-df79-4eae-8162-3877047ee5ec	Support Officer	Intern	SS-05-EUR	8	1664
0a3972da-adc8-4403-a1fb-b6772f7f7292	Support Officer	Trainee	SS-01-LYD	9	1872
6a1f0cc9-7dd9-4b4b-b457-543b58cf1dce	Support Officer	Trainee	SS-02-USD	1	208
9801cb83-f341-4777-a034-d7b6f7442542	Support Officer	Trainee	SS-03-USD	3	624
8001bb08-41aa-4bee-b8cf-4ff55f2518b9	Support Officer	Trainee	SS-04-EUR	7	1456
b41b2732-4c5e-4692-afb8-f39ab80ef85a	Support Officer	Trainee	SS-05-EUR	7	1456
\.


--
-- Data for Name: StaffTask; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."StaffTask" (id, "authorId", "assigneeId", "departmentId", title, content, deadline, priority, status, "createdAt", "updatedAt", category, "isReviewed") FROM stdin;
77377826-8082-4939-a64f-696bc152a85a	\N	\N	\N	go sleep	ggg	2026-04-01 00:00:00	CRITICAL	COMPLETED	2026-04-01 18:42:48.028	2026-08-01 18:12:37.003	ASSIGNED	f
df574450-0c1b-4065-bf48-ed5ccd1de5a2	\N	\N	ae4f1567-1325-4c24-92b4-170c0b8d05c1	nothing	nothing	\N	NORMAL	IN_PROGRESS	2026-05-05 20:08:52.753	2026-08-01 18:12:41.611	SELF_REPORT	f
f3af56d4-0e8a-42fb-abb1-5895d590ec22	\N	\N	ae4f1567-1325-4c24-92b4-170c0b8d05c1	hr system	almost done 	\N	NORMAL	IN_PROGRESS	2026-05-05 20:09:53.622	2026-08-01 18:45:30.358	SELF_REPORT	f
704c7811-5935-4070-a650-4f5c3661f759	\N	\N	ae4f1567-1325-4c24-92b4-170c0b8d05c1	ossd system	assetes	\N	NORMAL	COMPLETED	2026-05-05 20:09:39.026	2026-08-01 18:45:30.358	SELF_REPORT	t
\.


--
-- Data for Name: SupportTicket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SupportTicket" (id, "requesterId", title, description, category, priority, status, resolution, "createdAt", "updatedAt", "assigneeId", "estimatedReadyAt") FROM stdin;
\.


--
-- Data for Name: TimeRecord; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TimeRecord" (id, "employeeId", month, "assignedHours", "workedHours", "overtimeHours", absences, "lateMinutes", status, "updatedAt") FROM stdin;
\.


--
-- Data for Name: Unit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Unit" (id, name, "departmentId", headcount) FROM stdin;
\.


--
-- Data for Name: UnitEvaluation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UnitEvaluation" (id, "employeeId", month, "relColleagues", teamwork, "workOrg", "commSkills", "regCompliance", "taskQuality", "timeCommit", "orgCompliance", "probSolving", "pressureHandling", "contDev", "regAdherence", "safetyAdherence", appearance, "resPreservation", "dataPrivacy", "totalScore", comments, "submittedAt", "submittedById") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, password, "fullName", role, "departmentId", "groupId", "createdAt", "departmentIds", "unitId", permissions, signature) FROM stdin;
0368c34f-66e7-4fff-9fbb-ea892785c792	m.layyas@iph.com	$2a$10$U6NCbAh3PFLkLU04QGq8w.ugTSuhz.wHkEoC6M6U0pyKN6w2xcF6a	MUETAZS MOHAMMED LAYYAS	HEAD_DEPARTMENT	cb3076ba-2444-4a4b-aa4c-531791cac3e8	default-group-id	2026-08-12 19:28:54.197	{}	\N	{view_directory,view_employees,manage_leaves,manage_tasks,manage_announcements,manager_approvals,view_evaluations,view_recruitment,manage_recruitment}	\N
fe156c64-c6d6-4bdf-8c8d-105530165a0d	admin@iph.com	$2a$10$0GKFssbvz3yTs4atW4/uMOlv96KbC2GPduEAVDQg2XD2AvuIa9t5i	System Admin	SUPER_ADMIN			2026-03-24 18:38:54.879	{}	\N	{}	data:image/png;base64,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
0484aa74-4af7-4526-b357-8d5b3b9463aa	hrmanger@iph.com	$2a$10$F/tF3xteaSOpERhH13HBDuHTbyVCQwAQE3U6CZkJlXHAuyjpDWr5C	HR manger	HR_MANAGER	\N	\N	2026-08-01 19:06:11.639	{}	\N	{view_directory,view_employees,manage_employees,register_employees,edit_employees,view_recruitment,manage_recruitment,recruitment_approvals,view_contracts,manage_contract_management,view_lifecycle,manage_lifecycle_control,view_payroll,manage_payroll,view_time_tracking,manage_time_tracking,manage_leaves,manage_announcements,view_evaluations,view_hr_evaluations,manage_evaluation_control,manage_onboarding,manage_job_descriptions}	data:image/png;base64,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
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
214680d0-8cd2-4d35-8127-cf7e05592869	09226a4fbd865424d2626acc4e303a1c9169c2e9489f3751fe2cac30f460d617	2026-07-18 13:01:09.934263-07	20260718193000_prf_requisition		\N	2026-07-18 13:01:09.934263-07	0
25bd0324-9ee5-4810-9b4a-91e5dcc912d9	0501cea150ba50e1dce944fbe8c5c02e813fc7ebe86c5bb52d7ac847d6abe3cf	2026-03-26 14:17:11.601085-07	20260218091754_init	\N	\N	2026-03-26 14:17:11.557403-07	1
a66c2901-cb5e-4b8f-b340-2df333229721	cd71ad70b162d879f60edbea5bd6d1a23fa1817f66cb9cbd81ce10a469a3fd46	2026-03-26 14:17:11.775134-07	20260323193305_add_employee_position	\N	\N	2026-03-26 14:17:11.773126-07	1
e1573a35-5f8f-4c1c-9f12-35d678218965	c7b5f1f67d33a845f9390116498949a402a3e6e72afa7fb8a2d93b30acb07d15	2026-03-26 14:17:11.614047-07	20260218095915_add_payroll_result	\N	\N	2026-03-26 14:17:11.607857-07	1
fe1e6257-0c02-436d-9efe-c1e78c115fbb	b66f7c28d721edb24dd2cde9b5f5bb5f129f02e2f76deffae1fcc2ab4233615a	2026-03-26 14:17:11.62473-07	20260218103919_add_director_metrics	\N	\N	2026-03-26 14:17:11.621598-07	1
c1f9a24f-db7e-4eca-8aa4-e7468cf25491	613226dc5caa45f60be815b297cd2766b8355ddc0752aed2142528a6d5a329ea	2026-07-18 14:08:59.490774-07	20260718200000_prf_filled		\N	2026-07-18 14:08:59.490774-07	0
7c1873e9-7c3a-48f6-ad3a-6f348c96ebb4	215bbe21e43b86bdd845986545430a05c704e4c4b8e22895ef8bbf96ed1e1ab9	2026-03-26 14:17:11.641848-07	20260218140856_add_personnel_evaluation	\N	\N	2026-03-26 14:17:11.634081-07	1
82616b72-b11b-44aa-b79c-8bd11539c2ab	51ac2a465ee4f78e930430beab955f17e7ff3046af909ca2494264ac6145d0af	2026-03-26 14:17:11.787384-07	20260324182914_allow_user_deletion	\N	\N	2026-03-26 14:17:11.782718-07	1
7d28f102-d873-44cc-9078-17cab435069e	be631a0c0cbe1217d2198788bfca5ce861a23cf0d8f1327efdbe643358fe317f	2026-03-26 14:17:11.658012-07	20260221122658_add_cascading_deletes	\N	\N	2026-03-26 14:17:11.650053-07	1
78f253ec-af91-4bb8-a7b7-852ad0821183	0501cea150ba50e1dce944fbe8c5c02e813fc7ebe86c5bb52d7ac847d6abe3cf	2026-03-24 11:29:13.419241-07	20260218091754_init	\N	\N	2026-03-24 11:29:13.379804-07	1
058506d5-1f55-479a-a3f6-6390ec3da794	af2b36f890d93ba31a9d8b3ff512133fc61e7fab497d148fdf0e025858314547	2026-03-26 14:17:11.666058-07	20260222083645_add_employee_contracts	\N	\N	2026-03-26 14:17:11.664387-07	1
d58af08b-6866-4142-9379-f3f85d2ce13a	cd71ad70b162d879f60edbea5bd6d1a23fa1817f66cb9cbd81ce10a469a3fd46	2026-03-24 11:29:13.529121-07	20260323193305_add_employee_position	\N	\N	2026-03-24 11:29:13.525089-07	1
ad92f127-8e51-47c1-887c-869946ee2ad0	3e0ac11a0494cc1faa9187b77bb38cf826e6e69c0bf5e8ef76d4371bbce0f88c	2026-03-26 14:17:11.675625-07	20260222093155_add_holidays_used	\N	\N	2026-03-26 14:17:11.673346-07	1
de795f09-6b76-44c9-8964-16d9dac8008a	c7b5f1f67d33a845f9390116498949a402a3e6e72afa7fb8a2d93b30acb07d15	2026-03-24 11:29:13.426366-07	20260218095915_add_payroll_result	\N	\N	2026-03-24 11:29:13.420041-07	1
08dd757a-f794-42a7-b839-8325765a0b0b	11bbdd04621c58a8c064b03cee5bf66ca47b57ee26ac4d864af86c7ca39f69c3	2026-03-26 14:17:11.690812-07	20260224100641_allow_user_deletion	\N	\N	2026-03-26 14:17:11.684397-07	1
1b7851ad-8cd0-41d5-92a9-786c0f6e04da	b66f7c28d721edb24dd2cde9b5f5bb5f129f02e2f76deffae1fcc2ab4233615a	2026-03-24 11:29:13.433425-07	20260218103919_add_director_metrics	\N	\N	2026-03-24 11:29:13.427121-07	1
75428612-77fa-454a-90fc-952561be12ef	bf5ffc7bfd4b8a7ad483ed8680c719c94fafe0f11297ce343b2fa72f5de49a8b	2026-03-26 14:17:11.699307-07	20260224120459_add_department_ids	\N	\N	2026-03-26 14:17:11.697634-07	1
1a42343c-5ced-4a87-8828-aa1e6a42068a	215bbe21e43b86bdd845986545430a05c704e4c4b8e22895ef8bbf96ed1e1ab9	2026-03-24 11:29:13.444531-07	20260218140856_add_personnel_evaluation	\N	\N	2026-03-24 11:29:13.434343-07	1
1ba63182-1217-44f9-a6ed-f0cef334f445	ab5d2f8c8cd7fb0a8503812264fdd842279172d5538307a191c0364cc387fa5c	2026-03-26 14:17:11.729847-07	20260317215534_add_staff_hub_features	\N	\N	2026-03-26 14:17:11.707577-07	1
cddf865f-69f1-4ea8-9572-58c69f3de94d	51ac2a465ee4f78e930430beab955f17e7ff3046af909ca2494264ac6145d0af	2026-03-24 11:29:14.886712-07	20260324182914_allow_user_deletion	\N	\N	2026-03-24 11:29:14.851758-07	1
44e62819-cf2f-4842-bb14-a7dba4aa81a7	4e405cdad57e9172252c2d69f07b3702e75a89b846f5e6bc8edddfffbcb6b984	2026-03-26 14:17:11.739671-07	20260318171457_link_employee_user	\N	\N	2026-03-26 14:17:11.736068-07	1
781fdcf9-9faa-4af8-b2d1-9262edb46f36	be631a0c0cbe1217d2198788bfca5ce861a23cf0d8f1327efdbe643358fe317f	2026-03-24 11:29:13.454817-07	20260221122658_add_cascading_deletes	\N	\N	2026-03-24 11:29:13.445161-07	1
889449f3-5edb-4ba9-b2fd-9e69a4dd3628	e30b93bdf5bb428394972d16f2c0522aeb922a6db7fd1edc7c5e264a490ec8cb	2026-03-26 14:17:11.757921-07	20260318182640_unit_hierarchy	\N	\N	2026-03-26 14:17:11.747176-07	1
5688d281-9976-45ef-ab12-87a3c0a9cd7f	af2b36f890d93ba31a9d8b3ff512133fc61e7fab497d148fdf0e025858314547	2026-03-24 11:29:13.461029-07	20260222083645_add_employee_contracts	\N	\N	2026-03-24 11:29:13.455679-07	1
aa243b77-3449-4c0e-9411-f93053048c58	3b4d0b811f689f724a7bd17d78401a26e5123132f88f0876fe9270d0ea79ce0b	2026-03-26 14:17:11.76726-07	20260323182506_make_dept_optional	\N	\N	2026-03-26 14:17:11.764562-07	1
67daccbb-16cb-4119-bac3-b289628b3f18	3e0ac11a0494cc1faa9187b77bb38cf826e6e69c0bf5e8ef76d4371bbce0f88c	2026-03-24 11:29:13.465776-07	20260222093155_add_holidays_used	\N	\N	2026-03-24 11:29:13.461854-07	1
7ac7707b-4c99-4743-8a11-bba7178cb588	11bbdd04621c58a8c064b03cee5bf66ca47b57ee26ac4d864af86c7ca39f69c3	2026-03-24 11:29:13.478304-07	20260224100641_allow_user_deletion	\N	\N	2026-03-24 11:29:13.466324-07	1
42807e2a-1287-4ad0-b5ab-254cd2737e59	bf5ffc7bfd4b8a7ad483ed8680c719c94fafe0f11297ce343b2fa72f5de49a8b	2026-03-24 11:29:13.484565-07	20260224120459_add_department_ids	\N	\N	2026-03-24 11:29:13.478949-07	1
6ba1c46e-489a-44de-8465-e86e377c3cd3	ab5d2f8c8cd7fb0a8503812264fdd842279172d5538307a191c0364cc387fa5c	2026-03-24 11:29:13.504843-07	20260317215534_add_staff_hub_features	\N	\N	2026-03-24 11:29:13.485871-07	1
94c7fcab-a167-41fa-932d-bb8b8c0b86cc	4e405cdad57e9172252c2d69f07b3702e75a89b846f5e6bc8edddfffbcb6b984	2026-03-24 11:29:13.508343-07	20260318171457_link_employee_user	\N	\N	2026-03-24 11:29:13.505367-07	1
1ac38a2d-fd56-468c-88a8-621755c82c45	e30b93bdf5bb428394972d16f2c0522aeb922a6db7fd1edc7c5e264a490ec8cb	2026-03-24 11:29:13.521234-07	20260318182640_unit_hierarchy	\N	\N	2026-03-24 11:29:13.508834-07	1
26833075-1de3-47c0-8608-648204827549	3b4d0b811f689f724a7bd17d78401a26e5123132f88f0876fe9270d0ea79ce0b	2026-03-24 11:29:13.524521-07	20260323182506_make_dept_optional	\N	\N	2026-03-24 11:29:13.521815-07	1
08a8894d-9f46-4c7c-a753-4900c35e6f46	f4eae8c185d067575ae061bd3786a42ff76676d04f73c3af5d77d65545612300	2026-07-18 10:59:43.349751-07	20260718175919_add_job_description		\N	2026-07-18 10:59:43.349751-07	0
b2008eab-bd71-45ec-85f2-ddfa7018dc09	2169007d1727e42af20a6aa2960681303df14036a22636a9761438697e2f6ccc	2026-07-18 11:19:18.126737-07	20260718183000_add_job_description_categories		\N	2026-07-18 11:19:18.126737-07	0
a2197d53-4d8c-43f6-8eed-68fd86d3caf4	73f81a9ca0b9bea688f12cc535ba1cafbf8973905689eef17e3aaddab9a9461a	2026-07-18 11:26:33.173699-07	20260718184500_add_job_description_text		\N	2026-07-18 11:26:33.173699-07	0
cd564899-48a0-4e63-a555-3fe1d45a636d	b31a5d1897c642348804be4baab73c07a92982dbe568c22a6e827fcd6077c5c3	2026-07-18 12:11:51.939938-07	20260718190000_add_jd_sections		\N	2026-07-18 12:11:51.939938-07	0
1b1dab1e-eab6-48b0-8a7e-aa13b0f87668	d7b9e8ace1aebbf1139d804e7025a95656dc37faa6eee06f6826312caa5cc32e	2026-07-19 10:24:29.717332-07	20260719000000_add_candidate_pipeline		\N	2026-07-19 10:24:29.717332-07	0
6b1bed9e-c7c9-4ee2-b3a1-21e31b4ec530	1b903f2e7fe2ad0c3804a203e2fb95e44744a3cbfb94473b435e4d3695d193ea	2026-07-22 11:37:07.818978-07	20260722000000_add_requisition_quantity		\N	2026-07-22 11:37:07.818978-07	0
e9507ef1-4419-44b0-83a2-7bfdc5f374c0	c633092dda894650c05d36d82ac3ab3c479a9b450a73d76005c0d9b898583859	2026-07-22 11:49:36.108523-07	20260722010000_add_candidate_profile		\N	2026-07-22 11:49:36.108523-07	0
2730245b-6f6c-4da6-b467-eab48075d933	01ca77a4f39534d5f2bd6c49de88748b67f2dfe5756ae3c67d5aba659f49920c	2026-07-22 13:01:16.375851-07	20260722020000_add_candidate_offer_fields	\N	\N	2026-07-22 13:01:16.357718-07	1
1459622b-a5c2-488e-97f8-cd8d59ad98ec	1e772f7cc9aaf9e1178e649060f77a75a4bf4db6924f6c17d4aabfd880769b63	2026-07-22 14:14:20.781075-07	20260722030000_add_candidate_eval_criteria	\N	\N	2026-07-22 14:14:20.769177-07	1
7db72b60-ed81-4fcc-b3b0-74a6f8345ee9	e47b26d7554a4763bd3cbc82c8554a45ad0448eed6a6365847169384ccde7de3	2026-07-23 12:42:14.51188-07	20260722040000_add_recruitment_approval_dates	\N	\N	2026-07-23 12:42:14.490753-07	1
c382dd14-0b76-4ea2-a4da-8b131606c268	84f2072626e86815e517588ed15048182fe600a79ea291590b06ea9bd2952c3e	2026-07-26 13:28:37.412534-07	20260726000000_add_resident_and_offer_generated		\N	2026-07-26 13:28:37.412534-07	0
0682c7f6-8dc4-4d1c-8265-bce850585a06	27f7242ab817e8ad1d3150d0800d49a402c8f7c293c83d0ec21413996e7d1d5b	2026-08-04 11:40:59.44938-07	20260804000000_add_leave_request_attachment	\N	\N	2026-08-04 11:40:59.416101-07	1
304435e9-20cb-423c-baf3-c953ca62aca3	968042211eb80b901ce33ec8fe947a2ac88c2fa32d0811536ffd509fbe227b3a	2026-08-05 09:57:51.078066-07	20260804010000_add_leave_division_approval	\N	\N	2026-08-05 09:57:50.980069-07	1
85797f95-c2da-4ba0-859d-9818ab966729	57eec3a5121d35d768da17daf10f1a3de349efafedd3fc888727db0b626653c2	2026-08-05 09:57:51.094353-07	20260805000000_add_identity_details	\N	\N	2026-08-05 09:57:51.078866-07	1
b9406d57-5b64-494f-aa4b-4404f4a5d480	b4017bbe16a8735ce5a701d5b222c2d3a2ab2019622180ecb4d6a0949d7e6d65	2026-08-06 10:22:10.20873-07	20260806000000_add_careers_portal	\N	\N	2026-08-06 10:22:10.097592-07	1
203cc7f7-e91f-4506-b0b2-71f2cb0c85a5	be9947b743a468f6bb981e2408983df10304161e3ab9fa57c73bda915bb39e34	2026-08-06 11:16:02.086471-07	20260806010000_add_candidate_education	\N	\N	2026-08-06 11:16:02.077955-07	1
3b0f81cc-591d-43cb-bbf8-3b070a526550	acbe9e46da1aa40c18ba226a3cfd46c288607b9c012370a6b9e8fa831289cd1f	2026-08-06 11:40:25.690237-07	20260806020000_add_onboarding_link	\N	\N	2026-08-06 11:40:25.672361-07	1
874d701b-f05e-4c17-8d62-0298200a047f	24eb1cfaced060f1a238484967fe823cce9ec75d2dbfb6d416323b3aa3f879d6	2026-08-08 12:46:54.208188-07	20260808000000_add_user_signature	\N	\N	2026-08-08 12:46:54.193808-07	1
2c9eeb94-b4ae-4fe5-ab2d-39345edc4f5f	95061f406f3c6e2bb3b925bb5aea4d52871f23726280919668881b9d5439f952	2026-08-10 13:43:48.578671-07	20260810000000_add_prf_fields		\N	2026-08-10 13:43:48.578671-07	0
349a21fe-e7df-48ea-9c4e-52ae18c22f80	d7a6c7710fe0472143d4d93c6350cc4d3a292f92533f29a0253a89efd423222b	2026-08-10 14:06:08.733841-07	20260810010000_add_prf_reportsto		\N	2026-08-10 14:06:08.733841-07	0
d671acd8-0c8f-45ce-9b91-2f8fa4819ba2	f0247bfddbd5928a43cafa144955558b0debebf05da07bffb0269eb1fe2ced04	\N	20260809080200_add_missing_onboarding_fields	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260809080200_add_missing_onboarding_fields\n\nDatabase error code: 42701\n\nDatabase error:\nERROR: column "placeOfBirthArabic" of relation "Employee" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42701), message: "column \\"placeOfBirthArabic\\" of relation \\"Employee\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(7689), routine: Some("check_for_column_name_collision") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260809080200_add_missing_onboarding_fields"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20260809080200_add_missing_onboarding_fields"\n             at schema-engine\\core\\src\\commands\\apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:226	2026-08-11 16:57:01.614452-07	2026-08-10 13:42:45.784814-07	0
2d3ad276-8abd-4130-af72-eb3724a9a60a	f0247bfddbd5928a43cafa144955558b0debebf05da07bffb0269eb1fe2ced04	2026-08-11 16:57:01.635183-07	20260809080200_add_missing_onboarding_fields		\N	2026-08-11 16:57:01.635183-07	0
602ee22d-d2a3-471a-ac9c-c791250da223	077190042bf7b178ff23eaded8acbe8f09dd38eea62c7f6c4fb433c370db35d9	\N	20260809090000_drop_department_and_offer_fields	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260809090000_drop_department_and_offer_fields\n\nDatabase error code: 42703\n\nDatabase error:\nERROR: column "departmentName" of relation "Employee" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42703), message: "column \\"departmentName\\" of relation \\"Employee\\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(9322), routine: Some("ATExecDropColumn") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260809090000_drop_department_and_offer_fields"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20260809090000_drop_department_and_offer_fields"\n             at schema-engine\\core\\src\\commands\\apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:226	\N	2026-08-11 16:57:08.957819-07	0
46709b84-3de6-4192-b623-b248d5cd07fe	7cbc465cabf2d91e865e098f9a829841312c9c4c71e66787062a823e5641e63b	2026-08-12 12:08:41.172099-07	20260812120000_add_employee_enrollment_status		\N	2026-08-12 12:08:41.172099-07	0
\.


--
-- Name: Announcement Announcement_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY (id);


--
-- Name: AssetRequest AssetRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AssetRequest"
    ADD CONSTRAINT "AssetRequest_pkey" PRIMARY KEY (id);


--
-- Name: Candidate Candidate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Candidate"
    ADD CONSTRAINT "Candidate_pkey" PRIMARY KEY (id);


--
-- Name: ChairmanEvaluation ChairmanEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChairmanEvaluation"
    ADD CONSTRAINT "ChairmanEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: Contract Contract_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_pkey" PRIMARY KEY (id);


--
-- Name: DepartmentEvaluation DepartmentEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DepartmentEvaluation"
    ADD CONSTRAINT "DepartmentEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: DirectorEvaluation DirectorEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DirectorEvaluation"
    ADD CONSTRAINT "DirectorEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: Directorate Directorate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Directorate"
    ADD CONSTRAINT "Directorate_pkey" PRIMARY KEY (id);


--
-- Name: DivisionEvaluation DivisionEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DivisionEvaluation"
    ADD CONSTRAINT "DivisionEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: Division Division_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Division"
    ADD CONSTRAINT "Division_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeDocument EmployeeDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY (id);


--
-- Name: Employee Employee_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_pkey" PRIMARY KEY (id);


--
-- Name: EvaluationPeriod EvaluationPeriod_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EvaluationPeriod"
    ADD CONSTRAINT "EvaluationPeriod_pkey" PRIMARY KEY (id);


--
-- Name: GMEvaluation GMEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GMEvaluation"
    ADD CONSTRAINT "GMEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: Group Group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Group"
    ADD CONSTRAINT "Group_pkey" PRIMARY KEY (id);


--
-- Name: HREvaluation HREvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HREvaluation"
    ADD CONSTRAINT "HREvaluation_pkey" PRIMARY KEY (id);


--
-- Name: JobDescription JobDescription_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."JobDescription"
    ADD CONSTRAINT "JobDescription_pkey" PRIMARY KEY (id);


--
-- Name: LeaveApprovalStep LeaveApprovalStep_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveApprovalStep"
    ADD CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY (id);


--
-- Name: LeaveRequest LeaveRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: PayrollResult PayrollResult_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PayrollResult"
    ADD CONSTRAINT "PayrollResult_pkey" PRIMARY KEY (id);


--
-- Name: PersonnelEvaluation PersonnelEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PersonnelEvaluation"
    ADD CONSTRAINT "PersonnelEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: RecruitmentRequest RecruitmentRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_pkey" PRIMARY KEY (id);


--
-- Name: SalaryStructure SalaryStructure_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SalaryStructure"
    ADD CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY (id);


--
-- Name: StaffTask StaffTask_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StaffTask"
    ADD CONSTRAINT "StaffTask_pkey" PRIMARY KEY (id);


--
-- Name: SupportTicket SupportTicket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY (id);


--
-- Name: TimeRecord TimeRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TimeRecord"
    ADD CONSTRAINT "TimeRecord_pkey" PRIMARY KEY (id);


--
-- Name: UnitEvaluation UnitEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UnitEvaluation"
    ADD CONSTRAINT "UnitEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: Unit Unit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AssetRequest_employeeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AssetRequest_employeeId_idx" ON public."AssetRequest" USING btree ("employeeId");


--
-- Name: AssetRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AssetRequest_status_idx" ON public."AssetRequest" USING btree (status);


--
-- Name: Candidate_onboardingToken_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Candidate_onboardingToken_key" ON public."Candidate" USING btree ("onboardingToken");


--
-- Name: Candidate_requisitionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Candidate_requisitionId_idx" ON public."Candidate" USING btree ("requisitionId");


--
-- Name: Candidate_stage_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Candidate_stage_idx" ON public."Candidate" USING btree (stage);


--
-- Name: ChairmanEvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ChairmanEvaluation_employeeId_month_idx" ON public."ChairmanEvaluation" USING btree ("employeeId", month);


--
-- Name: Contract_employeeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Contract_employeeId_idx" ON public."Contract" USING btree ("employeeId");


--
-- Name: DepartmentEvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DepartmentEvaluation_employeeId_month_idx" ON public."DepartmentEvaluation" USING btree ("employeeId", month);


--
-- Name: DirectorEvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DirectorEvaluation_employeeId_month_idx" ON public."DirectorEvaluation" USING btree ("employeeId", month);


--
-- Name: DivisionEvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DivisionEvaluation_employeeId_month_idx" ON public."DivisionEvaluation" USING btree ("employeeId", month);


--
-- Name: EmployeeDocument_employeeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "EmployeeDocument_employeeId_idx" ON public."EmployeeDocument" USING btree ("employeeId");


--
-- Name: Employee_bioId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Employee_bioId_idx" ON public."Employee" USING btree ("bioId");


--
-- Name: Employee_departmentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Employee_departmentId_idx" ON public."Employee" USING btree ("departmentId");


--
-- Name: Employee_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Employee_email_key" ON public."Employee" USING btree (email);


--
-- Name: Employee_groupId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Employee_groupId_idx" ON public."Employee" USING btree ("groupId");


--
-- Name: Employee_jobDescriptionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Employee_jobDescriptionId_idx" ON public."Employee" USING btree ("jobDescriptionId");


--
-- Name: Employee_unitId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Employee_unitId_idx" ON public."Employee" USING btree ("unitId");


--
-- Name: Employee_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Employee_userId_key" ON public."Employee" USING btree ("userId");


--
-- Name: GMEvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "GMEvaluation_employeeId_month_idx" ON public."GMEvaluation" USING btree ("employeeId", month);


--
-- Name: HREvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "HREvaluation_employeeId_month_idx" ON public."HREvaluation" USING btree ("employeeId", month);


--
-- Name: JobDescription_departmentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "JobDescription_departmentId_idx" ON public."JobDescription" USING btree ("departmentId");


--
-- Name: JobDescription_directorateId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "JobDescription_directorateId_idx" ON public."JobDescription" USING btree ("directorateId");


--
-- Name: JobDescription_divisionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "JobDescription_divisionId_idx" ON public."JobDescription" USING btree ("divisionId");


--
-- Name: JobDescription_unitId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "JobDescription_unitId_idx" ON public."JobDescription" USING btree ("unitId");


--
-- Name: LeaveApprovalStep_approverUserId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveApprovalStep_approverUserId_status_idx" ON public."LeaveApprovalStep" USING btree ("approverUserId", status);


--
-- Name: LeaveApprovalStep_leaveRequestId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveApprovalStep_leaveRequestId_idx" ON public."LeaveApprovalStep" USING btree ("leaveRequestId");


--
-- Name: LeaveApprovalStep_leaveRequestId_sequence_approverUserId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "LeaveApprovalStep_leaveRequestId_sequence_approverUserId_key" ON public."LeaveApprovalStep" USING btree ("leaveRequestId", sequence, "approverUserId");


--
-- Name: LeaveRequest_employeeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveRequest_employeeId_idx" ON public."LeaveRequest" USING btree ("employeeId");


--
-- Name: LeaveRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveRequest_status_idx" ON public."LeaveRequest" USING btree (status);


--
-- Name: LeaveRequest_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LeaveRequest_userId_idx" ON public."LeaveRequest" USING btree ("userId");


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: PayrollResult_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PayrollResult_employeeId_month_idx" ON public."PayrollResult" USING btree ("employeeId", month);


--
-- Name: PersonnelEvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PersonnelEvaluation_employeeId_month_idx" ON public."PersonnelEvaluation" USING btree ("employeeId", month);


--
-- Name: RecruitmentRequest_publishedToCareers_filled_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RecruitmentRequest_publishedToCareers_filled_idx" ON public."RecruitmentRequest" USING btree ("publishedToCareers", filled);


--
-- Name: RecruitmentRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RecruitmentRequest_status_idx" ON public."RecruitmentRequest" USING btree (status);


--
-- Name: RecruitmentRequest_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RecruitmentRequest_type_idx" ON public."RecruitmentRequest" USING btree (type);


--
-- Name: SalaryStructure_jobCategory_jobGrade_structureLevel_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SalaryStructure_jobCategory_jobGrade_structureLevel_key" ON public."SalaryStructure" USING btree ("jobCategory", "jobGrade", "structureLevel");


--
-- Name: StaffTask_assigneeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "StaffTask_assigneeId_idx" ON public."StaffTask" USING btree ("assigneeId");


--
-- Name: StaffTask_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "StaffTask_category_idx" ON public."StaffTask" USING btree (category);


--
-- Name: StaffTask_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "StaffTask_status_idx" ON public."StaffTask" USING btree (status);


--
-- Name: SupportTicket_assigneeId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SupportTicket_assigneeId_idx" ON public."SupportTicket" USING btree ("assigneeId");


--
-- Name: SupportTicket_requesterId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SupportTicket_requesterId_idx" ON public."SupportTicket" USING btree ("requesterId");


--
-- Name: SupportTicket_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SupportTicket_status_idx" ON public."SupportTicket" USING btree (status);


--
-- Name: TimeRecord_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TimeRecord_employeeId_month_idx" ON public."TimeRecord" USING btree ("employeeId", month);


--
-- Name: UnitEvaluation_employeeId_month_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UnitEvaluation_employeeId_month_idx" ON public."UnitEvaluation" USING btree ("employeeId", month);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Announcement Announcement_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Announcement"
    ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AssetRequest AssetRequest_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AssetRequest"
    ADD CONSTRAINT "AssetRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssetRequest AssetRequest_requesterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AssetRequest"
    ADD CONSTRAINT "AssetRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Candidate Candidate_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Candidate"
    ADD CONSTRAINT "Candidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Candidate Candidate_hrEvalById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Candidate"
    ADD CONSTRAINT "Candidate_hrEvalById_fkey" FOREIGN KEY ("hrEvalById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Candidate Candidate_requisitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Candidate"
    ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES public."RecruitmentRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Candidate Candidate_screenById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Candidate"
    ADD CONSTRAINT "Candidate_screenById_fkey" FOREIGN KEY ("screenById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Candidate Candidate_techEvalById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Candidate"
    ADD CONSTRAINT "Candidate_techEvalById_fkey" FOREIGN KEY ("techEvalById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ChairmanEvaluation ChairmanEvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChairmanEvaluation"
    ADD CONSTRAINT "ChairmanEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChairmanEvaluation ChairmanEvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChairmanEvaluation"
    ADD CONSTRAINT "ChairmanEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contract Contract_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Contract"
    ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentEvaluation DepartmentEvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DepartmentEvaluation"
    ADD CONSTRAINT "DepartmentEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentEvaluation DepartmentEvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DepartmentEvaluation"
    ADD CONSTRAINT "DepartmentEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Department Department_divisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DirectorEvaluation DirectorEvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DirectorEvaluation"
    ADD CONSTRAINT "DirectorEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DirectorEvaluation DirectorEvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DirectorEvaluation"
    ADD CONSTRAINT "DirectorEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DivisionEvaluation DivisionEvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DivisionEvaluation"
    ADD CONSTRAINT "DivisionEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DivisionEvaluation DivisionEvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DivisionEvaluation"
    ADD CONSTRAINT "DivisionEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Division Division_directorateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Division"
    ADD CONSTRAINT "Division_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES public."Directorate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EmployeeDocument EmployeeDocument_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EmployeeDocument"
    ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Employee Employee_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_directorateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES public."Directorate"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_divisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."Group"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_jobDescriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES public."JobDescription"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Employee Employee_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EvaluationPeriod EvaluationPeriod_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EvaluationPeriod"
    ADD CONSTRAINT "EvaluationPeriod_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EvaluationPeriod EvaluationPeriod_enabledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EvaluationPeriod"
    ADD CONSTRAINT "EvaluationPeriod_enabledById_fkey" FOREIGN KEY ("enabledById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GMEvaluation GMEvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GMEvaluation"
    ADD CONSTRAINT "GMEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GMEvaluation GMEvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."GMEvaluation"
    ADD CONSTRAINT "GMEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: HREvaluation HREvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HREvaluation"
    ADD CONSTRAINT "HREvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HREvaluation HREvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HREvaluation"
    ADD CONSTRAINT "HREvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: JobDescription JobDescription_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."JobDescription"
    ADD CONSTRAINT "JobDescription_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: JobDescription JobDescription_directorateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."JobDescription"
    ADD CONSTRAINT "JobDescription_directorateId_fkey" FOREIGN KEY ("directorateId") REFERENCES public."Directorate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: JobDescription JobDescription_divisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."JobDescription"
    ADD CONSTRAINT "JobDescription_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: JobDescription JobDescription_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."JobDescription"
    ADD CONSTRAINT "JobDescription_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveApprovalStep LeaveApprovalStep_approverUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveApprovalStep"
    ADD CONSTRAINT "LeaveApprovalStep_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LeaveApprovalStep LeaveApprovalStep_leaveRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveApprovalStep"
    ADD CONSTRAINT "LeaveApprovalStep_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES public."LeaveRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveRequest LeaveRequest_deptApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_deptApprovedById_fkey" FOREIGN KEY ("deptApprovedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveRequest LeaveRequest_directorApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_directorApprovedById_fkey" FOREIGN KEY ("directorApprovedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveRequest LeaveRequest_divisionApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_divisionApprovedById_fkey" FOREIGN KEY ("divisionApprovedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveRequest LeaveRequest_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeaveRequest LeaveRequest_unitApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_unitApprovedById_fkey" FOREIGN KEY ("unitApprovedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveRequest LeaveRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PayrollResult PayrollResult_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PayrollResult"
    ADD CONSTRAINT "PayrollResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PersonnelEvaluation PersonnelEvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PersonnelEvaluation"
    ADD CONSTRAINT "PersonnelEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PersonnelEvaluation PersonnelEvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PersonnelEvaluation"
    ADD CONSTRAINT "PersonnelEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecruitmentRequest RecruitmentRequest_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecruitmentRequest RecruitmentRequest_deptApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_deptApprovedById_fkey" FOREIGN KEY ("deptApprovedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecruitmentRequest RecruitmentRequest_divisionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES public."Division"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecruitmentRequest RecruitmentRequest_gmApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_gmApprovedById_fkey" FOREIGN KEY ("gmApprovedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecruitmentRequest RecruitmentRequest_hrApprovedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_hrApprovedById_fkey" FOREIGN KEY ("hrApprovedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecruitmentRequest RecruitmentRequest_jobDescriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES public."JobDescription"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecruitmentRequest RecruitmentRequest_requesterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RecruitmentRequest RecruitmentRequest_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RecruitmentRequest"
    ADD CONSTRAINT "RecruitmentRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StaffTask StaffTask_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StaffTask"
    ADD CONSTRAINT "StaffTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StaffTask StaffTask_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StaffTask"
    ADD CONSTRAINT "StaffTask_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StaffTask StaffTask_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."StaffTask"
    ADD CONSTRAINT "StaffTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupportTicket SupportTicket_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupportTicket SupportTicket_requesterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SupportTicket"
    ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimeRecord TimeRecord_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TimeRecord"
    ADD CONSTRAINT "TimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UnitEvaluation UnitEvaluation_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UnitEvaluation"
    ADD CONSTRAINT "UnitEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."Employee"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UnitEvaluation UnitEvaluation_submittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UnitEvaluation"
    ADD CONSTRAINT "UnitEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Unit Unit_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict dU9wrmW2Tcf8sXlsb5K0aBypc2rxu1mdX6q58XDqcJpKig2zgJn2KDA8BDCEPEx

