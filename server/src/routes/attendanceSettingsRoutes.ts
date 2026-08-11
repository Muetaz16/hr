import { Router } from 'express';
import {
    getSystemSettingsSnapshot,
    updateSystemSetting,
    updateLeaveType,
    getHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    getMultiplierFactors,
    createMultiplierFactor,
    updateMultiplierFactor,
    deleteMultiplierFactor,
} from '../controllers/attendanceSettingsController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Read-only: the Attendance & Leave Requests screens reference the scheduled work hours (e.g.
// to show "Scheduled Shift: 09:00–17:00" next to actual punches), so HR_MANAGER/PERSONNEL can
// read the snapshot even though only SUPER_ADMIN can manage these settings.
router.get('/snapshot', authorizeRoles('SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'), getSystemSettingsSnapshot);

router.use(authorizeRoles('SUPER_ADMIN'));

// Work-Hour Settings and Leave Types: edit only — no add/delete. Both are structural config the
// attendance system's own calculations reference by key/id, so entries aren't meant to be freely
// created or removed here.
router.put('/settings/:id', updateSystemSetting);
router.put('/leave-types/:id', updateLeaveType);

router.get('/holidays', getHolidays);
router.post('/holidays', createHoliday);
router.put('/holidays/:id', updateHoliday);
router.delete('/holidays/:id', deleteHoliday);

router.get('/multiplier-factors', getMultiplierFactors);
router.post('/multiplier-factors', createMultiplierFactor);
router.put('/multiplier-factors/:id', updateMultiplierFactor);
router.delete('/multiplier-factors/:id', deleteMultiplierFactor);

export default router;
