-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_authorId_fkey";

-- DropForeignKey
ALTER TABLE "StaffTask" DROP CONSTRAINT "StaffTask_authorId_fkey";

-- AlterTable
ALTER TABLE "Announcement" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "emergencyHolidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fullNameArabic" TEXT,
ADD COLUMN     "jobCategory" TEXT,
ADD COLUMN     "jobGrade" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "unpaidHolidaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StaffTask" ALTER COLUMN "authorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
