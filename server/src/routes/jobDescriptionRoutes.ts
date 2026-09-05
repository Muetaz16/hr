import { Router } from 'express';
import { authenticateToken, authorizeAccess, authorizeRoles } from '../middleware/auth';
import {
    getAllJobDescriptions, createJobDescription, updateJobDescription, deleteJobDescription,
    generateJobDescriptionDoc
} from '../controllers/jobDescriptionController';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizeRoles('SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'EMPLOYEE', 'GENERAL_MANAGER', 'CHAIRMAN'), getAllJobDescriptions);
// Role OR permission: this was authorizeRoles-only, so an account whose chart position is
// EMPLOYEE but who wears the HR Manager or Head of Recruitment hat could not download a JD
// document. Every head still qualifies by position; the hats now qualify by permission.
router.get('/:id/document', authorizeAccess(['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'GENERAL_MANAGER', 'CHAIRMAN'], ['manage_job_descriptions', 'view_recruitment']), generateJobDescriptionDoc);
router.post('/', authorizeAccess(['SUPER_ADMIN'], ['manage_job_descriptions']), createJobDescription);
router.put('/:id', authorizeAccess(['SUPER_ADMIN'], ['manage_job_descriptions']), updateJobDescription);
router.delete('/:id', authorizeAccess(['SUPER_ADMIN'], ['manage_job_descriptions']), deleteJobDescription);

export default router;
