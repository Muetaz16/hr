-- AlterTable
ALTER TABLE "EvaluationPeriod" ADD COLUMN     "isAutoManaged" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "disabledById" TEXT,
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "openNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "reminderNotifiedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_disabledById_fkey" FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: every row that existed before this migration was created
-- through the old manual-only enable/disable flow, so it must NOT be treated
-- as "auto-managed" (the day-15/day-20 scheduler and its multi-month safety
-- sweep must never touch a period a human explicitly set). Going forward,
-- only the scheduler itself creates rows with isAutoManaged = true.
UPDATE "EvaluationPeriod" SET "isAutoManaged" = false;
