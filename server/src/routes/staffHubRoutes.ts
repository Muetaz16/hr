import { Router } from 'express';
import * as staffHubController from '../controllers/staffHubController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

// Apply authentication to all Staff Hub routes
router.use(authenticateToken);

const requestUploadDir = path.join(__dirname, '../../uploads/requests');
if (!fs.existsSync(requestUploadDir)) {
    fs.mkdirSync(requestUploadDir, { recursive: true });
}

const requestStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, requestUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const requestUpload = multer({ storage: requestStorage });

// Requests
router.post('/requests', requestUpload.single('attachment'), staffHubController.createLeaveRequest);
router.patch('/requests/:id/status', staffHubController.updateRequestStatus);
router.get('/requests/employee/:employeeId', staffHubController.getRequestsByEmployee);
router.get('/requests/:id/form', staffHubController.getLeaveRequestForm);
router.get('/requests/pending', staffHubController.getPendingRequests);

// Replacement (cover) employee nomination + acceptance.
router.get('/replacement-candidates', staffHubController.getReplacementCandidatesForEmployee);
router.get('/my-replacement-requests', staffHubController.getMyReplacementRequests);
router.patch('/requests/:id/replacement-decision', staffHubController.decideReplacement);

// New org-chain approval steps (PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE only) — server-verified,
// separate from the legacy status-based flow above which the other request types still use.
router.get('/requests/my-pending-steps', staffHubController.getMyPendingSteps);
router.patch('/requests/:requestId/steps/:stepId/decision', requestUpload.single('document'), staffHubController.decideApprovalStep);

const uploadDir = path.join(__dirname, '../../uploads/announcements');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Announcements — posting/editing/removing is a management action gated by `manage_announcements`.
const canManageAnnouncements = authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_announcements']);
router.post('/announcements', canManageAnnouncements, upload.single('attachment'), staffHubController.createAnnouncement);
router.put('/announcements/:id', canManageAnnouncements, upload.single('attachment'), staffHubController.updateAnnouncement);
router.delete('/announcements/:id', canManageAnnouncements, staffHubController.deleteAnnouncement);
router.get('/announcements/all', staffHubController.getAllAnnouncements);
router.get('/announcements/user/:userId/:departmentId?', staffHubController.getAnnouncementsForUser);

export default router;
