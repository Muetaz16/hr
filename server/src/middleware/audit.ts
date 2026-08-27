import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from './auth';

import { prisma } from '../lib/prisma';

const VERB: Record<string, string> = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' };

// Noise we don't want in the activity log even though they're mutations.
const IGNORE_PREFIXES = ['/api/notifications']; // marking notifications read, etc.

// Best-effort human label from the HTTP method + path.
function describeAction(method: string, rawPath: string): string {
    const verb = VERB[method] || method;
    const clean = rawPath.replace(/^\/api\//, '').replace(/\/+$/, '');
    const seg = clean.split('/');
    const [s0, s1, s2, s3] = seg;

    if (s0 === 'staff-hub') {
        if (s1 === 'announcements') return `${verb} announcement`;
        if (s1 === 'tasks') return `${verb} task`;
        if (s1 === 'requests') {
            if (s3 === 'replacement-decision') return 'Decided leave replacement';
            if (seg.includes('decision')) return 'Decided leave approval step';
            if (s3 === 'status') return 'Updated leave request status';
            return `${verb} leave request`;
        }
        return `${verb} ${s1 || 'staff-hub item'}`;
    }
    if (s0 === 'evaluations') return `${verb} ${(s1 || '').replace(/-/g, ' ')} evaluation`.replace(/\s+/g, ' ').trim();
    if (s0 === 'attendance-integration') return `${verb} attendance record`;
    if (s0 === 'attendance-settings') return `${verb} attendance setting`;
    if (s0 === 'auth' && s1 === 'signature') return 'Updated signature';
    if (s0 === 'auth' && s1 === 'change-password') return 'Changed password';
    if (s0 === 'functional-hats') return `${verb} functional hat`;
    if (s0 === 'operations') return `${verb} ${s1 === 'assets' ? 'asset request' : 'support ticket'}`;
    if (s0 === 'personnel-actions') return s2 === 'inter-company' ? 'Created inter-company transfer' : (s2 === 'decide' || s3 === 'decide') ? 'Decided personnel action' : `${verb} personnel action`;

    const NOUNS: Record<string, string> = {
        employees: 'employee', users: 'user', departments: 'department', groups: 'group',
        divisions: 'division', directorates: 'directorate', units: 'unit', 'job-descriptions': 'job description',
        candidates: 'candidate', recruitment: 'recruitment request', payroll: 'payroll result',
        'evaluation-periods': 'evaluation period',
    };
    if (NOUNS[s0]) return `${verb} ${NOUNS[s0]}`;
    return `${verb} ${clean}`;
}

const empLabel = (e: { fullName: string | null; staffId?: string | null } | null): string | null =>
    e ? `${e.fullName || 'Unknown'}${e.staffId ? ` (${e.staffId})` : ''}` : null;

// Best-effort "who/what was this action about?" — resolves the subject employee/user from the
// request body or path so the log reads e.g. "for Hazem Adam Hussein (IPH-0125-001)". Controllers
// can override precisely by setting res.locals.auditDetails.
async function resolveTarget(req: Request): Promise<string | null> {
    const body: any = req.body || {};
    const path = req.originalUrl.split('?')[0];
    const seg = path.replace(/^\/api\//, '').replace(/\/+$/, '').split('/');
    const [s0, s1, s2] = seg;

    // Explicit subject in the body (leave requests, personnel actions, evaluations, payroll, …).
    const bodyEmpId = body.employeeId && typeof body.employeeId === 'string' ? body.employeeId : null;
    if (bodyEmpId) {
        return empLabel(await prisma.employee.findUnique({ where: { id: bodyEmpId }, select: { fullName: true, staffId: true } }).then(e => e).catch(() => null));
    }

    // /employees/:id (edit / delete / renew / terminate / handover / documents)
    if (s0 === 'employees' && s1 && !['me', 'contracts', 'next-staff-id', 'regenerate-staff-ids', 'upload-document'].includes(s1)) {
        return empLabel(await prisma.employee.findUnique({ where: { id: s1 }, select: { fullName: true, staffId: true } }).catch(() => null));
    }
    // /personnel-actions/:id/decide → the form's subject employee
    if (s0 === 'personnel-actions' && s1 && s1 !== 'inter-company') {
        const paf = await prisma.personnelActionForm.findUnique({ where: { id: s1 }, select: { employee: { select: { fullName: true, staffId: true } } } }).catch(() => null);
        return empLabel(paf?.employee ?? null);
    }
    // /staff-hub/requests/:id/... → the leave request's subject employee
    if (s0 === 'staff-hub' && s1 === 'requests' && s2) {
        const lr = await prisma.leaveRequest.findUnique({ where: { id: s2 }, select: { employee: { select: { fullName: true, staffId: true } } } }).catch(() => null);
        return empLabel(lr?.employee ?? null);
    }
    // User management: body.userId or /users/:id
    const userId = (body.userId && typeof body.userId === 'string') ? body.userId : (s0 === 'users' && s1 ? s1 : null);
    if (userId) {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true } }).catch(() => null);
        if (u) return u.fullName || u.email || null;
    }
    return null;
}

// Records every successful state-changing request. Mount globally BEFORE the routers: the finish
// handler runs after each router's authenticateToken has populated req.user. Fail-soft — a logging
// error must never break the actual request.
export function auditLogger(req: Request, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

    res.on('finish', () => {
        (async () => {
            if (res.statusCode >= 400) return; // only log successful actions
            const path = req.originalUrl.split('?')[0];
            if (IGNORE_PREFIXES.some(p => path.startsWith(p))) return;
            const user = (req as AuthRequest).user;
            if (!user?.id) return; // skip unauthenticated (e.g. login) for now

            // A controller may set res.locals.auditDetails for a precise subject; otherwise resolve it.
            let details: string | null = (res.locals && (res.locals as any).auditDetails) || null;
            if (!details) {
                const target = await resolveTarget(req).catch(() => null);
                details = target ? `for ${target}` : null;
            }

            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    userName: (user as any).fullName || null,
                    userRole: user.role || null,
                    action: describeAction(method, path),
                    details,
                    method,
                    path,
                    statusCode: res.statusCode,
                },
            });
        })().catch(() => { /* never break the request over a log write */ });
    });

    next();
}
