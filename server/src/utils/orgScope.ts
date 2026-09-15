import { PrismaClient } from '@prisma/client';

// Who reports up to whom, answered from the ORG CHART rather than from fields stamped on each
// employee row.
//
// A head's reach is decided by where they sit in the chart: a directorate head covers its divisions,
// those divisions' departments, and those departments' units. Nothing else needs to be recorded.
//
// This replaces two older mechanisms that tried to answer the same question and disagreed with each
// other:
//
//   · `User.departmentIds` — a directorate head was asked to tick, by hand, every department they
//     oversee. It predates the chart having a Directorate level at all. Left unticked (which is how
//     it sits today) the head simply saw nobody through it.
//   · comparing `Employee.directorateId` directly — correct only while every employee carries a
//     directorate stamped on their own row. They do not: of 97 active employees 18 carry one while
//     16 sit in a department that rolls up to a directorate, and the two sets are not the same
//     people. So each test let somebody through that the other excluded.
//
// Walking the chart has neither problem. It also cannot go stale: move a department to another
// division and everyone in it moves with it, with no rows to re-stamp.

export interface OrgPlacement {
    unitId: string | null;
    departmentId: string | null;
    divisionId: string | null;
    directorateId: string | null;
}

export interface OrgResolver {
    /**
     * An employee's full placement, completed upward from whatever they actually carry: a unit
     * implies its department, a department implies its division, a division implies its directorate.
     * Values already on the row are trusted and never overwritten — only gaps are filled.
     */
    placementOf(emp: { unitId?: string | null; departmentId?: string | null; divisionId?: string | null; directorateId?: string | null }): OrgPlacement;
    /** Does `emp` sit at or beneath the given node? */
    isUnder(emp: Parameters<OrgResolver['placementOf']>[0], node: { unitId?: string | null; departmentId?: string | null; divisionId?: string | null; directorateId?: string | null }): boolean;
}

/**
 * Load the chart once and return a resolver. Three small queries, not one per employee — the
 * callers below run this against the whole roster.
 */
export async function buildOrgResolver(prisma: PrismaClient): Promise<OrgResolver> {
    const [units, departments, divisions] = await Promise.all([
        prisma.unit.findMany({ select: { id: true, departmentId: true } }),
        prisma.department.findMany({ select: { id: true, divisionId: true } }),
        prisma.division.findMany({ select: { id: true, directorateId: true } }),
    ]);
    const unitToDept = new Map(units.map(u => [u.id, u.departmentId]));
    const deptToDiv = new Map(departments.map(d => [d.id, d.divisionId]));
    const divToDirectorate = new Map(divisions.map(d => [d.id, d.directorateId]));

    const placementOf: OrgResolver['placementOf'] = (emp) => {
        const unitId = emp.unitId ?? null;
        const departmentId = emp.departmentId ?? (unitId ? unitToDept.get(unitId) ?? null : null);
        const divisionId = emp.divisionId ?? (departmentId ? deptToDiv.get(departmentId) ?? null : null);
        const directorateId = emp.directorateId ?? (divisionId ? divToDirectorate.get(divisionId) ?? null : null);
        return { unitId, departmentId, divisionId, directorateId };
    };

    const isUnder: OrgResolver['isUnder'] = (emp, node) => {
        const p = placementOf(emp);
        // Most specific node wins: a unit head owns a unit, not the whole department it sits in.
        if (node.unitId) return !!p.unitId && p.unitId === node.unitId;
        if (node.departmentId) return !!p.departmentId && p.departmentId === node.departmentId;
        if (node.divisionId) return !!p.divisionId && p.divisionId === node.divisionId;
        if (node.directorateId) return !!p.directorateId && p.directorateId === node.directorateId;
        return false;
    };

    return { placementOf, isUnder };
}
