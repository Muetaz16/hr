import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

// GET /api/audit-logs?q=&page=&limit=&method=&from=&to=
// Paginated system activity log with a smart free-text search across user name/role, action, and
// path. Newest first.
export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q || '').trim();
        const method = String(req.query.method || '').trim().toUpperCase();
        const from = String(req.query.from || '').trim();
        const to = String(req.query.to || '').trim();
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));

        const where: Prisma.AuditLogWhereInput = {};
        if (q) {
            const terms = q.split(/\s+/).filter(Boolean);
            // Each whitespace-separated term must match somewhere (AND of ORs) — so "admin deleted"
            // finds rows where the actor is an admin AND the action was a delete.
            where.AND = terms.map(term => ({
                OR: [
                    { userName: { contains: term, mode: 'insensitive' } },
                    { userRole: { contains: term, mode: 'insensitive' } },
                    { action: { contains: term, mode: 'insensitive' } },
                    { details: { contains: term, mode: 'insensitive' } },
                    { path: { contains: term, mode: 'insensitive' } },
                    { method: { contains: term, mode: 'insensitive' } },
                ],
            }));
        }
        if (method) where.method = method;
        if (from || to) {
            where.createdAt = {};
            if (from) (where.createdAt as any).gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); (where.createdAt as any).lte = d; }
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({ logs, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
};
