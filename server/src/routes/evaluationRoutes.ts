import { Router } from 'express';
import {
    getHREvaluation, getHREvaluationsByMonth, saveHREvaluation,
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

const router = Router();
console.log("DEBUG: Loading Evaluation Routes...");
router.use(authenticateToken);

// HR
router.get('/hr', getHREvaluation); // ?employeeId=x&month=y
router.get('/hr/month/:month', getHREvaluationsByMonth);
router.post('/hr', saveHREvaluation);

// Unit
router.get('/unit', getUnitEvaluation);
router.get('/unit/month/:month', getUnitEvaluationsByMonth);
router.post('/unit', saveUnitEvaluation);

// Dept
router.get('/dept', getDeptEvaluation);
router.get('/dept/month/:month', getDeptEvaluationsByMonth);
router.post('/dept', saveDeptEvaluation);

// Division
router.get('/division', getDivisionEvaluation);
router.get('/division/month/:month', getDivisionEvaluationsByMonth);
router.post('/division', saveDivisionEvaluation);

// Director
router.get('/director', getDirectorEvaluation);
router.get('/director/month/:month', getDirectorEvaluationsByMonth);
router.post('/director', saveDirectorEvaluation);
router.post('/director/lock', lockEvaluation);

// GM
router.get('/gm', getGMEvaluation);
router.get('/gm/month/:month', getGMEvaluationsByMonth);
router.post('/gm', saveGMEvaluation);

// Chairman
router.get('/chairman', getChairmanEvaluation);
router.get('/chairman/month/:month', getChairmanEvaluationsByMonth);
router.post('/chairman', saveChairmanEvaluation);

// Personnel
router.get('/personnel', getPersonnelEvaluation);
router.get('/personnel/month/:month', getPersonnelEvaluationsByMonth);
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
