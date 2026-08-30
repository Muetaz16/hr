import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { resolveEffectivePermissions } from '../utils/effectivePermissions';
import { isInactiveEnrollmentStatus } from '../utils/employeeStatus';

export interface AuthRequest extends Request {
    user?: any;
}

import { prisma } from '../lib/prisma';

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.warn(`[AUTH DEBUG] No token provided for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
        
        // Fetch fresh user data from DB to ensure permissions are up to date
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                role: true,
                fullName: true,
                unitId: true,
                departmentId: true,
                departmentIds: true,
                permissions: true,
                functionalHatIds: true,
                groupId: true,
                employee: { select: { enrollmentStatus: true } },
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'User no longer exists' });
        }

        // Re-checked on every request (not just at login) so leaving the company (separation OR
        // inter-company transfer) takes effect immediately even for a token issued before it
        // happened, instead of waiting out the 24h expiry.
        if (isInactiveEnrollmentStatus(user.employee?.enrollmentStatus)) {
            return res.status(403).json({ error: 'This account has been deactivated because the employee is no longer active.' });
        }

        // Authorization runs on the merged EFFECTIVE set (position + hats + grants)
        // so every downstream authorizeAccess/authorizePermissions check sees the
        // full picture. `grants` keeps the raw individual grants for reference.
        const effective = await resolveEffectivePermissions(prisma, user);
        req.user = { ...user, grants: user.permissions, permissions: effective };
        console.log(`[AUTH][OK] User: ${user.fullName} (${user.role}) -> ${req.url}`);
        next();
    } catch (err: any) {
        console.error(`[AUTH][ERROR] Token Verification Failed: ${err.message}`);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
export const authorizeRoles = (...allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            console.warn(`[AUTH][DENIED] User ${req.user.fullName} (${req.user.role}) is NOT in [${allowedRoles}]. Sending 403.`);
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};

/**
 * Flexible authorization that allows access if user has ANY of the roles 
 * OR ANY of the permissions. SUPER_ADMIN always allowed.
 */
export const authorizeAccess = (roles: string[] = [], permissions: string[] = []) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Global bypass
        if (req.user.role === 'SUPER_ADMIN') return next();

        const hasRole = roles.includes(req.user.role);
        const userPermissions = req.user.permissions || [];
        const hasPermission = permissions.some(p => userPermissions.includes(p));

        if (hasRole || hasPermission) {
            return next();
        }

        console.warn(`[AUTH][DENIED] User ${req.user.fullName} (${req.user.role}) denied. Required Roles: [${roles}], Required Perms: [${permissions}].`);
        return res.status(403).json({ error: 'Forbidden: Insufficient access' });
    };
};

export const authorizePermissions = (...requiredPermissions: string[]) => {
    return authorizeAccess([], requiredPermissions);
};
