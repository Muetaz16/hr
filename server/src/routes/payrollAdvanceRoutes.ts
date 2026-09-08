import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
    listAdvances, getAdvance, createAdvance, approveAdvance, rejectAdvance, cancelAdvance, updateInstalment,
} from '../controllers/payrollAdvanceController';
import {
    listProviderBatches, generateProviderForm, approveProviderBatch, disburseProviderBatch,
} from '../controllers/providerAdvanceController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

// Mounted at /api/payroll-advances — deliberately NOT under /api/payroll, which belongs to the
// Evaluations module's score sheet and has nothing to do with compensation.
const router = express.Router();

router.use(authenticateToken);

const canView = authorizeAccess([], ['view_payroll']);
const canManage = authorizeAccess([], ['manage_payroll']);

// Approving or handing over an advance is the money-moving step, separable from recording that
// someone asked for one. OR semantics, so manage_payroll still covers it.
const canApprove = authorizeAccess([], ['manage_payroll', 'approve_advances']);

// Signed advance agreements and provider consent forms. Payroll has its own upload route because
// /employees/upload-document is gated on employee-registration permissions, which a payroll
// specialist has no reason to hold.
const documentsDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });
const documentUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, documentsDir),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/documents', canManage, documentUpload.single('file'), (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/documents/${file.filename}`, name: file.originalname });
});

// Provider rounds. Declared before '/:id' so the literal path is not swallowed by the parameter.
router.get('/provider-batches', canView, listProviderBatches);
router.post('/provider-batches/:providerId/form', canManage, generateProviderForm);
router.post('/provider-batches/:providerId/approve', canApprove, approveProviderBatch);
router.post('/provider-batches/:providerId/disburse', canApprove, disburseProviderBatch);

router.get('/', canView, listAdvances);
router.get('/:id', canView, getAdvance);
router.post('/', canManage, createAdvance);
router.post('/:id/approve', canApprove, approveAdvance);
router.post('/:id/reject', canApprove, rejectAdvance);
router.post('/:id/cancel', canManage, cancelAdvance);
router.patch('/:id/instalments/:instalmentId', canManage, updateInstalment);

export default router;
