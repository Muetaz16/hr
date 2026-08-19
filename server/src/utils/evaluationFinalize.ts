import { PrismaClient } from '@prisma/client';
import { OrgPlacement } from './evaluationHierarchy';
import { computeFinalScore } from './evaluationScoring';
import { awardEvaluationPoints } from './evaluationPoints';

const prisma = new PrismaClient();

export type FinalizeResult =
    | { status: 'finalized'; finalScore: number }
    | { status: 'refinalized'; finalScore: number; diff: number }
    | { status: 'skipped' };

// Shared by the manual finalize endpoint (evaluationController.ts's finalizeEvaluations)
// and the day-31+ auto-finalize cron (evaluationFinalizeCron.ts) — one place that
// creates the EvaluationFinalization row and credits the Evaluation Index, so both
// callers can never diverge on what "finalizing" actually does.
//
// force=true re-runs finalize even when already finalized — used only when SUPER_ADMIN
// edits an evaluation component after finalization (see reFinalizeEmployee below).
// Instead of the normal create+award, it updates the existing snapshot and awards only
// the delta, so evaluationPoints never double-counts the portion already credited.
export async function finalizeOneEmployee(
    employee: OrgPlacement & { id: string; fullName: string },
    month: string,
    finalizedById: string | null,
    isAuto: boolean,
    force: boolean = false
): Promise<FinalizeResult> {
    const already = await prisma.evaluationFinalization.findUnique({
        where: { employeeId_month: { employeeId: employee.id, month } },
    });
    if (already && !force) return { status: 'skipped' };

    const breakdown = await computeFinalScore(employee, month);

    if (already) {
        const diff = breakdown.finalScore - already.finalScore;
        await prisma.evaluationFinalization.update({
            where: { id: already.id },
            data: { finalScore: breakdown.finalScore, finalizedAt: new Date(), finalizedById, isAuto },
        });
        if (diff !== 0) await awardEvaluationPoints(employee.id, diff);
        return { status: 'refinalized', finalScore: breakdown.finalScore, diff };
    }

    await prisma.evaluationFinalization.create({
        data: { employeeId: employee.id, month, finalScore: breakdown.finalScore, finalizedById, isAuto },
    });
    await awardEvaluationPoints(employee.id, breakdown.finalScore);

    return { status: 'finalized', finalScore: breakdown.finalScore };
}

// Re-finalizes one already-finalized employee+month — called after SUPER_ADMIN edits
// any evaluation component post-finalization, so the frozen snapshot and Evaluation
// Index immediately reflect the correction. Best-effort: logs and swallows errors so a
// re-finalize failure never fails the edit request that triggered it.
export async function reFinalizeEmployee(employeeId: string, month: string, actorId: string | null): Promise<void> {
    try {
        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) return;
        await finalizeOneEmployee(employee as any, month, actorId, false, true);
    } catch (error) {
        console.error(`[EVAL] Failed to re-finalize employee ${employeeId} for ${month}:`, error);
    }
}
