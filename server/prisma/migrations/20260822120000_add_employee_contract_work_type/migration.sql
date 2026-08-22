-- Records whether the employee's contract is Full Time or Part Time.
ALTER TABLE "Employee" ADD COLUMN "contractWorkType" TEXT DEFAULT 'Full Time';
