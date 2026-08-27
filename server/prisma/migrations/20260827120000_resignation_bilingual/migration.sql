-- The printed Resignation Request form is bilingual, but the employee only types one language at
-- intake — HR adds the other language's version before generating the official document, same
-- convention as DisciplinaryCase.incidentDescriptionAr.
ALTER TABLE "OffboardingCase"
  ADD COLUMN "resignationReasonAr" TEXT,
  ADD COLUMN "resignationLetterTextAr" TEXT;
