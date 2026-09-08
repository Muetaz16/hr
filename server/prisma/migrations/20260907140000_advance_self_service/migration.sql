-- Self-service advance requests.
--
-- The request used to arrive on a Google Form, so it carried fields the system already knows
-- (name, staff ID, position, e-mail). Those are no longer asked for. What the form carried that the
-- system does NOT know is kept: the WhatsApp number the payroll team actually calls, and — for the
-- preset path — which multiple of the basic salary was chosen and what that basic was AT THE TIME,
-- because the rate card is mutable and a request must still explain its own amount a year later.
ALTER TABLE "EmployeeAdvance" ADD COLUMN "requestSource"       TEXT NOT NULL DEFAULT 'HR'; -- SELF | HR
ALTER TABLE "EmployeeAdvance" ADD COLUMN "requestedByUserId"   TEXT;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "requestedByName"     TEXT;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "contactEmail"        TEXT;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "whatsappNumber"      TEXT;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "basicSalaryMonths"   INTEGER;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "basicSalarySnapshot" DOUBLE PRECISION;

-- Residency and provider are snapshotted because the two request types follow different procedures
-- after submission, and an employee can move between providers.
ALTER TABLE "EmployeeAdvance" ADD COLUMN "residencyType"       TEXT;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "serviceProviderId"   TEXT;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "serviceProviderName" TEXT;

CREATE INDEX "EmployeeAdvance_requestedByUserId_idx" ON "EmployeeAdvance"("requestedByUserId");
CREATE INDEX "EmployeeAdvance_requestSource_status_idx" ON "EmployeeAdvance"("requestSource", "status");
