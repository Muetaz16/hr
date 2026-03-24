import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// --- Leave & Permission Requests ---

export const createLeaveRequest = async (req: Request, res: Response) => {
    try {
        const { employeeId, userId, type, startDate, endDate, startTime, endTime, reason } = req.body;
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
                status: 'PENDING'
            }
        });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create leave request' });
    }
};

export const updateRequestStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, managerNote, hrNote } = req.body;
        const userId = (req as any).user?.id;
        
        // Logical check: Once rejected, it cannot be approved
        const current = await prisma.leaveRequest.findUnique({ where: { id } });
        if (current?.status === 'REJECTED') {
            return res.status(400).json({ error: 'Rejected requests cannot be updated.' });
        }

        const updateData: any = { status, managerNote, hrNote };

        if (status === 'APPROVED_BY_UNIT') updateData.unitApprovedById = userId;
        if (status === 'APPROVED_BY_DEPT') updateData.deptApprovedById = userId;
        if (status === 'APPROVED_BY_DIRECTOR' || status === 'COMPLETED') updateData.directorApprovedById = userId;

        const request = await prisma.leaveRequest.update({
            where: { id },
            data: updateData
        });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update request status' });
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
        const { departmentId, groupId, unitId, status } = req.query;
        
        // Allow frontend to specify which statuses it considers pending, 
        // fallback to standard pending flow statuses.
        const statusFilters = status ? String(status).split(',') : ['PENDING', 'APPROVED_BY_UNIT', 'APPROVED_BY_DEPT'];
        
        const where: any = { status: { in: statusFilters } };
        
        const employeeFilter: any = {};
        if (unitId) employeeFilter.unitId = String(unitId);
        if (departmentId) employeeFilter.departmentId = String(departmentId);
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
        const { assigneeId, departmentId, title, content, deadline, priority } = req.body;
        const authorId = req.user?.id;
        const authorRole = req.user?.role;

        if (!authorId) return res.status(401).json({ error: 'Unauthorized' });

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
                // Directors assigned to HEAD_UNIT or HEAD_DEPARTMENT in their departments
                const allowedRoles = ['HEAD_UNIT', 'HEAD_DEPARTMENT'];
                const isManagedDept = req.user?.departmentIds?.includes(assignee.departmentId || '');
                if (!allowedRoles.includes(assignee.role) || !isManagedDept) {
                    return res.status(403).json({ error: 'Directors can only assign to Unit/Dept heads in their departments' });
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
                priority,
                status: 'PENDING'
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
        const task = await prisma.staffTask.update({
            where: { id },
            data: { status }
        });
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update task status' });
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
        const { role, unitId, departmentId, departmentIds, id } = req.user!;
        const { status } = req.query;

        const isFullManager = role === 'SUPER_ADMIN';

        const where: any = {};
        if (status) where.status = status;

        if (isFullManager) {
            // See everything
        } else {
            // Everyone else only sees their own assigned tasks
            where.assigneeId = id;
        }

        const tasks = await prisma.staffTask.findMany({
            where,
            include: {
                author: { select: { fullName: true, role: true } },
                assignee: { select: { fullName: true, role: true } },
                department: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tasks);
    } catch (error) {
        console.error('Error fetching scoped tasks:', error);
        res.status(500).json({ error: 'Failed to fetch scoped tasks' });
    }
};


// --- Announcements ---

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const { targetType, targetId, title, content, expiryDate } = req.body;
        const authorId = req.user?.id;
        const authorRole = req.user?.role;

        if (authorRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only Super Admins can post announcements' });
        }
        const announcement = await prisma.announcement.create({
            data: {
                authorId,
                targetType,
                targetId,
                title,
                content,
                expiryDate: expiryDate ? new Date(expiryDate) : null
            }
        });
        res.json(announcement);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create announcement' });
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
