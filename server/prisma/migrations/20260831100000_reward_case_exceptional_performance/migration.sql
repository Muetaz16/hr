-- Exceptional Performance / Exceptional Contribution Award: a Head nominates, the General Manager
-- approves/rejects inside the system, then HR runs the existing signed-document complete cycle.
-- Null for every other award type, which has no approval gate at all.
ALTER TABLE "RewardCase" ADD COLUMN "approvalStatus" TEXT;
ALTER TABLE "RewardCase" ADD COLUMN "nominatedByUserId" TEXT;
ALTER TABLE "RewardCase" ADD COLUMN "decidedByUserId" TEXT;
ALTER TABLE "RewardCase" ADD COLUMN "decidedByName" TEXT;
ALTER TABLE "RewardCase" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "RewardCase" ADD COLUMN "decisionNote" TEXT;
