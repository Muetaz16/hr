import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const calculateHolidayMetrics = (joinDateStr: string | Date, holidaysUsed: number, bonusHolidays: number = 0) => {
    const joinDate = new Date(joinDateStr);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - joinDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const accruedHolidays = Math.floor(diffDays / 12);
    const earnedHolidays = accruedHolidays + (bonusHolidays || 0);
    const remainingHolidays = earnedHolidays - (holidaysUsed || 0);
    return { accruedHolidays, earnedHolidays, remainingHolidays };
};

export const getAllEmployees = async (req: AuthRequest, res: Response) => {
    try {
        const where: any = {};
        
        // Scope filtering based on role
        if (['HEAD_UNIT', 'HEAD_DEPARTMENT', 'HEAD_DIRECTOR', 'SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'].includes(req.user?.role || '')) {
            // Managers and Admin see all
        } else if (req.user?.role === 'EMPLOYEE' && req.user?.departmentId) {
            where.OR = [
                { departmentId: req.user.departmentId },
                { role: { in: ['HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'SUPER_ADMIN', 'HR_MANAGER'] } }
            ];
        }

        const employees = await prisma.employee.findMany({ where });
        const employeesWithHolidays = employees.map(emp => ({
            ...emp,
            ...calculateHolidayMetrics(emp.joinDate, (emp as any).holidaysUsed, (emp as any).bonusHolidays)
        }));
        res.json(employeesWithHolidays);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
};

export const getEmployeeById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const employee = await prisma.employee.findUnique({ where: { id } });
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({
            ...employee,
            ...calculateHolidayMetrics(employee.joinDate, (employee as any).holidaysUsed, (employee as any).bonusHolidays)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch employee' });
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

export const createEmployee = async (req: Request, res: Response) => {
    try {
        const {
            id, fullName, email, password, role, departmentId, unitId, groupId, baseSalary, joinDate, staffId,
            position, contractStartDate, contractEndDate, contractType, contractStatus, holidaysUsed, bonusHolidays,
            fullNameArabic, passportNumber, contractNumber, nationality, jobCategory, jobGrade, emergencyHolidaysUsed,
            unpaidHolidaysUsed
        } = req.body;

        // Sanitization of foreign keys
        const cleanUnitId = (unitId === '' || unitId === 'null' || unitId === 'undefined' || !unitId) ? null : unitId;
        const cleanDeptId = (departmentId === '' || departmentId === 'null' || departmentId === 'undefined') ? null : departmentId;
        const cleanGroupId = (groupId === '' || groupId === 'null' || groupId === 'undefined') ? null : groupId;

        console.log('Creating employee with data:', { id, fullName, email, departmentId: cleanDeptId, groupId: cleanGroupId, unitId: cleanUnitId });

        // Validate required fields
        if (role !== 'HEAD_DIRECTOR' && (!cleanDeptId || !cleanGroupId)) {
            console.error('Missing departmentId or groupId');
            return res.status(400).json({ error: 'Department and Group are required' });
        }

        if (role === 'HEAD_DIRECTOR' && !cleanGroupId) {
            console.error('Missing groupId for Director');
            return res.status(400).json({ error: 'Group is required' });
        }

        // Use a transaction to ensure both Employee and User are created or none
        const result = await prisma.$transaction(async (tx) => {
            let userId: string | undefined;

            // 1. Create User if email and password are provided
            if (email && password) {
                const existingUser = await tx.user.findUnique({ where: { email } });
                if (existingUser) {
                    throw new Error('User with this email already exists');
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                const user = await tx.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        fullName,
                        role: role || 'EMPLOYEE',
                        departmentId: cleanDeptId,
                        unitId: cleanUnitId,
                        groupId: cleanGroupId
                    }
                });
                userId = user.id;
            }

            // 2. Create Employee
            const data: any = {
                fullName,
                email: email || null,
                role: role || 'EMPLOYEE',
                departmentId: cleanDeptId,
                unitId: cleanUnitId,
                groupId: cleanGroupId,
                baseSalary: parseFloatSafe(baseSalary),
                joinDate: parseDate(joinDate) || new Date().toISOString(),
                staffId: staffId || null,
                position: position || null,
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
                userId: userId || null
            };
            if (id) data.id = id;

            return tx.employee.create({ data });
        });

        res.json(result);
    } catch (error: any) {
        console.error("Error creating employee:", error);
        res.status(500).json({ error: error.message || 'Failed to create employee' });
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
        if (body.departmentId !== undefined) data.departmentId = body.departmentId;
        if (body.unitId !== undefined) {
            data.unitId = (body.unitId === '' || body.unitId === 'null' || body.unitId === 'undefined') ? null : body.unitId;
        }
        if (body.groupId !== undefined) data.groupId = body.groupId;
        if (body.baseSalary !== undefined) data.baseSalary = parseFloatSafe(body.baseSalary);

        if (body.joinDate !== undefined) {
            const parsed = parseDate(body.joinDate);
            if (parsed) data.joinDate = parsed;
            // Don't set to null if required and invalid
        }

        if (body.staffId !== undefined) data.staffId = body.staffId || null;
        if (body.position !== undefined) data.position = body.position || null;
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

        console.log('Final Database Update Payload:', JSON.stringify(data, null, 2));

        const employee = await prisma.employee.update({
            where: { id },
            data
        });

        // Sync with linked User account if applicable
        if (employee.userId) {
            const userUpdateData: any = {};
            if (data.fullName !== undefined) userUpdateData.fullName = data.fullName;
            if (data.email !== undefined) userUpdateData.email = data.email;
            
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
            details: error.message,
            code: error.code,
            meta: error.meta
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

        console.log(`[DEBUG] getExpiringContracts: days=${days}, futureDate=${futureDate.toISOString()}`);

        const employees = await (prisma as any).employee.findMany({
            where: {
                contractEndDate: {
                    lte: futureDate,
                    not: null // Explicitly ensure we only get those with a date
                },
                OR: [
                    { contractStatus: { not: 'Terminated' } },
                    { contractStatus: null }
                ]
            },
            include: {
                department: true,
                group: true
            }
        });

        console.log(`[DEBUG] Found ${employees.length} expiring contracts.`);
        if (employees.length > 0) {
            console.log(`[DEBUG] Sample: ${employees[0].fullName}, EndDate: ${employees[0].contractEndDate}`);
        }

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
            where: { userId: req.user.id }
        });

        if (!employee) {
            // Check by email as fallback
            const employeeByEmail = await prisma.employee.findFirst({
                where: { email: req.user.email }
            });

            if (employeeByEmail) {
                const updated = await prisma.employee.update({
                    where: { id: employeeByEmail.id },
                    data: { userId: req.user.id }
                });
                return res.json(updated);
            }

            // If still no employee, synthesize a basic record from User to avoid 404
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
                    isSynthesized: true // Flag to indicate this isn't a full employee record
                });
            }


            return res.status(404).json({ error: 'Employee record not found' });
        }

        res.json(employee);
    } catch (error) {
        console.error('Error fetching my employee record:', error);
        res.status(500).json({ error: 'Failed to fetch employee record' });
    }
};
