-- DropForeignKey
ALTER TABLE "DepartmentEvaluation" DROP CONSTRAINT "DepartmentEvaluation_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "DirectorEvaluation" DROP CONSTRAINT "DirectorEvaluation_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "HREvaluation" DROP CONSTRAINT "HREvaluation_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "PayrollResult" DROP CONSTRAINT "PayrollResult_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "PersonnelEvaluation" DROP CONSTRAINT "PersonnelEvaluation_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "TimeRecord" DROP CONSTRAINT "TimeRecord_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HREvaluation" ADD CONSTRAINT "HREvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentEvaluation" ADD CONSTRAINT "DepartmentEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorEvaluation" ADD CONSTRAINT "DirectorEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelEvaluation" ADD CONSTRAINT "PersonnelEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollResult" ADD CONSTRAINT "PayrollResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
