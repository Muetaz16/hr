import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { presetForRole } from '../utils/rolePresets';
import { createBioTimeEmployeeRecord, findBioTimeEmpIdByCode } from '../utils/attendanceApiProxy';

const prisma = new PrismaClient();

// BioTime has exactly 4 fixed positions (no lookup endpoint — discovered by inspecting its live
// roster): Resident=4, Non-Resident=5, Exception=6, Higher-Management=7. Exception and
// Higher-Management are never auto-assigned — attendance staff reclassify manually via the
// Attendance page's Employees tab when needed.
const BIOTIME_POSITION_BY_CONTRACT_TYPE: Record<string, number> = {
    'RESDANT': 4,
    'DIRCT NONE RESDANT': 5,
    'NONE RESDANT': 5,
};

// Fixed per-contract allowances — reset to these values at hire and at every renewal (see
// renewContract below), never accrued mid-contract, only decremented as leave is taken.
const EMERGENCY_LEAVE_ALLOWANCE = 3;
const UNPAID_LEAVE_ALLOWANCE = 14;
// Cap applied to paid leave carried into a new contract at renewal (see renewContract below).
const PAID_LEAVE_CARRYOVER_CAP = 14;

export const calculateHolidayMetrics = (
    contractStartDateStr: string | Date | null,
    holidaysUsed: number,
    bonusHolidays: number = 0,
    emergencyHolidaysUsed: number = 0,
    unpaidHolidaysUsed: number = 0
) => {
    if (!contractStartDateStr) {
        return {
            accruedHolidays: 0, earnedHolidays: 0, remainingHolidays: 0,
            remainingEmergencyHolidays: EMERGENCY_LEAVE_ALLOWANCE - (emergencyHolidaysUsed || 0),
            remainingUnpaidHolidays: UNPAID_LEAVE_ALLOWANCE - (unpaidHolidaysUsed || 0),
        };
    }
    const contractStartDate = new Date(contractStartDateStr);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - contractStartDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const accruedHolidays = Math.floor(diffDays / 12);
    const earnedHolidays = accruedHolidays + (bonusHolidays || 0);
    const remainingHolidays = earnedHolidays - (holidaysUsed || 0);
    return {
        accruedHolidays, earnedHolidays, remainingHolidays,
        remainingEmergencyHolidays: EMERGENCY_LEAVE_ALLOWANCE - (emergencyHolidaysUsed || 0),
        remainingUnpaidHolidays: UNPAID_LEAVE_ALLOWANCE - (unpaidHolidaysUsed || 0),
    };
};

export const getAllEmployees = async (req: AuthRequest, res: Response) => {
    try {
        const where: any = {};
        
        const { id: userId, role, departmentId, unitId, departmentIds } = req.user!;
        
        console.log(`[GET_ALL_EMPLOYEES] User: ${userId}, Role: ${role}, Dept: ${departmentId}, Unit: ${unitId}`);

        // Allow full visibility for all roles (requested for Organization Structure)
        // Sensitive data is pruned below for non-HR/Admin roles.

        console.log(`[GET_ALL_EMPLOYEES] Filter:`, JSON.stringify(where));

        const employees = await prisma.employee.findMany({
            where,
            include: { user: { select: { permissions: true } }, jobDescription: true }
        });

        const isSensitiveRole = ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'].includes(role);

        const employeesWithHolidays = employees.map(emp => {
            const data: any = {
                ...emp,
                permissions: (emp as any).user?.permissions || [],
                ...calculateHolidayMetrics(emp.contractStartDate, (emp as any).holidaysUsed, (emp as any).bonusHolidays, (emp as any).emergencyHolidaysUsed, (emp as any).unpaidHolidaysUsed)
            };

            // Prune sensitive data for non-administrative roles or other people's records
            if (!isSensitiveRole && emp.userId !== userId) {
                delete data.baseSalary;
                delete data.passportNumber;
                delete data.nationality;
                delete data.contractNumber;
                delete data.bonusHolidays;
                delete data.holidaysUsed;
                // Keep name, role, department, position, etc. for Org Chart
            }
            
            return data;
        });
        res.json(employeesWithHolidays);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
};

export const getEmployeeById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                user: { select: { permissions: true } },
                jobDescription: true,
                contracts: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({
            ...employee,
            permissions: (employee as any).user?.permissions || [],
            ...calculateHolidayMetrics(employee.contractStartDate, (employee as any).holidaysUsed, (employee as any).bonusHolidays, (employee as any).emergencyHolidaysUsed, (employee as any).unpaidHolidaysUsed)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch employee' });
    }
};

// Upload a single employee document (CV, degree, passport copy, etc.). Multer has already
// stored the file under /uploads/documents; we just return its public URL to the client,
// which then saves that URL onto the employee record via create/update.
export const uploadEmployeeDocument = async (req: Request, res: Response) => {
    try {
        const file = (req as any).file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({ url: `/uploads/documents/${file.filename}`, name: file.originalname });
    } catch (error) {
        console.error('Error uploading employee document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

// --- Free-form employee documents (beyond the fixed CV/degree/etc. slots on Employee itself) ---
// The file is uploaded separately via POST /employees/upload-document (same endpoint the fixed
// slots use); these endpoints just attach the resulting URL to the employee under a custom name.

// GET /employees/:id/documents
export const getEmployeeDocuments = async (req: Request, res: Response) => {
    try {
        const documents = await prisma.employeeDocument.findMany({
            where: { employeeId: req.params.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json(documents);
    } catch (error) {
        console.error('Error fetching employee documents:', error);
        res.status(500).json({ error: 'Failed to fetch employee documents' });
    }
};

// POST /employees/:id/documents — body: { name, fileUrl, fileName }
export const addEmployeeDocument = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, fileUrl, fileName } = req.body;
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'A document name is required.' });
        if (!fileUrl) return res.status(400).json({ error: 'No file was uploaded.' });

        const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        const document = await prisma.employeeDocument.create({
            data: {
                employeeId: id,
                name: String(name).trim(),
                fileUrl,
                fileName: fileName || null,
                uploadedByName: (req as AuthRequest).user?.fullName || null,
            },
        });
        res.status(201).json(document);
    } catch (error) {
        console.error('Error adding employee document:', error);
        res.status(500).json({ error: 'Failed to add employee document' });
    }
};

// DELETE /employees/:id/documents/:docId
export const deleteEmployeeDocument = async (req: Request, res: Response) => {
    try {
        const { id, docId } = req.params;
        const document = await prisma.employeeDocument.findUnique({ where: { id: docId } });
        if (!document || document.employeeId !== id) return res.status(404).json({ error: 'Document not found.' });

        await prisma.employeeDocument.delete({ where: { id: docId } });
        res.json({ message: 'Document removed successfully.' });
    } catch (error) {
        console.error('Error deleting employee document:', error);
        res.status(500).json({ error: 'Failed to delete employee document' });
    }
};

const parseDate = (dateStr: any): string | null => {
    if (!dateStr || dateStr.trim() === '') return null;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return date.toISOString();
    } catch {
        return null;
    }
};

const parseFloatSafe = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = parseFloat(val.toString());
    return isNaN(parsed) ? 0 : parsed;
};

// Residency → the leading digit of the auto Staff ID (IPH-<digit><YY>-<SEQ>).
const residencyDigit = (status?: string): string | null => {
    const v = (status || '').trim().toUpperCase();
    if (v === 'RESDANT') return '1';
    if (v === 'DIRCT NONE RESDANT') return '2';
    if (v === 'NONE RESDANT') return '3';
    return null;
};

// GET /employees/next-staff-id?residentStatus=RESDANT&year=26
// Builds the prefix IPH-<digit><YY>- and returns the next available sequence for it.
export const getNextStaffId = async (req: Request, res: Response) => {
    try {
        const digit = residencyDigit(req.query.residentStatus as string);
        if (!digit) {
            return res.status(400).json({ error: 'A residency status (RESDANT / DIRCT NONE RESDANT / NONE RESDANT) is required to generate a Staff ID.' });
        }
        // Two-digit year: use the value passed in, else the current year.
        const rawYear = String(req.query.year || '').replace(/\D/g, '');
        const yy = rawYear ? rawYear.slice(-2).padStart(2, '0') : String(new Date().getFullYear()).slice(-2);
        // New format: residency is two digits (01/02/03) → IPH-0126-001.
        const prefix = `IPH-0${digit}${yy}-`;
        // Legacy single-digit prefix (IPH-126-001) so the sequence keeps counting up.
        const legacyPrefix = `IPH-${digit}${yy}-`;

        const existing = await prisma.employee.findMany({
            where: { OR: [{ staffId: { startsWith: prefix } }, { staffId: { startsWith: legacyPrefix } }] },
            select: { staffId: true },
        });
        let maxSeq = 0;
        for (const e of existing) {
            // The sequence is always the final dash-delimited segment.
            const seg = (e.staffId || '').split('-').pop() || '';
            const n = parseInt(seg, 10);
            if (!isNaN(n) && n > maxSeq) maxSeq = n;
        }
        const nextSeq = maxSeq + 1;
        res.json({ prefix, nextSeq, staffId: `${prefix}${String(nextSeq).padStart(3, '0')}` });
    } catch (error) {
        console.error('Error generating next staff ID:', error);
        res.status(500).json({ error: 'Failed to generate the next Staff ID' });
    }
};

// POST /employees/regenerate-staff-ids
// Regenerates the Staff ID for EVERY employee in the new IPH-0<digit><YY>-<seq>
// format, renumbering sequentially within each residency + join-year group.
// Refuses to run (changing nothing) if any employee lacks a resident /
// non-resident contract type, so no one is left without a residency digit.
export const regenerateAllStaffIds = async (req: Request, res: Response) => {
    try {
        const employees = await prisma.employee.findMany({
            select: { id: true, fullName: true, contractType: true, joinDate: true },
        });

        // Guard: every employee must have a residency-bearing contract type.
        const invalid = employees.filter(e => !residencyDigit(e.contractType || undefined));
        if (invalid.length > 0) {
            return res.status(400).json({
                error: `Cannot generate Staff IDs: ${invalid.length} employee(s) have no resident / non-resident contract type set. Set their contract type first.`,
                invalidCount: invalid.length,
                invalidNames: invalid.slice(0, 25).map(e => e.fullName),
            });
        }

        // Deterministic order: earliest joiners get the lowest sequence numbers.
        const sorted = [...employees].sort((a, b) => {
            const ja = a.joinDate ? new Date(a.joinDate).getTime() : 0;
            const jb = b.joinDate ? new Date(b.joinDate).getTime() : 0;
            if (ja !== jb) return ja - jb;
            return (a.fullName || '').localeCompare(b.fullName || '');
        });

        const seqByPrefix: Record<string, number> = {};
        const updates = sorted.map(e => {
            const digit = residencyDigit(e.contractType || undefined)!;
            const yy = e.joinDate
                ? String(new Date(e.joinDate).getFullYear()).slice(-2)
                : String(new Date().getFullYear()).slice(-2);
            const prefix = `IPH-0${digit}${yy}-`;
            const next = (seqByPrefix[prefix] || 0) + 1;
            seqByPrefix[prefix] = next;
            const staffId = `${prefix}${String(next).padStart(3, '0')}`;
            return prisma.employee.update({ where: { id: e.id }, data: { staffId } });
        });

        await prisma.$transaction(updates);
        res.json({ message: `Generated ${updates.length} Staff IDs.`, count: updates.length });
    } catch (error) {
        console.error('Error regenerating staff IDs:', error);
        res.status(500).json({ error: 'Failed to regenerate Staff IDs' });
    }
};

export const createEmployee = async (req: Request, res: Response) => {
    try {
        const {
            id, fullName, email, password, role, departmentId, unitId, groupId, divisionId, directorateId, baseSalary, joinDate, staffId,
            position, placeOfWork, contractStartDate, contractEndDate, contractType, contractStatus, holidaysUsed, bonusHolidays,
                fullNameArabic, passportNumber, contractNumber, nationality, jobCategory, jobGrade, salaryStructureType, emergencyHolidaysUsed,
            unpaidHolidaysUsed, permissions, roleCategory, positionFactor, skillFactor, siteFactor, languageFactor, evaluationPoints, jobDescriptionId,
            // Extended Identity Details (recruitment intake form)
            dateOfBirth, placeOfBirth, nationalId, academicQualification, gender, bloodType,
            idCardNumber, idPlaceOfIssue, idIssueDate, passportPlaceOfIssue, passportExpiryDate,
            drivingLicenseType, drivingLicenseNumber, drivingLicenseExpiry, drivingLicensePlaceOfIssue,
            personalPhone, personalEmail, emergencyContactNumber, residentialAddress,
            workedBefore, hasRelativesInCompany, relativesNames,
            bankName, bankBranchName, bankAccountNumber, arrivalDate,
            cvUrl, degreeUrl, birthCertUrl, passportCopyUrl, bankCheckUrl, photoUrl, idCardUrl, jobOfferUrl, healthCertUrl,
            // Arabic counterparts of the bilingual onboarding fields
            placeOfBirthArabic, nationalityArabic, academicQualificationArabic, idPlaceOfIssueArabic,
            passportPlaceOfIssueArabic, drivingLicenseTypeArabic, drivingLicensePlaceOfIssueArabic,
            residentialAddressArabic, relativesNamesArabic, bankNameArabic, bankBranchNameArabic,
            // Onboarding-only fields (self-service onboarding form) — department and job
            // category/level/rate are deliberately NOT accepted here; they come from the
            // candidate's requisition/offer, assigned by the recruitment team.
            serviceProviderCompany,
            employeeTravelDate, employeeStartDate, ticketUrl, residencyDocumentUrl, interviewEvaluationUrl
        } = req.body;

        // Sanitization of foreign keys
        const cleanUnitId = (unitId === '' || unitId === 'null' || unitId === 'undefined' || !unitId) ? null : unitId;
        const cleanDeptId = (departmentId === '' || departmentId === 'null' || departmentId === 'undefined') ? null : departmentId;
        const cleanGroupId = (groupId === '' || groupId === 'null' || groupId === 'undefined') ? null : groupId;
        const cleanDivisionId = (divisionId === '' || divisionId === 'null' || divisionId === 'undefined' || !divisionId) ? null : divisionId;
        const cleanDirectorateId = (directorateId === '' || directorateId === 'null' || directorateId === 'undefined' || !directorateId) ? null : directorateId;
        const cleanJobDescriptionId = (jobDescriptionId === '' || jobDescriptionId === 'null' || jobDescriptionId === 'undefined' || !jobDescriptionId) ? null : jobDescriptionId;

        // Emails are the login identifier — normalise to lowercase so authentication (which lowercases
        // the entered email) always matches what we store.
        const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

        // Every enrolled person — no matter the role (standard Employee, any Head, GM, HR, Personnel,
        // etc.) — gets a login account created right here from their email. If no password is supplied,
        // it falls back to the default '123456'. (Previously only standard employees got an account and
        // management roles had to be linked separately from Access Management.)
        const autoCreateAccount = true;

        // A Job Description (Staffing Plan slot) is required for all new employees except
        // global-scope roles (General Manager / Chairman) which have no organizational unit to attach to.
        const globalScopeRoles = ['GENERAL_MANAGER', 'CHAIRMAN'];
        if (!globalScopeRoles.includes(role) && !cleanJobDescriptionId) {
            return res.status(400).json({ error: 'A Job Description must be selected. New employees cannot be added without an assigned Job Description (Staffing Plan slot).' });
        }

        console.log('Creating employee with data:', { id, fullName, email, role, departmentId: cleanDeptId, groupId: cleanGroupId, unitId: cleanUnitId, divisionId: cleanDivisionId });

        // Validate required fields — mirror the enrolment form's scoping so a role is only
        // asked for the scope it actually collects. Group is no longer required for anyone
        // (it is now optional on the Employee model):
        //  - Department: only the department-scoped roles (Employee / Head of Dept / Head of Unit).
        //  - Head of Division: a Division.  Head of Office: a Department (the office).
        //  - GM / Chairman / HR Manager / Personnel / Super Admin / Directorate Head: global/own scope.
        const rolesRequiringDept = ['EMPLOYEE', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
        if (rolesRequiringDept.includes(role) && !cleanDeptId) {
            console.error('Missing departmentId for role', role);
            return res.status(400).json({ error: `A Department is required for the ${String(role).replace(/_/g, ' ').toLowerCase()} role.` });
        }

        if (role === 'HEAD_DIVISION' && !cleanDivisionId) {
            console.error('Missing divisionId for Division Head');
            return res.status(400).json({ error: 'A Division is required for a Head of Division.' });
        }

        if (role === 'HEAD_OFFICE' && !cleanDeptId) {
            console.error('Missing departmentId for Office Head');
            return res.status(400).json({ error: 'An Office (department) is required for a Head of Office.' });
        }

        // Use a transaction to ensure both Employee and User are created or none
        const result = await prisma.$transaction(async (tx) => {
            let userId: string | undefined;

            // 1. Create a login account for standard employees (heads are linked via Access Management).
            // If no password is supplied, fall back to the same default the Access Management screen uses.
            if (autoCreateAccount && normalizedEmail) {
                const existingUser = await tx.user.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } });
                if (existingUser) {
                    throw new Error('A system account with this email already exists.');
                }

                const hashedPassword = await bcrypt.hash(password || '123456', 10);
                // Seed the account with its role's recommended permissions so the person has
                // sensible default access immediately and Access Management shows those toggles
                // pre-selected. If the caller sent explicit permissions, honour those instead.
                const seededPermissions = (permissions && permissions.length) ? permissions : presetForRole(role);
                const user = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        password: hashedPassword,
                        fullName,
                        role: role || 'EMPLOYEE',
                        departmentId: cleanDeptId,
                        unitId: cleanUnitId,
                        groupId: cleanGroupId,
                        permissions: seededPermissions
                    }
                });
                userId = user.id;
            }

            // --- Check Unit headcount capacity ---
            if (cleanUnitId) {
                const unit = await tx.unit.findUnique({
                    where: { id: cleanUnitId },
                    include: { _count: { select: { employees: true } } }
                });

                if (unit && unit.headcount > 0) {
                    if (unit._count.employees >= unit.headcount) {
                        throw new Error(`Unit "${unit.name}" has reached its capacity (${unit.headcount}). Cannot add more employees.`);
                    }
                }
            }
            // -------------------------------------

            // --- Check Job Description staffing plan capacity ---
            if (cleanJobDescriptionId) {
                const jobDescription = await tx.jobDescription.findUnique({
                    where: { id: cleanJobDescriptionId },
                    include: { _count: { select: { employees: true } } }
                });

                if (!jobDescription) {
                    throw new Error('Selected Job Description was not found.');
                }

                if (jobDescription._count.employees >= jobDescription.plannedCount) {
                    throw new Error(`Job Description "${jobDescription.title}" is above the staffing plan (${jobDescription._count.employees}/${jobDescription.plannedCount} filled). Increase the planned headcount before adding more employees.`);
                }
            }
            // -----------------------------------------------------

            // Dynamic Position Factor Logic
            let dynamicPositionFactor = parseFloatSafe(positionFactor) || 1.0;

            if ((role === 'HEAD_DEPARTMENT' || role === 'HEAD_OFFICE') && cleanDeptId) {
                const dept = await tx.department.findUnique({ where: { id: cleanDeptId } });
                if (dept && dept.positionFactor) dynamicPositionFactor = dept.positionFactor;
            } else if (role === 'HEAD_DIVISION' && cleanDivisionId) {
                const div = await tx.division.findUnique({ where: { id: cleanDivisionId } });
                if (div && div.positionFactor) dynamicPositionFactor = div.positionFactor;
            } else if (role === 'HEAD_DIRECTORATE' && cleanDirectorateId) {
                const dir = await tx.directorate.findUnique({ where: { id: cleanDirectorateId } });
                if (dir && dir.positionFactor) dynamicPositionFactor = dir.positionFactor;
            } else if (role === 'HEAD_UNIT' && cleanUnitId) {
                const unit = await tx.unit.findUnique({ where: { id: cleanUnitId }, include: { _count: { select: { employees: true } } } });
                if (unit) {
                    dynamicPositionFactor = unit._count.employees < 5 ? 1.15 : 1.20;
                }
            } else if (role === 'GENERAL_MANAGER') {
                dynamicPositionFactor = 1.60;
            }

            const data: any = {
                fullName,
                email: normalizedEmail,
                role: role || 'EMPLOYEE',
                departmentId: cleanDeptId,
                unitId: cleanUnitId,
                groupId: cleanGroupId,
                divisionId: cleanDivisionId,
                directorateId: cleanDirectorateId,
                jobDescriptionId: cleanJobDescriptionId,
                baseSalary: parseFloatSafe(baseSalary),
                joinDate: parseDate(joinDate) || new Date().toISOString(),
                staffId: staffId || null,
                position: position || null,
                placeOfWork: placeOfWork || null,
                contractStartDate: parseDate(contractStartDate),
                contractEndDate: parseDate(contractEndDate),
                contractType: contractType || null,
                contractStatus: contractStatus || 'Active',
                holidaysUsed: parseFloatSafe(holidaysUsed),
                emergencyHolidaysUsed: parseFloatSafe(emergencyHolidaysUsed),
                unpaidHolidaysUsed: parseFloatSafe(unpaidHolidaysUsed),
                bonusHolidays: parseFloatSafe(bonusHolidays),
                fullNameArabic: fullNameArabic || null,
                passportNumber: passportNumber || null,
                contractNumber: contractNumber || null,
                nationality: nationality || null,
                jobCategory: jobCategory || null,
                jobGrade: jobGrade || null,
                salaryStructureType: salaryStructureType || null,
                roleCategory: roleCategory || 'Support',
                positionFactor: dynamicPositionFactor,
                skillFactor: parseFloatSafe(skillFactor) || 1.0,
                siteFactor: parseFloatSafe(siteFactor) || 1.0,
                languageFactor: parseFloatSafe(languageFactor) || 1.0,
                evaluationPoints: parseFloatSafe(evaluationPoints) || 0,
                // Extended Identity Details
                dateOfBirth: parseDate(dateOfBirth),
                placeOfBirth: placeOfBirth || null,
                nationalId: nationalId || null,
                academicQualification: academicQualification || null,
                gender: gender || null,
                bloodType: bloodType || null,
                idCardNumber: idCardNumber || null,
                idPlaceOfIssue: idPlaceOfIssue || null,
                idIssueDate: parseDate(idIssueDate),
                passportPlaceOfIssue: passportPlaceOfIssue || null,
                passportExpiryDate: parseDate(passportExpiryDate),
                drivingLicenseType: drivingLicenseType || null,
                drivingLicenseNumber: drivingLicenseNumber || null,
                drivingLicenseExpiry: parseDate(drivingLicenseExpiry),
                drivingLicensePlaceOfIssue: drivingLicensePlaceOfIssue || null,
                personalPhone: personalPhone || null,
                personalEmail: personalEmail || null,
                emergencyContactNumber: emergencyContactNumber || null,
                residentialAddress: residentialAddress || null,
                workedBefore: workedBefore || null,
                hasRelativesInCompany: hasRelativesInCompany || null,
                relativesNames: relativesNames || null,
                bankName: bankName || null,
                bankBranchName: bankBranchName || null,
                bankAccountNumber: bankAccountNumber || null,
                arrivalDate: parseDate(arrivalDate),
                cvUrl: cvUrl || null,
                degreeUrl: degreeUrl || null,
                birthCertUrl: birthCertUrl || null,
                passportCopyUrl: passportCopyUrl || null,
                bankCheckUrl: bankCheckUrl || null,
                photoUrl: photoUrl || null,
                idCardUrl: idCardUrl || null,
                jobOfferUrl: jobOfferUrl || null,
                healthCertUrl: healthCertUrl || null,
                // Arabic counterparts of the bilingual onboarding fields
                placeOfBirthArabic: placeOfBirthArabic || null,
                nationalityArabic: nationalityArabic || null,
                academicQualificationArabic: academicQualificationArabic || null,
                idPlaceOfIssueArabic: idPlaceOfIssueArabic || null,
                passportPlaceOfIssueArabic: passportPlaceOfIssueArabic || null,
                drivingLicenseTypeArabic: drivingLicenseTypeArabic || null,
                drivingLicensePlaceOfIssueArabic: drivingLicensePlaceOfIssueArabic || null,
                residentialAddressArabic: residentialAddressArabic || null,
                relativesNamesArabic: relativesNamesArabic || null,
                bankNameArabic: bankNameArabic || null,
                bankBranchNameArabic: bankBranchNameArabic || null,
                // Onboarding-only fields (self-service onboarding form)
                serviceProviderCompany: serviceProviderCompany || null,
                employeeTravelDate: parseDate(employeeTravelDate),
                employeeStartDate: parseDate(employeeStartDate),
                ticketUrl: ticketUrl || null,
                residencyDocumentUrl: residencyDocumentUrl || null,
                interviewEvaluationUrl: interviewEvaluationUrl || null
            };

            // Enforce Exclusivity: Position Factor OR Skill Factor
            if (data.positionFactor > 1.0 && data.skillFactor > 1.0) {
                // Since positionFactor might be dynamically assigned based on role, prioritize it
                data.skillFactor = 1.0;
            }

            data.userId = userId || null;
            if (id) data.id = id;

            if (cleanDeptId && (!cleanDivisionId || !cleanDirectorateId)) {
                const dept = await tx.department.findUnique({
                    where: { id: cleanDeptId },
                    include: { division: true }
                });
                if (dept) {
                    if (!cleanDivisionId && dept.divisionId) data.divisionId = dept.divisionId;
                    if (!cleanDirectorateId && dept.division?.directorateId) data.directorateId = dept.division.directorateId;
                }
            }

            const employee = await tx.employee.create({ data });

            // 3. Auto-create Onboarding Asset Request (Laptop)
            const requesterId = (req as AuthRequest).user?.id;
            if (requesterId) {
                await tx.assetRequest.create({
                    data: {
                        employeeId: employee.id,
                        requesterId,
                        itemType: 'LAPTOP',
                        status: 'PENDING',
                        priority: 'NORMAL',
                        notes: 'Automatically generated during employee registration.'
                    }
                });

                // 3.5 Auto-create Support Ticket if a User account was created
                if (userId) {
                    await tx.supportTicket.create({
                        data: {
                            requesterId: userId,
                            title: `New Account: ${fullName}`,
                            description: `System account for ${fullName} (${email}) has been created. Role: ${role || 'EMPLOYEE'}. Please verify permissions and provide initial training.`,
                            category: 'IT',
                            priority: 'HIGH',
                            status: 'OPEN'
                        }
                    });
                }
            }

            // 4. Create Initial Contract Record
            await tx.contract.create({
                data: {
                    employeeId: employee.id,
                    startDate: parseDate(contractStartDate) || new Date().toISOString(),
                    endDate: parseDate(contractEndDate),
                    salary: parseFloatSafe(baseSalary),
                    contractNumber: contractNumber || "1st",
                    type: contractType || null,
                    status: 'ACTIVE',
                    notes: 'Initial contract created during registration.'
                }
            });

            return employee;
        });

        // Best-effort attendance-system provisioning — happens after the DB transaction commits
        // (external HTTP call, must never roll back or block the employee record itself). The
        // "already registered" case is expected and common (the existing employee population
        // already has real BioTime accounts predating this system), so it must resolve into a
        // link, not a failure: we always attempt the roster lookup by empCode after the create
        // attempt, regardless of whether that create call itself reported success.
        let attendanceSync: { status: 'skipped' | 'created' | 'linked' | 'failed'; message?: string } = { status: 'skipped' };
        const positionId = result.contractType ? BIOTIME_POSITION_BY_CONTRACT_TYPE[result.contractType] : undefined;

        try {
            if (!result.staffId) {
                attendanceSync = { status: 'skipped', message: 'No Staff ID set.' };
            } else if (!positionId) {
                attendanceSync = { status: 'skipped', message: `Unrecognized contract type "${result.contractType}".` };
            } else {
                const created = await createBioTimeEmployeeRecord({ empCode: result.staffId, firstName: result.fullName, positionId });
                if (!created.success) {
                    console.warn(`[BioTime] Create did not succeed for ${result.staffId} (likely already registered) — attempting to link instead:`, created.message);
                }

                const bioId = await findBioTimeEmpIdByCode(result.staffId);
                if (bioId != null) {
                    await prisma.employee.update({ where: { id: result.id }, data: { bioId } });
                    (result as any).bioId = bioId;
                    attendanceSync = { status: created.success ? 'created' : 'linked' };
                } else {
                    console.error(`[BioTime] Could not create or find a matching record for ${result.staffId}:`, created.message);
                    attendanceSync = { status: 'failed', message: created.message || 'Could not create or find a matching BioTime record.' };
                }
            }
        } catch (e: any) {
            console.error('[BioTime] Unexpected error during attendance provisioning:', e);
            attendanceSync = { status: 'failed', message: e?.message };
        }

        res.json({ ...result, _attendanceSync: attendanceSync });
    } catch (error: any) {
        console.error("Error creating employee:", error);
        // Business-rule failures thrown inside the transaction (duplicate account email,
        // unit/staffing capacity, etc.) are the user's to fix, so return 400 with the exact
        // message. Prisma error code + meta are included so the client can be specific.
        const message = error?.message || 'Failed to create employee';
        const isValidation = error?.code === 'P2002' || error?.code === 'P2003' ||
            /already exists|capacity|staffing plan|required|not found/i.test(message);
        res.status(isValidation ? 400 : 500).json({
            error: message,
            details: message,
            code: error?.code,
            meta: error?.meta,
        });
    }
};

export const updateEmployee = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const body = req.body;
        console.log('Update Request Body for ID:', id, JSON.stringify(body, null, 2));

        const data: any = {};

        if (body.fullName !== undefined) data.fullName = body.fullName;
        if (body.email !== undefined) data.email = body.email || null;
        if (body.role !== undefined) data.role = body.role;
        if (body.divisionId !== undefined) {
            data.divisionId = (body.divisionId === '' || body.divisionId === 'null' || body.divisionId === 'undefined') ? null : body.divisionId;
        }
        if (body.directorateId !== undefined) {
            data.directorateId = (body.directorateId === '' || body.directorateId === 'null' || body.directorateId === 'undefined') ? null : body.directorateId;
        }
        if (body.departmentId !== undefined) data.departmentId = body.departmentId;
        if (body.unitId !== undefined) {
            data.unitId = (body.unitId === '' || body.unitId === 'null' || body.unitId === 'undefined') ? null : body.unitId;
        }
        if (body.groupId !== undefined) {
            data.groupId = (body.groupId === '' || body.groupId === 'null' || body.groupId === 'undefined') ? null : body.groupId;
        }
        if (body.baseSalary !== undefined) data.baseSalary = parseFloatSafe(body.baseSalary);

        // --- Check Headcount if Unit is changing ---
        if (body.unitId !== undefined) {
            const cleanUnitId = (body.unitId === '' || body.unitId === 'null' || body.unitId === 'undefined') ? null : body.unitId;

            // Get current employee record to see if they are already in this unit
            const currentEmp = await prisma.employee.findUnique({ where: { id }, select: { unitId: true } });

            if (cleanUnitId && cleanUnitId !== currentEmp?.unitId) {
                const unit = await prisma.unit.findUnique({
                    where: { id: cleanUnitId },
                    include: { _count: { select: { employees: true } } }
                });

                if (unit && unit.headcount > 0) {
                    if (unit._count.employees >= unit.headcount) {
                        return res.status(403).json({ error: `Unit "${unit.name}" has reached its capacity (${unit.headcount}).` });
                    }
                }
            }
        }
        // -------------------------------------------

        // --- Check Job Description staffing plan capacity if changing ---
        if (body.jobDescriptionId !== undefined) {
            const cleanJobDescriptionId = (body.jobDescriptionId === '' || body.jobDescriptionId === 'null' || body.jobDescriptionId === 'undefined') ? null : body.jobDescriptionId;
            data.jobDescriptionId = cleanJobDescriptionId;

            const currentEmpJD = await prisma.employee.findUnique({ where: { id }, select: { jobDescriptionId: true } });

            if (cleanJobDescriptionId && cleanJobDescriptionId !== currentEmpJD?.jobDescriptionId) {
                const jobDescription = await prisma.jobDescription.findUnique({
                    where: { id: cleanJobDescriptionId },
                    include: { _count: { select: { employees: true } } }
                });

                if (!jobDescription) {
                    return res.status(404).json({ error: 'Selected Job Description was not found.' });
                }

                if (jobDescription._count.employees >= jobDescription.plannedCount) {
                    return res.status(403).json({ error: `Job Description "${jobDescription.title}" is above the staffing plan (${jobDescription._count.employees}/${jobDescription.plannedCount} filled).` });
                }
            }
        }
        // -----------------------------------------------------------------

        if (body.joinDate !== undefined) {
            const parsed = parseDate(body.joinDate);
            if (parsed) data.joinDate = parsed;
        }

        if (body.staffId !== undefined) data.staffId = body.staffId || null;
        if (body.position !== undefined) data.position = body.position || null;
        if (body.placeOfWork !== undefined) data.placeOfWork = body.placeOfWork || null;
        if (body.contractStartDate !== undefined) data.contractStartDate = parseDate(body.contractStartDate);
        if (body.contractEndDate !== undefined) data.contractEndDate = parseDate(body.contractEndDate);
        if (body.contractType !== undefined) data.contractType = body.contractType || null;
        if (body.contractStatus !== undefined) data.contractStatus = body.contractStatus || null;
        if (body.holidaysUsed !== undefined) data.holidaysUsed = parseFloatSafe(body.holidaysUsed);
        if (body.emergencyHolidaysUsed !== undefined) data.emergencyHolidaysUsed = parseFloatSafe(body.emergencyHolidaysUsed);
        if (body.unpaidHolidaysUsed !== undefined) data.unpaidHolidaysUsed = parseFloatSafe(body.unpaidHolidaysUsed);
        if (body.bonusHolidays !== undefined) data.bonusHolidays = parseFloatSafe(body.bonusHolidays);
        if (body.fullNameArabic !== undefined) data.fullNameArabic = body.fullNameArabic || null;
        if (body.passportNumber !== undefined) data.passportNumber = body.passportNumber || null;
        if (body.contractNumber !== undefined) data.contractNumber = body.contractNumber || null;
        if (body.nationality !== undefined) data.nationality = body.nationality || null;
        if (body.jobCategory !== undefined) data.jobCategory = body.jobCategory || null;
        if (body.jobGrade !== undefined) data.jobGrade = body.jobGrade || null;
        if (body.salaryStructureType !== undefined) data.salaryStructureType = body.salaryStructureType || null;
        if (body.roleCategory !== undefined) data.roleCategory = body.roleCategory || 'Support';
        if (body.positionFactor !== undefined) data.positionFactor = parseFloatSafe(body.positionFactor);
        if (body.skillFactor !== undefined) data.skillFactor = parseFloatSafe(body.skillFactor);
        if (body.siteFactor !== undefined) data.siteFactor = parseFloatSafe(body.siteFactor);
        if (body.languageFactor !== undefined) data.languageFactor = parseFloatSafe(body.languageFactor);
        if (body.evaluationPoints !== undefined) data.evaluationPoints = parseFloatSafe(body.evaluationPoints);

        // --- Extended Identity Details ---
        if (body.dateOfBirth !== undefined) data.dateOfBirth = parseDate(body.dateOfBirth);
        if (body.placeOfBirth !== undefined) data.placeOfBirth = body.placeOfBirth || null;
        if (body.nationalId !== undefined) data.nationalId = body.nationalId || null;
        if (body.academicQualification !== undefined) data.academicQualification = body.academicQualification || null;
        if (body.gender !== undefined) data.gender = body.gender || null;
        if (body.bloodType !== undefined) data.bloodType = body.bloodType || null;
        if (body.idCardNumber !== undefined) data.idCardNumber = body.idCardNumber || null;
        if (body.idPlaceOfIssue !== undefined) data.idPlaceOfIssue = body.idPlaceOfIssue || null;
        if (body.idIssueDate !== undefined) data.idIssueDate = parseDate(body.idIssueDate);
        if (body.passportPlaceOfIssue !== undefined) data.passportPlaceOfIssue = body.passportPlaceOfIssue || null;
        if (body.passportExpiryDate !== undefined) data.passportExpiryDate = parseDate(body.passportExpiryDate);
        if (body.drivingLicenseType !== undefined) data.drivingLicenseType = body.drivingLicenseType || null;
        if (body.drivingLicenseNumber !== undefined) data.drivingLicenseNumber = body.drivingLicenseNumber || null;
        if (body.drivingLicenseExpiry !== undefined) data.drivingLicenseExpiry = parseDate(body.drivingLicenseExpiry);
        if (body.drivingLicensePlaceOfIssue !== undefined) data.drivingLicensePlaceOfIssue = body.drivingLicensePlaceOfIssue || null;
        if (body.personalPhone !== undefined) data.personalPhone = body.personalPhone || null;
        if (body.personalEmail !== undefined) data.personalEmail = body.personalEmail || null;
        if (body.emergencyContactNumber !== undefined) data.emergencyContactNumber = body.emergencyContactNumber || null;
        if (body.residentialAddress !== undefined) data.residentialAddress = body.residentialAddress || null;
        if (body.workedBefore !== undefined) data.workedBefore = body.workedBefore || null;
        if (body.hasRelativesInCompany !== undefined) data.hasRelativesInCompany = body.hasRelativesInCompany || null;
        if (body.relativesNames !== undefined) data.relativesNames = body.relativesNames || null;
        if (body.bankName !== undefined) data.bankName = body.bankName || null;
        if (body.bankBranchName !== undefined) data.bankBranchName = body.bankBranchName || null;
        if (body.bankAccountNumber !== undefined) data.bankAccountNumber = body.bankAccountNumber || null;
        if (body.arrivalDate !== undefined) data.arrivalDate = parseDate(body.arrivalDate);
        if (body.cvUrl !== undefined) data.cvUrl = body.cvUrl || null;
        if (body.degreeUrl !== undefined) data.degreeUrl = body.degreeUrl || null;
        if (body.birthCertUrl !== undefined) data.birthCertUrl = body.birthCertUrl || null;
        if (body.passportCopyUrl !== undefined) data.passportCopyUrl = body.passportCopyUrl || null;
        if (body.bankCheckUrl !== undefined) data.bankCheckUrl = body.bankCheckUrl || null;
        if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null;
        if (body.idCardUrl !== undefined) data.idCardUrl = body.idCardUrl || null;
        if (body.jobOfferUrl !== undefined) data.jobOfferUrl = body.jobOfferUrl || null;
        if (body.healthCertUrl !== undefined) data.healthCertUrl = body.healthCertUrl || null;

        // --- Arabic counterparts of the bilingual onboarding fields ---
        if (body.placeOfBirthArabic !== undefined) data.placeOfBirthArabic = body.placeOfBirthArabic || null;
        if (body.nationalityArabic !== undefined) data.nationalityArabic = body.nationalityArabic || null;
        if (body.academicQualificationArabic !== undefined) data.academicQualificationArabic = body.academicQualificationArabic || null;
        if (body.idPlaceOfIssueArabic !== undefined) data.idPlaceOfIssueArabic = body.idPlaceOfIssueArabic || null;
        if (body.passportPlaceOfIssueArabic !== undefined) data.passportPlaceOfIssueArabic = body.passportPlaceOfIssueArabic || null;
        if (body.drivingLicenseTypeArabic !== undefined) data.drivingLicenseTypeArabic = body.drivingLicenseTypeArabic || null;
        if (body.drivingLicensePlaceOfIssueArabic !== undefined) data.drivingLicensePlaceOfIssueArabic = body.drivingLicensePlaceOfIssueArabic || null;
        if (body.residentialAddressArabic !== undefined) data.residentialAddressArabic = body.residentialAddressArabic || null;
        if (body.relativesNamesArabic !== undefined) data.relativesNamesArabic = body.relativesNamesArabic || null;
        if (body.bankNameArabic !== undefined) data.bankNameArabic = body.bankNameArabic || null;
        if (body.bankBranchNameArabic !== undefined) data.bankBranchNameArabic = body.bankBranchNameArabic || null;

        // --- Onboarding-only fields (self-service onboarding form) ---
        if (body.serviceProviderCompany !== undefined) data.serviceProviderCompany = body.serviceProviderCompany || null;
        if (body.employeeTravelDate !== undefined) data.employeeTravelDate = parseDate(body.employeeTravelDate);
        if (body.employeeStartDate !== undefined) data.employeeStartDate = parseDate(body.employeeStartDate);
        if (body.ticketUrl !== undefined) data.ticketUrl = body.ticketUrl || null;
        if (body.residencyDocumentUrl !== undefined) data.residencyDocumentUrl = body.residencyDocumentUrl || null;
        if (body.interviewEvaluationUrl !== undefined) data.interviewEvaluationUrl = body.interviewEvaluationUrl || null;

        // Fetch current values to check exclusivity against updates
        const currentEmp = await prisma.employee.findUnique({ where: { id } });

        // Dynamic Position Factor Logic for Update
        const targetRole = data.role || currentEmp?.role;
        const targetDeptId = data.departmentId !== undefined ? data.departmentId : currentEmp?.departmentId;
        const targetDivId = data.divisionId !== undefined ? data.divisionId : currentEmp?.divisionId;
        const targetDirId = data.directorateId !== undefined ? data.directorateId : currentEmp?.directorateId;
        const targetUnitId = data.unitId !== undefined ? data.unitId : currentEmp?.unitId;

        if ((targetRole === 'HEAD_DEPARTMENT' || targetRole === 'HEAD_OFFICE') && targetDeptId) {
            const dept = await prisma.department.findUnique({ where: { id: targetDeptId } });
            if (dept && dept.positionFactor) data.positionFactor = dept.positionFactor;
        } else if (targetRole === 'HEAD_DIVISION' && targetDivId) {
            const div = await prisma.division.findUnique({ where: { id: targetDivId } });
            if (div && div.positionFactor) data.positionFactor = div.positionFactor;
        } else if (targetRole === 'HEAD_DIRECTORATE' && targetDirId) {
            const dir = await prisma.directorate.findUnique({ where: { id: targetDirId } });
            if (dir && dir.positionFactor) data.positionFactor = dir.positionFactor;
        } else if (targetRole === 'HEAD_UNIT' && targetUnitId) {
            const unit = await prisma.unit.findUnique({ where: { id: targetUnitId }, include: { _count: { select: { employees: true } } } });
            if (unit) {
                data.positionFactor = unit._count.employees < 5 ? 1.15 : 1.20;
            }
        } else if (targetRole === 'GENERAL_MANAGER') {
            data.positionFactor = 1.60;
        }

        const finalPF = data.positionFactor !== undefined ? data.positionFactor : (currentEmp?.positionFactor || 1.0);
        let finalSF = data.skillFactor !== undefined ? data.skillFactor : (currentEmp?.skillFactor || 1.0);

        if (finalPF > 1.0 && finalSF > 1.0) {
            // Since positionFactor might be dynamically assigned based on role, prioritize it
            data.skillFactor = 1.0;
            finalSF = 1.0;
        }

        console.log('Final Database Update Payload:', JSON.stringify(data, null, 2));

        if (data.departmentId && (!data.divisionId || !data.directorateId)) {
            const dept = await prisma.department.findUnique({
                where: { id: data.departmentId },
                include: { division: true }
            });
            if (dept) {
                if (!data.divisionId && dept.divisionId) data.divisionId = dept.divisionId;
                if (!data.directorateId && dept.division?.directorateId) data.directorateId = dept.division.directorateId;
            }
        }

        // --- Complete enrolment of a BioTime-imported stub ---------------------------------------
        // A PENDING_ENROLLMENT employee becomes ACTIVE only through this guarded path, triggered by
        // the request explicitly setting enrollmentStatus=ACTIVE (the "Complete Enrolment" action).
        // This is where the deferred login account/email is finally created. Ordinary edits of an
        // already-active employee never reach this branch, so they can't accidentally spawn accounts.
        const isCompletingEnrolment =
            currentEmp?.enrollmentStatus === 'PENDING_ENROLLMENT' && body.enrollmentStatus === 'ACTIVE';

        if (isCompletingEnrolment) {
            const finalRole = data.role || currentEmp?.role || 'EMPLOYEE';
            const globalScopeRoles = ['GENERAL_MANAGER', 'CHAIRMAN'];
            const finalJD = data.jobDescriptionId !== undefined ? data.jobDescriptionId : currentEmp?.jobDescriptionId;
            if (!globalScopeRoles.includes(finalRole) && !finalJD) {
                return res.status(400).json({ error: 'A Job Description must be assigned to complete enrolment.' });
            }

            const finalDept = data.departmentId !== undefined ? data.departmentId : currentEmp?.departmentId;
            const rolesRequiringDept = ['EMPLOYEE', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HEAD_OFFICE'];
            if (rolesRequiringDept.includes(finalRole) && !finalDept) {
                return res.status(400).json({ error: `A Department is required to complete enrolment for the ${String(finalRole).replace(/_/g, ' ').toLowerCase()} role.` });
            }

            // Create the login account now — the first time this imported person gets one.
            if (!currentEmp?.userId) {
                const emailForAccount = data.email !== undefined ? data.email : currentEmp?.email;
                if (!emailForAccount) {
                    return res.status(400).json({ error: 'An email address is required to create the login account when completing enrolment.' });
                }
                const existingUser = await prisma.user.findFirst({ where: { email: { equals: emailForAccount, mode: 'insensitive' } } });
                if (existingUser) {
                    return res.status(400).json({ error: 'A system account with this email already exists.' });
                }
                const hashedPassword = await bcrypt.hash(body.password || '123456', 10);
                const seededPermissions = (body.permissions && body.permissions.length) ? body.permissions : presetForRole(finalRole);
                const newUser = await prisma.user.create({
                    data: {
                        email: emailForAccount,
                        password: hashedPassword,
                        fullName: data.fullName || currentEmp?.fullName || emailForAccount,
                        role: finalRole,
                        departmentId: finalDept || null,
                        unitId: (data.unitId !== undefined ? data.unitId : currentEmp?.unitId) || null,
                        groupId: (data.groupId !== undefined ? data.groupId : currentEmp?.groupId) || null,
                        permissions: seededPermissions,
                    },
                });
                data.userId = newUser.id;
            }

            data.enrollmentStatus = 'ACTIVE';
        }
        // -----------------------------------------------------------------------------------------

        const employee = await prisma.employee.update({
            where: { id },
            data
        });

        if (employee.userId) {
            const userUpdateData: any = {};
            if (data.fullName !== undefined) userUpdateData.fullName = data.fullName;
            if (data.email !== undefined) userUpdateData.email = data.email;
            if (data.role !== undefined) userUpdateData.role = data.role;
            if (data.departmentId !== undefined) userUpdateData.departmentId = data.departmentId;
            if (data.unitId !== undefined) userUpdateData.unitId = data.unitId;
            if (data.groupId !== undefined) userUpdateData.groupId = data.groupId;
            if (body.permissions !== undefined) userUpdateData.permissions = body.permissions;

            if (body.password) {
                userUpdateData.password = await bcrypt.hash(body.password, 10);
            }
            
            if (Object.keys(userUpdateData).length > 0) {
                await prisma.user.update({
                    where: { id: employee.userId },
                    data: userUpdateData
                }).catch(err => console.error('Failed to sync user data during employee update:', err));
            }
        }

        res.json(employee);
    } catch (error: any) {
        console.error('CRITICAL_UPDATE_ERROR:', error);
        res.status(500).json({
            error: 'Failed to update employee',
            details: error.message
        });
    }
};

export const deleteEmployee = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.employee.delete({ where: { id } });
        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete employee' });
    }
};

export const getExpiringContracts = async (req: Request, res: Response) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + days);
        futureDate.setHours(23, 59, 59, 999);

        const employees = await (prisma as any).employee.findMany({
            where: {
                contractEndDate: {
                    lte: futureDate,
                    not: null
                },
                OR: [
                    { contractStatus: { not: 'Inactive' } },
                    { contractStatus: null }
                ]
            },
            include: {
                department: true,
                group: true
            }
        });

        res.json(employees);
    } catch (error) {
        console.error('Error fetching expiring contracts:', error);
        res.status(500).json({ error: 'Failed to fetch expiring contracts' });
    }
};

export const getMyEmployeeRecord = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const employee = await prisma.employee.findUnique({
            where: { userId: req.user.id },
            include: { jobDescription: true }
        });

        if (!employee) {
            const employeeByEmail = await prisma.employee.findFirst({
                where: { email: req.user.email }
            });
            if (employeeByEmail) {
                const updated = await prisma.employee.update({
                    where: { id: employeeByEmail.id },
                    data: { userId: req.user.id }
                });
                return res.json({
                    ...updated,
                    ...calculateHolidayMetrics(updated.contractStartDate, updated.holidaysUsed, updated.bonusHolidays, updated.emergencyHolidaysUsed, updated.unpaidHolidaysUsed)
                });
            }

            const user = await prisma.user.findUnique({
                where: { id: req.user.id }
            });

            if (user) {
                return res.json({
                    id: `user-${user.id}`,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    departmentId: user.departmentId,
                    groupId: user.groupId,
                    unitId: user.unitId,
                    joinDate: user.createdAt,
                    contractStatus: 'Active',
                    baseSalary: 0,
                    isSynthesized: true,
                    accruedHolidays: 0, earnedHolidays: 0, remainingHolidays: 0
                });
            }

            return res.status(404).json({ error: 'Employee record not found' });
        }

        res.json({
            ...employee,
            ...calculateHolidayMetrics(employee.contractStartDate, employee.holidaysUsed, employee.bonusHolidays, employee.emergencyHolidaysUsed, employee.unpaidHolidaysUsed)
        });
    } catch (error) {
        console.error('Error fetching my employee record:', error);
        res.status(500).json({ error: 'Failed to fetch employee record' });
    }
};

export const renewContract = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, salary, contractNumber, type, notes } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch current employee data for snapshot
            const employee = await tx.employee.findUnique({ where: { id } });
            if (!employee) throw new Error('Employee not found');

            // Paid leave carries into the new contract capped at 14 days — compute it from the
            // OLD contract's numbers before anything gets reset. Emergency/unpaid do NOT carry
            // over; they reset to a fresh 3/14-day allowance every contract (existing reset below).
            const { remainingHolidays: oldRemainingHolidays } = calculateHolidayMetrics(
                employee.contractStartDate, employee.holidaysUsed, employee.bonusHolidays
            );
            const carriedOverHolidays = Math.max(0, Math.min(oldRemainingHolidays, PAID_LEAVE_CARRYOVER_CAP));

            // 2. Archive current ACTIVE contracts with SNAPSHOT data
            await tx.contract.updateMany({
                where: { employeeId: id, status: 'ACTIVE' },
                data: { 
                    status: 'ARCHIVED',
                    position: employee.position,
                    jobCategory: employee.jobCategory,
                    jobGrade: employee.jobGrade,
                    salary: employee.baseSalary,
                    holidaysUsed: employee.holidaysUsed,
                    emergencyHolidaysUsed: employee.emergencyHolidaysUsed,
                    unpaidHolidaysUsed: employee.unpaidHolidaysUsed,
                    notes: notes ? `Renewed on ${new Date().toLocaleDateString()}. Notes: ${notes}` : `Renewed on ${new Date().toLocaleDateString()}`
                } as any
            });

            // 3. Create NEW contract (ACTIVE)
            const newContract = await tx.contract.create({
                data: {
                    employeeId: id,
                    startDate: new Date(startDate),
                    endDate: endDate ? new Date(endDate) : null,
                    salary: parseFloatSafe(salary),
                    contractNumber: contractNumber || null,
                    type: type || null,
                    notes: notes || null,
                    status: 'ACTIVE'
                }
            });

            // 4. Update Employee (Reset Leave Stats)
            await tx.employee.update({
                where: { id },
                data: {
                    contractStartDate: new Date(startDate),
                    contractEndDate: endDate ? new Date(endDate) : null,
                    contractNumber: contractNumber || null,
                    baseSalary: parseFloatSafe(salary),
                    contractStatus: 'Active',
                    holidaysUsed: 0,
                    bonusHolidays: carriedOverHolidays,
                    emergencyHolidaysUsed: 0,
                    unpaidHolidaysUsed: 0
                }
            });

            return newContract;
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error renewing contract:', error);
        res.status(500).json({ error: 'Failed to renew contract', details: error.message });
    }
};

export const terminateEmployee = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { terminationDate, reason, notes } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch current employee data for snapshot
            const currentEmployee = await tx.employee.findUnique({ where: { id } });
            if (!currentEmployee) throw new Error('Employee not found');

            // 2. Update Employee Status
            const employee = await tx.employee.update({
                where: { id },
                data: {
                    contractStatus: 'Inactive',
                    contractEndDate: new Date(terminationDate)
                }
            });

            // 3. Update ACTIVE contracts with SNAPSHOT data
            await tx.contract.updateMany({
                where: { employeeId: id, status: 'ACTIVE' },
                data: { 
                    status: 'TERMINATED',
                    position: currentEmployee.position,
                    jobCategory: currentEmployee.jobCategory,
                    jobGrade: currentEmployee.jobGrade,
                    salary: currentEmployee.baseSalary,
                    holidaysUsed: currentEmployee.holidaysUsed,
                    emergencyHolidaysUsed: currentEmployee.emergencyHolidaysUsed,
                    unpaidHolidaysUsed: currentEmployee.unpaidHolidaysUsed,
                    notes: notes ? `Termination Reason: ${reason}. Notes: ${notes}` : `Termination Reason: ${reason}`
                } as any
            });

            return employee;
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error terminating employee:', error);
        res.status(500).json({ error: 'Failed to terminate employee', details: error.message });
    }
};
