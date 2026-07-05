import { Router } from 'express';
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, getExpiringContracts, getMyEmployeeRecord, renewContract, terminateEmployee } from '../controllers/employeeController';
import { authenticateToken, authorizeRoles, authorizePermissions, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken); // Protect all routes

router.get('/contracts/expiring', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['view_contracts']), getExpiringContracts);
router.get('/me', getMyEmployeeRecord);
router.get('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HEAD_OFFICE', 'CHAIRMAN', 'GENERAL_MANAGER', 'EMPLOYEE'), getAllEmployees);
router.get('/:id', getEmployeeById);
router.post('/', authorizeAccess(['HR_MANAGER'], ['register_employees']), createEmployee);
router.put('/:id', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['edit_employees']), updateEmployee);
router.delete('/:id', authorizeAccess(['HR_MANAGER'], ['edit_employees']), deleteEmployee);

// Contract Lifecycle
router.post('/:id/renew', authorizeAccess(['HR_MANAGER'], ['manage_contract_management']), renewContract);
router.post('/:id/terminate', authorizeAccess(['HR_MANAGER'], ['manage_contract_management']), terminateEmployee);

export default router;
