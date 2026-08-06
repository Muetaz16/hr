-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "source" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "degreePath" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "portfolioPath" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "speciality" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "yearsExperience" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "salaryExpectation" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "nationality" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Candidate" ADD COLUMN "placeOfLiving" TEXT;
