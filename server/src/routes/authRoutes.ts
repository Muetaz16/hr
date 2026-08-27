import { Router } from 'express';
import { login, changePassword, saveSignature } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import type { Response } from 'express';

import { PrismaClient } from '@prisma/client';
import { resolveEffectivePermissions } from '../utils/effectivePermissions';

const router = Router();
import { prisma } from '../lib/prisma';

router.post('/login', login);
router.post('/change-password', authenticateToken, changePassword);
router.post('/signature', authenticateToken, saveSignature);

// Token validation endpoint
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
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
                signature: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the merged effective permission set so the client gates correctly.
        const effective = await resolveEffectivePermissions(prisma, user);
        res.json({ valid: true, user: { ...user, permissions: effective } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

export default router;
