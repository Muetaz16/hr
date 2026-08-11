import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import { calculateHolidayMetrics } from './employeeController';
import { resolveApprovalChain, STAGE_SEQUENCE } from '../utils/leaveApprovalChain';
import { createBioTimeLeaveRecord } from '../utils/attendanceApiProxy';
import { LEAVE_TYPE_ID_MAP } from '../utils/bioApiLeaveTypeMap';

const prisma = new PrismaClient();

// The 3 leave types that go through balance/date validation and the new org-based approval
// chain (LeaveApprovalStep). LATE_COMING/EARLY_LEAVING/HOURS_LEAVE keep using the old
// status/updateRequestStatus flow untouched — their dedicated workflow is a separate future step.
const CHAIN_LEAVE_TYPES = ['PAID_HOLIDAY', 'UNPAID_LEAVE', 'EMERGENCY_LEAVE'];

// Inclusive day count — same formula already used below in updateRequestStatus's balance
// increment, kept identical so submission-time validation and approval-time accounting agree.
const countLeaveDays = (startDate: Date, endDate: Date) => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const REMAINING_BALANCE_FIELD: Record<string, 'remainingHolidays' | 'remainingEmergencyHolidays' | 'remainingUnpaidHolidays'> = {
    PAID_HOLIDAY: 'remainingHolidays',
    EMERGENCY_LEAVE: 'remainingEmergencyHolidays',
    UNPAID_LEAVE: 'remainingUnpaidHolidays',
};

// --- Leave & Permission Requests ---

export const createLeaveRequest = async (req: Request, res: Response) => {
    try {
        const { employeeId, userId, type, startDate, endDate, startTime, endTime, reason } = req.body;
        const file = (req as any).file;

        // Emergency leave requires a supporting document
        if (type === 'EMERGENCY_LEAVE' && !file) {
            return res.status(400).json({ error: 'A supporting document is required for emergency leave requests.' });
        }

        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;
        if (file) {
            attachmentUrl = `/uploads/requests/${file.filename}`;
            attachmentName = file.originalname;
        }

        const isChainType = CHAIN_LEAVE_TYPES.includes(type);
        let employee: Awaited<ReturnType<typeof prisma.employee.findUnique>> = null;

        if (isChainType) {
            employee = await prisma.employee.findUnique({ where: { id: employeeId } });
            if (!employee) {
                return res.status(404).json({ error: 'Employee not found.' });
            }

            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : start;
            const dayCount = countLeaveDays(start, end);

            // Balance check
            const metrics = calculateHolidayMetrics(
                employee.contractStartDate, employee.holidaysUsed, employee.bonusHolidays,
                employee.emergencyHolidaysUsed, employee.unpaidHolidaysUsed
            );
            const remainingField = REMAINING_BALANCE_FIELD[type];
            const remaining = metrics[remainingField];
            if (dayCount > remaining) {
                return res.status(400).json({ error: `This request exceeds your remaining balance (${remaining} day(s) left).` });
            }

            // 14-day advance-notice rule — PAID_HOLIDAY/UNPAID_LEAVE only, EMERGENCY_LEAVE exempt
            // (it may even be backdated).
            if (type === 'PAID_HOLIDAY' || type === 'UNPAID_LEAVE') {
                const minStart = new Date();
                minStart.setDate(minStart.getDate() + 14);
                minStart.setHours(0, 0, 0, 0);
                if (start < minStart) {
                    return res.status(400).json({ error: 'This leave type must be requested at least 14 days before the start date.' });
                }
            }
        }

        if (isChainType && employee) {
            const { steps, blockedStage } = await resolveApprovalChain(prisma, employee);
            if (blockedStage) {
                return res.status(400).json({ error: `No ${blockedStage.replace('_', ' ').toLowerCase()} is configured in the system to approve this request. Contact an administrator.` });
            }
            if (steps.length === 0) {
                return res.status(400).json({ error: 'No approvers could be resolved for this request. Contact an administrator.' });
            }

            const request = await prisma.$transaction(async (tx) => {
                const created = await tx.leaveRequest.create({
                    data: {
                        employeeId, userId, type,
                        startDate: new Date(startDate),
                        endDate: endDate ? new Date(endDate) : null,
                        startTime, endTime, reason, attachmentUrl, attachmentName,
                        status: 'PENDING'
                    }
                });
                await tx.leaveApprovalStep.createMany({
                    data: steps.map(s => ({
                        leaveRequestId: created.id,
                        sequence: STAGE_SEQUENCE[s.stage],
                        stage: s.stage,
                        approverUserId: s.approverUserId,
                        status: 'PENDING',
                    })),
                });
                return created;
            });
            return res.json(request);
        }

        // Non-chain request types (LATE_COMING/EARLY_LEAVING/HOURS_LEAVE) — unchanged behavior.
        const request = await prisma.leaveRequest.create({
            data: {
                employeeId,
                userId,
                type,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                startTime,
                endTime,
                reason,
                attachmentUrl,
                attachmentName,
                status: 'PENDING'
            }
        });
        res.json(request);
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(500).json({ error: 'Failed to create leave request' });
    }
};

export const updateRequestStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, managerNote, hrNote } = req.body;
        const userId = (req as any).user?.id;
        
        // Logical check: Once rejected, it cannot be updated.
        const current = await prisma.leaveRequest.findUnique({ 
            where: { id },
            include: { employee: true }
        });
        if (current?.status === 'REJECTED') {
            return res.status(400).json({ error: 'Rejected requests cannot be updated.' });
        }

        const updateData: any = { status, managerNote, hrNote };

        if (status === 'APPROVED_BY_UNIT') updateData.unitApprovedById = userId;
        if (status === 'APPROVED_BY_DEPT') updateData.deptApprovedById = userId;
        if (status === 'APPROVED_BY_DIVISION') updateData.divisionApprovedById = userId;
        if (status === 'APPROVED_BY_DIRECTOR' || status === 'COMPLETED') updateData.directorApprovedById = userId;

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.leaveRequest.update({
                where: { id },
                data: updateData
            });

            // If status becomes COMPLETED, update the employee's life cycle balances
            if (status === 'COMPLETED' && current) {
                const start = new Date(current.startDate);
                const end = current.endDate ? new Date(current.endDate) : start;
                
                // Calculate days (inclusive)
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                const employeeUpdate: any = {};
                if (current.type === 'PAID_HOLIDAY') {
                    employeeUpdate.holidaysUsed = { increment: diffDays };
                } else if (current.type === 'EMERGENCY_LEAVE') {
                    employeeUpdate.emergencyHolidaysUsed = { increment: diffDays };
                } else if (current.type === 'UNPAID_LEAVE') {
                    employeeUpdate.unpaidHolidaysUsed = { increment: diffDays };
                }

                if (Object.keys(employeeUpdate).length > 0) {
                    await tx.employee.update({
                        where: { id: current.employeeId },
                        data: employeeUpdate
                    });
                }
            }

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({ error: 'Failed to update request status' });
    }
};

// PATCH /staff-hub/requests/:requestId/steps/:stepId/decision — the new, server-authorized
// decision endpoint for the org-based approval chain (PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE
// only). Unlike updateRequestStatus above, this verifies the caller is actually the step's
// assigned approver and that it's genuinely their turn — closing the gap where any authenticated
// user could previously PATCH any request to any status.
export const decideApprovalStep = async (req: Request, res: Response) => {
    try {
        const { requestId, stepId } = req.params;
        const { decision, note } = req.body;
        const approverId = (req as AuthRequest).user?.id;
        if (!approverId) return res.status(401).json({ error: 'Not authenticated' });
        if (decision !== 'APPROVE' && decision !== 'REJECT') {
            return res.status(400).json({ error: 'decision must be APPROVE or REJECT.' });
        }

        const step = await prisma.leaveApprovalStep.findUnique({
            where: { id: stepId },
            include: { leaveRequest: { include: { employee: true } } },
        });
        if (!step || step.leaveRequestId !== requestId) {
            return res.status(404).json({ error: 'Approval step not found.' });
        }
        if (step.status !== 'PENDING' || step.leaveRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'This step is no longer awaiting approval.' });
        }
        if (step.approverUserId !== approverId) {
            return res.status(403).json({ error: 'You are not the assigned approver for this step.' });
        }

        const lowestPending = await prisma.leaveApprovalStep.findFirst({
            where: { leaveRequestId: requestId, status: 'PENDING' },
            orderBy: { sequence: 'asc' },
        });
        if (!lowestPending || lowestPending.sequence !== step.sequence) {
            return res.status(400).json({ error: 'An earlier approval stage is still pending.' });
        }

        let becameCompleted = false;

        await prisma.$transaction(async (tx) => {
            if (decision === 'REJECT') {
                await tx.leaveApprovalStep.update({ where: { id: stepId }, data: { status: 'REJECTED', note, decidedAt: new Date() } });
                await tx.leaveApprovalStep.updateMany({
                    where: { leaveRequestId: requestId, status: 'PENDING' },
                    data: { status: 'SKIPPED' },
                });
                await tx.leaveRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
                return;
            }

            await tx.leaveApprovalStep.update({ where: { id: stepId }, data: { status: 'APPROVED', note, decidedAt: new Date() } });

            // Read the remaining-pending count from inside this same transaction — not a
            // pre-transaction snapshot — so two rows in the same stage approved near-simultaneously
            // can't both think they're "the last one" and double-fire completion.
            const remainingPending = await tx.leaveApprovalStep.count({ where: { leaveRequestId: requestId, status: 'PENDING' } });
            if (remainingPending > 0) return;

            becameCompleted = true;
            const start = new Date(step.leaveRequest.startDate);
            const end = step.leaveRequest.endDate ? new Date(step.leaveRequest.endDate) : start;
            const dayCount = countLeaveDays(start, end);

            const employeeUpdate: any = {};
            if (step.leaveRequest.type === 'PAID_HOLIDAY') employeeUpdate.holidaysUsed = { increment: dayCount };
            else if (step.leaveRequest.type === 'EMERGENCY_LEAVE') employeeUpdate.emergencyHolidaysUsed = { increment: dayCount };
            else if (step.leaveRequest.type === 'UNPAID_LEAVE') employeeUpdate.unpaidHolidaysUsed = { increment: dayCount };

            await tx.leaveRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED' } });
            if (Object.keys(employeeUpdate).length > 0) {
                await tx.employee.update({ where: { id: step.leaveRequest.employeeId }, data: employeeUpdate });
            }
        });

        // Fired after the transaction commits (never inside it) — an external HTTP call must
        // not hold a DB transaction open, nor be able to roll it back. Fail-soft: logs and
        // continues, never fails the approval response over a BioTime hiccup.
        if (becameCompleted && step.leaveRequest.employee.staffId) {
            const leaveTypeId = LEAVE_TYPE_ID_MAP[step.leaveRequest.type];
            if (leaveTypeId) {
                const result = await createBioTimeLeaveRecord({
                    empCode: step.leaveRequest.employee.staffId,
                    leaveTypeId,
                    startDate: step.leaveRequest.startDate,
                    endDate: step.leaveRequest.endDate ?? step.leaveRequest.startDate,
                    notes: step.leaveRequest.reason ?? undefined,
                });
                if (!result.success) {
                    console.warn('[BioTime] Leave write-back failed (non-fatal):', result.message);
                }
            }
        }

        const updatedStep = await prisma.leaveApprovalStep.findUnique({ where: { id: stepId } });
        res.json(updatedStep);
    } catch (error) {
        console.error('Error deciding approval step:', error);
        res.status(500).json({ error: 'Failed to record the approval decision.' });
    }
};

// GET /staff-hub/requests/my-pending-steps — every step currently awaiting THIS user's decision.
// Scoped entirely to req.user.id server-side (the fix for the pre-existing authorization gap) —
// the frontend doesn't need to know or replicate any role/org logic to show the right inbox.
export const getMyPendingSteps = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });

        const myPending = await prisma.leaveApprovalStep.findMany({
            where: { approverUserId: userId, status: 'PENDING', leaveRequest: { status: 'PENDING' } },
            include: { leaveRequest: { include: { employee: true } } },
            orderBy: { createdAt: 'asc' },
        });
        if (myPending.length === 0) return res.json([]);

        // A later stage's rows exist from request-creation time but aren't actionable until every
        // earlier stage is fully approved — keep only rows matching the lowest still-pending
        // sequence for their own request.
        const requestIds = Array.from(new Set(myPending.map(s => s.leaveRequestId)));
        const lowestPendingByRequest = await prisma.leaveApprovalStep.groupBy({
            by: ['leaveRequestId'],
            where: { leaveRequestId: { in: requestIds }, status: 'PENDING' },
            _min: { sequence: true },
        });
        const lowestMap = new Map(lowestPendingByRequest.map(g => [g.leaveRequestId, g._min.sequence]));

        const current = myPending.filter(s => lowestMap.get(s.leaveRequestId) === s.sequence);
        res.json(current);
    } catch (error) {
        console.error('Error fetching my pending approval steps:', error);
        res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }
};

export const getRequestsByEmployee = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const requests = await prisma.leaveRequest.findMany({
            where: { employeeId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
};

export const getPendingRequests = async (req: Request, res: Response) => {
    try {
        const { departmentId, groupId, unitId, divisionId, status } = req.query;
        
        // Allow frontend to specify which statuses it considers pending, 
        // fallback to standard pending flow statuses.
        const statusFilters = status ? String(status).split(',') : ['PENDING', 'APPROVED_BY_UNIT', 'APPROVED_BY_DEPT', 'APPROVED_BY_DIVISION'];
        
        const where: any = { status: { in: statusFilters } };
        
        const employeeFilter: any = {};
        if (unitId) employeeFilter.unitId = String(unitId);
        if (departmentId) employeeFilter.departmentId = String(departmentId);
        if (divisionId) employeeFilter.divisionId = String(divisionId);
        if (groupId) employeeFilter.groupId = String(groupId);

        if (Object.keys(employeeFilter).length > 0) {
            where.employee = employeeFilter;
        }

        const requests = await prisma.leaveRequest.findMany({
            where,
            include: {
                employee: true,
                unitApprovedBy: { select: { fullName: true } },
                deptApprovedBy: { select: { fullName: true } },
                divisionApprovedBy: { select: { fullName: true } },
                directorApprovedBy: { select: { fullName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
};

// --- Task Management ---

export const createTask = async (req: AuthRequest, res: Response) => {
    try {
        const { assigneeId, departmentId, title, content, deadline, priority, category } = req.body;
        const authorId = req.user?.id;
        const authorRole = req.user?.role;

        if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

        // --- Logic for SELF_REPORT Tasks ---
        if (category === 'SELF_REPORT') {
            const activeTask = await prisma.staffTask.findFirst({
                where: {
                    assigneeId: authorId,
                    category: 'SELF_REPORT',
                    status: 'IN_PROGRESS'
                }
            });

            if (activeTask) {
                return res.status(400).json({ error: 'You already have an active task. Please complete it first.' });
            }

            // For self-report, author and assignee are the same
            const task = await prisma.staffTask.create({
                data: {
                    title,
                    content,
                    authorId,
                    assigneeId: authorId,
                    departmentId: req.user?.departmentId || null,
                    category: 'SELF_REPORT',
                    status: 'IN_PROGRESS',
                    priority: 'NORMAL'
                }
            });
            return res.json(task);
        }

        // --- Logic for ASSIGNED Tasks ---
        // Restrict to Managers and Admins
        const managerRoles = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
        if (!managerRoles.includes(authorRole || '')) {
            return res.status(403).json({ error: 'Only managers and admins can assign tasks' });
        }

        // Validate assignment permissions if assigning to an individual
        if (assigneeId) {
            const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
            if (!assignee) return res.status(404).json({ error: 'Assignee not found' });

            if (authorRole === 'HEAD_UNIT') {
                if (assignee.unitId !== req.user?.unitId) {
                    return res.status(403).json({ error: 'Heads of Unit can only assign to their own unit' });
                }
            } else if (authorRole === 'HEAD_DEPARTMENT') {
                if (assignee.departmentId !== req.user?.departmentId) {
                    return res.status(403).json({ error: 'Heads of Department can only assign within their department' });
                }
            } else if (authorRole === 'HEAD_DIRECTOR') {
                const isManagedDept = req.user?.departmentIds?.includes(assignee.departmentId || '');
                const isHead = ['HEAD_UNIT', 'HEAD_DEPARTMENT'].includes(assignee.role);
                if (!isHead && !isManagedDept) {
                    return res.status(403).json({ error: 'General Managers can only assign to Unit/Dept heads or staff within their departments' });
                }
            }
        }

        // Validate assignment permissions if assigning to a whole department
        if (departmentId) {
            if (authorRole === 'HEAD_UNIT' || authorRole === 'HEAD_DEPARTMENT') {
                if (departmentId !== req.user?.departmentId) {
                    return res.status(403).json({ error: 'You can only assign tasks to your own department' });
                }
            } else if (authorRole === 'HEAD_DIRECTOR') {
                if (!req.user?.departmentIds?.includes(departmentId)) {
                    return res.status(403).json({ error: 'You can only assign tasks to your managed departments' });
                }
            }
        }

        const task = await prisma.staffTask.create({
            data: {
                authorId,
                assigneeId: assigneeId || null,
                departmentId: departmentId || null,
                title,
                content,
                deadline: deadline ? new Date(deadline) : null,
                priority: priority || 'NORMAL',
                status: 'PENDING',
                category: 'ASSIGNED'
            }
        });
        res.json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
};

export const updateTaskStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            const task = await tx.staffTask.findUnique({ where: { id } });
            if (!task) throw new Error('Task not found');

            // Handle SELF_REPORT limit logic
            if (task.category === 'SELF_REPORT' && status === 'COMPLETED') {
                // Delete the old completed self-report task for this user
                await tx.staffTask.deleteMany({
                    where: {
                        assigneeId: task.assigneeId,
                        category: 'SELF_REPORT',
                        status: 'COMPLETED'
                    }
                });
            }

            return await tx.staffTask.update({
                where: { id },
                data: { status, updatedAt: new Date() }
            });
        });

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update task status' });
    }
};

export const reviewTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const task = await prisma.staffTask.update({
            where: { id },
            data: { isReviewed: true }
        });
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to review task' });
    }
};

export const getTasksForUser = async (req: Request, res: Response) => {
    try {
        const { userId, departmentId } = req.params;
        const deptId = (departmentId && departmentId !== 'undefined') ? departmentId : null;

        const tasks = await prisma.staffTask.findMany({
            where: {
                OR: [
                    { assigneeId: userId },
                    { authorId: userId },
                    deptId ? { departmentId: deptId } : {}
                ].filter(condition => Object.keys(condition).length > 0)
            },
            include: {
                author: { select: { fullName: true, role: true } },
                assignee: { select: { fullName: true, role: true } }
            },
            orderBy: { deadline: 'asc' }
        });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

export const getScopedTasks = async (req: AuthRequest, res: Response) => {
    try {
        const { role, departmentId, departmentIds, unitId, id: userId } = req.user!;
        
        let whereClause: any = {};

        if (role === 'SUPER_ADMIN' || role === 'HR_MANAGER') {
            whereClause = {}; // See all
        } else if (role === 'HEAD_DIRECTOR') {
            whereClause = {
                OR: [
                    { authorId: userId },
                    { assigneeId: userId },
                    { departmentId: { in: departmentIds || [] } },
                    { department: { id: { in: departmentIds || [] } } }
                ]
            };
        } else if (role === 'HEAD_DEPARTMENT') {
            whereClause = {
                OR: [
                    { authorId: userId },
                    { assigneeId: userId },
                    { departmentId: departmentId }
                ]
            };
        } else if (role === 'HEAD_UNIT') {
            whereClause = {
                OR: [
                    { authorId: userId },
                    { assigneeId: userId },
                    { assignee: { unitId: unitId } }
                ]
            };
        } else {
            whereClause = {
                OR: [
                    { authorId: userId },
                    { assigneeId: userId }
                ]
            };
        }

        const tasks = await prisma.staffTask.findMany({
            where: whereClause,
            include: {
                author: { select: { fullName: true, role: true } },
                assignee: { select: { fullName: true, role: true, unitId: true, departmentId: true } },
                department: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tasks);
    } catch (error: any) {
        console.error('Error fetching scoped tasks:', error);
        res.status(500).json({ error: error.message });
    }
};


// --- Announcements ---

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const { targetType, targetId, title, content, expiryDate } = req.body;
        const authorId = req.user?.id;
        const authorRole = req.user?.role;

        const managerRoles = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
        const hasManagePermission = (req.user?.permissions || []).includes('manage_announcements');

        if (!managerRoles.includes(authorRole || '') && !hasManagePermission) {
            return res.status(403).json({ error: 'Only authorized managers can post announcements' });
        }

        let attachmentUrl = null;
        let attachmentName = null;
        if (req.file) {
            attachmentUrl = `/uploads/announcements/${req.file.filename}`;
            attachmentName = req.file.originalname;
        }

        const announcement = await prisma.announcement.create({
            data: {
                authorId,
                targetType,
                targetId,
                title,
                content,
                attachmentUrl,
                attachmentName,
                expiryDate: expiryDate ? new Date(expiryDate) : null
            }
        });
        res.json(announcement);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create announcement' });
    }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const authorRole = req.user?.role;

        const managerRoles = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
        const hasManagePermission = (req.user?.permissions || []).includes('manage_announcements');

        if (!managerRoles.includes(authorRole || '') && !hasManagePermission) {
            return res.status(403).json({ error: 'Unauthorized to delete announcements' });
        }

        const announcement = await prisma.announcement.findUnique({ where: { id } });
        if (announcement?.attachmentUrl) {
            const filePath = path.join(__dirname, '../../', announcement.attachmentUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.announcement.delete({ where: { id } });
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { targetType, targetId, title, content, expiryDate } = req.body;
        const authorRole = req.user?.role;

        const managerRoles = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
        const hasManagePermission = (req.user?.permissions || []).includes('manage_announcements');

        if (!managerRoles.includes(authorRole || '') && !hasManagePermission) {
            return res.status(403).json({ error: 'Unauthorized to update announcements' });
        }

        const current = await prisma.announcement.findUnique({ where: { id } });
        let attachmentUrl = current?.attachmentUrl;
        let attachmentName = current?.attachmentName;

        if (req.file) {
            if (current?.attachmentUrl) {
                const filePath = path.join(__dirname, '../../', current.attachmentUrl);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            attachmentUrl = `/uploads/announcements/${req.file.filename}`;
            attachmentName = req.file.originalname;
        }

        const announcement = await prisma.announcement.update({
            where: { id },
            data: {
                targetType,
                targetId: targetType === 'GLOBAL' ? null : targetId,
                title,
                content,
                attachmentUrl,
                attachmentName,
                expiryDate: expiryDate ? new Date(expiryDate) : null
            }
        });
        res.json(announcement);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update announcement' });
    }
};

export const getAllAnnouncements = async (req: AuthRequest, res: Response) => {
    try {
        const authorRole = req.user?.role;
        const userPermissions = req.user?.permissions || [];
        const hasManagePermission = userPermissions.includes('manage_announcements');
        
        const managerRoles = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
        
        if (!managerRoles.includes(authorRole || '') && !hasManagePermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const announcements = await prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch all announcements' });
    }
};

export const getAnnouncementsForUser = async (req: Request, res: Response) => {
    try {
        const { userId, departmentId } = req.params;
        const deptId = (departmentId && departmentId !== 'undefined') ? departmentId : null;

        const announcements = await prisma.announcement.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { targetType: 'GLOBAL' },
                            deptId ? { AND: [{ targetType: 'DEPARTMENT' }, { targetId: deptId }] } : {},
                            { AND: [{ targetType: 'INDIVIDUAL' }, { targetId: userId }] }
                        ].filter(condition => Object.keys(condition).length > 0)
                    },
                    {
                        OR: [
                            { expiryDate: null },
                            { expiryDate: { gte: new Date() } }
                        ]
                    }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
};
