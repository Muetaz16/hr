import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import { generatePromotionReportDocx, generateNoticeOfPromotionDocx } from '../utils/promotionForms';
import { resolveDivisionHeadName } from './offboardingController';
import { JOB_GRADES, TOP_GRADE, getPromotionRule, monthsSince } from '../utils/jobGrades';
import { promotionReasonPrintLabel } from '../utils/promotionReasons';
import { resolveUsersWithPermission } from '../utils/leaveApprovalChain';

const prisma = new PrismaClient();

// "Head of Human Resources" / "Head of Human Resources Division" — resolved live the same way
// resolveDivisionHeadName resolves a Head of Division; the HR signatory is resolved by permission
// representing HR leadership (no dedicated "Head of HR" role exists). Also recognizes anyone whose
// real Position is a Head role but who holds the HR Manager Functional Hat (approve_hr_manager) —
// (approve_hr_manager) rather than by any role string.
async function resolveHeadOfHumanResources(): Promise<string> {
    // resolveUsersWithPermission also folds in SUPER_ADMIN as an authorization fallback — correct
    // for deciding who CAN act, but wrong for a printed signature name ("System Admin" must never
    // show up as "Head of Human Resources" on an official document), so it's excluded here.
    const hatHolderIds = await resolveUsersWithPermission(prisma, 'approve_hr_manager');
    const head = await prisma.user.findFirst({
        where: { id: { in: hatHolderIds }, role: { not: 'SUPER_ADMIN' } },
        select: { fullName: true },
    });
    return head?.fullName || '';
}

async function nextCaseNumber(): Promise<string> {
    const count = await prisma.promotionCase.count();
    return `IPH-CCHR-FRM-PROMOT-${String(count + 1).padStart(3, '0')}`;
}

const CASE_INCLUDE = {
    employee: {
        select: {
            id: true, fullName: true, staffId: true, position: true, enrollmentStatus: true,
            jobCategory: true, jobGrade: true, currentGradeSince: true, evaluationPoints: true,
            contractStartDate: true, joinDate: true,
            department: { select: { name: true, isOffice: true } },
            division: { select: { name: true } },
            unit: { select: { name: true } },
        },
    },
} as const;

const formatDate = (value: Date | string | null | undefined): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

const orNA = (value: string | null | undefined): string => (value && value.trim()) ? value : 'N/A';

// "March"/"April"/"May" on the Promotion Report are static template text, not real placeholders —
// the actual 3 months are the 3 calendar months immediately preceding the one the report is
// generated in, so the printed label must be overwritten to match. Single-language (English), same
// as every other value on this form.
function monthLabel(monthStr: string): string {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(d);
}

// The 3 calendar months immediately preceding the current one, most-recent-first — e.g. generated
// in August 2026 -> ["2026-07", "2026-06", "2026-05"]. Fixed by calendar position, NOT by "whichever
// 3 evaluations happen to exist" — a gap in one month must show N/A for that specific month rather
// than silently pulling in an older one and mislabeling every row after it.
function lastThreeCalendarMonths(): string[] {
    const now = new Date();
    const out: string[] = [];
    for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
}

// The day-31+ auto-finalize cron creates an EvaluationFinalization row (isAuto: true,
// finalizedById: null) for every employee regardless of whether anyone actually evaluated them
// that month — computeFinalScore simply sums whatever component records exist, defaulting to 0 when
// none do. So an isAuto row with finalScore 0 is ambiguous: it could be a genuine zero-rated
// evaluation, or a pure placeholder for a month nobody evaluated at all. Only checked for that
// specific ambiguous case (isAuto && score === 0) — a manually-finalized or nonzero score is always
// real data and never needs this.
async function hadRealEvaluationActivity(employeeId: string, month: string): Promise<boolean> {
    const models = ['unitEvaluation', 'departmentEvaluation', 'divisionEvaluation', 'directorEvaluation', 'gMEvaluation', 'chairmanEvaluation', 'personnelEvaluation', 'hREvaluation'];
    const p: any = prisma;
    const found = await Promise.all(models.map(m => p[m].findFirst({ where: { employeeId, month }, select: { id: true } })));
    return found.some(Boolean);
}

// GET /api/promotion-cases/candidates — HR-facing list of currently-eligible employees, computed
// live (not stored) so it always reflects the employee's current evaluationPoints/currentGradeSince.
// Excludes anyone already mid-promotion (an open, non-CLOSED case) so the same person can't be
// queued twice.
export const getCandidates = async (_req: Request, res: Response) => {
    try {
        const employees = await prisma.employee.findMany({
            where: {
                enrollmentStatus: 'ACTIVE',
                jobGrade: { in: JOB_GRADES.filter(g => g !== TOP_GRADE) as unknown as string[] },
            },
            select: {
                id: true, fullName: true, staffId: true, position: true,
                jobCategory: true, jobGrade: true, currentGradeSince: true, evaluationPoints: true,
                contractStartDate: true, joinDate: true,
                department: { select: { name: true, isOffice: true } },
                division: { select: { name: true } },
                unit: { select: { name: true } },
            },
        });

        const openCases = await prisma.promotionCase.findMany({
            where: { stage: { not: 'CLOSED' } },
            select: { employeeId: true },
        });
        const openEmployeeIds = new Set(openCases.map(c => c.employeeId));

        const candidates = employees
            .filter(emp => !openEmployeeIds.has(emp.id))
            .map(emp => {
                const rule = getPromotionRule(emp.jobGrade);
                if (!rule) return null;
                const anchor = emp.currentGradeSince || emp.contractStartDate || emp.joinDate;
                if (rule.type === 'TENURE') {
                    const months = monthsSince(anchor);
                    if (months < rule.months) return null;
                    return {
                        employeeId: emp.id, employee: emp,
                        toGrade: rule.nextGrade, basis: 'TENURE' as const,
                        progress: { months, required: rule.months },
                    };
                }
                const points = emp.evaluationPoints || 0;
                if (points < rule.threshold) return null;
                return {
                    employeeId: emp.id, employee: emp,
                    toGrade: rule.nextGrade, basis: 'EVALUATION' as const,
                    progress: { points, required: rule.threshold },
                };
            })
            .filter(Boolean);

        res.json(candidates);
    } catch (error: any) {
        console.error('Error fetching promotion candidates:', error);
        res.status(500).json({ error: 'Failed to fetch promotion candidates' });
    }
};

// POST /api/promotion-cases/from-candidate — body: { employeeId }. Idempotent: a second click while
// a case is already open for this employee just returns it, rather than erroring or duplicating.
export const createCaseFromCandidate = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.body;
        if (!employeeId) return res.status(400).json({ error: 'The employee is required.' });

        const existing = await prisma.promotionCase.findFirst({
            where: { employeeId, stage: { not: 'CLOSED' } },
            include: CASE_INCLUDE,
        });
        if (existing) return res.status(200).json(existing);

        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!emp) return res.status(404).json({ error: 'Employee not found.' });

        const rule = getPromotionRule(emp.jobGrade);
        if (!rule) return res.status(400).json({ error: 'This employee is not eligible for promotion.' });
        const anchor = emp.currentGradeSince || emp.contractStartDate || emp.joinDate;
        const eligible = rule.type === 'TENURE'
            ? monthsSince(anchor) >= rule.months
            : (emp.evaluationPoints || 0) >= rule.threshold;
        if (!eligible) return res.status(400).json({ error: 'This employee no longer meets the promotion eligibility criteria.' });

        const caseNumber = await nextCaseNumber();
        const created = await prisma.promotionCase.create({
            data: {
                employeeId, caseNumber,
                toGrade: rule.nextGrade,
                basis: rule.type,
                // "Reason for Promotion" is never chosen by a person — it's fully determined by the
                // eligibility basis that got this employee here, printed as-is on the form.
                reason: rule.type === 'TENURE' ? 'JOB_GRADE_BASED' : 'PERFORMANCE_BASED',
                stage: 'NOTICE_OF_PROMOTION',
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error creating promotion case:', error);
        res.status(500).json({ error: 'Failed to create the promotion case' });
    }
};

// POST /api/promotion-cases/exceptional — body: { employeeId, toGrade }. Skips straight to
// PROMOTION_REPORT (the final/closing stage) — there is no eligibility check here by design (that's
// the point of "exceptional"). "Reason for Promotion" is fixed to Others — same as every other case,
// it's derived from the promotion's type (here, "exceptional"), never chosen by a person.
export const createExceptionalCase = async (req: Request, res: Response) => {
    try {
        const { employeeId, toGrade } = req.body;
        if (!employeeId) return res.status(400).json({ error: 'The employee is required.' });
        if (!JOB_GRADES.includes(toGrade)) return res.status(400).json({ error: 'A valid target job grade is required.' });

        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!emp) return res.status(404).json({ error: 'Employee not found.' });

        const existing = await prisma.promotionCase.findFirst({ where: { employeeId, stage: { not: 'CLOSED' } } });
        if (existing) return res.status(400).json({ error: 'This employee already has an open promotion case.' });

        const caseNumber = await nextCaseNumber();
        const created = await prisma.promotionCase.create({
            data: {
                employeeId, caseNumber,
                toGrade,
                reason: 'OTHERS',
                basis: 'EXCEPTIONAL',
                isExceptional: true,
                stage: 'PROMOTION_REPORT',
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error creating exceptional promotion case:', error);
        res.status(500).json({ error: 'Failed to create the exceptional promotion case' });
    }
};

// GET /api/promotion-cases?stage=&employeeId= — HR-facing.
export const listCases = async (req: Request, res: Response) => {
    try {
        const { stage, employeeId } = req.query;
        const cases = await prisma.promotionCase.findMany({
            where: {
                ...(stage ? { stage: String(stage) } : {}),
                ...(employeeId ? { employeeId: String(employeeId) } : {}),
            },
            include: CASE_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
    } catch (error: any) {
        console.error('Error listing promotion cases:', error);
        res.status(500).json({ error: 'Failed to list promotion cases' });
    }
};

export const getCase = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const found = await prisma.promotionCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        res.json(found);
    } catch (error: any) {
        console.error('Error fetching promotion case:', error);
        res.status(500).json({ error: 'Failed to fetch promotion case' });
    }
};

// POST /api/promotion-cases/:id/form/:stage — generates the filled .docx for whichever stage the
// case is at. Effectivity Date is the ONLY value a person provides — everything else (identity, org
// placement, new job title/category, the last-3-months evaluation summary, "Reason for Promotion",
// "Overall performance rating", and every approver name) is derived automatically.
export const generateStageForm = async (req: Request, res: Response) => {
    try {
        const { id, stage } = req.params;
        const draft = req.body || {};
        const found = await prisma.promotionCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        // Effectivity Date is entered once, on whichever stage the case starts at (Notice of
        // Promotion normally, Promotion Report for exceptional cases that skip straight there) — it
        // is never asked for again on a later stage.
        if (!found.effectiveDate && !draft.effectiveDate) return res.status(400).json({ error: 'Effectivity date is required.' });

        const empData: any = found.employee;
        const safeName = (empData?.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');

        const persistData: Record<string, any> = {};
        if (!found.effectiveDate && draft.effectiveDate) persistData.effectiveDate = new Date(draft.effectiveDate);
        // "Overall performance rating" IS the Evaluation Index — snapshotted at generation time so
        // the printed value and the Case History display stay in sync even if it changes later.
        // Same for the last-3-months summary: scores are persisted (real month labels recomputed
        // live each time from EvaluationFinalization, not stored) so Case History can show what was
        // printed even after the stage completes.
        let performanceMonths: { label: string; value: string }[] = [];
        if (stage === 'PROMOTION_REPORT') {
            persistData.overallPerformanceRating = (empData?.evaluationPoints ?? 0).toFixed(2);
            const targetMonths = lastThreeCalendarMonths();
            const rows = await prisma.evaluationFinalization.findMany({
                where: { employeeId: found.employeeId, month: { in: targetMonths } },
            });
            const byMonth = new Map(rows.map(r => [r.month, r]));
            performanceMonths = await Promise.all(targetMonths.map(async month => {
                const row = byMonth.get(month);
                if (!row) return { label: monthLabel(month), value: 'N/A' };
                if (row.isAuto && row.finalScore === 0 && !(await hadRealEvaluationActivity(found.employeeId, month))) {
                    return { label: monthLabel(month), value: 'N/A' };
                }
                return { label: monthLabel(month), value: `${row.finalScore.toFixed(2)}%` };
            }));
            persistData.performanceMarch = performanceMonths[0]?.value ?? null;
            persistData.performanceApril = performanceMonths[1]?.value ?? null;
            persistData.performanceMay = performanceMonths[2]?.value ?? null;
        }
        const merged = await prisma.promotionCase.update({ where: { id }, data: persistData, include: CASE_INCLUDE });
        const mergedEmp: any = merged.employee;

        const orgUnit = {
            division: orNA(mergedEmp?.division?.name),
            department: orNA(mergedEmp?.department?.name),
        };
        const employeeName = mergedEmp?.fullName || '';
        const reasonForPromotion = promotionReasonPrintLabel(merged.reason);
        const effectivityDate = formatDate(merged.effectiveDate);

        let buffer: Buffer;
        let filename: string;

        if (stage === 'PROMOTION_REPORT') {
            const [headOfDivision, headOfHumanResourcesDivision] = await Promise.all([
                resolveDivisionHeadName(found.employeeId),
                resolveHeadOfHumanResources(),
            ]);
            buffer = generatePromotionReportDocx({
                employeeId: orNA(mergedEmp?.staffId),
                employeeName,
                division: orgUnit.division,
                department: orgUnit.department,
                jobTitle: orNA(mergedEmp?.position),
                jobCategory: orNA(mergedEmp?.jobCategory),
                jobGrade: orNA(mergedEmp?.jobGrade),
                // A promotion is a grade change, not a title/category change — both already exist on
                // the employee's record, so they carry over unless someone later edits the employee.
                newJobTitle: orNA(mergedEmp?.position),
                newJobCategory: orNA(mergedEmp?.jobCategory),
                newJobGrade: merged.toGrade,
                effectivityDate,
                reasonForPromotion,
                performanceMonths,
                overallPerformanceRating: merged.overallPerformanceRating || undefined,
                headOfDivision: orNA(headOfDivision),
                // The person who opened this case is the report's preparer.
                performanceManagementSpecialist: orNA(found.createdByName),
                headOfHumanResourcesDivision: orNA(headOfHumanResourcesDivision),
            });
            filename = `Promotion_Report_${safeName}.docx`;
        } else if (stage === 'NOTICE_OF_PROMOTION') {
            if (found.isExceptional) return res.status(400).json({ error: 'Exceptional promotions skip the Notice of Promotion stage.' });
            const headOfHumanResources = await resolveHeadOfHumanResources();
            buffer = generateNoticeOfPromotionDocx({
                employeeId: orNA(mergedEmp?.staffId),
                employeeName,
                division: orgUnit.division,
                department: orgUnit.department,
                jobTitle: orNA(mergedEmp?.position),
                jobCategory: orNA(mergedEmp?.jobCategory),
                jobGrade: orNA(mergedEmp?.jobGrade),
                newJobTitle: orNA(mergedEmp?.position),
                newJobCategory: orNA(mergedEmp?.jobCategory),
                newJobGrade: merged.toGrade,
                effectivityDate,
                reasonForPromotion,
                headOfHumanResources: orNA(headOfHumanResources),
            });
            filename = `Notice_of_Promotion_${safeName}.docx`;
        } else {
            return res.status(400).json({ error: 'Unknown stage.' });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating promotion form:', error);
        res.status(500).json({ error: 'Failed to generate form', details: error.message });
    }
};

// POST /api/promotion-cases/:id/complete-notice-of-promotion — body: { documentUrl, documentName }.
// Notice of Promotion is now the FIRST stage — completing it just advances to Promotion Report.
export const completeNoticeOfPromotion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Notice of Promotion before continuing.' });

        const found = await prisma.promotionCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'NOTICE_OF_PROMOTION') return res.status(400).json({ error: `Cannot complete the Notice of Promotion for a case at stage ${found.stage}.` });

        const updated = await prisma.promotionCase.update({
            where: { id },
            data: {
                noticeOfPromotionDocumentUrl: documentUrl,
                noticeOfPromotionDocumentName: documentName || null,
                noticeOfPromotionCompletedAt: new Date(),
                stage: 'PROMOTION_REPORT',
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing notice of promotion:', error);
        res.status(500).json({ error: 'Failed to complete the notice of promotion' });
    }
};

// POST /api/promotion-cases/:id/complete-promotion-report — body: { documentUrl, documentName }.
// Promotion Report is now the LAST stage — this is the actual promotion: closes the case and
// applies the grade change + eligibility-clock reset to the employee in one transaction.
// Salary/positionFactor are deliberately left untouched.
export const completePromotionReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Promotion Report before continuing.' });

        const found = await prisma.promotionCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'PROMOTION_REPORT') return res.status(400).json({ error: `Cannot complete the Promotion Report for a case at stage ${found.stage}.` });

        const now = new Date();
        const [updated] = await prisma.$transaction([
            prisma.promotionCase.update({
                where: { id },
                data: {
                    promotionReportDocumentUrl: documentUrl,
                    promotionReportDocumentName: documentName || null,
                    promotionReportCompletedAt: now,
                    stage: 'CLOSED',
                    closedAt: now,
                },
                include: CASE_INCLUDE,
            }),
            prisma.employee.update({
                where: { id: found.employeeId },
                data: { jobGrade: found.toGrade, currentGradeSince: now, evaluationPoints: 0 },
            }),
        ]);
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing promotion report:', error);
        res.status(500).json({ error: 'Failed to complete the promotion report' });
    }
};
