import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import { generatePersonnelActionDocx } from '../utils/personnelActionForm';

const prisma = new PrismaClient();

const formatFormDate = (value: Date | string | null | undefined): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const factorStr = (v: number | null | undefined): string =>
    (v === null || v === undefined) ? '' : String(v);

// The names of the org units an employee currently sits in (most-specific first).
const currentOrgNames = async (emp: any) => {
    const [unit, department, division] = await Promise.all([
        emp.unitId ? prisma.unit.findUnique({ where: { id: emp.unitId } }) : null,
        emp.departmentId ? prisma.department.findUnique({ where: { id: emp.departmentId } }) : null,
        emp.divisionId ? prisma.division.findUnique({ where: { id: emp.divisionId } }) : null,
    ]);
    return { division: division?.name || '', department: department?.name || '', unit: unit?.name || '' };
};

// Resolve the full org placement a Job Description implies, backfilling parents from its scope.
const resolveJdPlacement = async (jd: any) => {
    let unitId: string | null = jd.unitId || null;
    let departmentId: string | null = jd.departmentId || null;
    let divisionId: string | null = jd.divisionId || null;
    let directorateId: string | null = jd.directorateId || null;

    if (unitId) {
        const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { department: { include: { division: true } } } });
        departmentId = unit?.departmentId ?? departmentId;
        divisionId = unit?.department?.divisionId ?? divisionId;
        directorateId = unit?.department?.division?.directorateId ?? directorateId;
    } else if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId }, include: { division: true } });
        divisionId = dept?.divisionId ?? divisionId;
        directorateId = dept?.division?.directorateId ?? directorateId;
    } else if (divisionId) {
        const div = await prisma.division.findUnique({ where: { id: divisionId } });
        directorateId = div?.directorateId ?? directorateId;
    }
    return { unitId, departmentId, divisionId, directorateId };
};

const orgNames = async (p: { divisionId: string | null; departmentId: string | null; unitId: string | null }) => {
    const [division, department, unit] = await Promise.all([
        p.divisionId ? prisma.division.findUnique({ where: { id: p.divisionId } }) : null,
        p.departmentId ? prisma.department.findUnique({ where: { id: p.departmentId } }) : null,
        p.unitId ? prisma.unit.findUnique({ where: { id: p.unitId } }) : null,
    ]);
    return { division: division?.name || '', department: department?.name || '', unit: unit?.name || '' };
};

// POST /api/personnel-actions  — create a transfer request driven by the target Job Description.
export const createPersonnelAction = async (req: Request, res: Response) => {
    try {
        const { employeeId, newJobDescriptionId, newJobGrade, newPlaceOfWork, reportsTo, typeOfTransfer, effectiveDate, justification, actionType, newJobCategory } = req.body;
        if (!employeeId) return res.status(400).json({ error: 'An employee is required.' });
        if (!newJobDescriptionId) return res.status(400).json({ error: 'A target Job Description is required.' });

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const jd = await prisma.jobDescription.findUnique({ where: { id: newJobDescriptionId } });
        if (!jd) return res.status(404).json({ error: 'Target Job Description not found.' });

        const current = await currentOrgNames(employee);
        const placement = await resolveJdPlacement(jd);
        const jdDetails = (jd.details as any) || {};

        const paf = await prisma.personnelActionForm.create({
            data: {
                employeeId,
                actionType: actionType || 'TRANSFER',
                status: 'PENDING',
                currentDivision: current.division,
                currentDepartment: current.department,
                currentUnit: current.unit,
                currentPosition: employee.position || null,
                currentJobCategory: employee.jobCategory || null,
                currentJobGrade: employee.jobGrade || null,
                currentPlaceOfWork: employee.placeOfWork || null,
                newJobDescriptionId,
                newDivisionId: placement.divisionId,
                newDepartmentId: placement.departmentId,
                newUnitId: placement.unitId,
                newPositionTitle: jd.title || null,
                // Prefer the category the user chose (for JDs listing several); otherwise fall back to
                // the JD's single/joined categories, then the employee's current category.
                newJobCategory: newJobCategory || (Array.isArray(jd.jobCategories) && jd.jobCategories.length ? jd.jobCategories.join(', ') : (employee.jobCategory || null)),
                newJobGrade: newJobGrade || employee.jobGrade || null,
                newPlaceOfWork: newPlaceOfWork || (Array.isArray(jd.workLocations) && jd.workLocations.length ? jd.workLocations.join(', ') : null),
                reportsTo: reportsTo || jdDetails.reportsTo || null,
                typeOfTransfer: typeOfTransfer || null,
                effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
                justification: justification || null,
                createdByName: (req as AuthRequest).user?.fullName || null,
            },
        });
        res.status(201).json(paf);
    } catch (error: any) {
        console.error('Error creating personnel action form:', error);
        res.status(500).json({ error: 'Failed to create personnel action form', details: error.message });
    }
};

// GET /api/personnel-actions
export const listPersonnelActions = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;
        const forms = await prisma.personnelActionForm.findMany({
            where: status ? { status: String(status) } : undefined,
            include: { employee: { select: { id: true, fullName: true, staffId: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(forms);
    } catch (error: any) {
        console.error('Error listing personnel action forms:', error);
        res.status(500).json({ error: 'Failed to list personnel action forms' });
    }
};

// GET /api/personnel-actions/employee/:employeeId — one employee's transfer history for the
// Lifecycle detail view. Deliberately ungated beyond authentication (unlike listPersonnelActions'
// HR-only bulk list) — same exposure level as the Contract History already shown on that screen.
export const getPersonnelActionsByEmployee = async (req: Request, res: Response) => {
    try {
        const { employeeId } = req.params;
        const forms = await prisma.personnelActionForm.findMany({
            where: { employeeId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(forms);
    } catch (error: any) {
        console.error('Error fetching personnel action forms for employee:', error);
        res.status(500).json({ error: 'Failed to fetch personnel action forms' });
    }
};

// GET /api/personnel-actions/:id/form  — generate the filled DOCX
export const generatePersonnelActionFormDoc = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const paf = await prisma.personnelActionForm.findUnique({ where: { id }, include: { employee: true } });
        if (!paf) return res.status(404).json({ error: 'Personnel action form not found.' });

        const newNames = await orgNames({ divisionId: paf.newDivisionId, departmentId: paf.newDepartmentId, unitId: paf.newUnitId });
        const emp: any = paf.employee;

        const buffer = generatePersonnelActionDocx({
            employeeId: emp.staffId || '',
            employeeName: emp.fullName || '',
            currentDivision: paf.currentDivision || '',
            currentDepartment: paf.currentDepartment || '',
            currentUnit: paf.currentUnit || '',
            currentPosition: paf.currentPosition || '',
            currentJobCategory: paf.currentJobCategory || '',
            currentJobGrade: paf.currentJobGrade || '',
            currentReportsTo: '',
            currentWorkLocation: paf.currentPlaceOfWork || '',
            newDivision: newNames.division,
            newDepartment: newNames.department,
            newUnit: newNames.unit,
            newPositionTitle: paf.newPositionTitle || '',
            newJobCategory: paf.newJobCategory || '',
            newJobGrade: paf.newJobGrade || '',
            newReportsTo: paf.reportsTo || '',
            newPlaceOfWork: paf.newPlaceOfWork || '',
            // Factors are informational on the form — taken from the employee's current record.
            englishFactor: factorStr(emp.languageFactor),
            positionFactor: factorStr(emp.positionFactor),
            locationFactor: factorStr(emp.siteFactor),
            skillFactor: factorStr(emp.skillFactor),
            typeOfTransfer: paf.typeOfTransfer || '',
            effectivityDate: formatFormDate(paf.effectiveDate),
        });

        const safeName = (emp.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Personnel_Action_${safeName}.docx"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('Error generating personnel action form:', error);
        res.status(500).json({ error: 'Failed to generate personnel action form', details: error.message });
    }
};

// POST /api/personnel-actions/:id/decide  — body: { decision: 'ACCEPT'|'REJECT', documentUrl?, documentName? }
// ACCEPT assigns the employee to the target JD (blocked if the JD is over its staffing plan),
// applies the JD's org placement + position/category/grade/place-of-work, files the signed form
// under the employee's Lifecycle documents, and marks the form ACCEPTED.
export const decidePersonnelAction = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision, documentUrl, documentName } = req.body;
        const deciderName = (req as AuthRequest).user?.fullName || null;

        const paf = await prisma.personnelActionForm.findUnique({ where: { id } });
        if (!paf) return res.status(404).json({ error: 'Personnel action form not found.' });
        if (paf.status !== 'PENDING') return res.status(400).json({ error: `This form is already ${paf.status.toLowerCase()}.` });

        if (decision === 'REJECT') {
            const updated = await prisma.personnelActionForm.update({
                where: { id },
                data: {
                    status: 'REJECTED', decidedByName: deciderName, decidedAt: new Date(),
                    documentUrl: documentUrl || paf.documentUrl, documentName: documentName || paf.documentName,
                },
            });
            return res.json(updated);
        }

        if (decision !== 'ACCEPT') return res.status(400).json({ error: 'decision must be ACCEPT or REJECT.' });
        if (!documentUrl) return res.status(400).json({ error: 'Attach the signed form before accepting.' });

        // Enforce the Job Description staffing plan — same rule the rest of the system uses when
        // assigning a JD. Skip the check if the employee is already on this JD.
        if (paf.newJobDescriptionId) {
            const [jd, employee] = await Promise.all([
                prisma.jobDescription.findUnique({ where: { id: paf.newJobDescriptionId }, include: { _count: { select: { employees: { where: { enrollmentStatus: { not: 'SEPARATED' } } } } } } }),
                prisma.employee.findUnique({ where: { id: paf.employeeId }, select: { jobDescriptionId: true } }),
            ]);
            if (!jd) return res.status(404).json({ error: 'Target Job Description no longer exists.' });
            if (jd.id !== employee?.jobDescriptionId && jd._count.employees >= jd.plannedCount) {
                return res.status(403).json({ error: `Job Description "${jd.title}" is above the staffing plan (${jd._count.employees}/${jd.plannedCount} filled). Increase the planned headcount before transferring.` });
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const employeeUpdate: any = {
                jobDescriptionId: paf.newJobDescriptionId || null,
                divisionId: paf.newDivisionId ?? null,
                departmentId: paf.newDepartmentId ?? null,
                unitId: paf.newUnitId ?? null,
            };
            // Directorate follows from the resolved division.
            const div = paf.newDivisionId ? await tx.division.findUnique({ where: { id: paf.newDivisionId } }) : null;
            employeeUpdate.directorateId = div?.directorateId ?? null;

            if (paf.newPositionTitle) employeeUpdate.position = paf.newPositionTitle;
            if (paf.newJobCategory) employeeUpdate.jobCategory = paf.newJobCategory;
            if (paf.newJobGrade) employeeUpdate.jobGrade = paf.newJobGrade;
            if (paf.newPlaceOfWork) employeeUpdate.placeOfWork = paf.newPlaceOfWork;

            await tx.employee.update({ where: { id: paf.employeeId }, data: employeeUpdate });

            await tx.employeeDocument.create({
                data: {
                    employeeId: paf.employeeId,
                    name: `Signed Personnel Action Form — Transfer (${new Date().toLocaleDateString()})`,
                    fileUrl: documentUrl,
                    fileName: documentName?.trim() || null,
                    uploadedByName: deciderName,
                },
            });

            return tx.personnelActionForm.update({
                where: { id },
                data: { status: 'ACCEPTED', decidedByName: deciderName, decidedAt: new Date(), documentUrl, documentName: documentName || null },
            });
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error deciding personnel action form:', error);
        res.status(500).json({ error: 'Failed to process the decision', details: error.message });
    }
};
