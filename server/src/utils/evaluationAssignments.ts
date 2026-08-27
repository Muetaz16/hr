import { PrismaClient } from '@prisma/client';
import { EvalLevel, OrgPlacement, canEvaluate, getRequiredLevels, levelForRole } from './evaluationHierarchy';
import { resolveManagerPlacement } from '../controllers/evaluationController';

import { prisma } from '../lib/prisma';

// Every role that acts as an evaluator at some level of the skip-level hierarchy.
export const MANAGER_ROLES = [
    'HEAD_UNIT', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_DIVISION', 'HEAD_DIRECTOR', 'GENERAL_MANAGER', 'CHAIRMAN'
];

type EvalModel = 'unitEvaluation' | 'departmentEvaluation' | 'divisionEvaluation' | 'directorEvaluation' | 'gMEvaluation' | 'chairmanEvaluation';

export const getModelForLevel = (level: EvalLevel): EvalModel => {
    switch (level) {
        case 'UNIT': return 'unitEvaluation';
        case 'DEPARTMENT': return 'departmentEvaluation';
        case 'DIVISION': return 'divisionEvaluation';
        case 'DIRECTOR': return 'directorEvaluation';
        case 'GM': return 'gMEvaluation';
        case 'CHAIRMAN': return 'chairmanEvaluation';
    }
};

// The manager's own scope id for the level they evaluate at. GM/CHAIRMAN have
// no scope — they're the sole company-wide evaluator at their level.
const scopeIdForLevel = (level: EvalLevel, p: OrgPlacement): string | null => {
    switch (level) {
        case 'UNIT': return p.unitId ?? null;
        case 'DEPARTMENT': return p.departmentId ?? null;
        case 'DIVISION': return p.divisionId ?? null;
        case 'DIRECTOR': return p.directorateId ?? null;
        default: return null;
    }
};

interface AssignmentUser {
    id: string;
    email: string;
    fullName: string | null;
}

export interface ManagerAssignment {
    user: AssignmentUser;
    level: EvalLevel;
    required: { id: string; fullName: string }[];
}

export interface AssignmentIssue {
    user: AssignmentUser;
    level: EvalLevel;
}

export interface VacantScope {
    level: EvalLevel;
    scopeId: string;
    sampleEmployeeName: string;
}

// For every manager-role user, the employees they are responsible for
// evaluating this month — mirroring exactly what a logged-in manager already
// sees on the /evaluations page (see canEvaluate/getRequiredLevels), just
// computed for everyone at once so we can notify them.
//
// Managers whose own org-scope id isn't set are excluded from the normal
// batch (canEvaluate treats a missing scope as "matches everyone", which
// would wrongly hand them a company-wide list) and reported separately, same
// as any org scope with nobody claiming it ("vacant").
export const buildMonthlyAssignments = async (): Promise<{
    assignments: ManagerAssignment[];
    unscopedManagers: AssignmentIssue[];
    vacantScopes: VacantScope[];
}> => {
    const employees = await prisma.employee.findMany({
        where: { enrollmentStatus: 'ACTIVE' },
        select: { id: true, fullName: true, role: true, unitId: true, departmentId: true, divisionId: true, directorateId: true },
    });

    const managerUsers = await prisma.user.findMany({
        where: { role: { in: MANAGER_ROLES } },
        select: { id: true },
    });

    const assignments: ManagerAssignment[] = [];
    const unscopedManagers: AssignmentIssue[] = [];
    const claimedScopes = new Set<string>();

    for (const { id: userId } of managerUsers) {
        const resolved = await resolveManagerPlacement(userId);
        if (!resolved) continue;
        const { user, placement } = resolved;
        const level = levelForRole(user.role);
        if (!level) continue;

        const assignmentUser: AssignmentUser = { id: user.id, email: user.email, fullName: user.fullName };
        const needsScope = level === 'UNIT' || level === 'DEPARTMENT' || level === 'DIVISION' || level === 'DIRECTOR';
        const scopeId = scopeIdForLevel(level, placement);

        if (needsScope && !scopeId) {
            unscopedManagers.push({ user: assignmentUser, level });
            continue;
        }
        if (scopeId) claimedScopes.add(`${level}:${scopeId}`);

        const required = employees.filter(e => canEvaluate(placement, e as unknown as OrgPlacement, level));
        if (required.length) {
            assignments.push({ user: assignmentUser, level, required: required.map(e => ({ id: e.id, fullName: e.fullName })) });
        }
    }

    const vacantScopes: VacantScope[] = [];
    const scopeSeen = new Set<string>();
    for (const e of employees) {
        for (const level of getRequiredLevels(e as unknown as OrgPlacement)) {
            const scopeId = scopeIdForLevel(level, e as unknown as OrgPlacement);
            if (!scopeId) continue; // GM/CHAIRMAN — company-wide, never vacant as long as the role exists
            const key = `${level}:${scopeId}`;
            if (scopeSeen.has(key)) continue;
            scopeSeen.add(key);
            if (!claimedScopes.has(key)) vacantScopes.push({ level, scopeId, sampleEmployeeName: e.fullName });
        }
    }

    return { assignments, unscopedManagers, vacantScopes };
};

// Which of this manager's required employees still have no evaluation record
// for the given month (mirrors Evaluations.tsx's summaryFor, from the
// manager's side instead of the employee's).
export const getIncompleteForManager = async (
    level: EvalLevel,
    month: string,
    required: { id: string; fullName: string }[]
): Promise<{ id: string; fullName: string }[]> => {
    if (!required.length) return [];
    const model = getModelForLevel(level);
    const done = await (prisma as any)[model].findMany({
        where: { month, employeeId: { in: required.map(e => e.id) } },
        select: { employeeId: true },
    });
    const doneIds = new Set(done.map((d: any) => d.employeeId as string));
    return required.filter(e => !doneIds.has(e.id));
};
