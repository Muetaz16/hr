import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { generateJobDescriptionDocx, JobDescriptionVariant } from '../utils/jobDescriptionDoc';

const prisma = new PrismaClient();

const cleanId = (val: any): string | null => (val === '' || val === 'null' || val === 'undefined' || !val) ? null : val;

// For a nullable Json column: pass the object, or JsonNull to explicitly clear it.
const cleanJson = (val: any) => (val === undefined || val === null) ? Prisma.JsonNull : val;

export const getAllJobDescriptions = async (req: Request, res: Response) => {
    try {
        const jobDescriptions = await prisma.jobDescription.findMany({
            include: {
                directorate: { select: { id: true, name: true } },
                division: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                unit: { select: { id: true, name: true } },
                _count: { select: { employees: true } }
            },
            orderBy: { title: 'asc' }
        });
        res.json(jobDescriptions);
    } catch (error) {
        console.error('Error fetching job descriptions:', error);
        res.status(500).json({ error: 'Failed to fetch job descriptions' });
    }
};

export const createJobDescription = async (req: Request, res: Response) => {
    try {
        const { title, description, isHead, plannedCount, directorateId, divisionId, departmentId, unitId, jobCategories, workLocations, details } = req.body;

        const cleanDirectorateId = cleanId(directorateId);
        const cleanDivisionId = cleanId(divisionId);
        const cleanDepartmentId = cleanId(departmentId);
        const cleanUnitId = cleanId(unitId);

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        if (!cleanDirectorateId && !cleanDivisionId && !cleanDepartmentId && !cleanUnitId) {
            return res.status(400).json({ error: 'A Job Description must be assigned to exactly one organizational scope (Directorate, Division, Department, or Unit)' });
        }

        // A Head position can only ever have one holder.
        const resolvedPlannedCount = Boolean(isHead) ? 1 : (parseInt(plannedCount) || 1);

        const jobDescription = await prisma.jobDescription.create({
            data: {
                title,
                description: description || null,
                isHead: Boolean(isHead),
                plannedCount: resolvedPlannedCount,
                jobCategories: Array.isArray(jobCategories) ? jobCategories : [],
                workLocations: Array.isArray(workLocations) ? workLocations : [],
                details: cleanJson(details),
                directorateId: cleanDirectorateId,
                divisionId: cleanDivisionId,
                departmentId: cleanDepartmentId,
                unitId: cleanUnitId
            }
        });
        res.status(201).json(jobDescription);
    } catch (error) {
        console.error('Error creating job description:', error);
        res.status(500).json({ error: 'Failed to create job description' });
    }
};

export const updateJobDescription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, isHead, plannedCount, directorateId, divisionId, departmentId, unitId, jobCategories, workLocations, details } = req.body;

        const cleanDirectorateId = cleanId(directorateId);
        const cleanDivisionId = cleanId(divisionId);
        const cleanDepartmentId = cleanId(departmentId);
        const cleanUnitId = cleanId(unitId);

        if (!cleanDirectorateId && !cleanDivisionId && !cleanDepartmentId && !cleanUnitId) {
            return res.status(400).json({ error: 'A Job Description must be assigned to exactly one organizational scope (Directorate, Division, Department, or Unit)' });
        }

        // A Head position can only ever have one holder.
        const resolvedPlannedCount = Boolean(isHead) ? 1 : (parseInt(plannedCount) || 1);

        const jobDescription = await prisma.jobDescription.update({
            where: { id },
            data: {
                title,
                description: description || null,
                isHead: Boolean(isHead),
                plannedCount: resolvedPlannedCount,
                jobCategories: Array.isArray(jobCategories) ? jobCategories : [],
                workLocations: Array.isArray(workLocations) ? workLocations : [],
                details: cleanJson(details),
                directorateId: cleanDirectorateId,
                divisionId: cleanDivisionId,
                departmentId: cleanDepartmentId,
                unitId: cleanUnitId
            }
        });
        res.json(jobDescription);
    } catch (error) {
        console.error('Error updating job description:', error);
        res.status(500).json({ error: 'Failed to update job description' });
    }
};

// GET /job-descriptions/:id/document?variant=general|emp — build the bilingual Job Description
// .docx from the matching template, filled with the JD's content. Signature/acknowledgment
// sections are left blank for hand-signing.
export const generateJobDescriptionDoc = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const variant: JobDescriptionVariant = req.query.variant === 'emp' ? 'emp' : 'general';

        const jd = await prisma.jobDescription.findUnique({
            where: { id },
            include: {
                directorate: { select: { id: true, name: true } },
                division: { select: { id: true, name: true, directorateId: true } },
                department: { select: { name: true, divisionId: true, division: { select: { id: true, name: true, directorateId: true } } } },
                unit: { select: { name: true } },
            },
        });
        if (!jd) return res.status(404).json({ error: 'Job description not found.' });

        const d = (jd.details as any) || {};
        // Prefer the English text; fall back to the Arabic if English is empty.
        const section = (key: string): string => {
            const s = d[key] || {};
            return String(s.en || '').trim() || String(s.ar || '').trim();
        };
        const locMap: Record<string, string> = { OFFICE: 'Office', SITE: 'Site' };
        const placeOfWork = (jd.workLocations || []).map(l => locMap[l] || l).join(' / ');

        // The JD may be scoped only at department level — derive the division/directorate it rolls up to.
        const divisionName = jd.division?.name || jd.department?.division?.name || jd.directorate?.name || '';
        const resolvedDivisionId = jd.divisionId || jd.department?.divisionId || null;
        const resolvedDirectorateId = jd.directorateId || jd.division?.directorateId || jd.department?.division?.directorateId || null;

        // Resolve the approver signatures (general form only) from the current role-holders'
        // saved signatures. A head is an Employee (with the matching role + org scope) linked to a
        // User account that has a signature. Any not found stays blank.
        let signatures: { headDept?: string | null; headDiv?: string | null; headHr?: string | null; adminDir?: string | null } | undefined;
        if (variant === 'general') {
            const empSig = async (where: any): Promise<string | null> => {
                const e = await prisma.employee.findFirst({
                    where: { ...where, userId: { not: null }, user: { signature: { not: null } } },
                    select: { user: { select: { signature: true } } },
                });
                return e?.user?.signature || null;
            };
            const [headDept, headDiv, adminDir, hrUser] = await Promise.all([
                jd.departmentId ? empSig({ role: { in: ['HEAD_DEPARTMENT', 'HEAD_OFFICE'] }, departmentId: jd.departmentId }) : Promise.resolve(null),
                resolvedDivisionId ? empSig({ role: { in: ['HEAD_DIVISION', 'HEAD_OFFICE'] }, divisionId: resolvedDivisionId }) : Promise.resolve(null),
                resolvedDirectorateId ? empSig({ role: 'HEAD_DIRECTOR', directorateId: resolvedDirectorateId }) : Promise.resolve(null),
                prisma.user.findFirst({ where: { role: 'HR_MANAGER', signature: { not: null } }, select: { signature: true } }),
            ]);
            signatures = { headDept, headDiv, headHr: hrUser?.signature || null, adminDir };
        }

        const buffer = generateJobDescriptionDocx(variant, {
            title: jd.title || '',
            positions: jd.plannedCount ? String(jd.plannedCount) : '',
            division: divisionName,
            department: jd.department?.name || '',
            reportsTo: String(d.reportsTo || '').trim(),
            placeOfWork,
            jobPurpose: section('jobPurpose'),
            keyResponsibilities: section('keyResponsibilities'),
            kpi: section('kpi'),
            education: section('education'),
            experience: section('experience'),
            skills: section('skills'),
            trainingLicenses: section('trainingLicenses'),
            workingConditions: section('workingConditions'),
            signatures,
        });

        const safeName = (jd.title || 'job_description').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'job_description';
        const suffix = variant === 'emp' ? 'Employee' : 'General';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Job_Description_${suffix}_${safeName}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating job description document:', error);
        res.status(500).json({ error: error.message || 'Failed to generate job description document' });
    }
};

export const deleteJobDescription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const employeeCount = await prisma.employee.count({ where: { jobDescriptionId: id } });
        if (employeeCount > 0) {
            return res.status(409).json({ error: `Cannot delete: ${employeeCount} employee(s) are currently assigned to this Job Description.` });
        }
        await prisma.jobDescription.delete({ where: { id } });
        res.json({ message: 'Job description deleted successfully' });
    } catch (error) {
        console.error('Error deleting job description:', error);
        res.status(500).json({ error: 'Failed to delete job description' });
    }
};
