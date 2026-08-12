import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
    console.log(`[AUTH] Login attempt for email: ${req.body.email}`);
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.toLowerCase();

        if (!normalizedEmail || !password) {
            console.warn('[AUTH] Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
        }

        console.log('[AUTH] Querying database for user...');
        // Case-insensitive lookup so accounts stored with any capitalisation still authenticate.
        const user = await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        if (!user) {
            console.warn(`[AUTH] User not found: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('[AUTH] User found, comparing passwords...');
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.warn(`[AUTH] Invalid password for: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('[AUTH] Password valid, generating token...');
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                fullName: user.fullName,
                unitId: user.unitId,
                departmentId: user.departmentId,
                departmentIds: user.departmentIds,
                permissions: user.permissions
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '24h' }
        );

        // Exclude password from response
        const { password: _, ...userWithoutPassword } = user;

        console.log(`[AUTH] Login successful for: ${email}`);
        res.json({
            token,
            user: userWithoutPassword
        });
    } catch (error: any) {
        console.error('[AUTH] CRITICAL ERROR during login:', error.message);
        if (error.code) console.error('[AUTH] Prisma Error Code:', error.code);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const { newPassword } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password is required and must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error: any) {
        console.error('[AUTH] ERROR during change password:', error.message);
        res.status(500).json({ error: 'Failed to update password' });
    }
};

// Save (or clear) the signed-in user's own signature. The signature is a PNG
// data URL produced by the drawing pad on the client. Passing null/empty clears it.
export const saveSignature = async (req: Request, res: Response) => {
    try {
        const { signature } = req.body as { signature?: string | null };
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Normalise empty values to null (clears the stored signature).
        const value = signature && signature.trim() ? signature.trim() : null;

        if (value !== null) {
            if (!value.startsWith('data:image/')) {
                return res.status(400).json({ error: 'Signature must be a valid image data URL' });
            }
            // Guard against oversized payloads (~1MB of base64 is plenty for a signature).
            if (value.length > 1_500_000) {
                return res.status(413).json({ error: 'Signature image is too large' });
            }
        }

        await prisma.user.update({
            where: { id: userId },
            data: { signature: value },
        });

        res.json({ message: 'Signature saved', signature: value });
    } catch (error: any) {
        console.error('[AUTH] ERROR saving signature:', error.message);
        res.status(500).json({ error: 'Failed to save signature' });
    }
};
