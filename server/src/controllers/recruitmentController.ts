import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { notify, notifyRoles } from './notificationController';
import { generatePersonnelRequisitionDocx } from '../utils/personnelRequisition';

import { prisma } from '../lib/prisma';
import { ACTIVE_ENROLLMENT_FILTER } from '../utils/employeeStatus';

const cleanId = (val: any): string | null => (val === '' || val === 'null' || val === 'undefined' || !val) ? null : val;

// Resolve the directorate that a requisition scope belongs to (for routing the "direct head" approval).
const resolveDirectorateId = async (scope: { departmentId?: string | null; divisionId?: string | null; unitId?: string | null }): Promise<string | null> => {
    if (scope.divisionId) {
        const div = await prisma.division.findUnique({ where: { id: scope.divisionId }, select: { directorateId: true } });
        return div?.directorateId ?? null;
    }
    if (scope.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: scope.departmentId }, include: { division: { select: { directorateId: true } } } });
        return dept?.division?.directorateId ?? null;
    }
    if (scope.unitId) {
        const unit = await prisma.unit.findUnique({ where: { id: scope.unitId }, include: { department: { include: { division: { select: { directorateId: true } } } } } });
        return unit?.department?.division?.directorateId ?? null;
    }
    return null;
};

// Resolve the acting user's division + department (via their linked employee record, falling
// back to their department's division). Used for scoped visibility and division-head approvals.
const getActorScope = async (userId: string, user: any): Promise<{ divisionId: string | null; departmentId: string | null }> => {
    const emp = userId
        ? await prisma.employee.findUnique({ where: { userId }, select: { divisionId: true, departmentId: true } }).catch(() => null)
        : null;
    let divisionId = emp?.divisionId || null;
    const departmentId = emp?.departmentId || user?.departmentId || null;
    if (!divisionId && departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { divisionId: true } });
        divisionId = dept?.divisionId || null;
    }
    return { divisionId, departmentId };
};

// The division a requisition belongs to (its own division, or the division of its department).
const getRequisitionDivisionId = async (r: { divisionId: string | null; departmentId: string | null }): Promise<string | null> => {
    if (r.divisionId) return r.divisionId;
    if (r.departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: r.departmentId }, select: { divisionId: true } });
        return dept?.divisionId || null;
    }
    return null;
};

// Get all recruitment requests (scoped by role: HR/GM/Admin see all; a division head sees their
// division; a department/office head sees their department; anyone else sees only what they raised).
export const getAllRecruitmentRequests = async (req: Request, res: Response) => {
    try {
        const { status, departmentId } = req.query;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;
        const where: any = {};
        if (status) where.status = String(status);
        if (departmentId) where.departmentId = String(departmentId);

        if (!['SUPER_ADMIN', 'HR_MANAGER', 'GENERAL_MANAGER', 'HEAD_DIRECTOR'].includes(userRole)) {
            const scope = await getActorScope(userId, (req as any).user);
            const or: any[] = [{ requesterId: userId }];
            if (userRole === 'HEAD_DIVISION' && scope.divisionId) {
                or.push({ divisionId: scope.divisionId }, { department: { divisionId: scope.divisionId } });
            } else if (['HEAD_DEPARTMENT', 'HEAD_OFFICE'].includes(userRole) && scope.departmentId) {
                or.push({ departmentId: scope.departmentId });
            }
            where.OR = or;
        }

        const requests = await prisma.recruitmentRequest.findMany({
            where,
            include: {
                requester: { select: { id: true, fullName: true, role: true } },
                unit: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                division: { select: { id: true, name: true } },
                jobDescription: { select: { id: true, title: true, plannedCount: true, workLocations: true, _count: { select: { employees: { where: { enrollmentStatus: ACTIVE_ENROLLMENT_FILTER } } } } } },
                deptApprovedBy: { select: { id: true, fullName: true } },
                hrApprovedBy: { select: { id: true, fullName: true } },
                gmApprovedBy: { select: { id: true, fullName: true } },
                candidates: { select: { stage: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        // Attach how many candidates have been hired against each requisition (progress toward quantity).
        const withProgress = requests.map(({ candidates, ...r }) => ({
            ...r,
            hiredCount: candidates.filter(c => c.stage === 'HIRED').length,
        }));
        res.json(withProgress);
    } catch (error) {
        console.error('Error fetching recruitment requests:', error);
        res.status(500).json({ error: 'Failed to fetch recruitment requests' });
    }
};

// Create a personnel requisition (HIRE against an open JD slot, or JD_CHANGE to expand/add a JD)
export const createRecruitmentRequest = async (req: Request, res: Response) => {
    try {
        const { reason, unitId, departmentId, divisionId, type, jobDescriptionId, jdPayload, quantity,
            employmentType, typeOfRequest, languageEn, languageAr, reportsTo } = req.body;
        let { jobTitle } = req.body;
        const requesterId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const allowedRoles = ['HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_DIVISION', 'SUPER_ADMIN'];
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Only a Head of Department, Office, or Division can raise a personnel requisition.' });
        }

        const reqType = type === 'JD_CHANGE' ? 'JD_CHANGE' : 'HIRE';
        // How many people to hire under this requisition (HIRE only). Defaults to 1.
        let reqQuantity = Math.max(1, parseInt(quantity, 10) || 1);
        const cleanDeptId = cleanId(departmentId);
        const cleanDivId = cleanId(divisionId);
        const cleanUnitId = cleanId(unitId);
        const cleanJdId = cleanId(jobDescriptionId);

        if (!cleanDeptId && !cleanDivId) {
            return res.status(400).json({ error: 'A department or division scope is required.' });
        }

        if (reqType === 'HIRE') {
            if (!cleanJdId) {
                return res.status(400).json({ error: 'A Job Description must be selected for a hire requisition.' });
            }
            const jd = await prisma.jobDescription.findUnique({
                where: { id: cleanJdId },
                include: { _count: { select: { employees: { where: { enrollmentStatus: ACTIVE_ENROLLMENT_FILTER } } } } }
            });
            if (!jd) return res.status(404).json({ error: 'Selected Job Description not found.' });
            const filled = jd._count.employees;
            const openSlots = jd.plannedCount - filled;
            if (openSlots <= 0) {
                return res.status(409).json({ error: `"${jd.title}" is at full staffing plan (${filled}/${jd.plannedCount}). Raise a JD change request to expand the plan instead.` });
            }
            // You can request to hire up to the number of open slots on the staffing plan.
            if (reqQuantity > openSlots) {
                return res.status(409).json({ error: `"${jd.title}" has only ${openSlots} open slot(s) (${filled}/${jd.plannedCount} filled). You requested ${reqQuantity}.` });
            }
            jobTitle = jd.title;
        } else {
            // JD_CHANGE: must carry a proposed JD payload
            if (!jdPayload || !jdPayload.title) {
                return res.status(400).json({ error: 'Job Description details (including a title) are required for a JD change request.' });
            }
            jobTitle = jdPayload.title;
            reqQuantity = 1; // quantity only applies to hire requisitions
        }

        // Approval routing:
        //  - HIRE requisitions run the staged PRF flow (Dept head → Division head → HR Manager →
        //    Head of Hiring Unit → GM), driven by prfApprovals; they always start PENDING.
        //  - JD_CHANGE keeps the original flow (Division → HR → Directorate); a division head who
        //    raises it self-approves the division step (starts DEPT_APPROVED).
        const isDivisionHead = userRole === 'HEAD_DIVISION';
        const initialStatus = (reqType === 'JD_CHANGE' && isDivisionHead) ? 'DEPT_APPROVED' : 'PENDING';
        const selfDeptApprove = reqType === 'JD_CHANGE' && isDivisionHead;

        const request = await prisma.recruitmentRequest.create({
            data: {
                jobTitle: jobTitle || 'Personnel Requisition',
                reason: reason || null,
                type: reqType,
                unitId: cleanUnitId,
                departmentId: cleanDeptId,
                divisionId: cleanDivId,
                jobDescriptionId: cleanJdId,
                jdPayload: reqType === 'JD_CHANGE' ? jdPayload : Prisma.JsonNull,
                quantity: reqQuantity,
                requesterId,
                status: initialStatus,
                deptApprovedById: selfDeptApprove ? requesterId : null,
                deptApprovedAt: selfDeptApprove ? new Date() : null,
                // PRF fields (HIRE only; harmless nulls otherwise).
                reportsTo: reqType === 'HIRE' ? (reportsTo || null) : null,
                employmentType: reqType === 'HIRE' ? (employmentType || null) : null,
                typeOfRequest: reqType === 'HIRE' ? (typeOfRequest || null) : null,
                languageEn: reqType === 'HIRE' ? (languageEn || null) : null,
                languageAr: reqType === 'HIRE' ? (languageAr || null) : null,
            },
            include: { requester: true, unit: true, department: true, division: true, jobDescription: true }
        });

        // Notify whoever needs to act next: the Head of Division (if raised by a dept head),
        // or HR directly (if raised by a division head, whose division step is already done).
        const label = reqType === 'JD_CHANGE' ? 'JD change' : 'hire';
        if (reqType === 'HIRE') {
            // New staged PRF flow starts with the Head of Department.
            await notifyRoles(['HEAD_DEPARTMENT', 'HEAD_OFFICE'], 'New requisition to review',
                `${request.requester?.fullName || 'A head'} raised a hire requisition (${request.jobTitle}) needing your approval.`,
                '/recruitment/approvals');
        } else if (initialStatus === 'PENDING') {
            const reqDivisionId = await getRequisitionDivisionId(request);
            await notifyRoles(['HEAD_DIVISION'], 'New requisition to review',
                `${request.requester?.fullName || 'A head'} raised a ${label} requisition (${request.jobTitle}) needing your approval.`,
                '/recruitment/approvals', { divisionId: reqDivisionId });
        } else {
            await notifyRoles(['HR_MANAGER'], 'New requisition to review',
                `${request.requester?.fullName || 'A division head'} raised a ${label} requisition (${request.jobTitle}) needing HR approval.`,
                '/recruitment/approvals');
        }

        res.status(201).json(request);
    } catch (error) {
        console.error('Error creating recruitment request:', error);
        res.status(500).json({ error: 'Failed to create recruitment request' });
    }
};

// Approve/Reject a requisition. Chain: Head of Division -> HR -> GM (JD only).
export const updateRecruitmentRequestStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body; // DEPT_APPROVED (division head), HR_APPROVED, FULLY_APPROVED (GM), REJECTED
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;
        // The route-level gate (canApproveRecruitment) already ORs in recruitment_approvals/
        // manage_recruitment, so a hat/grant holder reaches this handler — these per-stage checks
        // used to re-gate on role alone, silently 403-ing exactly the users the route just let in.
        const perms: string[] = (req as any).user?.permissions || [];

        const existing = await prisma.recruitmentRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        const isAdmin = userRole === 'SUPER_ADMIN';
        const updateData: any = { status };

        if (status === 'DEPT_APPROVED') {
            // First stage = the Head of Division of the requisition's division.
            if (userRole !== 'HEAD_DIVISION' && !isAdmin && !perms.includes('recruitment_approvals')) {
                return res.status(403).json({ error: 'Only the Head of Division can approve at this stage.' });
            }
            if (!isAdmin) {
                const reqDivisionId = await getRequisitionDivisionId(existing);
                const scope = await getActorScope(userId, (req as any).user);
                if (!reqDivisionId || scope.divisionId !== reqDivisionId) {
                    return res.status(403).json({ error: 'You can only approve requisitions within your own division.' });
                }
            }
            updateData.deptApprovedById = userId;
            updateData.deptNote = note;
            updateData.deptApprovedAt = new Date();
        } else if (status === 'HR_APPROVED') {
            // Intermediate HR approval only applies to JD changes (which still need GM afterwards).
            if (userRole !== 'HR_MANAGER' && !isAdmin && !perms.includes('manage_recruitment')) {
                return res.status(403).json({ error: 'Only HR can approve at this stage.' });
            }
            updateData.hrApprovedById = userId;
            updateData.hrNote = note;
            updateData.hrApprovedAt = new Date();
        } else if (status === 'FULLY_APPROVED') {
            if (existing.type === 'HIRE') {
                // A hire is finalised by HR — it does not go to the GM.
                if (userRole !== 'HR_MANAGER' && !isAdmin && !perms.includes('manage_recruitment')) {
                    return res.status(403).json({ error: 'Only HR grants final approval for a hire requisition.' });
                }
                updateData.hrApprovedById = userId;
                updateData.hrNote = note;
                updateData.hrApprovedAt = new Date();
                // Auto-publish this open position to the public careers portal.
                updateData.publishedToCareers = true;
                updateData.publishedAt = new Date();
            } else {
                // A JD change is finalised by the Head of Directorate (not the GM).
                if (userRole !== 'HEAD_DIRECTOR' && !isAdmin && !perms.includes('recruitment_approvals')) {
                    return res.status(403).json({ error: 'Only the Head of Directorate can grant final approval for a JD change.' });
                }
                updateData.gmApprovedById = userId;
                updateData.gmNote = note;
                updateData.gmApprovedAt = new Date();
            }
        } else if (status === 'REJECTED') {
            if (userRole === 'HEAD_DIVISION') { updateData.deptNote = note; updateData.deptApprovedById = userId; updateData.deptApprovedAt = new Date(); }
            else if (userRole === 'HR_MANAGER') { updateData.hrNote = note; updateData.hrApprovedById = userId; updateData.hrApprovedAt = new Date(); }
            else if (userRole === 'HEAD_DIRECTOR' || isAdmin) { updateData.gmNote = note; updateData.gmApprovedById = userId; updateData.gmApprovedAt = new Date(); }
        } else if (status === 'FILLED') {
            // Mark an approved hire as filled once the employee has been enrolled.
            if (userRole !== 'HR_MANAGER' && !isAdmin && !perms.includes('manage_recruitment')) {
                return res.status(403).json({ error: 'Only HR can mark a requisition as filled.' });
            }
            if (existing.status !== 'FULLY_APPROVED' || existing.type !== 'HIRE') {
                return res.status(400).json({ error: 'Only a fully approved hire requisition can be marked as filled.' });
            }
            // Keep approval status intact; just flag the hiring as completed.
            delete updateData.status;
            updateData.filled = true;
            updateData.filledAt = new Date();
            // Position is full — remove it from the public careers portal.
            updateData.publishedToCareers = false;
        } else {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.recruitmentRequest.update({
                where: { id },
                data: updateData,
                include: {
                    requester: true, unit: true, department: true, division: true, jobDescription: true,
                    deptApprovedBy: true, hrApprovedBy: true, gmApprovedBy: true
                }
            });

            // On final GM approval of a JD change: create the new JD or update the existing one.
            if (status === 'FULLY_APPROVED' && updated.type === 'JD_CHANGE' && updated.jdPayload) {
                const p: any = updated.jdPayload;
                const isHead = Boolean(p.isHead);
                const resolvedPlanned = isHead ? 1 : (parseInt(p.plannedCount) || 1);
                const jdData: any = {
                    title: p.title,
                    description: p.description || null,
                    isHead,
                    plannedCount: resolvedPlanned,
                    jobCategories: Array.isArray(p.jobCategories) ? p.jobCategories : [],
                    workLocations: Array.isArray(p.workLocations) ? p.workLocations : [],
                    details: p.details ?? Prisma.JsonNull,
                };

                if (p.mode === 'edit' && updated.jobDescriptionId) {
                    await tx.jobDescription.update({ where: { id: updated.jobDescriptionId }, data: jdData });
                } else {
                    await tx.jobDescription.create({
                        data: {
                            ...jdData,
                            directorateId: cleanId(p.directorateId),
                            divisionId: cleanId(p.divisionId) || (updated.divisionId ?? null),
                            departmentId: cleanId(p.departmentId) || (updated.departmentId ?? null),
                            unitId: cleanId(p.unitId) || (updated.unitId ?? null),
                        }
                    });
                }
            }

            return updated;
        });

        // ---- Notifications ----
        // Tell the requester the outcome, and alert whoever needs to act next.
        const title = result.jobTitle;
        if (status === 'REJECTED') {
            await notify(result.requesterId, 'Requisition rejected', `Your requisition "${title}" was rejected.`, '/recruitment/requests');
        } else if (status === 'DEPT_APPROVED') {
            await notify(result.requesterId, 'Requisition advanced', `Your requisition "${title}" was approved by the Head of Division and is now with HR.`, '/recruitment/requests');
            await notifyRoles(['HR_MANAGER'], 'Requisition awaiting HR', `"${title}" was approved by the Head of Division and needs HR review.`, '/recruitment/approvals');
        } else if (status === 'HR_APPROVED') {
            await notify(result.requesterId, 'Requisition advanced', `Your JD change "${title}" was approved by HR and is now with the Head of Directorate.`, '/recruitment/requests');
            await notifyRoles(['HEAD_DIRECTOR'], 'Requisition awaiting final approval', `JD change "${title}" needs your final approval.`, '/recruitment/approvals');
        } else if (status === 'FULLY_APPROVED') {
            await notify(result.requesterId, 'Requisition approved', `Your requisition "${title}" is fully approved.`, '/recruitment/requests');
            if (result.type === 'HIRE') {
                await notifyRoles(['HR_MANAGER'], 'Position ready to source', `"${title}" is approved — you can start sourcing candidates.`, '/recruitment/hiring');
                // Careers portal: the position is now live publicly. Let HR and the requesting head know.
                await notifyRoles(['HR_MANAGER'], 'Position published to Careers', `"${title}" is now live on the public Careers page. Applications will appear in the applicant list.`, '/recruitment/hiring');
                await notify(result.requesterId, 'Position published to Careers', `"${title}" is now open for public applications on the Careers page.`, '/recruitment/hiring');
            }
        } else if (updateData.filled) {
            // Position was just marked filled → it has been removed from the Careers page.
            await notify(result.requesterId, 'Position closed on Careers', `"${title}" is now filled and has been removed from the public Careers page.`, '/recruitment/requests');
        }

        res.json(result);
    } catch (error) {
        console.error('Error updating recruitment status:', error);
        res.status(500).json({ error: 'Failed to update recruitment status' });
    }
};

export const updateRecruitmentRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { jobTitle, reason, unitId, departmentId, divisionId, jobDescriptionId, jdPayload } = req.body;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const existing = await prisma.recruitmentRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        // Only requester or admin can edit, and only if still pending
        if (existing.requesterId !== userId && userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Unauthorized to edit this request' });
        }

        if (existing.status !== 'PENDING' && userRole !== 'SUPER_ADMIN') {
            return res.status(400).json({ error: 'Cannot edit an approved or rejected request' });
        }

        const data: any = { reason: reason ?? existing.reason };
        if (jobTitle !== undefined) data.jobTitle = jobTitle;
        if (unitId !== undefined) data.unitId = cleanId(unitId);
        if (departmentId !== undefined) data.departmentId = cleanId(departmentId);
        if (divisionId !== undefined) data.divisionId = cleanId(divisionId);
        if (jobDescriptionId !== undefined) data.jobDescriptionId = cleanId(jobDescriptionId);
        if (jdPayload !== undefined) data.jdPayload = jdPayload ?? Prisma.JsonNull;

        const updated = await prisma.recruitmentRequest.update({
            where: { id },
            data,
            include: { requester: true, unit: true, department: true, division: true, jobDescription: true }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating recruitment request:', error);
        res.status(500).json({ error: 'Failed to update recruitment request' });
    }
};

export const deleteRecruitmentRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const existing = await prisma.recruitmentRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        if (existing.requesterId !== userId && userRole !== 'SUPER_ADMIN' && userRole !== 'HR_MANAGER' && userRole !== 'HEAD_DIVISION') {
            return res.status(403).json({ error: 'Unauthorized to delete this request' });
        }

        await prisma.recruitmentRequest.delete({ where: { id } });
        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error('Error deleting recruitment request:', error);
        res.status(500).json({ error: 'Failed to delete recruitment request' });
    }
};

// ---- Personnel Requisition Form (PRF) staged approval flow (HIRE requisitions) ----------------
// Ordered stages, each signed by the relevant approver. The two HR stages are permission-gated.
const PRF_STAGES = ['deptHead', 'divHead', 'hrManager', 'hrRecruitment', 'gm'] as const;
type PrfStage = typeof PRF_STAGES[number];
const PRF_STATUS: Record<PrfStage, string> = {
    deptHead: 'DEPT_APPROVED', divHead: 'DIV_APPROVED', hrManager: 'HRMGR_APPROVED',
    hrRecruitment: 'HRREC_APPROVED', gm: 'FULLY_APPROVED',
};
const PRF_STAGE_LABEL: Record<PrfStage, string> = {
    deptHead: 'Head of Department', divHead: 'Head of Division/Office', hrManager: 'Head of HR',
    hrRecruitment: 'Head of Hiring Unit', gm: 'General Manager',
};

const isEligibleForStage = (
    stage: PrfStage,
    ctx: { role: string; perms: string[]; isAdmin: boolean; actorScope: { divisionId: string | null; departmentId: string | null }; reqDepartmentId: string | null; reqDivisionId: string | null }
): boolean => {
    const { role, perms, isAdmin, actorScope, reqDepartmentId, reqDivisionId } = ctx;
    if (isAdmin) return true;
    switch (stage) {
        case 'deptHead':
            return (role === 'HEAD_DEPARTMENT' || role === 'HEAD_OFFICE') && (!reqDepartmentId || actorScope.departmentId === reqDepartmentId);
        case 'divHead':
            return (role === 'HEAD_DIVISION' || role === 'HEAD_OFFICE') && (!reqDivisionId || actorScope.divisionId === reqDivisionId);
        case 'hrManager':
            return role === 'HR_MANAGER' || perms.includes('approve_hr_manager');
        case 'hrRecruitment':
            return perms.includes('approve_hr_recruitment');
        case 'gm':
            // Matches the `approve_gm` fallback the leave/work-authorization approval chain already
            // uses (server/src/utils/leaveApprovalChain.ts) — a hat/grant holder stands in for the
            // GM here too, not just the literal GENERAL_MANAGER role.
            return role === 'GENERAL_MANAGER' || perms.includes('approve_gm');
        default:
            return false;
    }
};

// POST /recruitment-requests/:id/prf-approve — advance the current HIRE approval stage.
export const prfApprove = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, note } = req.body as { decision?: 'approve' | 'reject'; note?: string };
        const userId = (req as any).user?.id;
        const role = (req as any).user?.role;
        const perms: string[] = (req as any).user?.permissions || [];
        const isAdmin = role === 'SUPER_ADMIN';

        const existing = await prisma.recruitmentRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found.' });
        if (existing.type !== 'HIRE') return res.status(400).json({ error: 'This approval flow applies to hire requisitions only.' });
        if (existing.status === 'FULLY_APPROVED' || existing.status === 'REJECTED') {
            return res.status(400).json({ error: 'This requisition has already been finalised.' });
        }

        const approvals: any = (existing.prfApprovals as any) || {};
        const nextStage = PRF_STAGES.find(s => !approvals[s]) as PrfStage | undefined;
        if (!nextStage) return res.status(400).json({ error: 'All approval stages are already complete.' });

        const reqDivisionId = await getRequisitionDivisionId(existing);
        const actorScope = await getActorScope(userId, (req as any).user);
        const eligible = isEligibleForStage(nextStage, { role, perms, isAdmin, actorScope, reqDepartmentId: existing.departmentId, reqDivisionId });
        if (!eligible) {
            return res.status(403).json({ error: `This requisition is awaiting ${PRF_STAGE_LABEL[nextStage]} approval — you are not the approver for this stage.` });
        }

        const actor = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, signature: true } });

        if (decision === 'reject') {
            approvals[nextStage] = { byId: userId, byName: actor?.fullName || '', at: new Date().toISOString(), note: note || null, rejected: true };
            const updated = await prisma.recruitmentRequest.update({
                where: { id }, data: { status: 'REJECTED', prfApprovals: approvals },
                include: { requester: true, department: true, division: true, jobDescription: true },
            });
            await notify(existing.requesterId, 'Requisition rejected', `Your hire requisition "${existing.jobTitle}" was rejected at the ${PRF_STAGE_LABEL[nextStage]} stage.`, '/recruitment/requests').catch(() => {});
            return res.json(updated);
        }

        // The GM can only grant final approval together with the signed requisition document.
        const uploaded = (req as any).file;
        if (nextStage === 'gm' && !uploaded) {
            return res.status(400).json({ error: 'You must upload the signed requisition document to grant final approval as GM.' });
        }
        const documentUrl = uploaded ? `/uploads/requisitions/${uploaded.filename}` : null;

        // Approve: snapshot the approver + their signature (+ the GM's uploaded document).
        approvals[nextStage] = { byId: userId, byName: actor?.fullName || '', signature: actor?.signature || null, at: new Date().toISOString(), note: note || null, document: documentUrl };
        const data: any = { status: PRF_STATUS[nextStage], prfApprovals: approvals };
        if (nextStage === 'gm') { data.publishedToCareers = true; data.publishedAt = new Date(); }

        const updated = await prisma.recruitmentRequest.update({
            where: { id }, data,
            include: { requester: true, department: true, division: true, jobDescription: true },
        });

        // Notify the next approver / the requester.
        const following = PRF_STAGES.find(s => !approvals[s]) as PrfStage | undefined;
        if (!following) {
            await notify(existing.requesterId, 'Requisition fully approved', `Your hire requisition "${existing.jobTitle}" is fully approved and open for sourcing.`, '/recruitment/requests').catch(() => {});
            await notifyRoles(['HR_MANAGER'], 'Position ready to source', `"${existing.jobTitle}" is fully approved — you can start sourcing candidates.`, '/recruitment/hiring').catch(() => {});
        } else {
            await notify(existing.requesterId, 'Requisition advanced', `Your hire requisition "${existing.jobTitle}" was approved at the ${PRF_STAGE_LABEL[nextStage]} stage.`, '/recruitment/requests').catch(() => {});
        }
        res.json(updated);
    } catch (error: any) {
        console.error('Error advancing PRF approval:', error);
        res.status(500).json({ error: error.message || 'Failed to record approval' });
    }
};

// GET /recruitment-requests/:id/prf — build the Personnel Requisition Form (.docx).
export const generatePrf = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const request = await prisma.recruitmentRequest.findUnique({
            where: { id },
            include: {
                department: { select: { name: true, division: { select: { name: true } } } },
                division: { select: { name: true } },
                jobDescription: true,
                requester: { select: { fullName: true } },
            },
        });
        if (!request) return res.status(404).json({ error: 'Request not found.' });

        const jd = request.jobDescription;
        const d = (jd?.details as any) || {};
        const sec = (k: string) => String(d[k]?.en || '').trim() || String(d[k]?.ar || '').trim();
        const locMap: Record<string, string> = { OFFICE: 'Office', SITE: 'Site' };
        const placeOfWork = (jd?.workLocations || []).map(l => locMap[l] || l).join(' / ');
        const a: any = (request.prfApprovals as any) || {};
        const pad = (n: number) => String(n).padStart(2, '0');
        const dt = request.createdAt;
        const dateRequested = `${pad(dt.getDate())} / ${pad(dt.getMonth() + 1)} / ${dt.getFullYear()}`;

        const buffer = generatePersonnelRequisitionDocx({
            dateRequested,
            positionTitle: jd?.title || request.jobTitle || '',
            positions: String(request.quantity || 1),
            division: request.division?.name || request.department?.division?.name || '',
            department: request.department?.name || '',
            reportsTo: (request.reportsTo || String(d.reportsTo || '')).trim(),
            placeOfWork,
            employmentType: request.employmentType || '',
            typeOfRequest: request.typeOfRequest || '',
            education: sec('education'),
            experience: sec('experience'),
            languageEn: request.languageEn || '',
            languageAr: request.languageAr || '',
            skills: sec('skills'),
            preparedBy: request.requester?.fullName || '',
            signatures: {
                deptHead: a.deptHead?.signature || null,
                divHead: a.divHead?.signature || null,
                hiringUnit: a.hrRecruitment?.signature || null,
                hrHead: a.hrManager?.signature || null,
                gm: a.gm?.signature || null,
            },
        });

        const safeName = (jd?.title || request.jobTitle || 'requisition').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'requisition';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Personnel_Requisition_${safeName}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating PRF:', error);
        res.status(500).json({ error: error.message || 'Failed to generate the personnel requisition form' });
    }
};
