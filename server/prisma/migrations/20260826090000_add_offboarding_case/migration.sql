-- Adds the real Offboarding module (replaces the mockup tab): a single evolving
-- OffboardingCase per case, same evolving-record shape as DisciplinaryCase — each stage is one
-- generate-form -> collect signature(s) -> upload-signed-copy -> advance cycle. Also adds
-- Employee.separationDate, set when a case closes.

ALTER TABLE "Employee" ADD COLUMN "separationDate" TIMESTAMP(3);

CREATE TABLE "OffboardingCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,

    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "linkedDisciplinaryCaseId" TEXT,
    "reason" TEXT,

    "stage" TEXT NOT NULL DEFAULT 'RESIGNATION_REQUEST',

    "resignationFiledAt" TIMESTAMP(3),
    "resignationReason" TEXT,
    "resignationEffectiveDate" TIMESTAMP(3),
    "resignationLetterUrl" TEXT,
    "resignationDocumentUrl" TEXT,
    "resignationDocumentName" TEXT,
    "resignationCompletedAt" TIMESTAMP(3),
    "finalWorkingDate" TIMESTAMP(3),

    "dateOfSeparation" TIMESTAMP(3),
    "clearanceDocumentUrl" TEXT,
    "clearanceDocumentName" TEXT,
    "clearanceCompletedAt" TIMESTAMP(3),

    "exitInterviewSubmittedAt" TIMESTAMP(3),
    "exitInterviewReason" TEXT,
    "exitInterviewFeedback" TEXT,
    "exitInterviewWouldRecommend" BOOLEAN,
    "exitInterviewRating" INTEGER,

    "separationDocumentUrl" TEXT,
    "separationDocumentName" TEXT,
    "separationCompletedAt" TIMESTAMP(3),

    "certificateIssuedAt" TIMESTAMP(3),
    "certificateDocumentUrl" TEXT,

    "closedAt" TIMESTAMP(3),

    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffboardingCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OffboardingCase_caseNumber_key" ON "OffboardingCase"("caseNumber");
CREATE INDEX "OffboardingCase_employeeId_idx" ON "OffboardingCase"("employeeId");
CREATE INDEX "OffboardingCase_stage_idx" ON "OffboardingCase"("stage");

ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
