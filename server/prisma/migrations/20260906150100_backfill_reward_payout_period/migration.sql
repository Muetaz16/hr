-- Separate from the DDL on purpose: if this backfill fails it must not leave half a schema behind.
--
-- payoutPeriod says which payroll month disburses a bonus. For every award type except
-- EMPLOYEE_OF_YEAR it is simply the period the award is for, so those are backfilled directly.
-- EMPLOYEE_OF_YEAR's period is a bare 'YYYY' and LOYALTY_MILESTONE has none at all; both are left
-- null and are set by HR when the award is granted, which is the whole reason the column exists.
UPDATE "RewardCase"
   SET "payoutPeriod" = "period"
 WHERE "payoutPeriod" IS NULL
   AND "period" IS NOT NULL
   AND "period" ~ '^[0-9]{4}-[0-9]{2}$';
