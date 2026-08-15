-- A HEAD_DIVISION user owns a whole division; leave requests from employees in any of that
-- division's departments route through them. Nullable; only meaningful for HEAD_DIVISION accounts.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "divisionId" TEXT;
