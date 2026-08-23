import express from 'express';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../controllers/unitController';
import { authenticateToken, authorizeRoles, authorizeAccess } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken); // Protect all unit routes

// Units can be viewed by ADMINs and HR, but also potentially by anyone needing to see the structure
// Let's restrict viewing to a broad set, and creating/editing to SUPER_ADMIN and HR_MANAGER
// Units can be viewed by all staff
router.get('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'EMPLOYEE', 'GENERAL_MANAGER', 'CHAIRMAN'), getUnits);

router.post('/', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_units']), createUnit);
router.put('/:id', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_units']), updateUnit);
router.delete('/:id', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_units']), deleteUnit);

export default router;
