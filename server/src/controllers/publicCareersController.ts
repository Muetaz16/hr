import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { notify, notifyRoles } from './notificationController';

import { prisma } from '../lib/prisma';

const cleanStr = (v: any): string | null =>
    (v === '' || v === 'null' || v === 'undefined' || v == null) ? null : String(v).trim();

// Only these fields are ever exposed publicly — internal notes, requester ids,
// approval trails, salary etc. are deliberately NOT included.
const publicPositionShape = (r: any) => ({
    id: r.id,
    title: r.jobTitle,
    department: r.department?.name || r.division?.name || null,
    unit: r.unit?.name || null,
    locations: r.jobDescription?.workLocations || [],
    categories: r.jobDescription?.jobCategories || [],
    description: r.jobDescription?.description || null,
    publishedAt: r.publishedAt,
});

// Typed as any so it compiles before the Prisma client is regenerated with the
// new careers columns; the shape is still exactly what Prisma expects.
const openPositionWhere: any = {
    publishedToCareers: true,
    filled: false,
    type: 'HIRE',
    status: 'FULLY_APPROVED',
};

const positionInclude = {
    department: { select: { name: true } },
    division: { select: { name: true } },
    unit: { select: { name: true } },
    jobDescription: { select: { title: true, description: true, workLocations: true, jobCategories: true } },
} as const;

// GET /api/public/positions — the live job board (published + still-open positions).
export const listOpenPositions = async (_req: Request, res: Response) => {
    try {
        const positions = await prisma.recruitmentRequest.findMany({
            where: openPositionWhere,
            include: positionInclude,
            orderBy: { publishedAt: 'desc' } as any,
        });
        res.json(positions.map(publicPositionShape));
    } catch (error) {
        console.error('Error listing public positions:', error);
        res.status(500).json({ error: 'Failed to load open positions.' });
    }
};

// GET /api/public/positions/:id — a single open position (for the job detail page).
export const getPublicPosition = async (req: Request, res: Response) => {
    try {
        const position = await prisma.recruitmentRequest.findFirst({
            where: { id: req.params.id, ...openPositionWhere } as any,
            include: positionInclude,
        });
        if (!position) return res.status(404).json({ error: 'This position is no longer open.' });
        res.json(publicPositionShape(position));
    } catch (error) {
        console.error('Error fetching public position:', error);
        res.status(500).json({ error: 'Failed to load the position.' });
    }
};

// Verify a Cloudflare Turnstile token. If no secret is configured (e.g. local dev)
// the check is skipped so the flow still works end-to-end.
const verifyCaptcha = async (token: string | null, ip?: string): Promise<boolean> => {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) return true; // not configured yet — allow (dev)
    if (!token) return false;
    try {
        const body = new URLSearchParams({ secret, response: token });
        if (ip) body.append('remoteip', ip);
        const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const data: any = await resp.json();
        return Boolean(data?.success);
    } catch (err) {
        console.error('Captcha verification error:', err);
        return false;
    }
};

// --- Self-service onboarding -------------------------------------------------
// The identity text fields the new hire fills (keys match the Employee model so
// enrollment can map them 1:1). Documents are handled separately below.
const ONBOARDING_TEXT_FIELDS = [
    'fullName', 'fullNameArabic', 'dateOfBirth', 'placeOfBirth', 'placeOfBirthArabic', 'gender', 'bloodType',
    'nationality', 'nationalityArabic', 'nationalId', 'academicQualification', 'academicQualificationArabic',
    'idCardNumber', 'idPlaceOfIssue', 'idPlaceOfIssueArabic', 'idIssueDate',
    'passportNumber', 'passportPlaceOfIssue', 'passportPlaceOfIssueArabic', 'passportExpiryDate',
    'drivingLicenseType', 'drivingLicenseTypeArabic', 'drivingLicenseNumber', 'drivingLicenseExpiry',
    'drivingLicensePlaceOfIssue', 'drivingLicensePlaceOfIssueArabic',
    'personalPhone', 'personalEmail', 'emergencyContactNumber', 'residentialAddress', 'residentialAddressArabic',
    'workedBefore', 'hasRelativesInCompany', 'relativesNames', 'relativesNamesArabic',
    'bankName', 'bankNameArabic', 'bankBranchName', 'bankBranchNameArabic', 'bankAccountNumber',
    // New fields for Service Providers / Non-Residents
    // NOTE: department, job category/level and hourly rate are deliberately NOT collected here —
    // they're assigned by the recruitment team (on the Candidate) after the interview, before the
    // offer is generated, and department comes from the candidate's linked requisition. Letting the
    // onboarding form re-ask for them would let the hire overwrite what recruitment already decided.
    'serviceProviderCompany', 'employeeTravelDate', 'employeeStartDate'
];
// Upload field name -> key stored in onboardingData (matches Employee's *Url columns).
const ONBOARDING_DOC_MAP: Record<string, string> = {
    cv: 'cvUrl', degree: 'degreeUrl', birthCert: 'birthCertUrl', passportCopy: 'passportCopyUrl',
    bankCheck: 'bankCheckUrl', photo: 'photoUrl', idCard: 'idCardUrl', jobOffer: 'jobOfferUrl', healthCert: 'healthCertUrl',
    ticket: 'ticketUrl', residencyDocument: 'residencyDocumentUrl', interviewEvaluation: 'interviewEvaluationUrl',
};

// GET /api/public/onboarding/:token — load the onboarding form (prefill + any saved data).
export const getOnboarding = async (req: Request, res: Response) => {
    try {
        const candidate: any = await prisma.candidate.findFirst({
            where: { onboardingToken: req.params.token } as any,
            include: { requisition: { select: { jobTitle: true } } },
        });
        if (!candidate) return res.status(404).json({ error: 'This onboarding link is not valid.' });
        if (candidate.onboardingStatus === 'ENROLLED') {
            return res.json({ status: 'ENROLLED', done: true });
        }
        res.json({
            status: candidate.onboardingStatus || 'PENDING',
            positionTitle: candidate.requisition?.jobTitle || null,
            residentStatus: candidate.residentStatus || null,
            jobCategory: candidate.jobCategory || null,
            jobGrade: candidate.jobGrade || null,
            // Sensible prefill from what we already captured on the application — no point
            // asking the candidate to re-type what they already told us when applying.
            prefill: {
                fullName: candidate.fullName || '',
                personalEmail: candidate.email || '',
                personalPhone: candidate.phone || '',
                nationality: candidate.nationality || '',
                dateOfBirth: candidate.dateOfBirth ? candidate.dateOfBirth.toISOString().split('T')[0] : '',
                // No single "academic qualification" field is captured at application — combine
                // the education level (e.g. Bachelor's) with the degree course/speciality instead.
                academicQualification: [candidate.educationLevel, candidate.speciality].filter(Boolean).join(' - '),
            },
            data: candidate.onboardingData || {},
        });
    } catch (error) {
        console.error('Error loading onboarding:', error);
        res.status(500).json({ error: 'Failed to load the onboarding form.' });
    }
};

// POST /api/public/onboarding/:token — the new hire submits (or updates) their data.
export const submitOnboarding = async (req: Request, res: Response) => {
    try {
        const candidate: any = await prisma.candidate.findFirst({
            where: { onboardingToken: req.params.token } as any,
            include: { requisition: { select: { jobTitle: true, requesterId: true } } },
        });
        if (!candidate) return res.status(404).json({ error: 'This onboarding link is not valid.' });
        if (candidate.onboardingStatus === 'ENROLLED') {
            return res.status(409).json({ error: 'This onboarding has already been completed.' });
        }

        // Merge onto any previously-saved data so re-submitting keeps earlier uploads.
        const data: any = { ...(candidate.onboardingData || {}) };
        for (const f of ONBOARDING_TEXT_FIELDS) {
            if (req.body[f] !== undefined) data[f] = cleanStr(req.body[f]);
        }
        const files = (req as any).files || {};
        for (const [field, key] of Object.entries(ONBOARDING_DOC_MAP)) {
            if (files[field]?.[0]) data[key] = `/uploads/careers/${files[field][0].filename}`;
        }

        await prisma.candidate.update({
            where: { id: candidate.id },
            data: { onboardingData: data, onboardingStatus: 'SUBMITTED', onboardingSubmittedAt: new Date() } as any,
        });

        const title = candidate.requisition?.jobTitle || 'the role';
        if (candidate.requisition?.requesterId) {
            await notify(candidate.requisition.requesterId, 'Onboarding submitted', `${candidate.fullName} completed their onboarding form for "${title}".`, '/recruitment/onboarding').catch(() => {});
        }
        await notifyRoles(['HR_MANAGER'], 'Onboarding submitted', `${candidate.fullName} completed their onboarding form for "${title}" and is ready to enroll.`, '/recruitment/onboarding').catch(() => {});

        res.json({ ok: true, message: 'Your details have been submitted. Thank you!' });
    } catch (error) {
        console.error('Error submitting onboarding:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// POST /api/public/apply — a candidate applies to an open position from the careers site.
// Creates a Candidate straight into the hiring list (stage SCREENING) and notifies HR + the head.
export const submitApplication = async (req: Request, res: Response) => {
    try {
        const {
            positionId, fullName, email, phone, speciality, source,
            educationLevel, yearsExperience, salaryExpectation, nationality,
            dateOfBirth, placeOfLiving, captchaToken,
        } = req.body;

        const ip = req.ip || req.socket.remoteAddress || undefined;

        // 1. Anti-bot check.
        const captchaOk = await verifyCaptcha(cleanStr(captchaToken), ip);
        if (!captchaOk) {
            return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
        }

        // 2. Required fields.
        const cleanPositionId = cleanStr(positionId);
        const name = cleanStr(fullName);
        const mail = cleanStr(email);
        if (!cleanPositionId) return res.status(400).json({ error: 'No position was selected.' });
        if (!name) return res.status(400).json({ error: 'Your full name is required.' });
        if (!mail) return res.status(400).json({ error: 'Your email address is required.' });

        // Files: cv (required) + degree certificate (optional), via multer .fields.
        const files = (req as any).files || {};
        const cvFile = files.cv?.[0];
        const degreeFile = files.degree?.[0];
        if (!cvFile) return res.status(400).json({ error: 'Please attach your CV (PDF or Word).' });

        // 3. The position must still be genuinely open.
        const position = await prisma.recruitmentRequest.findFirst({
            where: { id: cleanPositionId, ...openPositionWhere } as any,
        });
        if (!position) {
            return res.status(409).json({ error: 'Sorry, this position is no longer accepting applications.' });
        }

        const dob = dateOfBirth ? new Date(dateOfBirth) : null;

        // 4. Create the candidate directly in the hiring list.
        const candidate = await prisma.candidate.create({
            data: {
                requisitionId: cleanPositionId,
                fullName: name,
                email: mail,
                phone: cleanStr(phone),
                cvPath: `/uploads/careers/${cvFile.filename}`,
                degreePath: degreeFile ? `/uploads/careers/${degreeFile.filename}` : null,
                speciality: cleanStr(speciality),
                educationLevel: cleanStr(educationLevel),
                yearsExperience: cleanStr(yearsExperience),
                salaryExpectation: cleanStr(salaryExpectation),
                nationality: cleanStr(nationality),
                dateOfBirth: dob && !isNaN(dob.getTime()) ? dob : null,
                placeOfLiving: cleanStr(placeOfLiving),
                source: cleanStr(source) || 'Careers Portal',
                appliedViaCareers: true,
                stage: 'SCREENING',
                createdById: null,
            } as any,
        });

        // 5. Notify the requesting head and HR that a new application arrived.
        const jobTitle = position.jobTitle;
        await notify(position.requesterId, 'New application received', `${name} applied for "${jobTitle}" via the Careers page.`, '/recruitment/hiring').catch(() => {});
        await notifyRoles(['HR_MANAGER'], 'New application received', `${name} applied for "${jobTitle}" via the Careers page.`, '/recruitment/hiring').catch(() => {});

        // Return only a confirmation — never leak internal candidate data publicly.
        res.status(201).json({ ok: true, message: 'Your application has been received. Thank you!', reference: candidate.id });
    } catch (error) {
        console.error('Error submitting public application:', error);
        res.status(500).json({ error: 'Something went wrong submitting your application. Please try again.' });
    }
};
