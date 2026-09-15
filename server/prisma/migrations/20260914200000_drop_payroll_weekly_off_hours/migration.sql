-- Drops the rest-day columns added earlier the same day.
--
-- They existed to hold back Friday minutes that the attendance service was folding into
-- totalWorkMins. The service has since been fixed at source: a day with no scheduled hours (the
-- weekly rest day or a public holiday) now reports totalWorkMins = 0 with the whole span in
-- otMins, so there is nothing left to hold back and these columns were only ever written as 0.
--
-- Verified empty before dropping: 193 PayrollLine rows, 0 with a non-zero value in either column.
ALTER TABLE "PayrollLine" DROP COLUMN IF EXISTS "weeklyOffWorkMins";
ALTER TABLE "PayrollLine" DROP COLUMN IF EXISTS "weeklyOffDays";
