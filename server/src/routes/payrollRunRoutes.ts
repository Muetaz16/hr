import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
    listPayrollRuns, getPayrollRun, listPayrollLines, getPayrollLine,
    preflightPeriod, createPayrollRun, computePayrollRun, updatePayrollLine, deletePayrollRun,
} from '../controllers/payrollRunController';
import {
    getPayrollMasterData, generateSalaryApprovalForm, uploadPayrollDocument, closePayrollRun,
} from '../controllers/payrollRunReviewController';
import {
    listLineCorrections, addLineCorrection, removeLineCorrection,
} from '../controllers/payrollCorrectionController';
import { getLinePayslip, getRunPayslips } from '../controllers/payslipController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

const canView = authorizeAccess([], ['view_payroll']);
const canManage = authorizeAccess([], ['manage_payroll']);

// Signed Salary Approval memos land in the same folder as every other uploaded document. Payroll
// has its own upload route because /employees/upload-document is gated on employee-registration
// permissions, which a payroll specialist has no reason to hold.
const documentsDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });
const documentStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, documentsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const documentUpload = multer({ storage: documentStorage, limits: { fileSize: 15 * 1024 * 1024 } });

// Read
router.get('/', canView, listPayrollRuns);
// Declared before '/:id' so the literal path is not swallowed by the id parameter.
router.get('/preflight', canManage, preflightPeriod);
router.get('/:id', canView, getPayrollRun);
router.get('/:id/lines', canView, listPayrollLines);
router.get('/:id/lines/:lineId', canView, getPayrollLine);
router.get('/:id/lines/:lineId/corrections', canView, listLineCorrections);
router.get('/:id/lines/:lineId/payslip', canView, getLinePayslip);
// The review sheet and the approval memo are read-only outputs — Internal Audit and Finance need
// them without being able to change a number.
router.get('/:id/master-data', canView, getPayrollMasterData);
router.get('/:id/approval-form', canView, generateSalaryApprovalForm);
// Every payable employee's payslip in one printable document.
router.get('/:id/payslips', canView, getRunPayslips);

// Write
router.post('/', canManage, createPayrollRun);
router.post('/:id/compute', canManage, computePayrollRun);
router.post('/:id/documents', canManage, documentUpload.single('file'), uploadPayrollDocument);
router.post('/:id/close', canManage, closePayrollRun);
router.patch('/:id/lines/:lineId', canManage, updatePayrollLine);
// Previous-miscalculation corrections. Stored on the override so they survive a recompute.
router.post('/:id/lines/:lineId/corrections', canManage, addLineCorrection);
router.delete('/:id/lines/:lineId/corrections/:correctionId', canManage, removeLineCorrection);
router.delete('/:id', canManage, deletePayrollRun);

export default router;
