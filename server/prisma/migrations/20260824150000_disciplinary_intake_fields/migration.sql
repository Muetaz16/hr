-- Incident Report intake no longer collects a violation type or "anonymous" flag; the subject
-- employee is looked up and linked automatically, but position/department are captured as an
-- editable snapshot at filing time, and the report carries its own optional reporter name/email
-- plus an editable "Date Reported".

ALTER TABLE "DisciplinaryCase" ALTER COLUMN "violationId" DROP NOT NULL;
ALTER TABLE "DisciplinaryCase" ALTER COLUMN "category" DROP NOT NULL;

ALTER TABLE "DisciplinaryCase" DROP COLUMN "isAnonymous";

ALTER TABLE "DisciplinaryCase" ADD COLUMN "reportedByName" TEXT;
ALTER TABLE "DisciplinaryCase" ADD COLUMN "reportedByEmail" TEXT;
ALTER TABLE "DisciplinaryCase" ADD COLUMN "reportedDate" TIMESTAMP(3);
ALTER TABLE "DisciplinaryCase" ADD COLUMN "subjectPositionTitle" TEXT;
ALTER TABLE "DisciplinaryCase" ADD COLUMN "subjectDepartment" TEXT;
