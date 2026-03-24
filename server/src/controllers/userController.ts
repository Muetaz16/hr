import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Get all users
export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                departmentId: true,
                unitId: true,
                departmentIds: true,
                groupId: true,
                createdAt: true,
                employee: {
                    select: {
                        id: true,
                        position: true
                    }
                }
            }
        });
        
        // Flatten employee object for frontend ease
        const flattenedUsers = users.map(u => ({
            ...u,
            employeeId: u.employee?.id
        }));
        
        res.json(flattenedUsers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Create a new user
export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, password, fullName, role, departmentId, unitId, departmentIds, groupId, employeeId } = req.body;
        const normalizedEmail = email?.toLowerCase();

        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const data: any = {
            email: normalizedEmail,
            password: hashedPassword,
            fullName,
            role,
            departmentId,
            unitId,
            departmentIds: departmentIds || [],
            groupId,
        };
        if (req.body.id) data.id = req.body.id;

        const user = await prisma.user.create({
            data,
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                departmentId: true,
                unitId: true,
                departmentIds: true,
                groupId: true,
                createdAt: true,
            }
        });

        // Link to employee if ID provided
        if (employeeId) {
            await prisma.employee.update({
                where: { id: employeeId },
                data: { userId: user.id }
            });
        }

        res.status(201).json(user);
    } catch (error) {
        console.error("Create User Error:", error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { email, fullName, role, departmentId, unitId, departmentIds, groupId, password, employeeId } = req.body;
        const normalizedEmail = email?.toLowerCase();

        const dataToUpdate: any = {
            email: normalizedEmail,
            fullName,
            role,
            departmentId,
            unitId,
            departmentIds: departmentIds || [],
            groupId,
        };

        if (password) {
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: dataToUpdate,
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                departmentId: true,
                unitId: true,
                departmentIds: true,
                groupId: true,
                createdAt: true,
            }
        });

        // Update employee link
        if (employeeId !== undefined) {
          // First, clear any existing links for this user from other employees
          await prisma.employee.updateMany({
            where: { userId: user.id },
            data: { userId: null }
          });
          
          if (employeeId) {
            // Then, link the new employee
            await prisma.employee.update({
              where: { id: employeeId },
              data: { userId: user.id }
            });
          }
        }

        res.json(user);
    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(`[USER][DELETE] Start: id=${id}`);
    try {
        // Clear all relations to avoid foreign key constraint errors
        await prisma.$transaction([
            // 1. Clear linked Employee
            prisma.employee.updateMany({
                where: { userId: id },
                data: { userId: null }
            }),
            // 2. Clear Leave Request approvals
            prisma.leaveRequest.updateMany({
                where: { unitApprovedById: id },
                data: { unitApprovedById: null }
            }),
            prisma.leaveRequest.updateMany({
                where: { deptApprovedById: id },
                data: { deptApprovedById: null }
            }),
            prisma.leaveRequest.updateMany({
                where: { directorApprovedById: id },
                data: { directorApprovedById: null }
            }),
            // 3. Clear Task assignments and authorship
            prisma.staffTask.updateMany({
                where: { authorId: id },
                data: { authorId: null }
            }),
            prisma.staffTask.updateMany({
                where: { assigneeId: id },
                data: { assigneeId: null }
            }),
            // 4. Clear Announcements
            prisma.announcement.updateMany({
                where: { authorId: id },
                data: { authorId: null }
            }),
            // 5. Clear Evaluations submitted by user
            prisma.hREvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            prisma.unitEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            prisma.departmentEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            prisma.directorEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            prisma.personnelEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            // 6. Clear Evaluation Periods enabled by user
            prisma.evaluationPeriod.updateMany({
                where: { enabledById: id },
                data: { enabledById: null }
            }),
            // 7. Delete records strictly owned by user (normally cascades, but safe to force)
            prisma.notification.deleteMany({
                where: { userId: id }
            }),
            prisma.leaveRequest.deleteMany({
                where: { userId: id }
            }),
            // 8. Final Delete
            prisma.user.delete({ where: { id } })
        ]);

        console.log(`[USER][DELETE] Success: id=${id}`);
        res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        console.error(`[USER][DELETE] Error: id=${id}`, error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ 
            error: 'Failed to delete user. Please ensure all related data is properly handled.',
            details: error.message 
        });
    }
};
