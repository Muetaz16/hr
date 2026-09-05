import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as offboardingController from '../controllers/offboardingController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

const letterDir = path.join(__dirname, '../../uploads/offboarding');
if (!fs.existsSync(letterDir)) {
    fs.mkdirSync(letterDir, { recursive: true });
}
const letterStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, letterDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
// "Additional Attachments" — optional, up to 10 files, max 10 MB each (per the real form's spec).
const attachmentsUpload = multer({ storage: letterStorage, limits: { fileSize: 10 * 1024 * 1024, files: 10 } });

const canManage = authorizeAccess([], ['manage_offboarding']);

// Employee self-service — no permission gate, always scoped to the caller's own Employee record.
router.get('/my-identity', offboardingController.getMyIdentity);
router.post('/resignation-request', offboardingController.createResignationRequest);
router.post('/exit-interview', offboardingController.submitExitInterview);
router.get('/mine', offboardingController.getMyOffboardingCases);
router.post('/:id/resignation-attachments', attachmentsUpload.array('files', 10), offboardingController.uploadResignationAttachments);

// HR case management
router.get('/', canManage, offboardingController.listCases);
router.get('/:id', canManage, offboardingController.getCase);
router.post('/manual', canManage, offboardingController.createManualOffboardingCase);
router.post('/:id/form/:stage', canManage, offboardingController.generateStageForm);
router.get('/:id/certificate', canManage, offboardingController.issueCertificateOfEmployment);
router.post('/:id/complete-resignation-request', canManage, offboardingController.completeResignationRequest);
router.post('/:id/complete-clearance', canManage, offboardingController.completeClearance);
router.post('/:id/complete-separation-letter', canManage, offboardingController.completeSeparationLetter);

export default router;
