-- CreateTable: per-approver-per-stage tracking for the new leave-request approval chain
-- (Unit head -> Department/Office head -> Division head -> HR Manager -> Administrative
-- Director -> General Manager, skipping whichever org levels don't apply to a given employee).
-- Replaces the old fixed 4-column approach for PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE only;
-- LeaveRequest's existing approver columns are untouched.
CREATE TABLE "LeaveApprovalStep" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_leaveRequestId_idx" ON "LeaveApprovalStep"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_approverUserId_status_idx" ON "LeaveApprovalStep"("approverUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalStep_leaveRequestId_sequence_approverUserId_key" ON "LeaveApprovalStep"("leaveRequestId", "sequence", "approverUserId");

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
