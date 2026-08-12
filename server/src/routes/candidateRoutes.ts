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
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

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
router.post('/', upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'degree', maxCount: 1 }, { name: 'portfolio', maxCount: 1 }]), createCandidate);
router.post('/:id/screen', screenCandidate);
router.post('/:id/interview', scheduleInterview);
router.post('/:id/hr-eval', submitHrEvaluation);
router.post('/:id/tech-eval', submitTechEvaluation);
router.post('/:id/finalize', finalizeEvaluation);
router.post('/:id/offer', recordOffer);
router.get('/:id/offer', generateOffer);
router.get('/:id/evaluation', generateEvaluation);
router.get('/:id/hiring-letter', generateHiringLetter);
router.post('/:id/hire', markHired);
router.patch('/:id/offer-details', updateCandidateOfferDetails);
router.post('/:id/onboarding-link', generateOnboardingLink);
router.delete('/:id', deleteCandidate);

export default router;
