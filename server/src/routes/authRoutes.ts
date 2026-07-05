import { Router } from 'express';
import { login, changePassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import type { Response } from 'express';

import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', login);
router.post('/change-password', authenticateToken, changePassword);

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
                departmentIds: true,
                groupId: true,
                permissions: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ valid: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

export default router;
