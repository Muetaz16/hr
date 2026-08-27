-- Replaces the first-cut DisciplinaryCase shape (10 stages + separate Panel/Head-of-HR/GM
-- approval gates) with the real 4-stage process confirmed against the official .docx templates:
-- each stage is one generate-form -> collect signature(s) -> upload-signed-copy -> advance cycle.
-- The table has no real data yet (only smoke-test rows, already deleted), so drop and recreate
-- rather than a long ALTER chain. DisciplinaryEvidence is untouched (dropped/recreated only
-- because it FKs to DisciplinaryCase).

DROP TABLE IF EXISTS "DisciplinaryEvidence";
DROP TABLE IF EXISTS "DisciplinaryCase";

CREATE TABLE "DisciplinaryCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,

    "source" TEXT NOT NULL DEFAULT 'EMPLOYEE_REPORT',
    "reportedById" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,

    "incidentDate" TIMESTAMP(3),
    "incidentPlace" TEXT,
    "incidentDescription" TEXT,
    "violationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "offenseNumber" INTEGER,

    "stage" TEXT NOT NULL DEFAULT 'INCIDENT_REPORT',

    "incidentReportDocumentUrl" TEXT,
    "incidentReportDocumentName" TEXT,
    "incidentReportCompletedAt" TIMESTAMP(3),
    "incidentReportCompletedById" TEXT,

    "noticeToExplainDescription" TEXT,
    "noticeToExplainDocumentUrl" TEXT,
    "noticeToExplainDocumentName" TEXT,
    "noticeToExplainCompletedAt" TIMESTAMP(3),
    "noticeToExplainCompletedById" TEXT,

    "investigationOutcome" TEXT,
    "investigationResult" TEXT,
    "investigationRecommendation" TEXT,
    "investigationActionTaken" TEXT,
    "investigationDocumentUrl" TEXT,
    "investigationDocumentName" TEXT,
    "investigationCompletedAt" TIMESTAMP(3),
    "investigationCompletedById" TEXT,

    "actionType" TEXT,
    "actionEffectiveDate" TIMESTAMP(3),
    "actionAdditionalInfo" TEXT,
    "actionDocumentUrl" TEXT,
    "actionDocumentName" TEXT,
    "actionCompletedAt" TIMESTAMP(3),
    "actionCompletedById" TEXT,

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

CREATE UNIQUE INDEX "DisciplinaryCase_caseNumber_key" ON "DisciplinaryCase"("caseNumber");
CREATE INDEX "DisciplinaryCase_employeeId_idx" ON "DisciplinaryCase"("employeeId");
CREATE INDEX "DisciplinaryCase_stage_idx" ON "DisciplinaryCase"("stage");
CREATE INDEX "DisciplinaryCase_source_idx" ON "DisciplinaryCase"("source");
CREATE INDEX "DisciplinaryCase_violationId_idx" ON "DisciplinaryCase"("violationId");
CREATE INDEX "DisciplinaryEvidence_caseId_idx" ON "DisciplinaryEvidence"("caseId");

ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_incidentReportCompletedById_fkey" FOREIGN KEY ("incidentReportCompletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_noticeToExplainCompletedById_fkey" FOREIGN KEY ("noticeToExplainCompletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_investigationCompletedById_fkey" FOREIGN KEY ("investigationCompletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_actionCompletedById_fkey" FOREIGN KEY ("actionCompletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryEvidence" ADD CONSTRAINT "DisciplinaryEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
