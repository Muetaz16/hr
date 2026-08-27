import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import {
    VIOLATIONS_BY_ID, DISCIPLINARY_ACTION_LABELS, DISCIPLINARY_CATEGORY_LABELS, resolveActionType,
    TARDINESS_VIOLATION_ID, UNAUTHORIZED_ABSENCE_VIOLATION_ID, CONSECUTIVE_ABSENCE_VIOLATION_ID,
    SUSPENSION_DAYS, type DisciplinaryActionType,
} from '../utils/disciplinaryViolations';
import { generateIncidentReportDocx, generateNoticeToExplainDocx, generateInvestigationResultDocx, generateDisciplinaryActionDocx } from '../utils/disciplinaryForms';
import { fetchAttendanceSummary, currentCycleMonth, getPresenceWindow, type AttendanceSummary } from '../utils/disciplinaryAttendance';
import { createBioTimeSuspension } from '../utils/attendanceApiProxy';
import { createOffboardingCaseForTermination } from './offboardingController';

// The 3 Annex I violations objectively provable from attendance data alone, and the rule that
// decides whether a given cycle's summary trips each one.
// SER-09 and MAJ-07 both stem from the same underlying signal (unauthorized absence days) — once
// the absence has escalated into a 3+ day consecutive streak, it's one continuous incident that
// belongs under MAJ-07 alone, not two separate violations for the same days off. SER-09 only fires
// when the absence hasn't (yet) crossed that escalation threshold.
const ATTENDANCE_VIOLATION_RULES: { violationId: string; check: (s: AttendanceSummary) => boolean; detail: (s: AttendanceSummary) => string }[] = [
    { violationId: TARDINESS_VIOLATION_ID, check: s => s.lateDays >= 5, detail: s => `${s.lateDays} late arrivals` },
    { violationId: UNAUTHORIZED_ABSENCE_VIOLATION_ID, check: s => s.unauthorizedAbsenceDays >= 1 && s.maxConsecutiveAbsenceDays <= 3, detail: s => `${s.unauthorizedAbsenceDays} unauthorized absence day(s)` },
    { violationId: CONSECUTIVE_ABSENCE_VIOLATION_ID, check: s => s.maxConsecutiveAbsenceDays > 3, detail: s => `${s.maxConsecutiveAbsenceDays} consecutive absent days` },
];

const prisma = new PrismaClient();

async function notifyUsers(userIds: (string | null | undefined)[], title: string, content: string, link?: string) {
    try {
        const unique = Array.from(new Set(userIds.filter((u): u is string => !!u)));
        if (unique.length === 0) return;
        await prisma.notification.createMany({
            data: unique.map(userId => ({ userId, title, content, link: link || null })),
        });
    } catch (e) {
        console.error('[Disciplinary][Notify] Failed to write notifications (non-fatal):', e);
    }
}

async function findUsersWithPermission(permissionId: string): Promise<string[]> {
    const hats = await prisma.functionalHat.findMany({ where: { permissions: { has: permissionId } }, select: { id: true } });
    const hatIds = hats.map(h => h.id);
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { role: 'SUPER_ADMIN' },
                { permissions: { has: permissionId } },
                ...(hatIds.length ? [{ functionalHatIds: { hasSome: hatIds } }] : []),
            ],
        },
        select: { id: true },
    });
    return users.map(u => u.id);
}

async function nextCaseNumber(): Promise<string> {
    const count = await prisma.disciplinaryCase.count();
    return `IPH-CCHR-FRM-INCREP-${String(count + 1).padStart(3, '0')}`;
}

const CASE_INCLUDE = {
    employee: { select: { id: true, fullName: true, staffId: true, position: true, department: { select: { name: true } } } },
    evidence: true,
} as const;

const formatDate = (value: Date | string | null | undefined): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

// Not every employee has a department (e.g. a Director sitting above the org chart) — a blank
// position/department on the printed form reads as an omission, not as "doesn't apply". Same
// convention as offboardingController.ts's orNA, with an Arabic-side fallback for the forms' own
// separate Arabic value cells.
const orNA = (value: string | null | undefined): string => (value && value.trim()) ? value : 'N/A';
const orNAAr = (value: string | null | undefined): string => (value && value.trim()) ? value : 'غير منطبق';

// POST /api/disciplinary-cases/incident-report — any authenticated employee, about themselves or
// a colleague. The subject employee is resolved/linked automatically (the frontend sends the real
// employeeId once it has matched the typed name against an actual employee record). No violation
// type is captured here — that's confirmed later at Investigation Result. The filer chooses
// up front whether to be identified to HR (`isAnonymous`) — when identified, the name/email come
// straight from their own account (never client-typed, so it can't be spoofed); when anonymous,
// both stay null for HR's view. Either way `reportedById` is always recorded internally for
// accountability since this page requires login — true anonymity from the system itself doesn't
// exist, only from HR's view of the case.
export const createIncidentReport = async (req: Request, res: Response) => {
    try {
        const {
            employeeId, reportedDate, incidentDate, incidentPlace, incidentDescription,
            subjectPositionTitle, subjectDepartment, isAnonymous,
        } = req.body;
        const authUser = (req as AuthRequest).user;

        if (!employeeId) return res.status(400).json({ error: 'The subject employee is required.' });
        if (!incidentDate) return res.status(400).json({ error: 'The date the incident happened is required.' });
        if (!incidentPlace) return res.status(400).json({ error: 'The place of the incident is required.' });
        if (!incidentDescription) return res.status(400).json({ error: 'A description of the incident is required.' });

        const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { department: true } });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const caseNumber = await nextCaseNumber();

        const created = await prisma.disciplinaryCase.create({
            data: {
                employeeId,
                caseNumber,
                source: 'EMPLOYEE_REPORT',
                reportedById: authUser?.id || null,
                reportedByName: isAnonymous ? null : (authUser?.fullName || null),
                reportedByEmail: isAnonymous ? null : (authUser?.email || null),
                reportedDate: reportedDate ? new Date(reportedDate) : new Date(),
                subjectPositionTitle: subjectPositionTitle || employee.position || null,
                subjectDepartment: subjectDepartment || (employee as any).department?.name || null,
                incidentDate: new Date(incidentDate),
                incidentPlace,
                incidentDescription,
                stage: 'INCIDENT_REPORT',
                createdByName: authUser?.fullName || null,
            },
            include: CASE_INCLUDE,
        });

        const hrUserIds = await findUsersWithPermission('manage_disciplinary');
        await notifyUsers(hrUserIds, 'New disciplinary incident report', `A new incident report (${caseNumber}) was filed concerning ${employee.fullName}.`, '/personnel-relations/disciplinary');

        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error creating incident report:', error);
        res.status(500).json({ error: 'Failed to create incident report', details: error.message });
    }
};

// GET /api/disciplinary-cases/mine — the authenticated employee's own submitted reports, coarse
// status only. No HR gate: any authenticated user may see their own filing history, but never
// anyone else's, and never any investigation detail (mirrors the confidentiality of the process).
export const getMyReports = async (req: Request, res: Response) => {
    try {
        const authUser = (req as AuthRequest).user;
        if (!authUser?.id) return res.status(401).json({ error: 'Not authenticated.' });

        const cases = await prisma.disciplinaryCase.findMany({
            where: { reportedById: authUser.id },
            select: {
                id: true, caseNumber: true, reportedDate: true, incidentDate: true,
                stage: true, closureReason: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
    } catch (error: any) {
        console.error('Error fetching my disciplinary reports:', error);
        res.status(500).json({ error: 'Failed to fetch your reports' });
    }
};

// GET /api/disciplinary-cases?stage=&source=
export const listCases = async (req: Request, res: Response) => {
    try {
        const { stage, source } = req.query;
        const cases = await prisma.disciplinaryCase.findMany({
            where: {
                ...(stage ? { stage: String(stage) } : {}),
                ...(source ? { source: String(source) } : {}),
            },
            include: CASE_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
    } catch (error: any) {
        console.error('Error listing disciplinary cases:', error);
        res.status(500).json({ error: 'Failed to list disciplinary cases' });
    }
};

export const getCasesByEmployee = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const cases = await prisma.disciplinaryCase.findMany({
            where: { employeeId },
            include: CASE_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
    } catch (error: any) {
        console.error('Error fetching disciplinary cases for employee:', error);
        res.status(500).json({ error: 'Failed to fetch disciplinary cases' });
    }
};

export const getCase = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const found = await prisma.disciplinaryCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        res.json(found);
    } catch (error: any) {
        console.error('Error fetching disciplinary case:', error);
        res.status(500).json({ error: 'Failed to fetch disciplinary case' });
    }
};

// POST /api/disciplinary-cases/:id/form/:stage — generates the filled .docx for whichever stage
// the case currently is, ready for physical signing. A POST (not GET) because the stage-specific
// fields (investigation result/recommendation/action-taken, notice-to-explain description, the
// chosen disciplinary action, etc.) are still being drafted in the UI at this point and aren't
// persisted until the matching `complete-*` call — the body carries those in-progress values so
// the generated document reflects what's about to be submitted, falling back to whatever is
// already saved on the case (useful for regenerating a copy later).
export const generateStageForm = async (req: Request, res: Response) => {
    try {
        const { id, stage } = req.params;
        const draft = req.body || {};
        const found = await prisma.disciplinaryCase.findUnique({
            where: { id },
            include: { employee: { include: { department: true } } },
        });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        const emp: any = found.employee;
        const violationId = draft.confirmedViolationId || found.violationId;
        const violation = VIOLATIONS_BY_ID[violationId];

        let buffer: Buffer;
        let filename: string;
        const safeName = (emp?.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');

        const subjectEmployee = emp?.fullName || '';
        const subjectEmployeeAr = emp?.fullNameArabic || '';
        const positionTitle = orNA(found.subjectPositionTitle || emp?.position);
        const positionTitleAr = orNAAr(found.subjectPositionTitleAr);
        const department = orNA(found.subjectDepartment || emp?.department?.name);
        const departmentAr = orNAAr(found.subjectDepartmentAr);
        const place = found.incidentPlace || '';
        const placeAr = found.incidentPlaceAr || '';
        const description = found.incidentDescription || '';
        const descriptionAr = found.incidentDescriptionAr || '';

        if (stage === 'INCIDENT_REPORT') {
            buffer = generateIncidentReportDocx({
                caseNumber: found.caseNumber,
                dateReported: formatDate(found.reportedDate || found.createdAt),
                subjectEmployee, subjectEmployeeAr,
                positionTitle, positionTitleAr,
                divisionDepartment: department, divisionDepartmentAr: departmentAr,
                dateHappened: formatDate(found.incidentDate),
                placeOfIncident: place, placeOfIncidentAr: placeAr,
                description, descriptionAr,
                preparedBy: draft.preparedByName || found.preparedByName || (req as AuthRequest).user?.fullName || '',
                preparedByAr: draft.preparedByNameAr || found.preparedByNameAr || '',
            });
            filename = `Incident_Report_${safeName}.docx`;
        } else if (stage === 'NOTICE_TO_EXPLAIN') {
            // HR rewrites the original intake description into formal/academic language for the
            // printed notice (the intake description itself is never touched). The frontend
            // pre-fills this textarea from the intake description as a starting point, so it's
            // almost always non-empty even before HR has actually rewritten anything — only treat
            // it as a genuine rewrite (and print its own Arabic version instead of the intake's)
            // once it no longer matches the original intake text verbatim.
            const draftDescription = draft.noticeToExplainDescription ?? found.noticeToExplainDescription;
            const isRewritten = !!draftDescription && draftDescription !== description;
            const rewrittenAr = draft.noticeToExplainDescriptionAr ?? found.noticeToExplainDescriptionAr;
            buffer = generateNoticeToExplainDocx({
                employeeId: emp?.staffId || '',
                employeeName: subjectEmployee, employeeNameAr: subjectEmployeeAr,
                dateHappened: formatDate(found.incidentDate),
                placeOfIncident: place, placeOfIncidentAr: placeAr,
                description: draftDescription || description,
                descriptionAr: isRewritten ? (rewrittenAr || '') : descriptionAr,
            });
            filename = `Notice_to_Explain_${safeName}.docx`;
        } else if (stage === 'INVESTIGATION_RESULT') {
            buffer = generateInvestigationResultDocx({
                caseNumber: found.caseNumber,
                date: formatDate(new Date()),
                subjectEmployee,
                positionTitle,
                divisionDepartment: department,
                placeOfIncident: place,
                dateHappened: formatDate(found.incidentDate),
                outcome: (draft.investigationOutcome as any) || (found.investigationOutcome as any) || (found.category as any) || 'MINOR',
                result: draft.investigationResult || found.investigationResult || '',
                resultAr: draft.investigationResultAr || found.investigationResultAr || '',
                recommendation: draft.investigationRecommendation || found.investigationRecommendation || '',
                recommendationAr: draft.investigationRecommendationAr || found.investigationRecommendationAr || '',
                actionTaken: draft.investigationActionTaken || found.investigationActionTaken || '',
                actionTakenAr: draft.investigationActionTakenAr || found.investigationActionTakenAr || '',
                preparedBy: (req as AuthRequest).user?.fullName || '',
            });
            filename = `Investigation_Result_${safeName}.docx`;
        } else if (stage === 'DISCIPLINARY_ACTION') {
            const actionType = draft.actionType || found.actionType || resolveActionType(violationId, found.offenseNumber || 1);
            buffer = generateDisciplinaryActionDocx({
                employeeId: emp?.staffId || '',
                employeeName: subjectEmployee,
                actionTypeLabel: actionType ? DISCIPLINARY_ACTION_LABELS[actionType as keyof typeof DISCIPLINARY_ACTION_LABELS] : '',
                categoryLabel: DISCIPLINARY_CATEGORY_LABELS[(violation?.category || found.category || 'MINOR') as keyof typeof DISCIPLINARY_CATEGORY_LABELS],
                offenseNumber: String(found.offenseNumber || 1),
                violationDescription: violation?.description || '',
                effectiveStartDate: formatDate(draft.actionEffectiveDate || found.actionEffectiveDate || new Date()),
                additionalInfo: draft.actionAdditionalInfo || found.actionAdditionalInfo || '',
            });
            filename = `Notice_of_Disciplinary_Action_${safeName}.docx`;
        } else {
            return res.status(400).json({ error: 'Unknown stage.' });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating disciplinary form:', error);
        res.status(500).json({ error: 'Failed to generate form', details: error.message });
    }
};

// POST /api/disciplinary-cases/:id/complete-incident-report — body: { documentUrl, documentName }
export const completeIncidentReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Incident Report before continuing.' });
        const actorId = (req as AuthRequest).user?.id || null;

        const found = await prisma.disciplinaryCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'INCIDENT_REPORT') return res.status(400).json({ error: `Cannot complete the Incident Report for a case at stage ${found.stage}.` });

        const updated = await prisma.disciplinaryCase.update({
            where: { id },
            data: {
                incidentReportDocumentUrl: documentUrl,
                incidentReportDocumentName: documentName || null,
                incidentReportCompletedAt: new Date(),
                incidentReportCompletedById: actorId,
                stage: 'NOTICE_TO_EXPLAIN',
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing incident report:', error);
        res.status(500).json({ error: 'Failed to complete the incident report' });
    }
};

// POST /api/disciplinary-cases/:id/dismiss-incident-report — HR reviewed the complaint and decided
// it doesn't warrant proceeding to Notice to Explain. Requires both the reviewed document and a
// written reason, and closes the case immediately (no investigation ever happens).
export const dismissIncidentReport = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName, closureReason } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the reviewed Incident Report before closing the case.' });
        if (!closureReason || !String(closureReason).trim()) return res.status(400).json({ error: 'A reason for closing the case is required.' });
        const actorId = (req as AuthRequest).user?.id || null;

        const found = await prisma.disciplinaryCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'INCIDENT_REPORT') return res.status(400).json({ error: `Cannot dismiss a case at stage ${found.stage}.` });

        const updated = await prisma.disciplinaryCase.update({
            where: { id },
            data: {
                incidentReportDocumentUrl: documentUrl,
                incidentReportDocumentName: documentName || null,
                incidentReportCompletedAt: new Date(),
                incidentReportCompletedById: actorId,
                closureReason: String(closureReason).trim(),
                stage: 'CLOSED',
                closedAt: new Date(),
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error dismissing incident report:', error);
        res.status(500).json({ error: 'Failed to dismiss the case' });
    }
};

// PATCH /api/disciplinary-cases/:id — edits the descriptive/translatable intake fields. Available
// regardless of stage since these are informational, not workflow-controlling (unlike the
// stage-specific complete-* actions, which are gated by the case's current stage).
export const updateCaseDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            reportedDate, reportedByName, reportedByEmail, preparedByName, preparedByNameAr, incidentDate,
            subjectPositionTitle, subjectPositionTitleAr, subjectDepartment, subjectDepartmentAr,
            incidentPlace, incidentPlaceAr, incidentDescription, incidentDescriptionAr,
            noticeToExplainDescription, noticeToExplainDescriptionAr,
            investigationOutcome, investigationResult, investigationResultAr,
            investigationRecommendation, investigationRecommendationAr,
            investigationActionTaken, investigationActionTakenAr,
            actionType,
        } = req.body;

        const found = await prisma.disciplinaryCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });

        // The original report's own fields (position/department/place/description/etc.) are only
        // editable while the case is still at Incident Report — once it has moved on, changing the
        // record of what was originally reported requires the dedicated override permission.
        const REPORT_FIELD_KEYS = [
            'reportedDate', 'reportedByName', 'reportedByEmail', 'preparedByName', 'preparedByNameAr', 'incidentDate',
            'subjectPositionTitle', 'subjectPositionTitleAr', 'subjectDepartment', 'subjectDepartmentAr',
            'incidentPlace', 'incidentPlaceAr', 'incidentDescription', 'incidentDescriptionAr',
        ];
        const touchesReportFields = REPORT_FIELD_KEYS.some(key => req.body[key] !== undefined);
        if (touchesReportFields && found.stage !== 'INCIDENT_REPORT') {
            const authUser = (req as AuthRequest).user;
            const canOverride = authUser?.role === 'SUPER_ADMIN' || (authUser?.permissions || []).includes('edit_disciplinary_report');
            if (!canOverride) return res.status(403).json({ error: 'Editing the original report is locked once the case has moved past Incident Report.' });
        }

        const updated = await prisma.disciplinaryCase.update({
            where: { id },
            data: {
                ...(reportedDate !== undefined ? { reportedDate: reportedDate ? new Date(reportedDate) : null } : {}),
                ...(reportedByName !== undefined ? { reportedByName: reportedByName || null } : {}),
                ...(reportedByEmail !== undefined ? { reportedByEmail: reportedByEmail || null } : {}),
                ...(preparedByName !== undefined ? { preparedByName: preparedByName || null } : {}),
                ...(preparedByNameAr !== undefined ? { preparedByNameAr: preparedByNameAr || null } : {}),
                ...(incidentDate !== undefined ? { incidentDate: incidentDate ? new Date(incidentDate) : null } : {}),
                ...(subjectPositionTitle !== undefined ? { subjectPositionTitle: subjectPositionTitle || null } : {}),
                ...(subjectPositionTitleAr !== undefined ? { subjectPositionTitleAr: subjectPositionTitleAr || null } : {}),
                ...(subjectDepartment !== undefined ? { subjectDepartment: subjectDepartment || null } : {}),
                ...(subjectDepartmentAr !== undefined ? { subjectDepartmentAr: subjectDepartmentAr || null } : {}),
                ...(incidentPlace !== undefined ? { incidentPlace: incidentPlace || null } : {}),
                ...(incidentPlaceAr !== undefined ? { incidentPlaceAr: incidentPlaceAr || null } : {}),
                ...(incidentDescription !== undefined ? { incidentDescription: incidentDescription || null } : {}),
                ...(incidentDescriptionAr !== undefined ? { incidentDescriptionAr: incidentDescriptionAr || null } : {}),
                ...(noticeToExplainDescription !== undefined ? { noticeToExplainDescription: noticeToExplainDescription || null } : {}),
                ...(noticeToExplainDescriptionAr !== undefined ? { noticeToExplainDescriptionAr: noticeToExplainDescriptionAr || null } : {}),
                ...(investigationOutcome !== undefined ? { investigationOutcome: investigationOutcome || null } : {}),
                ...(investigationResult !== undefined ? { investigationResult: investigationResult || null } : {}),
                ...(investigationResultAr !== undefined ? { investigationResultAr: investigationResultAr || null } : {}),
                ...(investigationRecommendation !== undefined ? { investigationRecommendation: investigationRecommendation || null } : {}),
                ...(investigationRecommendationAr !== undefined ? { investigationRecommendationAr: investigationRecommendationAr || null } : {}),
                ...(investigationActionTaken !== undefined ? { investigationActionTaken: investigationActionTaken || null } : {}),
                ...(investigationActionTakenAr !== undefined ? { investigationActionTakenAr: investigationActionTakenAr || null } : {}),
                ...(actionType !== undefined ? { actionType: actionType || null } : {}),
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error updating disciplinary case details:', error);
        res.status(500).json({ error: 'Failed to update case details' });
    }
};

// POST /api/disciplinary-cases/:id/complete-notice-to-explain
// body: { noticeToExplainDescription, noticeToExplainDescriptionAr, documentUrl, documentName }
export const completeNoticeToExplain = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { noticeToExplainDescription, noticeToExplainDescriptionAr, documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Notice to Explain before continuing.' });
        const actorId = (req as AuthRequest).user?.id || null;

        const found = await prisma.disciplinaryCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'NOTICE_TO_EXPLAIN') return res.status(400).json({ error: `Cannot complete the Notice to Explain for a case at stage ${found.stage}.` });

        const updated = await prisma.disciplinaryCase.update({
            where: { id },
            data: {
                noticeToExplainDescription: noticeToExplainDescription || null,
                noticeToExplainDescriptionAr: noticeToExplainDescriptionAr || null,
                noticeToExplainDocumentUrl: documentUrl,
                noticeToExplainDocumentName: documentName || null,
                noticeToExplainCompletedAt: new Date(),
                noticeToExplainCompletedById: actorId,
                stage: 'INVESTIGATION_RESULT',
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing notice to explain:', error);
        res.status(500).json({ error: 'Failed to complete the notice to explain' });
    }
};

// POST /api/disciplinary-cases/:id/complete-investigation-result
// body: { confirmedViolationId?, investigationOutcome, investigationResult,
//         investigationRecommendation, investigationActionTaken, documentUrl, documentName }
// The Panel / Head of HR / Administrative Director sign-off is printed on this ONE document and
// collected physically — there is no separate system approval gate for them.
export const completeInvestigationResult = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            confirmedViolationId, investigationOutcome,
            investigationResult, investigationResultAr,
            investigationRecommendation, investigationRecommendationAr,
            investigationActionTaken, investigationActionTakenAr,
            actionType, documentUrl, documentName,
        } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Investigation Result before continuing.' });
        if (!investigationOutcome) return res.status(400).json({ error: 'A Code of Conduct violation status is required.' });
        const actorId = (req as AuthRequest).user?.id || null;

        const found = await prisma.disciplinaryCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'INVESTIGATION_RESULT') return res.status(400).json({ error: `Cannot complete the Investigation Result for a case at stage ${found.stage}.` });

        let violationId = found.violationId;
        let category = found.category;
        if (confirmedViolationId && confirmedViolationId !== found.violationId && VIOLATIONS_BY_ID[confirmedViolationId]) {
            violationId = confirmedViolationId;
            category = VIOLATIONS_BY_ID[confirmedViolationId].category;
        }

        const isNonViolation = investigationOutcome === 'NON_VIOLATION';
        let offenseNumber = found.offenseNumber;
        if (!isNonViolation) {
            const priorCount = await prisma.disciplinaryCase.count({
                where: { employeeId: found.employeeId, violationId, NOT: { id: found.id } },
            });
            offenseNumber = priorCount + 1;
        }

        const updated = await prisma.disciplinaryCase.update({
            where: { id },
            data: {
                violationId,
                category,
                offenseNumber,
                investigationOutcome,
                investigationResult: investigationResult || null,
                investigationResultAr: investigationResultAr || null,
                investigationRecommendation: investigationRecommendation || null,
                investigationRecommendationAr: investigationRecommendationAr || null,
                investigationActionTaken: investigationActionTaken || null,
                investigationActionTakenAr: investigationActionTakenAr || null,
                // The action HR selects here (from the confirmed violation's own penalty ladder)
                // carries straight into the Disciplinary Action stage as its pre-filled default —
                // that stage's own select still lets HR confirm or override it before finalizing.
                ...(actionType ? { actionType } : {}),
                investigationDocumentUrl: documentUrl,
                investigationDocumentName: documentName || null,
                investigationCompletedAt: new Date(),
                investigationCompletedById: actorId,
                stage: isNonViolation ? 'CLOSED' : 'DISCIPLINARY_ACTION',
                closedAt: isNonViolation ? new Date() : null,
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing investigation result:', error);
        res.status(500).json({ error: 'Failed to complete the investigation result' });
    }
};

// POST /api/disciplinary-cases/:id/complete-disciplinary-action
// body: { actionType, actionEffectiveDate, actionAdditionalInfo, documentUrl, documentName }
export const completeDisciplinaryAction = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { actionType, actionEffectiveDate, actionAdditionalInfo, documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Notice of Disciplinary Action before closing the case.' });
        if (!actionType) return res.status(400).json({ error: 'The disciplinary action type is required.' });
        const actorId = (req as AuthRequest).user?.id || null;

        const found = await prisma.disciplinaryCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'DISCIPLINARY_ACTION') return res.status(400).json({ error: `Cannot complete the Disciplinary Action for a case at stage ${found.stage}.` });

        const updated = await prisma.disciplinaryCase.update({
            where: { id },
            data: {
                actionType,
                actionEffectiveDate: actionEffectiveDate ? new Date(actionEffectiveDate) : new Date(),
                actionAdditionalInfo: actionAdditionalInfo || null,
                actionDocumentUrl: documentUrl,
                actionDocumentName: documentName || null,
                actionCompletedAt: new Date(),
                actionCompletedById: actorId,
                stage: 'CLOSED',
                closedAt: new Date(),
            },
            include: CASE_INCLUDE,
        });

        // Suspension-type actions register directly in the attendance system so those days are
        // excluded from the employee's absence count and paid as unpaid, instead of just being a
        // record in our own DB. Fail-soft — the case still closes even if the sync fails, but the
        // response says so (biotimeSuspensionSynced: false) so the frontend can flag it.
        const suspensionDays = SUSPENSION_DAYS[actionType as DisciplinaryActionType];
        let biotimeSuspensionSynced: boolean | undefined;
        if (suspensionDays && updated.employee?.staffId) {
            const start = updated.actionEffectiveDate as Date;
            const end = new Date(start);
            end.setDate(end.getDate() + suspensionDays - 1);
            const reason = `${updated.caseNumber} — ${updated.violationId ? VIOLATIONS_BY_ID[updated.violationId]?.description : 'Disciplinary action'}`;
            const result = await createBioTimeSuspension({ empCode: updated.employee.staffId, startDate: start, endDate: end, reason });
            biotimeSuspensionSynced = result.success;
            if (!result.success) console.error(`[DISCIPLINARY] Failed to sync suspension to BioTime for case ${updated.caseNumber}:`, result.message);
        }

        // A Termination penalty is the trigger point for Involuntary Offboarding — auto-create the
        // linked case (starting straight at Clearance) rather than requiring HR to remember to open
        // one manually. Fail-soft, same convention as the BioTime suspension sync above.
        let offboardingCase: { id: string; caseNumber: string } | null = null;
        if (actionType === 'TERMINATION') {
            offboardingCase = await createOffboardingCaseForTermination({
                employeeId: updated.employeeId,
                disciplinaryCaseId: updated.id,
                disciplinaryCaseNumber: updated.caseNumber,
            });
        }

        res.json({ ...updated, biotimeSuspensionSynced, offboardingCase });
    } catch (error: any) {
        console.error('Error completing disciplinary action:', error);
        res.status(500).json({ error: 'Failed to complete the disciplinary action' });
    }
};

// POST /api/disciplinary-cases/:id/evidence — multer-handled multi-file upload.
export const addEvidence = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const files = (req.files as Express.Multer.File[]) || [];
        if (!files.length) return res.status(400).json({ error: 'At least one file is required.' });

        const found = await prisma.disciplinaryCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });

        const authUser = (req as AuthRequest).user;
        const isHr = authUser?.role === 'SUPER_ADMIN' || (authUser?.permissions || []).includes('manage_disciplinary');
        const isOwnFreshReport = found.source === 'EMPLOYEE_REPORT' && found.reportedById === authUser?.id && found.stage === 'INCIDENT_REPORT';
        if (!isHr && !isOwnFreshReport) return res.status(403).json({ error: 'You cannot add evidence to this case.' });

        const uploaderName = authUser?.fullName || null;
        const created = await prisma.disciplinaryEvidence.createMany({
            data: files.map(f => ({
                caseId: id,
                fileUrl: `/uploads/disciplinary/${f.filename}`,
                fileName: f.originalname,
                uploadedByName: uploaderName,
            })),
        });
        const evidence = await prisma.disciplinaryEvidence.findMany({ where: { caseId: id }, orderBy: { createdAt: 'desc' } });
        res.status(201).json({ count: created.count, evidence });
    } catch (error: any) {
        console.error('Error adding evidence:', error);
        res.status(500).json({ error: 'Failed to add evidence' });
    }
};

// GET /api/disciplinary-cases/attendance-candidates — employees with >=5 late days in the
// current 25th-to-24th cycle who don't already have a tardiness case opened this cycle. Never
// auto-executes anything — HR reviews this list and executes per employee.
export const getAttendanceCandidates = async (req: Request, res: Response) => {
    try {
        // Optional ?month=YYYY-MM (the month whose cycle ends on that month's 24th, same
        // convention as getPresenceWindow) — lets HR browse past cycles instead of only ever
        // seeing the current one, since there was previously no way to review history.
        const requestedMonth = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
            ? req.query.month
            : null;
        const month = requestedMonth || currentCycleMonth();
        const { start, end } = getPresenceWindow(month);

        const employees = await prisma.employee.findMany({
            where: { bioId: { not: null }, enrollmentStatus: 'ACTIVE' },
            select: { id: true, bioId: true, fullName: true, staffId: true },
        });

        const alreadyExecuted = await prisma.disciplinaryCase.findMany({
            where: {
                source: 'SYSTEM_ATTENDANCE',
                // Bounded to THIS cycle specifically (not open-ended) so browsing a past month
                // doesn't get its "already executed" set polluted by later cycles' cases.
                createdAt: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
            },
            select: { employeeId: true, violationId: true },
        });
        const executedKeys = new Set(alreadyExecuted.map(c => `${c.employeeId}:${c.violationId}`));

        const candidates: { employeeId: string; employeeName: string; staffId: string | null; violationId: string; violationLabel: string; detail: string }[] = [];
        for (const emp of employees) {
            const summary = await fetchAttendanceSummary(emp.bioId as number, start, end);
            if (!summary) continue;
            for (const rule of ATTENDANCE_VIOLATION_RULES) {
                if (executedKeys.has(`${emp.id}:${rule.violationId}`)) continue;
                if (rule.check(summary)) {
                    candidates.push({
                        employeeId: emp.id, employeeName: emp.fullName, staffId: emp.staffId,
                        violationId: rule.violationId, violationLabel: VIOLATIONS_BY_ID[rule.violationId].description,
                        detail: rule.detail(summary),
                    });
                }
            }
        }

        res.json({ month, cycleStart: start, cycleEnd: end, candidates });
    } catch (error: any) {
        console.error('Error computing attendance candidates:', error);
        res.status(500).json({ error: 'Failed to compute attendance candidates' });
    }
};

// POST /api/disciplinary-cases/attendance-candidates/:employeeId/execute — HR-triggered only.
// Opens the case directly at DISCIPLINARY_ACTION (the violation is already objectively proven by
// system data — no report/explain/investigation needed).
export const executeAttendanceCase = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const { violationId, month: requestedMonth } = req.body;
        if (!violationId || !VIOLATIONS_BY_ID[violationId]) return res.status(400).json({ error: 'A valid violation is required.' });
        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const priorCount = await prisma.disciplinaryCase.count({ where: { employeeId, violationId } });
        const offenseNumber = priorCount + 1;
        const actionType = resolveActionType(violationId, offenseNumber);
        const caseNumber = await nextCaseNumber();
        // The cycle actually reviewed on the candidates screen (may be a past month HR browsed
        // back to), not always "now" — falls back to the current cycle if not provided.
        const month = typeof requestedMonth === 'string' && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : currentCycleMonth();
        const { start, end } = getPresenceWindow(month);

        const created = await prisma.disciplinaryCase.create({
            data: {
                employeeId,
                caseNumber,
                source: 'SYSTEM_ATTENDANCE',
                violationId,
                category: VIOLATIONS_BY_ID[violationId].category,
                offenseNumber,
                actionType,
                incidentDate: new Date(),
                incidentDescription: `Automatically detected from attendance records (${start} to ${end}): ${VIOLATIONS_BY_ID[violationId].description}.`,
                stage: 'DISCIPLINARY_ACTION',
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error executing attendance-based case:', error);
        res.status(500).json({ error: 'Failed to execute the disciplinary case' });
    }
};
