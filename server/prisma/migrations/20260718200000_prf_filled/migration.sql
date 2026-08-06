-- AlterTable
ALTER TABLE "RecruitmentRequest" ADD COLUMN "filled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecruitmentRequest" ADD COLUMN "filledAt" TIMESTAMP(3);
