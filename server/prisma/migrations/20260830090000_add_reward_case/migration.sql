ALTER TABLE "Employee" ADD COLUMN "usesCompanyTransportation" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RewardCase" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT,
    "milestoneYears" INTEGER,
    "milestoneDate" TIMESTAMP(3),
    "finalScoreSnapshot" DOUBLE PRECISION,
    "notes" TEXT,
    "bonusLeaveDaysGranted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusPercent" DOUBLE PRECISION,
    "physicalRewardFulfilledAt" TIMESTAMP(3),
    "physicalRewardNote" TEXT,
    "appreciationLetterUrl" TEXT,
    "appreciationLetterName" TEXT,
    "appreciationLetterIssuedAt" TIMESTAMP(3),
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RewardCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardCase_caseNumber_key" ON "RewardCase"("caseNumber");
CREATE UNIQUE INDEX "RewardCase_employeeId_type_period_key" ON "RewardCase"("employeeId", "type", "period");
CREATE UNIQUE INDEX "RewardCase_employeeId_type_milestoneYears_key" ON "RewardCase"("employeeId", "type", "milestoneYears");
CREATE INDEX "RewardCase_employeeId_idx" ON "RewardCase"("employeeId");
CREATE INDEX "RewardCase_type_idx" ON "RewardCase"("type");

ALTER TABLE "RewardCase" ADD CONSTRAINT "RewardCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
