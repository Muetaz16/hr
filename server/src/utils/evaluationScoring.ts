import { PrismaClient } from '@prisma/client';
import { getRequiredLevels, EvalLevel, OrgPlacement } from './evaluationHierarchy';

import { prisma } from '../lib/prisma';

// Server-side mirror of src/utils/evaluationScoring.ts's buildEvaluationBreakdown() —
// frontend/backend code isn't shared in this repo (same pattern as evaluationHierarchy.ts
// and presenceScoring.ts). Used only by the finalize action, which needs a trustworthy
// server-computed finalScore rather than whatever a client happens to send.
const METRIC_LEVELS: EvalLevel[] = ['UNIT', 'DEPARTMENT', 'DIVISION', 'DIRECTOR'];

// Raw DB field names (unmapped — matches the frontend's ADMIN_CRITERIA/EXEC_CRITERIA/
// CARE_CRITERIA keys after mapRawOrgEval renaming, listed here in their original form).
const ADMIN_FIELDS = ['relColleagues', 'teamwork', 'workOrg', 'commSkills', 'regCompliance'];
const EXEC_FIELDS = ['taskQuality', 'timeCommit', 'orgCompliance', 'probSolving', 'pressureHandling', 'contDev'];
const CARE_FIELDS = ['regAdherence', 'safetyAdherence', 'appearance', 'resPreservation', 'dataPrivacy'];

const MODEL_FOR_LEVEL: Record<string, string> = {
    UNIT: 'unitEvaluation',
    DEPARTMENT: 'departmentEvaluation',
    DIVISION: 'divisionEvaluation',
    DIRECTOR: 'directorEvaluation',
    GM: 'gMEvaluation',
    CHAIRMAN: 'chairmanEvaluation',
};

function sumFields(record: any, fields: string[]): number {
    if (!record) return 0;
    return fields.reduce((sum, f) => sum + (record[f] || 0), 0);
}

function weighted(aVal: number, bVal: number, aExists: boolean, bExists: boolean): number {
    if (aExists && bExists) return (aVal + bVal) / 2;
    if (aExists) return aVal;
    if (bExists) return bVal;
    return 0;
}

async function getEvalRecord(level: EvalLevel, employeeId: string, month: string): Promise<any | null> {
    const modelName = MODEL_FOR_LEVEL[level];
    if (!modelName) return null;
    return (prisma as any)[modelName].findFirst({ where: { employeeId, month } });
}

export interface ServerEvaluationBreakdown {
    employeeId: string;
    month: string;
    requiredLevels: EvalLevel[];
    hrScore: number;
    adminScore: number;
    executiveScore: number;
    careScore: number;
    exceptionalScore: number;
    trainingScore: number;
    finalScore: number;
}

export async function computeFinalScore(employee: OrgPlacement & { id: string }, month: string): Promise<ServerEvaluationBreakdown> {
    const requiredLevels = getRequiredLevels(employee);
    const [lvlA, lvlB] = requiredLevels;

    const [levelARecord, levelBRecord, persEval, hrEval] = await Promise.all([
        lvlA ? getEvalRecord(lvlA, employee.id, month) : Promise.resolve(null),
        lvlB ? getEvalRecord(lvlB, employee.id, month) : Promise.resolve(null),
        prisma.personnelEvaluation.findFirst({ where: { employeeId: employee.id, month } }),
        prisma.hREvaluation.findFirst({ where: { employeeId: employee.id, month } }),
    ]);

    const metricA = lvlA && METRIC_LEVELS.includes(lvlA) ? levelARecord : null;
    const metricB = lvlB && METRIC_LEVELS.includes(lvlB) ? levelBRecord : null;

    const adminScore = weighted(sumFields(metricA, ADMIN_FIELDS), sumFields(metricB, ADMIN_FIELDS), !!metricA, !!metricB);
    const executiveScore = weighted(sumFields(metricA, EXEC_FIELDS), sumFields(metricB, EXEC_FIELDS), !!metricA, !!metricB);
    const careScore = weighted(sumFields(metricA, CARE_FIELDS), sumFields(metricB, CARE_FIELDS), !!metricA, !!metricB);

    // Exceptional Performance (±20%): each item prorated to its max, ±5% each.
    let exceptionalScore = 0;
    if (persEval) {
        exceptionalScore += 5 * Math.min(1, (persEval.appreciationMessages || 0) / 3);
        exceptionalScore += 5 * Math.min(1, (persEval.exceptionalAssignments || 0) / 30);
        exceptionalScore -= 5 * Math.min(1, (persEval.warningMessages || 0) / 3);
        exceptionalScore -= 5 * Math.min(1, (persEval.disciplinaryDeduction || 0) / 14);
    }

    // Training (+10%): flat per completed type (Yes/No fields), 3/3/2/2.
    let trainingScore = 0;
    if (persEval) {
        if (persEval.specializedTraining) trainingScore += 3;
        if (persEval.supportingTraining) trainingScore += 3;
        if (persEval.languageTraining) trainingScore += 2;
        if (persEval.softwareTraining) trainingScore += 2;
    }

    const hrScore = hrEval?.presenceScore || 0;
    // No ceiling — a strong month can legitimately exceed 100. Floored at 0 only as a sanity bound.
    const finalScore = Math.max(0, hrScore + adminScore + executiveScore + careScore + exceptionalScore + trainingScore);

    return {
        employeeId: employee.id, month, requiredLevels,
        hrScore, adminScore, executiveScore, careScore, exceptionalScore, trainingScore, finalScore,
    };
}
