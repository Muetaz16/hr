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
    "personnelScore" DOUBLE PRECISION,
    "personnelDeductionDays" DOUBLE PRECISION,
    "personnelBonusDays" DOUBLE PRECISION,
    "trainingSummary" TEXT,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "finalSalary" DOUBLE PRECISION NOT NULL,
    "csvGenerated" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PayrollResult" ADD CONSTRAINT "PayrollResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
