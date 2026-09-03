import type { Department, Division, Unit, JobDescription } from '../types';

// "Reports To" is never free text — it's derived straight from the org chart: the Head Job
// Description at the position's own scope (a regular position reports to the Head of its
// Unit/Department/Division/Directorate), or one level up if the position IS that scope's Head
// (a Head reports to the Head of the parent scope). This is position-based, not person-based —
// it names the reporting POSITION (another Job Description), not whoever currently holds it;
// looking up the actual current jobholder from that position is left for a future pass.
//
// Shared by JobDescriptionForm.tsx (admin JD creation, all 4 scope levels) and Recruitment.tsx
// (hiring requests, Department/Unit scope only) — keep both in sync through this one place.
export type ScopeLevel = 'DIRECTORATE' | 'DIVISION' | 'DEPARTMENT' | 'UNIT';
export type ScopeRef = { level: ScopeLevel; id: string } | { level: 'TOP' };

export const parentScopeOf = (
    level: ScopeLevel,
    id: string,
    departments: Department[],
    divisions: Division[],
    units: Unit[],
): ScopeRef => {
    if (level === 'UNIT') {
        const unit = units.find(u => u.id === id);
        return unit?.departmentId ? { level: 'DEPARTMENT', id: unit.departmentId } : { level: 'TOP' };
    }
    if (level === 'DEPARTMENT') {
        const dept = departments.find(d => d.id === id);
        if (dept?.isOffice) return { level: 'TOP' }; // Offices report straight to the GM, no Division above them.
        return dept?.divisionId ? { level: 'DIVISION', id: dept.divisionId } : { level: 'TOP' };
    }
    if (level === 'DIVISION') {
        const div = divisions.find(d => d.id === id);
        return div?.directorateId ? { level: 'DIRECTORATE', id: div.directorateId } : { level: 'TOP' };
    }
    return { level: 'TOP' }; // DIRECTORATE is the top org level under the GM in this system.
};

export const scopeFieldFor = (level: ScopeLevel): 'directorateId' | 'divisionId' | 'departmentId' | 'unitId' => {
    switch (level) {
        case 'DIRECTORATE': return 'directorateId';
        case 'DIVISION': return 'divisionId';
        case 'DEPARTMENT': return 'departmentId';
        case 'UNIT': return 'unitId';
    }
};

export interface ResolveReportsToArgs {
    level: ScopeLevel;
    id: string;
    isHead: boolean;
    departments: Department[];
    divisions: Division[];
    units: Unit[];
    allJobDescriptions: JobDescription[];
    excludeJdId?: string | null; // the JD being edited, so it never reports to itself
}

export const resolveReportsTo = ({
    level, id, isHead, departments, divisions, units, allJobDescriptions, excludeJdId,
}: ResolveReportsToArgs): { en: string; ar?: string } | null => {
    if (!id) return null;
    const target: ScopeRef = isHead
        ? parentScopeOf(level, id, departments, divisions, units)
        : { level, id };
    if (target.level === 'TOP') {
        return { en: 'General Manager', ar: 'المدير العام' };
    }
    const field = scopeFieldFor(target.level);
    const headJd = allJobDescriptions.find(j => j.isHead && (j as any)[field] === target.id && j.id !== excludeJdId);
    return headJd ? { en: headJd.title, ar: headJd.titleArabic || undefined } : null;
};
