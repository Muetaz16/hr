import { PrismaClient, Employee } from '@prisma/client';

// Walks the real org structure (GM <- Directorate <- Division <- Department/Office <- Unit) from
// wherever the employee sits, to build the leave-request approval chain. There is no explicit
// "direct manager" field anywhere in the schema — headship is a role+scope match:
//   HEAD_UNIT            <-> User.unitId === Employee.unitId
//   HEAD_DEPARTMENT/OFFICE <-> User.departmentId === Employee.departmentId
//   HEAD_DIVISION        <-> Employee.departmentId is in User.departmentIds (mirrors HEAD_DIRECTOR
//                             below — a division head's departmentIds must be populated the same
//                             way a director's already are, via Access Management)
//   HEAD_DIRECTOR        <-> Employee.departmentId is in User.departmentIds
// HR_MANAGER and GENERAL_MANAGER are global, unscoped roles — every person holding either must
// approve individually.

export type ApprovalStage = 'UNIT_HEAD' | 'DEPT_HEAD' | 'DIVISION_HEAD' | 'HR_MANAGER' | 'ADMIN_DIRECTOR' | 'GENERAL_MANAGER';

export interface ResolvedApprovalStep {
    stage: ApprovalStage;
    approverUserId: string;
}

export const STAGE_SEQUENCE: Record<ApprovalStage, number> = {
    UNIT_HEAD: 0,
    DEPT_HEAD: 1,
    DIVISION_HEAD: 2,
    HR_MANAGER: 3,
    ADMIN_DIRECTOR: 4,
    GENERAL_MANAGER: 5,
};

// Global roles that must always resolve to at least one person in a healthy system — zero
// approvers here means a real misconfiguration, not a tolerable org-coverage gap.
const REQUIRED_NONEMPTY_STAGES: ApprovalStage[] = ['HR_MANAGER', 'GENERAL_MANAGER'];

export async function resolveApprovalChain(
    prisma: PrismaClient,
    employee: Employee
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage }> {
    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];

    if (employee.unitId) {
        const unitHeads = await prisma.user.findMany({
            where: { role: 'HEAD_UNIT', unitId: employee.unitId },
            select: { id: true },
        });
        rawStages.push({ stage: 'UNIT_HEAD', userIds: unitHeads.map(u => u.id) });
    }

    if (employee.departmentId) {
        const deptHeads = await prisma.user.findMany({
            where: { role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: employee.departmentId },
            select: { id: true },
        });
        rawStages.push({ stage: 'DEPT_HEAD', userIds: deptHeads.map(u => u.id) });

        const divisionHeads = await prisma.user.findMany({
            where: { role: 'HEAD_DIVISION', departmentIds: { has: employee.departmentId } },
            select: { id: true },
        });
        rawStages.push({ stage: 'DIVISION_HEAD', userIds: divisionHeads.map(u => u.id) });
    }

    const hrManagers = await prisma.user.findMany({ where: { role: 'HR_MANAGER' }, select: { id: true } });
    rawStages.push({ stage: 'HR_MANAGER', userIds: hrManagers.map(u => u.id) });

    if (employee.departmentId) {
        const directors = await prisma.user.findMany({
            where: { role: 'HEAD_DIRECTOR', departmentIds: { has: employee.departmentId } },
            select: { id: true },
        });
        rawStages.push({ stage: 'ADMIN_DIRECTOR', userIds: directors.map(u => u.id) });
    } else {
        rawStages.push({ stage: 'ADMIN_DIRECTOR', userIds: [] });
    }

    const generalManagers = await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } });
    rawStages.push({ stage: 'GENERAL_MANAGER', userIds: generalManagers.map(u => u.id) });

    // Flatten in stage order, self-excluding and deduping by person (an earlier stage's approval
    // already covers any later stage that resolves to the same person). A stage is only
    // "blocked" if literally nobody holds that role at all — self-exclusion or dedup-collapse
    // shrinking it to zero afterward is a legitimate skip, not a misconfiguration.
    const seen = new Set<string>();
    const steps: ResolvedApprovalStep[] = [];
    for (const raw of rawStages) {
        const distinctIds = Array.from(new Set(raw.userIds));
        if (distinctIds.length === 0 && REQUIRED_NONEMPTY_STAGES.includes(raw.stage)) {
            return { steps: [], blockedStage: raw.stage };
        }
        const eligible = distinctIds.filter(id => id !== employee.userId && !seen.has(id));
        for (const userId of eligible) {
            seen.add(userId);
            steps.push({ stage: raw.stage, approverUserId: userId });
        }
    }

    return { steps };
}
