import { Router } from 'express';
import { getAllSalaryStructures, getSalaryStructure } from '../controllers/salaryStructureController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Salary-structure reference data was previously completely public. It's used across several
// authenticated flows (employee form, contract renewal, candidate offers) by different roles, so we
// require a valid login here rather than a single permission that would break one of those flows.
router.use(authenticateToken);

router.get('/', getAllSalaryStructures);
router.get('/lookup', getSalaryStructure);

export default router;
