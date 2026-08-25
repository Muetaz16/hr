import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLogController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
// Viewing the system activity log requires the dedicated `view_logs` permission (or SUPER_ADMIN).
router.get('/', authorizeAccess(['SUPER_ADMIN'], ['view_logs']), getAuditLogs);

export default router;
