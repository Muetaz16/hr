import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, getExpiringContracts, getMyEmployeeRecord, renewContract, terminateEmployee, getNextStaffId, uploadEmployeeDocument } from '../controllers/employeeController';
import { authenticateToken, authorizeRoles, authorizePermissions, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken); // Protect all routes

// --- Employee document uploads (CV, degree, passport copy, etc.) ---
const documentsDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
}
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, documentsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const documentUpload = multer({ storage: documentStorage, limits: { fileSize: 15 * 1024 * 1024 } });

router.post('/upload-document', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['register_employees', 'edit_employees']), documentUpload.single('file'), uploadEmployeeDocument);

router.get('/contracts/expiring', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['view_contracts']), getExpiringContracts);
router.get('/me', getMyEmployeeRecord);
router.get('/next-staff-id', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['register_employees', 'edit_employees']), getNextStaffId);
router.get('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HEAD_OFFICE', 'CHAIRMAN', 'GENERAL_MANAGER', 'EMPLOYEE'), getAllEmployees);
router.get('/:id', getEmployeeById);
router.post('/', authorizeAccess(['HR_MANAGER'], ['register_employees']), createEmployee);
router.put('/:id', authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['edit_employees']), updateEmployee);
router.delete('/:id', authorizeAccess(['HR_MANAGER'], ['edit_employees']), deleteEmployee);

// Contract Lifecycle
router.post('/:id/renew', authorizeAccess(['HR_MANAGER'], ['manage_contract_management']), renewContract);
router.post('/:id/terminate', authorizeAccess(['HR_MANAGER'], ['manage_contract_management']), terminateEmployee);

export default router;
