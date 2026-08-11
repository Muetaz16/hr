-- AlterTable: link an Employee to their record in the external BioTime attendance system.
-- Populated automatically when an Employee is created (see employeeController.createEmployee),
-- by matching staffId <-> BioTime's empCode and reading back BioTime's own numeric employee id.
-- Nullable because the sync is best-effort and may not have succeeded yet.
ALTER TABLE "Employee" ADD COLUMN "bioId" INTEGER;

CREATE INDEX "Employee_bioId_idx" ON "Employee"("bioId");
