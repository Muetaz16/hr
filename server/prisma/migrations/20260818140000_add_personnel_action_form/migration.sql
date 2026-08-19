-- CreateTable
CREATE TABLE IF NOT EXISTS "PersonnelActionForm" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'TRANSFER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentDivision" TEXT,
    "currentDepartment" TEXT,
    "currentUnit" TEXT,
    "currentPosition" TEXT,
    "currentJobCategory" TEXT,
    "currentJobGrade" TEXT,
    "currentPlaceOfWork" TEXT,
    "newJobDescriptionId" TEXT,
    "newDivisionId" TEXT,
    "newDepartmentId" TEXT,
    "newUnitId" TEXT,
    "newPositionTitle" TEXT,
    "newJobCategory" TEXT,
    "newJobGrade" TEXT,
    "newPlaceOfWork" TEXT,
    "reportsTo" TEXT,
    "typeOfTransfer" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "justification" TEXT,
    "documentUrl" TEXT,
    "documentName" TEXT,
    "createdByName" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonnelActionForm_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PersonnelActionForm_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonnelActionForm_employeeId_idx" ON "PersonnelActionForm"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonnelActionForm_status_idx" ON "PersonnelActionForm"("status");
