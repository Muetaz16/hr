import express from 'express';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../controllers/unitController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken); // Protect all unit routes

// Units can be viewed by ADMINs and HR, but also potentially by anyone needing to see the structure
// Let's restrict viewing to a broad set, and creating/editing to SUPER_ADMIN and HR_MANAGER
// Units can be viewed by all staff
router.get('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'EMPLOYEE', 'GENERAL_MANAGER', 'CHAIRMAN'), getUnits);

router.post('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER'), createUnit);
router.put('/:id', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER'), updateUnit);
router.delete('/:id', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER'), deleteUnit);

export default router;
