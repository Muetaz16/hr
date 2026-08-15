import { evaluationService } from '../services/evaluationService';
import { getHREvaluation } from '../services/hrEvaluationService';
import { getRequiredLevels, LEVEL_LABEL, type EvalLevel, type OrgPlacement } from './evaluationHierarchy';
import type { HREvaluation, PersonnelEvaluation } from '../types';

// Only these levels store the 16 competency metrics that feed the
// Admin/Executive/Care category breakdown; GM/Chairman store a single 0-100
// score instead and are shown as their own evaluator line, not blended in —
// mirrors exactly how src/pages/Payroll.tsx already computes this.
export const METRIC_LEVELS: EvalLevel[] = ['UNIT', 'DEPARTMENT', 'DIVISION', 'DIRECTOR'];

export const ADMIN_CRITERIA: { key: string; labelKey: string; weight: number }[] = [
    { key: 'relationshipWithColleagues', labelKey: 'relationship_with_colleagues', weight: 5 },
    { key: 'teamworkParticipation', labelKey: 'teamwork_participation', weight: 5 },
    { key: 'workOrganization', labelKey: 'work_organization', weight: 5 },
    { key: 'communicationSkills', labelKey: 'written_communication', weight: 5 },
    { key: 'regulatoryCompliance', labelKey: 'regulatory_compliance', weight: 5 },
];
export const EXEC_CRITERIA: { key: string; labelKey: string; weight: number }[] = [
    { key: 'taskQuality', labelKey: 'quality_completion', weight: 7 },
    { key: 'timeCommitment', labelKey: 'time_commitment', weight: 7 },
    { key: 'organizationalCompliance', labelKey: 'organizational_compliance', weight: 7 },
    { key: 'problemSolving', labelKey: 'problem_solving', weight: 6 },
    { key: 'pressureHandling', labelKey: 'performance_pressure', weight: 7 },
    { key: 'continuousDevelopment', labelKey: 'continuous_development', weight: 6 },
];
export const CARE_CRITERIA: { key: string; labelKey: string; weight: number }[] = [
    { key: 'regulationsAdherence', labelKey: 'regulations_adherence', weight: 3 },
    { key: 'safetyAdherence', labelKey: 'safety_adherence', weight: 3 },
    { key: 'appearanceCommitment', labelKey: 'workplace_appearance', weight: 3 },
    { key: 'resourcePreservation', labelKey: 'resource_preservation', weight: 3 },
    { key: 'dataPrivacy', labelKey: 'data_privacy', weight: 3 },
];

// The bulk `*/month/:month` endpoints return raw DB-shaped records (unmapped),
// while the single-record endpoints rename fields to the frontend shape via
// the server's `mapOrgEvalFromDB`/`mapHREvalFromDB`. Callers that build maps
// from bulk data (e.g. EvaluationOverview) need the same renaming client-side
// so records from either source are interchangeable here.
export function mapRawOrgEval(raw: any): any {
    if (!raw) return raw;
    return {
        ...raw,
        relationshipWithColleagues: raw.relColleagues,
        teamworkParticipation: raw.teamwork,
        workOrganization: raw.workOrg,
        communicationSkills: raw.commSkills,
        regulatoryCompliance: raw.regCompliance,
        timeCommitment: raw.timeCommit,
        organizationalCompliance: raw.orgCompliance,
        problemSolving: raw.probSolving,
        continuousDevelopment: raw.contDev,
        regulationsAdherence: raw.regAdherence,
        appearanceCommitment: raw.appearance,
        resourcePreservation: raw.resPreservation,
    };
}

export function mapRawHREval(raw: any): any {
    if (!raw) return raw;
    return {
        ...raw,
        absenceWithoutPermission: raw.absenceUnauthorized,
        delayAndEarlyDeparture: raw.delayMinutes,
        unpaidLeave: raw.unpaidLeaves,
        annualPaidLeave: raw.annualPaidLeaves,
    };
}

const getEvalForLevel = (level: EvalLevel, empId: string, month: string) => {
    switch (level) {
        case 'UNIT': return evaluationService.getUnitEvaluation(empId, month);
        case 'DEPARTMENT': return evaluationService.getDeptEvaluation(empId, month);
        case 'DIVISION': return evaluationService.getDivisionEvaluation(empId, month);
        case 'DIRECTOR': return evaluationService.getDirectorEvaluation(empId, month);
        case 'GM': return evaluationService.getGMEvaluation(empId, month);
        case 'CHAIRMAN': return evaluationService.getChairmanEvaluation(empId, month);
    }
};

const calculateCategoryScore = (evalSource: any, criteria: { key: string }[]) => {
    if (!evalSource) return 0;
    return criteria.reduce((sum, c) => sum + (evalSource[c.key] || 0), 0);
};

const getWeightedScore = (aVal: number, bVal: number, aExists: boolean, bExists: boolean) => {
    if (aExists && bExists) return (aVal + bVal) / 2;
    if (aExists) return aVal;
    if (bExists) return bVal;
    return 0;
};

export interface EvaluatorRecord {
    level: EvalLevel;
    label: string;
    record: any | null;
}

export interface EvaluationBreakdown {
    employeeId: string;
    month: string;
    requiredLevels: EvalLevel[];
    evaluatorA: EvaluatorRecord | null;
    evaluatorB: EvaluatorRecord | null;
    // Raw metric records behind evaluatorA/B, only set when that evaluator's
    // level is metric-based (UNIT/DEPARTMENT/DIVISION/DIRECTOR) — used to
    // render the per-criterion side-by-side breakdown.
    metricA: any | null;
    metricB: any | null;
    hrEval: HREvaluation | null;
    hrScore: number; // /20
    adminScore: number; // /25
    executiveScore: number; // /40
    careScore: number; // /15
    persEval: PersonnelEvaluation | null;
    exceptionalScore: number; // ±20
    trainingScore: number; // +10
    trainingSummary: string;
    finalScore: number;
}

interface BuildParams {
    employeeId: string;
    month: string;
    requiredLevels: EvalLevel[];
    levelARecord: any | null;
    levelBRecord: any | null;
    hrEval: HREvaluation | null;
    persEval: PersonnelEvaluation | null;
}

// Pure calculation — no fetching. Same formula as Payroll.tsx's
// `handleGeneratePayroll`, generalized so it works for whichever two levels
// `getRequiredLevels` returns (not hardcoded to any specific pair).
export function buildEvaluationBreakdown(params: BuildParams): EvaluationBreakdown {
    const { employeeId, month, requiredLevels, levelARecord, levelBRecord, hrEval, persEval } = params;
    const [lvlA, lvlB] = requiredLevels;

    const metricA = lvlA && METRIC_LEVELS.includes(lvlA) ? levelARecord : null;
    const metricB = lvlB && METRIC_LEVELS.includes(lvlB) ? levelBRecord : null;

    const adminScore = getWeightedScore(
        calculateCategoryScore(metricA, ADMIN_CRITERIA), calculateCategoryScore(metricB, ADMIN_CRITERIA), !!metricA, !!metricB
    );
    const executiveScore = getWeightedScore(
        calculateCategoryScore(metricA, EXEC_CRITERIA), calculateCategoryScore(metricB, EXEC_CRITERIA), !!metricA, !!metricB
    );
    const careScore = getWeightedScore(
        calculateCategoryScore(metricA, CARE_CRITERIA), calculateCategoryScore(metricB, CARE_CRITERIA), !!metricA, !!metricB
    );

    // Exceptional Performance (±20%): each item prorated to its max, ±5% each.
    let exceptionalScore = 0;
    if (persEval) {
        exceptionalScore += 5 * Math.min(1, ((persEval as any).appreciationMessages || 0) / 3);
        exceptionalScore += 5 * Math.min(1, ((persEval as any).exceptionalAssignments || 0) / 30);
        exceptionalScore -= 5 * Math.min(1, ((persEval as any).warningMessages || 0) / 3);
        exceptionalScore -= 5 * Math.min(1, ((persEval as any).disciplinaryDeduction || 0) / 14);
    }

    // Training (+10%): flat per completed type (Yes/No fields), 3/3/2/2.
    let trainingScore = 0;
    const trainingList: string[] = [];
    if (persEval) {
        if ((persEval as any).specializedTraining) { trainingScore += 3; trainingList.push('Specialized'); }
        if ((persEval as any).supportingTraining) { trainingScore += 3; trainingList.push('Supporting'); }
        if ((persEval as any).languageTraining) { trainingScore += 2; trainingList.push('Language'); }
        if ((persEval as any).softwareTraining) { trainingScore += 2; trainingList.push('Software'); }
    }
    const trainingSummary = trainingList.join(', ');

    const hrScore = (hrEval as any)?.presenceScore || 0;
    // No ceiling — a strong month can legitimately exceed 100 (theoretical max 130
    // per the official form). Floored at 0 only as a sanity bound.
    const finalScore = Math.max(0, hrScore + adminScore + executiveScore + careScore + exceptionalScore + trainingScore);

    return {
        employeeId, month, requiredLevels,
        evaluatorA: lvlA ? { level: lvlA, label: LEVEL_LABEL[lvlA], record: levelARecord } : null,
        evaluatorB: lvlB ? { level: lvlB, label: LEVEL_LABEL[lvlB], record: levelBRecord } : null,
        metricA, metricB,
        hrEval, hrScore, adminScore, executiveScore, careScore,
        persEval, exceptionalScore, trainingScore, trainingSummary,
        finalScore,
    };
}

// Live single-employee fetch — always current, never dependent on a monthly
// "Compile Report" having run. Used by the Employee Evaluation Details view
// (both the HR/manager drill-in and the employee self-service page).
export async function fetchEvaluationBreakdown(
    employee: OrgPlacement & { id: string },
    month: string
): Promise<EvaluationBreakdown> {
    const requiredLevels = getRequiredLevels(employee);
    const [lvlA, lvlB] = requiredLevels;
    const [levelARecord, levelBRecord, persEval, hrEval] = await Promise.all([
        lvlA ? getEvalForLevel(lvlA, employee.id, month) : Promise.resolve(null),
        lvlB ? getEvalForLevel(lvlB, employee.id, month) : Promise.resolve(null),
        evaluationService.getPersonnelEvaluation(employee.id, month),
        getHREvaluation(employee.id, month),
    ]);
    return buildEvaluationBreakdown({
        employeeId: employee.id, month, requiredLevels, levelARecord, levelBRecord, hrEval, persEval,
    });
}
