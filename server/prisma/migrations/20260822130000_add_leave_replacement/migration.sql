-- Nominated replacement (cover) employee on a leave request. The nominee must accept before the
-- manager approval chain unblocks; their saved signature is then stamped on the printed form.
-- replacementStatus: NULL = not required (requester had no eligible colleague) | PENDING | APPROVED | REJECTED.
-- Idempotent guards (IF NOT EXISTS / catch duplicate_object) so this is safe to apply directly and
-- again later via `prisma migrate deploy`.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "replacementUserId" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "replacementStatus" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "replacementDecidedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LeaveRequest_replacementUserId_idx" ON "LeaveRequest"("replacementUserId");

DO $$
BEGIN
    ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_replacementUserId_fkey"
        FOREIGN KEY ("replacementUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
