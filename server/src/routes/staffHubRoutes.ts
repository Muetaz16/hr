import { Router } from 'express';
import * as staffHubController from '../controllers/staffHubController';
import { authenticateToken } from '../middleware/auth';

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
router.get('/requests/pending', staffHubController.getPendingRequests);

// Tasks
router.post('/tasks', staffHubController.createTask);
router.patch('/tasks/:id/status', staffHubController.updateTaskStatus);
router.get('/tasks/scoped', staffHubController.getScopedTasks);
router.get('/tasks/user/:userId/:departmentId?', staffHubController.getTasksForUser);
router.patch('/tasks/:id/review', staffHubController.reviewTask);

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

// Announcements
router.post('/announcements', upload.single('attachment'), staffHubController.createAnnouncement);
router.put('/announcements/:id', upload.single('attachment'), staffHubController.updateAnnouncement);
router.delete('/announcements/:id', staffHubController.deleteAnnouncement);
router.get('/announcements/all', staffHubController.getAllAnnouncements);
router.get('/announcements/user/:userId/:departmentId?', staffHubController.getAnnouncementsForUser);

export default router;
