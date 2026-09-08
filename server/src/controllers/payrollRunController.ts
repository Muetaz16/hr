// The monthly payroll run: create a period, check it is ready, compute it, read it back.
//
// NOTE ON NAMING: the pre-existing `payrollController.ts` and `/api/payroll` are NOT payroll — they
// are the Evaluations module's score sheet (`PayrollResult`). Nothing here touches them.
//
// The compute step is a DESTRUCTIVE REBUILD, not a merge: it deletes the run's lines, items and
// totals and re-inserts them from scratch inside one transaction. That is what makes it safe to
// press twice. Anything a human decided (exclusions, review notes) lives in PayrollLineOverride,
// outside the rebuild scope, and is replayed afterwards. Merge-style upserts are where
// double-counting comes from.
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { ACTIVE_ENROLLMENT_FILTER } from '../utils/employeeStatus';
import { computePayrollLine, round2 } from '../utils/payrollEngine';
import { fetchPayrollAttendance, PayrollAttendanceRow } from '../utils/payrollAttendance';
import { loadPeriodCharges, applicableCharges, parseManualItems } from '../utils/payrollCharges';
import { loadMonthlyEvaluationScores, evaluationSnapshot } from '../utils/monthlyEvaluationScores';
import {
    financialMonthRange, cutoffFor, toApiDate, isValidPeriod, currentPeriod, periodLabel,
} from '../utils/payrollPeriod';

interface AuthRequest extends Request {
    user?: { id: string; role: string; fullName?: string };
}

// A run is only reproducible if nothing recomputes after review starts. `lockedAt` is set at
// submit (not at GM approval) precisely so a reviewer never signs numbers a later recompute
// silently changes; the database additionally refuses any change once `approvedAt` is set.
const assertRunMutable = (run: { status: string; lockedAt: Date | null; approvedAt: Date | null }): string | null => {
    if (run.approvedAt) return 'This payroll run has been approved and is frozen. Cancel it and start a new revision instead.';
    if (run.lockedAt) return 'This payroll run has been submitted for approval and can no longer be changed.';
    if (run.status !== 'DRAFT') return `This payroll run is ${run.status.toLowerCase()} and can no longer be changed.`;
    return null;
};

// The structureLevel suffix is the currency. Throwing rather than defaulting is deliberate: a
// silent fallback to LYD would put a euro salary into the dinar column of the GM's report.
export const currencyOf = (structureLevel: string | null | undefined): string => {
    const suffix = String(structureLevel || '').trim().split('-').pop();
    if (suffix && ['LYD', 'USD', 'EUR'].includes(suffix)) return suffix;
    throw new Error(`Unrecognised salary structure level "${structureLevel}" — cannot determine its currency.`);
};

const nextRunNumber = async (): Promise<string> => {
    const count = await prisma.payrollRun.count();
    return `IPH-CCHR-FRM-PAYRUN-${String(count + 1).padStart(3, '0')}`;
};

/** Employees a period should pay: active, already joined, and not gone before it started. */
const eligibleEmployeeWhere = (periodStart: Date, periodEnd: Date) => ({
    enrollmentStatus: ACTIVE_ENROLLMENT_FILTER,
    joinDate: { lte: periodEnd },
    OR: [{ separationDate: null }, { separationDate: { gte: periodStart } }],
});

const EMPLOYEE_SELECT = {
    id: true, staffId: true, fullName: true, fullNameArabic: true, position: true,
    placeOfWork: true, contractType: true, contractEndDate: true, contractStartDate: true,
    jobCategory: true, jobGrade: true, salaryStructureType: true,
    positionFactor: true, siteFactor: true, skillFactor: true, languageFactor: true,
    bankName: true, bankAccountNumber: true,
    passportNumber: true, email: true, nationality: true,
    holidaysUsed: true, bonusHolidays: true, emergencyHolidaysUsed: true, unpaidHolidaysUsed: true,
    joinDate: true, separationDate: true, evaluationPoints: true,
    serviceProviderId: true,
    department: { select: { name: true } },
    division: { select: { name: true } },
    unit: { select: { name: true } },
} as const;

type EligibleEmployee = Awaited<ReturnType<typeof loadEligibleEmployees>>[number];

const loadEligibleEmployees = (periodStart: Date, periodEnd: Date) =>
    prisma.employee.findMany({
        where: eligibleEmployeeWhere(periodStart, periodEnd),
        select: EMPLOYEE_SELECT,
        orderBy: { fullName: 'asc' },
    });

/** How long a compute claim stays valid before it is treated as abandoned. See computePayrollRun. */
const STALE_CLAIM_MS = 5 * 60 * 1000;

const CANONICAL_RESIDENCY = ['RESDANT', 'DIRCT NONE RESDANT', 'NONE RESDANT'];

// Everything that stops a line from being payable. A blocked line is written with zeroed amounts
// and blocks submission — it is never quietly paid as zero, because a missing rate and a genuine
// zero month must not look the same.
const collectBlockReasons = (
    emp: EligibleEmployee,
    rate: number | null,
    attendance: PayrollAttendanceRow | undefined,
    periodStart: Date,
    periodEnd: Date,
): string[] => {
    const reasons: string[] = [];
    if (!emp.salaryStructureType) reasons.push('NO_STRUCTURE_LEVEL');
    else if (!emp.jobCategory) reasons.push('NO_JOB_CATEGORY');
    else if (!emp.jobGrade) reasons.push('NO_JOB_GRADE');
    else if (rate === null) reasons.push('NO_RATE_FOR_COMBINATION');
    if (!attendance) reasons.push('NO_ATTENDANCE');
    if (!emp.contractType || !CANONICAL_RESIDENCY.includes(emp.contractType)) reasons.push('NO_RESIDENCY');
    if (emp.separationDate && emp.separationDate <= periodEnd) reasons.push('FINAL_SETTLEMENT_PENDING');
    if (emp.joinDate && emp.joinDate >= periodStart) reasons.push('JOINED_MID_PERIOD');
    return reasons;
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs — the period list.
// ---------------------------------------------------------------------------------------------
export const listPayrollRuns = async (_req: Request, res: Response) => {
    try {
        const runs = await prisma.payrollRun.findMany({
            orderBy: [{ period: 'desc' }, { revision: 'desc' }],
            include: {
                totals: { where: { residencyType: 'ALL' } },
                _count: { select: { lines: true } },
            },
        });
        res.json(runs);
    } catch (error) {
        console.error('Error listing payroll runs:', error);
        res.status(500).json({ error: 'Failed to load payroll runs' });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id — header, per-currency totals and the approval chain. Not the lines:
// a run is the whole company, so lines are fetched separately and paginated.
// ---------------------------------------------------------------------------------------------
export const getPayrollRun = async (req: Request, res: Response) => {
    try {
        const run = await prisma.payrollRun.findUnique({
            where: { id: req.params.id },
            include: {
                totals: { orderBy: [{ currency: 'asc' }, { residencyType: 'asc' }] },
                steps: {
                    orderBy: [{ sequence: 'asc' }],
                    include: { approver: { select: { id: true, fullName: true, role: true } } },
                },
                _count: { select: { lines: true } },
            },
        });
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });

        const [blocked, excluded, reasonRows, pendingCorrections] = await Promise.all([
            prisma.payrollLine.count({ where: { runId: run.id, status: 'BLOCKED' } }),
            prisma.payrollLine.count({ where: { runId: run.id, status: 'EXCLUDED' } }),
            // blockReasons is a text[], so this needs unnest rather than a Prisma groupBy. A bare
            // count of blocked lines tells nobody what to go and fix; the breakdown does, and each
            // code maps to a different screen and a different person.
            prisma.$queryRaw<{ code: string; count: bigint }[]>`
                SELECT unnest("blockReasons") AS code, COUNT(*) AS count
                  FROM "PayrollLine"
                 WHERE "runId" = ${run.id} AND "status" = 'BLOCKED'
                 GROUP BY 1
                 ORDER BY 2 DESC`,
            // Manual corrections are stored on the override, which lives OUTSIDE the compute
            // rebuild — that is what makes them survive a recompute, but it also means one saved
            // after the last compute is not yet in any amount. Silently. This count is what turns
            // that into something the screen can say out loud.
            // Filtered in JS rather than SQL: Prisma's JSON null filter is awkward, the row
            // count per run is tiny, and parseManualItems is the same validator the engine uses —
            // so an override holding only an exclusion is correctly not counted as a correction.
            run.attendanceFetchedAt
                ? prisma.payrollLineOverride.findMany({
                    where: { runId: run.id, updatedAt: { gt: run.attendanceFetchedAt } },
                    select: { manualItems: true },
                }).then(rows => rows.filter(r => parseManualItems(r.manualItems).length > 0).length)
                : Promise.resolve(0),
        ]);
        res.json({
            ...run,
            blockedCount: blocked,
            excludedCount: excluded,
            blockReasonCounts: reasonRows.map(r => ({ code: r.code, count: Number(r.count) })),
            pendingCorrections,
        });
    } catch (error) {
        console.error('Error loading payroll run:', error);
        res.status(500).json({ error: 'Failed to load the payroll run' });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id/lines — paginated, filterable.
// ---------------------------------------------------------------------------------------------
export const listPayrollLines = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
        const { status, currency, residencyType, search } = req.query as Record<string, string | undefined>;

        const where: any = { runId: id };
        if (status) where.status = status;
        if (currency) where.currency = currency;
        if (residencyType) where.residencyType = residencyType;
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { staffId: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [total, lines] = await Promise.all([
            prisma.payrollLine.count({ where }),
            prisma.payrollLine.findMany({
                where,
                // Blocked lines first: they are the work queue, and nothing can be submitted while
                // any of them remain unresolved.
                orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
                include: { items: { orderBy: { createdAt: 'asc' } } },
            }),
        ]);
        res.json({ lines, total, page, limit, pages: Math.ceil(total / limit) || 1 });
    } catch (error) {
        console.error('Error listing payroll lines:', error);
        res.status(500).json({ error: 'Failed to load payroll lines' });
    }
};

/**
 * Resolves one line of a run from either its own id OR the employee's id.
 *
 * Compute is a destructive rebuild: every PayrollLine is deleted and re-created, so its id changes
 * on every recompute. A link built from the line id therefore dies the moment someone presses
 * Recompute — the page 404s and the specialist assumes the employee vanished. The employee id is
 * stable for the life of the run, so screens link by that and this accepts both.
 */
export const findRunLine = (runId: string, key: string, include?: any) =>
    prisma.payrollLine.findFirst({
        where: { runId, OR: [{ id: key }, { employeeId: key }] },
        ...(include ? { include } : {}),
    });

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/:id/lines/:lineId — one employee's full breakdown, raw attendance included.
// ---------------------------------------------------------------------------------------------
export const getPayrollLine = async (req: Request, res: Response) => {
    try {
        const line = await findRunLine(req.params.id, req.params.lineId, {
            items: { orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] },
            run: { select: { id: true, period: true, periodStart: true, periodEnd: true, status: true, approvedAt: true, lockedAt: true } },
        });
        if (!line) return res.status(404).json({ error: 'Payroll line not found' });
        res.json(line);
    } catch (error) {
        console.error('Error loading payroll line:', error);
        res.status(500).json({ error: 'Failed to load the payroll line' });
    }
};

// ---------------------------------------------------------------------------------------------
// GET /api/payroll-runs/preflight?period=YYYY-MM — what would block this period, before any run
// exists. Lets the data be cleaned up first instead of producing a run full of blocked lines.
// ---------------------------------------------------------------------------------------------
export const preflightPeriod = async (req: Request, res: Response) => {
    try {
        const period = String(req.query.period || currentPeriod());
        if (!isValidPeriod(period)) return res.status(400).json({ error: 'Invalid period. Expected YYYY-MM.' });

        const { start, end } = financialMonthRange(period);
        const [employees, structures] = await Promise.all([
            loadEligibleEmployees(start, end),
            prisma.salaryStructure.findMany(),
        ]);
        const rateMap = buildRateMap(structures);

        const issues: Record<string, { code: string; employees: { id: string; staffId: string | null; fullName: string | null }[] }> = {};
        const add = (code: string, emp: EligibleEmployee) => {
            if (!issues[code]) issues[code] = { code, employees: [] };
            issues[code].employees.push({ id: emp.id, staffId: emp.staffId, fullName: emp.fullName });
        };

        for (const emp of employees) {
            if (!emp.salaryStructureType) add('NO_STRUCTURE_LEVEL', emp);
            else if (resolveRate(rateMap, emp) === null) add('NO_RATE_FOR_COMBINATION', emp);
            if (!emp.contractType || !CANONICAL_RESIDENCY.includes(emp.contractType)) add('NO_RESIDENCY', emp);
            // A provider link and a non-provider residency disagree — the GM report and the
            // provider report would then contradict each other.
            if (emp.serviceProviderId && emp.contractType !== 'NONE RESDANT') add('PROVIDER_RESIDENCY_MISMATCH', emp);
            if (emp.separationDate && emp.separationDate <= end) add('FINAL_SETTLEMENT_PENDING', emp);
        }

        const existing = await prisma.payrollRun.findFirst({
            where: { period, status: { not: 'CANCELLED' } },
            select: { id: true, runNumber: true, status: true, revision: true },
        });

        res.json({
            period, label: periodLabel(period),
            periodStart: start, periodEnd: end,
            attendanceWindow: { start: toApiDate(start), end: toApiDate(end) },
            eligibleCount: employees.length,
            issues: Object.values(issues),
            existingRun: existing,
        });
    } catch (error) {
        console.error('Error running payroll preflight:', error);
        res.status(500).json({ error: 'Failed to run the payroll pre-flight check' });
    }
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-runs — open a period. Does not compute; that is a separate, repeatable step.
// ---------------------------------------------------------------------------------------------
export const createPayrollRun = async (req: AuthRequest, res: Response) => {
    try {
        const period = String(req.body?.period || '').trim();
        if (!isValidPeriod(period)) return res.status(400).json({ error: 'Invalid period. Expected YYYY-MM.' });

        const live = await prisma.payrollRun.findFirst({ where: { period, status: { not: 'CANCELLED' } } });
        if (live) {
            return res.status(409).json({
                error: `Payroll for ${periodLabel(period)} already exists (${live.runNumber}, ${live.status}). Cancel it before starting a new revision.`,
                runId: live.id,
            });
        }

        const priorRevisions = await prisma.payrollRun.count({ where: { period } });
        const { start, end } = financialMonthRange(period);

        const run = await prisma.payrollRun.create({
            data: {
                runNumber: await nextRunNumber(),
                period,
                revision: priorRevisions + 1,
                periodStart: start,
                periodEnd: end,
                cutoffAt: cutoffFor(period),
                createdById: req.user?.id || null,
                createdByName: req.user?.fullName || null,
            },
        });
        res.locals.auditDetails = `for ${periodLabel(period)} (${run.runNumber})`;
        res.status(201).json(run);
    } catch (error) {
        console.error('Error creating payroll run:', error);
        res.status(500).json({ error: 'Failed to create the payroll run' });
    }
};

// ---------------------------------------------------------------------------------------------
// Rate resolution. The whole 280-row table is loaded once into a Map — one compute is then a
// handful of queries rather than one per employee.
// ---------------------------------------------------------------------------------------------
type RateMap = Map<string, { hourlyRate: number; id: string }>;

const rateKey = (cat: string, grade: string, level: string) => `${cat}|${grade}|${level}`;

const buildRateMap = (rows: { id: string; jobCategory: string; jobGrade: string; structureLevel: string; hourlyRate: number }[]): RateMap => {
    const map: RateMap = new Map();
    for (const r of rows) map.set(rateKey(r.jobCategory, r.jobGrade, r.structureLevel), { hourlyRate: r.hourlyRate, id: r.id });
    return map;
};

const resolveRate = (map: RateMap, emp: { jobCategory: string | null; jobGrade: string | null; salaryStructureType: string | null }): number | null => {
    if (!emp.jobCategory || !emp.jobGrade || !emp.salaryStructureType) return null;
    return map.get(rateKey(emp.jobCategory, emp.jobGrade, emp.salaryStructureType))?.hourlyRate ?? null;
};

// ---------------------------------------------------------------------------------------------
// POST /api/payroll-runs/:id/compute
// ---------------------------------------------------------------------------------------------
export const computePayrollRun = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    let claimed = false;
    try {
        const run = await prisma.payrollRun.findUnique({ where: { id } });
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });

        const immutable = assertRunMutable(run);
        if (immutable) return res.status(409).json({ error: immutable });

        // Claim the run so two specialists pressing Compute cannot interleave. Conditional update:
        // whoever writes computingAt first wins, the other is told to wait.
        //
        // The claim is a LEASE, not a flag. It is released in a finally block, but a finally block
        // cannot run if the process dies mid-compute — and a claim left behind that way made the
        // period permanently uncomputable, with no way to clear it from any screen. So a claim
        // older than the lease is treated as abandoned and taken over.
        //
        // Five minutes is well above any legitimate compute (about 9s for 97 employees, up to ~70s
        // when the attendance service is retrying) and short enough that nobody waits on a crash.
        const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
        const claim = await prisma.payrollRun.updateMany({
            where: { id, OR: [{ computingAt: null }, { computingAt: { lt: staleBefore } }] },
            data: { computingAt: new Date() },
        });
        if (claim.count === 0) {
            return res.status(409).json({ error: 'This payroll run is already being computed. Try again in a moment.' });
        }
        claimed = true;

        const periodStart = run.periodStart;
        const periodEnd = run.periodEnd;

        // Attendance first, and OUTSIDE the transaction. If it cannot be read we abort having
        // written nothing — a half-built run is worse than no run.
        const attendance = await fetchPayrollAttendance(toApiDate(periodStart), toApiDate(periodEnd));

        const [employees, structures, providers, rewards, overrides] = await Promise.all([
            loadEligibleEmployees(periodStart, periodEnd),
            prisma.salaryStructure.findMany(),
            prisma.serviceProvider.findMany({ select: { id: true, name: true, percentage: true } }),
            // One predicate covers every award type, which is exactly what payoutPeriod is for.
            prisma.rewardCase.findMany({
                where: { completedAt: { not: null }, payoutPeriod: run.period, paidInRunId: null, bonusPercent: { gt: 0 } },
                select: { id: true, employeeId: true, bonusPercent: true, type: true, caseNumber: true },
            }),
            prisma.payrollLineOverride.findMany({ where: { runId: id } }),
        ]);

        const rateMap = buildRateMap(structures);
        const providerMap = new Map(providers.map(p => [p.id, p]));
        const overrideMap = new Map(overrides.map(o => [o.employeeId, o]));

        // Advances, standing deductions and manual corrections for this period. Loaded once for
        // the whole run rather than per employee, and applied read-only: nothing is consumed until
        // the period is closed, so Compute stays safe to press twice.
        const chargeMap = await loadPeriodCharges(
            run.period,
            employees.map(e => e.id),
            new Map(overrides.map(o => [o.employeeId, { manualItems: o.manualItems }])),
        );

        // The evaluation block the payslip prints. DISPLAY ONLY — it never alters an amount, and the
        // engine takes no evaluation input at all. Snapshotted here rather than read at print time so
        // a manager submitting a late evaluation cannot change a payslip already handed over.
        //
        // Sequential on purpose: each employee costs six small indexed reads, and firing ~100 x 6
        // concurrently against one pool is how a compute starts timing out under load.
        const evaluationMap = new Map<string, ReturnType<typeof evaluationSnapshot>>();
        for (const emp of employees) {
            const scores = await loadMonthlyEvaluationScores(prisma, emp.id, run.period);
            if (!scores.empty) evaluationMap.set(emp.id, evaluationSnapshot(scores));
        }
        const rewardsByEmployee = new Map<string, typeof rewards>();
        for (const r of rewards) {
            const list = rewardsByEmployee.get(r.employeeId) || [];
            list.push(r);
            rewardsByEmployee.set(r.employeeId, list);
        }

        // Warnings are stored as {code, count, detail} rather than as sentences, so the UI can
        // render them in the user's own language. The raw English strings the fetcher produces are
        // wrapped in a RAW code instead of being shown verbatim.
        const warnings: { code: string; count?: number; detail?: string }[] =
            attendance.warnings.map(w => ({ code: 'RAW', detail: w }));
        const unmatched = attendance.rows.filter(r => !employees.some(e => e.staffId === r.empCode)).length;
        if (unmatched) warnings.push({ code: 'UNMATCHED_ATTENDANCE_ROWS', count: unmatched });

        const lineData: any[] = [];
        const itemsByEmployee = new Map<string, any[]>();

        for (const emp of employees) {
            const att = emp.staffId ? attendance.byEmpCode.get(emp.staffId) : undefined;
            const rate = resolveRate(rateMap, emp);
            const override = overrideMap.get(emp.id);
            const reasons = collectBlockReasons(emp, rate, att, periodStart, periodEnd);

            let currency = 'LYD';
            try { currency = currencyOf(emp.salaryStructureType); }
            catch { if (!reasons.includes('NO_STRUCTURE_LEVEL')) reasons.push('NO_STRUCTURE_LEVEL'); }

            const empRewards = rewardsByEmployee.get(emp.id) || [];
            const bonusPercents = empRewards.map(r => Number(r.bonusPercent) || 0);
            // A typo of 300% must not pay triple salary; flag it rather than honour it.
            const bonusTotal = bonusPercents.reduce((a, b) => a + b, 0);
            const bonusCapped = bonusTotal > 100;
            if (bonusCapped) reasons.push('BONUS_CAP_EXCEEDED');

            const provider = emp.serviceProviderId ? providerMap.get(emp.serviceProviderId) : undefined;

            // A charge in another currency is never converted — there is no FX source here — so it
            // is withheld and the line is blocked rather than silently underpaying the deduction.
            const charges = applicableCharges(chargeMap.get(emp.id), currency);
            if (charges.currencyMismatches.length) reasons.push('DEDUCTION_CURRENCY_MISMATCH');

            const deductionAmounts = charges.items.filter(i => i.kind === 'DEDUCTION').map(i => i.amount);
            const correctionAmounts = charges.items.filter(i => i.kind === 'EARNING').map(i => i.amount);

            const amounts = computePayrollLine({
                hourlyRate: reasons.length && (reasons.includes('NO_STRUCTURE_LEVEL') || reasons.includes('NO_RATE_FOR_COMBINATION')) ? 0 : (rate ?? 0),
                workMins: att?.totalWorkMins ?? 0,
                approvedOtMins: att?.totalApprovedOTMins ?? 0,
                paidLeaveMins: att?.totalPaidMins ?? 0,
                positionFactor: emp.positionFactor,
                siteFactor: emp.siteFactor,
                skillFactor: emp.skillFactor,
                languageFactor: emp.languageFactor,
                bonusPercents: bonusCapped ? [] : bonusPercents,
                deductions: deductionAmounts,
                extraEarnings: correctionAmounts,
                serviceProviderPercentage: provider?.percentage ?? null,
            });

            if (amounts.netSalary < 0) reasons.push('NEGATIVE_NET');

            const blocked = reasons.some(r => [
                'NO_STRUCTURE_LEVEL', 'NO_JOB_CATEGORY', 'NO_JOB_GRADE', 'NO_RATE_FOR_COMBINATION',
                'NO_ATTENDANCE', 'NO_RESIDENCY', 'NEGATIVE_NET', 'BONUS_CAP_EXCEEDED', 'DEDUCTION_CURRENCY_MISMATCH',
            ].includes(r));
            const status = override?.excluded ? 'EXCLUDED' : blocked ? 'BLOCKED' : 'OK';
            const zeroed = status !== 'OK';

            const balances = calcLeaveBalances(emp);

            lineData.push({
                runId: id,
                employeeId: emp.id,
                staffId: emp.staffId, fullName: emp.fullName, fullNameArabic: emp.fullNameArabic,
                divisionName: emp.division?.name ?? null,
                departmentName: emp.department?.name ?? null,
                unitName: emp.unit?.name ?? null,
                positionTitle: emp.position, workLocation: emp.placeOfWork,
                bankName: emp.bankName, bankAccountNumber: emp.bankAccountNumber,
                passportNumber: emp.passportNumber, email: emp.email, nationality: emp.nationality,
                contractEndDate: emp.contractEndDate,
                residencyType: emp.contractType,
                jobCategory: emp.jobCategory, jobGrade: emp.jobGrade,
                structureLevel: emp.salaryStructureType, currency,
                hourlyRate: rate ?? 0,
                positionFactor: emp.positionFactor, siteFactor: emp.siteFactor,
                skillFactor: emp.skillFactor, languageFactor: emp.languageFactor,
                factorF: amounts.factorF,
                attendanceMatched: !!att, empCode: emp.staffId,
                workMins: att?.totalWorkMins ?? 0,
                otMins: att?.totalOTMins ?? 0,
                approvedOtMins: att?.totalApprovedOTMins ?? 0,
                paidLeaveMins: att?.totalPaidMins ?? 0,
                unpaidLeaveMins: att?.totalUnpaidLeaveMins ?? 0,
                lateMins: att?.totalLateMins ?? 0,
                earlyOutMins: att?.totalEarlyOutMins ?? 0,
                absenceDays: att?.absenceDays ?? 0,
                suspensionDays: att?.suspensionDays ?? 0,
                attendanceRaw: att ? (att as any) : undefined,
                basicHours: amounts.basicHours, overtimeHours: amounts.overtimeHours,
                totalWorkingHours: amounts.totalWorkingHours,
                paidAbsenceHours: amounts.paidAbsenceHours,
                unpaidHours: round2((att?.totalUnpaidLeaveMins ?? 0) / 60),
                basicSalary: zeroed ? 0 : amounts.basicSalary,
                positionAllowance: zeroed ? 0 : amounts.positionAllowance,
                siteAllowance: zeroed ? 0 : amounts.siteAllowance,
                languageAllowance: zeroed ? 0 : amounts.languageAllowance,
                skillAllowance: zeroed ? 0 : amounts.skillAllowance,
                paidAbsenceAmount: zeroed ? 0 : amounts.paidAbsenceAmount,
                bonusPercent: zeroed ? 0 : amounts.bonusPercent,
                bonusAmount: zeroed ? 0 : amounts.bonusAmount,
                totalEarnings: zeroed ? 0 : amounts.totalEarnings,
                deductionsTotal: zeroed ? 0 : amounts.deductionsTotal,
                netSalary: zeroed ? 0 : amounts.netSalary,
                // Outstanding advance AFTER this period's instalment. Printed in the DEDUCTIONS box
                // but deliberately NOT part of deductionsTotal — including it deducts twice.
                remainingAdvanceBalance: zeroed ? 0 : charges.remainingAdvanceBalance,
                serviceProviderId: provider?.id ?? null,
                serviceProviderName: provider?.name ?? null,
                serviceProviderPercentage: provider?.percentage ?? null,
                serviceProviderFee: zeroed ? 0 : amounts.serviceProviderFee,
                employerTotalCost: zeroed ? 0 : amounts.employerTotalCost,
                ...(evaluationMap.get(emp.id) ?? {
                    presenceScore: null, execScore: null, adminScore: null,
                    careScore: null, trainingScore: null, evaluationTotal: null,
                }),
                promotionEligibilityIndex: emp.evaluationPoints ?? null,
                paidLeaveBalance: balances.paid,
                unpaidLeaveBalance: balances.unpaid,
                emergencyLeaveBalance: balances.emergency,
                status,
                blockReasons: reasons,
                excludeReason: override?.excludeReason ?? null,
                reviewNote: override?.reviewNote ?? null,
            });

            if (!zeroed && charges.items.length) {
                itemsByEmployee.set(emp.id, charges.items.map(i => ({
                    kind: i.kind,
                    category: i.category,
                    label: i.label,
                    labelArabic: i.labelArabic,
                    amount: i.amount,
                    currency: i.currency,
                    sourceType: i.sourceType,
                    sourceId: i.sourceId ?? null,
                    advanceInstalmentId: i.advanceInstalmentId ?? null,
                    correctedRunId: i.correctedRunId ?? null,
                    correctedLineId: i.correctedLineId ?? null,
                    correctionNote: i.correctionNote ?? null,
                })));
            }

            if (!zeroed && empRewards.length) {
                const existing = itemsByEmployee.get(emp.id) || [];
                itemsByEmployee.set(emp.id, [...existing, ...empRewards.map(r => ({
                    kind: 'EARNING',
                    category: 'REWARD_BONUS',
                    label: `Bonus Allowance (${r.type.replace(/_/g, ' ').toLowerCase()})`,
                    labelArabic: 'بدل المكافأة',
                    amount: round2(amounts.basicSalary * (Number(r.bonusPercent) || 0) / 100),
                    currency,
                    percent: Number(r.bonusPercent) || 0,
                    sourceType: 'REWARD_CASE',
                    sourceId: r.id,
                    rewardCaseId: r.id,
                }))]);
            }
        }

        // Everything below is one transaction: a compute either fully replaces the run's contents
        // or leaves them exactly as they were.
        await prisma.$transaction(async (tx) => {
            await tx.payrollLineItem.deleteMany({ where: { line: { runId: id } } });
            await tx.payrollLine.deleteMany({ where: { runId: id } });
            await tx.payrollRunTotal.deleteMany({ where: { runId: id } });

            for (const data of lineData) {
                const created = await tx.payrollLine.create({ data });
                const items = data.employeeId ? itemsByEmployee.get(data.employeeId) : null;
                if (items?.length) {
                    await tx.payrollLineItem.createMany({ data: items.map((i: any) => ({ ...i, lineId: created.id })) });
                }
            }

            await tx.payrollRunTotal.createMany({ data: buildTotals(id, lineData) });

            await tx.payrollRun.update({
                where: { id },
                data: {
                    attendanceFetchedAt: attendance.fetchedAt,
                    attendanceSourceStart: attendance.sourceStart,
                    attendanceSourceEnd: attendance.sourceEnd,
                    attendanceRowCount: attendance.rows.length,
                    attendanceWarnings: warnings.length ? warnings : undefined,
                },
            });
        }, { timeout: 120_000 });

        const blockedCount = lineData.filter(l => l.status === 'BLOCKED').length;
        res.locals.auditDetails = `for ${periodLabel(run.period)} — ${lineData.length} line(s), ${blockedCount} blocked`;
        res.json({
            ok: true,
            lineCount: lineData.length,
            blockedCount,
            excludedCount: lineData.filter(l => l.status === 'EXCLUDED').length,
            attendanceRowCount: attendance.rows.length,
            attendanceAttempts: attendance.attempts,
            warnings,
        });
    } catch (error) {
        console.error('Error computing payroll run:', error);
        res.status(502).json({
            error: error instanceof Error ? error.message : 'Failed to compute the payroll run.',
        });
    } finally {
        // Always release the claim, including on the failure paths above.
        if (claimed) await prisma.payrollRun.update({ where: { id }, data: { computingAt: null } }).catch(() => { });
    }
};

const EMERGENCY_LEAVE_ALLOWANCE = 3;
const UNPAID_LEAVE_ALLOWANCE = 14;

// Remaining balances for the payslip's LEAVE ENTITLEMENT box. Mirrors calculateHolidayMetrics in
// employeeController (accrual is 1 day per 12 days of service) without importing it, so payroll
// does not take a dependency on that controller's module-load side effects.
const calcLeaveBalances = (emp: {
    contractStartDate: Date | null; holidaysUsed: number; bonusHolidays: number;
    emergencyHolidaysUsed: number; unpaidHolidaysUsed: number;
}) => {
    if (!emp.contractStartDate) {
        return {
            paid: 0,
            emergency: EMERGENCY_LEAVE_ALLOWANCE - (emp.emergencyHolidaysUsed || 0),
            unpaid: UNPAID_LEAVE_ALLOWANCE - (emp.unpaidHolidaysUsed || 0),
        };
    }
    const days = Math.floor(Math.max(0, Date.now() - new Date(emp.contractStartDate).getTime()) / 86_400_000);
    const earned = Math.floor(days / 12) + (emp.bonusHolidays || 0);
    return {
        paid: earned - (emp.holidaysUsed || 0),
        emergency: EMERGENCY_LEAVE_ALLOWANCE - (emp.emergencyHolidaysUsed || 0),
        unpaid: UNPAID_LEAVE_ALLOWANCE - (emp.unpaidHolidaysUsed || 0),
    };
};

// Totals are grouped per currency, and per currency x residency for the GM report's three blocks.
// Nothing is ever summed across currencies: there is no FX source in this system, and a combined
// figure would be a number Finance cannot reconcile against anything.
const buildTotals = (runId: string, lines: any[]) => {
    const acc = new Map<string, any>();
    const bump = (currency: string, residencyType: string, l: any) => {
        const key = `${currency}|${residencyType}`;
        const t = acc.get(key) || {
            runId, currency, residencyType, employeeCount: 0,
            basicTotal: 0, allowanceTotal: 0, paidLeaveTotal: 0, bonusTotal: 0,
            deductionTotal: 0, netTotal: 0, serviceProviderFeeTotal: 0, employerCostTotal: 0,
        };
        t.employeeCount += 1;
        t.basicTotal += l.basicSalary;
        t.allowanceTotal += l.positionAllowance + l.siteAllowance + l.languageAllowance + l.skillAllowance;
        t.paidLeaveTotal += l.paidAbsenceAmount;
        t.bonusTotal += l.bonusAmount;
        t.deductionTotal += l.deductionsTotal;
        t.netTotal += l.netSalary;
        t.serviceProviderFeeTotal += l.serviceProviderFee;
        t.employerCostTotal += l.employerTotalCost;
        acc.set(key, t);
    };

    for (const l of lines) {
        if (l.status === 'EXCLUDED') continue; // excluded lines are not paid and must not be totalled
        bump(l.currency, 'ALL', l);
        if (l.residencyType && CANONICAL_RESIDENCY.includes(l.residencyType)) bump(l.currency, l.residencyType, l);
    }

    return [...acc.values()].map(t => ({
        ...t,
        basicTotal: round2(t.basicTotal), allowanceTotal: round2(t.allowanceTotal),
        paidLeaveTotal: round2(t.paidLeaveTotal), bonusTotal: round2(t.bonusTotal),
        deductionTotal: round2(t.deductionTotal), netTotal: round2(t.netTotal),
        serviceProviderFeeTotal: round2(t.serviceProviderFeeTotal),
        employerCostTotal: round2(t.employerCostTotal),
    }));
};

// ---------------------------------------------------------------------------------------------
// PATCH /api/payroll-runs/:id/lines/:lineId — exclude a line or leave a review note. Stored as a
// PayrollLineOverride so the decision survives the next Compute, and mirrored onto the line so the
// current view is immediately correct.
// ---------------------------------------------------------------------------------------------
export const updatePayrollLine = async (req: AuthRequest, res: Response) => {
    try {
        const { id, lineId } = req.params;
        const run = await prisma.payrollRun.findUnique({ where: { id } });
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        const immutable = assertRunMutable(run);
        if (immutable) return res.status(409).json({ error: immutable });

        const line = await findRunLine(id, lineId);
        if (!line) return res.status(404).json({ error: 'Payroll line not found' });
        if (!line.employeeId) return res.status(400).json({ error: 'This line is no longer linked to an employee and cannot be edited.' });

        const excluded = req.body?.excluded === undefined ? line.status === 'EXCLUDED' : Boolean(req.body.excluded);
        const excludeReason = req.body?.excludeReason ? String(req.body.excludeReason).trim() : null;
        const reviewNote = req.body?.reviewNote ? String(req.body.reviewNote).trim() : null;
        if (excluded && !excludeReason) {
            return res.status(400).json({ error: 'Give a reason when excluding someone from a payroll run.' });
        }

        const [, updated] = await prisma.$transaction([
            prisma.payrollLineOverride.upsert({
                where: { runId_employeeId: { runId: id, employeeId: line.employeeId } },
                update: { excluded, excludeReason, reviewNote, createdByName: req.user?.fullName || null },
                create: { runId: id, employeeId: line.employeeId, excluded, excludeReason, reviewNote, createdByName: req.user?.fullName || null },
            }),
            prisma.payrollLine.update({
                // line.id, not the URL parameter — the parameter may have been an employee id.
                where: { id: line.id },
                data: {
                    status: excluded ? 'EXCLUDED' : (line.blockReasons.length ? 'BLOCKED' : 'OK'),
                    excludeReason, reviewNote,
                },
            }),
        ]);

        res.locals.auditDetails = `for ${line.fullName || 'an employee'} in ${periodLabel(run.period)}`;
        res.json(updated);
    } catch (error) {
        console.error('Error updating payroll line:', error);
        res.status(500).json({ error: 'Failed to update the payroll line' });
    }
};

// ---------------------------------------------------------------------------------------------
// DELETE /api/payroll-runs/:id — only while still a draft.
// ---------------------------------------------------------------------------------------------
export const deletePayrollRun = async (req: Request, res: Response) => {
    try {
        const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id } });
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        if (run.status !== 'DRAFT' || run.lockedAt || run.approvedAt) {
            return res.status(409).json({ error: 'Only a draft payroll run can be deleted. Cancel it instead.' });
        }
        await prisma.payrollRun.delete({ where: { id: run.id } });
        res.json({ message: 'Payroll run deleted' });
    } catch (error) {
        console.error('Error deleting payroll run:', error);
        res.status(500).json({ error: 'Failed to delete the payroll run' });
    }
};
