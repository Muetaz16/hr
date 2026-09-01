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
const requestUpload = multer({
    storage: requestStorage,
    // Generous cap for a signed PDF/scan; keeps a runaway upload from filling the disk.
    limits: { fileSize: 25 * 1024 * 1024 },
});

// Wrap multer's single-file middleware so upload failures (oversized file, disk error) come back as
// a clean JSON 400 the client can show, instead of multer's default HTML error page (which the
// front-end can't parse — the GM upload would look like it silently "did nothing").
const singleRequestUpload = (field: string) => (req: any, res: any, next: any) => {
    requestUpload.single(field)(req, res, (err: any) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE'
                ? 'The file is too large — please keep it under 25 MB.'
                : (err.message || 'File upload failed. Please try again.');
            return res.status(400).json({ error: msg });
        }
        next();
    });
};

// Requests
router.post('/requests', singleRequestUpload('attachment'), staffHubController.createLeaveRequest);
router.patch('/requests/:id/status', staffHubController.updateRequestStatus);
// The creator withdraws their own in-flight request (any type). Ownership is verified server-side.
router.patch('/requests/:id/cancel', staffHubController.cancelRequest);
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
router.patch('/requests/:requestId/steps/:stepId/decision', singleRequestUpload('document'), staffHubController.decideApprovalStep);

// Exceptional Performance Award nomination — a Head picks from their own team, previews
// eligibility, and tracks their own submitted nominations (employeeId there is the nominee, not
// the submitter, so it can't reuse /requests/employee/:employeeId).
router.get('/my-nomination-team', staffHubController.getMyNominationTeam);
router.get('/exceptional-performance-eligibility/:employeeId', staffHubController.getExceptionalPerformanceEligibilityHandler);
router.get('/my-submitted-nominations', staffHubController.getMySubmittedNominations);
// Broad visibility (not just the submitter) — the dedicated award screen's History tab.
router.get('/exceptional-performance/history', authorizeAccess(['HR_MANAGER', 'PERSONNEL', 'GENERAL_MANAGER'], ['manage_rewards', 'approve_gm']), staffHubController.getExceptionalPerformanceHistory);

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
