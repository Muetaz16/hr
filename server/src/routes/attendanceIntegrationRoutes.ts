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
    getPunchAnomalies,
} from '../controllers/attendanceIntegrationController';
import { createPunchCorrection, listPunchCorrections } from '../controllers/attendancePunchCorrectionController';
import {
    createOvertimeApprovals, listOvertimeApprovals, editOvertimeApproval, revokeOvertimeApproval,
} from '../controllers/attendanceOvertimeController';
import { getOvertimeReport, getOvertimeReportDocument } from '../controllers/attendanceOvertimeReport';
import { authenticateToken, authorizeAccess } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Self-service: any authenticated employee can view their own attendance activity.
router.get('/me/monthly-report', getMyMonthlyReport);

// Role OR permission: the attendance/time-tracking permissions (granted to a Head of Attendance &
// Payroll) open the attendance workspace even when the account's org role isn't listed here.
//
// correct_punches / approve_overtime are listed too. They are narrow WRITE grants, but this gate
// runs first — without them here, somebody granted only "approve overtime" would be refused at the
// door and never reach the route that permission exists to open. The per-route checks below are
// what keep them narrow; this one only decides who may enter the workspace at all.
router.use(authorizeAccess(['SUPER_ADMIN'], [
    'view_time_tracking', 'manage_time_tracking', 'correct_punches', 'approve_overtime',
]));

router.get('/summary', getAttendanceSummary);
router.get('/leave-types', getAttendanceLeaveTypes);
router.get('/dashboard', getAttendanceDashboard);
router.get('/history/:empId', getAttendanceHistory);
router.get('/monthly-report/:empId', getAttendanceMonthlyReport);
router.get('/manual-transactions', getManualTransactions);
// The cross-employee sweep for days whose punches did not come out as a working day. A read, so
// the router-level view_time_tracking gate above is the right level for it — the corrections that
// follow from this queue are writes and will carry their own manage_time_tracking check.
router.get('/punch-anomalies', getPunchAnomalies);
router.get('/punch-corrections', listPunchCorrections);
// Writing a correction is NOT covered by the router-level gate above, which also admits a
// view_time_tracking holder — a read permission must not let somebody rewrite a punch that pays
// money. This route carries its own write check: the broad manage_time_tracking, or the narrow
// correct_punches for an officer who does only this.
router.post(
    '/punch-corrections',
    authorizeAccess(['SUPER_ADMIN'], ['manage_time_tracking', 'correct_punches']),
    createPunchCorrection,
);
router.post('/missing-punches', addMissingPunch);

// Daily Logging
router.post('/leaves', addLeave);
router.get('/employee-leaves', getEmployeeLeaves);
router.delete('/employee-leaves/:id', deleteEmployeeLeave);
// Recorded overtime for a range, grouped for the head who approves it. A read.
router.get('/overtime-report', getOvertimeReport);
router.get('/overtime-report/document', getOvertimeReportDocument);
// Approved overtime is the ONLY figure payroll pays for hours beyond the schedule, so the write
// carries its own manage_time_tracking check rather than relying on the router-level gate above,
// which also admits a read-only view_time_tracking holder.
router.get('/overtime-approvals', listOvertimeApprovals);
router.post(
    '/overtime-approvals',
    authorizeAccess(['SUPER_ADMIN'], ['manage_time_tracking', 'approve_overtime']),
    createOvertimeApprovals,
);
// Changing or revoking an approval moves the same money the original did, so both carry the write
// permission too. A revoke sets the approved hours to ZERO rather than removing anything: the
// attendance system has no delete endpoint for overtime, and the record survives at 00:00:00.
router.patch(
    '/overtime-approvals/:id',
    authorizeAccess(['SUPER_ADMIN'], ['manage_time_tracking', 'approve_overtime']),
    editOvertimeApproval,
);
router.delete(
    '/overtime-approvals/:id',
    authorizeAccess(['SUPER_ADMIN'], ['manage_time_tracking', 'approve_overtime']),
    revokeOvertimeApproval,
);
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
