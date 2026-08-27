import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Company-wide analytics rollup — HR + executive audience (SUPER_ADMIN always allowed).
const canViewAnalytics = authorizeAccess(
    ['SUPER_ADMIN', 'HR_MANAGER', 'GENERAL_MANAGER', 'CHAIRMAN'],
    ['view_employees']
);

router.get('/analytics', canViewAnalytics, dashboardController.getDashboardAnalytics);

export default router;
