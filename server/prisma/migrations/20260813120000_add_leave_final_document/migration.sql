-- The General Manager must upload a supporting document to grant the final approval.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "finalDocumentUrl" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "finalDocumentName" TEXT;
