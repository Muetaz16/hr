-- Self-service onboarding: private link + submitted data on the candidate
ALTER TABLE "Candidate"
  ADD COLUMN "onboardingToken" TEXT,
  ADD COLUMN "onboardingStatus" TEXT,
  ADD COLUMN "onboardingData" JSONB,
  ADD COLUMN "onboardingSubmittedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Candidate_onboardingToken_key" ON "Candidate" ("onboardingToken");
