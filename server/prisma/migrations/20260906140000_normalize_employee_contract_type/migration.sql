-- Employee.contractType had drifted to 8 values across 3 vocabularies. Only three are canonical
-- (RESDANT | DIRCT NONE RESDANT | NONE RESDANT, see src/utils/employeeFieldVisibility.ts), and two
-- shipped features already refuse to work without them:
--   * regenerateAllStaffIds() rejects the whole run if ANY employee lacks a residency digit,
--   * saving an employee cannot push their residency class to BioTime
--     (BIOTIME_POSITION_BY_CONTRACT_TYPE only maps the three canonical keys).
-- Payroll additionally needs it to split the GM report into its three blocks.
--
-- ONLY the two mechanically unambiguous renames are applied here. 'Exception',
-- 'Higher-Management', 'Limited' and NULL are deliberately LEFT ALONE: guessing a residency for
-- them would silently misfile someone in the payroll report, which is worse than a visible gap.
-- They surface in the payroll pre-flight check as "residency not set" for a human to resolve.

UPDATE "Employee" SET "contractType" = 'RESDANT'            WHERE "contractType" = 'Resident';
UPDATE "Employee" SET "contractType" = 'DIRCT NONE RESDANT' WHERE "contractType" = 'Non-Resident';

-- Residents are paid on the LYD structure — the same rule the hiring screen already enforces
-- (CandidatePipeline.tsx restricts RESDANT to ['SS-01-LYD']). Non-residents have no single
-- answer, so theirs stays null and is resolved per employee.
UPDATE "Employee" SET "salaryStructureType" = 'SS-01-LYD'
 WHERE "contractType" = 'RESDANT' AND "salaryStructureType" IS NULL;
