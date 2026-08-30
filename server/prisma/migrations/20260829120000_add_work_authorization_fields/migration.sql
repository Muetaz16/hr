-- Work Authorization request fields on LeaveRequest (out-work authorization written to BioTime's
-- `outworks` table on final approval). Both nullable — only populated for WORK_AUTHORIZATION requests.
ALTER TABLE "LeaveRequest"
  ADD COLUMN "workOrderType" TEXT,
  ADD COLUMN "placeOfAssignment" TEXT;
