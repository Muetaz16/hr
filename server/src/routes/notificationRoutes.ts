import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from '../controllers/notificationController';

const router = Router();

router.use(authenticateToken);

router.get('/', getMyNotifications);
router.post('/read-all', markAllNotificationsRead);
router.post('/:id/read', markNotificationRead);

export default router;
