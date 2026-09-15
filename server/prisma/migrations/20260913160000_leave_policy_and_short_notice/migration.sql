-- Leave policy numbers, editable instead of compiled in. Seeded with exactly today's values so the
-- behaviour is unchanged the moment this lands.
CREATE TABLE IF NOT EXISTS "LeavePolicy" (
    "id"                      TEXT NOT NULL DEFAULT 'singleton',
    "noticeDays"              INTEGER NOT NULL DEFAULT 14,
    "emergencyLeaveAllowance" INTEGER NOT NULL DEFAULT 3,
    "unpaidLeaveAllowance"    INTEGER NOT NULL DEFAULT 14,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById"             TEXT,
    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);
INSERT INTO "LeavePolicy" ("id") VALUES ('singleton') ON CONFLICT ("id") DO NOTHING;

-- The written justification for filing inside the notice window. Non-null IS the record that an
-- exception was granted; the letter authorising it rides on the request's existing attachment.
-- Nullable, so every request filed before this reads as a normal, in-window request.
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "shortNoticeReason" TEXT;
