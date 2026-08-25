-- Inter-company transfer support on PersonnelActionForm (free-text destination + entered factors)
-- and TRANSFERRED tracking on Employee. Idempotent so it can be applied directly and re-run via deploy.
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "newCompany" TEXT;
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "newDivisionName" TEXT;
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "newDepartmentName" TEXT;
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "newUnitName" TEXT;
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "englishFactor" DOUBLE PRECISION;
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "positionFactor" DOUBLE PRECISION;
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "locationFactor" DOUBLE PRECISION;
ALTER TABLE "PersonnelActionForm" ADD COLUMN IF NOT EXISTS "skillFactor" DOUBLE PRECISION;

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "transferredCompany" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "transferredAt" TIMESTAMP(3);
