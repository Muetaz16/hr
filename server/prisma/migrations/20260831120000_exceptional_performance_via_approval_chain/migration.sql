-- Exceptional Performance Award now flows through the real LeaveRequest/LeaveApprovalStep chain
-- (Head submits -> HR Manager -> General Manager) instead of a bespoke single-stage gate on
-- RewardCase — drop the now-unused gate columns and add the one new field the chain needs.
ALTER TABLE "RewardCase" DROP COLUMN "approvalStatus";
ALTER TABLE "RewardCase" DROP COLUMN "nominatedByUserId";
ALTER TABLE "RewardCase" DROP COLUMN "decidedByUserId";
ALTER TABLE "RewardCase" DROP COLUMN "decidedByName";
ALTER TABLE "RewardCase" DROP COLUMN "decidedAt";
ALTER TABLE "RewardCase" DROP COLUMN "decisionNote";

ALTER TABLE "LeaveRequest" ADD COLUMN "proposedBonusPercent" DOUBLE PRECISION;
