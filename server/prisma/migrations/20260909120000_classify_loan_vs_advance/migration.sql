-- Loan or salary advance: name the two procedures the system already ran differently.
--
--   RESDANT / DIRCT NONE RESDANT      LOAN     a multiple of basic pay, repaid over months
--   NONE RESDANT (service provider)   ADVANCE  one amount, recovered from a single salary month
--
-- Every existing row carries the old blanket default 'SALARY_ADVANCE', so the ones that were
-- actually loans are reclassified here. Data only — "type" is already a String column with no
-- constraint, and the rule that keeps new rows right lives in server/src/utils/advanceKind.ts.
--
-- residencyType is snapshotted on the request, so this reads what the employee was AT THE TIME
-- rather than what they are now; a person moved onto a provider contract afterwards must not have
-- their old loan retitled. NULL means "not a provider employee", hence IS DISTINCT FROM.

UPDATE "EmployeeAdvance"
SET "type" = 'LOAN'
WHERE "residencyType" IS DISTINCT FROM 'NONE RESDANT'
  AND "type" = 'SALARY_ADVANCE';
