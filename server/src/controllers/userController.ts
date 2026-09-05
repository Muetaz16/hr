import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { prisma } from '../lib/prisma';
import { POSITIONS, ALL_PERMISSION_IDS } from '../utils/accessCatalog';

// User.role is a plain String in the schema, so without this guard any value could be written
// straight through the API — including the retired 'HR_MANAGER'/'PERSONNEL' strings, which no
// longer grant anything and would silently produce an account with no access. A user holds exactly
// one POSITION; HR-Manager/Personnel powers come from the same-named Functional Hats instead.
const isValidPosition = (role: unknown): role is string => typeof role === 'string' && (POSITIONS as readonly string[]).includes(role);
const INVALID_ROLE_ERROR = `Invalid position. Must be one of: ${POSITIONS.join(', ')}. HR Manager / Personnel are Functional Hats, not positions.`;

// Individual grants are stored unsanitised otherwise, so a stale or invented key would persist
// forever — mirrors functionalHatController's sanitizePermissions.
const sanitizeGrants = (perms: unknown): string[] =>
    Array.isArray(perms) ? perms.filter((p): p is string => typeof p === 'string' && ALL_PERMISSION_IDS.includes(p)) : [];

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
                divisionId: true,
                departmentIds: true,
                groupId: true,
                permissions: true,
                functionalHatIds: true,
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
        const { email, password, fullName, role, departmentId, unitId, divisionId, departmentIds, groupId, employeeId, permissions, functionalHatIds } = req.body;
        if (!isValidPosition(role)) return res.status(400).json({ error: INVALID_ROLE_ERROR });
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
            divisionId: divisionId || null,
            departmentIds: departmentIds || [],
            groupId,
            permissions: sanitizeGrants(permissions),
            functionalHatIds: functionalHatIds || [],
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
                divisionId: true,
                departmentIds: true,
                groupId: true,
                permissions: true,
                functionalHatIds: true,
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
        const { email, fullName, role, departmentId, unitId, divisionId, departmentIds, groupId, password, employeeId, permissions, functionalHatIds } = req.body;
        if (role !== undefined && !isValidPosition(role)) return res.status(400).json({ error: INVALID_ROLE_ERROR });
        const normalizedEmail = email?.toLowerCase();

        const dataToUpdate: any = {
            email: normalizedEmail,
            fullName,
            role,
            departmentId,
            unitId,
            divisionId: divisionId || null,
            departmentIds: departmentIds || [],
            groupId,
            permissions: sanitizeGrants(permissions),
            functionalHatIds: functionalHatIds || [],
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
                divisionId: true,
                departmentIds: true,
                groupId: true,
                permissions: true,
                functionalHatIds: true,
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

        // Reverse-direction role sync (Employee.role is the other half of this Employee<->User
        // sync pair — see employeeController.ts's updateEmployee). Role is meant to represent the
        // same real-world thing on both records (this person's org position); without this, editing
        // role from Access Management only ever changed User.role, leaving Employee.role (which
        // independently drives evaluation-hierarchy eligibility) silently stale.
        let employeeSyncError: string | undefined;
        if (role !== undefined) {
            const linkedEmployeeId = employeeId !== undefined
                ? (employeeId || null)
                : (await prisma.employee.findFirst({ where: { userId: user.id }, select: { id: true } }))?.id ?? null;
            if (linkedEmployeeId) {
                try {
                    await prisma.employee.update({ where: { id: linkedEmployeeId }, data: { role } });
                } catch (err: any) {
                    console.error('Failed to sync role to linked employee during user update:', err);
                    employeeSyncError = 'The user was saved, but syncing the role to the linked employee record failed — it may now be out of sync.';
                }
            }
        }

        res.json({ ...user, ...(employeeSyncError ? { employeeSyncError } : {}) });
    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Delete user
// Clears every relation that would otherwise block a hard User delete (FK restrict on
// required relations, e.g. LeaveApprovalStep.approver / RecruitmentRequest.requester),
// then deletes the User row itself. Shared by the standalone "delete user" admin action
// and by deleteEmployee (which also removes the employee's login account).
export async function purgeUserAndRelations(id: string) {
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
            // 3. Clear Announcements
            prisma.announcement.updateMany({
                where: { authorId: id },
                data: { authorId: null }
            }),
            // 4. Clear Evaluations submitted by user
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
            prisma.divisionEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            prisma.gMEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            prisma.chairmanEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            prisma.personnelEvaluation.updateMany({
                where: { submittedById: id },
                data: { submittedById: null }
            }),
            // 5. Clear Evaluation Periods enabled by user
            prisma.evaluationPeriod.updateMany({
                where: { enabledById: id },
                data: { enabledById: null }
            }),
            // 6. Clear Recruitment approvals (nullable) done by this user
            prisma.recruitmentRequest.updateMany({
                where: { deptApprovedById: id },
                data: { deptApprovedById: null }
            }),
            prisma.recruitmentRequest.updateMany({
                where: { gmApprovedById: id },
                data: { gmApprovedById: null }
            }),
            prisma.recruitmentRequest.updateMany({
                where: { hrApprovedById: id },
                data: { hrApprovedById: null }
            }),
            // 7. Clear Candidate relations (all nullable) touched by this user
            prisma.candidate.updateMany({
                where: { createdById: id },
                data: { createdById: null }
            }),
            prisma.candidate.updateMany({
                where: { screenById: id },
                data: { screenById: null }
            }),
            prisma.candidate.updateMany({
                where: { hrEvalById: id },
                data: { hrEvalById: null }
            }),
            prisma.candidate.updateMany({
                where: { techEvalById: id },
                data: { techEvalById: null }
            }),
            // 8. Delete records strictly owned by user.
            // Recruitment requests keep a REQUIRED requester, so they can't be detached —
            // remove the ones this user raised so the account can be deleted.
            prisma.recruitmentRequest.deleteMany({
                where: { requesterId: id }
            }),
            prisma.notification.deleteMany({
                where: { userId: id }
            }),
            prisma.leaveRequest.deleteMany({
                where: { userId: id }
            }),
            // 9. Final Delete
            prisma.user.delete({ where: { id } })
        ]);
}

export const deleteUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    console.log(`[USER][DELETE] Start: id=${id}`);
    try {
        await purgeUserAndRelations(id);
        console.log(`[USER][DELETE] Success: id=${id}`);
        res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        console.error(`[USER][DELETE] Error: id=${id}`, error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        // A foreign-key restriction means some record still points at this user. Surface
        // exactly which relation so it can be handled, instead of a generic 500.
        if (error.code === 'P2003') {
            const field = error.meta?.field_name || error.meta?.constraint || 'a related record';
            return res.status(409).json({
                error: `This user is still referenced by ${field}. That link must be removed before the account can be deleted.`,
                code: error.code,
                meta: error.meta,
            });
        }
        res.status(500).json({
            error: error.message || 'Failed to delete user.',
            details: error.message,
            code: error.code,
            meta: error.meta,
        });
    }
};
