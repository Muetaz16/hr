import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const calculateHolidayMetrics = (contractStartDateStr: string | Date | null, holidaysUsed: number, bonusHolidays: number = 0) => {
    if (!contractStartDateStr) return { accruedHolidays: 0, earnedHolidays: 0, remainingHolidays: 0 };
    const contractStartDate = new Date(contractStartDateStr);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - contractStartDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const accruedHolidays = Math.floor(diffDays / 12);
    const earnedHolidays = accruedHolidays + (bonusHolidays || 0);
    const remainingHolidays = earnedHolidays - (holidaysUsed || 0);
    return { accruedHolidays, earnedHolidays, remainingHolidays };
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
            include: { user: { select: { permissions: true } } }
        });

        const isSensitiveRole = ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'].includes(role);

        const employeesWithHolidays = employees.map(emp => {
            const data: any = {
                ...emp,
                permissions: (emp as any).user?.permissions || [],
                ...calculateHolidayMetrics(emp.contractStartDate, (emp as any).holidaysUsed, (emp as any).bonusHolidays)
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
            ...calculateHolidayMetrics(employee.contractStartDate, (employee as any).holidaysUsed, (employee as any).bonusHolidays)
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
            id, fullName, email, password, role, departmentId, unitId, groupId, divisionId, directorateId, baseSalary, joinDate, staffId,
            position, contractStartDate, contractEndDate, contractType, contractStatus, holidaysUsed, bonusHolidays,
                fullNameArabic, passportNumber, contractNumber, nationality, jobCategory, jobGrade, emergencyHolidaysUsed,
            unpaidHolidaysUsed, permissions, roleCategory, positionFactor, skillFactor, siteFactor, languageFactor
        } = req.body;

        // Sanitization of foreign keys
        const cleanUnitId = (unitId === '' || unitId === 'null' || unitId === 'undefined' || !unitId) ? null : unitId;
        const cleanDeptId = (departmentId === '' || departmentId === 'null' || departmentId === 'undefined') ? null : departmentId;
        const cleanGroupId = (groupId === '' || groupId === 'null' || groupId === 'undefined') ? null : groupId;
        const cleanDivisionId = (divisionId === '' || divisionId === 'null' || divisionId === 'undefined' || !divisionId) ? null : divisionId;
        const cleanDirectorateId = (directorateId === '' || directorateId === 'null' || directorateId === 'undefined' || !directorateId) ? null : directorateId;

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
                        groupId: cleanGroupId,
                        permissions: permissions || []
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

            // 2. Create Employee
            const data: any = {
                fullName,
                email: email || null,
                role: role || 'EMPLOYEE',
                departmentId: cleanDeptId,
                unitId: cleanUnitId,
                groupId: cleanGroupId,
                divisionId: cleanDivisionId,
                directorateId: cleanDirectorateId,
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
                roleCategory: roleCategory || 'Support',
                positionFactor: parseFloatSafe(positionFactor) || 1.0,
                skillFactor: parseFloatSafe(skillFactor) || 1.0,
                siteFactor: parseFloatSafe(siteFactor) || 1.0,
                languageFactor: parseFloatSafe(languageFactor) || 1.0
            };

            // Enforce Exclusivity: Position Factor OR Skill Factor
            if (data.positionFactor > 1.0 && data.skillFactor > 1.0) {
                throw new Error('Employee cannot have both Position Factor and Skill Factor simultaneously.');
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
        if (body.groupId !== undefined) data.groupId = body.groupId;
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

        if (body.joinDate !== undefined) {
            const parsed = parseDate(body.joinDate);
            if (parsed) data.joinDate = parsed;
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
        if (body.roleCategory !== undefined) data.roleCategory = body.roleCategory || 'Support';
        if (body.positionFactor !== undefined) data.positionFactor = parseFloatSafe(body.positionFactor);
        if (body.skillFactor !== undefined) data.skillFactor = parseFloatSafe(body.skillFactor);
        if (body.siteFactor !== undefined) data.siteFactor = parseFloatSafe(body.siteFactor);
        if (body.languageFactor !== undefined) data.languageFactor = parseFloatSafe(body.languageFactor);

        // Fetch current values to check exclusivity against updates
        const currentEmp = await prisma.employee.findUnique({ where: { id } });
        const finalPF = data.positionFactor !== undefined ? data.positionFactor : (currentEmp?.positionFactor || 1.0);
        const finalSF = data.skillFactor !== undefined ? data.skillFactor : (currentEmp?.skillFactor || 1.0);

        if (finalPF > 1.0 && finalSF > 1.0) {
            return res.status(400).json({ error: 'Employee cannot have both Position Factor and Skill Factor simultaneously.' });
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
            where: { userId: req.user.id }
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
                    ...calculateHolidayMetrics(updated.contractStartDate, updated.holidaysUsed, updated.bonusHolidays)
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
            ...calculateHolidayMetrics(employee.contractStartDate, employee.holidaysUsed, employee.bonusHolidays)
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
