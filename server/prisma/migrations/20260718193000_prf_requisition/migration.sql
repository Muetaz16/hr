-- AlterTable: RecruitmentRequest becomes a Personnel Requisition supporting JD-linked hire and JD-change requests
ALTER TABLE "RecruitmentRequest" ALTER COLUMN "departmentId" DROP NOT NULL;
ALTER TABLE "RecruitmentRequest" ADD COLUMN "divisionId" TEXT;
ALTER TABLE "RecruitmentRequest" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'HIRE';
ALTER TABLE "RecruitmentRequest" ADD COLUMN "jobDescriptionId" TEXT;
ALTER TABLE "RecruitmentRequest" ADD COLUMN "jdPayload" JSONB;

-- Indexes
CREATE INDEX "RecruitmentRequest_status_idx" ON "RecruitmentRequest"("status");
CREATE INDEX "RecruitmentRequest_type_idx" ON "RecruitmentRequest"("type");

-- Foreign keys
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
