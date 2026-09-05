import { Router } from 'express';
import { createPersonnelAction, createInterCompanyTransfer, listPersonnelActions, generatePersonnelActionFormDoc, decidePersonnelAction, getPersonnelActionsByEmployee, getPersonnelActionById } from '../controllers/personnelActionController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizeAccess([], ['manage_personnel_actions', 'view_personnel_relations']), listPersonnelActions);
router.get('/employee/:employeeId', getPersonnelActionsByEmployee);
router.get('/:id', authorizeAccess([], ['manage_personnel_actions', 'view_personnel_relations']), getPersonnelActionById);
router.post('/', authorizeAccess([], ['manage_personnel_actions']), createPersonnelAction);
router.post('/inter-company', authorizeAccess([], ['manage_personnel_actions']), createInterCompanyTransfer);
router.get('/:id/form', authorizeAccess([], ['manage_personnel_actions', 'view_personnel_relations']), generatePersonnelActionFormDoc);
// Accepting applies the transfer to the employee record — restrict to HR managers.
router.post('/:id/decide', authorizeAccess([], ['manage_personnel_actions']), decidePersonnelAction);

export default router;
