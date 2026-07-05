-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "contractStartDate" TIMESTAMP(3),
ADD COLUMN     "contractStatus" TEXT,
ADD COLUMN     "contractType" TEXT;
