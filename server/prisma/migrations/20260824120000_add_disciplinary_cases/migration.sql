-- Adds the real Disciplinary Actions case-management feature: a single evolving
-- DisciplinaryCase record per case (mirrors PersonnelActionForm's shape) plus a child
-- DisciplinaryEvidence table for arbitrarily-many evidence/witness-statement files per case.

CREATE TABLE "DisciplinaryCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    "source" TEXT NOT NULL DEFAULT 'EMPLOYEE_REPORT',
    "reportedById" TEXT,
    "incidentDate" TIMESTAMP(3),
    "incidentDescription" TEXT,
    "violationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "offenseNumber" INTEGER NOT NULL DEFAULT 1,
    "incidentReportUrl" TEXT,
    "incidentReportName" TEXT,
    "generalizedAt" TIMESTAMP(3),
    "generalizedById" TEXT,
    "archivedIncidentAt" TIMESTAMP(3),

    "noticeToExplainIssuedAt" TIMESTAMP(3),
    "noticeToExplainById" TEXT,
    "noticeToExplainUrl" TEXT,
    "noticeToExplainName" TEXT,
    "explanationReceivedAt" TIMESTAMP(3),
    "explanationResponseUrl" TEXT,
    "explanationResponseName" TEXT,
    "noticeToExplainArchivedAt" TIMESTAMP(3),

    "investigationStartedAt" TIMESTAMP(3),
    "investigationStartedById" TEXT,
    "investigationResult" TEXT,
    "investigationResultUrl" TEXT,
    "investigationResultName" TEXT,
    "panelReviewRequired" BOOLEAN,
    "panelRecommendation" TEXT,
    "panelRecommendedAction" TEXT,
    "panelDecidedAt" TIMESTAMP(3),
    "panelDecidedByName" TEXT,
    "headHrApprovedAt" TIMESTAMP(3),
    "headHrApprovedById" TEXT,
    "gmApprovedAt" TIMESTAMP(3),
    "gmApprovedById" TEXT,
    "investigationArchivedAt" TIMESTAMP(3),

    "actionType" TEXT,
    "actionIssuedAt" TIMESTAMP(3),
    "actionIssuedById" TEXT,
    "actionNoticeUrl" TEXT,
    "actionNoticeName" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "actionArchivedAt" TIMESTAMP(3),

    "stage" TEXT NOT NULL DEFAULT 'REPORTED',
    "closedAt" TIMESTAMP(3),

    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinaryEvidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplinaryEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisciplinaryCase_employeeId_idx" ON "DisciplinaryCase"("employeeId");
CREATE INDEX "DisciplinaryCase_stage_idx" ON "DisciplinaryCase"("stage");
CREATE INDEX "DisciplinaryCase_source_idx" ON "DisciplinaryCase"("source");
CREATE INDEX "DisciplinaryCase_violationId_idx" ON "DisciplinaryCase"("violationId");
CREATE INDEX "DisciplinaryEvidence_caseId_idx" ON "DisciplinaryEvidence"("caseId");

ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_generalizedById_fkey" FOREIGN KEY ("generalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_noticeToExplainById_fkey" FOREIGN KEY ("noticeToExplainById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_investigationStartedById_fkey" FOREIGN KEY ("investigationStartedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_headHrApprovedById_fkey" FOREIGN KEY ("headHrApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_gmApprovedById_fkey" FOREIGN KEY ("gmApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_actionIssuedById_fkey" FOREIGN KEY ("actionIssuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryEvidence" ADD CONSTRAINT "DisciplinaryEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
