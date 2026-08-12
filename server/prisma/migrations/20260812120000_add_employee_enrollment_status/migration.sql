-- Add enrollment status to distinguish fully-enrolled employees from BioTime-imported stubs.
-- Existing rows default to 'ACTIVE'. Imported employees are inserted as 'PENDING_ENROLLMENT'.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "enrollmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
