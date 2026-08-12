-- Personnel Requisition Form fields + staged approval snapshot on RecruitmentRequest
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "employmentType" TEXT;
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "typeOfRequest" TEXT;
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "languageEn" TEXT;
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "languageAr" TEXT;
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "prfApprovals" JSONB;
