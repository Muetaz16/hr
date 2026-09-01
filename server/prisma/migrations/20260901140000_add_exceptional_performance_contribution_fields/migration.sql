-- Exceptional Performance Award: 2 more fields required by the real "EXCEPTIONAL CONTRIBUTION
-- REWARD" template — Nature of Exceptional Contribution, and the payroll month the award covers.
ALTER TABLE "LeaveRequest" ADD COLUMN "natureOfContribution" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "payrollCoverageMonth" TEXT;
