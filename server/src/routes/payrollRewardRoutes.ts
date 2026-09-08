import express from 'express';
import {
    listPayrollRewards, setRewardPayoutPeriod, listRewardPeriods,
} from '../controllers/payrollRewardController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

// Mounted at /api/payroll-rewards. The reward CASES live under /api/reward-cases in Personnel
// Relations; this is only the money view of the ones that carry a bonus percentage.
const router = express.Router();

router.use(authenticateToken);

router.get('/', authorizeAccess([], ['view_payroll']), listPayrollRewards);
router.get('/periods', authorizeAccess([], ['view_payroll']), listRewardPeriods);
router.patch('/:id', authorizeAccess([], ['manage_payroll']), setRewardPayoutPeriod);

export default router;
