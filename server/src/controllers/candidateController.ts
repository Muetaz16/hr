import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateJobOfferDocx } from '../utils/jobOffer';
import { generateEvaluationDocx } from '../utils/jobEvaluation';

const prisma = new PrismaClient();

const cleanStr = (v: any): string | null => (v === '' || v === 'null' || v === 'undefined' || v == null) ? null : String(v);

// Shared include so every response carries the requisition context + who did what.
const candidateInclude = {
    requisition: {
        include: {
            jobDescription: { select: { id: true, title: true, plannedCount: true, isHead: true, jobCategories: true, workLocations: true, _count: { select: { employees: true } } } },
            department: { select: { id: true, name: true } },
            division: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
            requester: { select: { id: true, fullName: true } },
        }
    },
    createdBy: { select: { id: true, fullName: true } },
    screenBy: { select: { id: true, fullName: true } },
    hrEvalBy: { select: { id: true, fullName: true } },
    techEvalBy: { select: { id: true, fullName: true } },
} as const;

const isHRRole = (role?: string) => role === 'HR_MANAGER' || role === 'SUPER_ADMIN';
const isPrivileged = (role?: string) => ['HR_MANAGER', 'SUPER_ADMIN', 'GENERAL_MANAGER'].includes(role || '');

// GET /candidates — HR/GM/Admin see all; heads see only candidates for requisitions they raised.
export const getCandidates = async (req: Request, res: Response) => {
    try {
        const { requisitionId, stage } = req.query;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const where: any = {};
        if (requisitionId) where.requisitionId = String(requisitionId);
        if (stage) where.stage = String(stage);
        if (!isPrivileged(userRole)) {
            // A head only sees candidates for the requisitions they own.
            where.requisition = { requesterId: userId };
        }

        const candidates = await prisma.candidate.findMany({
            where,
            include: candidateInclude,
            orderBy: { createdAt: 'desc' },
        });
        res.json(candidates);
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ error: 'Failed to fetch candidates' });
    }
};

// POST /candidates — HR sources a candidate against an approved HIRE requisition.
export const createCandidate = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;
        if (!isHRRole(userRole)) {
            return res.status(403).json({ error: 'Only HR can add candidates.' });
        }

        const {
            requisitionId, fullName, phone, email, source, speciality,
            yearsExperience, salaryExpectation, nationality, dateOfBirth, placeOfLiving,
            salaryStructure, jobGrade, placeOfWork, contractMonths, residentStatus,
        } = req.body;
        const cleanReqId = cleanStr(requisitionId);
        if (!cleanReqId) return res.status(400).json({ error: 'A requisition must be selected.' });
        if (!cleanStr(fullName)) return res.status(400).json({ error: "The candidate's full name is required." });

        const requisition = await prisma.recruitmentRequest.findUnique({ where: { id: cleanReqId } });
        if (!requisition) return res.status(404).json({ error: 'Requisition not found.' });
        if (requisition.type !== 'HIRE' || requisition.status !== 'FULLY_APPROVED') {
            return res.status(400).json({ error: 'Candidates can only be added to a fully approved hire requisition.' });
        }
        if (requisition.filled) {
            return res.status(409).json({ error: 'This requisition has already been filled.' });
        }

        // Uploaded documents (multer .fields -> req.files keyed by field name)
        const files = (req as any).files || {};
        const filePath = (field: string) => files[field]?.[0] ? `/uploads/cvs/${files[field][0].filename}` : null;
        const dob = dateOfBirth ? new Date(dateOfBirth) : null;

        const candidate = await prisma.candidate.create({
            data: {
                requisitionId: cleanReqId,
                fullName: String(fullName).trim(),
                phone: cleanStr(phone),
                email: cleanStr(email),
                cvPath: filePath('cv'),
                degreePath: filePath('degree'),
                portfolioPath: filePath('portfolio'),
                source: cleanStr(source),
                speciality: cleanStr(speciality),
                yearsExperience: cleanStr(yearsExperience),
                salaryExpectation: cleanStr(salaryExpectation),
                nationality: cleanStr(nationality),
                dateOfBirth: dob && !isNaN(dob.getTime()) ? dob : null,
                placeOfLiving: cleanStr(placeOfLiving),
                // Offer parameters captured up front so the job offer can be generated in one click.
                salaryStructure: cleanStr(salaryStructure),
                jobGrade: cleanStr(jobGrade),
                placeOfWork: cleanStr(placeOfWork),
                contractMonths: String(contractMonths) === '3' ? 3 : String(contractMonths) === '6' ? 6 : null,
                residentStatus: cleanStr(residentStatus),
                stage: 'SCREENING',
                createdById: userId,
            },
            include: candidateInclude,
        });
        res.status(201).json(candidate);
    } catch (error) {
        console.error('Error creating candidate:', error);
        res.status(500).json({ error: 'Failed to create candidate' });
    }
};

// Helper: load a candidate with its requisition and enforce that the actor is the requesting head (or admin).
const loadForHead = async (id: string, userId: string, userRole?: string) => {
    const candidate = await prisma.candidate.findUnique({ where: { id }, include: { requisition: true } });
    if (!candidate) return { error: 'notfound' as const };
    const isRequester = candidate.requisition.requesterId === userId;
    if (!isRequester && userRole !== 'SUPER_ADMIN') return { error: 'forbidden' as const, candidate };
    return { candidate };
};

// POST /candidates/:id/screen — the requesting head accepts or rejects the candidate.
export const screenCandidate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, note } = req.body;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const loaded = await loadForHead(id, userId, userRole);
        if (loaded.error === 'notfound') return res.status(404).json({ error: 'Candidate not found.' });
        if (loaded.error === 'forbidden') return res.status(403).json({ error: 'Only the head who raised this requisition can screen its candidates.' });
        const candidate = loaded.candidate!;

        if (candidate.stage !== 'SCREENING') {
            return res.status(400).json({ error: 'This candidate has already been screened.' });
        }
        if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
            return res.status(400).json({ error: 'A decision of ACCEPTED or REJECTED is required.' });
        }

        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                screenDecision: decision,
                screenNote: cleanStr(note),
                screenById: userId,
                screenAt: new Date(),
                stage: decision === 'ACCEPTED' ? 'INTERVIEW' : 'REJECTED',
            },
            include: candidateInclude,
        });
        res.json(updated);
    } catch (error) {
        console.error('Error screening candidate:', error);
        res.status(500).json({ error: 'Failed to screen candidate' });
    }
};

// POST /candidates/:id/interview — HR schedules the interview.
export const scheduleInterview = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { interviewAt, interviewLocation, interviewNote } = req.body;
        const userRole = (req as any).user?.role;
        if (!isHRRole(userRole)) return res.status(403).json({ error: 'Only HR can schedule interviews.' });

        const candidate = await prisma.candidate.findUnique({ where: { id } });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
        if (candidate.stage !== 'INTERVIEW') return res.status(400).json({ error: 'Only screened candidates can be scheduled for an interview.' });
        if (!interviewAt) return res.status(400).json({ error: 'An interview date/time is required.' });

        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                interviewAt: new Date(interviewAt),
                interviewLocation: cleanStr(interviewLocation),
                interviewNote: cleanStr(interviewNote),
            },
            include: candidateInclude,
        });
        res.json(updated);
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(500).json({ error: 'Failed to schedule interview' });
    }
};

const parseScore = (v: any): number | null => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return null;
    return Math.min(5, Math.max(1, n));
};

// Detailed interview-evaluation criteria (each scored 1-5), mirroring the EVALUATION.docx form.
const HR_CRITERIA_KEYS = ['englishProficiency', 'motivation', 'culturalFit', 'communication', 'professionalism'] as const;
const TECH_CRITERIA_KEYS = ['technicalKnowledge', 'problemSolving', 'relevantExperience', 'softwareProficiency', 'learningAdaptability'] as const;

// Validate all criteria are present (1-5) and return the parsed map plus a rounded overall score.
const parseCriteria = (criteria: any, keys: readonly string[]): { scores: Record<string, number>; overall: number } | null => {
    if (!criteria || typeof criteria !== 'object') return null;
    const scores: Record<string, number> = {};
    for (const k of keys) {
        const v = parseScore(criteria[k]);
        if (v == null) return null;
        scores[k] = v;
    }
    const overall = Math.round(keys.reduce((sum, k) => sum + scores[k], 0) / keys.length);
    return { scores, overall };
};

// POST /candidates/:id/hr-eval — HR records the HR evaluation.
export const submitHrEvaluation = async (req: Request, res: Response) => {
    try {
        const { criteria, recommend, note } = req.body;
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;
        if (!isHRRole(userRole)) return res.status(403).json({ error: 'Only HR can submit the HR evaluation.' });

        const candidate = await prisma.candidate.findUnique({ where: { id } });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
        if (candidate.stage !== 'INTERVIEW') return res.status(400).json({ error: 'The candidate is not in the interview stage.' });

        const parsed = parseCriteria(criteria, HR_CRITERIA_KEYS);
        if (!parsed) return res.status(400).json({ error: 'All five HR evaluation criteria must be scored 1-5.' });

        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                hrScore: parsed.overall,
                hrCriteria: parsed.scores,
                hrRecommend: recommend === true || recommend === 'true',
                hrNote: cleanStr(note),
                hrEvalById: userId,
                hrEvalAt: new Date(),
            },
            include: candidateInclude,
        });
        res.json(updated);
    } catch (error) {
        console.error('Error submitting HR evaluation:', error);
        res.status(500).json({ error: 'Failed to submit HR evaluation' });
    }
};

// POST /candidates/:id/tech-eval — the requesting head records the technical evaluation.
export const submitTechEvaluation = async (req: Request, res: Response) => {
    try {
        const { criteria, recommend, note } = req.body;
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const loaded = await loadForHead(id, userId, userRole);
        if (loaded.error === 'notfound') return res.status(404).json({ error: 'Candidate not found.' });
        if (loaded.error === 'forbidden') return res.status(403).json({ error: 'Only the head who raised this requisition can submit the technical evaluation.' });
        const candidate = loaded.candidate!;

        if (candidate.stage !== 'INTERVIEW') return res.status(400).json({ error: 'The candidate is not in the interview stage.' });
        const parsed = parseCriteria(criteria, TECH_CRITERIA_KEYS);
        if (!parsed) return res.status(400).json({ error: 'All five technical evaluation criteria must be scored 1-5.' });

        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                techScore: parsed.overall,
                techCriteria: parsed.scores,
                techRecommend: recommend === true || recommend === 'true',
                techNote: cleanStr(note),
                techEvalById: userId,
                techEvalAt: new Date(),
            },
            include: candidateInclude,
        });
        res.json(updated);
    } catch (error) {
        console.error('Error submitting technical evaluation:', error);
        res.status(500).json({ error: 'Failed to submit technical evaluation' });
    }
};

// POST /candidates/:id/finalize — final accept/reject after both evaluations (HR or the requesting head).
export const finalizeEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, note } = req.body;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const candidate = await prisma.candidate.findUnique({ where: { id }, include: { requisition: true } });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

        // Only the head who raised the requisition finalises the decision (HR cannot unless they are SUPER_ADMIN).
        const allowed = candidate.requisition.requesterId === userId || userRole === 'SUPER_ADMIN';
        if (!allowed) return res.status(403).json({ error: 'Only the head who requested the hiring can finalise the decision.' });

        if (candidate.stage !== 'INTERVIEW') return res.status(400).json({ error: 'The candidate is not in the interview stage.' });
        if (candidate.hrEvalById == null || candidate.techEvalById == null) {
            return res.status(400).json({ error: 'Both the HR and technical evaluations must be completed first.' });
        }
        if (decision !== 'ACCEPTED' && decision !== 'REJECTED') {
            return res.status(400).json({ error: 'A decision of ACCEPTED or REJECTED is required.' });
        }

        // Accepted candidates move to OFFER (awaiting HR to generate the job offer).
        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                finalDecision: decision,
                finalNote: cleanStr(note),
                stage: decision === 'ACCEPTED' ? 'OFFER' : 'REJECTED',
            },
            include: candidateInclude,
        });
        res.json(updated);
    } catch (error) {
        console.error('Error finalising evaluation:', error);
        res.status(500).json({ error: 'Failed to finalise evaluation' });
    }
};

// POST /candidates/:id/offer — HR records the candidate's response to the offer.
export const recordOffer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, note } = req.body;
        const userRole = (req as any).user?.role;
        if (!isHRRole(userRole)) return res.status(403).json({ error: 'Only HR can record the offer response.' });

        const candidate = await prisma.candidate.findUnique({ where: { id } });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
        if (candidate.stage !== 'OFFER') return res.status(400).json({ error: 'The candidate is not at the offer stage.' });
        if (decision !== 'ACCEPTED' && decision !== 'DECLINED') {
            return res.status(400).json({ error: 'A decision of ACCEPTED or DECLINED is required.' });
        }

        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                offerDecision: decision,
                offerNote: cleanStr(note),
                offerAt: new Date(),
                // Accepting keeps the candidate at OFFER (ready to enrol); declining withdraws them.
                stage: decision === 'DECLINED' ? 'WITHDRAWN' : 'OFFER',
            },
            include: candidateInclude,
        });
        res.json(updated);
    } catch (error) {
        console.error('Error recording offer:', error);
        res.status(500).json({ error: 'Failed to record offer' });
    }
};

// POST /candidates/:id/hire — link the enrolled employee, mark hired, and close the requisition.
export const markHired = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { employeeId } = req.body;
        const userRole = (req as any).user?.role;
        if (!isHRRole(userRole)) return res.status(403).json({ error: 'Only HR can complete a hire.' });

        const candidate = await prisma.candidate.findUnique({ where: { id }, include: { requisition: true } });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
        if (candidate.stage !== 'OFFER' || candidate.offerDecision !== 'ACCEPTED') {
            return res.status(400).json({ error: 'Only a candidate who has accepted the offer can be hired.' });
        }

        const quantity = candidate.requisition.quantity || 1;
        const alreadyHired = await prisma.candidate.count({ where: { requisitionId: candidate.requisitionId, stage: 'HIRED' } });
        if (alreadyHired >= quantity) {
            return res.status(409).json({ error: `This requisition has already hired its full quantity (${alreadyHired}/${quantity}).` });
        }

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.candidate.update({
                where: { id },
                data: { stage: 'HIRED', employeeId: cleanStr(employeeId) },
                include: candidateInclude,
            });
            // Close the requisition only once the requested number of hires has been reached.
            const hiredNow = alreadyHired + 1;
            if (hiredNow >= quantity) {
                await tx.recruitmentRequest.update({
                    where: { id: candidate.requisitionId },
                    data: { filled: true, filledAt: new Date() },
                });
            }
            return updated;
        });
        res.json(result);
    } catch (error) {
        console.error('Error completing hire:', error);
        res.status(500).json({ error: 'Failed to complete hire' });
    }
};

// GET /candidates/:id/offer — build the bilingual job-offer .docx from the shipped template,
// pre-filled with what we know about the candidate. Available once both interview evaluations
// are recorded (i.e. the candidate is ready to move to onboarding). HR or the requesting head.
export const generateOffer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const candidate = await prisma.candidate.findUnique({
            where: { id },
            include: {
                requisition: {
                    include: {
                        department: { select: { name: true, positionFactor: true, division: { select: { name: true, positionFactor: true } } } },
                        division: { select: { name: true, positionFactor: true } },
                        requester: { select: { fullName: true } },
                        jobDescription: { select: { title: true, jobCategories: true, workLocations: true, isHead: true } },
                    },
                },
            },
        });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

        const allowed = isHRRole(userRole);
        if (!allowed) return res.status(403).json({ error: 'Only HR or Super Admin can generate the job offer.' });

        if (candidate.hrEvalById == null || candidate.techEvalById == null) {
            return res.status(400).json({ error: 'Both the HR and technical evaluations must be completed before generating an offer.' });
        }

        const req_ = candidate.requisition;
        const jd = req_.jobDescription;

        // Offer parameters were captured when the candidate was added to the hiring list.
        const salaryStructure = candidate.salaryStructure || '';
        const jobGrade = candidate.jobGrade || '';
        const contractMonths = candidate.contractMonths === 3 ? 3 : 6;

        if (!salaryStructure || !jobGrade) {
            return res.status(400).json({ error: 'This candidate is missing offer details (salary structure / experience level). Re-add the candidate with those fields to generate an offer.' });
        }

        // Record when the offer document was generated (surfaced in the Hiring List details).
        await prisma.candidate.update({ where: { id }, data: { offerGeneratedAt: new Date() } });

        // Place of work: use what was chosen on the hiring list, otherwise fall back to the JD's
        // single location.
        const locations = jd?.workLocations || [];
        let placeOfWork = candidate.placeOfWork || '';
        if (!placeOfWork && locations.length === 1) {
            placeOfWork = locations[0];
        }

        // Currency is implied by the salary-structure code (…-LYD / …-USD / …-EUR).
        const currency = /LYD$/.test(salaryStructure) ? 'LYD' : /USD$/.test(salaryStructure) ? 'USD' : /EUR$/.test(salaryStructure) ? 'EUR' : '';

        // الإدارة (Division): the requisition's own division, else the division the department belongs to.
        const divisionName = req_.division?.name || req_.department?.division?.name || '';

        // Head roles carry a position factor from their org unit; on-site roles carry the frontline factor.
        const isHead = !!jd?.isHead;
        const orgPositionFactor =
            (req_.department?.positionFactor && req_.department.positionFactor > 1) ? req_.department.positionFactor :
                (req_.division?.positionFactor && req_.division.positionFactor > 1) ? req_.division.positionFactor :
                    (req_.department?.division?.positionFactor && req_.department.division.positionFactor > 1) ? req_.department.division.positionFactor : 1;
        const positionFactorNum = isHead ? orgPositionFactor : 1;
        const isSite = placeOfWork.toUpperCase() === 'SITE';
        const frontlineFactorNum = isSite ? 1.1 : 1; // "Working on site" factor (SITE_FACTORS)
        const placeOfWorkLabel = isSite ? 'Site' : placeOfWork.toUpperCase() === 'OFFICE' ? 'Office' : placeOfWork;

        // Look up the hourly / monthly rate for (job category × grade × structure). If the
        // combination isn't in the salary table we still produce the offer, just with those
        // cells left blank for finance to complete — we never invent a figure.
        const jobCategory = jd?.jobCategories?.[0] || '';
        let hourlyRate = '';
        let basicSalary = '';
        let basicNum = 0;
        if (jobCategory) {
            const structure = await prisma.salaryStructure.findUnique({
                where: { jobCategory_jobGrade_structureLevel: { jobCategory, jobGrade, structureLevel: salaryStructure } },
            }).catch(() => null);
            if (structure) {
                hourlyRate = structure.hourlyRate ? String(structure.hourlyRate) : '';
                if (structure.monthlyRate) { basicNum = structure.monthlyRate; basicSalary = String(structure.monthlyRate); }
            }
        }

        // Gross = basic salary + factor allowances, following the system's additive salary model
        // (base + (positionFactor − 1)·base + (frontlineFactor − 1)·base). Only when a factor applies.
        let grossSalary = '';
        if (basicNum > 0 && (positionFactorNum > 1 || frontlineFactorNum > 1)) {
            const combined = 1 + (positionFactorNum - 1) + (frontlineFactorNum - 1);
            grossSalary = String(Math.round(basicNum * combined * 100) / 100);
        }

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');

        const buffer = generateJobOfferDocx({
            company: 'INVESTMENT PORTFOLIO HOLDING',
            employeeName: candidate.fullName || '',
            nationality: candidate.nationality || '',
            jobCategory,
            jobGrade,
            hourlyRate,
            currency,
            division: divisionName,
            department: req_.department?.name || '',
            jobTitle: jd?.title || req_.jobTitle || '',
            reportsTo: req_.requester?.fullName || '',
            positionFactor: positionFactorNum > 1 ? String(positionFactorNum) : '',
            placeOfWork: placeOfWorkLabel,
            locationFactor: frontlineFactorNum > 1 ? String(frontlineFactorNum) : '',
            basicSalary,
            grossSalary,
            workingDays: '6 Days',
            requiredShift: '9 to 5',
            contractMonths,
            dateSent: `${pad(now.getDate())} / ${pad(now.getMonth() + 1)} / ${now.getFullYear()}`,
        });

        const safeName = (candidate.fullName || 'candidate').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'candidate';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Job_Offer_${safeName}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating job offer:', error);
        res.status(500).json({ error: error.message || 'Failed to generate job offer' });
    }
};

// GET /candidates/:id/evaluation — build the bilingual Interview Evaluation Form (.docx) from the
// shipped template, filled with the candidate info and the detailed HR/technical scores.
export const generateEvaluation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const candidate = await prisma.candidate.findUnique({
            where: { id },
            include: {
                requisition: {
                    include: {
                        department: { select: { name: true } },
                        division: { select: { name: true } },
                        unit: { select: { name: true } },
                        jobDescription: { select: { title: true, jobCategories: true } },
                    },
                },
                hrEvalBy: { select: { fullName: true } },
                techEvalBy: { select: { fullName: true } },
            },
        });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

        const allowed = isHRRole(userRole) || candidate.requisition.requesterId === userId;
        if (!allowed) return res.status(403).json({ error: 'Only HR or the requesting head can generate the evaluation form.' });

        if (candidate.hrEvalById == null || candidate.techEvalById == null) {
            return res.status(400).json({ error: 'Both the HR and technical evaluations must be completed before generating the evaluation form.' });
        }

        const req_ = candidate.requisition;
        const jd = req_.jobDescription;
        const hc = (candidate.hrCriteria as any) || {};
        const tc = (candidate.techCriteria as any) || {};
        const grade = (v: any) => (v == null || v === '') ? '' : String(v);
        const decision = candidate.finalDecision === 'ACCEPTED' ? 'ACCEPTED' : candidate.finalDecision === 'REJECTED' ? 'REJECTED' : '';

        const pad = (n: number) => String(n).padStart(2, '0');
        const fmtDate = (d: Date | null) => d ? `${pad(d.getDate())} / ${pad(d.getMonth() + 1)} / ${d.getFullYear()}` : '';

        const buffer = generateEvaluationDocx({
            candidateName: candidate.fullName || '',
            specialty: candidate.speciality || '',
            nationality: candidate.nationality || '',
            recruitingSource: candidate.source || '',
            jobCategory: jd?.jobCategories?.[0] || '',
            workExperience: candidate.yearsExperience || '',
            jobGrade: candidate.jobGrade || '',
            interviewDept: req_.department?.name || req_.division?.name || '',
            interviewedBy: candidate.hrEvalBy?.fullName || '',
            interviewDate: fmtDate(candidate.interviewAt),
            salaryExpectations: candidate.salaryExpectation || '',
            startDate: '',
            hrEnglish: grade(hc.englishProficiency),
            hrMotivation: grade(hc.motivation),
            hrCulturalFit: grade(hc.culturalFit),
            hrCommunication: grade(hc.communication),
            hrProfessionalism: grade(hc.professionalism),
            techKnowledge: grade(tc.technicalKnowledge),
            techProblemSolving: grade(tc.problemSolving),
            techRelevantExp: grade(tc.relevantExperience),
            techSoftware: grade(tc.softwareProficiency),
            techLearning: grade(tc.learningAdaptability),
            hrComment: candidate.hrNote || '',
            techComment: candidate.techNote || '',
            decision,
            decisionDept: decision === 'ACCEPTED' ? (req_.department?.name || '') : '',
            decisionUnit: decision === 'ACCEPTED' ? (req_.unit?.name || '') : '',
            decisionPosition: decision === 'ACCEPTED' ? (jd?.title || req_.jobTitle || '') : '',
            rejectionReason: decision === 'REJECTED' ? (candidate.finalNote || '') : '',
            recommendedOther: '',
        });

        const safeName = (candidate.fullName || 'candidate').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'candidate';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Interview_Evaluation_${safeName}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating evaluation form:', error);
        res.status(500).json({ error: error.message || 'Failed to generate evaluation form' });
    }
};

// DELETE /candidates/:id — HR/admin or whoever added the candidate.
export const deleteCandidate = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        const candidate = await prisma.candidate.findUnique({ where: { id } });
        if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
        // Only Super Admin can delete a candidate, at any stage.
        if (userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only Super Admin can delete candidates.' });
        }

        await prisma.candidate.delete({ where: { id } });
        res.json({ message: 'Candidate deleted successfully' });
    } catch (error) {
        console.error('Error deleting candidate:', error);
        res.status(500).json({ error: 'Failed to delete candidate' });
    }
};
