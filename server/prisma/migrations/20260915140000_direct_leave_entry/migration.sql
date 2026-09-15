-- Direct register entries: a leave granted on paper by senior management and typed straight into
-- the register by an authorised officer, with no approval chain behind it.
--
-- Defaults are chosen so every EXISTING row keeps describing itself truthfully: nothing already in
-- the table was a direct entry (false), and every one of them did charge the employee's balance
-- through the completion hook (true).
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "directEntry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "directEntryById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "directEntryByName" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "deductFromBalance" BOOLEAN NOT NULL DEFAULT true;
