import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, getExpiringContracts, getMyEmployeeRecord, renewContract, terminateEmployee, getNextStaffId, regenerateAllStaffIds, uploadEmployeeDocument, getEmployeeDocuments, addEmployeeDocument, deleteEmployeeDocument, generateContractRenewalForm, generateHandoverSummary } from '../controllers/employeeController';
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

router.post('/upload-document', authorizeAccess([], ['register_employees', 'edit_employees']), documentUpload.single('file'), uploadEmployeeDocument);

router.get('/contracts/expiring', authorizeAccess([], ['view_contracts']), getExpiringContracts);
router.get('/me', getMyEmployeeRecord);
router.get('/next-staff-id', authorizeAccess([], ['register_employees', 'edit_employees']), getNextStaffId);
router.post('/regenerate-staff-ids', authorizeAccess([], ['register_employees', 'edit_employees']), regenerateAllStaffIds);
router.get('/', authorizeRoles('SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HEAD_OFFICE', 'CHAIRMAN', 'GENERAL_MANAGER', 'EMPLOYEE'), getAllEmployees);
router.get('/:id', getEmployeeById);
router.post('/', authorizeAccess([], ['register_employees']), createEmployee);
router.put('/:id', authorizeAccess([], ['edit_employees']), updateEmployee);
router.delete('/:id', authorizeAccess([], ['edit_employees']), deleteEmployee);

// Lifecycle handover summary (IPH letterhead) — for HR / Personnel Relations use.
router.get('/:id/handover-summary', authorizeAccess(['SUPER_ADMIN'], ['view_personnel_relations', 'manage_personnel_actions', 'view_lifecycle']), generateHandoverSummary);

// Contract Lifecycle
router.get('/:id/renewal-form', authorizeAccess([], ['view_contracts', 'manage_contract_management']), generateContractRenewalForm);
router.post('/:id/renew', authorizeAccess([], ['manage_contract_management']), renewContract);
router.post('/:id/terminate', authorizeAccess([], ['manage_contract_management']), terminateEmployee);

// Free-form employee documents (additional certificates, etc. beyond the fixed CV/degree/etc. slots)
router.get('/:id/documents', authorizeAccess([], ['register_employees', 'edit_employees']), getEmployeeDocuments);
router.post('/:id/documents', authorizeAccess([], ['register_employees', 'edit_employees']), addEmployeeDocument);
router.delete('/:id/documents/:docId', authorizeAccess([], ['register_employees', 'edit_employees']), deleteEmployeeDocument);

export default router;
