import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
    getCandidates,
    getCandidateById,
    createCandidate,
    screenCandidate,
    scheduleInterview,
    submitHrEvaluation,
    submitTechEvaluation,
    finalizeEvaluation,
    recordOffer,
    markHired,
    generateOffer,
    generateEvaluation,
    generateHiringLetter,
    generateOnboardingLink,
    updateCandidateOfferDetails,
    deleteCandidate,
} from '../controllers/candidateController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// The hiring pipeline (screening, evaluations, offers, hiring) is for recruitment participants:
// HR, GM, and heads with recruitment access. Deleting a candidate is HR/admin only.
const HEAD_ROLES = ['HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT'];
const canManageHiring = authorizeAccess(['SUPER_ADMIN', 'GENERAL_MANAGER', ...HEAD_ROLES], ['manage_recruitment', 'view_recruitment']);
const canDeleteCandidate = authorizeAccess(['SUPER_ADMIN'], ['manage_recruitment']);

// CV upload storage
const uploadDir = path.join(__dirname, '../../uploads/cvs');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.get('/', getCandidates);
router.get('/:id', getCandidateById);
router.post('/', canManageHiring, upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'degree', maxCount: 1 }, { name: 'portfolio', maxCount: 1 }]), createCandidate);
router.post('/:id/screen', canManageHiring, screenCandidate);
router.post('/:id/interview', canManageHiring, scheduleInterview);
router.post('/:id/hr-eval', canManageHiring, submitHrEvaluation);
router.post('/:id/tech-eval', canManageHiring, submitTechEvaluation);
router.post('/:id/finalize', canManageHiring, finalizeEvaluation);
router.post('/:id/offer', canManageHiring, recordOffer);
router.get('/:id/offer', generateOffer);
router.get('/:id/evaluation', generateEvaluation);
router.get('/:id/hiring-letter', generateHiringLetter);
router.post('/:id/hire', canManageHiring, markHired);
router.patch('/:id/offer-details', canManageHiring, updateCandidateOfferDetails);
router.post('/:id/onboarding-link', canManageHiring, generateOnboardingLink);
router.delete('/:id', canDeleteCandidate, deleteCandidate);

export default router;
