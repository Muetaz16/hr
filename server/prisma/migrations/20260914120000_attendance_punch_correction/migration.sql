-- The audit log of punches we pushed a change into. A LOG, not an override: nothing in payroll,
-- presence or the disciplinary rules reads this table — they keep reading the attendance service,
-- which is now correct. Append-only by convention (no UPDATE, no DELETE); a wrong correction is
-- superseded by another row, the same rule PayrollRun already follows.
CREATE TABLE IF NOT EXISTS "AttendancePunchCorrection" (
    "id"                     TEXT NOT NULL,

    -- Flat empCode so a correction stays readable after an employee is re-linked or renamed.
    "empCode"                TEXT NOT NULL,
    "employeeId"             TEXT,
    "bioEmpId"               INTEGER,

    -- 'YYYY-MM-DD' / 'YYYY-MM' as TEXT on purpose: a DateTime built from a local calendar day is
    -- stored as UTC midnight and reads back as the day before east of UTC, which moves a day into
    -- the wrong payroll period.
    "workDate"               TEXT NOT NULL,
    "period"                 TEXT NOT NULL,

    "action"                 TEXT NOT NULL,
    "anomalyKind"            TEXT,

    "sourcePunchId"          INTEGER,
    "wasManual"              BOOLEAN NOT NULL DEFAULT false,

    "beforeTime"             TEXT,
    "beforeState"            TEXT,
    "afterTime"              TEXT,
    "afterState"             TEXT,

    "reason"                 TEXT NOT NULL,

    "status"                 TEXT NOT NULL DEFAULT 'APPLIED',
    -- The service's verbatim reply, and separately what re-reading the day actually showed. The
    -- second is the evidence; the first is what turned out not to be trustworthy.
    "sourceMessage"          TEXT,
    "verifiedState"          TEXT,
    "workMinsBefore"         INTEGER,
    "workMinsAfter"          INTEGER,

    -- The blast radius AS IT WAS when the correction landed, not as it is when someone reads this.
    "payrollRunId"           TEXT,
    "payrollWasLocked"       BOOLEAN NOT NULL DEFAULT false,
    "evaluationWasFinalized" BOOLEAN NOT NULL DEFAULT false,

    "correctedById"          TEXT,
    "correctedByName"        TEXT,
    "appliedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePunchCorrection_pkey" PRIMARY KEY ("id")
);

-- "has this employee's day already been corrected" — the modal's own staleness check.
CREATE INDEX IF NOT EXISTS "AttendancePunchCorrection_empCode_workDate_idx"
    ON "AttendancePunchCorrection" ("empCode", "workDate");
-- "which corrections landed in this period" — what the payroll run screen asks to know it is stale.
CREATE INDEX IF NOT EXISTS "AttendancePunchCorrection_period_status_idx"
    ON "AttendancePunchCorrection" ("period", "status");
