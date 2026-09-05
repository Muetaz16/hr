import { Router } from 'express';
import { getPayrollByMonth, savePayrollResult, deletePayrollResult, getMonthlyEvaluationDoc } from '../controllers/payrollController';
import { authenticateToken, authorizeRoles, authorizePermissions, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/month/:month', authorizeAccess([], ['view_payroll']), getPayrollByMonth);
// The per-employee/month Word form is exportable from both the Efficiency Evaluation page and the
// Personnel Relations lifecycle tree, so it matches the broader "can view evaluations" audience.
router.get('/evaluation-doc/:employeeId/:month', authorizeAccess([], ['view_payroll', 'view_evaluations', 'manage_evaluation_control']), getMonthlyEvaluationDoc);
router.post('/', authorizeAccess([], ['manage_payroll']), savePayrollResult);
router.delete('/:id', authorizeAccess([], ['manage_payroll']), deletePayrollResult);

export default router;
