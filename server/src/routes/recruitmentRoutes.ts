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
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

// Requesters (heads with recruitment access + HR/GM) may raise/edit requests; approvals are for the
// recruitment-approval holders; deletion is HR/admin only.
const HEAD_ROLES = ['HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT'];
const canRaiseRecruitment = authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER', 'GENERAL_MANAGER', ...HEAD_ROLES], ['manage_recruitment', 'view_recruitment']);
const canApproveRecruitment = authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER', 'GENERAL_MANAGER', 'HEAD_DIVISION', 'HEAD_DIRECTOR'], ['recruitment_approvals', 'manage_recruitment']);
const canDeleteRecruitment = authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_recruitment']);

// Storage for the signed document the GM uploads at final approval.
const requisitionsDir = path.join(__dirname, '../../uploads/requisitions');
if (!fs.existsSync(requisitionsDir)) fs.mkdirSync(requisitionsDir, { recursive: true });
const prfStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, requisitionsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const prfUpload = multer({ storage: prfStorage });

router.get('/', getAllRecruitmentRequests);
router.post('/', canRaiseRecruitment, createRecruitmentRequest);
router.put('/:id', canRaiseRecruitment, updateRecruitmentRequest); // New Edit Route
router.put('/:id/status', canApproveRecruitment, updateRecruitmentRequestStatus);
router.post('/:id/prf-approve', canApproveRecruitment, prfUpload.single('document'), prfApprove);
router.get('/:id/prf', generatePrf);
router.delete('/:id', canDeleteRecruitment, deleteRecruitmentRequest);

export default router;
