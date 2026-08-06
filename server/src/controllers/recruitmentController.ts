import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { notify, notifyRoles } from './notificationController';

const prisma = new PrismaClient();

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
                jobDescription: { select: { id: true, title: true, plannedCount: true, workLocations: true, _count: { select: { employees: true } } } },
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
        const { reason, unitId, departmentId, divisionId, type, jobDescriptionId, jdPayload, quantity } = req.body;
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
                include: { _count: { select: { employees: true } } }
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

        // Approval routing depends on who raises it:
        //  - Department / Office head  → starts PENDING (needs the Head of Division first).
        //  - Division head             → the division step is their own, so it starts already
        //                                DEPT_APPROVED (self-approved) and goes straight to HR.
        const isDivisionHead = userRole === 'HEAD_DIVISION';
        const initialStatus = isDivisionHead ? 'DEPT_APPROVED' : 'PENDING';

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
                deptApprovedById: isDivisionHead ? requesterId : null,
                deptApprovedAt: isDivisionHead ? new Date() : null,
            },
            include: { requester: true, unit: true, department: true, division: true, jobDescription: true }
        });

        // Notify whoever needs to act next: the Head of Division (if raised by a dept head),
        // or HR directly (if raised by a division head, whose division step is already done).
        const label = reqType === 'JD_CHANGE' ? 'JD change' : 'hire';
        if (initialStatus === 'PENDING') {
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

        const existing = await prisma.recruitmentRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        const isAdmin = userRole === 'SUPER_ADMIN';
        const updateData: any = { status };

        if (status === 'DEPT_APPROVED') {
            // First stage = the Head of Division of the requisition's division.
            if (userRole !== 'HEAD_DIVISION' && !isAdmin) {
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
            if (userRole !== 'HR_MANAGER' && !isAdmin) {
                return res.status(403).json({ error: 'Only HR can approve at this stage.' });
            }
            updateData.hrApprovedById = userId;
            updateData.hrNote = note;
            updateData.hrApprovedAt = new Date();
        } else if (status === 'FULLY_APPROVED') {
            if (existing.type === 'HIRE') {
                // A hire is finalised by HR — it does not go to the GM.
                if (userRole !== 'HR_MANAGER' && !isAdmin) {
                    return res.status(403).json({ error: 'Only HR grants final approval for a hire requisition.' });
                }
                updateData.hrApprovedById = userId;
                updateData.hrNote = note;
                updateData.hrApprovedAt = new Date();
                // Auto-publish this open position to the public careers portal.
                updateData.publishedToCareers = true;
                updateData.publishedAt = new Date();
            } else {
                // A JD change is finalised by the General Manager — the Head of Directorate acts as GM here.
                if (userRole !== 'GENERAL_MANAGER' && userRole !== 'HEAD_DIRECTOR' && !isAdmin) {
                    return res.status(403).json({ error: 'Only the General Manager or Head of Directorate can grant final approval for a JD change.' });
                }
                updateData.gmApprovedById = userId;
                updateData.gmNote = note;
                updateData.gmApprovedAt = new Date();
            }
        } else if (status === 'REJECTED') {
            if (userRole === 'HEAD_DIVISION') { updateData.deptNote = note; updateData.deptApprovedById = userId; updateData.deptApprovedAt = new Date(); }
            else if (userRole === 'HR_MANAGER') { updateData.hrNote = note; updateData.hrApprovedById = userId; updateData.hrApprovedAt = new Date(); }
            else if (userRole === 'GENERAL_MANAGER' || userRole === 'HEAD_DIRECTOR' || isAdmin) { updateData.gmNote = note; updateData.gmApprovedById = userId; updateData.gmApprovedAt = new Date(); }
        } else if (status === 'FILLED') {
            // Mark an approved hire as filled once the employee has been enrolled.
            if (userRole !== 'HR_MANAGER' && !isAdmin) {
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
            await notify(result.requesterId, 'Requisition advanced', `Your JD change "${title}" was approved by HR and is now with the GM / Directorate Head.`, '/recruitment/requests');
            await notifyRoles(['GENERAL_MANAGER', 'HEAD_DIRECTOR'], 'Requisition awaiting final approval', `JD change "${title}" needs your final approval.`, '/recruitment/approvals');
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
