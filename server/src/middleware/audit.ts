import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from './auth';

import { prisma } from '../lib/prisma';

const VERB: Record<string, string> = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' };

// Readable labels for the disciplinary workflow stages (used in the activity-log action text).
const DISCIPLINARY_STAGE_LABELS: Record<string, string> = {
    INCIDENT_REPORT: 'Incident Report',
    NOTICE_TO_EXPLAIN: 'Notice to Explain',
    INVESTIGATION_RESULT: 'Investigation Result',
    DISCIPLINARY_ACTION: 'Disciplinary Action',
};

// Friendly names for the evaluation levels (the URL uses short codes like hr/gm/dept).
const EVAL_STAGE_LABELS: Record<string, string> = {
    hr: 'HR', unit: 'Unit', dept: 'Department', division: 'Division',
    director: 'Directorate', gm: 'GM', chairman: 'Chairman', personnel: 'Personnel',
};

// Candidate-pipeline action labels, keyed by the URL action segment.
const CANDIDATE_ACTIONS: Record<string, string> = {
    screen: 'Screened candidate',
    interview: 'Scheduled candidate interview',
    'hr-eval': 'Recorded candidate HR evaluation',
    'tech-eval': 'Recorded candidate technical evaluation',
    finalize: 'Finalized candidate decision',
    offer: 'Recorded candidate offer response',
    hire: 'Marked candidate hired',
    'offer-details': 'Updated candidate offer details',
    'onboarding-link': 'Generated candidate onboarding link',
};

// "MY_STAGE_CODE" → "My Stage Code" — for form-stage codes we don't have an explicit label for.
const titleCase = (code: string): string =>
    (code || '').replace(/[_-]+/g, ' ').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

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
            // Named apart from an ordinary "Created leave request": this one had no approval chain
            // behind it, so the log has to say so on its face rather than look like every other row.
            if (s2 === 'direct-leave') return 'Recorded a leave directly (no approval chain)';
            if (s3 === 'replacement-decision') return 'Decided leave replacement';
            if (seg.includes('decision')) return 'Decided leave approval step';
            if (s3 === 'status') return 'Updated leave request status';
            return `${verb} leave request`;
        }
        return `${verb} ${s1 || 'staff-hub item'}`;
    }
    if (s0 === 'evaluations') {
        if (s1 === 'finalize') return 'Finalized evaluations';
        if (s1 === 'hr' && s2 === 'recompute-presence') return 'Recomputed presence scores';
        if (s1 === 'director' && s2 === 'lock') return 'Locked directorate evaluation';
        const stage = EVAL_STAGE_LABELS[s1] || titleCase(s1 || '');
        return `${method === 'DELETE' ? 'Deleted' : 'Saved'} ${stage} evaluation`.replace(/\s+/g, ' ').trim();
    }
    if (s0 === 'attendance-integration') {
        if (s1 === 'missing-punches') return 'Logged a missing punch';
        if (s1 === 'punch-corrections') return 'Corrected a punch';
        if (s1 === 'leaves' || s1 === 'employee-leaves') return `${verb === 'Deleted' ? 'Deleted' : 'Registered'} attendance leave`;
        if (s1 === 'overtimes') return 'Registered overtime';
        if (s1 === 'overtime-approvals') {
            // A revoke is a DELETE that sets the hours to zero — the attendance system has no
            // delete for overtime — so the log says revoked, not deleted.
            if (method === 'DELETE') return 'Revoked an overtime approval';
            if (method === 'PATCH') return 'Changed approved overtime';
            return 'Approved overtime';
        }
        if (s1 === 'out-works') return `${verb === 'Deleted' ? 'Deleted' : 'Registered'} out-work`;
        if (s1 === 'excused-lates') return `${verb === 'Deleted' ? 'Deleted' : 'Registered'} excused late`;
        if (s1 === 'excused-early-outs') return `${verb === 'Deleted' ? 'Deleted' : 'Registered'} excused early-out`;
        if (s1 === 'biotime-employees') return `${verb} BioTime employee`;
        if (s1 === 'sync-employees') return 'Synced employees from BioTime';
        return `${verb} attendance record`;
    }
    if (s0 === 'attendance-settings') {
        if (s1 === 'settings') return 'Updated work-hour setting';
        if (s1 === 'leave-types') return 'Updated leave type';
        if (s1 === 'holidays') return `${verb} holiday`;
        if (s1 === 'multiplier-factors') return `${verb} multiplier factor`;
        return `${verb} attendance setting`;
    }
    if (s0 === 'auth' && s1 === 'signature') return 'Updated signature';
    if (s0 === 'auth' && s1 === 'change-password') return 'Changed password';
    if (s0 === 'functional-hats') return `${verb} functional hat`;
    if (s0 === 'operations') return `${verb} ${s1 === 'assets' ? 'asset request' : 'support ticket'}`;
    if (s0 === 'personnel-actions') return s1 === 'inter-company' ? 'Created inter-company transfer' : (s2 === 'decide' || s3 === 'decide') ? 'Decided personnel action' : `${verb} personnel action`;
    if (s0 === 'disciplinary-cases') {
        if (s1 === 'incident-report') return 'Created incident report';
        if (s1 === 'attendance-candidates') return 'Executed attendance disciplinary case';
        if (s2 === 'form') return `Generated ${DISCIPLINARY_STAGE_LABELS[s3] || (s3 || '').replace(/_/g, ' ')} form`;
        if (s2 === 'evidence') return 'Added disciplinary evidence';
        if (s2 === 'complete-incident-report') return 'Completed Incident Report';
        if (s2 === 'dismiss-incident-report') return 'Dismissed Incident Report';
        if (s2 === 'complete-notice-to-explain') return 'Completed Notice to Explain';
        if (s2 === 'complete-investigation-result') return 'Completed Investigation Result';
        if (s2 === 'complete-disciplinary-action') return 'Completed Disciplinary Action';
        if (method === 'PATCH') return 'Updated disciplinary case';
        return `${verb} disciplinary case`;
    }
    if (s0 === 'offboarding-cases') {
        if (s1 === 'resignation-request') return 'Filed resignation request';
        if (s1 === 'exit-interview') return 'Submitted exit interview';
        if (s1 === 'manual') return 'Opened offboarding case';
        if (s2 === 'form') return `Generated ${titleCase(s3 || '')} form`.replace(/\s+/g, ' ').trim();
        if (s2 === 'resignation-attachments') return 'Added resignation attachments';
        if (s2 === 'complete-resignation-request') return 'Completed resignation request';
        if (s2 === 'complete-clearance') return 'Completed clearance';
        if (s2 === 'complete-separation-letter') return 'Completed separation letter';
        return `${verb} offboarding case`;
    }
    if (s0 === 'employees') {
        if (s1 === 'regenerate-staff-ids') return 'Regenerated all staff IDs';
        if (s1 === 'upload-document') return 'Uploaded a document';
        if (s2 === 'renew') return 'Renewed employee contract';
        if (s2 === 'terminate') return 'Terminated employee';
        if (s2 === 'documents') return method === 'DELETE' ? 'Removed employee document' : 'Added employee document';
        if (method === 'DELETE') return 'Deleted employee';
        if (method === 'PUT' || method === 'PATCH') return 'Updated employee';
        return 'Registered new employee';
    }
    if (s0 === 'time') return 'Updated time record';
    if (s0 === 'recruitment') {
        if (s2 === 'status') return 'Decided recruitment request';
        if (s2 === 'prf-approve') return 'Approved a recruitment (PRF) stage';
        if (method === 'DELETE') return 'Deleted recruitment request';
        if (method === 'PUT' || method === 'PATCH') return 'Updated recruitment request';
        return 'Created recruitment request';
    }
    if (s0 === 'candidates') {
        if (s2 && CANDIDATE_ACTIONS[s2]) return CANDIDATE_ACTIONS[s2];
        if (method === 'DELETE') return 'Deleted candidate';
        return 'Added candidate';
    }

    // --- Payroll -----------------------------------------------------------------------------
    // Every path here carries UUIDs, so without these branches the log reads
    // "Created payroll-runs/82c0309f-.../compute" — technically accurate and useless to read.
    if (s0 === 'payroll-runs') {
        if (!s1) return 'Opened a payroll period';
        if (s2 === 'compute') return 'Computed a payroll period';
        if (s2 === 'close') return 'Closed and signed off a payroll period';
        if (s2 === 'documents') return 'Uploaded a payroll document';
        if (s2 === 'lines') {
            // .../lines/:lineId/corrections[/:correctionId]
            if (seg[4] === 'corrections') {
                return method === 'DELETE' ? 'Removed a payroll correction' : 'Added a payroll correction';
            }
            if (seg[4] === 'payslip') return 'Downloaded an employee payslip';
            return 'Updated a payroll line';
        }
        // Reads. Logged because each one carries every employee's salary out of the system.
        if (s2 === 'master-data') return 'Exported the payroll review sheet';
        if (s2 === 'approval-form') return 'Downloaded the salary approval form';
        if (s2 === 'payslips') return 'Downloaded every payslip for a period';
        if (method === 'DELETE') return 'Deleted a payroll period';
        return `${verb} payroll period`;
    }
    if (s0 === 'payroll-advances') {
        if (s1 === 'documents') return 'Uploaded a payroll document';
        if (s1 === 'provider-batches') {
            if (s3 === 'form') return 'Issued a provider cash advance form';
            if (s3 === 'approve') return "Recorded a provider's approval of advances";
            if (s3 === 'disburse') return 'Recorded an advance cash handover';
            return 'Updated a provider advance round';
        }
        if (s2 === 'approve') return 'Approved a salary advance';
        if (s2 === 'reject') return 'Rejected a salary advance';
        if (s2 === 'cancel') return 'Cancelled a salary advance';
        if (s2 === 'instalments') return 'Updated an advance instalment';
        return 'Recorded a salary advance';
    }
    if (s0 === 'advance-requests') {
        // The employee's own screen, so the actor is the employee rather than payroll.
        if (s3 === 'withdraw') return 'Withdrew their salary advance request';
        return 'Requested a salary advance';
    }
    if (s0 === 'payroll-deductions') {
        if (s2 === 'approve') return 'Approved a salary deduction';
        if (s2 === 'cancel') return 'Cancelled a salary deduction';
        if (method === 'PATCH' || method === 'PUT') return 'Updated a salary deduction';
        return 'Recorded a salary deduction';
    }
    if (s0 === 'payroll-rewards') return "Changed a bonus's payout month";
    if (s0 === 'salary-structures') {
        if (method === 'DELETE') return 'Removed a salary rate';
        if (method === 'PATCH' || method === 'PUT') return 'Changed a salary rate';
        return 'Added a salary rate';
    }
    if (s0 === 'service-providers') {
        if (method === 'DELETE') return 'Deleted a service provider';
        if (method === 'PATCH' || method === 'PUT') return 'Updated a service provider';
        return 'Added a service provider';
    }
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
    // /disciplinary-cases/:id/... → the case's subject employee (create-by-body.employeeId is
    // already handled above; attendance auto-execute carries the employee id in the path).
    if (s0 === 'disciplinary-cases' && s1) {
        if (s1 === 'attendance-candidates' && s2) {
            return empLabel(await prisma.employee.findUnique({ where: { id: s2 }, select: { fullName: true, staffId: true } }).catch(() => null));
        }
        if (s1 !== 'incident-report' && s1 !== 'attendance-candidates') {
            const dc = await prisma.disciplinaryCase.findUnique({ where: { id: s1 }, select: { employee: { select: { fullName: true, staffId: true } } } }).catch(() => null);
            return empLabel(dc?.employee ?? null);
        }
    }
    // /offboarding-cases/:id/... → the case's subject employee (manual create uses body.employeeId,
    // handled above; the self-service resignation/exit-interview are about the caller themselves).
    if (s0 === 'offboarding-cases' && s1 && !['resignation-request', 'exit-interview', 'manual'].includes(s1)) {
        const oc = await prisma.offboardingCase.findUnique({ where: { id: s1 }, select: { employee: { select: { fullName: true, staffId: true } } } }).catch(() => null);
        return empLabel(oc?.employee ?? null);
    }
    // /attendance-integration/* daily logging → the subject employee is carried as empCode (staffId).
    if (s0 === 'attendance-integration' && typeof body.empCode === 'string' && body.empCode) {
        return empLabel(await prisma.employee.findFirst({ where: { staffId: body.empCode }, select: { fullName: true, staffId: true } }).catch(() => null));
    }
    // /candidates → the candidate is the subject (by :id, or body.fullName on create).
    if (s0 === 'candidates') {
        if (s1) {
            const c = await prisma.candidate.findUnique({ where: { id: s1 }, select: { fullName: true } }).catch(() => null);
            if (c?.fullName) return c.fullName;
        } else if (typeof body.fullName === 'string' && body.fullName.trim()) {
            return body.fullName;
        }
    }
    // /recruitment → the requisition (by :id, or body.jobTitle on create).
    if (s0 === 'recruitment') {
        if (s1) {
            const r = await prisma.recruitmentRequest.findUnique({ where: { id: s1 }, select: { jobTitle: true } }).catch(() => null);
            if (r?.jobTitle) return r.jobTitle;
        } else if (typeof body.jobTitle === 'string' && body.jobTitle.trim()) {
            return body.jobTitle;
        }
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
    // Last resort for org/config creates (departments, units, holidays, functional hats, …) — name
    // the entity from the body so the log reads e.g. "Created department · for Finance".
    if (typeof body.name === 'string' && body.name.trim()) return body.name.trim();
    return null;
}

// Records every successful state-changing request. Mount globally BEFORE the routers: the finish
// handler runs after each router's authenticateToken has populated req.user. Fail-soft — a logging
// error must never break the actual request.
/**
 * Reads that are worth logging even though they change nothing.
 *
 * A GET normally leaves no trace here, which is right for browsing — but these four carry every
 * employee's salary out of the system as a file. "Who downloaded the payroll and when" is the first
 * question an auditor asks, and until now nothing could answer it.
 */
const AUDITED_READS: RegExp[] = [
    /^\/api\/payroll-runs\/[^/]+\/master-data$/,     // the full 62-column review sheet
    /^\/api\/payroll-runs\/[^/]+\/approval-form$/,   // the memo carrying every net total
    /^\/api\/payroll-runs\/[^/]+\/payslips$/,        // every payslip in one file
    /^\/api\/payroll-runs\/[^/]+\/lines\/[^/]+\/payslip$/,
];

export function auditLogger(req: Request, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    // Matched on the path only, so a query string cannot slip a download past the check.
    const isAuditedRead = method === 'GET'
        && AUDITED_READS.some(re => re.test(req.originalUrl.split('?')[0]));
    if (!isMutation && !isAuditedRead) return next();

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
