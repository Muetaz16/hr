-- CreateTable
CREATE TABLE "PersonnelEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "warningMessages" INTEGER NOT NULL DEFAULT 0,
    "disciplinaryDeduction" INTEGER NOT NULL DEFAULT 0,
    "appreciationMessages" INTEGER NOT NULL DEFAULT 0,
    "exceptionalAssignments" INTEGER NOT NULL DEFAULT 0,
    "specializedTraining" BOOLEAN NOT NULL DEFAULT false,
    "supportingTraining" BOOLEAN NOT NULL DEFAULT false,
    "languageTraining" BOOLEAN NOT NULL DEFAULT false,
    "softwareTraining" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT NOT NULL,

    CONSTRAINT "PersonnelEvaluation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PersonnelEvaluation" ADD CONSTRAINT "PersonnelEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelEvaluation" ADD CONSTRAINT "PersonnelEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
