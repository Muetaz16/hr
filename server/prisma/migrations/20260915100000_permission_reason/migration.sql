-- Attendance permissions: which of the four printed reason boxes the employee ticked
-- (PERSONAL | FAMILY | HEALTH_MEDICAL | OTHERS). Nullable: every request filed before this
-- exists without one, and the form simply leaves all four boxes empty for those.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "permissionReason" TEXT;
