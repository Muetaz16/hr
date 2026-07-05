import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import {
    getEvaluationPeriods,
    enableEvaluationPeriod,
    disableEvaluationPeriod
} from '../controllers/evaluationPeriodController';

const router = express.Router();

router.use(authenticateToken); // Protect all routes

router.get('/', getEvaluationPeriods);
router.post('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER'), enableEvaluationPeriod);
router.delete('/:id', authorizeRoles('SUPER_ADMIN'), disableEvaluationPeriod);

export default router;
