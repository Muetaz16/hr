-- Reports To on RecruitmentRequest (PRF)
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "reportsTo" TEXT;
