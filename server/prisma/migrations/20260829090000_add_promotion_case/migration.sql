-- Promotions module: tenure-tracking field on Employee + the PromotionCase model.

ALTER TABLE "Employee" ADD COLUMN "currentGradeSince" TIMESTAMP(3);
UPDATE "Employee" SET "currentGradeSince" = COALESCE("contractStartDate", "joinDate");

CREATE TABLE "PromotionCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "isExceptional" BOOLEAN NOT NULL DEFAULT false,
    "toGrade" TEXT NOT NULL,
    "basis" TEXT,
    "reason" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "newJobTitle" TEXT,
    "newJobCategory" TEXT,
    "performanceMarch" TEXT,
    "performanceApril" TEXT,
    "performanceMay" TEXT,
    "overallPerformanceRating" TEXT,
    "promotionReportDocumentUrl" TEXT,
    "promotionReportDocumentName" TEXT,
    "promotionReportCompletedAt" TIMESTAMP(3),
    "stage" TEXT NOT NULL DEFAULT 'PROMOTION_REPORT',
    "noticeOfPromotionDocumentUrl" TEXT,
    "noticeOfPromotionDocumentName" TEXT,
    "noticeOfPromotionCompletedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionCase_caseNumber_key" ON "PromotionCase"("caseNumber");
CREATE INDEX "PromotionCase_employeeId_idx" ON "PromotionCase"("employeeId");
CREATE INDEX "PromotionCase_stage_idx" ON "PromotionCase"("stage");

ALTER TABLE "PromotionCase" ADD CONSTRAINT "PromotionCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
