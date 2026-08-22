import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ALL_PERMISSION_IDS } from '../utils/accessCatalog';

const prisma = new PrismaClient();

const sanitizePermissions = (perms: any): string[] =>
    Array.isArray(perms) ? perms.filter((p: any) => typeof p === 'string' && ALL_PERMISSION_IDS.includes(p)) : [];

export const getHats = async (_req: Request, res: Response) => {
    try {
        const hats = await prisma.functionalHat.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] });
        res.json(hats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch functional hats' });
    }
};

export const createHat = async (req: Request, res: Response) => {
    try {
        const { name, description, permissions } = req.body;
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'A hat name is required' });
        const hat = await prisma.functionalHat.create({
            data: {
                name: String(name).trim(),
                description: description ? String(description).trim() : null,
                permissions: sanitizePermissions(permissions),
                isSystem: false,
            },
        });
        res.status(201).json(hat);
    } catch (error) {
        console.error('Create Hat Error:', error);
        res.status(500).json({ error: 'Failed to create functional hat' });
    }
};

export const updateHat = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, permissions } = req.body;
        const data: any = {};
        if (name !== undefined) {
            if (!String(name).trim()) return res.status(400).json({ error: 'A hat name is required' });
            data.name = String(name).trim();
        }
        if (description !== undefined) data.description = description ? String(description).trim() : null;
        if (permissions !== undefined) data.permissions = sanitizePermissions(permissions);
        const hat = await prisma.functionalHat.update({ where: { id }, data });
        res.json(hat);
    } catch (error: any) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Functional hat not found' });
        console.error('Update Hat Error:', error);
        res.status(500).json({ error: 'Failed to update functional hat' });
    }
};

export const deleteHat = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const hat = await prisma.functionalHat.findUnique({ where: { id } });
        if (!hat) return res.status(404).json({ error: 'Functional hat not found' });
        if (hat.isSystem) return res.status(400).json({ error: 'System hats cannot be deleted — edit their permissions instead.' });

        // Detach the hat from any user that holds it so no dangling ids remain.
        const holders = await prisma.user.findMany({ where: { functionalHatIds: { has: id } }, select: { id: true, functionalHatIds: true } });
        await prisma.$transaction([
            ...holders.map(u => prisma.user.update({
                where: { id: u.id },
                data: { functionalHatIds: u.functionalHatIds.filter(h => h !== id) },
            })),
            prisma.functionalHat.delete({ where: { id } }),
        ]);
        res.json({ message: 'Functional hat deleted' });
    } catch (error) {
        console.error('Delete Hat Error:', error);
        res.status(500).json({ error: 'Failed to delete functional hat' });
    }
};
