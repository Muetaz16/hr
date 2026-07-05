import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// --- Asset Requests (Onboarding) ---

export const createAssetRequest = async (req: AuthRequest, res: Response) => {
    try {
        const { employeeId, itemType, priority, notes } = req.body;
        const requesterId = req.user?.id;

        if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });

        const request = await prisma.assetRequest.create({
            data: {
                employeeId,
                requesterId,
                itemType,
                priority: priority || 'NORMAL',
                notes,
                status: 'PENDING'
            },
            include: {
                employee: { select: { fullName: true, staffId: true } },
                requester: { select: { fullName: true } }
            }
        });

        res.json(request);
    } catch (error) {
        console.error('Error creating asset request:', error);
        res.status(500).json({ error: 'Failed to create asset request', details: String(error) });
    }
};

export const updateAssetStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes, priority } = req.body;

        const request = await prisma.assetRequest.update({
            where: { id },
            data: { status, notes, priority },
            include: {
                employee: { select: { fullName: true } }
            }
        });

        res.json(request);
    } catch (error) {
        console.error('Error updating asset status:', error);
        res.status(500).json({ error: 'Failed to update asset status', details: String(error) });
    }
};

export const getScopedAssetRequests = async (req: AuthRequest, res: Response) => {
    try {
        const { role, id } = req.user!;
        const { status } = req.query;

        const where: any = {};
        if (status) where.status = status;

        // Admins/HR see everything, employees see their own or for their link
        if (role !== 'SUPER_ADMIN' && role !== 'HR_MANAGER' && role !== 'PERSONNEL') {
            where.OR = [
                { requesterId: id },
                { employee: { userId: id } }
            ];
        }

        const requests = await prisma.assetRequest.findMany({
            where,
            include: {
                employee: { 
                    select: { 
                        fullName: true, 
                        staffId: true, 
                        position: true,
                        department: { select: { name: true } },
                        unit: { select: { name: true } }
                    } 
                },
                requester: { select: { fullName: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(requests);
    } catch (error) {
        console.error('Error fetching asset requests:', error);
        res.status(500).json({ error: 'Failed to fetch asset requests', details: String(error) });
    }
};

// --- Support Tickets (Help Desk) ---

export const createSupportTicket = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, category, priority } = req.body;
        const requesterId = req.user?.id;

        if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });

        const ticket = await prisma.supportTicket.create({
            data: {
                requesterId,
                title,
                description,
                category,
                priority: priority || 'NORMAL',
                status: 'OPEN'
            },
            include: {
                requester: { select: { fullName: true, role: true } }
            }
        });

        res.json(ticket);
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ error: 'Failed to create support ticket', details: String(error) });
    }
};

export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, resolution, priority } = req.body;

        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: { status, resolution, priority },
            include: {
                requester: { select: { fullName: true } },
                assignee: { select: { fullName: true } }
            }
        });

        res.json(ticket);
    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({ error: 'Failed to update ticket status', details: String(error) });
    }
};

export const assignTicket = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { assigneeId, estimatedReadyAt } = req.body;

        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: { 
                assigneeId,
                estimatedReadyAt: estimatedReadyAt ? new Date(estimatedReadyAt) : undefined,
                status: 'IN_PROGRESS'
            },
            include: {
                assignee: { select: { fullName: true, role: true } },
                requester: { select: { fullName: true } }
            }
        });

        res.json(ticket);
    } catch (error) {
        console.error('Error assigning ticket:', error);
        res.status(500).json({ error: 'Failed to assign ticket', details: String(error) });
    }
};

export const getScopedTickets = async (req: AuthRequest, res: Response) => {
    try {
        const { role, id } = req.user!;
        const { status, category } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (category) where.category = category;

        // Regular employees only see their own tickets
        if (role !== 'SUPER_ADMIN' && role !== 'HR_MANAGER' && role !== 'PERSONNEL') {
            where.requesterId = id;
        }

        const tickets = await prisma.supportTicket.findMany({
            where,
            include: {
                requester: { 
                    select: { 
                        fullName: true, 
                        role: true, 
                        email: true,
                        employee: {
                            select: {
                                staffId: true,
                                position: true,
                                department: { select: { name: true } },
                                unit: { select: { name: true } }
                            }
                        }
                    } 
                },
                assignee: { select: { fullName: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets', details: String(error) });
    }
};

export const deleteTicket = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { role } = req.user!;

        // Restricted to certain roles
        if (role !== 'SUPER_ADMIN' && role !== 'HR_MANAGER' && role !== 'PERSONNEL') {
            return res.status(403).json({ error: 'Permission denied to delete tickets' });
        }

        await prisma.supportTicket.delete({ where: { id } });
        res.json({ message: 'Ticket deleted successfully' });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Failed to delete ticket', details: String(error) });
    }
};
