-- AlterTable: remove onboarding fields that should never have been self-reported by the hire.
-- Department comes from the candidate's linked requisition (departmentId FK); job category,
-- job level and hourly rate are assigned by the recruitment team on the Candidate before the
-- offer is generated, not filled in by the new hire during onboarding.
ALTER TABLE "Employee"
  DROP COLUMN "departmentName",
  DROP COLUMN "departmentNameArabic",
  DROP COLUMN "jobLevel",
  DROP COLUMN "hourlyRate";
