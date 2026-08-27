-- Brings the local database up to date with the colleague's changes merged from
-- feature/careers-portal (931a607) — audit logging + inter-company transfer support. Their branch
-- squashed its own migration history into one baseline, so this hand-picks the exact CREATE/ALTER
-- statements for what's actually new relative to this database (verified missing beforehand, not
-- assumed) rather than replaying their full squashed init against an already-initialized database.

ALTER TABLE "Employee"
  ADD COLUMN "transferredCompany" TEXT,
  ADD COLUMN "transferredAt" TIMESTAMP(3);

ALTER TABLE "PersonnelActionForm"
  ADD COLUMN "newCompany" TEXT,
  ADD COLUMN "newDivisionName" TEXT,
  ADD COLUMN "newDepartmentName" TEXT,
  ADD COLUMN "newUnitName" TEXT,
  ADD COLUMN "englishFactor" DOUBLE PRECISION,
  ADD COLUMN "positionFactor" DOUBLE PRECISION,
  ADD COLUMN "locationFactor" DOUBLE PRECISION,
  ADD COLUMN "skillFactor" DOUBLE PRECISION;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
