import { Router } from 'express';
import { getPayrollByMonth, savePayrollResult, deletePayrollResult } from '../controllers/payrollController';
import { authenticateToken, authorizeRoles, authorizePermissions, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/month/:month', authorizeAccess(['HR_MANAGER'], ['view_payroll']), getPayrollByMonth);
router.post('/', authorizeAccess(['HR_MANAGER'], ['manage_payroll']), savePayrollResult);
router.delete('/:id', authorizeAccess([], ['manage_payroll']), deletePayrollResult);

export default router;
