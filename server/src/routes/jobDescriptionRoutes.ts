import { Router } from 'express';
import { authenticateToken, authorizeAccess, authorizeRoles } from '../middleware/auth';
import {
    getAllJobDescriptions, createJobDescription, updateJobDescription, deleteJobDescription
} from '../controllers/jobDescriptionController';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'EMPLOYEE', 'GENERAL_MANAGER', 'CHAIRMAN'), getAllJobDescriptions);
router.post('/', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_job_descriptions']), createJobDescription);
router.put('/:id', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_job_descriptions']), updateJobDescription);
router.delete('/:id', authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER'], ['manage_job_descriptions']), deleteJobDescription);

export default router;
