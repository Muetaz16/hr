// -----------------------------------------------------------------------------
// Two-tier ("skip-level") evaluation hierarchy
// -----------------------------------------------------------------------------
// Every employee is evaluated by the TWO managers directly above them in the org
// tree (Unit -> Department -> Division -> Directorate -> GM -> Chairman): their
// direct manager and their manager's manager.
//
//   Who is evaluated                    | Evaluator 1 (direct) | Evaluator 2 (skip)
//   ------------------------------------|----------------------|-------------------
//   Employee in a Unit                  | Unit Head            | Department Head
//   Employee in a Department (no unit)  | Department Head      | Division Head
//   Head of Unit                        | Department Head      | Division Head
//   Head of Department / Office         | Division Head        | Directorate Head
//   Head of Division                    | Directorate Head     | General Manager
//   Head of Directorate                 | General Manager      | Chairman
//   General Manager                     | Chairman             | —
//
// The final score is the AVERAGE of the two evaluations. There is no separate
// "final approval / lock" step — an employee is simply evaluated once or twice.
// -----------------------------------------------------------------------------

export type EvalLevel = 'UNIT' | 'DEPARTMENT' | 'DIVISION' | 'DIRECTOR' | 'GM' | 'CHAIRMAN';

/** Human-readable label for each evaluator level. */
export const LEVEL_LABEL: Record<EvalLevel, string> = {
    UNIT: 'Unit Head',
    DEPARTMENT: 'Department Head',
    DIVISION: 'Division Head',
    DIRECTOR: 'Directorate Head',
    GM: 'General Manager',
    CHAIRMAN: 'Chairman',
};

/** The org placement fields needed to resolve the hierarchy. */
export interface OrgPlacement {
    role: string;
    unitId?: string | null;
    departmentId?: string | null;
    divisionId?: string | null;
    directorateId?: string | null;
}

/** The evaluation level a given role is responsible for filling in. */
export function levelForRole(role: string | undefined | null): EvalLevel | null {
    switch (role) {
        case 'HEAD_UNIT': return 'UNIT';
        case 'HEAD_DEPARTMENT': return 'DEPARTMENT';
        case 'HEAD_OFFICE': return 'DEPARTMENT'; // an office head acts at department level
        case 'HEAD_DIVISION': return 'DIVISION';
        case 'HEAD_DIRECTOR': return 'DIRECTOR';
        case 'GENERAL_MANAGER': return 'GM';
        case 'CHAIRMAN': return 'CHAIRMAN';
        default: return null;
    }
}

/**
 * The two evaluator levels required for an employee, based on the skip-level rule.
 * Returns 2 levels for everyone below the top, 1 for the GM, 0 for the Chairman.
 */
export function getRequiredLevels(emp: OrgPlacement): EvalLevel[] {
    switch (emp.role) {
        case 'HEAD_UNIT': return ['DEPARTMENT', 'DIVISION'];
        case 'HEAD_DEPARTMENT':
        case 'HEAD_OFFICE': return ['DIVISION', 'DIRECTOR'];
        case 'HEAD_DIVISION': return ['DIRECTOR', 'GM'];
        case 'HEAD_DIRECTOR': return ['GM', 'CHAIRMAN'];
        case 'GENERAL_MANAGER': return ['CHAIRMAN'];
        case 'CHAIRMAN': return [];
        default:
            // Rank-and-file (EMPLOYEE, and anyone without a management role):
            // evaluators are the two levels above wherever they actually sit.
            if (emp.unitId) return ['UNIT', 'DEPARTMENT'];
            if (emp.departmentId) return ['DEPARTMENT', 'DIVISION'];
            if (emp.divisionId) return ['DIVISION', 'DIRECTOR'];
            if (emp.directorateId) return ['DIRECTOR', 'GM'];
            return [];
    }
}

/**
 * Can `manager` perform the evaluation at `level` for `target`?
 * Requires: the manager's role maps to that level, the level is one of the
 * target's required levels, and the manager sits in the target's org chain.
 * Scope is only enforced when the manager's matching id is known (so incomplete
 * placement data does not silently block a legitimate evaluation).
 */
export function canEvaluate(manager: OrgPlacement, target: OrgPlacement, level: EvalLevel): boolean {
    if (levelForRole(manager.role) !== level) return false;
    if (!getRequiredLevels(target).includes(level)) return false;
    switch (level) {
        case 'UNIT': return !manager.unitId || manager.unitId === target.unitId;
        case 'DEPARTMENT': return !manager.departmentId || manager.departmentId === target.departmentId;
        case 'DIVISION': return !manager.divisionId || manager.divisionId === target.divisionId;
        case 'DIRECTOR': return !manager.directorateId || manager.directorateId === target.directorateId;
        case 'GM':
        case 'CHAIRMAN': return true;
        default: return false;
    }
}
