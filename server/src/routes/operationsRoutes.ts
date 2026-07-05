import { Router } from 'express';
import * as operationsController from '../controllers/operationsController';
import { authenticateToken as authenticate } from '../middleware/auth';

const router = Router();

// Apply auth to all operation routes
router.use(authenticate);

// --- Asset Requests ---
router.post('/assets', operationsController.createAssetRequest);
router.patch('/assets/:id', operationsController.updateAssetStatus);
router.get('/assets', operationsController.getScopedAssetRequests);

// --- Support Tickets ---
router.post('/tickets', operationsController.createSupportTicket);
router.patch('/tickets/:id', operationsController.updateTicketStatus);
router.patch('/tickets/:id/assign', operationsController.assignTicket);
router.get('/tickets', operationsController.getScopedTickets);
router.delete('/tickets/:id', operationsController.deleteTicket);

export default router;
