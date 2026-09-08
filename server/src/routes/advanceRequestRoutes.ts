import express from 'express';
import {
    getMyAdvanceContext, listMyAdvances, createMyAdvanceRequest, withdrawMyAdvanceRequest,
} from '../controllers/advanceRequestController';
import { authenticateToken } from '../middleware/auth';

// Mounted at /api/advance-requests. Deliberately no permission gate beyond being signed in: every
// employee may ask for an advance. The decision on it lives behind manage_payroll, on the payroll
// side (/api/payroll-advances).
const router = express.Router();

router.use(authenticateToken);

router.get('/me/context', getMyAdvanceContext);
router.get('/me', listMyAdvances);
router.post('/me', createMyAdvanceRequest);
router.post('/me/:id/withdraw', withdrawMyAdvanceRequest);

export default router;
