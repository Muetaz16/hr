-- Review export + period close.
--
-- The MASTER DATA review sheet handed to Internal Audit and the Finance Division prints identity
-- fields that PayrollLine did not snapshot yet (passport, e-mail, nationality). They are copied at
-- compute time for the same reason every other identity field is: employeeId is nullable with
-- onDelete SetNull, so a signed run has to be reproducible from the line alone.
ALTER TABLE "PayrollLine" ADD COLUMN "passportNumber" TEXT;
ALTER TABLE "PayrollLine" ADD COLUMN "email"          TEXT;
ALTER TABLE "PayrollLine" ADD COLUMN "nationality"    TEXT;

-- Who pressed Close. approvalDocumentUrl/Name already hold the signed Salary Approval memo; this
-- records the person, because the memo is signed on paper and the trail otherwise stops at a file.
ALTER TABLE "PayrollRun" ADD COLUMN "approvedByName" TEXT;
