import { PrismaClient, Employee } from '@prisma/client';
import { ACTIVE_ENROLLMENT_FILTER } from './employeeStatus';

// Builds the leave-request approval chain, in signing order:
//   Head of Attendance -> [org ladder, at most two levels] -> HR -> Directorate -> General Manager
//
// The "direct manager" is not an explicit field — it's simply the next existing head up the org
// ladder from wherever the employee sits, resolved by role + scope. Missing levels are skipped, so
// the chain falls through to the next real LADDER level (an employee with no unit head is covered
// by their department head, then their division head):
//   HEAD_UNIT              <-> User.unitId === Employee.unitId
//   HEAD_DEPARTMENT/OFFICE <-> User.departmentId === Employee.departmentId
//   HEAD_DIVISION          <-> User.divisionId === the employee's division (dept -> division)
//   HEAD_DIRECTOR          <-> the employee's directorate (dept -> division -> directorate), matched
//                             against the director's own Employee.directorateId, OR (legacy) the
//                             employee's department listed in User.departmentIds  (the "Directorate" stage)
// Only the first THREE are the ladder, and only the nearest two of them ever sign — the form gives
// line management exactly two signature boxes. HEAD_DIRECTOR is not a ladder level; it is the
// separate "Administrative Director" endorsement with its own printed row.
// The Head-of-Attendance stage is granted by the "approve_attendance" permission (a function, not a
// role); the HR_MANAGER and GENERAL_MANAGER STAGES are global and unscoped. Every stage must have at least
// one holder or the request is blocked — but ANY ONE person resolved for a given stage signing is
// enough to complete it (staffHubController.ts's decideApprovalStep skips the other pending steps
// in that same stage once one signs). This matters whenever a stage resolves to more than one
// person — e.g. a department with two co-heads both holding HEAD_DEPARTMENT — confirmed intentional
// or otherwise; either co-head's approval alone now suffices, not both.

export type ApprovalStage = 'HEAD_ATTENDANCE' | 'UNIT_HEAD' | 'DEPT_HEAD' | 'DIVISION_HEAD' | 'HR_MANAGER' | 'DIRECTORATE' | 'GENERAL_MANAGER' | 'DIRECT_SUPERVISOR' | 'HEAD_DEPT_DIVISION';

// The short chain shared by attendance permissions and Work Authorization. The two take DIFFERENT
// middle and final stages because their printed forms do, so the map covers both and each chain
// uses its own increasing subset:
//
//   Late Arrival - Early Departure Request Form   0 -> 2 -> 3 -> 4
//   Work Authorization Form (نموذج التكليف)        0 -> 1 -> 3 -> 5
export const PERMISSION_STAGE_SEQUENCE: Record<string, number> = {
    DIRECT_SUPERVISOR: 0,
    DEPT_HEAD: 1,        // Work Authorization — its form prints "Head of Department".
    DIVISION_HEAD: 2,    // Permissions — their form prints "Head of Division / مدير الإدارة".
    HEAD_ATTENDANCE: 3,  // Head of Personnel Affairs / رئيس قسم شؤون الموظفين — on both forms.
    HR_MANAGER: 4,       // Permissions — the last signature on the reprinted permission form.
    GENERAL_MANAGER: 5,  // Work Authorization — its signed-document authentication.
};

// The short 2-stage chain for a Missing Biometric Log (missing-punch) request, matching the
// "Missing Biometric Log Form": Head of Department/Division -> Head of Attendance & Payroll.
export const MISSING_PUNCH_STAGE_SEQUENCE: Record<string, number> = {
    DEPT_HEAD: 0,
    HEAD_ATTENDANCE: 1,
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
// the Director, not the Department Head beneath them. The HEAD_ATTENDANCE and HR_MANAGER stages are cross-
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

/** The requester's own seniority — the higher of their Employee role and their linked User role. */
async function requesterRankOf(prisma: PrismaClient, employee: Employee): Promise<number> {
    let role: string | null = employee.role ?? null;
    if (employee.userId) {
        const u = await prisma.user.findUnique({ where: { id: employee.userId }, select: { role: true } });
        if (u && orgRank(u.role) > orgRank(role)) role = u.role;
    }
    return orgRank(role);
}

/**
 * The org-head tiers sitting above an employee, nearest first: unit, department, division,
 * directorate. Every tier comes back ALREADY filtered — the requester removed, and only people
 * strictly senior to them kept.
 *
 * Doing that filtering here, rather than leaving it to each caller's end-of-pipeline self-exclusion,
 * is the entire point of this helper. A cascade written as "department head, else division head,
 * else director" asks whether a tier is EMPTY; if the tier holds nobody but the requester it is not
 * empty, so the cascade stops there — and then self-exclusion quietly deletes the only person in
 * it. The request loses its whole management chain and lands on the next stage as if no manager
 * existed. That is precisely what happened to a department head who is the sole head of their own
 * department: their missing-punch and permission requests went straight to Personnel Relations,
 * skipping the division head who should have signed.
 *
 * Tiers with nobody in them are returned as empty arrays, not dropped, so a caller can tell
 * "this level does not apply to this employee" from "this level exists but is above nobody".
 */
async function headTiersAbove(
    prisma: PrismaClient,
    employee: Employee,
): Promise<{ stage: ApprovalStage; rank: number; userIds: string[]; rawUserIds: string[] }[]> {
    const rank = await requesterRankOf(prisma, employee);
    const idsOf = (rows: { id: string }[]) => rows.map(r => r.id);

    // The division & directorate this employee ultimately rolls up to — resolved through the org
    // structure (department -> division -> directorate) even when not stamped on the employee row.
    let divisionId: string | null = employee.divisionId ?? null;
    let directorateId: string | null = employee.directorateId ?? null;
    if (employee.departmentId && (!divisionId || !directorateId)) {
        const dept = await prisma.department.findUnique({
            where: { id: employee.departmentId },
            select: { divisionId: true, division: { select: { directorateId: true } } },
        });
        if (!divisionId) divisionId = dept?.divisionId ?? null;
        if (!directorateId) directorateId = dept?.division?.directorateId ?? null;
    }

    const unitHeads = employee.unitId
        ? idsOf(await prisma.user.findMany({ where: { role: 'HEAD_UNIT', unitId: employee.unitId }, select: { id: true } }))
        : [];
    const deptHeads = employee.departmentId
        ? idsOf(await prisma.user.findMany({
            where: { role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: employee.departmentId },
            select: { id: true },
        }))
        : [];
    const divisionHeads = divisionId
        ? idsOf(await prisma.user.findMany({ where: { role: 'HEAD_DIVISION', divisionId }, select: { id: true } }))
        : [];

    // Directorate head — the "Administrative Director". Two sources, unioned, so the director lands
    // in the flow whichever way the org structure records them: a legacy User.departmentIds listing,
    // and whoever's linked Employee carries HEAD_DIRECTOR for this directorate.
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

    const keep = (tierRank: number, ids: string[]) =>
        (tierRank > rank ? Array.from(new Set(ids)).filter(id => id !== employee.userId) : []);

    // `rawUserIds` is the tier BEFORE filtering — needed to tell the two reasons a tier can be
    // empty apart. "Nobody holds this post" and "the only holder is the person asking" look
    // identical in `userIds`, but only the second means the requester is the authority for that row
    // and should therefore sign it themselves.
    return [
        { stage: 'UNIT_HEAD', rank: ORG_RANK.HEAD_UNIT, userIds: keep(ORG_RANK.HEAD_UNIT, unitHeads), rawUserIds: unitHeads },
        { stage: 'DEPT_HEAD', rank: ORG_RANK.HEAD_DEPARTMENT, userIds: keep(ORG_RANK.HEAD_DEPARTMENT, deptHeads), rawUserIds: deptHeads },
        { stage: 'DIVISION_HEAD', rank: ORG_RANK.HEAD_DIVISION, userIds: keep(ORG_RANK.HEAD_DIVISION, divisionHeads), rawUserIds: divisionHeads },
        { stage: 'DIRECTORATE', rank: ORG_RANK.HEAD_DIRECTOR, userIds: keep(ORG_RANK.HEAD_DIRECTOR, Array.from(directorIds)), rawUserIds: Array.from(directorIds) },
    ];
}

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

/**
 * The people who actually SIGN for a cross-cutting function — Head of Attendance, HR Manager, GM.
 *
 * resolveUsersWithPermission answers "who is ALLOWED to act", and for that its two inclusions are
 * right: SUPER_ADMIN can stand in, and a login with no employee record can still authorise. Routing
 * a leave request is a different question — who is put on this employee's chain and waited for —
 * and there the same two inclusions send the request to people who cannot sign it:
 *
 *   · a login with no employee record, or one belonging to somebody who has left. A retired
 *     designation keeps its Functional Hat long after the person stops working here, so every
 *     request kept routing to an account nobody opens.
 *   · the system administrator, on every single request.
 *
 * So holders are narrowed to ACTIVE EMPLOYEES. This is the same narrowing the rest of the system
 * already applies — promotions and job descriptions drop SUPER_ADMIN before printing a signature,
 * and the Cash Advance form requires an active employee — leave was the one place still using the
 * raw union.
 *
 * SUPER_ADMIN is kept as a LAST RESORT, and only when nobody qualifies: a stage with no approver
 * hard-blocks the request, and an unassigned function should slow a chain down, not stop it. When
 * that happens the stage is genuinely misconfigured and REQUIRED_NONEMPTY_STAGES surfaces it.
 */
export async function resolveFunctionApprovers(
    prisma: PrismaClient,
    permission: string,
    { adminFallback = true }: { adminFallback?: boolean } = {},
): Promise<string[]> {
    const holders = await resolveUsersWithPermission(prisma, permission);
    if (holders.length === 0) return holders;

    const active = await prisma.user.findMany({
        where: {
            id: { in: holders },
            role: { not: 'SUPER_ADMIN' },
            employee: { is: { enrollmentStatus: ACTIVE_ENROLLMENT_FILTER } },
        },
        select: { id: true },
    });
    if (active.length > 0 || !adminFallback) return active.map(u => u.id);

    // Nobody real holds it. Fall back to the admin accounts inside the original union so the chain
    // still has somewhere to go, rather than dead-ending on a vacancy.
    return adminStandInsFor(prisma, permission);
}

/** The SUPER_ADMIN holders of a permission — a stage's stand-in of last resort. */
export async function adminStandInsFor(prisma: PrismaClient, permission: string): Promise<string[]> {
    const holders = await resolveUsersWithPermission(prisma, permission);
    if (holders.length === 0) return [];
    const admins = await prisma.user.findMany({
        where: { id: { in: holders }, role: 'SUPER_ADMIN' },
        select: { id: true },
    });
    return admins.map(u => u.id);
}

/**
 * The GENERAL_MANAGER stage, which has TWO sources: the real position and the approve_gm permission.
 *
 * The admin stand-in has to be decided for the STAGE, not for one source. Asking the permission
 * alone would add an admin whenever nobody holds approve_gm — even though the position is filled —
 * and the GM stage would carry a second, pointless approver on every single request.
 */
export async function resolveGeneralManagers(prisma: PrismaClient, roleHolderIds: string[]): Promise<string[]> {
    const byPermission = await resolveFunctionApprovers(prisma, 'approve_gm', { adminFallback: false });
    const union = Array.from(new Set([...roleHolderIds, ...byPermission]));
    return union.length > 0 ? union : adminStandInsFor(prisma, 'approve_gm');
}

export async function resolveApprovalChain(
    prisma: PrismaClient,
    employee: Employee
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage; selfSignedStages?: ApprovalStage[] }> {
    const idsOf = (rows: { id: string }[]) => rows.map(r => r.id);

    // The org ladder above this requester, already stripped of themselves and of anyone at or
    // below their own level — a head's leave must never route through their own subordinates. One
    // shared walk (headTiersAbove) serves this chain, the permission chain and the missing-punch
    // chain, so the three cannot drift apart again.
    const tiers = await headTiersAbove(prisma, employee);
    const requesterRank = await requesterRankOf(prisma, employee);
    const tierIds = (stage: ApprovalStage) => tiers.find(t => t.stage === stage)?.userIds ?? [];
    const unitHeadsA = tierIds('UNIT_HEAD');
    const deptHeadsA = tierIds('DEPT_HEAD');
    const divisionHeadsA = tierIds('DIVISION_HEAD');
    const directorsA = tierIds('DIRECTORATE');

    // Head of Personnel Relations — a *function*, not a role. Granted via the approve_attendance
    // permission, directly, via a Functional Hat, or by SUPER_ADMIN.
    const attendanceHeads = await resolveFunctionApprovers(prisma, 'approve_attendance');

    // Role ∪ approve_hr_manager permission/hat ∪ SUPER_ADMIN — mirrors the GENERAL_MANAGER union
    // below, so a person whose real Position is a Head role but who holds the HR Manager
    // Functional Hat is recognised. There is no HR_MANAGER role any more.
    const hrManagers = await resolveFunctionApprovers(prisma, 'approve_hr_manager');

    // General Manager stage — whoever holds the GENERAL_MANAGER position, OR anyone designated a
    // GM approver via approve_gm. Satisfied by ANY ONE of them signing.
    const generalManagerRoleHolders = idsOf(await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } }));
    const generalManagers = await resolveGeneralManagers(prisma, generalManagerRoleHolders);

    // Keep only the org-head levels STRICTLY ABOVE the requester — so a Division Head's request never
    // routes through the Department Head beneath them. HEAD_ATTENDANCE / HR_MANAGER / GENERAL_MANAGER
    // are always kept (functions / top of this form); the requester is also removed by self-exclusion.

    // --- The org ladder, and the two printed manager rows it owns.
    //
    // The form prints exactly TWO manager signature boxes — "Direct supervisor" and "Head of
    // Department / Division" — and they belong to the org ladder ALONE: UNIT_HEAD, DEPT_HEAD,
    // DIVISION_HEAD. Nobody else may fill them. The Administrative Director and the General Manager
    // have their own printed rows further down; letting them spill into these two made one person's
    // signature appear three times and dressed a cross-cutting endorsement up as line management.
    //
    // So: take the ladder levels that exist above the requester, nearest first, and keep AT MOST
    // TWO — one per printed box. A third level below them does not sign at all; there is no box
    // left for it. Concretely, for a plain employee:
    //   unit + dept + division exist  -> unit head, then dept head. The division head is not asked.
    //   two of them exist             -> both, nearest first.
    //   one exists                    -> that one signs once, and covers BOTH printed rows.
    //   none exists                   -> both rows stay blank and neither stage is created; the
    //                                    request runs Attendance -> HR -> Directorate -> GM.
    //
    // The last case is not hypothetical: 77 of 90 active plain employees currently carry no unit,
    // department or division at all, so their leave has no line-manager approval until those
    // assignments are filled in. That is a data gap the chain now shows honestly instead of hiding
    // behind the General Manager's signature.
    const ladderLevels: { stage: ApprovalStage; userIds: string[] }[] = [
        { stage: 'UNIT_HEAD', userIds: unitHeadsA },
        { stage: 'DEPT_HEAD', userIds: deptHeadsA },
        { stage: 'DIVISION_HEAD', userIds: divisionHeadsA },
    ];
    const ladder = ladderLevels.filter(l => l.userIds.length > 0);
    const ladderSigners = ladder.slice(0, 2);

    // --- Signing chain, in order.
    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];
    rawStages.push({ stage: 'HEAD_ATTENDANCE', userIds: attendanceHeads });
    rawStages.push(...ladderSigners);
    rawStages.push({ stage: 'HR_MANAGER', userIds: hrManagers });
    rawStages.push({ stage: 'DIRECTORATE', userIds: directorsA });
    rawStages.push({ stage: 'GENERAL_MANAGER', userIds: generalManagers });

    // --- Smart-signature coverage: which single person fills each printed row on the form.
    // A person who holds several posts signs once and their signature appears in every row they own
    // — but only among the rows they are actually entitled to, which for the two manager boxes now
    // means the ladder and nothing else. A row with no entitled holder is printed blank.
    const directGroup = ladderSigners[0]?.userIds ?? [];
    const deptDivGroup = ladderSigners[1]?.userIds ?? ladderSigners[0]?.userIds ?? [];
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
    // requester themselves — or who otherwise has no signing step — is left uncovered for now; the
    // self-signature pass below decides which of those the requester fills in person.
    for (const holder of rowHolders) {
        for (const userId of Array.from(new Set(holder.userIds))) {
            const step = stepByUser.get(userId);
            if (step && !step.coversStages.includes(holder.row)) step.coversStages.push(holder.row);
        }
    }

    // --- Nobody above them: the requester signs that row themselves.
    //
    // The same rule the Missing Biometric Log already follows, applied to all six printed rows. A
    // row can end up with no signer for two very different reasons, and they must not be treated
    // alike:
    //
    //   · the post is unfilled, or the employee is not linked to the org chart at all — the row is
    //     genuinely unapproved and must print blank. 77 employees sit in this state today.
    //   · the ONLY person who would have signed it is the requester — the Head of Personal
    //     Relations filing their own leave, the GM filing theirs. There is no higher authority to
    //     route to, so the row is signed by the authority that exists: them.
    //
    // `rawUserIds` / the un-narrowed function lists are what separate the two: the requester must
    // actually be a holder of that row before they may sign it. It is never an approval STEP —
    // nobody approves their own request, and a step would also drop it into their own inbox.
    const covered = new Set(steps.flatMap(s => s.coversStages));
    const me = employee.userId;
    const selfSignedStages: ApprovalStage[] = [];
    const claimIfSoleHolder = (row: ApprovalStage, rawHolders: string[]) => {
        if (!covered.has(row) && me && rawHolders.includes(me)) selfSignedStages.push(row);
    };
    claimIfSoleHolder('HEAD_ATTENDANCE', attendanceHeads);
    claimIfSoleHolder('HR_MANAGER', hrManagers);
    claimIfSoleHolder('GENERAL_MANAGER', generalManagers);
    claimIfSoleHolder('DIRECTORATE', tiers.find(t => t.stage === 'DIRECTORATE')?.rawUserIds ?? []);

    // The two manager boxes belong to the ladder, where "holder" is a rank rather than a named
    // permission: a head with no ladder level above them is their own line manager. A plain
    // employee reaching the same point is not — they are simply unlinked — so rank gates it, and
    // both boxes move together because they are filled from the same ladder.
    if (!covered.has('DIRECT_SUPERVISOR') && requesterRank > ORG_RANK.EMPLOYEE) {
        selfSignedStages.push('DIRECT_SUPERVISOR', 'HEAD_DEPT_DIVISION');
    }

    return { steps, selfSignedStages };
}

// The two printed signature rows on the Missing Biometric Log Form, in order.
export const MISSING_PUNCH_ROW_STAGES: ApprovalStage[] = ['DEPT_HEAD', 'HEAD_ATTENDANCE'];

// Builds the Missing Biometric Log chain: Head of Department/Division -> Head of Personal Relations
// Department. The manager stage cascades — the employee's department head, else their division
// head, else their directorate head — so an employee with no dept head is still covered by whoever
// sits above them. Personal Relations is the only mandatory stage. On final approval the forgotten
// punch is written to BioTime (see staffHubController.decideApprovalStep).
export async function resolveMissingPunchChain(
    prisma: PrismaClient,
    employee: Employee
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage; selfSignedStages?: ApprovalStage[] }> {
    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];

    // Head of Department/Division — the nearest head ABOVE the requester: department, else
    // division, else directorate.
    //
    // The tiers arrive from headTiersAbove already stripped of the requester and of their own
    // level, which is what makes the cascade correct. It used to walk raw query results and ask
    // "is this tier empty?", so a department head who is the ONLY head of their own department
    // matched their own tier, stopped the cascade there, and was then removed by self-exclusion —
    // leaving the request with no manager at all and sending it straight to Personnel Relations.
    const tiers = await headTiersAbove(prisma, employee);
    const mgrIds = tiers.find(t => ['DEPT_HEAD', 'DIVISION_HEAD', 'DIRECTORATE'].includes(t.stage)
        && t.userIds.length > 0)?.userIds ?? [];
    rawStages.push({ stage: 'DEPT_HEAD', userIds: mgrIds });

    // Head of Personnel Relations — granted by approve_attendance (directly, via a hat, or
    // SUPER_ADMIN). Mandatory: no holder means a real misconfiguration.
    const attendanceHeads = await resolveFunctionApprovers(prisma, 'approve_attendance');
    rawStages.push({ stage: 'HEAD_ATTENDANCE', userIds: attendanceHeads });

    const requiredNonEmpty: ApprovalStage[] = ['HEAD_ATTENDANCE'];
    const seen = new Set<string>();
    const steps: ResolvedApprovalStep[] = [];
    const stepByUser = new Map<string, ResolvedApprovalStep>();
    for (const raw of rawStages) {
        const distinctIds = Array.from(new Set(raw.userIds));
        if (distinctIds.length === 0 && requiredNonEmpty.includes(raw.stage)) {
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

    // Smart signature, same as the Leave Request Form: one person may hold both posts — the
    // department head who is also the Head of Personal Relations is a real case here — and the
    // dedup above gives them a single step at the earlier stage. Without coverage their signature
    // filled only the row of the stage they happened to be deduped into, and the other row printed
    // blank even though the person who owns it had signed.
    const rowHolders: { row: ApprovalStage; userIds: string[] }[] = [
        { row: 'DEPT_HEAD', userIds: mgrIds },
        { row: 'HEAD_ATTENDANCE', userIds: attendanceHeads },
    ];
    for (const holder of rowHolders) {
        for (const userId of Array.from(new Set(holder.userIds))) {
            const step = stepByUser.get(userId);
            if (step && !step.coversStages.includes(holder.row)) step.coversStages.push(holder.row);
        }
    }

    // Nobody above a head: they sign the manager row themselves.
    //
    // A department head whose division has no head, or a division head filing their own request,
    // has no line authority to send it to — so the row is signed by the highest authority there is,
    // which is the requester, and the request moves on to Personal Relations. This is deliberately
    // NOT an approval step: self-approval is refused everywhere in this system, and a step would
    // also drop the request into the requester's own inbox.
    //
    // The rank test is what keeps this honest. A plain employee with no unit, department or
    // division reaches this point too — 77 of them do today — but they are not their own highest
    // authority, they are simply unlinked in the org chart. Stamping their signature on a manager
    // row would assert an approval that never happened, so their row stays blank.
    const selfSignedStages: ApprovalStage[] = [];
    if (mgrIds.length === 0 && (await requesterRankOf(prisma, employee)) > ORG_RANK.EMPLOYEE) {
        selfSignedStages.push('DEPT_HEAD');
    }

    return { steps, selfSignedStages };
}

// Builds the short chain behind the two attendance forms. One org walk, two shapes, because the
// two printed forms carry different signature rows:
//
//   PERMISSION (Late Coming / Early Leaving / Few Hours — "Late Arrival - Early Departure Request
//   Form", as reprinted 2026-09):
//       Direct Supervisor -> Head of Division (مدير الإدارة)
//           -> Head of Personnel Affairs (رئيس قسم شؤون الموظفين) -> Head of HR (رئيس الموارد البشرية)
//
//   WORK_AUTHORIZATION (out-work — "Work Authorization Form", unchanged):
//       Direct Supervisor -> Head of Department -> Head of Personnel Affairs -> General Manager
//
// Direct Supervisor is the employee's most-immediate head (unit head if in a unit, else department
// head, …); it self-excludes/dedups against the manager stage so a person never signs twice, and a
// person who holds two of the posts signs ONCE and covers both printed rows. The Head of Personnel
// Affairs is mandatory in both, as is each chain's final signature.
export async function resolvePermissionApprovalChain(
    prisma: PrismaClient,
    employee: Employee,
    opts?: { chain?: 'PERMISSION' | 'WORK_AUTHORIZATION' }
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage }> {
    const chain = opts?.chain ?? 'PERMISSION';
    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];

    // Direct Supervisor — the nearest head ABOVE the requester: unit, else department, else
    // division, else directorate.
    //
    // Same fix as resolveMissingPunchChain: the tiers are pre-filtered by headTiersAbove, so a head
    // who is the only head of their own level no longer swallows the cascade and then vanishes to
    // self-exclusion, which left their permission requests with no supervisor signature at all.
    const tiers = await headTiersAbove(prisma, employee);
    const directIds = tiers.find(t => t.userIds.length > 0)?.userIds ?? [];

    rawStages.push({ stage: 'DIRECT_SUPERVISOR', userIds: directIds });

    // The manager row — Head of Division on the permission form, Head of Department on the work
    // authorization — and only if they sit above the requester. The dedup below drops them when the
    // Direct Supervisor stage already resolved to the same person, so nobody signs the same
    // permission twice; their one signature then fills both rows via coversStages.
    const managerStage: ApprovalStage = chain === 'PERMISSION' ? 'DIVISION_HEAD' : 'DEPT_HEAD';
    const managerIds = tiers.find(t => t.stage === managerStage)?.userIds ?? [];
    rawStages.push({ stage: managerStage, userIds: managerIds });

    // Head of Personnel Affairs — granted by the approve_attendance permission, directly, via a
    // Functional Hat, or by SUPER_ADMIN (mandatory stage).
    const attendanceHeads = await resolveFunctionApprovers(prisma, 'approve_attendance');
    rawStages.push({ stage: 'HEAD_ATTENDANCE', userIds: attendanceHeads });

    if (chain === 'PERMISSION') {
        // Head of Human Resources — the last signature on the reprinted permission form. Same
        // source as the full leave chain's HR row: role ∪ approve_hr_manager ∪ SUPER_ADMIN.
        const hrManagers = await resolveFunctionApprovers(prisma, 'approve_hr_manager');
        rawStages.push({ stage: 'HR_MANAGER', userIds: hrManagers });
    } else {
        // General Manager — the work authorization's signed-document authentication. The
        // GENERAL_MANAGER position, OR anyone designated a GM approver via `approve_gm` (directly,
        // via a hat, or SUPER_ADMIN). Satisfied by ANY ONE signing (sibling-skip in decideApprovalStep).
        const generalManagerRoleHolders = await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } });
        const generalManagers = await resolveGeneralManagers(prisma, generalManagerRoleHolders.map(u => u.id));
        rawStages.push({ stage: 'GENERAL_MANAGER', userIds: generalManagers });
    }

    const requiredNonEmpty: ApprovalStage[] = chain === 'PERMISSION'
        ? ['HEAD_ATTENDANCE', 'HR_MANAGER']
        : ['HEAD_ATTENDANCE', 'GENERAL_MANAGER'];
    const seen = new Map<string, ResolvedApprovalStep>();
    const steps: ResolvedApprovalStep[] = [];
    for (const raw of rawStages) {
        const distinctIds = Array.from(new Set(raw.userIds));
        if (distinctIds.length === 0 && requiredNonEmpty.includes(raw.stage)) {
            return { steps: [], blockedStage: raw.stage };
        }
        for (const userId of distinctIds) {
            if (userId === employee.userId) continue;
            const already = seen.get(userId);
            if (already) {
                // One person holding two of these posts — a Division Head who is also the Head of
                // HR, say — is asked to sign once. Without recording the coverage here, the row
                // they were deduped OUT of prints blank on a form they did in fact approve.
                if (!already.coversStages.includes(raw.stage)) already.coversStages.push(raw.stage);
                continue;
            }
            const step: ResolvedApprovalStep = { stage: raw.stage, approverUserId: userId, coversStages: [raw.stage] };
            seen.set(userId, step);
            steps.push(step);
        }
    }

    return { steps };
}

// Exceptional Performance / Exceptional Contribution Award — real escalation from whoever submits
// the nomination, up to HR then the General Manager, mirroring resolveApprovalChain's org-ladder
// walk exactly (just keyed by the SUBMITTING HEAD's own placement, not the nominee's): a Unit Head's
// nomination escalates Dept Head -> Division Head -> HR -> GM; a Department/Office Head's escalates
// Division Head -> HR -> GM; a Division Head or Director (already at/above Division rank) skips
// straight to HR -> GM, self-excluded from ever approving their own submission. DEPT_HEAD/
// DIVISION_HEAD are already valid ApprovalStage values (reused from the main chain); HR_MANAGER/
// GENERAL_MANAGER reuse the existing approve_hr_manager/approve_gm permissions as before.
export const EXCEPTIONAL_PERFORMANCE_STAGE_SEQUENCE: Record<string, number> = {
    DEPT_HEAD: 0,
    DIVISION_HEAD: 1,
    HR_MANAGER: 2,
    GENERAL_MANAGER: 3,
};

interface ExceptionalPerformanceSubmitter {
    id: string;
    role?: string | null;
    unitId?: string | null;
    departmentId?: string | null;
    divisionId?: string | null;
}

export async function resolveExceptionalPerformanceApprovalChain(
    prisma: PrismaClient,
    submitter: ExceptionalPerformanceSubmitter
): Promise<{ steps: ResolvedApprovalStep[]; blockedStage?: ApprovalStage }> {
    const submitterRank = orgRank(submitter.role);

    // Resolve the SUBMITTER's own department/division (not the nominee's) — directly if they're a
    // Department/Office/Division head, else walked up one hop from their unit — so the escalation
    // targets whoever actually sits above THEM in the org, same relation resolveApprovalChain uses
    // for an employee's own placement.
    let ownDepartmentId = submitter.departmentId ?? null;
    if (!ownDepartmentId && submitter.unitId) {
        const unit = await prisma.unit.findUnique({ where: { id: submitter.unitId }, select: { departmentId: true } });
        ownDepartmentId = unit?.departmentId ?? null;
    }
    let ownDivisionId = submitter.divisionId ?? null;
    if (!ownDivisionId && ownDepartmentId) {
        const dept = await prisma.department.findUnique({ where: { id: ownDepartmentId }, select: { divisionId: true } });
        ownDivisionId = dept?.divisionId ?? null;
    }

    const rawStages: { stage: ApprovalStage; userIds: string[] }[] = [];

    if (submitterRank < ORG_RANK.HEAD_DEPARTMENT && ownDepartmentId) {
        const deptHeads = await prisma.user.findMany({
            where: { role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: ownDepartmentId },
            select: { id: true },
        });
        rawStages.push({ stage: 'DEPT_HEAD', userIds: deptHeads.map(u => u.id) });
    }
    if (submitterRank < ORG_RANK.HEAD_DIVISION && ownDivisionId) {
        const divisionHeads = await prisma.user.findMany({
            where: { role: 'HEAD_DIVISION', divisionId: ownDivisionId },
            select: { id: true },
        });
        rawStages.push({ stage: 'DIVISION_HEAD', userIds: divisionHeads.map(u => u.id) });
    }

    const hrManagers = await resolveFunctionApprovers(prisma, 'approve_hr_manager');
    rawStages.push({ stage: 'HR_MANAGER', userIds: hrManagers });

    const generalManagerRoleHolders = await prisma.user.findMany({ where: { role: 'GENERAL_MANAGER' }, select: { id: true } });
    const generalManagers = await resolveGeneralManagers(prisma, generalManagerRoleHolders.map(u => u.id));
    rawStages.push({ stage: 'GENERAL_MANAGER', userIds: generalManagers });

    // Only HR/GM are mandatory — DEPT_HEAD/DIVISION_HEAD tolerate zero holders and are simply
    // skipped, same treatment as the main chain's org-ladder stages (a missing org-coverage gap,
    // not a misconfiguration worth blocking on).
    const requiredNonEmpty: ApprovalStage[] = ['HR_MANAGER', 'GENERAL_MANAGER'];
    const seen = new Set<string>([submitter.id]);
    const steps: ResolvedApprovalStep[] = [];
    for (const raw of rawStages) {
        const distinctIds = Array.from(new Set(raw.userIds));
        if (distinctIds.length === 0 && requiredNonEmpty.includes(raw.stage)) {
            return { steps: [], blockedStage: raw.stage };
        }
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
