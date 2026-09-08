import express from 'express';
import {
    listDeductions, listDeductionCategories, createDeduction, updateDeduction, approveDeduction, cancelDeduction,
} from '../controllers/payrollDeductionController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

// Mounted at /api/payroll-deductions — deliberately NOT under /api/payroll, which belongs to the
// Evaluations module's score sheet.
const router = express.Router();

router.use(authenticateToken);

const canView = authorizeAccess([], ['view_payroll']);
const canManage = authorizeAccess([], ['manage_payroll']);

// The literal '/categories' path is declared before any ':id' route so it is not swallowed by it.
router.get('/categories', canView, listDeductionCategories);
router.get('/', canView, listDeductions);
router.post('/', canManage, createDeduction);
router.patch('/:id', canManage, updateDeduction);
router.post('/:id/approve', canManage, approveDeduction);
router.post('/:id/cancel', canManage, cancelDeduction);

export default router;
