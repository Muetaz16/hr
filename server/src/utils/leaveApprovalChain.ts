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
//   HEAD_DIVISION          <-> User.divisionId === the employee's division (dept -> division)
//   HEAD_DIRECTOR          <-> the employee's directorate (dept -> division -> directorate), matched
//                             against the director's own Employee.directorateId, OR (legacy) the
//                             employee's department listed in User.departmentIds  (the "Directorate" stage)
// The Head-of-Attendance stage is granted by the "approve_attendance" permission (a function, not a
// role); HR_MANAGER and GENERAL_MANAGER are global, unscoped roles. Every stage must have at least
// one holder or the request is blocked — but ANY ONE person resolved for a given stage signing is
// enough to complete it (staffHubController.ts's decideApprovalStep skips the other pending steps
// in that same stage once one signs). This matters whenever a stage resolves to more than one
// person — e.g. a department with two co-heads both holding HEAD_DEPARTMENT — confirmed intentional
// or otherwise; either co-head's approval alone now suffices, not both.

export type ApprovalStage = 'HEAD_ATTENDANCE' | 'UNIT_HEAD' | 'DEPT_HEAD' | 'DIVISION_HEAD' | 'HR_MANAGER' | 'DIRECTORATE' | 'GENERAL_MANAGER' | 'DIRECT_SUPERVISOR' | 'HEAD_DEPT_DIVISION';

// The short 3-stage chain for attendance permissions (Late Coming / Early Leaving / Few Hours),
// matching the "Late Arrival - Early Departure Request Form":
//   Direct Supervisor -> Head of Department -> Head of Attendance & Payroll.
export const PERMISSION_STAGE_SEQUENCE: Record<string, number> = {
    DIRECT_SUPERVISOR: 0,
    DEPT_HEAD: 1,
    HEAD_ATTENDANCE: 2,
    // Only appended for Work Authorization (out-work), which ends with the General Manager's
    // signed-document authentication — the other permission types stop at HEAD_ATTENDANCE.
    GENERAL_MANAGER: 3,
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

// The requester's own seniority in the org. A head's leave must never route through their own
// subordinates — approvers sit STRICTLY above the requester — so a Division Head's direct head is
// the Director, not the Department Head beneath them. HEAD_ATTENDANCE and HR_MANAGER are cross-
// cutting functions (not levels) and always sign regardless of rank.
const ORG_RANK: Record<string, number> = {
    EMPLOYEE: 0,
    HEAD_UNIT: 1,
    HEAD_DEPARTMENT: 2,
    HEAD_OFFICE: 2,
    HEAD_DIVISION: 3,
    HEAD_DIRECTOR: 4,
    GENERAL_MANAGER: 5,
    CHAIRMAN: 6,
};
const orgRank = (role?: string | null): number => (role && ORG_RANK[role] != null ? ORG_RANK[role] : 0);

// Resolves every user who EFFECTIVELY holds `permission` — a raw individual grant
// (User.permissions), a FunctionalHat that bundles it (User.functionalHatIds), or SUPER_ADMIN (who
// can always stand in for any function-based approver, e.g. Head of Attendance or GM, so a missing
// assignment never hard-blocks an approval chain). Assigning a hat in the admin UI only ever writes
// to User.functionalHatIds, never to User.permissions (see functionalHatController.ts/
// userController.ts) — querying `permissions: { has: permission }` alone, as this file used to,
// misses every hat-granted holder entirely. Mirrors the per-user resolution in
// server/src/utils/effectivePermissions.ts (used by auth.ts for route authorization), reshaped
// into one targeted query instead of loading every user's hats individually.
export async function resolveUsersWithPermission(prisma: PrismaClient, permission: string): Promise<string[]> {
    const hats = await prisma.functionalHat.findMany({ where: { permissions: { has: permission } }, select: { id: true } });
    const hatIds = hats.map(h => h.id);
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { role: 'SUPER_ADMIN' },
                { permissions: { has: permission } },
                ...(hatIds.length > 0 ? [{ functionalHatIds: { hasSome: hatIds } }] : []),
            ],
        },
        select: { id: true },
    });
    return users.map(u => u.id);
}

export async function resolveApprovalChain(
    prisma: PrismaClient,
    employee: Employee
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage }> {
    const idsOf = (rows: { id: string }[]) => rows.map(r => r.id);

    // The requester's own seniority — a head's leave must be approved from the level ABOVE them, so
    // we never route it through their own subordinates. Take the higher of their Employee role and
    // their linked User account role (a head is usually a HEAD_* User but may sit as an EMPLOYEE row).
    let requesterRole: string | null = employee.role ?? null;
    if (employee.userId) {
        const requesterUser = await prisma.user.findUnique({ where: { id: employee.userId }, select: { role: true } });
        if (requesterUser && orgRank(requesterUser.role) > orgRank(requesterRole)) requesterRole = requesterUser.role;
    }
    const requesterRank = orgRank(requesterRole);

    // --- Resolve every org role-holder group up-front, so we can both build the signing chain and
    // work out the "smart signature" coverage (which printed row each person's lone signature fills).

    // Head of Attendance & Payroll — a *function*, not a role. Granted via the "Head of Attendance
    // Approval" permission (approve_attendance) — directly, via a Functional Hat, or by SUPER_ADMIN.
    const attendanceHeads = await resolveUsersWithPermission(prisma, 'approve_attendance');

    let unitHeads: string[] = [];
    if (employee.unitId) {
        unitHeads = idsOf(await prisma.user.findMany({
            where: { role: 'HEAD_UNIT', unitId: employee.unitId },
            select: { id: true },
        }));
    }

    let deptHeads: string[] = [];
    let divisionHeads: string[] = [];
    // The division & directorate this employee ultimately rolls up to — resolved smartly through the
    // org structure (department -> division -> directorate) even when they aren't stamped directly
    // on the employee record.
    let resolvedDivisionId: string | null = employee.divisionId ?? null;
    let directorateId: string | null = employee.directorateId ?? null;
    if (employee.departmentId) {
        deptHeads = idsOf(await prisma.user.findMany({
            where: { role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: employee.departmentId },
            select: { id: true },
        }));
        const dept = await prisma.department.findUnique({
            where: { id: employee.departmentId },
            select: { divisionId: true, division: { select: { directorateId: true } } },
        });
        if (!resolvedDivisionId) resolvedDivisionId = dept?.divisionId ?? null;
        if (!directorateId) directorateId = dept?.division?.directorateId ?? null;
    }
    // Division head: whoever owns the DIVISION this employee rolls up to. A HEAD_DIVISION is assigned
    // a division (User.divisionId) once, and automatically covers every department under it.
    if (resolvedDivisionId) {
        divisionHeads = idsOf(await prisma.user.findMany({
            where: { role: 'HEAD_DIVISION', divisionId: resolvedDivisionId },
            select: { id: true },
        }));
    }

    // Role ∪ approve_hr_manager permission/hat ∪ SUPER_ADMIN — mirrors the GENERAL_MANAGER union
    // just below (and resolveExceptionalPerformanceApprovalChain's) exactly, so a person whose real
    // Position is a Head role (e.g. HEAD_DEPARTMENT) but who holds the HR Manager Functional Hat is
    // recognized here too, not just a literal role==='HR_MANAGER' account.
    const hrManagerRoleHolders = idsOf(await prisma.user.findMany({ where: { role: 'HR_MANAGER' }, select: { id: true } }));
    const hrManagers = Array.from(new Set([...hrManagerRoleHolders, ...(await resolveUsersWithPermission(prisma, 'approve_hr_manager'))]));

    // Directorate head — the "Administrative Director" endorsement. Resolve two ways and union them so
    // the director always lands in the flow when the org structure says they head this branch:
    //   (a) a HEAD_DIRECTOR user explicitly scoped to this department (legacy User.departmentIds), and
    //   (b) whoever heads the DIRECTORATE this employee rolls up to — their linked Employee carries
    //       role HEAD_DIRECTOR + directorateId — the same smart org relation used across the app.
    const directorIds = new Set<string>();
    if (employee.departmentId) {
        const byDept = await prisma.user.findMany({
            where: { role: 'HEAD_DIRECTOR', departmentIds: { has: employee.departmentId } },
            select: { id: true },
        });
        byDept.forEach(u => directorIds.add(u.id));
    }
    if (directorateId) {
        const byDirectorate = await prisma.employee.findMany({
            where: { role: 'HEAD_DIRECTOR', directorateId, userId: { not: null } },
            select: { userId: true },
        });
        byDirectorate.forEach(e => { if (e.userId) directorIds.add(e.userId); });
    }
    const directors = Array.from(directorIds);

    // General Manager stage — whoever holds the GENERAL_MANAGER position, OR anyone designated a GM
    // approver via the `approve_gm` permission (directly, via a hat, or SUPER_ADMIN — see
    // resolveUsersWithPermission), mirroring how HEAD_ATTENDANCE is granted by `approve_attendance`.
    // The stage is satisfied by ANY ONE of them signing — see the sibling-skip in decideApprovalStep.
    const generalManagerRoleHolders = idsOf(await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } }));
    const generalManagers = Array.from(new Set([...generalManagerRoleHolders, ...(await resolveUsersWithPermission(prisma, 'approve_gm'))]));

    // Keep only the org-head levels STRICTLY ABOVE the requester — so a Division Head's request never
    // routes through the Department Head beneath them. HEAD_ATTENDANCE / HR_MANAGER / GENERAL_MANAGER
    // are always kept (functions / top of this form); the requester is also removed by self-exclusion.
    const above = (levelRank: number, ids: string[]) => (levelRank > requesterRank ? ids : []);
    const unitHeadsA = above(ORG_RANK.HEAD_UNIT, unitHeads);
    const deptHeadsA = above(ORG_RANK.HEAD_DEPARTMENT, deptHeads);
    const divisionHeadsA = above(ORG_RANK.HEAD_DIVISION, divisionHeads);
    const directorsA = above(ORG_RANK.HEAD_DIRECTOR, directors);

    // --- Signing chain, in order. Only heads above the requester sign; UNIT/DEPT/DIVISION are
    // separate signing stages, and the *form* collapses them onto two printed rows below.
    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];
    rawStages.push({ stage: 'HEAD_ATTENDANCE', userIds: attendanceHeads });
    if (employee.unitId) rawStages.push({ stage: 'UNIT_HEAD', userIds: unitHeadsA });
    if (employee.departmentId) {
        rawStages.push({ stage: 'DEPT_HEAD', userIds: deptHeadsA });
        rawStages.push({ stage: 'DIVISION_HEAD', userIds: divisionHeadsA });
    }
    rawStages.push({ stage: 'HR_MANAGER', userIds: hrManagers });
    rawStages.push({ stage: 'DIRECTORATE', userIds: directorsA });
    rawStages.push({ stage: 'GENERAL_MANAGER', userIds: generalManagers });

    // --- Smart-signature coverage: which single person fills each printed row on the form.
    // "Always look for the direct head" — the nearest real head STRICTLY ABOVE the requester — and let
    // one signature stand in for every post that person actually holds:
    //   • Direct supervisor          = nearest head above the requester (unit → dept → division →
    //                                   director → GM). For a Division Head requester this is the Director.
    //   • Head of Department/Division = the post directly above 'direct'; if there's only one head above
    //                                   the requester it equals 'direct' (one signature shown in both rows).
    //   • Administrative Director     = the director. If the director IS the direct head (e.g. a Division
    //                                   Head's request), their single signature covers all of the above.
    const aboveLadder = [unitHeadsA, deptHeadsA, divisionHeadsA, directorsA].filter(g => g.length > 0);
    const directGroup = aboveLadder[0] ?? generalManagers;
    const deptDivGroup = aboveLadder[1] ?? aboveLadder[0] ?? generalManagers;
    const rowHolders: { row: ApprovalStage; userIds: string[] }[] = [
        { row: 'HEAD_ATTENDANCE', userIds: attendanceHeads },
        { row: 'DIRECT_SUPERVISOR', userIds: directGroup },
        { row: 'HEAD_DEPT_DIVISION', userIds: deptDivGroup },
        { row: 'HR_MANAGER', userIds: hrManagers },
        { row: 'DIRECTORATE', userIds: directorsA },
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
    employee: Employee,
    opts?: { includeGeneralManager?: boolean }
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

    // Head of Attendance & Payroll — granted by the approve_attendance permission, directly, via a
    // Functional Hat, or by SUPER_ADMIN (mandatory stage).
    const attendanceHeads = await resolveUsersWithPermission(prisma, 'approve_attendance');
    rawStages.push({ stage: 'HEAD_ATTENDANCE', userIds: attendanceHeads });

    // General Manager — the final signed-document authentication. Only appended when requested
    // (Work Authorization / out-work); mandatory when present, same as the full leave chain.
    if (opts?.includeGeneralManager) {
        // GENERAL_MANAGER position, OR anyone designated a GM approver via `approve_gm` (directly,
        // via a hat, or SUPER_ADMIN). Satisfied by ANY ONE signing (sibling-skip in decideApprovalStep).
        const generalManagerRoleHolders = await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } });
        const generalManagers = Array.from(new Set([...generalManagerRoleHolders.map(u => u.id), ...(await resolveUsersWithPermission(prisma, 'approve_gm'))]));
        rawStages.push({ stage: 'GENERAL_MANAGER', userIds: generalManagers });
    }

    const requiredNonEmpty: ApprovalStage[] = opts?.includeGeneralManager
        ? ['HEAD_ATTENDANCE', 'GENERAL_MANAGER']
        : ['HEAD_ATTENDANCE'];
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

// Exceptional Performance / Exceptional Contribution Award — HR Manager -> General Manager. Both
// are global, non-org-scoped roles, so (unlike every other chain builder above) this needs no
// employee-position walk at all. Reuses HR_MANAGER/GENERAL_MANAGER, both already valid
// ApprovalStage values, and the existing approve_hr_manager/approve_gm permissions (role ∪
// permission/hat ∪ SUPER_ADMIN, via resolveUsersWithPermission) — no new permissions needed.
export const EXCEPTIONAL_PERFORMANCE_STAGE_SEQUENCE: Record<string, number> = {
    HR_MANAGER: 0,
    GENERAL_MANAGER: 1,
};

export async function resolveExceptionalPerformanceApprovalChain(
    prisma: PrismaClient
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage }> {
    const hrRoleHolders = await prisma.user.findMany({ where: { role: 'HR_MANAGER' }, select: { id: true } });
    const hrManagers = Array.from(new Set([...hrRoleHolders.map(u => u.id), ...(await resolveUsersWithPermission(prisma, 'approve_hr_manager'))]));
    const generalManagerRoleHolders = await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } });
    const generalManagers = Array.from(new Set([...generalManagerRoleHolders.map(u => u.id), ...(await resolveUsersWithPermission(prisma, 'approve_gm'))]));

    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [
        { stage: 'HR_MANAGER', userIds: hrManagers },
        { stage: 'GENERAL_MANAGER', userIds: generalManagers },
    ];

    const seen = new Set<string>();
    const steps: ResolvedApprovalStep[] = [];
    for (const raw of rawStages) {
        const distinctIds = Array.from(new Set(raw.userIds));
        // Both stages are mandatory — a nomination with no resolvable HR Manager or General
        // Manager is a real misconfiguration, not a tolerable gap (same REQUIRED_NONEMPTY_STAGES
        // treatment as the other chains).
        if (distinctIds.length === 0) return { steps: [], blockedStage: raw.stage };
        const eligible = distinctIds.filter(id => !seen.has(id));
        for (const userId of eligible) {
            seen.add(userId);
            steps.push({ stage: raw.stage, approverUserId: userId, coversStages: [raw.stage] });
        }
    }

    return { steps };
}

interface HeadTeamUser {
    id: string;
    role?: string | null;
    unitId?: string | null;
    departmentId?: string | null;
    divisionId?: string | null;
    departmentIds?: string[];
}

const HEAD_TEAM_EMPLOYEE_SELECT = {
    id: true, fullName: true, staffId: true, position: true, jobCategory: true, jobGrade: true, joinDate: true,
    department: { select: { name: true, isOffice: true } },
    division: { select: { name: true } },
    unit: { select: { name: true } },
} as const;

// Given a Head-role user, resolves the employees they may nominate for Exceptional Performance —
// the reverse direction of this file's employee -> head resolution above, reusing the exact same
// org columns and department -> division -> directorate walk already proven correct there.
// Division/Directorate heads cover their whole subtree (every department under their division /
// every division under their directorate), not just employees stamped directly with that id.
// HEAD_DIRECTOR's own directorateId isn't a User column (only Employee.directorateId is) —
// resolved here via the caller's own linked Employee record, same as the directorate lookups above.
export async function resolveHeadTeamEmployees(prisma: PrismaClient, user: HeadTeamUser) {
    const baseWhere = { enrollmentStatus: 'ACTIVE' as const };
    switch (user.role) {
        case 'HEAD_UNIT':
            if (!user.unitId) return [];
            return prisma.employee.findMany({ where: { ...baseWhere, unitId: user.unitId }, select: HEAD_TEAM_EMPLOYEE_SELECT });
        case 'HEAD_DEPARTMENT':
        case 'HEAD_OFFICE':
            if (!user.departmentId) return [];
            return prisma.employee.findMany({ where: { ...baseWhere, departmentId: user.departmentId }, select: HEAD_TEAM_EMPLOYEE_SELECT });
        case 'HEAD_DIVISION': {
            if (!user.divisionId) return [];
            const depts = await prisma.department.findMany({ where: { divisionId: user.divisionId }, select: { id: true } });
            return prisma.employee.findMany({
                where: { ...baseWhere, OR: [{ divisionId: user.divisionId }, { departmentId: { in: depts.map(d => d.id) } }] },
                select: HEAD_TEAM_EMPLOYEE_SELECT,
            });
        }
        case 'HEAD_DIRECTOR': {
            const ownEmployee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { directorateId: true } });
            const directorateId = ownEmployee?.directorateId ?? null;
            const divisions = directorateId
                ? await prisma.division.findMany({ where: { directorateId }, select: { id: true } })
                : [];
            const deptWhere: any[] = [];
            if (divisions.length > 0) deptWhere.push({ divisionId: { in: divisions.map(d => d.id) } });
            if (user.departmentIds && user.departmentIds.length > 0) deptWhere.push({ id: { in: user.departmentIds } });
            if (deptWhere.length === 0) return [];
            const depts = await prisma.department.findMany({ where: { OR: deptWhere }, select: { id: true } });
            return prisma.employee.findMany({
                where: {
                    ...baseWhere,
                    OR: [
                        ...(directorateId ? [{ directorateId }] : []),
                        { departmentId: { in: depts.map(d => d.id) } },
                    ],
                },
                select: HEAD_TEAM_EMPLOYEE_SELECT,
            });
        }
        default:
            return [];
    }
}
