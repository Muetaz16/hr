-- Rest-day hours, held back from the ordinary hours a run pays.
--
-- Friday is the weekly rest day. Work done on it is overtime: paid only once the approved hours
-- have been entered after approval, and at the plain hourly rate with no premium. The attendance
-- service does not model that — it folds Friday straight into totalWorkMins, the figure payroll
-- pays, so entering the approved overtime on top paid the same hours twice.
--
-- Defaulting to 0 is exactly right for every run computed before this: their workMins already
-- INCLUDED the rest-day minutes, and back-filling a figure here would misrepresent a signed run as
-- having held something back that it did not.
ALTER TABLE "PayrollLine" ADD COLUMN IF NOT EXISTS "weeklyOffWorkMins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD COLUMN IF NOT EXISTS "weeklyOffDays"     INTEGER NOT NULL DEFAULT 0;
