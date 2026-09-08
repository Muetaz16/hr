import { Router } from 'express';
import {
    getAllSalaryStructures, getSalaryStructure, getSalaryStructureCoverage,
    createSalaryStructure, updateSalaryStructure, deleteSalaryStructure,
} from '../controllers/salaryStructureController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();

// Salary-structure reference data was previously completely public. It's used across several
// authenticated flows (employee form, contract renewal, candidate offers) by different roles, so we
// require a valid login here rather than a single permission that would break one of those flows.
router.use(authenticateToken);

router.get('/', getAllSalaryStructures);
// Declared before any '/:id' route so the literal paths are not swallowed by the parameter.
router.get('/lookup', getSalaryStructure);
router.get('/coverage', authorizeAccess([], ['view_payroll']), getSalaryStructureCoverage);

// Writes change what every employee on that rate is owed next month, so they are payroll-only —
// unlike the reads above, which several unrelated roles depend on.
const canManage = authorizeAccess([], ['manage_payroll', 'manage_salary_structures']);
router.post('/', canManage, createSalaryStructure);
router.patch('/:id', canManage, updateSalaryStructure);
router.delete('/:id', canManage, deleteSalaryStructure);

export default router;
