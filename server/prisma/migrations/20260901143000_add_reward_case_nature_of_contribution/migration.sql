-- Exceptional Performance Award: persist "Nature of Exceptional Contribution" onto the finalized
-- RewardCase too (not just the nomination LeaveRequest). "Payroll Coverage" reuses the existing
-- `period` column (already a type-specific "YYYY-MM"/"YYYY" field) rather than a new one.
ALTER TABLE "RewardCase" ADD COLUMN "natureOfContribution" TEXT;
