-- AlterTable: fields collected by the self-service onboarding form (careers/onboard.js)
-- that had no matching column on Employee yet — Arabic counterparts of the bilingual
-- fields, Service Provider–only fields, and a few onboarding document uploads.
ALTER TABLE "Employee"
  ADD COLUMN "placeOfBirthArabic" TEXT,
  ADD COLUMN "nationalityArabic" TEXT,
  ADD COLUMN "academicQualificationArabic" TEXT,
  ADD COLUMN "idPlaceOfIssueArabic" TEXT,
  ADD COLUMN "passportPlaceOfIssueArabic" TEXT,
  ADD COLUMN "drivingLicenseTypeArabic" TEXT,
  ADD COLUMN "drivingLicensePlaceOfIssueArabic" TEXT,
  ADD COLUMN "residentialAddressArabic" TEXT,
  ADD COLUMN "relativesNamesArabic" TEXT,
  ADD COLUMN "bankNameArabic" TEXT,
  ADD COLUMN "bankBranchNameArabic" TEXT,
  ADD COLUMN "departmentName" TEXT,
  ADD COLUMN "departmentNameArabic" TEXT,
  ADD COLUMN "serviceProviderCompany" TEXT,
  ADD COLUMN "jobLevel" TEXT,
  ADD COLUMN "hourlyRate" TEXT,
  ADD COLUMN "employeeTravelDate" TIMESTAMP(3),
  ADD COLUMN "employeeStartDate" TIMESTAMP(3),
  ADD COLUMN "ticketUrl" TEXT,
  ADD COLUMN "residencyDocumentUrl" TEXT,
  ADD COLUMN "interviewEvaluationUrl" TEXT;
