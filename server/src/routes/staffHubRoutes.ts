import { Router } from 'express';
import * as staffHubController from '../controllers/staffHubController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication to all Staff Hub routes
router.use(authenticateToken);

// Requests
router.post('/requests', staffHubController.createLeaveRequest);
router.patch('/requests/:id/status', staffHubController.updateRequestStatus);
router.get('/requests/employee/:employeeId', staffHubController.getRequestsByEmployee);
router.get('/requests/pending', staffHubController.getPendingRequests);

// Tasks
router.post('/tasks', staffHubController.createTask);
router.patch('/tasks/:id/status', staffHubController.updateTaskStatus);
router.get('/tasks/scoped', staffHubController.getScopedTasks);
router.get('/tasks/user/:userId/:departmentId?', staffHubController.getTasksForUser);
router.patch('/tasks/:id/review', staffHubController.reviewTask);

// Announcements
router.post('/announcements', staffHubController.createAnnouncement);
router.put('/announcements/:id', staffHubController.updateAnnouncement);
router.delete('/announcements/:id', staffHubController.deleteAnnouncement);
router.get('/announcements/all', staffHubController.getAllAnnouncements);
router.get('/announcements/user/:userId/:departmentId?', staffHubController.getAnnouncementsForUser);

export default router;
