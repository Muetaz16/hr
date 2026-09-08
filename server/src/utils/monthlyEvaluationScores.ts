// The monthly evaluation scores, computed once and consumed by two documents.
//
// Extracted verbatim from payrollController.getMonthlyEvaluationDoc, which was the only place that
// knew how to turn the raw evaluation records into the five category percentages. The payslip needs
// exactly the same numbers in its PERFORMANCE EVALUATION box, and two copies of a scoring formula
// is how the form and the payslip start disagreeing about the same employee in the same month.
//
// Everything is computed LIVE from the source records — the HR presence evaluation, the two manager
// evaluations, and the Personnel (exceptional / training) record — so it reflects what was actually
// submitted, independent of whether any payroll report has been compiled.
//
// Note for the payslip: these scores are DISPLAY ONLY. They never alter an amount. That was a
// deliberate, confirmed decision, and the payroll engine takes no evaluation input at all.
import { PrismaClient } from '@prisma/client';

export const METRIC_KEYS = [
    'relColleagues', 'teamwork', 'workOrg', 'commSkills', 'regCompliance',
    'taskQuality', 'timeCommit', 'orgCompliance', 'probSolving', 'pressureHandling', 'contDev',
    'regAdherence', 'safetyAdherence', 'appearance', 'resPreservation', 'dataPrivacy',
] as const;

const ADMIN_KEYS = ['relColleagues', 'teamwork', 'workOrg', 'commSkills', 'regCompliance'];
const EXEC_KEYS = ['taskQuality', 'timeCommit', 'orgCompliance', 'probSolving', 'pressureHandling', 'contDev'];
const CARE_KEYS = ['regAdherence', 'safetyAdherence', 'appearance', 'resPreservation', 'dataPrivacy'];

export const pickCriteria = (src: any): Record<string, number | null | undefined> => {
    const out: Record<string, number | null | undefined> = {};
    if (!src) return out;
    for (const k of METRIC_KEYS) out[k] = src[k];
    return out;
};

/**
 * Average the two evaluators' scores for one criterion, following the same "one present → use it,
 * none present → null" rule the payroll compile uses.
 */
export const combine = (a: any, b: any): number | null => {
    const an = a ?? null, bn = b ?? null;
    if (an !== null && bn !== null) return (an + bn) / 2;
    if (an !== null) return an;
    if (bn !== null) return bn;
    return null;
};

export interface PresenceBreakdown {
    absence: number | null;
    delay: number | null;
    emergency: number | null;
    unpaid: number | null;
    annual: number | null;
}

export interface MonthlyEvaluationScores {
    /** True when nothing at all has been submitted for this employee and month. */
    empty: boolean;

    presence: PresenceBreakdown;
    presenceTotal: number | null;
    adminScore: number | null;
    execScore: number | null;
    careScore: number | null;
    exceptionalScore: number;
    trainingScore: number;
    finalScore: number | null;

    /** Per-criterion averages, for the evaluation form's own grid. */
    finalCriteria: Record<string, number | null>;
    directEval: any | null;
    nextEval: any | null;
    directSupervisorName: string;
    nextAuthorityName: string;
    personnel: any | null;
    hr: any | null;
}

/**
 * Loads and scores one employee's month.
 *
 * `prisma` is passed in rather than imported so the payroll compute can call this inside its own
 * client without pulling in payrollController's module-load side effects.
 */
export const loadMonthlyEvaluationScores = async (
    prisma: PrismaClient,
    employeeId: string,
    month: string,
): Promise<MonthlyEvaluationScores> => {
    const [hr, personnel, unit, dept, division, director] = await Promise.all([
        prisma.hREvaluation.findFirst({ where: { employeeId, month } }),
        prisma.personnelEvaluation.findFirst({ where: { employeeId, month } }),
        prisma.unitEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
        prisma.departmentEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
        prisma.divisionEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
        prisma.directorEvaluation.findFirst({ where: { employeeId, month }, include: { submittedBy: { select: { fullName: true } } } }),
    ]);

    // The two managers who actually evaluated, ordered shallow -> deep (direct manager, then skip-level).
    const presentMetricEvals = [unit, dept, division, director].filter(Boolean) as any[];
    const directEvalRec = presentMetricEvals[0] || null;
    const nextEvalRec = presentMetricEvals[1] || null;

    // Per-criterion FINAL = average of the two evaluators.
    const finalCriteria: Record<string, number | null> = {};
    for (const k of METRIC_KEYS) finalCriteria[k] = combine(directEvalRec?.[k], nextEvalRec?.[k]);
    const categorySum = (keys: string[]): number | null => {
        const vals = keys.map(k => finalCriteria[k]).filter(v => v !== null) as number[];
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };
    const adminScore = categorySum(ADMIN_KEYS);
    const execScore = categorySum(EXEC_KEYS);
    const careScore = categorySum(CARE_KEYS);

    // Presence per-item points, from the HR evaluation's real counts.
    const h: any = hr || {};
    const presence: PresenceBreakdown = hr ? {
        absence: Math.max(0, 7 - (h.absenceUnauthorized || 0)),
        delay: Math.max(0, 7 - ((h.delayMinutes || 0) / 180 * 7)),
        emergency: Math.max(0, 2 - ((h.emergencyLeaves || 0) / 3 * 2)),
        unpaid: Math.max(0, 2 - ((h.unpaidLeaves || 0) / 14 * 2)),
        annual: Math.max(0, 2 - ((h.annualPaidLeaves || 0) / 14 * 2)),
    } : { absence: null, delay: null, emergency: null, unpaid: null, annual: null };
    const presenceTotal = hr
        ? (presence.absence! + presence.delay! + presence.emergency! + presence.unpaid! + presence.annual!)
        : null;

    // Exceptional performance (+/-20%) and Training (+10%) contributions.
    let exceptionalScore = 0;
    let trainingScore = 0;
    if (personnel) {
        exceptionalScore += 5 * Math.min(1, (personnel.appreciationMessages || 0) / 3);
        exceptionalScore += 5 * Math.min(1, (personnel.exceptionalAssignments || 0) / 30);
        exceptionalScore -= 5 * Math.min(1, (personnel.warningMessages || 0) / 3);
        exceptionalScore -= 5 * Math.min(1, (personnel.disciplinaryDeduction || 0) / 14);
        if (personnel.specializedTraining) trainingScore += 3;
        if (personnel.supportingTraining) trainingScore += 3;
        if (personnel.languageTraining) trainingScore += 2;
        if (personnel.softwareTraining) trainingScore += 2;
    }

    const hasAnyData = !!(hr || personnel || directEvalRec || nextEvalRec);
    const finalScore = hasAnyData
        ? (presenceTotal || 0) + (adminScore || 0) + (execScore || 0) + (careScore || 0) + exceptionalScore + trainingScore
        : null;

    return {
        empty: !hasAnyData,
        presence, presenceTotal, adminScore, execScore, careScore,
        exceptionalScore, trainingScore, finalScore,
        finalCriteria,
        directEval: directEvalRec,
        nextEval: nextEvalRec,
        directSupervisorName: directEvalRec?.submittedBy?.fullName || '',
        nextAuthorityName: nextEvalRec?.submittedBy?.fullName || '',
        personnel, hr,
    };
};

/**
 * The seven figures a PayrollLine snapshots for the payslip's PERFORMANCE EVALUATION box.
 *
 * Snapshotted rather than read live at print time for the same reason every other input is: the
 * payslip is signed for a specific month, and a manager submitting a late evaluation must not
 * silently change a document that has already been handed over.
 */
export const evaluationSnapshot = (s: MonthlyEvaluationScores) => ({
    presenceScore: s.presenceTotal,
    execScore: s.execScore,
    adminScore: s.adminScore,
    careScore: s.careScore,
    trainingScore: s.trainingScore,
    evaluationTotal: s.finalScore,
});
