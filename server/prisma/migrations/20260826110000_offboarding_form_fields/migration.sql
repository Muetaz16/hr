-- Reconcile OffboardingCase with the real Resignation Request / Exit Interview intake forms.

ALTER TABLE "OffboardingCase"
  ADD COLUMN "resignationHeadOfDepartment" TEXT,
  ADD COLUMN "resignationLetterText" TEXT,
  ADD COLUMN "resignationAttachmentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "resignationAttachmentNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "exitInterviewReasonCategory" TEXT,
  ADD COLUMN "exitInterviewReasonOther" TEXT,
  ADD COLUMN "exitInterviewRatingManagement" TEXT,
  ADD COLUMN "exitInterviewRatingCompanyCulture" TEXT,
  ADD COLUMN "exitInterviewRatingPolicies" TEXT,
  ADD COLUMN "exitInterviewRatingWorkingConditions" TEXT,
  ADD COLUMN "exitInterviewRatingCareerDevelopment" TEXT,
  ADD COLUMN "exitInterviewRatingSalary" TEXT,
  ADD COLUMN "exitInterviewRatingBenefits" TEXT,
  ADD COLUMN "exitInterviewRatingTraining" TEXT,
  ADD COLUMN "exitInterviewAppreciatedMost" TEXT,
  ADD COLUMN "exitInterviewLikedLeast" TEXT,
  ADD COLUMN "exitInterviewImprovementSuggestions" TEXT,
  ADD COLUMN "exitInterviewInterestedInReemployment" BOOLEAN,
  ADD COLUMN "exitInterviewContactEmail" TEXT,
  ADD COLUMN "exitInterviewContactNumber" TEXT;

ALTER TABLE "OffboardingCase"
  DROP COLUMN "resignationLetterUrl",
  DROP COLUMN "exitInterviewReason",
  DROP COLUMN "exitInterviewFeedback",
  DROP COLUMN "exitInterviewRating";
