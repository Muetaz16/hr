import express from 'express';
import { 
    getAllRecruitmentRequests, 
    createRecruitmentRequest, 
    updateRecruitmentRequest,
    updateRecruitmentRequestStatus, 
    deleteRecruitmentRequest 
} from '../controllers/recruitmentController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getAllRecruitmentRequests);
router.post('/', createRecruitmentRequest);
router.put('/:id', updateRecruitmentRequest); // New Edit Route
router.put('/:id/status', updateRecruitmentRequestStatus);
router.delete('/:id', deleteRecruitmentRequest);

export default router;
