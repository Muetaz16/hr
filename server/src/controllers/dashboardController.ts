import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ACTIVE_ENROLLMENT_FILTER } from '../utils/employeeStatus';

// GET /api/dashboard/analytics
// A single, server-side aggregated payload powering the executive/HR analytics section on the
// Dashboard. Everything here is computed with Prisma groupBy/count/aggregate so the browser makes
// ONE call instead of fetching every employee/candidate/contract and crunching them client-side.
// Read-only; gated to HR + executive roles at the route level.
export const getDashboardAnalytics = async (_req: AuthRequest, res: Response) => {
    try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        // "Active" mirrors the Dashboard's Active Employees card: everyone still employed —
        // excludes both offboarded (SEPARATED) and inter-company transfers (TRANSFERRED).
        // PENDING_ENROLLMENT stubs are tracked separately below.
        const ACTIVE_WHERE = { enrollmentStatus: ACTIVE_ENROLLMENT_FILTER } as const;

        const [
            activeCount,
            pendingEnrollment,
            transferred,
            newHiresThisYear,
            candidatesByStage,
            openRequisitions,
            positionsToFill,
            headcountRaw,
            departments,
            contractEmployees,
            leaveByTypeRaw,
        ] = await Promise.all([
            prisma.employee.count({ where: ACTIVE_WHERE }),
            prisma.employee.count({ where: { enrollmentStatus: 'PENDING_ENROLLMENT' } }),
            prisma.employee.count({ where: { enrollmentStatus: 'TRANSFERRED' } }),
            prisma.employee.count({ where: { ...ACTIVE_WHERE, joinDate: { gte: startOfYear } } }),
            prisma.candidate.groupBy({ by: ['stage'], _count: { _all: true } }),
            prisma.recruitmentRequest.count({ where: { filled: false } }),
            prisma.recruitmentRequest.aggregate({ where: { filled: false }, _sum: { quantity: true } }),
            prisma.employee.groupBy({ by: ['departmentId'], where: ACTIVE_WHERE, _count: { _all: true } }),
            prisma.department.findMany({ select: { id: true, name: true } }),
            prisma.employee.findMany({
                where: { ...ACTIVE_WHERE, contractEndDate: { not: null } },
                select: { contractEndDate: true },
            }),
            prisma.leaveRequest.groupBy({ by: ['type'], where: { createdAt: { gte: startOfYear } }, _count: { _all: true } }),
        ]);

        // --- Recruitment funnel (ordered pipeline stages; terminal states reported separately) ---
        const stageCount = (s: string) =>
            candidatesByStage.find(r => r.stage === s)?._count._all ?? 0;
        const recruitmentFunnel = [
            { stage: 'SCREENING', label: 'Screening', count: stageCount('SCREENING') },
            { stage: 'INTERVIEW', label: 'Interview', count: stageCount('INTERVIEW') },
            { stage: 'OFFER', label: 'Offer', count: stageCount('OFFER') },
            { stage: 'HIRED', label: 'Hired', count: stageCount('HIRED') },
        ];
        const recruitment = {
            openRequisitions,
            positionsToFill: positionsToFill._sum.quantity ?? 0,
            rejected: stageCount('REJECTED'),
            withdrawn: stageCount('WITHDRAWN'),
        };

        // --- Headcount by department (null department => Unassigned) ---
        const deptName = new Map(departments.map(d => [d.id, d.name]));
        const headcountByDepartment = headcountRaw
            .map(row => ({
                name: row.departmentId ? (deptName.get(row.departmentId) ?? 'Unknown') : 'Unassigned',
                count: row._count._all,
            }))
            .sort((a, b) => b.count - a.count);

        // --- Contract-expiry timeline (buckets relative to today) ---
        const dayMs = 1000 * 60 * 60 * 24;
        const buckets = { expired: 0, d30: 0, d60: 0, d90: 0, later: 0 };
        for (const e of contractEmployees) {
            if (!e.contractEndDate) continue;
            const end = new Date(e.contractEndDate);
            end.setHours(0, 0, 0, 0);
            const days = Math.round((end.getTime() - now.getTime()) / dayMs);
            if (days < 0) buckets.expired++;
            else if (days <= 30) buckets.d30++;
            else if (days <= 60) buckets.d60++;
            else if (days <= 90) buckets.d90++;
            else buckets.later++;
        }
        const contractExpiry = [
            { bucket: 'expired', label: 'Expired', count: buckets.expired },
            { bucket: 'd30', label: '≤ 30 days', count: buckets.d30 },
            { bucket: 'd60', label: '31–60 days', count: buckets.d60 },
            { bucket: 'd90', label: '61–90 days', count: buckets.d90 },
        ];

        // --- Leave volume by type (this year) ---
        const LEAVE_LABELS: Record<string, string> = {
            PAID_HOLIDAY: 'Paid Leave',
            UNPAID_LEAVE: 'Unpaid Leave',
            EMERGENCY_LEAVE: 'Emergency',
            LATE_COMING: 'Late Coming',
            EARLY_LEAVING: 'Early Leaving',
            HOURS_LEAVE: 'Hourly Permission',
        };
        const leaveByType = leaveByTypeRaw
            .map(row => ({ type: row.type, label: LEAVE_LABELS[row.type] ?? row.type, count: row._count._all }))
            .sort((a, b) => b.count - a.count);

        return res.json({
            workforce: { active: activeCount, pendingEnrollment, transferred, newHiresThisYear },
            recruitmentFunnel,
            recruitment,
            headcountByDepartment,
            contractExpiry,
            leaveByType,
        });
    } catch (error) {
        console.error('Error building dashboard analytics:', error);
        return res.status(500).json({ error: 'Failed to build dashboard analytics' });
    }
};
