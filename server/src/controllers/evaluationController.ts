import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { canEvaluate, EvalLevel, OrgPlacement } from '../utils/evaluationHierarchy';

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

// Resolve a submitter's org placement (role + scope ids) from their user + linked
// employee record. User rows only carry unit/department, so division/directorate
// come from the employee record.
const resolveManagerPlacement = async (userId: string) => {
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
const checkCanEvaluate = async (
    submitter: { user: any; placement: OrgPlacement },
    targetId: string,
    level: EvalLevel
): Promise<string | null> => {
    if (submitter.user.role === 'SUPER_ADMIN') return null;
    const target = await prisma.employee.findUnique({
        where: { id: targetId },
        select: { userId: true, role: true, unitId: true, departmentId: true, divisionId: true, directorateId: true }
    });
    if (!target) return 'Employee not found';
    if (target.userId && target.userId === submitter.user.id) return 'You cannot evaluate yourself';
    if (!canEvaluate(submitter.placement, target as any, level)) {
        return 'You are not one of the two required evaluators for this employee';
    }
    return null;
};

// --- HR Evaluations ---
export const getHREvaluation = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        if (!employeeId || !month) return res.status(400).json({ error: 'Missing params' });

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

        // Check if evaluation period is enabled
        const isEnabled = await checkEvaluationPeriod(month, submitterExists.departmentId);
        if (!isEnabled && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        const dbData = mapHREvalToDB(data, submittedById);

        const existing = await prisma.hREvaluation.findFirst({
            where: { employeeId, month }
        });

        if (existing) {
            const updated = await prisma.hREvaluation.update({
                where: { id: existing.id },
                data: dbData
            });
            res.json(updated);
        } else {
            const created = await prisma.hREvaluation.create({
                data: dbData
            });
            res.json(created);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to save HR evaluation' });
    }
};

// -----------------------------------------------------------------------------
// Generic org-evaluation handlers (Unit / Department / Division / Director)
// Each of these levels stores the 16 competency metrics; the total (0..80) is
// computed server-side. `level` is the skip-level role that owns the record.
// -----------------------------------------------------------------------------
type MetricModel = 'unitEvaluation' | 'departmentEvaluation' | 'divisionEvaluation' | 'directorEvaluation';

const makeGetOrgEval = (model: MetricModel) => async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
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

        // Evaluation window must be open (Super Admin bypasses)
        const isEnabled = await checkEvaluationPeriod(month, submitter.user.departmentId);
        if (!isEnabled && submitter.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        // Skip-level rule: only the two required evaluators may score this employee
        const denied = await checkCanEvaluate(submitter, employeeId, level);
        if (denied) return res.status(403).json({ error: denied });

        const mapped = mapOrgEvalToDB(data, submittedById);
        const totalScore = sumMetrics(mapped);
        const dbData: any = {
            ...mapped,
            submittedAt: new Date(),
            totalScore,
            comments: data.comments
        };
        // The Director model carries the metric total under `finalScore` too.
        if (model === 'directorEvaluation') {
            dbData.finalScore = totalScore;
            delete dbData.comments; // DirectorEvaluation has no comments column
        }

        const existing = await (prisma as any)[model].findFirst({ where: { employeeId, month } });
        if (existing) {
            const updated = await (prisma as any)[model].update({ where: { id: existing.id }, data: dbData });
            res.json(updated);
        } else {
            const created = await (prisma as any)[model].create({ data: dbData });
            res.json(created);
        }
    } catch (error: any) {
        console.error(`[EVAL][ERROR] save ${model}:`, error.message);
        res.status(500).json({ error: `Failed to save ${model}` });
    }
};

// Unit
export const getUnitEvaluation = makeGetOrgEval('unitEvaluation');
export const getUnitEvaluationsByMonth = makeGetOrgEvalsByMonth('unitEvaluation');
export const saveUnitEvaluation = makeSaveOrgEval('unitEvaluation', 'UNIT');
export const deleteUnitEvaluation = makeDeleteOrgEval('unitEvaluation');

// Department
export const getDeptEvaluation = makeGetOrgEval('departmentEvaluation');
export const getDeptEvaluationsByMonth = makeGetOrgEvalsByMonth('departmentEvaluation');
export const saveDeptEvaluation = makeSaveOrgEval('departmentEvaluation', 'DEPARTMENT');
export const deleteDeptEvaluation = makeDeleteOrgEval('departmentEvaluation');

// Division
export const getDivisionEvaluation = makeGetOrgEval('divisionEvaluation');
export const getDivisionEvaluationsByMonth = makeGetOrgEvalsByMonth('divisionEvaluation');
export const saveDivisionEvaluation = makeSaveOrgEval('divisionEvaluation', 'DIVISION');
export const deleteDivisionEvaluation = makeDeleteOrgEval('divisionEvaluation');

// Director (Directorate head)
export const getDirectorEvaluation = makeGetOrgEval('directorEvaluation');
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

const makeGetScoreEval = (model: ScoreModel) => async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
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

        const isEnabled = await checkEvaluationPeriod(month, submitter.user.departmentId);
        if (!isEnabled && submitter.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        const denied = await checkCanEvaluate(submitter, employeeId, level);
        if (denied) return res.status(403).json({ error: denied });

        const dbData: any = {
            employeeId,
            month,
            finalScore: Number(data.finalScore) || 0,
            comments: data.comments,
            submittedById
        };

        const existing = await (prisma as any)[model].findFirst({ where: { employeeId, month } });
        if (existing) {
            const updated = await (prisma as any)[model].update({ where: { id: existing.id }, data: dbData });
            res.json(updated);
        } else {
            const created = await (prisma as any)[model].create({ data: dbData });
            res.json(created);
        }
    } catch (error: any) {
        console.error(`[EVAL][ERROR] save ${model}:`, error.message);
        res.status(500).json({ error: `Failed to save ${model}` });
    }
};

// GM
export const getGMEvaluation = makeGetScoreEval('gMEvaluation');
export const getGMEvaluationsByMonth = makeGetScoreEvalsByMonth('gMEvaluation');
export const saveGMEvaluation = makeSaveScoreEval('gMEvaluation', 'GM');
export const deleteGMEvaluation = makeDeleteScoreEval('gMEvaluation');

// Chairman
export const getChairmanEvaluation = makeGetScoreEval('chairmanEvaluation');
export const getChairmanEvaluationsByMonth = makeGetScoreEvalsByMonth('chairmanEvaluation');
export const saveChairmanEvaluation = makeSaveScoreEval('chairmanEvaluation', 'CHAIRMAN');
export const deleteChairmanEvaluation = makeDeleteScoreEval('chairmanEvaluation');

// --- Personnel Evaluations ---
export const getPersonnelEvaluation = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
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

        if (existing) {
            const updated = await prisma.personnelEvaluation.update({
                where: { id: existing.id },
                data: dbData
            });
            res.json(updated);
        } else {
            const created = await prisma.personnelEvaluation.create({
                data: dbData
            });
            res.json(created);
        }
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
