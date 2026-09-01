-- Missing Biometric Log (missing-punch) request fields on LeaveRequest.
-- (Work location is derived from the employee's Job Description, so it is not stored here.)
ALTER TABLE "LeaveRequest" ADD COLUMN "missingPunchType" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "missingPunchReason" TEXT;
