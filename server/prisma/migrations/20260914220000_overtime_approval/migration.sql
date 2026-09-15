-- Every approved-overtime push we have made, and what the service showed afterwards.
--
-- The attendance service cannot be asked what it holds: /api/attendance/overtimes is POST-only,
-- with no list and no delete, unlike every comparable entity. This table is therefore the only
-- cross-employee view of what has been approved, the source of the overlap warning, and — because
-- a wrong approval can only be neutralised by re-posting its EXACT period at zero — the only place
-- that period can be found again.
--
-- Append-only by convention: a revision is a new row, matching AttendancePunchCorrection.
CREATE TABLE IF NOT EXISTS "OvertimeApproval" (
    "id"            TEXT NOT NULL,

    "empCode"       TEXT NOT NULL,
    "employeeId"    TEXT,

    -- 'YYYY-MM-DD' / 'YYYY-MM' as TEXT on purpose: a DateTime built from a local day is stored as
    -- UTC midnight and reads back a day earlier east of UTC, which would both misfile the period
    -- and break the exact-period match the service's upsert depends on.
    "startDate"     TEXT NOT NULL,
    "endDate"       TEXT NOT NULL,
    "period"        TEXT NOT NULL,

    -- Total for the whole period, not per day.
    "minutes"       INTEGER NOT NULL,
    "reason"        TEXT NOT NULL,
    "notes"         TEXT,
    "headName"      TEXT,

    "status"        TEXT NOT NULL DEFAULT 'APPLIED',
    "sourceMessage" TEXT,
    "verifiedMins"  INTEGER,

    "createdById"   TEXT,
    "createdByName" TEXT,
    "appliedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeApproval_pkey" PRIMARY KEY ("id")
);

-- "what has already been approved for this person" — the overlap warning.
CREATE INDEX IF NOT EXISTS "OvertimeApproval_empCode_startDate_idx"
    ON "OvertimeApproval" ("empCode", "startDate");
-- "what was approved in this financial month" — the report and the payroll cross-check.
CREATE INDEX IF NOT EXISTS "OvertimeApproval_period_status_idx"
    ON "OvertimeApproval" ("period", "status");
