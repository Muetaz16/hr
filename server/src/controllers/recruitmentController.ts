import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all recruitment requests
export const getAllRecruitmentRequests = async (req: Request, res: Response) => {
    try {
        const { status, departmentId } = req.query;
        const where: any = {};
        if (status) where.status = String(status);
        if (departmentId) where.departmentId = String(departmentId);

        const requests = await prisma.recruitmentRequest.findMany({
            where,
            include: {
                requester: { select: { id: true, fullName: true, role: true } },
                unit: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                hrApprovedBy: { select: { id: true, fullName: true } },
                gmApprovedBy: { select: { id: true, fullName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        console.error('Error fetching recruitment requests:', error);
        res.status(500).json({ error: 'Failed to fetch recruitment requests' });
    }
};

// Create a recruitment request
export const createRecruitmentRequest = async (req: Request, res: Response) => {
    try {
        const { jobTitle, reason, unitId, departmentId } = req.body;
        const requesterId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        if (!jobTitle || !departmentId || !requesterId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // If requester is Head of Dept or above, auto-set to DEPT_APPROVED
        const initialStatus = (userRole === 'HEAD_DEPARTMENT' || userRole === 'SUPER_ADMIN' || userRole === 'HR_MANAGER' || userRole === 'HEAD_DIRECTOR') 
            ? 'DEPT_APPROVED' 
            : 'PENDING';

        const request = await prisma.recruitmentRequest.create({
            data: {
                jobTitle,
                reason,
                unitId: unitId || null,
                departmentId,
                requesterId,
                status: initialStatus
            },
            include: {
                requester: true,
                unit: true,
                department: true
            }
        });

        res.status(201).json(request);
    } catch (error) {
        console.error('Error creating recruitment request:', error);
        res.status(500).json({ error: 'Failed to create recruitment request' });
    }
};

// Approve/Reject recruitment request
export const updateRecruitmentRequestStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body; // status: DEPT_APPROVED, HR_APPROVED, FULLY_APPROVED, REJECTED
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;
        const userDeptId = (req as any).user?.departmentId;

        const existing = await prisma.recruitmentRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });

        const updateData: any = { status };

        if (status === 'DEPT_APPROVED') {
            if (userRole !== 'HEAD_DEPARTMENT' && userRole !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Only Department Head can approve at this stage' });
            }
            if (userRole === 'HEAD_DEPARTMENT' && existing.departmentId !== userDeptId) {
                return res.status(403).json({ error: 'You can only approve requests within your department' });
            }
            updateData.deptApprovedById = userId;
            updateData.deptNote = note;
        } else if (status === 'HR_APPROVED') {
            if (userRole !== 'HR_MANAGER' && userRole !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Only HR Manager can approve at this stage' });
            }
            updateData.hrApprovedById = userId;
            updateData.hrNote = note;
        } else if (status === 'FULLY_APPROVED') {
            if (userRole !== 'HEAD_DIRECTOR' && userRole !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Only General Manager can provide final approval' });
            }
            // Logic change: GM can approve directly without waiting for HR/Dept if they want
            updateData.gmApprovedById = userId;
            updateData.gmNote = note;
        } else if (status === 'REJECTED') {
            if (userRole === 'HEAD_DEPARTMENT') {
                updateData.deptNote = note;
                updateData.deptApprovedById = userId;
            } else if (userRole === 'HR_MANAGER') {
                updateData.hrNote = note;
                updateData.hrApprovedById = userId;
            } else if (userRole === 'HEAD_DIRECTOR' || userRole === 'SUPER_ADMIN') {
                updateData.gmNote = note;
                updateData.gmApprovedById = userId;
            }
        }

        // Use transaction to update request and potentially increment unit headcount
        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.recruitmentRequest.update({
                where: { id },
                data: updateData,
                include: {
                    requester: true,
                    unit: true,
                    department: true,
                    deptApprovedBy: true,
                    hrApprovedBy: true,
                    gmApprovedBy: true
                }
            });

            // If fully approved and linked to a unit, auto-increment headcount
            if (status === 'FULLY_APPROVED' && updated.unitId) {
                await tx.unit.update({
                    where: { id: updated.unitId },
                    data: { headcount: { increment: 1 } }
                });
            }

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Error updating recruitment status:', error);
        res.status(500).json({ error: 'Failed to update recruitment status' });
    }
};

export const updateRecruitmentRequest = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { jobTitle, reason, unitId, departmentId } = req.body;
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

        const updated = await prisma.recruitmentRequest.update({
            where: { id },
            data: {
                jobTitle,
                reason,
                unitId: unitId || null,
                departmentId
            },
            include: {
                requester: true,
                unit: true,
                department: true
            }
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

        if (existing.requesterId !== userId && userRole !== 'SUPER_ADMIN' && userRole !== 'HR_MANAGER' && userRole !== 'HEAD_DIRECTOR') {
            return res.status(403).json({ error: 'Unauthorized to delete this request' });
        }

        await prisma.recruitmentRequest.delete({ where: { id } });
        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error('Error deleting recruitment request:', error);
        res.status(500).json({ error: 'Failed to delete recruitment request' });
    }
};
