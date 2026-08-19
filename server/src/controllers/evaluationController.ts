import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { canEvaluate, EvalLevel, OrgPlacement } from '../utils/evaluationHierarchy';
import { computeAndStorePresence } from '../utils/presenceScoring';
import { finalizeOneEmployee, reFinalizeEmployee } from '../utils/evaluationFinalize';

const prisma = new PrismaClient();

// Helper to map DB HR Evaluation to Frontend format
const mapHREvalFromDB = (evalData: any) => {
    if (!evalData) return null;
    return {
        ...evalData,
        absenceWithoutPermission: evalData.absenceUnauthorized,
        delayAndEarlyDeparture: evalData.delayMinutes,
        unpaidLeave: evalData.unpaidLeaves,
        annualPaidLeave: evalData.annualPaidLeaves,
        absenceScoreValue: evalData.absenceScore,
        delayScoreValue: evalData.delayScore,
        emergencyScoreValue: evalData.emergencyScore,
        unpaidScoreValue: evalData.unpaidScore,
        violationScoreValue: evalData.violationScore,
    };
};

// Helper to map Frontend HR Evaluation to DB format
const mapHREvalToDB = (data: any, submittedById: string) => {
    return {
        employeeId: data.employeeId,
        month: data.month,
        absenceUnauthorized: data.absenceWithoutPermission || 0,
        delayMinutes: data.delayAndEarlyDeparture || 0,
        emergencyLeaves: data.emergencyLeaves || 0,
        unpaidLeaves: data.unpaidLeave || 0,
        annualPaidLeaves: data.annualPaidLeave || 0,
        presenceScore: data.presenceScore || 20,
        status: data.status || 'draft',
        submittedAt: new Date(),
        submittedById
    };
};

// Helper to map DB Org (Unit/Dept/Division/Director) Evaluation to Frontend format
const mapOrgEvalFromDB = (evalData: any) => {
    if (!evalData) return null;
    return {
        ...evalData,
        relationshipWithColleagues: evalData.relColleagues,
        teamworkParticipation: evalData.teamwork,
        workOrganization: evalData.workOrg,
        communicationSkills: evalData.commSkills,
        regulatoryCompliance: evalData.regCompliance,
        timeCommitment: evalData.timeCommit,
        organizationalCompliance: evalData.orgCompliance,
        problemSolving: evalData.probSolving,
        continuousDevelopment: evalData.contDev,
        regulationsAdherence: evalData.regAdherence,
        appearanceCommitment: evalData.appearance,
        resourcePreservation: evalData.resPreservation
    };
};

const mapOrgEvalToDB = (data: any, submittedById: string) => {
    return {
        employeeId: data.employeeId,
        month: data.month,
        relColleagues: data.relationshipWithColleagues,
        teamwork: data.teamworkParticipation,
        workOrg: data.workOrganization,
        commSkills: data.communicationSkills,
        regCompliance: data.regulatoryCompliance,
        taskQuality: data.taskQuality,
        timeCommit: data.timeCommitment,
        orgCompliance: data.organizationalCompliance,
        probSolving: data.problemSolving,
        pressureHandling: data.pressureHandling,
        contDev: data.continuousDevelopment,
        regAdherence: data.regulationsAdherence,
        safetyAdherence: data.safetyAdherence,
        appearance: data.appearanceCommitment,
        resPreservation: data.resourcePreservation,
        dataPrivacy: data.dataPrivacy,
        submittedById
    };
};

// Sum of the 16 weighted competency metrics (0..80). Computed server-side so the
// stored score can never diverge from the submitted metric values.
const sumMetrics = (dbData: any): number => {
    const keys = [
        'relColleagues', 'teamwork', 'workOrg', 'commSkills', 'regCompliance',
        'taskQuality', 'timeCommit', 'orgCompliance', 'probSolving', 'pressureHandling', 'contDev',
        'regAdherence', 'safetyAdherence', 'appearance', 'resPreservation', 'dataPrivacy'
    ];
    return keys.reduce((sum, k) => sum + (Number(dbData[k]) || 0), 0);
};

const checkEvaluationPeriod = async (month: string, departmentId?: string | null) => {
    const periods = await prisma.evaluationPeriod.findMany({
        where: { month: String(month), enabled: true }
    });

    if (periods.length === 0) return false;

    // If any period is "global" (no departmentId), then it's enabled for everyone
    if (periods.some(p => !p.departmentId)) return true;

    // Otherwise, check if specifically enabled for this department
    if (departmentId && periods.some(p => p.departmentId === departmentId)) return true;

    return false;
};

// Once an employee's evaluation for a month has been finalized (EvaluationFinalization
// row exists — see finalizeEvaluations below), every evaluation table for that
// employee+month becomes immutable. Checked by every save handler in this file.
const isMonthFinalized = async (employeeId: string, month: string): Promise<boolean> => {
    const row = await prisma.evaluationFinalization.findUnique({
        where: { employeeId_month: { employeeId, month } }
    });
    return !!row;
};

// Resolve a submitter's org placement (role + scope ids) from their user + linked
// employee record. User rows only carry unit/department, so division/directorate
// come from the employee record.
export const resolveManagerPlacement = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
    if (!user) return null;
    const emp: any = (user as any).employee;
    const placement: OrgPlacement = {
        role: user.role,
        unitId: (user as any).unitId ?? emp?.unitId ?? null,
        departmentId: user.departmentId ?? emp?.departmentId ?? null,
        divisionId: emp?.divisionId ?? null,
        directorateId: emp?.directorateId ?? null,
    };
    return { user, placement };
};

// Enforce the skip-level rule: this submitter may evaluate this target at `level`.
// Returns an error message to send (403), or null when allowed.
//
// `existingSubmitterId` is the submittedById of any record already saved for this
// employee+month+level (or undefined/null if none) — lets HR_MANAGER/PERSONNEL stand
// in for a manager who never submitted, without ever overwriting a real manager's
// work: they may create a fresh record, or fix their own prior stand-in, but not touch
// a record some other (non-HR) submitter created.
const checkCanEvaluate = async (
    submitter: { user: any; placement: OrgPlacement },
    targetId: string,
    level: EvalLevel,
    existingSubmitterId?: string | null
): Promise<string | null> => {
    const target = await prisma.employee.findUnique({
        where: { id: targetId },
        select: { userId: true, role: true, unitId: true, departmentId: true, divisionId: true, directorateId: true }
    });
    if (!target) return 'Employee not found';
    if (target.userId && target.userId === submitter.user.id) return 'You cannot evaluate yourself';

    if (submitter.user.role === 'SUPER_ADMIN') return null;

    if (['HR_MANAGER', 'PERSONNEL'].includes(submitter.user.role)) {
        if (!existingSubmitterId) return null;
        const existingSubmitter = await prisma.user.findUnique({ where: { id: existingSubmitterId }, select: { role: true } });
        if (!existingSubmitter || ['HR_MANAGER', 'PERSONNEL'].includes(existingSubmitter.role)) return null;
    }

    if (!canEvaluate(submitter.placement, target as any, level)) {
        return 'You are not one of the two required evaluators for this employee';
    }
    return null;
};

// Roles that may read any employee's evaluation data (they already see the
// full roster in the frontend evaluation screens).
const ADMIN_LIKE_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'];

// This employee's own id, if `userId` is linked to one — mirrors the same
// User.userId -> Employee lookup `/employees/me` uses, so "viewing my own
// evaluation" resolves consistently across the app.
const resolveOwnEmployeeId = async (userId: string): Promise<string | null> => {
    const emp = await prisma.employee.findUnique({ where: { userId } });
    return emp?.id ?? null;
};

// Read-access gate for the single-record GET endpoints: an admin-like role,
// the employee viewing their own record, or (for hierarchy-governed levels)
// one of the two legitimate evaluators may read it. Everyone else is denied —
// closes a gap where any authenticated user could previously read any
// employee's evaluation by passing an arbitrary `employeeId`.
const checkCanViewEvaluation = async (
    requesterUser: any,
    targetEmployeeId: string,
    level?: EvalLevel
): Promise<boolean> => {
    if (ADMIN_LIKE_ROLES.includes(requesterUser.role)) return true;
    const ownEmployeeId = await resolveOwnEmployeeId(requesterUser.id);
    if (ownEmployeeId && ownEmployeeId === targetEmployeeId) return true;
    if (!level) return false;
    const submitter = await resolveManagerPlacement(requesterUser.id);
    if (!submitter) return false;
    const target = await prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        select: { role: true, unitId: true, departmentId: true, divisionId: true, directorateId: true }
    });
    if (!target) return false;
    return canEvaluate(submitter.placement, target as any, level);
};

// --- HR Evaluations ---
export const getHREvaluation = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        if (!employeeId || !month) return res.status(400).json({ error: 'Missing params' });

        const allowed = await checkCanViewEvaluation((req as any).user, String(employeeId));
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });

        const evalData = await prisma.hREvaluation.findFirst({
            where: {
                employeeId: String(employeeId),
                month: String(month)
            }
        });

        if (evalData) {
            return res.json(mapHREvalFromDB(evalData));
        }

        res.json(null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch HR evaluation' });
    }
};
export const deleteHREvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.hREvaluation.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

export const getHREvaluationsByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const evals = await prisma.hREvaluation.findMany({ where: { month } });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch HR evaluations' });
    }
};

export const saveHREvaluation = async (req: Request, res: Response) => {
    try {
        const { id, submittedBy, ...data } = req.body;
        const { employeeId, month } = data;
        const submittedById = (req as any).user?.id || submittedBy;

        // Verify submitter exists (to avoid FK error if DB was reset)
        const submitterExists = await prisma.user.findUnique({ where: { id: submittedById } });
        if (!submitterExists) {
            return res.status(400).json({ error: 'Submitter account not found. Please logout and login again.' });
        }

        const finalized = await isMonthFinalized(employeeId, month);
        if (finalized && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'This employee\'s evaluation for this month has already been finalized and can no longer be edited.' });
        }

        // Check if evaluation period is enabled
        const isEnabled = await checkEvaluationPeriod(month, submitterExists.departmentId);
        if (!isEnabled && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        const dbData = mapHREvalToDB(data, submittedById);

        const existing = await prisma.hREvaluation.findFirst({
            where: { employeeId, month }
        });

        const result = existing
            ? await prisma.hREvaluation.update({ where: { id: existing.id }, data: dbData })
            : await prisma.hREvaluation.create({ data: dbData });

        if (finalized) await reFinalizeEmployee(employeeId, month, submittedById);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save HR evaluation' });
    }
};

// Manual safety-net for the automatic Presence scoring (server/src/jobs/presenceScoreCron.ts):
// lets HR force a refresh for one employee or the whole month — before day 25 (the presence
// window hasn't fully closed yet) or to retry after the attendance system was unreachable —
// even overriding an already-submitted record, since this is an explicit user action.
export const recomputePresence = async (req: Request, res: Response) => {
    try {
        const { month, employeeId } = req.body;
        if (!month) return res.status(400).json({ error: 'Missing month' });

        const submittedById = (req as any).user?.id || null;
        const isSuperAdmin = (req as any).user?.role === 'SUPER_ADMIN';
        const employees = await prisma.employee.findMany({
            where: { bioId: { not: null }, ...(employeeId ? { id: String(employeeId) } : {}) },
            select: { id: true, bioId: true, fullName: true },
        });

        const results = [];
        for (const emp of employees) {
            const result = await computeAndStorePresence({
                employeeId: emp.id, bioId: emp.bioId as number, month: String(month), submittedById, force: true,
                bypassFinalized: isSuperAdmin,
            });
            if (result.status === 'stored' && result.wasFinalized) {
                await reFinalizeEmployee(emp.id, String(month), submittedById);
            }
            results.push({ employeeId: emp.id, fullName: emp.fullName, ...result });
        }

        res.json({
            month,
            requested: employees.length,
            stored: results.filter(r => r.status === 'stored').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            results,
        });
    } catch (error) {
        console.error('Error recomputing presence:', error);
        res.status(500).json({ error: 'Failed to recompute presence scores' });
    }
};

// -----------------------------------------------------------------------------
// Generic org-evaluation handlers (Unit / Department / Division / Director)
// Each of these levels stores the 16 competency metrics; the total (0..80) is
// computed server-side. `level` is the skip-level role that owns the record.
// -----------------------------------------------------------------------------
type MetricModel = 'unitEvaluation' | 'departmentEvaluation' | 'divisionEvaluation' | 'directorEvaluation';

const makeGetOrgEval = (model: MetricModel, level: EvalLevel) => async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        if (!employeeId || !month) return res.status(400).json({ error: 'Missing params' });

        const allowed = await checkCanViewEvaluation((req as any).user, String(employeeId), level);
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });

        const evalData = await (prisma as any)[model].findFirst({
            where: { employeeId: String(employeeId), month: String(month) }
        });
        return res.json(evalData ? mapOrgEvalFromDB(evalData) : null);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch ${model}` });
    }
};

const makeGetOrgEvalsByMonth = (model: MetricModel) => async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const evals = await (prisma as any)[model].findMany({ where: { month } });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch ${model}` });
    }
};

const makeDeleteOrgEval = (model: MetricModel) => async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await (prisma as any)[model].delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

const makeSaveOrgEval = (model: MetricModel, level: EvalLevel) => async (req: Request, res: Response) => {
    try {
        const { id, submittedBy, ...data } = req.body;
        const { employeeId, month } = data;
        const submittedById = (req as any).user?.id || submittedBy;
        if (!submittedById) return res.status(400).json({ error: 'Submitter ID is missing' });

        const submitter = await resolveManagerPlacement(submittedById);
        if (!submitter) {
            return res.status(400).json({ error: 'Submitter account not found. Please logout and login again.' });
        }

        const finalized = await isMonthFinalized(employeeId, month);
        if (finalized && submitter.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'This employee\'s evaluation for this month has already been finalized and can no longer be edited.' });
        }

        // Evaluation window must be open (Super Admin bypasses)
        const isEnabled = await checkEvaluationPeriod(month, submitter.user.departmentId);
        if (!isEnabled && submitter.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        // Skip-level rule: only the two required evaluators may score this employee
        // (HR/Personnel may stand in only when nobody else has submitted yet — see
        // checkCanEvaluate). Fetched here (rather than after) so it can be passed in.
        const existing = await (prisma as any)[model].findFirst({ where: { employeeId, month } });
        const denied = await checkCanEvaluate(submitter, employeeId, level, existing?.submittedById);
        if (denied) return res.status(403).json({ error: denied });

        const mapped = mapOrgEvalToDB(data, submittedById);
        const totalScore = sumMetrics(mapped);
        const dbData: any = {
            ...mapped,
            submittedAt: new Date(),
            totalScore,
            comments: data.comments
        };
        // The Director model carries the metric total under `finalScore` too, and is
        // marked locked/lockedAt the moment the Directorate Head submits it — reviving
        // this field's original intent (Dashboard.tsx/Tasks.tsx read it to know whether
        // the Director's own evaluation is done) after it went dead when the old
        // separate "final approval" endpoint was retired.
        if (model === 'directorEvaluation') {
            dbData.finalScore = totalScore;
            dbData.locked = true;
            dbData.lockedAt = new Date();
            // DirectorEvaluation has no comments/submittedAt/totalScore columns (only
            // finalScore, already set above from the same value) — these three generic
            // fields were silently breaking every director-evaluation create/update.
            delete dbData.comments;
            delete dbData.submittedAt;
            delete dbData.totalScore;
        }

        const result = existing
            ? await (prisma as any)[model].update({ where: { id: existing.id }, data: dbData })
            : await (prisma as any)[model].create({ data: dbData });

        if (finalized) await reFinalizeEmployee(employeeId, month, submittedById);

        res.json(result);
    } catch (error: any) {
        console.error(`[EVAL][ERROR] save ${model}:`, error.message);
        res.status(500).json({ error: `Failed to save ${model}` });
    }
};

// Unit
export const getUnitEvaluation = makeGetOrgEval('unitEvaluation', 'UNIT');
export const getUnitEvaluationsByMonth = makeGetOrgEvalsByMonth('unitEvaluation');
export const saveUnitEvaluation = makeSaveOrgEval('unitEvaluation', 'UNIT');
export const deleteUnitEvaluation = makeDeleteOrgEval('unitEvaluation');

// Department
export const getDeptEvaluation = makeGetOrgEval('departmentEvaluation', 'DEPARTMENT');
export const getDeptEvaluationsByMonth = makeGetOrgEvalsByMonth('departmentEvaluation');
export const saveDeptEvaluation = makeSaveOrgEval('departmentEvaluation', 'DEPARTMENT');
export const deleteDeptEvaluation = makeDeleteOrgEval('departmentEvaluation');

// Division
export const getDivisionEvaluation = makeGetOrgEval('divisionEvaluation', 'DIVISION');
export const getDivisionEvaluationsByMonth = makeGetOrgEvalsByMonth('divisionEvaluation');
export const saveDivisionEvaluation = makeSaveOrgEval('divisionEvaluation', 'DIVISION');
export const deleteDivisionEvaluation = makeDeleteOrgEval('divisionEvaluation');

// Director (Directorate head)
export const getDirectorEvaluation = makeGetOrgEval('directorEvaluation', 'DIRECTOR');
export const getDirectorEvaluationsByMonth = makeGetOrgEvalsByMonth('directorEvaluation');
export const saveDirectorEvaluation = makeSaveOrgEval('directorEvaluation', 'DIRECTOR');
export const deleteDirectorEvaluation = makeDeleteOrgEval('directorEvaluation');

// Retained for backwards compatibility with the old "final approval" endpoint.
// Locking is no longer part of the flow; this simply stamps the record.
export const lockEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        await prisma.directorEvaluation.update({
            where: { id },
            data: { locked: true, lockedAt: new Date() }
        });
        res.json({ message: 'Evaluation locked' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to lock evaluation' });
    }
};

// -----------------------------------------------------------------------------
// Score-only handlers (GM / Chairman) — these top levels store a single 0..100
// score plus comments (used when evaluating a Head of Division / Directorate).
// -----------------------------------------------------------------------------
type ScoreModel = 'gMEvaluation' | 'chairmanEvaluation';

const makeGetScoreEval = (model: ScoreModel, level: EvalLevel) => async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        if (!employeeId || !month) return res.status(400).json({ error: 'Missing params' });

        const allowed = await checkCanViewEvaluation((req as any).user, String(employeeId), level);
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });

        const evalData = await (prisma as any)[model].findFirst({
            where: { employeeId: String(employeeId), month: String(month) }
        });
        res.json(evalData || null);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch ${model}` });
    }
};

const makeGetScoreEvalsByMonth = (model: ScoreModel) => async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const evals = await (prisma as any)[model].findMany({ where: { month } });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: `Failed to fetch ${model}` });
    }
};

const makeDeleteScoreEval = (model: ScoreModel) => async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await (prisma as any)[model].delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

const makeSaveScoreEval = (model: ScoreModel, level: EvalLevel) => async (req: Request, res: Response) => {
    try {
        const { id, submittedBy, ...data } = req.body;
        const { employeeId, month } = data;
        const submittedById = (req as any).user?.id || submittedBy;
        if (!submittedById) return res.status(400).json({ error: 'Submitter ID is missing' });

        const submitter = await resolveManagerPlacement(submittedById);
        if (!submitter) {
            return res.status(400).json({ error: 'Submitter account not found. Please logout and login again.' });
        }

        const finalized = await isMonthFinalized(employeeId, month);
        if (finalized && submitter.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'This employee\'s evaluation for this month has already been finalized and can no longer be edited.' });
        }

        const isEnabled = await checkEvaluationPeriod(month, submitter.user.departmentId);
        if (!isEnabled && submitter.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        const existing = await (prisma as any)[model].findFirst({ where: { employeeId, month } });
        const denied = await checkCanEvaluate(submitter, employeeId, level, existing?.submittedById);
        if (denied) return res.status(403).json({ error: denied });

        const dbData: any = {
            employeeId,
            month,
            finalScore: Number(data.finalScore) || 0,
            comments: data.comments,
            submittedById
        };

        const result = existing
            ? await (prisma as any)[model].update({ where: { id: existing.id }, data: dbData })
            : await (prisma as any)[model].create({ data: dbData });

        if (finalized) await reFinalizeEmployee(employeeId, month, submittedById);

        res.json(result);
    } catch (error: any) {
        console.error(`[EVAL][ERROR] save ${model}:`, error.message);
        res.status(500).json({ error: `Failed to save ${model}` });
    }
};

// GM
export const getGMEvaluation = makeGetScoreEval('gMEvaluation', 'GM');
export const getGMEvaluationsByMonth = makeGetScoreEvalsByMonth('gMEvaluation');
export const saveGMEvaluation = makeSaveScoreEval('gMEvaluation', 'GM');
export const deleteGMEvaluation = makeDeleteScoreEval('gMEvaluation');

// Chairman
export const getChairmanEvaluation = makeGetScoreEval('chairmanEvaluation', 'CHAIRMAN');
export const getChairmanEvaluationsByMonth = makeGetScoreEvalsByMonth('chairmanEvaluation');
export const saveChairmanEvaluation = makeSaveScoreEval('chairmanEvaluation', 'CHAIRMAN');
export const deleteChairmanEvaluation = makeDeleteScoreEval('chairmanEvaluation');

// --- Personnel Evaluations ---
export const getPersonnelEvaluation = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        if (!employeeId || !month) return res.status(400).json({ error: 'Missing params' });

        const allowed = await checkCanViewEvaluation((req as any).user, String(employeeId));
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });

        const evalData = await prisma.personnelEvaluation.findFirst({
            where: {
                employeeId: String(employeeId),
                month: String(month)
            }
        });
        res.json(evalData || null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Personnel evaluation' });
    }
};

export const getPersonnelEvaluationsByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const evals = await prisma.personnelEvaluation.findMany({
            where: { month }
        });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Personnel evaluations' });
    }
};

export const savePersonnelEvaluation = async (req: Request, res: Response) => {
    try {
        const { id, submittedBy, ...data } = req.body;
        const { employeeId, month } = data;
        const submittedById = (req as any).user?.id || submittedBy;

        const submitterExists = await prisma.user.findUnique({ where: { id: submittedById } });
        if (!submitterExists) {
            return res.status(400).json({ error: 'Submitter account not found. Please logout and login again.' });
        }

        const finalized = await isMonthFinalized(employeeId, month);
        if (finalized && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'This employee\'s evaluation for this month has already been finalized and can no longer be edited.' });
        }

        // Check if evaluation period is enabled
        const isEnabled = await checkEvaluationPeriod(month, submitterExists.departmentId);
        if (!isEnabled && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        const dbData = {
            employeeId,
            month,
            warningMessages: data.warningMessages,
            disciplinaryDeduction: data.disciplinaryDeduction,
            appreciationMessages: data.appreciationMessages,
            exceptionalAssignments: data.exceptionalAssignments,
            specializedTraining: data.specializedTraining,
            supportingTraining: data.supportingTraining,
            languageTraining: data.languageTraining,
            softwareTraining: data.softwareTraining,
            submittedAt: new Date(),
            submittedById
        };

        const existing = await prisma.personnelEvaluation.findFirst({
            where: { employeeId, month }
        });

        const result = existing
            ? await prisma.personnelEvaluation.update({ where: { id: existing.id }, data: dbData })
            : await prisma.personnelEvaluation.create({ data: dbData });

        if (finalized) await reFinalizeEmployee(employeeId, month, submittedById);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save Personnel evaluation' });
    }
};

export const deletePersonnelEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.personnelEvaluation.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

// Same Africa/Tripoli "today" helper as the period/presence crons — the Presence
// window for the current month only finishes on day 24, so finalizing earlier
// than day 25 would freeze an evaluation missing its Presence component.
const todayInTripoli = (): { day: number; month: string } => {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Tripoli', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()).split('-');
    return { day: Number(d), month: `${y}-${m}` };
};

// Bulk read for the Overview screen — which employees are already finalized this month.
export const getFinalizationsByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const rows = await prisma.evaluationFinalization.findMany({
            where: { month },
            select: { employeeId: true, finalizedAt: true, isAuto: true },
        });
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch evaluation finalizations' });
    }
};

const EVAL_MODELS: Array<{ key: string; model: string; mapper?: (r: any) => any }> = [
    { key: 'hr', model: 'hREvaluation', mapper: mapHREvalFromDB },
    { key: 'personnel', model: 'personnelEvaluation' },
    { key: 'unit', model: 'unitEvaluation', mapper: mapOrgEvalFromDB },
    { key: 'department', model: 'departmentEvaluation', mapper: mapOrgEvalFromDB },
    { key: 'division', model: 'divisionEvaluation', mapper: mapOrgEvalFromDB },
    { key: 'director', model: 'directorEvaluation', mapper: mapOrgEvalFromDB },
    { key: 'gm', model: 'gMEvaluation' },
    { key: 'chairman', model: 'chairmanEvaluation' },
    { key: 'finalization', model: 'evaluationFinalization' },
];

// GET /api/evaluations/employee/:employeeId/history — every month's evaluation data for one
// employee across all 9 evaluation tables, for the Lifecycle detail tree. Gated to admin-like
// roles or the employee viewing their own record only — simpler than checkCanViewEvaluation's
// full evaluator-based access, so no score/comment data ever reaches an unauthorized viewer.
export const getEvaluationHistoryForEmployee = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const requester = (req as any).user;
        const isAllowed = ADMIN_LIKE_ROLES.includes(requester.role)
            || (await resolveOwnEmployeeId(requester.id)) === employeeId;
        if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });

        const results = await Promise.all(
            EVAL_MODELS.map(m => (prisma as any)[m.model].findMany({ where: { employeeId } }))
        );

        const byMonth = new Map<string, any>();
        EVAL_MODELS.forEach((m, i) => {
            for (const row of results[i]) {
                const entry = byMonth.get(row.month) || { month: row.month };
                entry[m.key] = m.mapper ? m.mapper(row) : row;
                byMonth.set(row.month, entry);
            }
        });
        res.json(Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month)));
    } catch (error) {
        console.error('Error fetching evaluation history:', error);
        res.status(500).json({ error: 'Failed to fetch evaluation history' });
    }
};

// Saves/freezes an employee's whole monthly evaluation: snapshots the server-computed
// finalScore into EvaluationFinalization (which every save handler above now checks),
// and credits the Evaluation Index (Employee.evaluationPoints). Scope: one employee,
// one department, or (neither given) every active employee. Already-finalized
// employees in scope are silently skipped — a month can only ever be finalized once.
export const finalizeEvaluations = async (req: Request, res: Response) => {
    try {
        const { month, employeeId, departmentId } = req.body;
        if (!month) return res.status(400).json({ error: 'Missing month' });

        const { day, month: currentMonth } = todayInTripoli();
        const role = (req as any).user?.role;
        if (role !== 'SUPER_ADMIN' && month === currentMonth && day < 25) {
            return res.status(400).json({ error: 'This month cannot be finalized before day 25 — Presence data is not final until the 25th.' });
        }

        const finalizedById = (req as any).user?.id || null;
        const employees = await prisma.employee.findMany({
            where: {
                enrollmentStatus: 'ACTIVE',
                ...(employeeId ? { id: String(employeeId) } : {}),
                ...(departmentId ? { departmentId: String(departmentId) } : {}),
            },
        });

        const results: Array<{ employeeId: string; fullName: string; status: 'finalized' | 'refinalized' | 'skipped'; finalScore?: number }> = [];
        for (const emp of employees) {
            const result = await finalizeOneEmployee(emp as any, String(month), finalizedById, false);
            results.push({
                employeeId: emp.id, fullName: emp.fullName, status: result.status,
                ...(result.status === 'finalized' ? { finalScore: result.finalScore } : {}),
            });
        }

        res.json({
            month,
            requested: employees.length,
            finalized: results.filter(r => r.status === 'finalized').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            results,
        });
    } catch (error) {
        console.error('Error finalizing evaluations:', error);
        res.status(500).json({ error: 'Failed to finalize evaluations' });
    }
};
