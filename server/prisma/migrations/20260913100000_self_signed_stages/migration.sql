-- Printed signature rows the requester fills themselves, because no line authority sits above them.
-- Defaults to empty, so every request filed before this keeps printing that row blank exactly as it
-- did — the flag is only ever set at creation time by the chain resolver.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "selfSignedStages" TEXT[] NOT NULL DEFAULT '{}';
