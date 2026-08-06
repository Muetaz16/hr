-- Careers portal: publishing flags on requisitions + source flag on candidates
ALTER TABLE "RecruitmentRequest"
  ADD COLUMN "publishedToCareers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

ALTER TABLE "Candidate"
  ADD COLUMN "appliedViaCareers" BOOLEAN NOT NULL DEFAULT false;

-- Public careers page reads published + still-open positions
CREATE INDEX "RecruitmentRequest_publishedToCareers_filled_idx"
  ON "RecruitmentRequest" ("publishedToCareers", "filled");
