-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "plannedCount" INTEGER NOT NULL DEFAULT 1,
    "directorateId" TEXT,
    "divisionId" TEXT,
    "departmentId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "jobDescriptionId" TEXT;

-- CreateIndex
CREATE INDEX "JobDescription_directorateId_idx" ON "JobDescription"("directorateId");

-- CreateIndex
CREATE INDEX "JobDescription_divisionId_idx" ON "JobDescription"("divisionId");

-- CreateIndex
CREATE INDEX "JobDescription_departmentId_idx" ON "JobDescription"("departmentId");

-- CreateIndex
CREATE INDEX "JobDescription_unitId_idx" ON "JobDescription"("unitId");

-- CreateIndex
CREATE INDEX "Employee_jobDescriptionId_idx" ON "Employee"("jobDescriptionId");

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
