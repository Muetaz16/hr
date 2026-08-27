-- "Head of Division" is now resolved live from the org structure (User.role = 'HEAD_DIVISION' +
-- divisionId), same lookup already used by leaveApprovalChain.ts — no longer typed by the employee.
ALTER TABLE "OffboardingCase" DROP COLUMN "resignationHeadOfDepartment";
