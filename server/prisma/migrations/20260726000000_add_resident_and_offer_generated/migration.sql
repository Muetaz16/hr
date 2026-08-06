-- Candidate: residency status captured on the hiring list, and a stamp for when the offer doc is generated
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "residentStatus" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "offerGeneratedAt" TIMESTAMP(3);

-- Employee: place of work (Office / Site) locked from the job description during onboarding
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "placeOfWork" TEXT;
