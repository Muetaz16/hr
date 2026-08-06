--
-- PostgreSQL database dump
--

\restrict mAvVGo71a3t7xcrKyQWuAVfSj4cUl5hlYp96tB6jgaqSKvwOdgGVJ5rugzb5wQo

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
    "offerGeneratedAt" timestamp(3) without time zone
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
    "healthCertUrl" text
);


ALTER TABLE public."Employee" OWNER TO postgres;

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
    "gmApprovedAt" timestamp(3) without time zone
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
    permissions text[] DEFAULT ARRAY[]::text[]
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
eccc7402-3413-4cc3-808f-970885142b14	b835d53f-eace-4435-8993-db23fb760547	fe156c64-c6d6-4bdf-8c8d-105530165a0d	LAPTOP	PENDING	NORMAL	Automatically generated during employee registration.	2026-08-01 18:46:23.629	2026-08-01 18:46:23.629
e3f8b0ef-7ed1-4066-b497-e7f41a1a46f1	a936aacc-8fe3-49b5-b14f-a956b1821be6	fe156c64-c6d6-4bdf-8c8d-105530165a0d	LAPTOP	PENDING	NORMAL	Automatically generated during employee registration.	2026-08-01 18:47:52.765	2026-08-01 18:47:52.765
\.


--
-- Data for Name: Candidate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Candidate" (id, "requisitionId", "fullName", phone, email, "cvPath", stage, "screenDecision", "screenNote", "screenById", "screenAt", "interviewAt", "interviewLocation", "interviewNote", "hrScore", "hrRecommend", "hrNote", "hrEvalById", "hrEvalAt", "techScore", "techRecommend", "techNote", "techEvalById", "techEvalAt", "finalDecision", "finalNote", "offerDecision", "offerNote", "offerAt", "employeeId", "createdById", "createdAt", "updatedAt", source, "degreePath", "portfolioPath", speciality, "yearsExperience", "salaryExpectation", nationality, "dateOfBirth", "placeOfLiving", "salaryStructure", "jobGrade", "placeOfWork", "contractMonths", "hrCriteria", "techCriteria", "residentStatus", "offerGeneratedAt") FROM stdin;
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
17dbc9f7-1f91-4205-80b4-91b63041c55e	b835d53f-eace-4435-8993-db23fb760547	1st	2026-08-01 00:00:00	\N	NONE RESDANT	ACTIVE	3432	Initial contract created during registration.	\N	2026-08-01 18:46:23.632	2026-08-01 18:46:23.632	0	0	\N	\N	\N	0
8900102e-2c7c-4f0f-bf10-de90a9fe7322	a936aacc-8fe3-49b5-b14f-a956b1821be6	1st	2026-08-01 00:00:00	\N	Limited	ACTIVE	4368	Initial contract created during registration.	\N	2026-08-01 18:47:52.766	2026-08-01 18:47:52.766	0	0	\N	\N	\N	0
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

COPY public."Employee" (id, "fullName", email, role, "departmentId", "groupId", "baseSalary", "joinDate", "staffId", "contractEndDate", "contractStartDate", "contractStatus", "contractType", "holidaysUsed", "bonusHolidays", "userId", "unitId", "position", "contractNumber", "emergencyHolidaysUsed", "fullNameArabic", "jobCategory", "jobGrade", nationality, "passportNumber", "unpaidHolidaysUsed", "accruedHolidays", "bonusEmergencyHolidays", "earnedHolidays", "remainingHolidays", "positionFactor", "roleCategory", "siteFactor", "skillFactor", "languageFactor", "divisionId", "directorateId", "evaluationPoints", "promotionNotified", "salaryStructureType", "jobDescriptionId", "placeOfWork", "dateOfBirth", "placeOfBirth", "nationalId", "academicQualification", gender, "bloodType", "idCardNumber", "idPlaceOfIssue", "idIssueDate", "passportPlaceOfIssue", "passportExpiryDate", "drivingLicenseType", "drivingLicenseNumber", "drivingLicenseExpiry", "drivingLicensePlaceOfIssue", "personalPhone", "personalEmail", "emergencyContactNumber", "residentialAddress", "workedBefore", "hasRelativesInCompany", "relativesNames", "bankName", "bankBranchName", "bankAccountNumber", "arrivalDate", "cvUrl", "degreeUrl", "birthCertUrl", "passportCopyUrl", "bankCheckUrl", "photoUrl", "idCardUrl", "jobOfferUrl", "healthCertUrl") FROM stdin;
a936aacc-8fe3-49b5-b14f-a956b1821be6	ezoo depa	e.depa@iph.com	HEAD_DEPARTMENT	cb3076ba-2444-4a4b-aa4c-531791cac3e8	default-group-id	4368	2026-08-01 00:00:00	\N	\N	2026-08-01 00:00:00	Active	Limited	0	0	31d4f769-6c31-4ad5-ba75-7696c7fb7179	\N	Head of DTD	1st	0	نتصيلاثاسبل	Engineer	Junior	\N	kjbesrf	0	0	0	0	0	1.4	Support	1	1	1	240f7e0e-c5a1-4635-bd96-3d4098d9a502	1032142f-abdb-4596-a9ce-5b971da067a7	0	f	SS-01-LYD	a771b019-cc67-46ae-a438-603a16e4ea5a	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b835d53f-eace-4435-8993-db23fb760547	thea thea	t.thea@iph.com	HEAD_DIVISION	\N	\N	3432	2026-08-01 00:00:00	IPH-326-001	\N	2026-08-01 00:00:00	Active	NONE RESDANT	4	0	ad0c4366-5e13-4268-808e-8236c7dbcbf9	\N	Head of Division EDD	1st	1	نتالمعغت 	Engineer	Lead	\N	kjsdfgh	0	0	0	0	0	1.5	Support	1	1	1	240f7e0e-c5a1-4635-bd96-3d4098d9a502	\N	0	f	SS-04-EUR	5bd35e2b-8d36-442e-a357-d7835463c8dd	OFFICE	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
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
33d59ca1-671e-4ef8-824d-9df9ff8777cc	ad0c4366-5e13-4268-808e-8236c7dbcbf9	New requisition to review	ezoo depa raised a hire requisition (ERP) needing your approval.	/recruitment/approvals	f	2026-08-01 19:29:36.133
51850dcb-8061-4c6c-b99c-1b53b3dcdabf	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition advanced	Your requisition "ERP" was approved by the Head of Division and is now with HR.	/recruitment/requests	f	2026-08-01 19:29:49.398
663f506f-ed33-4853-b97e-58025d3449f5	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-01 19:29:49.4
b5c7366b-ddd4-4969-a12c-fbd590d05587	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition approved	Your requisition "ERP" is fully approved.	/recruitment/requests	f	2026-08-01 19:30:02.861
5ac6bf24-8306-436e-a331-54e7bf3fc068	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-01 19:30:02.863
7ca4fd70-bd0c-4ba5-964b-c9650cdf3f70	ad0c4366-5e13-4268-808e-8236c7dbcbf9	New requisition to review	ezoo depa raised a JD change requisition (esra) needing your approval.	/recruitment/approvals	t	2026-08-01 20:29:51.826
13378bc8-bb94-40e7-946d-dd2d010dba38	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition advanced	Your requisition "esra" was approved by the Head of Division and is now with HR.	/recruitment/requests	f	2026-08-01 20:46:12.434
43bd1bd9-0409-4462-ac75-9a3bff9cd0ab	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-01 20:46:12.436
dc75bfc2-302f-42fa-b915-421ff752b00c	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition advanced	Your JD change "esra" was approved by HR and is now with the GM / Directorate Head.	/recruitment/requests	f	2026-08-01 20:46:26.859
334724b1-f9d6-43b3-b1a4-31be38d29679	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition approved	Your requisition "esra" is fully approved.	/recruitment/requests	f	2026-08-01 20:46:37.043
1e50cdbe-65eb-46bb-9a9b-b525c0623a4c	ad0c4366-5e13-4268-808e-8236c7dbcbf9	New requisition to review	ezoo depa raised a hire requisition (esra) needing your approval.	/recruitment/approvals	f	2026-08-01 20:47:28.443
ee8765e4-c042-4f1d-875b-e3d818217dd2	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition advanced	Your requisition "esra" was approved by the Head of Division and is now with HR.	/recruitment/requests	f	2026-08-01 20:47:54.337
5f8954f0-38ae-488d-96d2-13bb0bd8605f	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-01 20:47:54.338
0336d067-256c-4ff2-b7b6-870efb1f5e46	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Position ready to source	"esra" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-01 20:48:08.873
fc232fc5-1c18-4908-9ab8-da592893c194	ad0c4366-5e13-4268-808e-8236c7dbcbf9	New requisition to review	System Admin raised a hire requisition (esra) needing your approval.	/recruitment/approvals	f	2026-08-01 20:49:16.937
378370c9-fc3f-4271-a30f-a5a08e389285	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-01 20:49:19.949
58f94eb0-7b39-4fa4-a6ee-19a6ba82ac46	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Position ready to source	"esra" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-01 20:49:22.08
0869b712-256b-448d-ae09-b5a0bd08caac	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition approved	Your requisition "esra" is fully approved.	/recruitment/requests	t	2026-08-01 20:48:08.872
33626828-a054-4f09-9f9d-e294e3fdb482	ad0c4366-5e13-4268-808e-8236c7dbcbf9	New requisition to review	ezoo depa raised a hire requisition (esra) needing your approval.	/recruitment/approvals	f	2026-08-01 20:50:58.761
8806c509-1227-45d6-bba2-c7ec6ce0b1e8	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition advanced	Your requisition "esra" was approved by the Head of Division and is now with HR.	/recruitment/requests	f	2026-08-01 20:51:37.028
ea93b5b2-fd9c-4213-8405-474758b3bca4	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Requisition awaiting HR	"esra" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-01 20:51:37.031
28067ce8-da87-4c1f-907c-5b38cc9ffb22	31d4f769-6c31-4ad5-ba75-7696c7fb7179	Requisition approved	Your requisition "esra" is fully approved.	/recruitment/requests	f	2026-08-01 20:51:56.537
ea7aa36b-8539-4433-89f8-0fad15e4a42a	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Position ready to source	"esra" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-01 20:51:56.538
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
d86f79a5-e3b6-4d37-9228-a322ab93e301	ad0c4366-5e13-4268-808e-8236c7dbcbf9	New requisition to review	System Admin raised a hire requisition (ERP) needing your approval.	/recruitment/approvals	f	2026-08-05 19:17:01.678
2851420d-67ec-4062-981e-b0b4ec1dd3bc	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition advanced	Your requisition "ERP" was approved by the Head of Division and is now with HR.	/recruitment/requests	f	2026-08-05 19:17:24.932
3f8575ea-17ef-4f49-9391-78dea60a28ba	0484aa74-4af7-4526-b357-8d5b3b9463aa	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-05 19:17:24.935
5f3fbb16-f5ae-4f42-9a39-c93e370fecb6	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Requisition awaiting HR	"ERP" was approved by the Head of Division and needs HR review.	/recruitment/approvals	f	2026-08-05 19:17:24.935
92e3c2f9-8db1-40e7-81a3-5fbea4bdc8e8	fe156c64-c6d6-4bdf-8c8d-105530165a0d	Requisition approved	Your requisition "ERP" is fully approved.	/recruitment/requests	f	2026-08-05 19:17:27.122
793848e2-2ecb-49ac-be88-3e79494612ad	0484aa74-4af7-4526-b357-8d5b3b9463aa	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-05 19:17:27.124
e8bd395b-f5e9-4117-aac4-3cfa97603361	e0c18189-53ee-43b4-8b14-fe2e279a9c2d	Position ready to source	"ERP" is approved — you can start sourcing candidates.	/recruitment/hiring	f	2026-08-05 19:17:27.124
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

COPY public."RecruitmentRequest" (id, "requesterId", "unitId", "departmentId", "jobTitle", reason, status, "hrNote", "gmNote", "hrApprovedById", "gmApprovedById", "createdAt", "updatedAt", "deptApprovedById", "deptNote", "divisionId", "jdPayload", "jobDescriptionId", type, filled, "filledAt", quantity, "deptApprovedAt", "hrApprovedAt", "gmApprovedAt") FROM stdin;
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
6c090a52-7905-40b4-8888-cfeccb88a8ce	ad0c4366-5e13-4268-808e-8236c7dbcbf9	New Account: thea thea	System account for thea thea (t.thea@iph.com) has been created. Role: HEAD_DIVISION. Please verify permissions and provide initial training.	IT	HIGH	OPEN	\N	2026-08-01 18:46:23.631	2026-08-01 18:46:23.631	\N	\N
7e3f23f9-c4d9-43b5-86bf-64ab4d3d5758	31d4f769-6c31-4ad5-ba75-7696c7fb7179	New Account: ezoo depa	System account for ezoo depa (e.depa@iph.com) has been created. Role: HEAD_DEPARTMENT. Please verify permissions and provide initial training.	IT	HIGH	OPEN	\N	2026-08-01 18:47:52.765	2026-08-01 18:47:52.765	\N	\N
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

COPY public."User" (id, email, password, "fullName", role, "departmentId", "groupId", "createdAt", "departmentIds", "unitId", permissions) FROM stdin;
e0c18189-53ee-43b4-8b14-fe2e279a9c2d	recruitment@iph.com	$2a$10$4dcPlKzLhNm/44O1BqdHX.NG3ANiEv1cypF4vyxorvFLPRJjm.H2K	recruitment	HR_MANAGER	\N	\N	2026-08-01 19:07:07.953	{}	\N	{view_recruitment,manage_recruitment,recruitment_approvals,manage_job_descriptions}
0484aa74-4af7-4526-b357-8d5b3b9463aa	hrmanger@iph.com	$2a$10$FSoOyniaEzcR3wNTeyG25Ou6FFbPAy565aVXBPwRXUQi82x06qpym	HR manger	HR_MANAGER	\N	\N	2026-08-01 19:06:11.639	{}	\N	{view_directory,view_employees,manage_employees,register_employees,edit_employees,view_recruitment,manage_recruitment,recruitment_approvals,view_contracts,manage_contract_management,view_lifecycle,manage_lifecycle_control,view_payroll,manage_payroll,view_time_tracking,manage_time_tracking,manage_leaves,manage_announcements,view_evaluations,view_hr_evaluations,manage_evaluation_control,manage_onboarding,manage_job_descriptions}
31d4f769-6c31-4ad5-ba75-7696c7fb7179	head.depa@iph.com	$2a$10$sI/15eqeSCSVr6kk5.3/x.QEuoBCSe9H5Jqwu.pr1zZCrU.r63VGe	ezoo depa	HEAD_DEPARTMENT	cb3076ba-2444-4a4b-aa4c-531791cac3e8	default-group-id	2026-08-01 18:47:52.758	{}	\N	{view_directory,view_employees,manage_leaves,manage_tasks,manage_announcements,manager_approvals,view_evaluations,view_recruitment,manage_recruitment}
ad0c4366-5e13-4268-808e-8236c7dbcbf9	divisin.thea@iph.com	$2a$10$7MFubyMfiPLFBXuaFZOi7Ojc1aLBK2Cp8IGs8JeBLaKbaMOi6EaRe	thea thea	HEAD_DIVISION	\N	\N	2026-08-01 18:46:23.612	{}	\N	{view_recruitment,manage_recruitment,recruitment_approvals}
fe156c64-c6d6-4bdf-8c8d-105530165a0d	admin@iph.com	$2a$10$0GKFssbvz3yTs4atW4/uMOlv96KbC2GPduEAVDQg2XD2AvuIa9t5i	System Admin	SUPER_ADMIN			2026-03-24 18:38:54.879	{}	\N	{}
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

\unrestrict mAvVGo71a3t7xcrKyQWuAVfSj4cUl5hlYp96tB6jgaqSKvwOdgGVJ5rugzb5wQo

