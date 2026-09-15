-- Missing Biometric Log: the punch time the employee asks for, and the time an approver grants.
--
-- `startTime` / `endTime` already existed on LeaveRequest (used by the hours-permission types) and
-- now also carry the employee's REQUESTED punch time; only the approver-granted pair is new. Both
-- are nullable: every request filed before this migration keeps deriving its punch time from the
-- employee's scheduled work hours, exactly as before.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "approvedStartTime" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "approvedEndTime" TEXT;
