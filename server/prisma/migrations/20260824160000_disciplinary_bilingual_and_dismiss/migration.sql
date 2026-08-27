-- Bilingual translation pairs for the free-text intake fields (the reporter may file in Arabic or
-- English only; HR fills in the missing translation later), plus a closure reason for cases that
-- are dismissed right at Incident Report stage instead of proceeding to Notice to Explain.

ALTER TABLE "DisciplinaryCase" ADD COLUMN "subjectPositionTitleAr" TEXT;
ALTER TABLE "DisciplinaryCase" ADD COLUMN "subjectDepartmentAr" TEXT;
ALTER TABLE "DisciplinaryCase" ADD COLUMN "incidentPlaceAr" TEXT;
ALTER TABLE "DisciplinaryCase" ADD COLUMN "incidentDescriptionAr" TEXT;
ALTER TABLE "DisciplinaryCase" ADD COLUMN "closureReason" TEXT;
