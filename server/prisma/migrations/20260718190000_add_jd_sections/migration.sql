-- AlterTable
ALTER TABLE "JobDescription" ADD COLUMN "workLocations" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "JobDescription" ADD COLUMN "details" JSONB;
