import express from 'express';
import {
    getServiceProviders, createServiceProvider, updateServiceProvider, deleteServiceProvider,
} from '../controllers/serviceProviderController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

// Reading is open to any signed-in user: recruitment needs the list on the candidate form and HR
// needs it on the employee form, neither of which should require the admin permission.
router.get('/', getServiceProviders);

router.post('/', authorizeAccess(['SUPER_ADMIN'], ['manage_service_providers']), createServiceProvider);
router.put('/:id', authorizeAccess(['SUPER_ADMIN'], ['manage_service_providers']), updateServiceProvider);
router.delete('/:id', authorizeAccess(['SUPER_ADMIN'], ['manage_service_providers']), deleteServiceProvider);

export default router;
