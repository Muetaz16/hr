-- Service Providers become a first-class entity instead of hardcoded name lists.
-- Employee.serviceProviderCompany (free text) is intentionally LEFT IN PLACE: it holds
-- pre-existing values that were typed by hand and may not match any registered provider.

CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameArabic" TEXT,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceProvider_name_key" ON "ServiceProvider"("name");
CREATE INDEX "ServiceProvider_isActive_idx" ON "ServiceProvider"("isActive");

ALTER TABLE "Employee" ADD COLUMN "serviceProviderId" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "serviceProviderId" TEXT;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_serviceProviderId_fkey"
    FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_serviceProviderId_fkey"
    FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
