// Who reports up to whom, answered from the ORG CHART — the browser-side twin of
// server/src/utils/orgScope.ts. Same rule, same reasoning; see that file for the history.
//
// A head's reach is their node in the chart plus everything beneath it: a directorate owns its
// divisions, those own their departments, those own their units. Screens used to each carry their
// own version of this, built out of whichever fields happened to be stamped on the employee row
// (`directorateId`, or a hand-ticked `User.departmentIds`). They disagreed with one another and
// with the server, and a directorate head ended up seeing everybody on one screen and nobody on the
// next. One walker, used everywhere.

export interface OrgLists {
    units?: { id: string; departmentId?: string | null }[];
    departments?: { id: string; divisionId?: string | null }[];
    divisions?: { id: string; directorateId?: string | null }[];
}

export interface OrgPlaced {
    unitId?: string | null;
    departmentId?: string | null;
    divisionId?: string | null;
    directorateId?: string | null;
}

/** The node a head owns, most specific first. */
export interface OrgNode extends OrgPlaced {}

export interface OrgScope {
    /** Complete a placement upward from whatever the row actually carries; gaps only, never overwrite. */
    placementOf(p: OrgPlaced): Required<OrgPlaced>;
    /** Does `p` sit at or beneath `node`? */
    isUnder(p: OrgPlaced, node: OrgNode): boolean;
}

export function buildOrgScope(lists: OrgLists): OrgScope {
    const unitToDept = new Map((lists.units || []).map(u => [u.id, u.departmentId ?? null]));
    const deptToDiv = new Map((lists.departments || []).map(d => [d.id, d.divisionId ?? null]));
    const divToDirectorate = new Map((lists.divisions || []).map(d => [d.id, d.directorateId ?? null]));

    const placementOf = (p: OrgPlaced): Required<OrgPlaced> => {
        const unitId = p.unitId ?? null;
        const departmentId = p.departmentId ?? (unitId ? unitToDept.get(unitId) ?? null : null);
        const divisionId = p.divisionId ?? (departmentId ? deptToDiv.get(departmentId) ?? null : null);
        const directorateId = p.directorateId ?? (divisionId ? divToDirectorate.get(divisionId) ?? null : null);
        return { unitId, departmentId, divisionId, directorateId };
    };

    const isUnder = (p: OrgPlaced, node: OrgNode): boolean => {
        const at = placementOf(p);
        // Most specific node wins — a unit head owns a unit, not the department around it.
        if (node.unitId) return !!at.unitId && at.unitId === node.unitId;
        if (node.departmentId) return !!at.departmentId && at.departmentId === node.departmentId;
        if (node.divisionId) return !!at.divisionId && at.divisionId === node.divisionId;
        if (node.directorateId) return !!at.directorateId && at.directorateId === node.directorateId;
        return false;
    };

    return { placementOf, isUnder };
}

/**
 * The chart node a head user owns.
 *
 * HEAD_DIRECTOR is the odd one: the User row has no directorateId, so it comes from their linked
 * Employee record — pass it in as `myEmployee`.
 */
export function headNodeOf(
    user: { role?: string; unitId?: string | null; departmentId?: string | null; divisionId?: string | null } | null | undefined,
    myEmployee?: OrgPlaced | null,
): OrgNode | null {
    if (!user) return null;
    // The User row carries unit/department/division; the directorate only ever lives on the linked
    // Employee. Falling back to the employee record for the others too covers accounts where the
    // assignment was made on the employee side only.
    const unitId = user.unitId ?? myEmployee?.unitId ?? null;
    const departmentId = user.departmentId ?? myEmployee?.departmentId ?? null;
    const divisionId = user.divisionId ?? myEmployee?.divisionId ?? null;
    const directorateId = myEmployee?.directorateId ?? null;
    switch (user.role) {
        case 'HEAD_UNIT': return unitId ? { unitId } : null;
        case 'HEAD_DEPARTMENT':
        case 'HEAD_OFFICE': return departmentId ? { departmentId } : null;
        case 'HEAD_DIVISION': return divisionId ? { divisionId } : null;
        case 'HEAD_DIRECTOR': return directorateId ? { directorateId } : null;
        default: return null;
    }
}
