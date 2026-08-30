import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import {
    generateResignationRequestDocx, generateEmployeeClearanceDocx,
    generateSeparationLetterDocx, generateCertificateOfEmploymentDocx,
} from '../utils/offboardingForms';
import { REASON_FOR_LEAVING_VALUES, RATING_VALUES } from '../utils/offboardingExitInterview';

const prisma = new PrismaClient();

async function notifyUsers(userIds: (string | null | undefined)[], title: string, content: string, link?: string) {
    try {
        const unique = Array.from(new Set(userIds.filter((u): u is string => !!u)));
        if (unique.length === 0) return;
        await prisma.notification.createMany({
            data: unique.map(userId => ({ userId, title, content, link: link || null })),
        });
    } catch (e) {
        console.error('[Offboarding][Notify] Failed to write notifications (non-fatal):', e);
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
    const count = await prisma.offboardingCase.count();
    return `IPH-CCHR-FRM-OFFBRD-${String(count + 1).padStart(3, '0')}`;
}

// Resolves the logged-in user's own Employee record — same lookup chain used elsewhere for
// self-service actions (attendanceIntegrationController.resolveMyEmployee).
async function resolveMyEmployee(authUser: any) {
    if (!authUser?.id) return null;
    let employee = await prisma.employee.findUnique({ where: { userId: authUser.id } });
    if (!employee && authUser.email) {
        employee = await prisma.employee.findFirst({ where: { email: authUser.email } });
    }
    return employee;
}

const CASE_INCLUDE = {
    employee: {
        select: {
            id: true, fullName: true, fullNameArabic: true, staffId: true, position: true,
            enrollmentStatus: true,
            nationality: true, contractType: true, jobCategory: true, jobGrade: true,
            contractStartDate: true, contractEndDate: true, joinDate: true,
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

// Not every employee has every level of the org chart — a Division Head has no department above
// them, some senior posts sit outside any unit — so a blank org-placement/contract-attribute field
// reads as "not applicable to this person", not as missing data. Printed as "N/A" rather than left
// blank, which otherwise looks like an omission on the official form.
const orNA = (value: string | null | undefined): string => (value && value.trim()) ? value : 'N/A';

// The Separation Letter's "Reason:" field is the official record of WHY the employee is leaving —
// one of a fixed set of categories, not a free-text narrative (that's what the case's own `reason`/
// `resignationReason` fields are for internally). Derived from `source`, which already captures
// exactly this distinction.
const SEPARATION_REASON_LABELS: Record<string, string> = {
    EMPLOYEE_RESIGNATION: 'Resignation',
    DISCIPLINARY_TERMINATION: 'Termination',
    TERMINATION: 'Termination',
    CONTRACT_NON_RENEWAL_EMPLOYEE: 'Contract Non-Renewal (by Employee)',
    CONTRACT_NON_RENEWAL_COMPANY: 'Contract Non-Renewal (by Company)',
};
function separationReasonLabel(offboardingCase: { source: string }): string {
    return SEPARATION_REASON_LABELS[offboardingCase.source] || offboardingCase.source;
}

// "Head of Division" for the printed Resignation Request form — resolved live from the org
// structure (whoever holds User.role = 'HEAD_DIVISION' for the division this employee's department
// rolls up to), the exact lookup leaveApprovalChain.ts already uses for leave-approval routing. No
// longer typed by the employee — there's a real answer for it in the system.
export async function resolveDivisionHeadName(employeeId: string): Promise<string> {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true, divisionId: true } });
    if (!employee) return '';
    let divisionId = employee.divisionId;
    if (!divisionId && employee.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: employee.departmentId }, select: { divisionId: true } });
        divisionId = dept?.divisionId ?? null;
    }
    if (!divisionId) return '';
    const head = await prisma.user.findFirst({ where: { role: 'HEAD_DIVISION', divisionId }, select: { fullName: true } });
    return head?.fullName || '';
}

// Not every employee sits under an actual "Department" — same fallback chain
// PersonnelRelations.tsx's own orgUnitName() already uses (Unit -> Department (+ "(Office)" when
// isOffice) -> Division), for the Certificate of Employment's "within the ___" line.
function resolveOrgUnitName(emp: any): string {
    if (emp?.unit?.name) return emp.unit.name;
    if (emp?.department?.name) return emp.department.isOffice ? `${emp.department.name} (Office)` : emp.department.name;
    if (emp?.division?.name) return emp.division.name;
    return '';
}

// Called by disciplinaryController.completeDisciplinaryAction when actionType === 'TERMINATION' —
// auto-creates the linked Involuntary offboarding case, starting straight at CLEARANCE since the
// Disciplinary Action's own Notice already serves as the separation notice. Fail-soft: the
// disciplinary case still closes even if this fails (caller decides what to surface).
export async function createOffboardingCaseForTermination(params: { employeeId: string; disciplinaryCaseId: string; disciplinaryCaseNumber: string }): Promise<{ id: string; caseNumber: string } | null> {
    try {
        const caseNumber = await nextCaseNumber();
        const created = await prisma.offboardingCase.create({
            data: {
                employeeId: params.employeeId,
                caseNumber,
                type: 'INVOLUNTARY',
                source: 'DISCIPLINARY_TERMINATION',
                linkedDisciplinaryCaseId: params.disciplinaryCaseId,
                reason: `Termination per disciplinary case ${params.disciplinaryCaseNumber}`,
                stage: 'CLEARANCE',
                dateOfSeparation: new Date(),
            },
        });
        return { id: created.id, caseNumber: created.caseNumber };
    } catch (e) {
        console.error('[Offboarding] Failed to auto-create case for disciplinary termination:', e);
        return null;
    }
}

// GET /api/offboarding-cases/my-identity — the fields the real Resignation Request form used to ask
// the employee to type themselves (Employee ID, Name, Unit, Department, Position) — now read live
// off the Employee record instead, so the intake page can show them read-only.
export const getMyIdentity = async (req: Request, res: Response) => {
    try {
        const authUser = (req as AuthRequest).user;
        const employee = await prisma.employee.findFirst({
            where: authUser?.id ? { OR: [{ userId: authUser.id }, { email: authUser.email || undefined }] } : undefined,
            select: {
                id: true, staffId: true, fullName: true, position: true,
                department: { select: { name: true } },
                unit: { select: { name: true } },
            },
        });
        if (!employee) return res.status(404).json({ error: 'No employee record is linked to your account yet — contact HR.' });
        res.json({
            employeeId: employee.staffId || '',
            employeeName: employee.fullName,
            unit: employee.unit?.name || '',
            department: employee.department?.name || '',
            position: employee.position || '',
        });
    } catch (error: any) {
        console.error('Error fetching my identity snapshot:', error);
        res.status(500).json({ error: 'Failed to fetch your identity snapshot' });
    }
};

// POST /api/offboarding-cases/resignation-request — any authenticated employee, always about
// themselves (unlike an incident report, you can't resign on someone else's behalf). Identity fields
// (name/unit/department/position) are read off the Employee record, not accepted from the client.
export const createResignationRequest = async (req: Request, res: Response) => {
    try {
        const { reason, letterText } = req.body;
        const authUser = (req as AuthRequest).user;
        const employee = await resolveMyEmployee(authUser);
        if (!employee) return res.status(404).json({ error: 'No employee record is linked to your account yet — contact HR.' });
        if (!reason) return res.status(400).json({ error: 'A reason for resignation is required.' });
        if (!letterText) return res.status(400).json({ error: 'Your resignation letter is required.' });

        const caseNumber = await nextCaseNumber();
        const created = await prisma.offboardingCase.create({
            data: {
                employeeId: employee.id,
                caseNumber,
                type: 'VOLUNTARY',
                source: 'EMPLOYEE_RESIGNATION',
                reason,
                stage: 'RESIGNATION_REQUEST',
                resignationFiledAt: new Date(),
                resignationReason: reason,
                resignationLetterText: letterText,
                createdByName: authUser?.fullName || null,
            },
            include: CASE_INCLUDE,
        });

        const hrUserIds = await findUsersWithPermission('manage_offboarding');
        await notifyUsers(hrUserIds, 'New resignation request', `${employee.fullName} has filed a resignation request (${caseNumber}).`, '/personnel-relations/offboarding');

        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error creating resignation request:', error);
        res.status(500).json({ error: 'Failed to create resignation request', details: error.message });
    }
};

// POST /api/offboarding-cases/:id/resignation-attachments — multer-handled, up to 10 files. The
// employee's own optional "Additional Attachments" — ownership-checked, only while still at
// RESIGNATION_REQUEST (mirrors disciplinaryController.addEvidence's isOwnFreshReport convention).
export const uploadResignationAttachments = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (!files.length) return res.status(400).json({ error: 'At least one file is required.' });

        const found = await prisma.offboardingCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });

        const authUser = (req as AuthRequest).user;
        const isHr = authUser?.role === 'SUPER_ADMIN' || (authUser?.permissions || []).includes('manage_offboarding');
        const myEmployee = await resolveMyEmployee(authUser);
        const isOwnCase = !!myEmployee && found.employeeId === myEmployee.id && found.stage === 'RESIGNATION_REQUEST';
        if (!isHr && !isOwnCase) return res.status(403).json({ error: 'You cannot attach files to this case.' });

        if (found.resignationAttachmentUrls.length + files.length > 10) {
            return res.status(400).json({ error: 'A maximum of 10 attachments is allowed.' });
        }

        const updated = await prisma.offboardingCase.update({
            where: { id },
            data: {
                resignationAttachmentUrls: { push: files.map(f => `/uploads/offboarding/${f.filename}`) },
                resignationAttachmentNames: { push: files.map(f => f.originalname) },
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error uploading resignation attachments:', error);
        res.status(500).json({ error: 'Failed to upload attachments' });
    }
};

// POST /api/offboarding-cases/exit-interview — any authenticated employee, always their own most
// recent case. In-system replacement for the external Exit Interview Google Form, field-for-field.
// Mandatory for every case except a disciplinary termination (enforced at case-closure time in
// completeSeparationLetter, not here — submission itself is always allowed).
export const submitExitInterview = async (req: Request, res: Response) => {
    try {
        const {
            effectiveDate, reasonCategory, reasonOther, ratings,
            appreciatedMost, likedLeast, improvementSuggestions,
            interestedInReemployment, wouldRecommend, contactEmail, contactNumber,
        } = req.body;
        const authUser = (req as AuthRequest).user;
        const employee = await resolveMyEmployee(authUser);
        if (!employee) return res.status(404).json({ error: 'No employee record is linked to your account yet — contact HR.' });

        const found = await prisma.offboardingCase.findFirst({
            where: { employeeId: employee.id },
            orderBy: { createdAt: 'desc' },
        });
        if (!found) return res.status(404).json({ error: 'No offboarding case found for you yet.' });
        if (found.exitInterviewSubmittedAt) return res.status(400).json({ error: 'You have already submitted your exit interview for this case.' });

        if (!effectiveDate) return res.status(400).json({ error: 'Effective Date of Resignation is required.' });
        if (!REASON_FOR_LEAVING_VALUES.includes(reasonCategory)) return res.status(400).json({ error: 'A reason for leaving is required.' });
        if (reasonCategory === 'OTHERS' && !reasonOther) return res.status(400).json({ error: 'Please specify your reason for leaving.' });
        const ratingKeys = ['management', 'companyCulture', 'policies', 'workingConditions', 'careerDevelopment', 'salary', 'benefits', 'training'];
        for (const key of ratingKeys) {
            if (!RATING_VALUES.includes(ratings?.[key])) return res.status(400).json({ error: `A rating for "${key}" is required.` });
        }
        if (!appreciatedMost || !likedLeast || !improvementSuggestions) {
            return res.status(400).json({ error: 'All three feedback questions are required.' });
        }
        if (typeof interestedInReemployment !== 'boolean' || typeof wouldRecommend !== 'boolean') {
            return res.status(400).json({ error: 'Both yes/no questions are required.' });
        }

        const updated = await prisma.offboardingCase.update({
            where: { id: found.id },
            data: {
                exitInterviewSubmittedAt: new Date(),
                resignationEffectiveDate: new Date(effectiveDate),
                exitInterviewReasonCategory: reasonCategory,
                exitInterviewReasonOther: reasonCategory === 'OTHERS' ? reasonOther : null,
                exitInterviewRatingManagement: ratings.management,
                exitInterviewRatingCompanyCulture: ratings.companyCulture,
                exitInterviewRatingPolicies: ratings.policies,
                exitInterviewRatingWorkingConditions: ratings.workingConditions,
                exitInterviewRatingCareerDevelopment: ratings.careerDevelopment,
                exitInterviewRatingSalary: ratings.salary,
                exitInterviewRatingBenefits: ratings.benefits,
                exitInterviewRatingTraining: ratings.training,
                exitInterviewAppreciatedMost: appreciatedMost,
                exitInterviewLikedLeast: likedLeast,
                exitInterviewImprovementSuggestions: improvementSuggestions,
                exitInterviewInterestedInReemployment: interestedInReemployment,
                exitInterviewWouldRecommend: wouldRecommend,
                exitInterviewContactEmail: contactEmail || null,
                exitInterviewContactNumber: contactNumber || null,
            },
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error submitting exit interview:', error);
        res.status(500).json({ error: 'Failed to submit exit interview' });
    }
};

// GET /api/offboarding-cases/mine — the authenticated employee's own cases, coarse status only.
export const getMyOffboardingCases = async (req: Request, res: Response) => {
    try {
        const authUser = (req as AuthRequest).user;
        const employee = await resolveMyEmployee(authUser);
        if (!employee) return res.json([]);

        const cases = await prisma.offboardingCase.findMany({
            where: { employeeId: employee.id },
            select: {
                id: true, caseNumber: true, type: true, source: true, stage: true,
                resignationFiledAt: true, exitInterviewSubmittedAt: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
    } catch (error: any) {
        console.error('Error fetching my offboarding cases:', error);
        res.status(500).json({ error: 'Failed to fetch your offboarding cases' });
    }
};

// GET /api/offboarding-cases?stage=&type=&source= — HR-facing.
export const listCases = async (req: Request, res: Response) => {
    try {
        const { stage, type, source, employeeId } = req.query;
        const cases = await prisma.offboardingCase.findMany({
            where: {
                ...(stage ? { stage: String(stage) } : {}),
                ...(type ? { type: String(type) } : {}),
                ...(source ? { source: String(source) } : {}),
                ...(employeeId ? { employeeId: String(employeeId) } : {}),
            },
            include: CASE_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
    } catch (error: any) {
        console.error('Error listing offboarding cases:', error);
        res.status(500).json({ error: 'Failed to list offboarding cases' });
    }
};

export const getCase = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const found = await prisma.offboardingCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        res.json(found);
    } catch (error: any) {
        console.error('Error fetching offboarding case:', error);
        res.status(500).json({ error: 'Failed to fetch offboarding case' });
    }
};

// POST /api/offboarding-cases/manual — HR directly opening a case for one of the 4 real separation
// types, for whichever of them didn't come through its own dedicated path (the employee's own
// Resignation Request page, or a disciplinary action reaching TERMINATION). Each type follows the
// exact same stage sequence its dedicated path would: Resignation starts at RESIGNATION_REQUEST,
// every other type skips straight to CLEARANCE (there's no "Resignation Request" paperwork for a
// termination or a non-renewal).
export const createManualOffboardingCase = async (req: Request, res: Response) => {
    try {
        const { employeeId, source, reason, dateOfSeparation } = req.body;
        if (!employeeId) return res.status(400).json({ error: 'The employee is required.' });
        if (!['TERMINATION', 'EMPLOYEE_RESIGNATION', 'CONTRACT_NON_RENEWAL_EMPLOYEE', 'CONTRACT_NON_RENEWAL_COMPANY'].includes(source)) {
            return res.status(400).json({ error: 'A valid separation reason is required.' });
        }
        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const isResignation = source === 'EMPLOYEE_RESIGNATION';
        const caseNumber = await nextCaseNumber();
        const created = await prisma.offboardingCase.create({
            data: {
                employeeId,
                caseNumber,
                type: isResignation ? 'VOLUNTARY' : 'INVOLUNTARY',
                source,
                reason: reason || null,
                stage: isResignation ? 'RESIGNATION_REQUEST' : 'CLEARANCE',
                ...(isResignation
                    ? { resignationFiledAt: new Date(), resignationReason: reason || null }
                    : { dateOfSeparation: dateOfSeparation ? new Date(dateOfSeparation) : new Date() }),
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
            include: CASE_INCLUDE,
        });
        res.status(201).json(created);
    } catch (error: any) {
        console.error('Error creating manual offboarding case:', error);
        res.status(500).json({ error: 'Failed to create the offboarding case' });
    }
};

// POST /api/offboarding-cases/:id/form/:stage — generates the filled .docx for whichever stage the
// case is at, ready for physical signing. Same "draft body carries in-progress values" convention
// as disciplinaryController.generateStageForm.
export const generateStageForm = async (req: Request, res: Response) => {
    try {
        const { id, stage } = req.params;
        const draft = req.body || {};
        const found = await prisma.offboardingCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        const emp: any = found.employee;
        const safeName = (emp?.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');

        let buffer: Buffer;
        let filename: string;

        if (stage === 'RESIGNATION_REQUEST') {
            if (found.type !== 'VOLUNTARY') return res.status(400).json({ error: 'Only voluntary cases have a Resignation Request form.' });
            const headOfDivision = draft.headOfDivision || await resolveDivisionHeadName(found.employeeId);
            // The employee only ever types one language for these two fields — HR provides the other
            // language's version here, at generation time, same convention as disciplinary's
            // incidentDescriptionAr. Persisted immediately so it's remembered next time this form is
            // regenerated, not just used for this one download.
            const resignationReasonAr = draft.resignationReasonAr ?? found.resignationReasonAr ?? '';
            const resignationLetterTextAr = draft.resignationLetterTextAr ?? found.resignationLetterTextAr ?? '';
            if (resignationReasonAr !== (found.resignationReasonAr || '') || resignationLetterTextAr !== (found.resignationLetterTextAr || '')) {
                await prisma.offboardingCase.update({
                    where: { id },
                    data: { resignationReasonAr: resignationReasonAr || null, resignationLetterTextAr: resignationLetterTextAr || null },
                });
            }
            buffer = generateResignationRequestDocx({
                dateFiled: formatDate(found.resignationFiledAt || found.createdAt),
                employeeId: orNA(emp?.staffId),
                employeeName: emp?.fullName || '',
                division: orNA(emp?.division?.name),
                department: orNA(emp?.department?.name),
                position: orNA(emp?.position),
                headOfDivision: orNA(headOfDivision),
                reason: draft.resignationReason || found.resignationReason || '',
                reasonAr: resignationReasonAr,
                effectiveDate: formatDate(draft.resignationEffectiveDate || found.resignationEffectiveDate),
                letterText: found.resignationLetterText || '',
                letterTextAr: resignationLetterTextAr,
                finalWorkingDate: formatDate(draft.finalWorkingDate || found.finalWorkingDate),
            });
            filename = `Resignation_Request_${safeName}.docx`;
        } else if (stage === 'CLEARANCE') {
            buffer = generateEmployeeClearanceDocx({
                employeeId: orNA(emp?.staffId),
                employeeName: emp?.fullName || '',
                division: orNA(emp?.division?.name),
                department: orNA(emp?.department?.name),
                position: orNA(emp?.position),
                reportsTo: orNA(draft.reportsTo),
                startDate: formatDate(emp?.joinDate),
                dateOfSeparation: formatDate(draft.dateOfSeparation || found.dateOfSeparation),
                reason: draft.reason || found.reason || found.resignationReason || '',
            });
            filename = `Employee_Clearance_${safeName}.docx`;
        } else if (stage === 'SEPARATION_LETTER') {
            buffer = generateSeparationLetterDocx({
                date: formatDate(new Date()),
                employeeId: orNA(emp?.staffId),
                employeeName: emp?.fullName || '',
                nationality: orNA(emp?.nationality),
                contractType: orNA(emp?.contractType),
                department: orNA(emp?.department?.name),
                unit: orNA(emp?.unit?.name),
                jobPosition: orNA(emp?.position),
                reportsTo: orNA(draft.reportsTo),
                jobCategory: orNA(emp?.jobCategory),
                jobGrade: orNA(emp?.jobGrade),
                contractStartDate: orNA(formatDate(emp?.contractStartDate)),
                contractEndDate: orNA(formatDate(emp?.contractEndDate)),
                dateOfSeparation: formatDate(draft.dateOfSeparation || found.dateOfSeparation),
                reason: separationReasonLabel(found),
            });
            filename = `Separation_Letter_${safeName}.docx`;
        } else {
            return res.status(400).json({ error: 'Unknown stage.' });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating offboarding form:', error);
        res.status(500).json({ error: 'Failed to generate form', details: error.message });
    }
};

// GET /api/offboarding-cases/:id/certificate — on-demand, not a workflow stage. Only enabled once
// clearance has actually completed (the manual: "may be issued after completion of clearance and
// final settlement"). Generates and downloads the doc, and stamps certificateIssuedAt.
export const issueCertificateOfEmployment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const found = await prisma.offboardingCase.findUnique({ where: { id }, include: CASE_INCLUDE });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (!found.clearanceCompletedAt) return res.status(400).json({ error: 'The Certificate of Employment can only be issued after clearance is complete.' });
        const emp: any = found.employee;

        // The employee's real "Join Date" is their FIRST contract's start date, not necessarily
        // the Employee.joinDate column — same distinction PersonnelRelations.tsx's
        // firstContractStartDate already draws (legacy records can have the two drift apart).
        const firstContract = await prisma.contract.findFirst({
            where: { employeeId: found.employeeId },
            orderBy: { startDate: 'asc' },
            select: { startDate: true },
        });

        const today = formatDate(new Date());
        const buffer = generateCertificateOfEmploymentDocx({
            employeeName: emp?.fullName || '',
            employeeNameAr: emp?.fullNameArabic || undefined,
            position: orNA(emp?.position),
            orgUnit: orNA(resolveOrgUnitName(emp)),
            startDate: formatDate(firstContract?.startDate || emp?.joinDate),
            untilDate: formatDate(found.dateOfSeparation) || today,
            lastWorkingDay: formatDate(found.finalWorkingDate || found.dateOfSeparation) || today,
            issuedOnDate: today,
        });

        await prisma.offboardingCase.update({ where: { id }, data: { certificateIssuedAt: new Date() } });

        const safeName = (emp?.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Certificate_of_Employment_${safeName}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error issuing certificate of employment:', error);
        res.status(500).json({ error: 'Failed to issue the certificate' });
    }
};

// POST /api/offboarding-cases/:id/complete-resignation-request — body: { documentUrl, documentName, finalWorkingDate }
export const completeResignationRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName, finalWorkingDate } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Resignation Request before continuing.' });

        const found = await prisma.offboardingCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'RESIGNATION_REQUEST') return res.status(400).json({ error: `Cannot complete the Resignation Request for a case at stage ${found.stage}.` });

        const updated = await prisma.offboardingCase.update({
            where: { id },
            data: {
                resignationDocumentUrl: documentUrl,
                resignationDocumentName: documentName || null,
                resignationCompletedAt: new Date(),
                finalWorkingDate: finalWorkingDate ? new Date(finalWorkingDate) : null,
                dateOfSeparation: finalWorkingDate ? new Date(finalWorkingDate) : found.resignationEffectiveDate,
                stage: 'CLEARANCE',
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing resignation request:', error);
        res.status(500).json({ error: 'Failed to complete the resignation request' });
    }
};

// POST /api/offboarding-cases/:id/complete-clearance — body: { documentUrl, documentName }
export const completeClearance = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Employee Clearance Form before continuing.' });

        const found = await prisma.offboardingCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'CLEARANCE') return res.status(400).json({ error: `Cannot complete Clearance for a case at stage ${found.stage}.` });

        const updated = await prisma.offboardingCase.update({
            where: { id },
            data: {
                clearanceDocumentUrl: documentUrl,
                clearanceDocumentName: documentName || null,
                clearanceCompletedAt: new Date(),
                stage: 'SEPARATION_LETTER',
            },
            include: CASE_INCLUDE,
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error completing clearance:', error);
        res.status(500).json({ error: 'Failed to complete clearance' });
    }
};

// POST /api/offboarding-cases/:id/complete-separation-letter — body: { documentUrl, documentName }
// The actual "employee is gone" effects — enrollmentStatus, login lockout (via that same field),
// standing access revocation, and closing out anything still pending in their name. Deliberately
// separate from closing the paperwork (completeSeparationLetter): a resignation's separation date is
// routinely weeks out (notice period), and the employee stays a normal, fully-active user with full
// access until that date actually arrives — completing the paperwork early must NOT flip this early.
// Called either immediately (paperwork completed on/after the separation date) or later by
// offboardingSeparationCron.ts (paperwork completed ahead of a future separation date).
export async function applyEmployeeSeparation(employeeId: string, separationDate: Date): Promise<void> {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
    // Any leave/attendance-permission requests still awaiting approval no longer make sense for
    // someone who's leaving — close them out rather than leaving them dangling in an approver's
    // queue forever. Fetched up-front since updateMany can't report which rows it touched.
    const pendingLeaveRequests = await prisma.leaveRequest.findMany({
        where: { employeeId, status: 'PENDING' },
        select: { id: true },
    });
    const pendingLeaveRequestIds = pendingLeaveRequests.map(r => r.id);

    await prisma.$transaction([
        prisma.employee.update({
            where: { id: employeeId },
            data: { enrollmentStatus: 'SEPARATED', separationDate },
        }),
        // Revoke standing access at the source — role/permissions/hats cleared means a separated
        // former Head of Division (etc.) no longer matches ANY role- or permission-based approver
        // lookup (leaveApprovalChain.ts, findUsersWithPermission) without needing to touch those
        // queries individually. Login itself is blocked separately (see authController/middleware).
        ...(employee?.userId ? [prisma.user.update({
            where: { id: employee.userId },
            data: { role: 'EMPLOYEE', permissions: [], functionalHatIds: [] },
        })] : []),
        ...(pendingLeaveRequestIds.length ? [
            prisma.leaveRequest.updateMany({
                where: { id: { in: pendingLeaveRequestIds } },
                data: { status: 'REJECTED', hrNote: 'Automatically closed — employee separated from the company.' },
            }),
            prisma.leaveApprovalStep.updateMany({
                where: { leaveRequestId: { in: pendingLeaveRequestIds }, status: 'PENDING' },
                data: { status: 'SKIPPED' },
            }),
        ] : []),
    ]);
}

// Closes the case — the paperwork side only. If the separation date has already arrived (or none
// was ever set), the employee is separated immediately; otherwise offboardingSeparationCron.ts picks
// it up once that date actually comes, so someone serving a notice period keeps normal access until
// their real last day.
export const completeSeparationLetter = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { documentUrl, documentName } = req.body;
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed Separation Letter before continuing.' });

        const found = await prisma.offboardingCase.findUnique({ where: { id } });
        if (!found) return res.status(404).json({ error: 'Case not found.' });
        if (found.stage !== 'SEPARATION_LETTER') return res.status(400).json({ error: `Cannot complete the Separation Letter for a case at stage ${found.stage}.` });
        // Mandatory for every case except a termination (disciplinary-linked or manually recorded)
        // — that employee's Exit Interview is exempted, everyone else must submit one before the
        // case can close.
        if (!['DISCIPLINARY_TERMINATION', 'TERMINATION'].includes(found.source) && !found.exitInterviewSubmittedAt) {
            return res.status(400).json({ error: 'The employee must submit their Exit Interview before this case can be closed.' });
        }

        let updated = await prisma.offboardingCase.update({
            where: { id },
            data: {
                separationDocumentUrl: documentUrl,
                separationDocumentName: documentName || null,
                separationCompletedAt: new Date(),
                stage: 'CLOSED',
                closedAt: new Date(),
            },
            include: CASE_INCLUDE,
        });

        const separationDate = found.dateOfSeparation || new Date();
        if (separationDate <= new Date()) {
            await applyEmployeeSeparation(found.employeeId, separationDate);
            updated = await prisma.offboardingCase.findUnique({ where: { id }, include: CASE_INCLUDE }) as typeof updated;
        }

        res.json(updated);
    } catch (error: any) {
        console.error('Error completing separation letter:', error);
        res.status(500).json({ error: 'Failed to complete the separation letter' });
    }
};
