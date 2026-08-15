import { Router } from 'express';
import {
    getAttendanceSummary,
    getAttendanceLeaveTypes,
    getAttendanceDashboard,
    getAttendanceHistory,
    getAttendanceMonthlyReport,
    getManualTransactions,
    addMissingPunch,
    addLeave,
    getEmployeeLeaves,
    deleteEmployeeLeave,
    addOvertime,
    addOutWork,
    getOutWorks,
    deleteOutWork,
    addExcusedLate,
    getExcusedLates,
    deleteExcusedLate,
    addExcusedEarlyOut,
    getExcusedEarlyOuts,
    deleteExcusedEarlyOut,
    getBioTimeEmployees,
    createBioTimeEmployee,
    updateBioTimeEmployee,
    deleteBioTimeEmployee,
    syncEmployeesFromBioTime,
    getMyMonthlyReport,
} from '../controllers/attendanceIntegrationController';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Self-service: any authenticated employee can view their own attendance activity.
router.get('/me/monthly-report', getMyMonthlyReport);

// Role OR permission: the attendance/time-tracking permissions (granted to a Head of Attendance &
// Payroll) open the attendance workspace even when the account's org role isn't listed here.
router.use(authorizeAccess(['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], ['view_time_tracking', 'manage_time_tracking']));

router.get('/summary', getAttendanceSummary);
router.get('/leave-types', getAttendanceLeaveTypes);
router.get('/dashboard', getAttendanceDashboard);
router.get('/history/:empId', getAttendanceHistory);
router.get('/monthly-report/:empId', getAttendanceMonthlyReport);
router.get('/manual-transactions', getManualTransactions);
router.post('/missing-punches', addMissingPunch);

// Daily Logging
router.post('/leaves', addLeave);
router.get('/employee-leaves', getEmployeeLeaves);
router.delete('/employee-leaves/:id', deleteEmployeeLeave);
router.post('/overtimes', addOvertime);
router.post('/out-works', addOutWork);
router.get('/out-works', getOutWorks);
router.delete('/out-works/:id', deleteOutWork);
router.post('/excused-lates', addExcusedLate);
router.get('/excused-lates', getExcusedLates);
router.delete('/excused-lates/:id', deleteExcusedLate);
router.post('/excused-early-outs', addExcusedEarlyOut);
router.get('/excused-early-outs', getExcusedEarlyOuts);
router.delete('/excused-early-outs/:id', deleteExcusedEarlyOut);

// Employees (BioTime roster)
router.get('/biotime-employees', getBioTimeEmployees);
router.post('/biotime-employees', createBioTimeEmployee);
router.patch('/biotime-employees/:id', updateBioTimeEmployee);
router.delete('/biotime-employees/:id', deleteBioTimeEmployee);

// Bulk import: pull the whole BioTime roster into HR as linked employees (pending enrolment).
router.post('/sync-employees', syncEmployeesFromBioTime);

export default router;
