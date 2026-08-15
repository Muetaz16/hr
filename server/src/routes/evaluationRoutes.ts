import { Router } from 'express';
import {
    getHREvaluation, getHREvaluationsByMonth, saveHREvaluation, recomputePresence,
    getUnitEvaluation, getUnitEvaluationsByMonth, saveUnitEvaluation,
    getDeptEvaluation, getDeptEvaluationsByMonth, saveDeptEvaluation,
    getDivisionEvaluation, getDivisionEvaluationsByMonth, saveDivisionEvaluation,
    getDirectorEvaluation, getDirectorEvaluationsByMonth, saveDirectorEvaluation, lockEvaluation,
    getGMEvaluation, getGMEvaluationsByMonth, saveGMEvaluation,
    getChairmanEvaluation, getChairmanEvaluationsByMonth, saveChairmanEvaluation,
    getPersonnelEvaluation, getPersonnelEvaluationsByMonth, savePersonnelEvaluation,
    deleteHREvaluation, deleteUnitEvaluation, deleteDeptEvaluation, deleteDivisionEvaluation,
    deleteDirectorEvaluation, deleteGMEvaluation, deleteChairmanEvaluation, deletePersonnelEvaluation
} from '../controllers/evaluationController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { MANAGER_ROLES } from '../utils/evaluationAssignments';

const router = Router();
console.log("DEBUG: Loading Evaluation Routes...");
router.use(authenticateToken);

// Bulk "everyone this month" reads are for evaluators/HR/admin only — a plain
// EMPLOYEE has no legitimate reason to read the whole company's evaluation
// data, and only ever needs their own record (via the single-record GET
// routes below, which enforce ownership per-request instead).
const EVALUATOR_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', ...MANAGER_ROLES];
const authorizeEvaluators = authorizeRoles(...EVALUATOR_ROLES);

// HR
router.get('/hr', getHREvaluation); // ?employeeId=x&month=y
router.get('/hr/month/:month', authorizeEvaluators, getHREvaluationsByMonth);
router.post('/hr', saveHREvaluation);
router.post('/hr/recompute-presence', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'), recomputePresence);

// Unit
router.get('/unit', getUnitEvaluation);
router.get('/unit/month/:month', authorizeEvaluators, getUnitEvaluationsByMonth);
router.post('/unit', saveUnitEvaluation);

// Dept
router.get('/dept', getDeptEvaluation);
router.get('/dept/month/:month', authorizeEvaluators, getDeptEvaluationsByMonth);
router.post('/dept', saveDeptEvaluation);

// Division
router.get('/division', getDivisionEvaluation);
router.get('/division/month/:month', authorizeEvaluators, getDivisionEvaluationsByMonth);
router.post('/division', saveDivisionEvaluation);

// Director
router.get('/director', getDirectorEvaluation);
router.get('/director/month/:month', authorizeEvaluators, getDirectorEvaluationsByMonth);
router.post('/director', saveDirectorEvaluation);
router.post('/director/lock', lockEvaluation);

// GM
router.get('/gm', getGMEvaluation);
router.get('/gm/month/:month', authorizeEvaluators, getGMEvaluationsByMonth);
router.post('/gm', saveGMEvaluation);

// Chairman
router.get('/chairman', getChairmanEvaluation);
router.get('/chairman/month/:month', authorizeEvaluators, getChairmanEvaluationsByMonth);
router.post('/chairman', saveChairmanEvaluation);

// Personnel
router.get('/personnel', getPersonnelEvaluation);
router.get('/personnel/month/:month', authorizeEvaluators, getPersonnelEvaluationsByMonth);
router.post('/personnel', savePersonnelEvaluation);

// Delete Routes (Super Admin Only)
router.delete('/hr/:id', authorizeRoles('SUPER_ADMIN'), deleteHREvaluation);
router.delete('/unit/:id', authorizeRoles('SUPER_ADMIN'), deleteUnitEvaluation);
router.delete('/dept/:id', authorizeRoles('SUPER_ADMIN'), deleteDeptEvaluation);
router.delete('/division/:id', authorizeRoles('SUPER_ADMIN'), deleteDivisionEvaluation);
router.delete('/director/:id', authorizeRoles('SUPER_ADMIN'), deleteDirectorEvaluation);
router.delete('/gm/:id', authorizeRoles('SUPER_ADMIN'), deleteGMEvaluation);
router.delete('/chairman/:id', authorizeRoles('SUPER_ADMIN'), deleteChairmanEvaluation);
router.delete('/personnel/:id', authorizeRoles('SUPER_ADMIN'), deletePersonnelEvaluation);

export default router;
