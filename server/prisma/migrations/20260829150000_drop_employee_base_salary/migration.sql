-- Employee.baseSalary was a stored value that could drift from the real source of truth
-- (SalaryStructure, keyed by jobCategory + jobGrade + salaryStructureType). It is now computed
-- live on every read (see employeeController.ts's getBaseSalary/buildSalaryStructureMap), so the
-- column itself is redundant and is dropped here.
ALTER TABLE "Employee" DROP COLUMN "baseSalary";
