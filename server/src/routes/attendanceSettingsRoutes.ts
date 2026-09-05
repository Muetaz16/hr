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
    getEmployeeShifts,
    createEmployeeShift,
    updateEmployeeShift,
    deleteEmployeeShift,
} from '../controllers/attendanceSettingsController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Read-only: the Attendance & Leave Requests screens reference the scheduled work hours (e.g.
// to show "Scheduled Shift: 09:00–17:00" next to actual punches), so attendance viewers can
// read the snapshot even though managing these settings needs manage_attendance_settings.
router.get('/snapshot', authorizeAccess(['SUPER_ADMIN'], ['view_time_tracking', 'manage_time_tracking']), getSystemSettingsSnapshot);
// Everything below is attendance CONFIGURATION. It used to be authorizeRoles('SUPER_ADMIN') — the
// only genuinely non-delegable role-only gate left on the server — which meant the Head of
// Attendance hat could not open the settings it owns. Now role OR permission, like every other
// route here, so the capability can be delegated via a hat or an individual grant.
router.use(authorizeAccess(['SUPER_ADMIN'], ['manage_attendance_settings']));

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

router.get('/employee-shifts', getEmployeeShifts);
router.post('/employee-shifts', createEmployeeShift);
router.put('/employee-shifts/:id', updateEmployeeShift);
router.delete('/employee-shifts/:id', deleteEmployeeShift);

export default router;
