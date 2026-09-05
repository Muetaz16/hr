import express from 'express';
import { authenticateToken, authorizeRoles, authorizeAccess } from '../middleware/auth';
import {
    getEvaluationPeriods,
    enableEvaluationPeriod,
    disableEvaluationPeriod
} from '../controllers/evaluationPeriodController';

const router = express.Router();

router.use(authenticateToken); // Protect all routes

router.get('/', getEvaluationPeriods);
router.post('/', authorizeAccess(['SUPER_ADMIN'], ['manage_evaluation_control']), enableEvaluationPeriod);
router.delete('/:id', authorizeAccess(['SUPER_ADMIN'], ['manage_evaluation_control']), disableEvaluationPeriod);

export default router;
