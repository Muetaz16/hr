import React, { useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Users, CalendarCheck, Fingerprint, Timer, Eye, AlertTriangle, PlusCircle, Search, Filter, Pencil, Trash2, ShieldCheck, ShieldOff, CalendarDays, Percent, CalendarClock, Settings as SettingsIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { attendanceService, type AttendanceSummaryEmployee, type BioTimeEmployee } from '../services/attendanceService';
import {
    attendanceSettingsService,
    type SystemSettingItem,
    type LeaveTypeItem,
    type HolidayItem,
    type MultiplierFactorItem,
    type EmployeeShiftItem,
} from '../services/attendanceSettingsService';
import { staffHubService } from '../services/staffHubService';
import { useAuth } from '../context/AuthContext';
import { formatMinutesAsHM, formatHmsAsHM } from '../utils/attendanceFormat';
import { resolveDayStatus, fillMissingDays } from '../utils/attendanceDayStatus';
import Modal from '../components/Modal';
import DailyBreakdownTable from '../components/DailyBreakdownTable';
import AttendanceInsights from '../components/AttendanceInsights';

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: React.ReactNode; color: string }) => (
    <div className="bg-white border border-[#511d29]/10 rounded-xl p-5 shadow-sm flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-slate-800">{value}</p>
        </div>
    </div>
);

// Searchable employee picker — same interaction pattern already established for the Disciplinary/
// Offboarding modules' employee search fields (PersonnelRelations.tsx / ReportIncident.tsx),
// restyled to match this page's own modal look. Replaces a plain <select> everywhere a modal here
// asks "which employee" — the roster is too long to scroll through natively. `value`/`onChange`
// work on the employee code (empCode) string, matching how every form on this page already stores
// its selection, rather than a full Employee object.
const EmployeeSearchSelect: React.FC<{
    options: { code: string; name: string }[];
    value: string;
    onChange: (code: string) => void;
    disabled?: boolean;
    placeholder?: string;
}> = ({ options, value, onChange, disabled, placeholder }) => {
    const [query, setQuery] = useState(() => {
        const match = options.find(o => o.code === value);
        return match ? `${match.name} (${match.code})` : '';
    });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const blurTimeout = useRef<number | null>(null);

    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q || value) return [];
        return options.filter(o => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)).slice(0, 8);
    }, [query, options, value]);

    return (
        <div className="relative">
            <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); if (value) onChange(''); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => { blurTimeout.current = window.setTimeout(() => setShowSuggestions(false), 150); }}
                disabled={disabled}
                placeholder={placeholder || "Start typing the employee's name…"}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:bg-slate-50 disabled:text-slate-400"
            />
            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-md max-h-56 overflow-auto">
                    {suggestions.map(o => (
                        <li key={o.code}>
                            <button
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { onChange(o.code); setQuery(`${o.name} (${o.code})`); setShowSuggestions(false); }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                            >
                                {o.name} ({o.code})
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

type Tab = 'overview' | 'exceptions' | 'daily-logging' | 'employees' | 'settings';
type SettingsSubTab = 'hours' | 'leave-types' | 'holidays' | 'multipliers' | 'shifts';

// The attendance API's own "blank params" default turned out to be unreliable (same query
// returned 91 employees once, then an empty list every time after) — so we always pass an
// explicit date range, defaulting to today, rather than leaving it up to their default.
const todayStr = () => format(new Date(), 'yyyy-MM-dd');

type SummaryFilter = 'all' | 'late' | 'earlyOut' | 'onLeave' | 'suspended' | 'unmatched';

// The attendance system exposes no lookup endpoint for positions — these 4 are the fixed set
// found live on the running roster (GET /api/attendance).
const BIOTIME_POSITIONS = [
    { id: 4, name: 'Resident' },
    { id: 5, name: 'Non-Resident' },
    { id: 6, name: 'Exception' },
    { id: 7, name: 'Higher-Management' },
];

const AttendancePage: React.FC = () => {
    const queryClient = useQueryClient();
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const tab: Tab = location.pathname.includes('/exceptions')
        ? 'exceptions'
        : location.pathname.includes('/daily-logging')
        ? 'daily-logging'
        : location.pathname.includes('/employees')
        ? 'employees'
        : location.pathname.includes('/settings')
        ? 'settings'
        : 'overview';

    // Shared: the roster summary also doubles as the employee picker for the missing-punch popup.
    const [attendanceStart, setAttendanceStart] = useState(todayStr);
    const [attendanceEnd, setAttendanceEnd] = useState(todayStr);
    const { data: attendanceSummary, isLoading: isLoadingAttendance, isError: isAttendanceError } = useQuery({
        queryKey: ['attendance-summary', attendanceStart, attendanceEnd],
        queryFn: () => attendanceService.getSummary(attendanceStart || undefined, attendanceEnd || undefined),
        retry: false,
    });
    const allAttendanceRows = attendanceSummary?.employees || [];
    // Shared option list for every EmployeeSearchSelect fed by the summary roster (missing-punch,
    // leave, overtime, out-work, excused-late, excused-early-out logging popups).
    const attendanceEmployeeOptions = useMemo(
        () => allAttendanceRows.map(r => ({ code: r.empCode, name: r.matchedFullName || r.empName })),
        [allAttendanceRows]
    );

    // Additional filters on the summary table — all client-side since the roster for a given
    // date range is small enough to already be fully loaded.
    const [summarySearch, setSummarySearch] = useState('');
    const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>('all');
    const attendanceRows = allAttendanceRows.filter(row => {
        const name = (row.matchedFullName || row.empName || '').toLowerCase();
        const matchesSearch = !summarySearch || name.includes(summarySearch.toLowerCase()) || row.empCode.toLowerCase().includes(summarySearch.toLowerCase());
        if (!matchesSearch) return false;
        switch (summaryFilter) {
            case 'late': return row.totalLateMins > 0;
            case 'earlyOut': return row.totalEarlyOutMins > 0;
            case 'onLeave': return row.paidLeaveDays > 0 || row.unpaidLeaveDays > 0 || row.emergencyLeaveDays > 0;
            case 'suspended': return row.suspensionDays > 0;
            case 'unmatched': return !row.employeeId;
            default: return true;
        }
    });

    const { data: dashboard } = useQuery({
        queryKey: ['attendance-dashboard'],
        queryFn: () => attendanceService.getDashboard(),
        retry: false,
    });

    // Per-employee detail modal — starts out showing the same range selected in the Overview
    // table, but keeps its own start/end after that so changing the period inside the modal
    // doesn't also change the Overview table's range.
    const [detailRow, setDetailRow] = useState<AttendanceSummaryEmployee | null>(null);
    const [detailStart, setDetailStart] = useState('');
    const [detailEnd, setDetailEnd] = useState('');
    const openDetail = (row: AttendanceSummaryEmployee) => {
        setDetailRow(row);
        setDetailStart(attendanceStart);
        setDetailEnd(attendanceEnd);
    };
    const { data: monthlyReport, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['attendance-monthly-report', detailRow?.empId, detailStart, detailEnd],
        queryFn: () => attendanceService.getMonthlyReport(detailRow!.empId, detailStart || undefined, detailEnd || undefined),
        enabled: !!detailRow,
        retry: false,
    });
    // The official shift times (Work Start/End) give the "Lateness Breakdown" below something to
    // compare punches against. Fetched lazily (only once the detail modal is opened) since it's
    // purely for context — if it fails to load, the breakdown still works without it. Also backs
    // the Work Hours + Leave Types sections of the Settings tab (SUPER_ADMIN only).
    const { data: settingsSnapshot, isLoading: isLoadingSnapshot } = useQuery({
        queryKey: ['attendance-settings-snapshot'],
        queryFn: () => attendanceSettingsService.getSnapshot(),
        enabled: !!detailRow || (tab === 'settings' && isSuperAdmin),
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
    const getSettingValue = (key: string) => settingsSnapshot?.systemSettings.find(s => s.key === key)?.value;
    const systemSettingsList = settingsSnapshot?.systemSettings || [];
    const leaveTypesList = settingsSnapshot?.leaveTypes || [];
    type DetailFilter = 'all' | 'late' | 'earlyOut' | 'holiday' | 'outWork' | 'excused' | 'suspended';
    const [detailFilter, setDetailFilter] = useState<DetailFilter>('all');
    // The attendance system only returns rows it has data for — filling the gaps first (before
    // the filter below) is what lets a genuine no-show day be caught as Absent at all.
    const filledDetailReportData = monthlyReport
        ? fillMissingDays(monthlyReport.reportData, monthlyReport.startDate, monthlyReport.endDate)
        : [];
    const detailReportRows = filledDetailReportData.filter(day => {
        switch (detailFilter) {
            case 'late': return day.lateMins > 0;
            case 'earlyOut': return day.earlyOutMins > 0;
            case 'holiday': return day.isHoliday;
            case 'outWork': return day.isOutWork;
            case 'excused': return day.isExcusedLate || day.isExcusedEarlyOut;
            case 'suspended': return day.isSuspended;
            default: return true;
        }
    });

    // Exceptions tab — manual (hand-corrected) transactions + missing-punch logging.
    const [excStart, setExcStart] = useState('');
    const [excEnd, setExcEnd] = useState('');
    const [excSearch, setExcSearch] = useState('');
    const { data: manualTx, isLoading: isLoadingManualTx, isError: isManualTxError } = useQuery({
        queryKey: ['attendance-manual-tx', excStart, excEnd, excSearch],
        queryFn: () => attendanceService.getManualTransactions(excStart || undefined, excEnd || undefined, excSearch || undefined),
        enabled: tab === 'exceptions',
        retry: false,
    });
    const manualTxRows = manualTx?.transactions || [];

    const [missingPunchOpen, setMissingPunchOpen] = useState(false);
    const [mpEmpCode, setMpEmpCode] = useState('');
    const [mpPunchTime, setMpPunchTime] = useState('');
    const [mpPunchState, setMpPunchState] = useState<'0' | '1'>('0');
    const [submittingPunch, setSubmittingPunch] = useState(false);

    const closeMissingPunch = () => {
        setMissingPunchOpen(false);
        setMpEmpCode('');
        setMpPunchTime('');
        setMpPunchState('0');
    };

    const handleAddMissingPunch = async () => {
        const employee = allAttendanceRows.find(r => r.empCode === mpEmpCode);
        if (!employee) { toast.error('Select an employee.'); return; }
        if (!mpPunchTime) { toast.error('Choose the punch date & time.'); return; }
        setSubmittingPunch(true);
        try {
            await attendanceService.addMissingPunch({
                empCode: employee.empCode,
                empId: employee.empId,
                // Send the typed clock time as-is — the attendance system stores this string's
                // digits literally as the wall-clock punch time. Going through `new Date(...)
                // .toISOString()` here silently shifted it by the browser's UTC offset (e.g.
                // 14:30 typed became 12:30 recorded in Tripoli's UTC+2), which is exactly the bug
                // reported: the punch showing up 2 hours off from what was entered.
                punchTime: `${mpPunchTime}:00`,
                punchState: mpPunchState,
            });
            toast.success('Missing punch logged.');
            closeMissingPunch();
            queryClient.invalidateQueries({ queryKey: ['attendance-manual-tx'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
        } catch (err: any) {
            console.error('Failed to log missing punch', err);
            toast.error(err?.response?.data?.error || 'Failed to log the missing punch.');
        } finally {
            setSubmittingPunch(false);
        }
    };

    // Daily Logging tab — 4 quick-add popups (create via /api/attendance/*) + 3 review lists
    // (list/delete via /api/system-settings/*, the only endpoints that expose them). There's no
    // documented list/delete for overtimes, only the quick-add.
    const { data: leaveTypes = [] } = useQuery({
        queryKey: ['attendance-leave-types'],
        queryFn: () => attendanceService.getLeaveTypes(),
        enabled: tab === 'daily-logging',
        retry: false,
    });
    const { data: employeeLeaves = [], isLoading: isLoadingLeaves } = useQuery({
        queryKey: ['attendance-employee-leaves'],
        queryFn: () => attendanceService.getEmployeeLeaves(),
        enabled: tab === 'daily-logging',
        retry: false,
    });
    // Fully-approved leaves from our own approval chain — shown as a live list on the overview.
    const { data: approvedLeaves = [] } = useQuery({
        queryKey: ['approved-leaves-overview'],
        queryFn: () => staffHubService.getApprovedLeaves(),
        enabled: tab === 'overview',
        retry: false,
    });
    const { data: outWorksList = [], isLoading: isLoadingOutWorks } = useQuery({
        queryKey: ['attendance-out-works-list'],
        queryFn: () => attendanceService.getOutWorks(),
        enabled: tab === 'daily-logging',
        retry: false,
    });
    const { data: excusedLatesList = [], isLoading: isLoadingExcusedLates } = useQuery({
        queryKey: ['attendance-excused-lates-list'],
        queryFn: () => attendanceService.getExcusedLates(),
        enabled: tab === 'daily-logging',
        retry: false,
    });
    const { data: excusedEarlyOutsList = [], isLoading: isLoadingExcusedEarlyOuts } = useQuery({
        queryKey: ['attendance-excused-early-outs-list'],
        queryFn: () => attendanceService.getExcusedEarlyOuts(),
        enabled: tab === 'daily-logging',
        retry: false,
    });

    const [leaveOpen, setLeaveOpen] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ empCode: '', leaveTypeId: '', startDate: '', endDate: '', notes: '' });
    const [savingLeave, setSavingLeave] = useState(false);
    const submitLeave = async () => {
        if (!leaveForm.empCode || !leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) {
            toast.error('Select an employee, leave type, and both dates.'); return;
        }
        setSavingLeave(true);
        try {
            await attendanceService.addLeave({ ...leaveForm, leaveTypeId: Number(leaveForm.leaveTypeId) });
            toast.success('Leave logged.');
            setLeaveOpen(false);
            setLeaveForm({ empCode: '', leaveTypeId: '', startDate: '', endDate: '', notes: '' });
            queryClient.invalidateQueries({ queryKey: ['attendance-employee-leaves'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to log the leave.');
        } finally {
            setSavingLeave(false);
        }
    };

    const [otOpen, setOtOpen] = useState(false);
    const [otForm, setOtForm] = useState({ empCode: '', date: '', hours: '0', minutes: '0', reason: '' });
    const [savingOt, setSavingOt] = useState(false);
    const submitOvertime = async () => {
        if (!otForm.empCode || !otForm.date) { toast.error('Select an employee and date.'); return; }
        setSavingOt(true);
        try {
            await attendanceService.addOvertime({ ...otForm, hours: Number(otForm.hours) || 0, minutes: Number(otForm.minutes) || 0 });
            toast.success('Overtime logged.');
            setOtOpen(false);
            setOtForm({ empCode: '', date: '', hours: '0', minutes: '0', reason: '' });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-dashboard'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to log the overtime.');
        } finally {
            setSavingOt(false);
        }
    };

    const [owOpen, setOwOpen] = useState(false);
    const [owForm, setOwForm] = useState({ empCode: '', startDate: '', endDate: '', reason: '' });
    const [savingOw, setSavingOw] = useState(false);
    const submitOutWork = async () => {
        if (!owForm.empCode || !owForm.startDate || !owForm.endDate) { toast.error('Select an employee and both dates.'); return; }
        setSavingOw(true);
        try {
            await attendanceService.addOutWork(owForm);
            toast.success('Out-work logged.');
            setOwOpen(false);
            setOwForm({ empCode: '', startDate: '', endDate: '', reason: '' });
            queryClient.invalidateQueries({ queryKey: ['attendance-out-works-list'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to log the out-work.');
        } finally {
            setSavingOw(false);
        }
    };

    const [xlOpen, setXlOpen] = useState(false);
    const [xlForm, setXlForm] = useState({ empCode: '', date: '', excusedMinutes: '', reason: '' });
    const [savingXl, setSavingXl] = useState(false);
    const submitExcusedLate = async () => {
        if (!xlForm.empCode || !xlForm.date || !xlForm.excusedMinutes) {
            toast.error('Select an employee, the date, and the excused minutes.'); return;
        }
        setSavingXl(true);
        try {
            await attendanceService.addExcusedLate({ ...xlForm, excusedMinutes: Number(xlForm.excusedMinutes) });
            toast.success('Excused late logged.');
            setXlOpen(false);
            setXlForm({ empCode: '', date: '', excusedMinutes: '', reason: '' });
            queryClient.invalidateQueries({ queryKey: ['attendance-excused-lates-list'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to log the excused late.');
        } finally {
            setSavingXl(false);
        }
    };

    const [eoOpen, setEoOpen] = useState(false);
    const [eoForm, setEoForm] = useState({ empCode: '', date: '', excusedMinutes: '', reason: '' });
    const [savingEo, setSavingEo] = useState(false);
    const submitExcusedEarlyOut = async () => {
        if (!eoForm.empCode || !eoForm.date || !eoForm.excusedMinutes) {
            toast.error('Select an employee, the date, and the excused minutes.'); return;
        }
        setSavingEo(true);
        try {
            await attendanceService.addExcusedEarlyOut({ ...eoForm, excusedMinutes: Number(eoForm.excusedMinutes) });
            toast.success('Excused early-out logged.');
            setEoOpen(false);
            setEoForm({ empCode: '', date: '', excusedMinutes: '', reason: '' });
            queryClient.invalidateQueries({ queryKey: ['attendance-excused-early-outs-list'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to log the excused early-out.');
        } finally {
            setSavingEo(false);
        }
    };

    const deleteEmployeeLeave = async (id: number) => {
        if (!window.confirm('Remove this leave record? This cannot be undone.')) return;
        try {
            await attendanceService.deleteEmployeeLeave(id);
            toast.success('Leave record removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-employee-leaves'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
        } catch { toast.error('Failed to remove the leave record.'); }
    };
    const deleteOutWorkRow = async (id: number) => {
        if (!window.confirm('Remove this out-work record? This cannot be undone.')) return;
        try {
            await attendanceService.deleteOutWork(id);
            toast.success('Out-work record removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-out-works-list'] });
        } catch { toast.error('Failed to remove the out-work record.'); }
    };
    const deleteExcusedLateRow = async (id: number) => {
        if (!window.confirm('Remove this excused-late record? This cannot be undone.')) return;
        try {
            await attendanceService.deleteExcusedLate(id);
            toast.success('Excused-late record removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-excused-lates-list'] });
        } catch { toast.error('Failed to remove the excused-late record.'); }
    };
    const deleteExcusedEarlyOutRow = async (id: number) => {
        if (!window.confirm('Remove this excused early-out record? This cannot be undone.')) return;
        try {
            await attendanceService.deleteExcusedEarlyOut(id);
            toast.success('Excused early-out record removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-excused-early-outs-list'] });
        } catch { toast.error('Failed to remove the excused early-out record.'); }
    };

    // Hoisted above the Employees tab query below — the Employee Shifts settings screen reuses
    // the same BioTime roster for its employee picker, so its `enabled` condition needs
    // settingsSubTab before it's otherwise declared further down with the rest of Settings state.
    const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('hours');

    // Employees tab — BioTime roster CRUD (create/edit/delete the employee record inside the
    // attendance system itself, not our own Employee table). Also reused (unfiltered) by the
    // Employee Shifts settings screen's employee picker.
    const [empSearch, setEmpSearch] = useState('');
    const { data: bioTimeEmployeeList, isLoading: isLoadingBioTimeEmployees } = useQuery({
        queryKey: ['attendance-biotime-employees', empSearch],
        queryFn: () => attendanceService.getBioTimeEmployees(empSearch || undefined),
        enabled: tab === 'employees' || (tab === 'settings' && settingsSubTab === 'shifts'),
        retry: false,
    });
    const bioTimeEmployees = bioTimeEmployeeList?.employees || [];
    // Option list for the Employee Shifts picker (fed by the BioTime roster, not the summary rows).
    const bioTimeEmployeeOptions = useMemo(
        () => bioTimeEmployees.map(emp => ({ code: emp.emp_code, name: emp.first_name })),
        [bioTimeEmployees]
    );

    const [empModalOpen, setEmpModalOpen] = useState(false);
    const [empEditing, setEmpEditing] = useState<BioTimeEmployee | null>(null);
    const [empForm, setEmpForm] = useState({ empCode: '', firstName: '', positionId: String(BIOTIME_POSITIONS[0].id) });
    const [savingEmp, setSavingEmp] = useState(false);

    const openAddEmployee = () => {
        setEmpEditing(null);
        setEmpForm({ empCode: '', firstName: '', positionId: String(BIOTIME_POSITIONS[0].id) });
        setEmpModalOpen(true);
    };
    const openEditEmployee = (emp: BioTimeEmployee) => {
        setEmpEditing(emp);
        setEmpForm({ empCode: emp.emp_code, firstName: emp.first_name, positionId: String(emp.position?.id || BIOTIME_POSITIONS[0].id) });
        setEmpModalOpen(true);
    };
    const closeEmployeeModal = () => {
        setEmpModalOpen(false);
        setEmpEditing(null);
    };

    const submitEmployee = async () => {
        if (!empForm.empCode || !empForm.firstName || !empForm.positionId) {
            toast.error('Enter the employee code, name, and position.'); return;
        }
        setSavingEmp(true);
        try {
            if (empEditing) {
                await attendanceService.updateBioTimeEmployee(empEditing.id, { firstName: empForm.firstName, positionId: Number(empForm.positionId) });
                toast.success('Employee updated.');
            } else {
                await attendanceService.createBioTimeEmployee({ empCode: empForm.empCode, firstName: empForm.firstName, positionId: Number(empForm.positionId) });
                toast.success('Employee added.');
            }
            closeEmployeeModal();
            queryClient.invalidateQueries({ queryKey: ['attendance-biotime-employees'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save the employee.');
        } finally {
            setSavingEmp(false);
        }
    };

    const deleteBioTimeEmployeeRow = async (emp: BioTimeEmployee) => {
        if (!window.confirm(`Remove "${emp.first_name}" (${emp.emp_code}) from the attendance system? This cannot be undone.`)) return;
        try {
            await attendanceService.deleteBioTimeEmployee(emp.id);
            toast.success('Employee removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-biotime-employees'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to remove the employee.');
        }
    };

    // Settings tab (SUPER_ADMIN only) — Work-Hour Settings and Leave Types are edit-only (no
    // add/delete, enforced both here and on the backend); Holidays, Multiplier Factors, and
    // Employee Shifts keep full CRUD. Work Hours + Leave Types read from the same settingsSnapshot
    // query above. (settingsSubTab itself is declared earlier, above the Employees-tab query.)
    const { data: holidaysList = [], isLoading: isLoadingHolidays } = useQuery({
        queryKey: ['attendance-settings-holidays'],
        queryFn: () => attendanceSettingsService.getHolidays(),
        enabled: tab === 'settings' && settingsSubTab === 'holidays' && isSuperAdmin,
        retry: false,
    });
    const { data: multipliersList = [], isLoading: isLoadingMultipliers } = useQuery({
        queryKey: ['attendance-settings-multipliers'],
        queryFn: () => attendanceSettingsService.getMultiplierFactors(),
        enabled: tab === 'settings' && settingsSubTab === 'multipliers' && isSuperAdmin,
        retry: false,
    });
    const { data: employeeShiftsList = [], isLoading: isLoadingEmployeeShifts } = useQuery({
        queryKey: ['attendance-settings-employee-shifts'],
        queryFn: () => attendanceSettingsService.getEmployeeShifts(),
        enabled: tab === 'settings' && settingsSubTab === 'shifts' && isSuperAdmin,
        retry: false,
    });

    const [settingModalOpen, setSettingModalOpen] = useState(false);
    const [settingEditing, setSettingEditing] = useState<SystemSettingItem | null>(null);
    const [settingForm, setSettingForm] = useState({ key: '', valueString: '', description: '', isDuration: true });
    const [savingSetting, setSavingSetting] = useState(false);
    const openEditSetting = (s: SystemSettingItem) => {
        setSettingEditing(s);
        setSettingForm({ key: s.key, valueString: s.value, description: s.description || '', isDuration: true });
        setSettingModalOpen(true);
    };
    const submitSetting = async () => {
        if (!settingEditing || !settingForm.valueString) { toast.error('Enter a value.'); return; }
        setSavingSetting(true);
        try {
            await attendanceSettingsService.updateSetting(settingEditing.id, { key: settingForm.key, valueString: settingForm.valueString, description: settingForm.description || null, isDuration: settingForm.isDuration });
            toast.success('Setting saved.');
            setSettingModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-snapshot'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save the setting.');
        } finally {
            setSavingSetting(false);
        }
    };

    const [ltModalOpen, setLtModalOpen] = useState(false);
    const [ltEditing, setLtEditing] = useState<LeaveTypeItem | null>(null);
    const [ltForm, setLtForm] = useState({ name: '', isPaid: true });
    const [savingLt, setSavingLt] = useState(false);
    const openEditLeaveType = (lt: LeaveTypeItem) => { setLtEditing(lt); setLtForm({ name: lt.name, isPaid: lt.isPaid }); setLtModalOpen(true); };
    const submitLeaveType = async () => {
        if (!ltEditing || !ltForm.name) { toast.error('Enter a name.'); return; }
        setSavingLt(true);
        try {
            await attendanceSettingsService.updateLeaveType(ltEditing.id, ltForm);
            toast.success('Leave type saved.');
            setLtModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-snapshot'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save the leave type.');
        } finally {
            setSavingLt(false);
        }
    };

    const [holModalOpen, setHolModalOpen] = useState(false);
    const [holEditing, setHolEditing] = useState<HolidayItem | null>(null);
    const [holForm, setHolForm] = useState({ name: '', startDate: '', endDate: '' });
    const [savingHol, setSavingHol] = useState(false);
    const openAddHoliday = () => { setHolEditing(null); setHolForm({ name: '', startDate: '', endDate: '' }); setHolModalOpen(true); };
    const openEditHoliday = (h: HolidayItem) => { setHolEditing(h); setHolForm({ name: h.name, startDate: h.startDate.slice(0, 10), endDate: h.endDate.slice(0, 10) }); setHolModalOpen(true); };
    const submitHoliday = async () => {
        if (!holForm.name || !holForm.startDate || !holForm.endDate) { toast.error('Enter a name and both dates.'); return; }
        setSavingHol(true);
        try {
            if (holEditing) await attendanceSettingsService.updateHoliday(holEditing.id, holForm);
            else await attendanceSettingsService.createHoliday(holForm);
            toast.success('Holiday saved.');
            setHolModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-holidays'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save the holiday.');
        } finally {
            setSavingHol(false);
        }
    };
    const deleteHoliday = async (h: HolidayItem) => {
        if (!window.confirm(`Remove the "${h.name}" holiday? This cannot be undone.`)) return;
        try {
            await attendanceSettingsService.deleteHoliday(h.id);
            toast.success('Holiday removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-holidays'] });
        } catch (err: any) { toast.error(err?.response?.data?.error || 'Failed to remove the holiday.'); }
    };

    const emptyMultiplierForm = { name: '', factorValue: '', type: '', dateStart: '', dateEnd: '', workStart: '', gracePeriod: '', workEnd: '', otThreshold: '' };
    const [mfModalOpen, setMfModalOpen] = useState(false);
    const [mfEditing, setMfEditing] = useState<MultiplierFactorItem | null>(null);
    const [mfForm, setMfForm] = useState(emptyMultiplierForm);
    const [savingMf, setSavingMf] = useState(false);
    const openAddMultiplier = () => { setMfEditing(null); setMfForm(emptyMultiplierForm); setMfModalOpen(true); };
    const openEditMultiplier = (m: MultiplierFactorItem) => {
        setMfEditing(m);
        setMfForm({
            name: m.name, factorValue: String(m.factorValue), type: m.type,
            dateStart: m.dateStart.slice(0, 10), dateEnd: m.dateEnd.slice(0, 10),
            workStart: m.workStart || '', gracePeriod: m.gracePeriod || '', workEnd: m.workEnd || '', otThreshold: m.otThreshold || '',
        });
        setMfModalOpen(true);
    };
    const submitMultiplier = async () => {
        if (!mfForm.name || !mfForm.factorValue || !mfForm.type || !mfForm.dateStart || !mfForm.dateEnd) {
            toast.error('Enter a name, factor value, type, and both dates.'); return;
        }
        setSavingMf(true);
        try {
            const input = {
                ...mfForm,
                workStart: mfForm.workStart || null,
                gracePeriod: mfForm.gracePeriod || null,
                workEnd: mfForm.workEnd || null,
                otThreshold: mfForm.otThreshold || null,
            };
            if (mfEditing) await attendanceSettingsService.updateMultiplierFactor(mfEditing.id, input);
            else await attendanceSettingsService.createMultiplierFactor(input);
            toast.success('Multiplier factor saved.');
            setMfModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-multipliers'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save the multiplier factor.');
        } finally {
            setSavingMf(false);
        }
    };
    const deleteMultiplier = async (m: MultiplierFactorItem) => {
        if (!window.confirm(`Remove the "${m.name}" multiplier factor? This cannot be undone.`)) return;
        try {
            await attendanceSettingsService.deleteMultiplierFactor(m.id);
            toast.success('Multiplier factor removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-multipliers'] });
        } catch (err: any) { toast.error(err?.response?.data?.error || 'Failed to remove the multiplier factor.'); }
    };

    // Employee Shifts — per-employee date-range shift override (also written automatically when a
    // "Change of Schedule" Work Authorization request completes). empCode is only editable on
    // create, matching the attendance system's own PUT contract.
    const emptyShiftForm = { empCode: '', startDate: '', endDate: '', workStart: '', workEnd: '', gracePeriod: '', otThreshold: '', reason: '' };
    const [esModalOpen, setEsModalOpen] = useState(false);
    const [esEditing, setEsEditing] = useState<EmployeeShiftItem | null>(null);
    const [esForm, setEsForm] = useState(emptyShiftForm);
    const [savingEs, setSavingEs] = useState(false);
    const openAddShift = () => { setEsEditing(null); setEsForm(emptyShiftForm); setEsModalOpen(true); };
    const openEditShift = (s: EmployeeShiftItem) => {
        setEsEditing(s);
        setEsForm({
            empCode: s.empCode, startDate: s.startDate.slice(0, 10), endDate: s.endDate.slice(0, 10),
            workStart: s.workStart || '', workEnd: s.workEnd || '',
            gracePeriod: s.gracePeriod || '', otThreshold: s.otThreshold || '', reason: s.reason || '',
        });
        setEsModalOpen(true);
    };
    const submitShift = async () => {
        if (!esForm.empCode || !esForm.startDate || !esForm.endDate || !esForm.workStart || !esForm.workEnd) {
            toast.error('Select an employee, both dates, and both work-hour times.'); return;
        }
        setSavingEs(true);
        try {
            const input = {
                ...esForm,
                gracePeriod: esForm.gracePeriod || null,
                otThreshold: esForm.otThreshold || null,
                reason: esForm.reason || null,
            };
            if (esEditing) await attendanceSettingsService.updateEmployeeShift(esEditing.id, input);
            else await attendanceSettingsService.createEmployeeShift(input);
            toast.success('Employee shift saved.');
            setEsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-employee-shifts'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save the employee shift.');
        } finally {
            setSavingEs(false);
        }
    };
    const deleteShift = async (s: EmployeeShiftItem) => {
        if (!window.confirm(`Remove the shift override for "${s.empName}"? This cannot be undone.`)) return;
        try {
            await attendanceSettingsService.deleteEmployeeShift(s.id);
            toast.success('Employee shift removed.');
            queryClient.invalidateQueries({ queryKey: ['attendance-settings-employee-shifts'] });
        } catch (err: any) { toast.error(err?.response?.data?.error || 'Failed to remove the employee shift.'); }
    };

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight">
                        Attendance & Leave Requests
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Live punch, lateness, and leave data from the attendance system, matched to employee records by Staff ID.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-[#511d29]/10">
                {[
                    { key: 'overview' as Tab, label: 'Overview', Icon: Clock },
                    { key: 'exceptions' as Tab, label: 'Exceptions', Icon: AlertTriangle },
                    { key: 'daily-logging' as Tab, label: 'Daily Logging', Icon: PlusCircle },
                    { key: 'employees' as Tab, label: 'Employees', Icon: Users },
                    ...(isSuperAdmin ? [{ key: 'settings' as Tab, label: 'Settings', Icon: SettingsIcon }] : []),
                ].map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => navigate(`/attendance/${key}`)}
                        className={`px-4 py-3 text-xs font-black uppercase tracking-widest inline-flex items-center gap-2 border-b-2 transition-colors ${tab === key ? 'border-[#511d29] text-[#511d29]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="space-y-8">
                    {/* Dashboard KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={Users} label="Total Employees" value={dashboard?.totalEmployees ?? '—'} color="bg-indigo-50 text-indigo-600" />
                        <StatCard icon={CalendarCheck} label="On Leave Today" value={dashboard?.onLeaveToday ?? '—'} color="bg-amber-50 text-amber-600" />
                        <StatCard icon={Fingerprint} label="Punches Today" value={dashboard?.punchesToday ?? '—'} color="bg-emerald-50 text-emerald-600" />
                        <StatCard icon={Timer} label="Overtimes Today" value={dashboard?.overtimesToday ?? '—'} color="bg-blue-50 text-blue-600" />
                    </div>
                    {dashboard?.error && (
                        <p className="text-xs font-bold text-rose-600">Dashboard note from the attendance system: {dashboard.error}</p>
                    )}

                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 px-4 py-2.5 rounded-lg flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-[#511d29] shrink-0" />
                        <p className="text-xs text-slate-600">
                            <span className="font-black text-[#511d29] uppercase tracking-wide">Presence &amp; Attendance —</span> late minutes and leave days here feed the monthly evaluation score, Disciplinary Action, Salary Deductions, and Contract Renewals.
                        </p>
                    </div>

                    {/* Insights — charts over data the table below already carries, so the roster's
                        leave mix and punctuality split are readable at a glance instead of only as
                        per-row numbers. */}
                    <AttendanceInsights rows={attendanceRows} />

                    {/* Attendance summary */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Attendance Summary</span>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="date"
                                    value={attendanceStart}
                                    onChange={e => setAttendanceStart(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold"
                                />
                                <span className="text-xs font-bold text-slate-400">to</span>
                                <input
                                    type="date"
                                    value={attendanceEnd}
                                    onChange={e => setAttendanceEnd(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold"
                                />
                                {(attendanceStart !== todayStr() || attendanceEnd !== todayStr()) && (
                                    <button
                                        onClick={() => { setAttendanceStart(todayStr()); setAttendanceEnd(todayStr()); }}
                                        className="text-[10px] font-black text-[#511d29] uppercase tracking-wider underline"
                                    >
                                        Today
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Additional filters */}
                        <div className="p-4 border-b border-[#511d29]/10 flex flex-wrap items-center gap-3 bg-white">
                            <div className="relative flex items-center">
                                <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search name or staff code..."
                                    value={summarySearch}
                                    onChange={e => setSummarySearch(e.target.value)}
                                    className="pl-10 pr-3 py-2.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold w-56"
                                />
                            </div>
                            <div className="relative flex items-center">
                                <Filter className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                <select
                                    value={summaryFilter}
                                    onChange={e => setSummaryFilter(e.target.value as SummaryFilter)}
                                    className="pl-10 pr-8 py-2.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold appearance-none cursor-pointer"
                                >
                                    <option value="all">All Employees</option>
                                    <option value="late">Late Only</option>
                                    <option value="earlyOut">Early-Out Only</option>
                                    <option value="onLeave">On Leave</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="unmatched">Unmatched to IPH Record</option>
                                </select>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-auto">
                                {attendanceRows.length} / {allAttendanceRows.length} shown
                            </span>
                        </div>

                        {isAttendanceError && (
                            <div className="p-10 text-center">
                                <p className="text-sm font-bold text-rose-600">Could not reach the attendance system.</p>
                                <p className="text-xs text-slate-400 mt-1">Make sure it's running and reachable at the configured address, then reload this page.</p>
                            </div>
                        )}

                        {!isAttendanceError && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                            <th className="p-4">Employee</th>
                                            <th className="p-4">Worked</th>
                                            <th className="p-4">Punctuality</th>
                                            <th className="p-4">Overtime</th>
                                            <th className="p-4">Leave / Other</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                        {attendanceRows.map(row => (
                                            <tr key={row.empId} className="hover:bg-slate-50/50">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-800">{row.matchedFullName || row.empName}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono">{row.empCode} · {row.positionName}</p>
                                                </td>
                                                <td className="p-4 font-bold">{formatMinutesAsHM(row.totalWorkMins)}</td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className={row.totalLateMins > 0 ? 'font-black text-red-600' : 'text-slate-400'}>
                                                            Late: {formatMinutesAsHM(row.totalLateMins)}
                                                            {row.totalExcusedMins > 0 && <span className="text-emerald-600 font-bold"> (-{formatMinutesAsHM(row.totalExcusedMins)} excused)</span>}
                                                        </span>
                                                        <span className={row.totalEarlyOutMins > 0 ? 'font-black text-amber-600' : 'text-slate-400'}>
                                                            Early: {formatMinutesAsHM(row.totalEarlyOutMins)}
                                                            {row.totalExcusedEarlyOutMins > 0 && <span className="text-emerald-600 font-bold"> (-{formatMinutesAsHM(row.totalExcusedEarlyOutMins)} excused)</span>}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-blue-600">Approved: {formatMinutesAsHM(row.totalApprovedOTMins)}</span>
                                                        {row.totalOTMins !== row.totalApprovedOTMins && (
                                                            <span className="text-slate-400" title="Logged but not (yet) approved">Logged: {formatMinutesAsHM(row.totalOTMins)}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold space-x-1">
                                                        <span className={row.paidLeaveDays > 0 ? 'text-emerald-600' : 'text-slate-400'}>P: {row.paidLeaveDays}</span>
                                                        <span className="text-slate-300">·</span>
                                                        <span className={row.unpaidLeaveDays > 0 ? 'text-amber-600' : 'text-slate-400'}>U: {row.unpaidLeaveDays}</span>
                                                        <span className="text-slate-300">·</span>
                                                        <span className={row.emergencyLeaveDays > 0 ? 'text-rose-600' : 'text-slate-400'}>E: {row.emergencyLeaveDays}</span>
                                                    </p>
                                                    {(row.holidayDays > 0 || row.outWorkDays > 0) && (
                                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                                            {row.holidayDays > 0 && <>Holiday: {row.holidayDays}d </>}
                                                            {row.outWorkDays > 0 && <>Out-Work: {row.outWorkDays}d</>}
                                                        </p>
                                                    )}
                                                    {(row.suspensionDays > 0 || row.absenceDays > 0) && (
                                                        <p className="text-[10px] mt-0.5">
                                                            {row.suspensionDays > 0 && <span className="text-purple-600 font-bold">Suspended: {row.suspensionDays}d </span>}
                                                            {row.absenceDays > 0 && <span className="text-red-600 font-bold">Absent: {row.absenceDays}d</span>}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => openDetail(row)}
                                                        className="px-3 py-1.5 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#3a151d] transition-colors inline-flex items-center gap-1.5"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" /> Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoadingAttendance && attendanceRows.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-10 text-center text-slate-400 font-bold">No attendance data for this range.</td>
                                            </tr>
                                        )}
                                        {isLoadingAttendance && (
                                            <tr>
                                                <td colSpan={6} className="p-10 text-center text-slate-400 font-bold animate-pulse">Loading attendance data…</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Approved Leaves — fully-approved requests from the org approval chain, already
                        pushed to the attendance system. Submission/approval still live in Staff Hub /
                        Manager Approvals; this is the read-only record. */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-[#511d29]/10 bg-[#511d29]/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide flex items-center gap-2">
                                    <CalendarCheck className="w-4 h-4" /> Approved Leaves
                                </h4>
                                <p className="text-xs text-slate-500 mt-1">Fully-approved leave requests — automatically recorded in the attendance system.</p>
                            </div>
                            <a href="/approved-leaves" className="shrink-0 px-4 py-2.5 bg-[#511d29] text-white text-xs font-black uppercase tracking-widest hover:bg-[#3a151d] transition-colors rounded-lg">
                                View All
                            </a>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {approvedLeaves.slice(0, 6).map((l: any) => {
                                const start = String(l.startDate).split('T')[0];
                                const end = l.endDate ? String(l.endDate).split('T')[0] : start;
                                // Same palette as ApprovedLeaves.tsx's TYPE_META, for a consistent
                                // paid=emerald / unpaid=amber / emergency=rose meaning app-wide.
                                const typeMeta = ({
                                    PAID_HOLIDAY: { label: 'Paid Leave', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                    EMERGENCY_LEAVE: { label: 'Emergency Leave', className: 'bg-rose-50 text-rose-700 border-rose-200' },
                                    UNPAID_LEAVE: { label: 'Unpaid Leave', className: 'bg-amber-50 text-amber-700 border-amber-200' },
                                } as Record<string, { label: string; className: string }>)[l.type]
                                    || { label: String(l.type).replace(/_/g, ' '), className: 'bg-slate-50 text-slate-700 border-slate-200' };
                                return (
                                    <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-[#511d29]/[0.02] transition-colors">
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm truncate">{l.employee?.fullName || '—'}</p>
                                            <p className="text-xs text-slate-400 font-mono">{l.employee?.staffId || ''}</p>
                                        </div>
                                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${typeMeta.className}`}>{typeMeta.label}</span>
                                        <span className="shrink-0 text-xs font-bold text-slate-500 hidden sm:inline">{start}{end !== start ? ` → ${end}` : ''}</span>
                                    </div>
                                );
                            })}
                            {approvedLeaves.length === 0 && (
                                <div className="px-5 py-8 text-center text-xs font-bold text-slate-400">No approved leaves yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'exceptions' && (
                <div className="space-y-6">
                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">Exceptions</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Punches that were hand-corrected rather than coming straight off a device, and logging a punch an employee forgot to make.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Manual Transactions</span>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Search name or code..."
                                    value={excSearch}
                                    onChange={e => setExcSearch(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold w-44"
                                />
                                <input
                                    type="date"
                                    value={excStart}
                                    onChange={e => setExcStart(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold"
                                />
                                <span className="text-xs font-bold text-slate-400">to</span>
                                <input
                                    type="date"
                                    value={excEnd}
                                    onChange={e => setExcEnd(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold"
                                />
                                <button
                                    onClick={() => setMissingPunchOpen(true)}
                                    className="px-4 py-2 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2"
                                >
                                    <PlusCircle className="w-3.5 h-3.5" /> Log Missing Punch
                                </button>
                            </div>
                        </div>

                        {isManualTxError && (
                            <div className="p-10 text-center">
                                <p className="text-sm font-bold text-rose-600">Could not reach the attendance system.</p>
                            </div>
                        )}

                        {!isManualTxError && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                            <th className="p-4">Employee</th>
                                            <th className="p-4">Staff Code</th>
                                            <th className="p-4">Department</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Time</th>
                                            <th className="p-4">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                        {manualTxRows.map(row => (
                                            <tr key={row.id} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-bold">{row.first_name}</td>
                                                <td className="p-4 font-mono">{row.emp_code}</td>
                                                <td className="p-4 text-slate-500">{row.dept_name}</td>
                                                <td className="p-4">{row.att_date}</td>
                                                <td className="p-4 font-mono">{row.punch_time}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${row.punch_state === 'Check In' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {row.punch_state}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoadingManualTx && manualTxRows.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-10 text-center text-slate-400 font-bold">No manual transactions for this range.</td>
                                            </tr>
                                        )}
                                        {isLoadingManualTx && (
                                            <tr>
                                                <td colSpan={6} className="p-10 text-center text-slate-400 font-bold animate-pulse">Loading…</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'daily-logging' && (
                <div className="space-y-6">
                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <PlusCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">Daily Logging</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Log leave, overtime, out-work, and excused-late allowances directly into the attendance system.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setLeaveOpen(true)} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                            <PlusCircle className="w-3.5 h-3.5" /> Log Leave
                        </button>
                        <button onClick={() => setOtOpen(true)} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                            <PlusCircle className="w-3.5 h-3.5" /> Log Overtime
                        </button>
                        <button onClick={() => setOwOpen(true)} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                            <PlusCircle className="w-3.5 h-3.5" /> Log Out-Work
                        </button>
                        <button onClick={() => setXlOpen(true)} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                            <PlusCircle className="w-3.5 h-3.5" /> Log Excused Late
                        </button>
                        <button onClick={() => setEoOpen(true)} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                            <PlusCircle className="w-3.5 h-3.5" /> Log Excused Early-Out
                        </button>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium -mt-3">Overtime has no review list yet — the attendance system doesn't expose one (create-only).</p>

                    {/* Leave records */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Leave Records</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Period</th>
                                        <th className="p-4">Days</th>
                                        <th className="p-4">Approved By</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {employeeLeaves.map(row => (
                                        <tr key={row.id} className="hover:bg-slate-50/50">
                                            <td className="p-4"><p className="font-bold text-slate-800">{row.empName}</p><p className="text-[10px] text-slate-500 font-mono">{row.empCode}</p></td>
                                            <td className="p-4">{row.leaveTypeName}</td>
                                            <td className="p-4">{format(parseISO(row.startDate), 'dd MMM')} – {format(parseISO(row.endDate), 'dd MMM yyyy')}</td>
                                            <td className="p-4 font-bold">{row.daysCount}</td>
                                            <td className="p-4 text-slate-500">{row.approvedBy}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => deleteEmployeeLeave(row.id)} className="text-[10px] font-black text-rose-600 uppercase tracking-wider hover:underline">Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!isLoadingLeaves && employeeLeaves.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">No leave records.</td></tr>
                                    )}
                                    {isLoadingLeaves && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Out-work records */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Out-Work Records</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Period</th>
                                        <th className="p-4">Days</th>
                                        <th className="p-4">Reason</th>
                                        <th className="p-4">Approved By</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {outWorksList.map(row => (
                                        <tr key={row.id} className="hover:bg-slate-50/50">
                                            <td className="p-4"><p className="font-bold text-slate-800">{row.empName}</p><p className="text-[10px] text-slate-500 font-mono">{row.empCode}</p></td>
                                            <td className="p-4">{format(parseISO(row.startDate), 'dd MMM')} – {format(parseISO(row.endDate), 'dd MMM yyyy')}</td>
                                            <td className="p-4 font-bold">{row.daysCount}</td>
                                            <td className="p-4 text-slate-500">{row.reason}</td>
                                            <td className="p-4 text-slate-500">{row.approvedBy}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => deleteOutWorkRow(row.id)} className="text-[10px] font-black text-rose-600 uppercase tracking-wider hover:underline">Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!isLoadingOutWorks && outWorksList.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">No out-work records.</td></tr>
                                    )}
                                    {isLoadingOutWorks && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Excused-late records */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Excused-Late Records</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Excused Mins</th>
                                        <th className="p-4">Reason</th>
                                        <th className="p-4">Approved By</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {excusedLatesList.map(row => (
                                        <tr key={row.id} className="hover:bg-slate-50/50">
                                            <td className="p-4"><p className="font-bold text-slate-800">{row.empName}</p><p className="text-[10px] text-slate-500 font-mono">{row.empCode}</p></td>
                                            <td className="p-4">{format(parseISO(row.date), 'dd MMM yyyy')}</td>
                                            <td className="p-4 font-bold">{row.excusedMinutes}</td>
                                            <td className="p-4 text-slate-500">{row.reason}</td>
                                            <td className="p-4 text-slate-500">{row.approvedBy}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => deleteExcusedLateRow(row.id)} className="text-[10px] font-black text-rose-600 uppercase tracking-wider hover:underline">Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!isLoadingExcusedLates && excusedLatesList.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">No excused-late records.</td></tr>
                                    )}
                                    {isLoadingExcusedLates && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Excused early-out records */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Excused Early-Out Records</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Excused Mins</th>
                                        <th className="p-4">Reason</th>
                                        <th className="p-4">Approved By</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {excusedEarlyOutsList.map(row => (
                                        <tr key={row.id} className="hover:bg-slate-50/50">
                                            <td className="p-4"><p className="font-bold text-slate-800">{row.empName}</p><p className="text-[10px] text-slate-500 font-mono">{row.empCode}</p></td>
                                            <td className="p-4">{format(parseISO(row.date), 'dd MMM yyyy')}</td>
                                            <td className="p-4 font-bold">{row.excusedMinutes}</td>
                                            <td className="p-4 text-slate-500">{row.reason}</td>
                                            <td className="p-4 text-slate-500">{row.approvedBy}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => deleteExcusedEarlyOutRow(row.id)} className="text-[10px] font-black text-rose-600 uppercase tracking-wider hover:underline">Remove</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!isLoadingExcusedEarlyOuts && excusedEarlyOutsList.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">No excused early-out records.</td></tr>
                                    )}
                                    {isLoadingExcusedEarlyOuts && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'employees' && (
                <div className="space-y-6">
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">BioTime Employee Roster</span>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex items-center">
                                    <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search name or code..."
                                        value={empSearch}
                                        onChange={e => setEmpSearch(e.target.value)}
                                        className="pl-10 pr-3 py-2.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold w-56"
                                    />
                                </div>
                                <button onClick={openAddEmployee} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                                    <PlusCircle className="w-3.5 h-3.5" /> Add Employee
                                </button>
                            </div>
                        </div>
                        <p className="px-4 py-2 text-[11px] text-slate-400 font-medium">
                            This manages the employee record inside the attendance system itself (code, name, position) — not our HR employee record.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Code</th>
                                        <th className="p-4">Name</th>
                                        <th className="p-4">Position</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {bioTimeEmployees.map(emp => (
                                        <tr key={emp.id} className="hover:bg-slate-50/50">
                                            <td className="p-4 font-mono text-[10px] text-slate-500">{emp.emp_code}</td>
                                            <td className="p-4 font-bold text-slate-800">{emp.first_name}</td>
                                            <td className="p-4">{emp.position?.position_name || '—'}</td>
                                            <td className="p-4 text-right">
                                                <div className="inline-flex items-center gap-3">
                                                    <button onClick={() => openEditEmployee(emp)} className="text-slate-400 hover:text-[#511d29]" title="Edit">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => deleteBioTimeEmployeeRow(emp)} className="text-slate-400 hover:text-rose-600" title="Remove">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!isLoadingBioTimeEmployees && bioTimeEmployees.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">No employees found.</td></tr>
                                    )}
                                    {isLoadingBioTimeEmployees && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'settings' && (
                !isSuperAdmin ? (
                    <div className="p-10 text-center text-slate-400 font-bold">You don't have permission to view this section.</div>
                ) : (
                <div className="space-y-6">
                    <div className="flex items-center gap-2 flex-wrap">
                        {([['hours', 'Work Hours', Clock], ['leave-types', 'Leave Types', ShieldCheck], ['holidays', 'Holidays', CalendarDays], ['multipliers', 'Multiplier Factors', Percent], ['shifts', 'Employee Shifts', CalendarClock]] as const).map(([key, label, Icon]) => (
                            <button
                                key={key}
                                onClick={() => setSettingsSubTab(key)}
                                className={`px-4 py-2.5 text-[11px] font-black uppercase tracking-widest inline-flex items-center gap-2 rounded-lg transition-colors ${settingsSubTab === key ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-slate-500 hover:text-[#511d29]'}`}
                            >
                                <Icon className="w-3.5 h-3.5" /> {label}
                            </button>
                        ))}
                    </div>

                    {settingsSubTab === 'hours' && (
                        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50">
                                <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Work-Hour Settings</span>
                            </div>
                            <p className="px-4 py-2 text-[11px] text-slate-400 font-medium">Values can be edited here, but entries can't be added or removed — this is fixed config the attendance system's own calculations reference by key.</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                            <th className="p-4">Key</th>
                                            <th className="p-4">Value</th>
                                            <th className="p-4">Description</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                        {systemSettingsList.map(s => (
                                            <tr key={s.id} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-bold text-slate-800">{s.key}</td>
                                                <td className="p-4 font-mono">{s.value}</td>
                                                <td className="p-4 text-slate-500">{s.description}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => openEditSetting(s)} className="text-slate-400 hover:text-[#511d29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoadingSnapshot && systemSettingsList.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">No settings found.</td></tr>
                                        )}
                                        {isLoadingSnapshot && (
                                            <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {settingsSubTab === 'leave-types' && (
                        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50">
                                <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Leave Types</span>
                            </div>
                            <p className="px-4 py-2 text-[11px] text-slate-400 font-medium">Values can be edited here, but entries can't be added or removed.</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                            <th className="p-4">Name</th>
                                            <th className="p-4">Paid</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                        {leaveTypesList.map(lt => (
                                            <tr key={lt.id} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-bold text-slate-800">{lt.name}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${lt.isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{lt.isPaid ? 'Paid' : 'Unpaid'}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => openEditLeaveType(lt)} className="text-slate-400 hover:text-[#511d29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoadingSnapshot && leaveTypesList.length === 0 && (
                                            <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold">No leave types found.</td></tr>
                                        )}
                                        {isLoadingSnapshot && (
                                            <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {settingsSubTab === 'holidays' && (
                        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex items-center justify-between">
                                <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Holidays</span>
                                <button onClick={openAddHoliday} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                                    <PlusCircle className="w-3.5 h-3.5" /> Add Holiday
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                            <th className="p-4">Name</th>
                                            <th className="p-4">Period</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                        {holidaysList.map(h => (
                                            <tr key={h.id} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-bold text-slate-800">{h.name}</td>
                                                <td className="p-4">{format(parseISO(h.startDate), 'dd MMM')} – {format(parseISO(h.endDate), 'dd MMM yyyy')}</td>
                                                <td className="p-4 text-right">
                                                    <div className="inline-flex items-center gap-3">
                                                        <button onClick={() => openEditHoliday(h)} className="text-slate-400 hover:text-[#511d29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => deleteHoliday(h)} className="text-slate-400 hover:text-rose-600" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoadingHolidays && holidaysList.length === 0 && (
                                            <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold">No holidays found.</td></tr>
                                        )}
                                        {isLoadingHolidays && (
                                            <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {settingsSubTab === 'multipliers' && (
                        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex items-center justify-between">
                                <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Multiplier Factors</span>
                                <button onClick={openAddMultiplier} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                                    <PlusCircle className="w-3.5 h-3.5" /> Add Multiplier Factor
                                </button>
                            </div>
                            <p className="px-4 py-2 text-[11px] text-slate-400 font-medium">
                                Date-ranged overrides of the standard work-hour settings above (e.g. Ramadan hours). "Type" is a single-character code defined by the attendance system.
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                            <th className="p-4">Name</th>
                                            <th className="p-4">Factor</th>
                                            <th className="p-4">Type</th>
                                            <th className="p-4">Period</th>
                                            <th className="p-4">Work Hours</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                        {multipliersList.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-bold text-slate-800">{m.name}</td>
                                                <td className="p-4 font-mono">{m.factorValue}</td>
                                                <td className="p-4 font-mono">{m.type}</td>
                                                <td className="p-4">{format(parseISO(m.dateStart), 'dd MMM')} – {format(parseISO(m.dateEnd), 'dd MMM yyyy')}</td>
                                                <td className="p-4 font-mono text-[11px]">{m.workStart || '—'} – {m.workEnd || '—'}</td>
                                                <td className="p-4 text-right">
                                                    <div className="inline-flex items-center gap-3">
                                                        <button onClick={() => openEditMultiplier(m)} className="text-slate-400 hover:text-[#511d29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => deleteMultiplier(m)} className="text-slate-400 hover:text-rose-600" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoadingMultipliers && multipliersList.length === 0 && (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">No multiplier factors found.</td></tr>
                                        )}
                                        {isLoadingMultipliers && (
                                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {settingsSubTab === 'shifts' && (
                        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex items-center justify-between">
                                <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Employee Shifts</span>
                                <button onClick={openAddShift} className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2">
                                    <PlusCircle className="w-3.5 h-3.5" /> Add Employee Shift
                                </button>
                            </div>
                            <p className="px-4 py-2 text-[11px] text-slate-400 font-medium">
                                Per-employee date-range shift override — takes priority over Multiplier Factors and the standard Work Hours above for that employee on those days. Also created automatically when a "Change of Schedule" Work Authorization request is fully approved.
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                            <th className="p-4">Employee</th>
                                            <th className="p-4">Period</th>
                                            <th className="p-4">Work Hours</th>
                                            <th className="p-4">Reason</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                        {employeeShiftsList.map(s => (
                                            <tr key={s.id} className="hover:bg-slate-50/50">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-800">{s.empName}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{s.empCode}</p>
                                                </td>
                                                <td className="p-4">{format(parseISO(s.startDate), 'dd MMM')} – {format(parseISO(s.endDate), 'dd MMM yyyy')}</td>
                                                <td className="p-4 font-mono text-[11px]">{s.workStart} – {s.workEnd}</td>
                                                <td className="p-4 text-slate-500">{s.reason || '—'}</td>
                                                <td className="p-4 text-right">
                                                    <div className="inline-flex items-center gap-3">
                                                        <button onClick={() => openEditShift(s)} className="text-slate-400 hover:text-[#511d29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => deleteShift(s)} className="text-slate-400 hover:text-rose-600" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoadingEmployeeShifts && employeeShiftsList.length === 0 && (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">No employee shifts found.</td></tr>
                                        )}
                                        {isLoadingEmployeeShifts && (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading…</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
                )
            )}

            {/* Per-employee detail — daily first/last punch, late/early-out/OT, leave, holiday, excused-late */}
            <Modal
                isOpen={!!detailRow}
                onClose={() => { setDetailRow(null); setDetailFilter('all'); }}
                title={detailRow ? `${detailRow.matchedFullName || detailRow.empName} · ${detailRow.empCode}` : ''}
                fullScreen
                fullScreenWidth="max-w-6xl"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 -mt-2 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="date"
                            value={detailStart}
                            onChange={e => setDetailStart(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                        <span className="text-xs font-bold text-slate-400">to</span>
                        <input
                            type="date"
                            value={detailEnd}
                            onChange={e => setDetailEnd(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                        {(detailStart !== attendanceStart || detailEnd !== attendanceEnd) && (
                            <button
                                onClick={() => { setDetailStart(attendanceStart); setDetailEnd(attendanceEnd); }}
                                className="text-[10px] font-black text-[#511d29] uppercase tracking-wider underline"
                            >
                                Match Overview Range
                            </button>
                        )}
                        {(getSettingValue('WorkStart') || getSettingValue('WorkEnd')) && (
                            <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-500">
                                Scheduled Shift: {getSettingValue('WorkStart')?.slice(0, 5) || '—'} – {getSettingValue('WorkEnd')?.slice(0, 5) || '—'}
                            </span>
                        )}
                    </div>
                    <div className="relative flex items-center">
                        <Filter className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                            value={detailFilter}
                            onChange={e => setDetailFilter(e.target.value as DetailFilter)}
                            className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold appearance-none cursor-pointer"
                        >
                            <option value="all">All Days</option>
                            <option value="late">Late Only</option>
                            <option value="earlyOut">Early-Out Only</option>
                            <option value="holiday">Holidays</option>
                            <option value="outWork">Out-Work</option>
                            <option value="excused">Excused (Late/Early-Out)</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>
                </div>

                {isLoadingDetail && <p className="text-center text-slate-400 font-bold animate-pulse py-10">Loading daily breakdown…</p>}
                {monthlyReport && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            <StatCard icon={CalendarCheck} label="Worked" value={monthlyReport.grandTotalWork} color="bg-emerald-50 text-emerald-600" />
                            <StatCard
                                icon={AlertTriangle}
                                label="Absent Days"
                                value={filledDetailReportData.filter(d => resolveDayStatus(d, monthlyReport.empLeaves, format(new Date(), 'yyyy-MM-dd')).kind === 'absent').length}
                                color="bg-red-50 text-red-600"
                            />
                            <StatCard
                                icon={ShieldOff}
                                label="Suspended Days"
                                value={filledDetailReportData.filter(d => resolveDayStatus(d, monthlyReport.empLeaves, format(new Date(), 'yyyy-MM-dd')).kind === 'suspended').length}
                                color="bg-purple-50 text-purple-600"
                            />
                            <StatCard
                                icon={CalendarCheck}
                                label="Leave Days"
                                value={
                                    <span>
                                        <span className={monthlyReport.paidLeaveDays > 0 ? 'text-emerald-600' : 'text-slate-300'}>{monthlyReport.paidLeaveDays}</span>
                                        <span className="text-slate-300 mx-0.5">/</span>
                                        <span className={monthlyReport.unpaidLeaveDays > 0 ? 'text-amber-600' : 'text-slate-300'}>{monthlyReport.unpaidLeaveDays}</span>
                                        <span className="text-slate-300 mx-0.5">/</span>
                                        <span className={monthlyReport.emergencyLeaveDays > 0 ? 'text-rose-600' : 'text-slate-300'}>{monthlyReport.emergencyLeaveDays}</span>
                                    </span>
                                }
                                color="bg-slate-50 text-slate-500"
                            />
                            <StatCard icon={CalendarCheck} label="Out-Work Days" value={monthlyReport.outWorkDays} color="bg-indigo-50 text-indigo-600" />
                            <StatCard icon={Timer} label="Overtime (Approved)" value={monthlyReport.formattedApprovedOT} color="bg-blue-50 text-blue-600" />
                            <StatCard icon={Timer} label="Overtime (Worked)" value={monthlyReport.totalOT} color="bg-blue-50 text-blue-600" />
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium -mt-4">
                            "Worked" is calculated from actual punch times (first check-in to last check-out) — it is not shifted to the scheduled start, so a late arrival still shortens this total even when the lateness itself is later excused below.
                        </p>

                        {/* Punctuality Breakdown — makes the late/early-out → excused → chargeable
                            → deduction chain explicit, instead of showing 4 disconnected numbers. */}
                        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Punctuality Breakdown</span>
                                {monthlyReport.totalDeduction > 0 && (
                                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                                        Deduction: {monthlyReport.totalDeduction} pts
                                    </span>
                                )}
                            </div>
                            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                                {(() => {
                                    const lateRecorded = monthlyReport.totalLate + monthlyReport.totalExcusedMins;
                                    const latePct = lateRecorded > 0 ? (monthlyReport.totalLate / lateRecorded) * 100 : 0;
                                    return (
                                        <div className="p-4 space-y-2">
                                            <p className="text-xs font-black text-slate-600 uppercase tracking-wide">Late Arrival</p>
                                            {lateRecorded > 0 && (
                                                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                                                    <div style={{ width: `${latePct}%` }} className="bg-red-500" />
                                                    <div style={{ width: `${100 - latePct}%` }} className="bg-emerald-500" />
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-400">Recorded late</span>
                                                <span className="font-bold text-slate-700">{formatMinutesAsHM(lateRecorded)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-400">− Excused</span>
                                                <span className="font-bold text-emerald-600">{formatMinutesAsHM(monthlyReport.totalExcusedMins)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                                <span className="font-black text-slate-600">= Chargeable</span>
                                                <span className={`font-black ${monthlyReport.totalLate > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatMinutesAsHM(monthlyReport.totalLate)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                                {(() => {
                                    const earlyRecorded = monthlyReport.totalEarly + monthlyReport.totalExcusedEarlyOutMins;
                                    const earlyPct = earlyRecorded > 0 ? (monthlyReport.totalEarly / earlyRecorded) * 100 : 0;
                                    return (
                                        <div className="p-4 space-y-2">
                                            <p className="text-xs font-black text-slate-600 uppercase tracking-wide">Early Departure</p>
                                            {earlyRecorded > 0 && (
                                                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                                                    <div style={{ width: `${earlyPct}%` }} className="bg-amber-500" />
                                                    <div style={{ width: `${100 - earlyPct}%` }} className="bg-emerald-500" />
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-400">Recorded early-out</span>
                                                <span className="font-bold text-slate-700">{formatMinutesAsHM(earlyRecorded)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-400">− Excused</span>
                                                <span className="font-bold text-emerald-600">{formatMinutesAsHM(monthlyReport.totalExcusedEarlyOutMins)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                                <span className="font-black text-slate-600">= Chargeable</span>
                                                <span className={`font-black ${monthlyReport.totalEarly > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{formatMinutesAsHM(monthlyReport.totalEarly)}</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            <p className="px-4 pb-3 text-[10px] text-slate-400 font-medium">
                                "Recorded" is derived (chargeable + excused) to show how much was logged before any excused allowance was applied — the attendance system doesn't return that raw figure directly.
                            </p>
                        </div>

                        <DailyBreakdownTable rows={detailReportRows} empLeaves={monthlyReport.empLeaves} />

                        {monthlyReport.empLeaves.length > 0 && (
                            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                                <div className="p-3 bg-slate-50 border-b border-slate-100">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Leave Records in This Range</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {monthlyReport.empLeaves.map(leave => (
                                        <div key={leave.id} className="p-3 flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-700">{leave.leaveType.name}</span>
                                            <span className="text-slate-500">{format(parseISO(leave.startDate), 'dd MMM')} – {format(parseISO(leave.endDate), 'dd MMM yyyy')} ({leave.daysCount} days)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {monthlyReport.empOvertimes.length > 0 && (
                            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                                <div className="p-3 bg-slate-50 border-b border-slate-100">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Overtime Records in This Range</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {monthlyReport.empOvertimes.map(ot => (
                                        <div key={ot.id} className="p-3 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="font-bold text-slate-700">{format(parseISO(ot.date), 'dd MMM yyyy')}</span>
                                                {ot.reason && <span className="text-slate-400 ml-2">— {ot.reason}</span>}
                                            </div>
                                            <span className="font-black text-blue-600">{formatHmsAsHM(ot.approvedMinutes)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Log Missing Punch popup — separate Modal so typing/selecting here never re-renders
                the tables above (same pattern used to fix the earlier re-render/focus bug). */}
            <Modal
                isOpen={missingPunchOpen}
                onClose={closeMissingPunch}
                title="Log Missing Punch"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee</label>
                        <EmployeeSearchSelect options={attendanceEmployeeOptions} value={mpEmpCode} onChange={setMpEmpCode} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Punch Date & Time</label>
                        <input
                            type="datetime-local"
                            value={mpPunchTime}
                            onChange={e => setMpPunchTime(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Type</label>
                        <select
                            value={mpPunchState}
                            onChange={e => setMpPunchState(e.target.value as '0' | '1')}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold cursor-pointer"
                        >
                            <option value="0">Check In</option>
                            <option value="1">Check Out</option>
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddMissingPunch}
                        disabled={submittingPunch}
                        className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50"
                    >
                        {submittingPunch ? 'Logging…' : 'Log Punch'}
                    </button>
                </div>
            </Modal>

            {/* Log Leave popup */}
            <Modal isOpen={leaveOpen} onClose={() => setLeaveOpen(false)} title="Log Leave" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee</label>
                        <EmployeeSearchSelect options={attendanceEmployeeOptions} value={leaveForm.empCode} onChange={code => setLeaveForm(f => ({ ...f, empCode: code }))} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Leave Type</label>
                        <select value={leaveForm.leaveTypeId} onChange={e => setLeaveForm(f => ({ ...f, leaveTypeId: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold cursor-pointer">
                            <option value="">Select type…</option>
                            {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                            <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                            <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Notes (optional)</label>
                        <input type="text" value={leaveForm.notes} onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitLeave} disabled={savingLeave} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingLeave ? 'Logging…' : 'Log Leave'}
                    </button>
                </div>
            </Modal>

            {/* Log Overtime popup */}
            <Modal isOpen={otOpen} onClose={() => setOtOpen(false)} title="Log Overtime" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee</label>
                        <EmployeeSearchSelect options={attendanceEmployeeOptions} value={otForm.empCode} onChange={code => setOtForm(f => ({ ...f, empCode: code }))} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
                        <input type="date" value={otForm.date} onChange={e => setOtForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Hours</label>
                            <input type="number" min="0" value={otForm.hours} onChange={e => setOtForm(f => ({ ...f, hours: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Minutes</label>
                            <input type="number" min="0" max="59" value={otForm.minutes} onChange={e => setOtForm(f => ({ ...f, minutes: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reason (optional)</label>
                        <input type="text" value={otForm.reason} onChange={e => setOtForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitOvertime} disabled={savingOt} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingOt ? 'Logging…' : 'Log Overtime'}
                    </button>
                </div>
            </Modal>

            {/* Log Out-Work popup */}
            <Modal isOpen={owOpen} onClose={() => setOwOpen(false)} title="Log Out-Work" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee</label>
                        <EmployeeSearchSelect options={attendanceEmployeeOptions} value={owForm.empCode} onChange={code => setOwForm(f => ({ ...f, empCode: code }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                            <input type="date" value={owForm.startDate} onChange={e => setOwForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                            <input type="date" value={owForm.endDate} onChange={e => setOwForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reason</label>
                        <input type="text" value={owForm.reason} onChange={e => setOwForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitOutWork} disabled={savingOw} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingOw ? 'Logging…' : 'Log Out-Work'}
                    </button>
                </div>
            </Modal>

            {/* Log Excused Late popup */}
            <Modal isOpen={xlOpen} onClose={() => setXlOpen(false)} title="Log Excused Late" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee</label>
                        <EmployeeSearchSelect options={attendanceEmployeeOptions} value={xlForm.empCode} onChange={code => setXlForm(f => ({ ...f, empCode: code }))} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
                        <input type="date" value={xlForm.date} onChange={e => setXlForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Excused Minutes</label>
                        <input type="number" min="1" value={xlForm.excusedMinutes} onChange={e => setXlForm(f => ({ ...f, excusedMinutes: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reason</label>
                        <input type="text" value={xlForm.reason} onChange={e => setXlForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitExcusedLate} disabled={savingXl} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingXl ? 'Logging…' : 'Log Excused Late'}
                    </button>
                </div>
            </Modal>

            {/* Log Excused Early-Out popup */}
            <Modal isOpen={eoOpen} onClose={() => setEoOpen(false)} title="Log Excused Early-Out" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee</label>
                        <EmployeeSearchSelect options={attendanceEmployeeOptions} value={eoForm.empCode} onChange={code => setEoForm(f => ({ ...f, empCode: code }))} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
                        <input type="date" value={eoForm.date} onChange={e => setEoForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Excused Minutes</label>
                        <input type="number" min="1" value={eoForm.excusedMinutes} onChange={e => setEoForm(f => ({ ...f, excusedMinutes: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reason</label>
                        <input type="text" value={eoForm.reason} onChange={e => setEoForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitExcusedEarlyOut} disabled={savingEo} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingEo ? 'Logging…' : 'Log Excused Early-Out'}
                    </button>
                </div>
            </Modal>

            {/* Add/Edit BioTime Employee popup */}
            <Modal isOpen={empModalOpen} onClose={closeEmployeeModal} title={empEditing ? 'Edit Employee' : 'Add Employee'} maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee Code</label>
                        <input
                            type="text"
                            value={empForm.empCode}
                            disabled={!!empEditing}
                            onChange={e => setEmpForm(f => ({ ...f, empCode: e.target.value }))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        {empEditing && <p className="text-[10px] text-slate-400 font-medium mt-1">The employee code can't be changed after creation.</p>}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Name</label>
                        <input
                            type="text"
                            value={empForm.firstName}
                            onChange={e => setEmpForm(f => ({ ...f, firstName: e.target.value }))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Position</label>
                        <select
                            value={empForm.positionId}
                            onChange={e => setEmpForm(f => ({ ...f, positionId: e.target.value }))}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold cursor-pointer"
                        >
                            {BIOTIME_POSITIONS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={submitEmployee} disabled={savingEmp} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingEmp ? 'Saving…' : empEditing ? 'Save Changes' : 'Add Employee'}
                    </button>
                </div>
            </Modal>

            {/* Edit Setting popup — edit only, no add */}
            <Modal isOpen={settingModalOpen} onClose={() => setSettingModalOpen(false)} title="Edit Setting" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Key</label>
                        <input type="text" value={settingForm.key} disabled className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-400" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Value</label>
                        <input type="time" value={settingForm.valueString} onChange={e => setSettingForm(f => ({ ...f, valueString: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                        <input type="text" value={settingForm.description} onChange={e => setSettingForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitSetting} disabled={savingSetting} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingSetting ? 'Saving…' : 'Save Setting'}
                    </button>
                </div>
            </Modal>

            {/* Edit Leave Type popup — edit only, no add */}
            <Modal isOpen={ltModalOpen} onClose={() => setLtModalOpen(false)} title="Edit Leave Type" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Name</label>
                        <input type="text" value={ltForm.name} onChange={e => setLtForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input type="checkbox" checked={ltForm.isPaid} onChange={e => setLtForm(f => ({ ...f, isPaid: e.target.checked }))} />
                        Paid leave
                    </label>
                    <button type="button" onClick={submitLeaveType} disabled={savingLt} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingLt ? 'Saving…' : 'Save Leave Type'}
                    </button>
                </div>
            </Modal>

            {/* Add/Edit Holiday popup */}
            <Modal isOpen={holModalOpen} onClose={() => setHolModalOpen(false)} title={holEditing ? 'Edit Holiday' : 'Add Holiday'} maxWidth="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Name</label>
                        <input type="text" value={holForm.name} onChange={e => setHolForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                        <input type="date" value={holForm.startDate} onChange={e => setHolForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                        <input type="date" value={holForm.endDate} onChange={e => setHolForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitHoliday} disabled={savingHol} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingHol ? 'Saving…' : 'Save Holiday'}
                    </button>
                </div>
            </Modal>

            {/* Add/Edit Multiplier Factor popup */}
            <Modal isOpen={mfModalOpen} onClose={() => setMfModalOpen(false)} title={mfEditing ? 'Edit Multiplier Factor' : 'Add Multiplier Factor'} maxWidth="max-w-lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Name</label>
                            <input type="text" value={mfForm.name} onChange={e => setMfForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Factor Value</label>
                            <input type="text" placeholder="e.g. 1.5" value={mfForm.factorValue} onChange={e => setMfForm(f => ({ ...f, factorValue: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Type (single character)</label>
                        <input type="text" maxLength={1} value={mfForm.type} onChange={e => setMfForm(f => ({ ...f, type: e.target.value }))} className="w-24 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date Start</label>
                            <input type="date" value={mfForm.dateStart} onChange={e => setMfForm(f => ({ ...f, dateStart: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date End</label>
                            <input type="date" value={mfForm.dateEnd} onChange={e => setMfForm(f => ({ ...f, dateEnd: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Work Start</label>
                            <input type="time" value={mfForm.workStart} onChange={e => setMfForm(f => ({ ...f, workStart: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Work End</label>
                            <input type="time" value={mfForm.workEnd} onChange={e => setMfForm(f => ({ ...f, workEnd: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grace Period</label>
                            <input type="time" value={mfForm.gracePeriod} onChange={e => setMfForm(f => ({ ...f, gracePeriod: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">OT Threshold</label>
                            <input type="time" value={mfForm.otThreshold} onChange={e => setMfForm(f => ({ ...f, otThreshold: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <button type="button" onClick={submitMultiplier} disabled={savingMf} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingMf ? 'Saving…' : 'Save Multiplier Factor'}
                    </button>
                </div>
            </Modal>

            {/* Add/Edit Employee Shift popup */}
            <Modal isOpen={esModalOpen} onClose={() => setEsModalOpen(false)} title={esEditing ? 'Edit Employee Shift' : 'Add Employee Shift'} maxWidth="max-w-lg">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Employee</label>
                        <EmployeeSearchSelect
                            options={bioTimeEmployeeOptions}
                            value={esForm.empCode}
                            onChange={code => setEsForm(f => ({ ...f, empCode: code }))}
                            disabled={!!esEditing}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                            <input type="date" value={esForm.startDate} onChange={e => setEsForm(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                            <input type="date" value={esForm.endDate} onChange={e => setEsForm(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Work Start</label>
                            <input type="time" value={esForm.workStart} onChange={e => setEsForm(f => ({ ...f, workStart: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Work End</label>
                            <input type="time" value={esForm.workEnd} onChange={e => setEsForm(f => ({ ...f, workEnd: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grace Period (optional)</label>
                            <input type="time" value={esForm.gracePeriod} onChange={e => setEsForm(f => ({ ...f, gracePeriod: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">OT Threshold (optional)</label>
                            <input type="time" value={esForm.otThreshold} onChange={e => setEsForm(f => ({ ...f, otThreshold: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reason (optional)</label>
                        <input type="text" value={esForm.reason} onChange={e => setEsForm(f => ({ ...f, reason: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                    </div>
                    <button type="button" onClick={submitShift} disabled={savingEs} className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50">
                        {savingEs ? 'Saving…' : 'Save Employee Shift'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default AttendancePage;
