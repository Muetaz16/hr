import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
    getAllRecruitmentRequests,
    createRecruitmentRequest,
    updateRecruitmentRequest,
    updateRecruitmentRequestStatus,
    deleteRecruitmentRequest,
    prfApprove,
    generatePrf
} from '../controllers/recruitmentController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

// Storage for the signed document the GM uploads at final approval.
const requisitionsDir = path.join(__dirname, '../../uploads/requisitions');
if (!fs.existsSync(requisitionsDir)) fs.mkdirSync(requisitionsDir, { recursive: true });
const prfStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, requisitionsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const prfUpload = multer({ storage: prfStorage });

router.get('/', getAllRecruitmentRequests);
router.post('/', createRecruitmentRequest);
router.put('/:id', updateRecruitmentRequest); // New Edit Route
router.put('/:id/status', updateRecruitmentRequestStatus);
router.post('/:id/prf-approve', prfUpload.single('document'), prfApprove);
router.get('/:id/prf', generatePrf);
router.delete('/:id', deleteRecruitmentRequest);

export default router;
