import { Router } from 'express';
import * as rewardController from '../controllers/rewardController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Entirely HR-initiated — no employee self-service side, same as Promotions. Exceptional
// Performance nominations are submitted via StaffHub and decided via the generic approval-chain
// engine (staff-hub routes) — this router only ever sees them once a case already exists here to
// finalize, exactly like every other award type.
const canManage = authorizeAccess([], ['manage_rewards']);
router.use(canManage);

router.get('/candidates/month', rewardController.getMonthCandidates);
router.get('/candidates/attendance', rewardController.getAttendanceCandidatesHandler);
router.get('/candidates/loyalty', rewardController.getLoyaltyMilestoneCandidates);
router.get('/candidates/year', rewardController.getEmployeeOfYearCandidates);
router.get('/candidates/month/:employeeId', rewardController.getMonthCandidateDetail);
router.get('/candidates/attendance/:employeeId', rewardController.getAttendanceCandidateDetail);
router.get('/candidates/loyalty/:employeeId', rewardController.getLoyaltyCandidateDetail);
router.get('/candidates/year/:employeeId', rewardController.getYearCandidateDetail);
router.get('/', rewardController.listRewards);
router.get('/:id', rewardController.getReward);
router.post('/employee-of-month', rewardController.createMonthCase);
router.post('/attendance-excellence', rewardController.createAttendanceCase);
router.post('/loyalty-milestone', rewardController.createLoyaltyCase);
router.post('/employee-of-year', rewardController.createEmployeeOfYearAward);
router.post('/:id/appreciation-letter', rewardController.generateAppreciationLetter);
router.post('/:id/complete', rewardController.completeReward);
router.post('/:id/physical-reward', rewardController.markPhysicalRewardFulfilled);

export default router;
