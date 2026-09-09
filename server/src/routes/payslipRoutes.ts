import express from 'express';
import { listMyPayslips, getMyPayslip, getMyPayslipView } from '../controllers/payslipController';
import { authenticateToken } from '../middleware/auth';

// Mounted at /api/payslips. No permission gate beyond being signed in: these routes only ever
// return the caller's OWN payslips, resolved from their user id, and only for periods that have
// been signed off.
const router = express.Router();

router.use(authenticateToken);

router.get('/me', listMyPayslips);
// Declared before '/me/:period' so the literal suffix is not swallowed by the period parameter.
router.get('/me/:period/view', getMyPayslipView);
router.get('/me/:period', getMyPayslip);

export default router;
