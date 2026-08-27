import { Router } from 'express';
import { createPersonnelAction, createInterCompanyTransfer, listPersonnelActions, generatePersonnelActionFormDoc, decidePersonnelAction, getPersonnelActionsByEmployee } from '../controllers/personnelActionController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['manage_personnel_actions', 'view_personnel_relations']), listPersonnelActions);
router.get('/employee/:employeeId', getPersonnelActionsByEmployee);
router.post('/', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['manage_personnel_actions']), createPersonnelAction);
router.post('/inter-company', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['manage_personnel_actions']), createInterCompanyTransfer);
router.get('/:id/form', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['manage_personnel_actions', 'view_personnel_relations']), generatePersonnelActionFormDoc);
// Accepting applies the transfer to the employee record — restrict to HR managers.
router.post('/:id/decide', authorizeAccess(['HR_MANAGER'], ['manage_personnel_actions']), decidePersonnelAction);

export default router;
