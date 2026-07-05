-- AlterTable
ALTER TABLE "User" ADD COLUMN     "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
