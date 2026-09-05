import { Router } from 'express';
import * as promotionController from '../controllers/promotionController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Entirely HR-initiated — no employee self-service side, unlike Offboarding/Disciplinary.
const canManage = authorizeAccess([], ['manage_promotions']);
router.use(canManage);

router.get('/candidates', promotionController.getCandidates);
router.get('/', promotionController.listCases);
router.get('/:id', promotionController.getCase);
router.post('/from-candidate', promotionController.createCaseFromCandidate);
router.post('/exceptional', promotionController.createExceptionalCase);
router.post('/:id/form/:stage', promotionController.generateStageForm);
router.post('/:id/complete-promotion-report', promotionController.completePromotionReport);
router.post('/:id/complete-notice-of-promotion', promotionController.completeNoticeOfPromotion);

export default router;
