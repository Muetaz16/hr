-- AlterTable
-- Removing 5 confirmed-dead Employee columns:
-- accruedHolidays/earnedHolidays/remainingHolidays are always recomputed live by
-- calculateHolidayMetrics() and never read from the stored column; roleCategory has
-- no UI to set it and no business logic reads it; bonusEmergencyHolidays has no live
-- write path and its only read sites were computing a balance the real leave-approval
-- gate never honored (a confirmed display-vs-enforcement bug).
ALTER TABLE "Employee" DROP COLUMN "accruedHolidays",
DROP COLUMN "earnedHolidays",
DROP COLUMN "remainingHolidays",
DROP COLUMN "roleCategory",
DROP COLUMN "bonusEmergencyHolidays";
