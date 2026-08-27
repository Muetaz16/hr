-- "Prepared by" on the printed Incident Report form is whoever finalizes the document (usually
-- HR), which is a distinct person from the original reporter (reportedByName).
ALTER TABLE "DisciplinaryCase" ADD COLUMN "preparedByName" TEXT;
