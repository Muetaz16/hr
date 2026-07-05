import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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

// Helper to map DB Dept/Director Evaluation to Frontend format
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
// --- Unit Evaluations ---
export const getUnitEvaluation = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        const evalData = await prisma.unitEvaluation.findFirst({
            where: {
                employeeId: String(employeeId),
                month: String(month)
            }
        });

        if (evalData) {
            return res.json(mapOrgEvalFromDB(evalData));
        }
        res.json(null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Unit evaluation' });
    }
};

export const saveUnitEvaluation = async (req: Request, res: Response) => {
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

        // Self-evaluation check
        const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
        if (employee?.userId === submittedById && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'You cannot evaluate yourself' });
        }

        const dbData = {
            ...mapOrgEvalToDB(data, submittedById),
            submittedAt: new Date(),
            totalScore: data.totalScore,
            comments: data.comments
        };

        const existing = await prisma.unitEvaluation.findFirst({
            where: { employeeId, month }
        });

        if (existing) {
            const updated = await prisma.unitEvaluation.update({
                where: { id: existing.id },
                data: dbData
            });
            res.json(updated);
        } else {
            const created = await prisma.unitEvaluation.create({
                data: dbData
            });
            res.json(created);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to save Unit evaluation' });
    }
};

export const deleteUnitEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.unitEvaluation.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

export const getUnitEvaluationsByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const evals = await prisma.unitEvaluation.findMany({ where: { month } });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Unit evaluations' });
    }
};


// --- Department Evaluations ---
export const getDeptEvaluation = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        const evalData = await prisma.departmentEvaluation.findFirst({
            where: {
                employeeId: String(employeeId),
                month: String(month)
            }
        });

        if (evalData) {
            return res.json(mapOrgEvalFromDB(evalData));
        }
        res.json(null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Dept evaluation' });
    }
};

export const saveDeptEvaluation = async (req: Request, res: Response) => {
    try {
        const { id, submittedBy, ...data } = req.body;
        const { employeeId, month } = data;
        const submittedById = (req as any).user?.id || submittedBy;

        // Verify submitter exists (force re-login check)
        const submitterExists = await prisma.user.findUnique({ where: { id: submittedById } });
        if (!submitterExists) {
            return res.status(400).json({ error: 'Submitter account not found. Please logout and login again.' });
        }

        // Check if evaluation period is enabled
        const isEnabled = await checkEvaluationPeriod(month, submitterExists.departmentId);
        if (!isEnabled && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        // Self-evaluation check and GM role restriction
        const targetEmployee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true, role: true } });
        if (targetEmployee?.userId === submittedById && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'You cannot evaluate yourself' });
        }

        if (submitterExists.role === 'HEAD_DIRECTOR') {
            if (targetEmployee?.role !== 'HEAD_UNIT' && targetEmployee?.role !== 'HEAD_DEPARTMENT') {
                return res.status(403).json({ error: 'General Managers can only evaluate Heads of Unit and Department' });
            }
        }

        const dbData = {
            ...mapOrgEvalToDB(data, submittedById),
            submittedAt: new Date(),
            totalScore: data.totalScore,
            comments: data.comments
        };

        const existing = await prisma.departmentEvaluation.findFirst({
            where: { employeeId, month }
        });

        if (existing) {
            const updated = await prisma.departmentEvaluation.update({
                where: { id: existing.id },
                data: dbData
            });
            res.json(updated);
        } else {
            const created = await prisma.departmentEvaluation.create({
                data: dbData
            });
            res.json(created);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to save Dept evaluation' });
    }
};

export const deleteDeptEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.departmentEvaluation.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

export const getDeptEvaluationsByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const evals = await prisma.departmentEvaluation.findMany({ where: { month } });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Dept evaluations' });
    }
};


// --- Director Evaluations ---
export const getDirectorEvaluation = async (req: Request, res: Response) => {
    try {
        const { employeeId, month } = req.query;
        const evalData = await prisma.directorEvaluation.findFirst({
            where: {
                employeeId: String(employeeId),
                month: String(month)
            }
        });

        if (evalData) {
            return res.json(mapOrgEvalFromDB(evalData));
        }

        res.json(null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Director evaluation' });
    }
};

export const saveDirectorEvaluation = async (req: Request, res: Response) => {
    try {
        const { id, submittedBy, ...data } = req.body;
        const { employeeId, month } = data;
        const submittedById = (req as any).user?.id || submittedBy;

        // Verify submitter exists
        if (!submittedById) {
            return res.status(400).json({ error: 'Submitter ID is missing' });
        }

        const submitterExists = await prisma.user.findUnique({ where: { id: submittedById } });
        if (!submitterExists) {
            return res.status(400).json({ error: 'Submitter account not found. Please logout and login again.' });
        }

        // Check if evaluation period is enabled
        const isEnabled = await checkEvaluationPeriod(month, submitterExists.departmentId);
        if (!isEnabled && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Evaluation period is disabled for this month' });
        }

        // Self-evaluation check and GM role restriction
        const targetEmployee = await prisma.employee.findUnique({ where: { id: String(employeeId) }, select: { userId: true, role: true } });
        if (targetEmployee?.userId === submittedById && submitterExists.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'You cannot evaluate yourself' });
        }

        if (submitterExists.role === 'HEAD_DIRECTOR') {
            if (targetEmployee?.role !== 'HEAD_UNIT' && targetEmployee?.role !== 'HEAD_DEPARTMENT') {
                return res.status(403).json({ error: 'General Managers can only evaluate Heads of Unit and Department' });
            }
        }

        const dbData = {
            ...mapOrgEvalToDB(data, submittedById),
            finalScore: data.finalScore
        };

        const existing = await prisma.directorEvaluation.findFirst({
            where: { employeeId: String(employeeId), month: String(month) }
        });

        if (existing) {
            const userRole = (req as any).user?.role;
            if (existing.locked && userRole !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Evaluation is locked' });
            }

            const updated = await prisma.directorEvaluation.update({
                where: { id: existing.id },
                data: dbData
            });
            res.json(updated);
        } else {
            const created = await prisma.directorEvaluation.create({
                data: dbData
            });
            res.json(created);
        }
    } catch (error: any) {
        console.error('[EVAL][ERROR] saveDirectorEvaluation:', error.message);
        res.status(500).json({ error: 'Failed to save Director evaluation' });
    }
};

export const lockEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        await prisma.directorEvaluation.update({
            where: { id },
            data: {
                locked: true,
                lockedAt: new Date()
            }
        });
        res.json({ message: 'Evaluation locked' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to lock evaluation' });
    }
};

export const getDirectorEvaluationsByMonth = async (req: Request, res: Response) => {
    try {
        const { month } = req.params;
        const evals = await prisma.directorEvaluation.findMany({ where: { month } });
        res.json(evals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Director evaluations' });
    }
};

export const deleteDirectorEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.directorEvaluation.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};

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
