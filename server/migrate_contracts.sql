UPDATE "Employee" SET "contractType" = 'RESDANT' WHERE "contractType" = 'Limited' OR "contractType" = 'Unlimited' OR "contractType" IS NULL;
UPDATE "Employee" SET "contractType" = 'DIRCT NONE RESDANT' WHERE "contractType" = 'DIRECT RESDANT' OR "contractType" = 'DIRCTOT';
