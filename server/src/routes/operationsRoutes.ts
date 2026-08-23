import { Router } from 'express';
import * as operationsController from '../controllers/operationsController';
import { authenticateToken as authenticate, authorizeAccess } from '../middleware/auth';

const router = Router();

// Apply auth to all operation routes
router.use(authenticate);

// Creating an asset request / support ticket is self-service (any employee). Acting on them
// (approving/assigning/closing/deleting) requires the matching management permission.
const canManageAssets = authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_onboarding']);
const canManageTickets = authorizeAccess(['SUPER_ADMIN'], ['manage_it_issues']);

// --- Asset Requests ---
router.post('/assets', operationsController.createAssetRequest);
router.patch('/assets/:id', canManageAssets, operationsController.updateAssetStatus);
router.get('/assets', operationsController.getScopedAssetRequests);

// --- Support Tickets ---
router.post('/tickets', operationsController.createSupportTicket);
router.patch('/tickets/:id', canManageTickets, operationsController.updateTicketStatus);
router.patch('/tickets/:id/assign', canManageTickets, operationsController.assignTicket);
router.get('/tickets', operationsController.getScopedTickets);
router.delete('/tickets/:id', canManageTickets, operationsController.deleteTicket);

export default router;
