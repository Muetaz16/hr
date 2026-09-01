import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import {
    computeMonthCandidates, computeAttendanceCandidates, checkLoyaltyMilestones,
    computeEmployeeOfYearCandidates,
    currentCycleMonth,
} from '../utils/rewardEligibility';
import { generateAppreciationLetterDocx } from '../utils/rewardForms';
import { resolveUsersWithPermission } from '../utils/leaveApprovalChain';

const prisma = new PrismaClient();

// Role ∪ permission/hat ∪ SUPER_ADMIN — mirrors leaveApprovalChain.ts's GENERAL_MANAGER /
// HEAD_ATTENDANCE union exactly (resolveUsersWithPermission alone only covers raw grants/hats/
// SUPER_ADMIN, not role-based defaults, so the role list is always OR'd in separately). Exported
// for staffHubController.ts to notify HR once an Exceptional Performance nomination's approval
// chain completes and a draft RewardCase is ready to finalize.
export async function resolveHrRecipients(): Promise<string[]> {
    const roleHolders = await prisma.user.findMany({ where: { role: { in: ['HR_MANAGER', 'PERSONNEL'] } }, select: { id: true } });
    return Array.from(new Set([...roleHolders.map(u => u.id), ...(await resolveUsersWithPermission(prisma, 'manage_rewards'))]));
}

// Exported so staffHubController.ts's Exceptional Performance completion hook can create the
// RewardCase with a properly-formatted, sequential case number, matching every other award type.
export async function nextCaseNumber(): Promise<string> {
    const count = await prisma.rewardCase.count();
    return `IPH-CCHR-FRM-REWARD-${String(count + 1).padStart(3, '0')}`;
}

const CASE_INCLUDE = {
    employee: {
        select: {
            id: true, fullName: true, staffId: true, position: true, jobCategory: true, jobGrade: true,
            joinDate: true,
            department: { select: { name: true, isOffice: true } },
            division: { select: { name: true } },
            unit: { select: { name: true } },
        },
    },
} as const;

// The current month's EvaluationFinalization rows don't exist yet — default to the most recently
// completed calendar month.
function defaultCompletedMonth(): string {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const isValidMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

// GET /api/reward-cases/candidates/month?month=YYYY-MM — HR-triggered on demand, never automatic.
export const getMonthCandidates = async (req: Request, res: Response) => {
    try {
        const month = isValidMonth(req.query.month) ? req.query.month : defaultCompletedMonth();
        const candidates = await computeMonthCandidates(month);
        res.json({ month, candidates });
    } catch (error: any) {
        console.error('Error computing Employee of the Month candidates:', error);
        res.status(500).json({ error: 'Failed to compute candidates' });
    }
};

// GET /api/reward-cases/candidates/attendance?month=YYYY-MM
export const getAttendanceCandidatesHandler = async (req: Request, res: Response) => {
    try {
        const month = isValidMonth(req.query.month) ? req.query.month : currentCycleMonth();
        const result = await computeAttendanceCandidates(month);
        res.json(result);
    } catch (error: any) {
        console.error('Error computing Attendance Excellence candidates:', error);
        res.status(500).json({ error: 'Failed to compute candidates' });
    }
};

// GET /api/reward-cases/candidates/loyalty
export const getLoyaltyMilestoneCandidates = async (_req: Request, res: Response) => {
    try {
        const { candidates, excluded } = await checkLoyaltyMilestones();
        res.json({ candidates, excluded });
    } catch (error: any) {
        console.error('Error checking loyalty milestones:', error);
        res.status(500).json({ error: 'Failed to check milestones' });
    }
};

const isValidYear = (v: unknown): v is string => typeof v === 'string' && /^\d{4}$/.test(v);

// GET /api/reward-cases/candidates/year?year=YYYY — filtered per the user's explicit confirmation
// (12-month tenure, 12-month disciplinary-free, at least one Employee of the Month win this year);
// the final pick among these candidates is still manual, per computeEmployeeOfYearCandidates's header.
export const getEmployeeOfYearCandidates = async (req: Request, res: Response) => {
    try {
        const year = isValidYear(req.query.year) ? req.query.year : String(new Date().getFullYear());
        const candidates = await computeEmployeeOfYearCandidates(year);
        res.json({ year, candidates });
    } catch (error: any) {
        console.error('Error computing Employee of the Year candidates:', error);
        res.status(500).json({ error: 'Failed to compute candidates' });
    }
};

// The 3 endpoints below back the candidate review page — each just re-runs the same live compute
// function and picks out one match (no separate eligibility logic to duplicate/drift), and never
// return employee identity fields since the frontend already has employeeService.getEmployeeById
// for that. A 404 here means the employee is no longer eligible since the list was fetched.

// GET /api/reward-cases/candidates/month/:employeeId?period=YYYY-MM
export const getMonthCandidateDetail = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const period = isValidMonth(req.query.period) ? req.query.period : defaultCompletedMonth();
        const candidates = await computeMonthCandidates(period);
        const match = candidates.find(c => c.employeeId === employeeId);
        if (!match) return res.status(404).json({ error: 'This employee is not an eligible Employee of the Month candidate for this period.' });
        res.json({ period, finalScore: match.finalScore, rank: match.rank });
    } catch (error: any) {
        console.error('Error fetching Employee of the Month candidate detail:', error);
        res.status(500).json({ error: 'Failed to fetch candidate detail' });
    }
};

// GET /api/reward-cases/candidates/attendance/:employeeId?period=YYYY-MM
export const getAttendanceCandidateDetail = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const period = isValidMonth(req.query.period) ? req.query.period : currentCycleMonth();
        const result = await computeAttendanceCandidates(period);
        const match = result.candidates.find(c => c.employeeId === employeeId);
        if (!match) return res.status(404).json({ error: 'This employee is not an eligible Attendance Excellence candidate for this period.' });
        res.json({
            period, cycleStart: result.cycleStart, cycleEnd: result.cycleEnd,
            attendanceSummary: match.attendanceSummary,
            hasLeaveRequestFiled: match.hasLeaveRequestFiled,
            hasConfirmedDisciplinaryRecord: match.hasConfirmedDisciplinaryRecord,
        });
    } catch (error: any) {
        console.error('Error fetching Attendance Excellence candidate detail:', error);
        res.status(500).json({ error: 'Failed to fetch candidate detail' });
    }
};

// GET /api/reward-cases/candidates/loyalty/:employeeId?milestoneYears=5|10
export const getLoyaltyCandidateDetail = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const milestoneYears = Number(req.query.milestoneYears);
        if (milestoneYears !== 5 && milestoneYears !== 10) return res.status(400).json({ error: 'A valid milestoneYears (5 or 10) is required.' });
        const { candidates } = await checkLoyaltyMilestones();
        const match = candidates.find(c => c.employeeId === employeeId && c.milestoneYears === milestoneYears);
        if (!match) return res.status(404).json({ error: 'This employee does not currently qualify for this milestone.' });
        res.json({ milestoneYears: match.milestoneYears, milestoneDate: match.milestoneDate, tenureMonths: match.tenureMonths });
    } catch (error: any) {
        console.error('Error fetching Loyalty Milestone candidate detail:', error);
        res.status(500).json({ error: 'Failed to fetch candidate detail' });
    }
};

// GET /api/reward-cases/candidates/year/:employeeId?year=YYYY
export const getYearCandidateDetail = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const year = isValidYear(req.query.year) ? req.query.year : String(new Date().getFullYear());
        const candidates = await computeEmployeeOfYearCandidates(year);
        const match = candidates.find(c => c.employeeId === employeeId);
        if (!match) return res.status(404).json({ error: 'This employee is not an eligible Employee of the Year candidate for this year.' });
        res.json({ year, tenureMonths: match.tenureMonths, monthWinsThisYear: match.monthWinsThisYear });
    } catch (error: any) {
        console.error('Error fetching Employee of the Year candidate detail:', error);
        res.status(500).json({ error: 'Failed to fetch candidate detail' });
    }
};

// POST /api/reward-cases/employee-of-month — body: { employeeId, month }. Opens a DRAFT case only —
// nothing is applied to the employee until completeReward runs (signed document uploaded). A single
// instant-grant button was tried first and replaced after the user flagged it as too easy to misclick
// for an action with real, hard-to-reverse effects.
export const createMonthCase = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.body;
        if (!employeeId || !isValidMonth(month)) return res.status(400).json({ error: 'employeeId and a valid month are required.' });

        const existing = await prisma.rewardCase.findFirst({ where: { type: 'EMPLOYEE_OF_MONTH', period: month } });
        if (existing) return res.status(400).json({ error: 'Employee of the Month has already been opened for this month.' });

        const candidates = await computeMonthCandidates(month);
        const winner = candidates.find(c => c.employeeId === employeeId);
        if (!winner) return res.status(400).json({ error: 'This employee is no longer an eligible candidate for this month.' });

        const caseNumber = await nextCaseNumber();
        const created = await prisma.rewardCase.create({
            data: {
                employeeId, caseNumber, type: 'EMPLOYEE_OF_MONTH', period: month,
                finalScoreSnapshot: winner.finalScore, bonusLeaveDaysGranted: 1,
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error opening Employee of the Month case:', error);
        res.status(500).json({ error: 'Failed to open the case' });
    }
};

// POST /api/reward-cases/attendance-excellence — body: { employeeId, month }. Draft only — see createMonthCase.
export const createAttendanceCase = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.body;
        if (!employeeId || !isValidMonth(month)) return res.status(400).json({ error: 'employeeId and a valid month are required.' });

        const existing = await prisma.rewardCase.findFirst({ where: { employeeId, type: 'ATTENDANCE_EXCELLENCE', period: month } });
        if (existing) return res.status(400).json({ error: 'This employee already has an Attendance Excellence case open for this month.' });

        const { candidates } = await computeAttendanceCandidates(month);
        const eligible = candidates.some(c => c.employeeId === employeeId);
        if (!eligible) return res.status(400).json({ error: 'This employee is no longer an eligible candidate for this month.' });

        const caseNumber = await nextCaseNumber();
        const created = await prisma.rewardCase.create({
            data: {
                employeeId, caseNumber, type: 'ATTENDANCE_EXCELLENCE', period: month, bonusLeaveDaysGranted: 1,
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error opening Attendance Excellence case:', error);
        res.status(500).json({ error: 'Failed to open the case' });
    }
};

// POST /api/reward-cases/loyalty-milestone — body: { employeeId, milestoneYears }. Draft only — see createMonthCase.
export const createLoyaltyCase = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.body;
        const milestoneYears = Number(req.body.milestoneYears);
        if (!employeeId || (milestoneYears !== 5 && milestoneYears !== 10)) {
            return res.status(400).json({ error: 'employeeId and milestoneYears (5 or 10) are required.' });
        }

        const existing = await prisma.rewardCase.findFirst({ where: { employeeId, type: 'LOYALTY_MILESTONE', milestoneYears } });
        if (existing) return res.status(400).json({ error: `This employee already has a ${milestoneYears}-year Loyalty Milestone case.` });

        const { candidates } = await checkLoyaltyMilestones();
        const match = candidates.find(c => c.employeeId === employeeId && c.milestoneYears === milestoneYears);
        if (!match) return res.status(400).json({ error: 'This employee no longer qualifies for this milestone.' });

        const caseNumber = await nextCaseNumber();
        const created = await prisma.rewardCase.create({
            data: {
                employeeId, caseNumber, type: 'LOYALTY_MILESTONE', milestoneYears,
                milestoneDate: match.milestoneDate, bonusPercent: milestoneYears,
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error opening Loyalty Milestone case:', error);
        res.status(500).json({ error: 'Failed to open the case' });
    }
};

// POST /api/reward-cases/employee-of-year — body: { employeeId, year?, notes?, bonusPercent? }.
// The pick among eligible candidates is still manual (HR/management judgement, evaluation shown only
// as reference) but the pool itself is now hard-gated against computeEmployeeOfYearCandidates, per
// the user's explicit confirmation — no longer "no eligibility check beyond one winner per year".
// Draft only — see createMonthCase.
export const createEmployeeOfYearAward = async (req: Request, res: Response) => {
    try {
        const { employeeId, notes, bonusPercent } = req.body;
        const year = req.body.year ? String(req.body.year) : String(new Date().getFullYear());
        if (!employeeId) return res.status(400).json({ error: 'The employee is required.' });
        if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'A valid year is required.' });

        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!emp) return res.status(404).json({ error: 'Employee not found.' });

        const yearCandidates = await computeEmployeeOfYearCandidates(year);
        if (!yearCandidates.some(c => c.employeeId === employeeId)) {
            return res.status(400).json({ error: 'This employee is no longer an eligible Employee of the Year candidate for this year.' });
        }

        const existing = await prisma.rewardCase.findFirst({ where: { type: 'EMPLOYEE_OF_YEAR', period: year } });
        if (existing) return res.status(400).json({ error: `Employee of the Year has already been opened for ${year}.` });

        const caseNumber = await nextCaseNumber();
        const created = await prisma.rewardCase.create({
            data: {
                employeeId, caseNumber, type: 'EMPLOYEE_OF_YEAR', period: year,
                notes: notes || null,
                bonusPercent: bonusPercent !== undefined && bonusPercent !== null && bonusPercent !== '' ? Number(bonusPercent) : null,
                bonusLeaveDaysGranted: 3,
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error opening Employee of the Year case:', error);
        res.status(500).json({ error: 'Failed to open the case' });
    }
};

// POST /api/reward-cases/:id/complete — body: { documentUrl, documentName }. The signed document
// (collected outside the system, then uploaded here) is what actually applies the award: only now
// does bonusLeaveDaysGranted get credited to the employee. Mirrors every other case module's
// generate-form -> collect signature -> upload-signed-copy -> complete cycle.
export const completeReward = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed document before completing this award.' });

        const found = await prisma.rewardCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Reward case not found.' });
        if (found.completedAt) return res.status(400).json({ error: 'This reward case has already been completed.' });

        const now = new Date();
        const ops: any[] = [
            prisma.rewardCase.update({
                where: { id },
                data: { documentUrl, documentName: documentName || null, completedAt: now },
                include: CASE_INCLUDE,
            }),
        ];
        if (found.bonusLeaveDaysGranted > 0) {
            ops.push(prisma.employee.update({ where: { id: found.employeeId }, data: { bonusHolidays: { increment: found.bonusLeaveDaysGranted } } }));
        }
        const [updated] = await prisma.$transaction(ops);
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing reward case:', error);
        res.status(500).json({ error: 'Failed to complete the reward case' });
    }
};

// GET /api/reward-cases?type=&employeeId=&period=
export const listRewards = async (req: Request, res: Response) => {
    try {
        const { type, employeeId, period } = req.query;
        const cases = await prisma.rewardCase.findMany({
            where: {
                ...(type ? { type: String(type) } : {}),
                ...(employeeId ? { employeeId: String(employeeId) } : {}),
                ...(period ? { period: String(period) } : {}),
            },
            include: CASE_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
    } catch (error: any) {
        console.error('Error listing reward cases:', error);
        res.status(500).json({ error: 'Failed to list rewards' });
    }
};

export const getReward = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const found = await prisma.rewardCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Reward case not found.' });
        res.json(found);
    } catch (error: any) {
        console.error('Error fetching reward case:', error);
        res.status(500).json({ error: 'Failed to fetch reward case' });
    }
};

const AWARD_TITLES: Record<string, string> = {
    EMPLOYEE_OF_MONTH: 'Employee of the Month',
    ATTENDANCE_EXCELLENCE: 'Monthly Attendance and Timeliness Excellence Award',
    EMPLOYEE_OF_YEAR: 'Employee of the Year',
    LOYALTY_MILESTONE: 'Loyalty & Service Milestone Award',
    EXCEPTIONAL_PERFORMANCE: 'Exceptional Performance / Exceptional Contribution Award',
};

// 'YYYY-MM' -> "July 2026", 'YYYY' -> "2026" (printed as-is, nothing to reformat).
function formatPeriodLabel(period: string): string {
    if (/^\d{4}-\d{2}$/.test(period)) {
        const [y, m] = period.split('-').map(Number);
        return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    }
    return period;
}

function typeOfAppreciationLabel(rc: { type: string; period: string | null; milestoneYears: number | null }): string {
    const title = AWARD_TITLES[rc.type] || rc.type;
    if (rc.period) return `${title} (${formatPeriodLabel(rc.period)})`;
    if (rc.milestoneYears) return `${title} — ${rc.milestoneYears} Years`;
    return title;
}

function rewardDescription(rc: { type: string; milestoneYears: number | null; bonusLeaveDaysGranted: number; bonusPercent: number | null }): string {
    const parts: string[] = [];
    if (rc.bonusLeaveDaysGranted > 0) {
        parts.push(`${rc.bonusLeaveDaysGranted} additional day${rc.bonusLeaveDaysGranted === 1 ? '' : 's'} of paid annual leave`);
    }
    if (rc.type === 'EMPLOYEE_OF_YEAR') parts.push('a Certificate of Appreciation');
    if (rc.type === 'LOYALTY_MILESTONE') parts.push(rc.milestoneYears === 10 ? 'a commemorative plaque/trophy' : 'an engraved watch');
    if (rc.bonusPercent != null) parts.push(`a one-time bonus of ${rc.bonusPercent}% of salary (pending Payroll integration)`);
    return parts.length ? parts.join(', ') : 'N/A';
}

// POST /api/reward-cases/:id/appreciation-letter — single-shot generate + stamp, no signature/upload
// step (a letter needs none), same pattern as offboardingController's issueCertificateOfEmployment.
export const generateAppreciationLetter = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const found = await prisma.rewardCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Reward case not found.' });
        const emp: any = found.employee;

        const buffer = generateAppreciationLetterDocx({
            employeeId: emp?.staffId || '',
            employeeName: emp?.fullName || '',
            referenceNo: found.caseNumber,
            issuedDate: new Date().toLocaleDateString('en-US'),
            typeOfAppreciation: typeOfAppreciationLabel(found),
            reward: rewardDescription(found),
            annualDaysAdded: found.bonusLeaveDaysGranted > 0 ? String(found.bonusLeaveDaysGranted) : 'N/A',
        });

        await prisma.rewardCase.update({ where: { id }, data: { appreciationLetterIssuedAt: new Date() } });

        const safeName = (emp?.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Appreciation_Letter_${safeName}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating appreciation letter:', error);
        res.status(500).json({ error: 'Failed to generate form', details: error.message });
    }
};

// POST /api/reward-cases/:id/physical-reward — body: { note? }. Logs that HR has physically handed
// over the Certificate of Appreciation (Employee of the Year) or the engraved watch/plaque (Loyalty
// Milestone) — both are fulfilled entirely outside the system, this is just an on/off record.
export const markPhysicalRewardFulfilled = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const found = await prisma.rewardCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Reward case not found.' });
        if (found.type !== 'EMPLOYEE_OF_YEAR' && found.type !== 'LOYALTY_MILESTONE') {
            return res.status(400).json({ error: 'This award has no physical reward component.' });
        }
        if (!found.completedAt) return res.status(400).json({ error: 'Complete the reward case (upload the signed document) before handing over the physical item.' });
        const updated = await prisma.rewardCase.update({
            where: { id },
            data: { physicalRewardFulfilledAt: new Date(), physicalRewardNote: note || null },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error marking physical reward fulfilled:', error);
        res.status(500).json({ error: 'Failed to update the reward case' });
    }
};
