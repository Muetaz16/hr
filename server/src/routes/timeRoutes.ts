import { Router } from 'express';
import { getTimeRecordsByMonth, createOrUpdateTimeRecord } from '../controllers/timeController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Role OR permission: the time-tracking permissions (granted e.g. to a Head of Attendance & Payroll)
// grant access even when the account's role isn't one of the listed org roles.
router.get('/month/:month', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], ['view_time_tracking', 'manage_time_tracking']), getTimeRecordsByMonth);
router.post('/', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], ['manage_time_tracking']), createOrUpdateTimeRecord);

export default router;
