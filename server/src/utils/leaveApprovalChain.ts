import { PrismaClient, Employee } from '@prisma/client';

// Builds the leave-request approval chain, in signing order:
//   Head of Attendance -> [direct-manager ladder] -> HR -> Directorate -> General Manager
//
// The "direct manager" is not an explicit field — it's simply the next existing head up the org
// ladder from wherever the employee sits, resolved by role + scope. Missing levels are skipped, so
// the chain always falls through to the next real authority (e.g. an employee with no unit head and
// no department head is covered by the division head, then the directorate):
//   HEAD_UNIT              <-> User.unitId === Employee.unitId
//   HEAD_DEPARTMENT/OFFICE <-> User.departmentId === Employee.departmentId
//   HEAD_DIVISION          <-> Employee.departmentId is in User.departmentIds
//   HEAD_DIRECTOR          <-> Employee.departmentId is in User.departmentIds  (the "Directorate" stage)
// The Head-of-Attendance stage is granted by the "approve_attendance" permission (a function, not a
// role); HR_MANAGER and GENERAL_MANAGER are global, unscoped roles. Every person matching one of
// these three stages must sign, and each stage must have at least one holder or the request is blocked.

export type ApprovalStage = 'HEAD_ATTENDANCE' | 'UNIT_HEAD' | 'DEPT_HEAD' | 'DIVISION_HEAD' | 'HR_MANAGER' | 'DIRECTORATE' | 'GENERAL_MANAGER' | 'DIRECT_SUPERVISOR' | 'HEAD_DEPT_DIVISION';

// The short 3-stage chain for attendance permissions (Late Coming / Early Leaving / Few Hours),
// matching the "Late Arrival - Early Departure Request Form":
//   Direct Supervisor -> Head of Department -> Head of Attendance & Payroll.
export const PERMISSION_STAGE_SEQUENCE: Record<string, number> = {
    DIRECT_SUPERVISOR: 0,
    DEPT_HEAD: 1,
    HEAD_ATTENDANCE: 2,
};

export interface ResolvedApprovalStep {
    stage: ApprovalStage;
    approverUserId: string;
    // The printed form rows this one signature fills. Usually just the step's own row, but a person
    // who holds several posts (division head who is also the direct manager, director who is also the
    // direct manager, …) signs once and covers every row they own. See resolveApprovalChain.
    coversStages: ApprovalStage[];
}

// The six signature/endorsement rows printed on the official Leave Request Form, in order. These are
// what `coversStages` is drawn from — distinct from the internal signing stages (UNIT/DEPT/DIVISION
// collapse onto the two middle rows "Direct supervisor" and "Head of Department / Division").
export const FORM_ROW_STAGES: ApprovalStage[] = [
    'HEAD_ATTENDANCE', 'DIRECT_SUPERVISOR', 'HEAD_DEPT_DIVISION', 'HR_MANAGER', 'DIRECTORATE', 'GENERAL_MANAGER',
];

export const STAGE_SEQUENCE: Record<string, number> = {
    HEAD_ATTENDANCE: 0,
    UNIT_HEAD: 1,
    DEPT_HEAD: 2,
    DIVISION_HEAD: 3,
    HR_MANAGER: 4,
    DIRECTORATE: 5,
    GENERAL_MANAGER: 6,
};

// Global roles that must always resolve to at least one person in a healthy system — zero
// approvers here means a real misconfiguration, not a tolerable org-coverage gap.
const REQUIRED_NONEMPTY_STAGES: ApprovalStage[] = ['HEAD_ATTENDANCE', 'HR_MANAGER', 'GENERAL_MANAGER'];

export async function resolveApprovalChain(
    prisma: PrismaClient,
    employee: Employee
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage }> {
    const idsOf = (rows: { id: string }[]) => rows.map(r => r.id);

    // --- Resolve every org role-holder group up-front, so we can both build the signing chain and
    // work out the "smart signature" coverage (which printed row each person's lone signature fills).

    // Head of Attendance & Payroll — a *function*, not a role. Granted via the "Head of Attendance
    // Approval" permission (approve_attendance) in Access Management, so anyone can be designated.
    const attendanceHeads = idsOf(await prisma.user.findMany({
        where: { permissions: { has: 'approve_attendance' } },
        select: { id: true },
    }));

    let unitHeads: string[] = [];
    if (employee.unitId) {
        unitHeads = idsOf(await prisma.user.findMany({
            where: { role: 'HEAD_UNIT', unitId: employee.unitId },
            select: { id: true },
        }));
    }

    let deptHeads: string[] = [];
    let divisionHeads: string[] = [];
    if (employee.departmentId) {
        deptHeads = idsOf(await prisma.user.findMany({
            where: { role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: employee.departmentId },
            select: { id: true },
        }));
        // Division head: whoever owns the DIVISION this department belongs to. A HEAD_DIVISION is
        // assigned a division (User.divisionId) once, and automatically covers every department under it.
        const dept = await prisma.department.findUnique({
            where: { id: employee.departmentId },
            select: { divisionId: true },
        });
        if (dept?.divisionId) {
            divisionHeads = idsOf(await prisma.user.findMany({
                where: { role: 'HEAD_DIVISION', divisionId: dept.divisionId },
                select: { id: true },
            }));
        }
    }

    const hrManagers = idsOf(await prisma.user.findMany({ where: { role: 'HR_MANAGER' }, select: { id: true } }));

    let directors: string[] = [];
    if (employee.departmentId) {
        directors = idsOf(await prisma.user.findMany({
            where: { role: 'HEAD_DIRECTOR', departmentIds: { has: employee.departmentId } },
            select: { id: true },
        }));
    }

    const generalManagers = idsOf(await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } }));

    // --- Signing chain, in order. Unchanged: everyone who signs today still signs. UNIT/DEPT/
    // DIVISION are separate signing stages; the *form* collapses them onto two printed rows below.
    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];
    rawStages.push({ stage: 'HEAD_ATTENDANCE', userIds: attendanceHeads });
    if (employee.unitId) rawStages.push({ stage: 'UNIT_HEAD', userIds: unitHeads });
    if (employee.departmentId) {
        rawStages.push({ stage: 'DEPT_HEAD', userIds: deptHeads });
        rawStages.push({ stage: 'DIVISION_HEAD', userIds: divisionHeads });
    }
    rawStages.push({ stage: 'HR_MANAGER', userIds: hrManagers });
    rawStages.push({ stage: 'DIRECTORATE', userIds: directors });
    rawStages.push({ stage: 'GENERAL_MANAGER', userIds: generalManagers });

    // --- Smart-signature coverage: which single person fills each printed row on the form.
    // "Always look for the direct head" — the nearest real head up the org ladder — and let one
    // signature stand in for every post that person actually holds:
    //   • Direct supervisor          = nearest real local head (unit → dept → division), else the director.
    //   • Head of Department/Division = the post directly above 'direct'; if there's only one real
    //                                   local head it equals 'direct' (one signature shown in both rows);
    //                                   if there are none, it falls through to the director too.
    //   • Administrative Director     = the director (always in the flow when one exists). If the
    //                                   director IS the direct head, their signature covers all of the above.
    const localLadder = [unitHeads, deptHeads, divisionHeads].filter(g => g.length > 0);
    const directGroup = localLadder[0] ?? directors;
    const deptDivGroup = localLadder[1] ?? localLadder[0] ?? directors;
    const rowHolders: { row: ApprovalStage; userIds: string[] }[] = [
        { row: 'HEAD_ATTENDANCE', userIds: attendanceHeads },
        { row: 'DIRECT_SUPERVISOR', userIds: directGroup },
        { row: 'HEAD_DEPT_DIVISION', userIds: deptDivGroup },
        { row: 'HR_MANAGER', userIds: hrManagers },
        { row: 'DIRECTORATE', userIds: directors },
        { row: 'GENERAL_MANAGER', userIds: generalManagers },
    ];

    // Flatten in stage order, self-excluding and deduping by person (an earlier stage's approval
    // already covers any later stage that resolves to the same person). A stage is only "blocked" if
    // literally nobody holds that role at all — self-exclusion or dedup-collapse shrinking it to zero
    // afterward is a legitimate skip, not a misconfiguration.
    const seen = new Set<string>();
    const steps: ResolvedApprovalStep[] = [];
    const stepByUser = new Map<string, ResolvedApprovalStep>();
    for (const raw of rawStages) {
        const distinctIds = Array.from(new Set(raw.userIds));
        if (distinctIds.length === 0 && REQUIRED_NONEMPTY_STAGES.includes(raw.stage)) {
            return { steps: [], blockedStage: raw.stage };
        }
        const eligible = distinctIds.filter(id => id !== employee.userId && !seen.has(id));
        for (const userId of eligible) {
            seen.add(userId);
            const step: ResolvedApprovalStep = { stage: raw.stage, approverUserId: userId, coversStages: [] };
            steps.push(step);
            stepByUser.set(userId, step);
        }
    }

    // Attach each printed row to the single step of whoever fills it. A row whose holder is the
    // requester themselves — or who otherwise has no signing step — is left uncovered (printed blank).
    for (const holder of rowHolders) {
        for (const userId of Array.from(new Set(holder.userIds))) {
            const step = stepByUser.get(userId);
            if (step && !step.coversStages.includes(holder.row)) step.coversStages.push(holder.row);
        }
    }

    return { steps };
}

// Builds the short attendance-permission chain: Direct Supervisor -> Head of Department ->
// Head of Attendance & Payroll. Direct Supervisor is the employee's most-immediate head (unit
// head if in a unit, else department head); it self-excludes/dedups against the department head
// so a person never signs twice. Only the Head of Attendance stage is mandatory.
export async function resolvePermissionApprovalChain(
    prisma: PrismaClient,
    employee: Employee
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage }> {
    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];

    // Direct Supervisor — unit head if the employee sits in a unit, otherwise department, division, or directorate head.
    let directIds: string[] = [];
    if (employee.unitId) {
        const unitHeads = await prisma.user.findMany({ where: { role: 'HEAD_UNIT', unitId: employee.unitId }, select: { id: true } });
        directIds = unitHeads.map(u => u.id);
    }
    
    if (directIds.length === 0 && employee.departmentId) {
        const deptHeads = await prisma.user.findMany({
            where: { role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: employee.departmentId },
            select: { id: true },
        });
        directIds = deptHeads.map(u => u.id);
    }

    if (directIds.length === 0 && employee.divisionId) {
        const divHeads = await prisma.user.findMany({
            where: { role: 'HEAD_DIVISION', divisionId: employee.divisionId },
            select: { id: true },
        });
        directIds = divHeads.map(u => u.id);
    }

    if (directIds.length === 0 && employee.departmentId) {
        const dirHeads = await prisma.user.findMany({
            where: { role: 'HEAD_DIRECTOR', departmentIds: { has: employee.departmentId } },
            select: { id: true },
        });
        directIds = dirHeads.map(u => u.id);
    }
    
    rawStages.push({ stage: 'DIRECT_SUPERVISOR', userIds: directIds });

    // Head of Department.
    let deptHeadIds: string[] = [];
    if (employee.departmentId) {
        const deptHeads = await prisma.user.findMany({
            where: { role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: employee.departmentId },
            select: { id: true },
        });
        deptHeadIds = deptHeads.map(u => u.id);
    }
    rawStages.push({ stage: 'DEPT_HEAD', userIds: deptHeadIds });

    // Head of Attendance & Payroll — granted by the approve_attendance permission (mandatory).
    const attendanceHeads = await prisma.user.findMany({
        where: { permissions: { has: 'approve_attendance' } },
        select: { id: true },
    });
    rawStages.push({ stage: 'HEAD_ATTENDANCE', userIds: attendanceHeads.map(u => u.id) });

    const requiredNonEmpty: ApprovalStage[] = ['HEAD_ATTENDANCE'];
    const seen = new Set<string>();
    const steps: ResolvedApprovalStep[] = [];
    for (const raw of rawStages) {
        const distinctIds = Array.from(new Set(raw.userIds));
        if (distinctIds.length === 0 && requiredNonEmpty.includes(raw.stage)) {
            return { steps: [], blockedStage: raw.stage };
        }
        const eligible = distinctIds.filter(id => id !== employee.userId && !seen.has(id));
        for (const userId of eligible) {
            seen.add(userId);
            steps.push({ stage: raw.stage, approverUserId: userId, coversStages: [raw.stage] });
        }
    }

    return { steps };
}
