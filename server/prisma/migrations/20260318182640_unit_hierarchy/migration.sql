-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "deptApprovedById" TEXT,
ADD COLUMN     "directorApprovedById" TEXT,
ADD COLUMN     "unitApprovedById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "unitId" TEXT;

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitEvaluation" ADD CONSTRAINT "UnitEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitEvaluation" ADD CONSTRAINT "UnitEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_unitApprovedById_fkey" FOREIGN KEY ("unitApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_deptApprovedById_fkey" FOREIGN KEY ("deptApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_directorApprovedById_fkey" FOREIGN KEY ("directorApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
