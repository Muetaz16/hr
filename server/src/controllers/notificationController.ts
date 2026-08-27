import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth';

import { prisma } from '../lib/prisma';

// Internal helper — create a notification for one user (never throws into the caller's flow).
export const notify = async (userId: string, title: string, content: string, link?: string) => {
    if (!userId) return;
    try {
        await prisma.notification.create({ data: { userId, title, content, link: link || null } });
    } catch (err) {
        console.error('Failed to create notification:', err);
    }
};

// Internal helper — notify every user holding one of the given roles (optionally scoped to a division).
export const notifyRoles = async (
    roles: string[],
    title: string,
    content: string,
    link?: string,
    opts?: { divisionId?: string | null }
) => {
    try {
        const users = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
        let targets = users.map(u => u.id);

        // Scope HEAD_DIVISION notifications to the head(s) of the relevant division when possible.
        if (opts?.divisionId && roles.includes('HEAD_DIVISION')) {
            const divisionHeads = await prisma.employee.findMany({
                where: { role: 'HEAD_DIVISION', divisionId: opts.divisionId, userId: { not: null } },
                select: { userId: true },
            });
            const scoped = divisionHeads.map(e => e.userId!).filter(Boolean);
            if (scoped.length) targets = scoped;
        }

        await Promise.all(targets.map(id => notify(id, title, content, link)));
    } catch (err) {
        console.error('Failed to notify roles:', err);
    }
};

// GET /notifications — the current user's notifications (newest first).
export const getMyNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        const unread = notifications.filter(n => !n.isRead).length;
        res.json({ notifications, unread });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// POST /notifications/:id/read — mark one as read.
export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
        res.json({ message: 'ok' });
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
};

// POST /notifications/read-all — mark all of the user's notifications as read.
export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
        res.json({ message: 'ok' });
    } catch (error) {
        console.error('Error marking all notifications read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};
