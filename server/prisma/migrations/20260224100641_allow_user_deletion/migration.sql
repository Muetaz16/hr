-- DropForeignKey
ALTER TABLE "DepartmentEvaluation" DROP CONSTRAINT "DepartmentEvaluation_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "DirectorEvaluation" DROP CONSTRAINT "DirectorEvaluation_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "EvaluationPeriod" DROP CONSTRAINT "EvaluationPeriod_enabledById_fkey";

-- DropForeignKey
ALTER TABLE "HREvaluation" DROP CONSTRAINT "HREvaluation_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "PersonnelEvaluation" DROP CONSTRAINT "PersonnelEvaluation_submittedById_fkey";

-- AlterTable
ALTER TABLE "DepartmentEvaluation" ALTER COLUMN "submittedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DirectorEvaluation" ALTER COLUMN "submittedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bonusHolidays" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EvaluationPeriod" ALTER COLUMN "enabledById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "HREvaluation" ALTER COLUMN "submittedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PersonnelEvaluation" ALTER COLUMN "submittedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_enabledById_fkey" FOREIGN KEY ("enabledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HREvaluation" ADD CONSTRAINT "HREvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentEvaluation" ADD CONSTRAINT "DepartmentEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorEvaluation" ADD CONSTRAINT "DirectorEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelEvaluation" ADD CONSTRAINT "PersonnelEvaluation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
