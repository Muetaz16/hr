-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "divisionApprovedById" TEXT;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_divisionApprovedById_fkey" FOREIGN KEY ("divisionApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
