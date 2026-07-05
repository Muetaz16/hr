import { Router } from 'express';
import { getTimeRecordsByMonth, createOrUpdateTimeRecord } from '../controllers/timeController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/month/:month', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'), getTimeRecordsByMonth);
router.post('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'), createOrUpdateTimeRecord);

export default router;
