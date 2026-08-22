-- Functional hats + per-user hat assignments (Access Management redesign).

-- 1. Individual-grant column stays as `permissions`; add the hat-assignment array.
ALTER TABLE "User" ADD COLUMN "functionalHatIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. Functional hat catalog.
CREATE TABLE "FunctionalHat" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionalHat_pkey" PRIMARY KEY ("id")
);

-- 3. Unique key for system hats (nullable — custom hats have no key).
CREATE UNIQUE INDEX "FunctionalHat_key_key" ON "FunctionalHat"("key");
