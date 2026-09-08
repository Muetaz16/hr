-- Provider cash-advance rounds.
--
-- An employee hired through a service provider cannot be granted an advance by IPH alone: the
-- provider is the employer of record and has to consent. So the requests are collected, printed on
-- one Cash Advance Request form per provider, sent out, signed, and only then disbursed.
--
-- No batch table: the round is identified by the reference number printed on the form, which every
-- advance in it carries. That keeps one source of truth (the advance rows) and means a request can
-- be pulled out of a round without orphaning a parent record.
ALTER TABLE "EmployeeAdvance" ADD COLUMN "providerFormRef"      TEXT;
ALTER TABLE "EmployeeAdvance" ADD COLUMN "providerFormIssuedAt" TIMESTAMP(3);

CREATE INDEX "EmployeeAdvance_providerFormRef_idx" ON "EmployeeAdvance"("providerFormRef");
-- The working query of the whole flow: "which requests for provider X in currency Y are still
-- waiting?" — one form covers one provider and one currency, because the form totals a single sum.
CREATE INDEX "EmployeeAdvance_serviceProviderId_status_idx" ON "EmployeeAdvance"("serviceProviderId", "status");
