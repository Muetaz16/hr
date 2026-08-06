-- AlterTable
ALTER TABLE "JobDescription" ADD COLUMN "jobCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];
