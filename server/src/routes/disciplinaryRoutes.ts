import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as disciplinaryController from '../controllers/disciplinaryController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

const evidenceDir = path.join(__dirname, '../../uploads/disciplinary');
if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
}
const evidenceStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, evidenceDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const evidenceUpload = multer({ storage: evidenceStorage, limits: { fileSize: 100 * 1024 * 1024, files: 5 } });

const canManage = authorizeAccess(['HR_MANAGER', 'PERSONNEL'], ['manage_disciplinary']);

// Stage 1 — any authenticated employee may file an incident report (no permission gate).
router.post('/incident-report', disciplinaryController.createIncidentReport);
router.get('/mine', disciplinaryController.getMyReports);
router.post('/:id/evidence', evidenceUpload.array('files', 5), disciplinaryController.addEvidence);

// Attendance-based candidates — HR reviews and manually executes, never auto-punished.
router.get('/attendance-candidates', canManage, disciplinaryController.getAttendanceCandidates);
router.post('/attendance-candidates/:employeeId/execute', canManage, disciplinaryController.executeAttendanceCase);

// HR case management (all 4 stages)
router.get('/', canManage, disciplinaryController.listCases);
router.get('/employee/:employeeId', canManage, disciplinaryController.getCasesByEmployee);
router.get('/:id', canManage, disciplinaryController.getCase);
router.patch('/:id', canManage, disciplinaryController.updateCaseDetails);
router.post('/:id/form/:stage', canManage, disciplinaryController.generateStageForm);
router.post('/:id/complete-incident-report', canManage, disciplinaryController.completeIncidentReport);
router.post('/:id/dismiss-incident-report', canManage, disciplinaryController.dismissIncidentReport);
router.post('/:id/complete-notice-to-explain', canManage, disciplinaryController.completeNoticeToExplain);
router.post('/:id/complete-investigation-result', canManage, disciplinaryController.completeInvestigationResult);
router.post('/:id/complete-disciplinary-action', canManage, disciplinaryController.completeDisciplinaryAction);

export default router;
