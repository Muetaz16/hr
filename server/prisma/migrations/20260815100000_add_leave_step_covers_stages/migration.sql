-- Smart signature coverage: one approver can hold several posts on the printed Leave Request Form
-- (e.g. the division head is also the direct manager, or the director is the direct manager). They
-- sign once, but that single signature is shown in every row they cover. This records which form
-- rows each step fills. Existing rows default to an empty set and fall back to the legacy heuristic.
ALTER TABLE "LeaveApprovalStep" ADD COLUMN IF NOT EXISTS "coversStages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
