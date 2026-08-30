-- Rewards now require a signed-copy upload before anything is applied to the employee (matching
-- every other case module) instead of an instant single-click grant, which the user flagged as too
-- error-prone for an action with real, hard-to-reverse effects (leave-day credits).
ALTER TABLE "RewardCase" ADD COLUMN "documentUrl" TEXT;
ALTER TABLE "RewardCase" ADD COLUMN "documentName" TEXT;
ALTER TABLE "RewardCase" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill: one real case (IPH-CCHR-FRM-REWARD-001) was already granted under the old instant-grant
-- flow before this change — its bonusHolidays credit and Appreciation Letter already happened, so it
-- is marked completed as of when it was last touched rather than left looking like an unfinished
-- draft under the new rules.
UPDATE "RewardCase" SET "completedAt" = "updatedAt" WHERE "completedAt" IS NULL;

-- Superseded by contractType (RESDANT = resident/local) — a real, always-populated field — instead
-- of a brand-new manually-toggled boolean that silently defaulted every employee to eligible.
ALTER TABLE "Employee" DROP COLUMN "usesCompanyTransportation";
