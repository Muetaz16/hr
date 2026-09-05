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
    deleteDirectorEvaluation, deleteGMEvaluation, deleteChairmanEvaluation, deletePersonnelEvaluation,
    finalizeEvaluations, getFinalizationsByMonth, getEvaluationHistoryForEmployee
} from '../controllers/evaluationController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';
import { MANAGER_ROLES } from '../utils/evaluationAssignments';

const router = Router();
console.log("DEBUG: Loading Evaluation Routes...");
router.use(authenticateToken);

// Bulk "everyone this month" reads are for evaluators/HR/admin only — a plain
// EMPLOYEE has no legitimate reason to read the whole company's evaluation
// data, and only ever needs their own record (via the single-record GET
// routes below, which enforce ownership per-request instead).
const EVALUATOR_ROLES = ['SUPER_ADMIN', ...MANAGER_ROLES];
// Permission fallback so a hat holder (e.g. the "HR Manager"/"Personnel" Functional Hat on top of a
// different base role) reaches these bulk reads too, not just the literal roles above.
const authorizeEvaluators = authorizeAccess(EVALUATOR_ROLES, ['view_hr_evaluations', 'submit_evaluations', 'manage_evaluation_control']);
// Writing an evaluation requires the `submit_evaluations` permission (or an evaluator role, or
// `manage_evaluation_control`). Previously these POSTs were open to any authenticated user.
const authorizeEvalWrite = authorizeAccess(EVALUATOR_ROLES, ['submit_evaluations', 'manage_evaluation_control']);
// Deleting / finalizing evaluation data is an admin/control action.
const authorizeEvalControl = authorizeAccess(['SUPER_ADMIN'], ['manage_evaluation_control']);
const authorizeEvalDelete = authorizeAccess(['SUPER_ADMIN'], ['manage_evaluation_control']);

// HR
router.get('/hr', getHREvaluation); // ?employeeId=x&month=y
router.get('/hr/month/:month', authorizeEvaluators, getHREvaluationsByMonth);
router.post('/hr', authorizeEvalWrite, saveHREvaluation);
router.post('/hr/recompute-presence', authorizeEvalControl, recomputePresence);

// Unit
router.get('/unit', getUnitEvaluation);
router.get('/unit/month/:month', authorizeEvaluators, getUnitEvaluationsByMonth);
router.post('/unit', authorizeEvalWrite, saveUnitEvaluation);

// Dept
router.get('/dept', getDeptEvaluation);
router.get('/dept/month/:month', authorizeEvaluators, getDeptEvaluationsByMonth);
router.post('/dept', authorizeEvalWrite, saveDeptEvaluation);

// Division
router.get('/division', getDivisionEvaluation);
router.get('/division/month/:month', authorizeEvaluators, getDivisionEvaluationsByMonth);
router.post('/division', authorizeEvalWrite, saveDivisionEvaluation);

// Director
router.get('/director', getDirectorEvaluation);
router.get('/director/month/:month', authorizeEvaluators, getDirectorEvaluationsByMonth);
router.post('/director', authorizeEvalWrite, saveDirectorEvaluation);
router.post('/director/lock', authorizeEvalWrite, lockEvaluation);

// GM
router.get('/gm', getGMEvaluation);
router.get('/gm/month/:month', authorizeEvaluators, getGMEvaluationsByMonth);
router.post('/gm', authorizeEvalWrite, saveGMEvaluation);

// Chairman
router.get('/chairman', getChairmanEvaluation);
router.get('/chairman/month/:month', authorizeEvaluators, getChairmanEvaluationsByMonth);
router.post('/chairman', authorizeEvalWrite, saveChairmanEvaluation);

// Employee history (Lifecycle tree) — access check happens inside the controller itself,
// matching the single-record GET routes above rather than route-level middleware.
router.get('/employee/:employeeId/history', getEvaluationHistoryForEmployee);

// Finalize (save/freeze) — body: { month, employeeId?, departmentId? }
router.post('/finalize', authorizeEvalControl, finalizeEvaluations);
router.get('/finalizations/month/:month', authorizeEvaluators, getFinalizationsByMonth);

// Personnel
router.get('/personnel', getPersonnelEvaluation);
router.get('/personnel/month/:month', authorizeEvaluators, getPersonnelEvaluationsByMonth);
router.post('/personnel', authorizeEvalWrite, savePersonnelEvaluation);

// Delete Routes (Super Admin, or the Evaluation Control permission)
router.delete('/hr/:id', authorizeEvalDelete, deleteHREvaluation);
router.delete('/unit/:id', authorizeEvalDelete, deleteUnitEvaluation);
router.delete('/dept/:id', authorizeEvalDelete, deleteDeptEvaluation);
router.delete('/division/:id', authorizeEvalDelete, deleteDivisionEvaluation);
router.delete('/director/:id', authorizeEvalDelete, deleteDirectorEvaluation);
router.delete('/gm/:id', authorizeEvalDelete, deleteGMEvaluation);
router.delete('/chairman/:id', authorizeEvalDelete, deleteChairmanEvaluation);
router.delete('/personnel/:id', authorizeEvalDelete, deletePersonnelEvaluation);

export default router;
