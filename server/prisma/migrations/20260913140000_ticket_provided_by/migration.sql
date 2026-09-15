-- "Ticket provided by" on the Leave Request Form: EMPLOYEE | COMPANY, or NULL meaning the requester
-- left it unanswered, which the printed form allows (neither box ticked). Nullable with no default,
-- so every request filed before this keeps printing that row blank exactly as it does today.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "ticketProvidedBy" TEXT;
