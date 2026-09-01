import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { roleThemes } from '../config/roleThemes';
import type { UserRole } from '../types';
import {
    Users,
    Calendar,
    TrendingUp,
    ArrowRight,
    FileText,
    CheckCircle2,
    Activity,
    BarChart3,
    Plane,
    ShieldCheck,
    PenTool
} from 'lucide-react';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { canAccess } from '../utils/access';
import { timeService } from '../services/timeService';
import { departmentService, groupService } from '../services/departmentService';
import { unitService } from '../services/unitService';
import { getHREvaluation } from '../services/hrEvaluationService';
import { isEvaluationEnabled } from '../services/evaluationPeriodService';

import { useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import EvaluationAnalytics from '../components/EvaluationAnalytics';
import DashboardInsights from '../components/DashboardInsights';
import EmployeeDashboardPanels from '../components/EmployeeDashboardPanels';
import { dashboardService } from '../services/dashboardService';
import Skeleton from '../components/Skeleton';
import JobDescriptionView from '../components/JobDescriptionView';
import Modal from '../components/Modal';
import SignaturePad from '../components/SignaturePad';
import api from '../services/apiClient';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
    const { currentUser, updateCurrentUser } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    // Signature card state. Every user can view & manage their own signature.
    const canManageSignature = !!currentUser;
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    const handleSaveSignature = async (dataUrl: string | null) => {
        setIsSavingSignature(true);
        try {
            const res = await api.post('/auth/signature', { signature: dataUrl });
            updateCurrentUser({ signature: res.data?.signature ?? dataUrl ?? null });
            toast.success(dataUrl
                ? t('signature_saved_success', { defaultValue: 'Signature saved successfully!' })
                : t('signature_removed_success', { defaultValue: 'Signature removed.' }));
            setIsSignatureModalOpen(false);
        } catch (error: any) {
            console.error('Error saving signature:', error);
            const msg = error.response?.data?.error || t('error_saving_signature', { defaultValue: 'Failed to save signature.' });
            toast.error(msg);
        } finally {
            setIsSavingSignature(false);
        }
    };

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', currentUser?.id, currentUser?.role],
        queryFn: async () => {
            if (!currentUser) throw new Error("User not authenticated");

            const currentMonth = format(new Date(), 'yyyy-MM');


            // Conditional fetching based on role or permissions
            const hasEmpView = currentUser.permissions?.includes('view_employees') || currentUser.permissions?.includes('manage_employees');
            const isManager = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL'].includes(currentUser.role) || hasEmpView;

            const [emps, depts, groups, units, _timeRecords, expiringSoonList, myEmployeeResult] = await Promise.all([
                isManager ? employeeService.getAllEmployees().catch(() => []) : Promise.resolve([]),
                departmentService.getAllDepartments().catch(() => []),
                groupService.getAllGroups().catch(() => []),
                unitService.getAllUnits().catch(() => []),
                // Only fetch time records for Admin/HR
                canAccess(currentUser, ['HR_MANAGER'], ['view_time_tracking', 'manage_time_tracking'])
                    ? timeService.getTimeRecordsByMonth(currentMonth).catch(() => [])
                    : Promise.resolve([]),
                (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL' || currentUser.permissions?.includes('view_lifecycle') || currentUser.permissions?.includes('manage_lifecycle_control'))
                    ? employeeService.getExpiringContracts(7).catch(() => [])
                    : Promise.resolve([]),
                // Fetch the current user's own Employee record (needed for org-scoping below)
                (async () => {
                    try {
                        const me = await employeeService.getMyEmployeeRecord();
                        return { employee: me || null };
                    } catch { return { employee: null }; }
                })()
            ]);

            const myEmployeeData = (myEmployeeResult as any).employee;

            // const urgentContractsCount = (expiringSoonList as any[]).length;

            // Filter employees based on scope. Transferred (inter-company) staff are excluded from
            // active counts and evaluation ratios.
            const activeEmps = (emps as any[]).filter(e => e.enrollmentStatus !== 'TRANSFERRED');
            let scopedEmps = activeEmps;
            if (currentUser.role === 'HEAD_DIRECTOR') {
                if (myEmployeeData?.directorateId) {
                    scopedEmps = activeEmps.filter(e => e.directorateId === myEmployeeData.directorateId);
                } else if (currentUser.departmentIds && currentUser.departmentIds.length > 0) {
                    scopedEmps = activeEmps.filter(e => currentUser.departmentIds?.includes(e.departmentId));
                } else if (currentUser.departmentId) {
                    scopedEmps = activeEmps.filter(e => e.departmentId === currentUser.departmentId);
                } else if (currentUser.groupId) {
                    scopedEmps = activeEmps.filter(e => e.groupId === currentUser.groupId);
                }
            } else if (currentUser.role === 'HEAD_DIVISION') {
                if (myEmployeeData?.divisionId) {
                    scopedEmps = activeEmps.filter(e => e.divisionId === myEmployeeData.divisionId);
                } else {
                    scopedEmps = [];
                }
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                scopedEmps = activeEmps.filter(e => e.departmentId === currentUser.departmentId);
            } else if (currentUser.role === 'HEAD_UNIT' && (currentUser as any).unitId) {
                scopedEmps = activeEmps.filter(e => e.unitId === (currentUser as any).unitId);
            }

            // Analytics Data Preparation (Only for Super Admin / HR)
            let analyticsData: any[] = [];
            let analyticsDepts: string[] = [];
            const showAnalytics = canAccess(currentUser, ['HR_MANAGER'], ['view_hr_evaluations']);

            if (showAnalytics) {
                try {
                    // Generate last 6 months
                    const months: string[] = [];
                    let d = new Date();
                    for (let i = 0; i < 6; i++) {
                        months.unshift(format(d, 'yyyy-MM'));
                        d.setMonth(d.getMonth() - 1);
                    }

                    // Fetch data for all months
                    const trendPromises = months.map(async (m) => {
                        const [monthDirEvals, monthDeptEvals] = await Promise.all([
                            evaluationService.getDirectorEvaluationsByMonth(m).catch(() => []),
                            evaluationService.getDeptEvaluationsByMonth(m).catch(() => [])
                        ]);
                        return { month: m, dirEvals: monthDirEvals, deptEvals: monthDeptEvals };
                    });

                    const trendResults = await Promise.all(trendPromises);

                    // Build Chart Data
                    analyticsData = trendResults.map(({ month, dirEvals }) => {
                        const dataPoint: any = { month: format(new Date(month), 'MMM') };

                        depts.forEach(dept => {
                            const deptEmpIds = emps.filter(e => e.departmentId === dept.id).map(e => e.id);
                            const relevantDirEvals = (dirEvals as any[]).filter(ev => deptEmpIds.includes(ev.employeeId));

                            if (relevantDirEvals.length > 0) {
                                const totalScore = relevantDirEvals.reduce((sum, ev) => sum + (ev.finalScore || 0), 0);
                                const rawAvg = totalScore / relevantDirEvals.length;
                                const normalizedAvg = (rawAvg / 80) * 100;
                                dataPoint[dept.name] = parseFloat(normalizedAvg.toFixed(1));
                            }
                        });

                        return dataPoint;
                    });

                    analyticsDepts = depts.map(d => d.name);
                } catch (err) {
                    console.error("Dashboard Analytics Error:", err);
                }
            }

            // Refined Evaluation Status Logic
            const evalStatusResults = await Promise.all(scopedEmps.map(async (e) => {
                const isEnabled = await isEvaluationEnabled(currentMonth, e.departmentId);
                if (!isEnabled && currentUser.role !== 'SUPER_ADMIN') return { finished: false, actionable: false };

                if (currentUser.role === 'HEAD_DIRECTOR' || currentUser.role === 'SUPER_ADMIN') {
                    const [dirEval, deptEval] = await Promise.all([
                        evaluationService.getDirectorEvaluation(e.id, currentMonth).catch(() => null),
                        evaluationService.getDeptEvaluation(e.id, currentMonth).catch(() => null)
                    ]);
                    const isFinished = !!(dirEval && dirEval.locked);
                    const isActionable = !!(deptEval && !isFinished);
                    return { finished: isFinished, actionable: isActionable };
                }
                if (currentUser.role === 'HEAD_DIVISION') {
                    // Assuming for now they don't have actionable evaluations until defined
                    return { finished: false, actionable: false };
                }
                if (currentUser.role === 'HEAD_DEPARTMENT') {
                    const [deptEval, hrEval] = await Promise.all([
                        evaluationService.getDeptEvaluation(e.id, currentMonth).catch(() => null),
                        getHREvaluation(e.id, currentMonth).catch(() => null)
                    ]);
                    const isFinished = !!deptEval;
                    const isActionable = !!(hrEval && !deptEval);
                    return { finished: isFinished, actionable: isActionable };
                }
                if (currentUser.role === 'HEAD_UNIT') {
                    const unitEval = await evaluationService.getUnitEvaluation(e.id, currentMonth).catch(() => null);
                    return { finished: !!unitEval, actionable: !unitEval };
                }
                return { finished: false, actionable: false };
            }));

            const finishedEvals = evalStatusResults.filter(r => r.finished).length;
            const evaluationPendingCount = evalStatusResults.filter(r => r.actionable).length;
            const evalPercent = scopedEmps.length > 0 ? Math.round((finishedEvals / scopedEmps.length) * 100) : 0;

            // Org info names
            let myDept = depts.find(d => d.id === currentUser.departmentId)?.name || 'Personal Dashboard';
            let myGroup = groups.find(g => g.id === currentUser.groupId)?.name || 'N/A';

            // Position Logic
            let positionName = 'Staff Member';
            let managedEntity = '';

            if (currentUser.role === 'SUPER_ADMIN') {
                positionName = 'Global Administrator';
                managedEntity = 'IPH SYSTEM';
                myGroup = 'Executive Board';
                myDept = 'System Administration';
            } else if (currentUser.role === 'HR_MANAGER') {
                positionName = 'HR Manager';
                managedEntity = 'Corporate Administration';
                myGroup = 'Human Resources IPH SYSTEM';
                myDept = 'Corporate Administration';
            } else if (currentUser.role === 'HEAD_DIRECTOR') {
                positionName = 'Head of Directorate';
                managedEntity = myEmployeeData?.directorateId ? 'Directorate' : (groups.find(g => g.id === currentUser.groupId)?.name || 'Directorate');
            } else if (currentUser.role === 'HEAD_DIVISION') {
                positionName = 'Head of Division';
                managedEntity = 'Division';
            } else if (currentUser.role === 'HEAD_DEPARTMENT') {
                positionName = 'Head of Department';
                managedEntity = depts.find(d => d.id === currentUser.departmentId)?.name || 'Department';
            } else if (currentUser.role === 'HEAD_UNIT') {
                positionName = 'Head of Unit';
                managedEntity = units.find(u => u.id === (currentUser as any).unitId)?.name || 'Unit';
            } else if (currentUser.role === 'PERSONNEL' || currentUser.permissions?.includes('manage_personnel_actions')) {
                positionName = 'Personnel Officer';
                managedEntity = 'Human Resources';
                myGroup = 'Human Resources IPH SYSTEM';
                myDept = 'Corporate Administration';
            }

            // Refined Pending Counts
            let totalPendingAction = evaluationPendingCount;

            if (canAccess(currentUser, ['HR_MANAGER', 'PERSONNEL'], ['view_contracts'])) {
                totalPendingAction += (expiringSoonList as any[]).length;
            }

            const stats = [
                { label: t('active_employees'), value: scopedEmps.length.toString(), icon: Users, change: t('current'), color: 'text-primary-600', bg: 'bg-primary-50', visible: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT'], permission: 'view_employees' },
                { label: 'Evaluation Ratio', value: `${evalPercent}%`, icon: CheckCircle2, change: `${finishedEvals}/${scopedEmps.length}`, color: 'text-green-600', bg: 'bg-green-50', visible: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT'], permission: 'view_evaluations' },
                { label: 'Evaluations Awaiting', value: evaluationPendingCount.toString(), icon: FileText, change: 'Action Required', color: 'text-orange-600', bg: 'bg-orange-50', visible: ['HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL'], permission: 'view_hr_evaluations' },
                { id: 'system_alerts', label: 'System Alerts', value: totalPendingAction.toString(), icon: Activity, change: 'Critical', color: 'text-red-600', bg: 'bg-red-50', visible: ['SUPER_ADMIN', 'HR_MANAGER'], permission: 'manage_users' },
            ].filter(s =>
                (!s.visible || s.visible.includes(currentUser.role)) ||
                (s.permission && currentUser.permissions?.includes(s.permission))
            );

            // Breakdown behind the "System Alerts" counter, so clicking it shows what's outstanding.
            const showsContracts = canAccess(currentUser, ['HR_MANAGER', 'PERSONNEL'], ['view_contracts']);
            const systemAlerts = {
                total: totalPendingAction,
                evaluations: evaluationPendingCount,
                expiringContracts: showsContracts ? (expiringSoonList as any[]).length : 0,
            };

            return {
                stats,
                orgInfo: { department: myDept, group: myGroup, positionName, managedEntity },
                analyticsData,
                analyticsDepts,
                myEmployeeData,
                systemAlerts
            };
        },
        enabled: !!currentUser,
    });

    // Company-wide analytics rollup — HR + executive audience. Fetched from the single
    // server-side aggregation endpoint (mirrors the route's own authorization).
    const canViewInsights =
        ['SUPER_ADMIN', 'HR_MANAGER', 'GENERAL_MANAGER', 'CHAIRMAN'].includes(currentUser?.role || '') ||
        !!currentUser?.permissions?.includes('view_employees');

    const { data: insights } = useQuery({
        queryKey: ['dashboard-insights', currentUser?.id],
        queryFn: () => dashboardService.getAnalytics(),
        enabled: !!currentUser && canViewInsights,
        staleTime: 5 * 60 * 1000,
    });

    const stats = data?.stats || [];
    const orgInfo = data?.orgInfo || { department: '', group: '', positionName: '', managedEntity: '' };
    const { positionName, managedEntity } = orgInfo;
    const analyticsData = data?.analyticsData || [];
    const analyticsDepts = data?.analyticsDepts || [];
    const myEmployeeData = data?.myEmployeeData || null;
    const systemAlerts = data?.systemAlerts || { total: 0, evaluations: 0, expiringContracts: 0 };
    const [showAlerts, setShowAlerts] = useState(false);

    if (isLoading) {
        return (
            <div className="space-y-8 max-w-7xl mx-auto animate-pulse">
                {/* Hero Skeleton */}
                <div className="h-[300px] lg:h-[400px] rounded-3xl bg-slate-200/50 p-12 flex flex-col justify-center space-y-6">
                    <Skeleton className="w-32 h-6" />
                    <Skeleton className="w-2/3 h-12" />
                    <Skeleton className="w-1/2 h-6" />
                    <div className="flex gap-4 pt-4">
                        <Skeleton className="w-40 h-12" />
                        <Skeleton className="w-40 h-12" />
                    </div>
                </div>

                {/* Stats Grid Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-card p-6 rounded-3xl space-y-4">
                            <div className="flex justify-between items-start">
                                <Skeleton variant="circular" width={48} height={48} />
                                <Skeleton width={60} height={20} />
                            </div>
                            <Skeleton className="w-24 h-4" />
                            <Skeleton className="w-16 h-8" />
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Skeleton className="h-[400px] rounded-3xl" />
                    </div>
                    <div className="lg:col-span-1">
                        <Skeleton className="h-[400px] rounded-3xl" />
                    </div>
                </div>
            </div>
        );
    }

    // Mirror the "System Alerts" counter so the hero pill's number matches what its
    // breakdown modal lists (evaluations awaiting + expiring contracts). Sourced from
    // systemAlerts.total — NOT stats[3], whose index shifts once the stats array is
    // role-filtered above.
    const pendingReviewCount = String(systemAlerts.total ?? 0);
    const showAnalytics = canAccess(currentUser, ['HR_MANAGER'], ['view_hr_evaluations']);

    const renderDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        const isoDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        const parts = isoDate.split('-');
        if (parts.length !== 3) return dateStr;
        const [year, month, day] = parts;
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return format(d, 'MMM dd, yyyy');
    };

    const displayFirstName = (myEmployeeData?.fullName || currentUser?.fullName || '').split(' ')[0];

    // Real contract progress — share of the contract term still remaining, derived from the
    // actual start/end dates (replaces the old decorative fixed-width bar).
    const contractProgress = (() => {
        if (!myEmployeeData?.contractEndDate) return null;
        const end = new Date(myEmployeeData.contractEndDate);
        const now = new Date();
        const remaining = Math.max(0, differenceInDays(end, now));
        const start = myEmployeeData.contractStartDate ? new Date(myEmployeeData.contractStartDate) : null;
        const total = start ? differenceInDays(end, start) : null;
        const pct = total && total > 0
            ? Math.min(100, Math.max(0, Math.round((remaining / total) * 100)))
            : (remaining > 0 ? 100 : 0);
        const barColor = remaining < 30 ? 'bg-red-500' : remaining < 90 ? 'bg-amber-400' : 'bg-emerald-400';
        return { remaining, pct, barColor };
    })();

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-12">
            {/* Hero Welcome Section */}
            <div
                className="relative overflow-hidden rounded-[40px] p-10 lg:p-16 text-white shadow-2xl shadow-primary-600/20 group border border-white/10"
                style={{
                    background: `radial-gradient(120% 130% at 82% 6%, ${theme.secondary}70 0%, ${theme.secondary}00 44%), radial-gradient(110% 120% at 0% 100%, ${theme.dark} 0%, ${theme.dark}00 55%), linear-gradient(140deg, ${theme.dark} 0%, ${theme.primary} 52%, ${theme.primary} 100%)`,
                }}
            >
                {/* Top sheen + hover glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none"></div>
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-10 transition-opacity duration-1000"></div>

                {/* Soft accent blooms */}
                <div className="absolute top-[-12%] right-[6%] w-96 h-96 bg-white/10 blur-3xl rounded-full animate-pulse transition-all duration-1000 group-hover:scale-110 pointer-events-none"></div>
                <div className="absolute bottom-[-25%] left-[-10%] w-80 h-80 bg-black/20 blur-[100px] rounded-full pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-12">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center px-4 py-1.5 bg-white/10 backdrop-blur-xl rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-white/20 shadow-xl overflow-hidden relative group/badge">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/badge:translate-x-full transition-transform duration-1000"></div>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2.5 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
                            {t('welcome_back')}
                        </div>
                        
                        <h1 className="text-5xl lg:text-7xl font-outfit font-black mb-4 tracking-tight leading-[0.9] drop-shadow-2xl">
                            {t('hello_user', { name: displayFirstName })} <span className="opacity-40 font-light">👋</span>
                        </h1>
                        
                        {(positionName && managedEntity) && (
                            <div className="flex items-center gap-3 mb-8">
                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider border border-white/20">
                                    {positionName}
                                </span>
                                <span className="text-lg font-medium text-white/90">
                                    {managedEntity}
                                </span>
                            </div>
                        )}
                        
                        <p className="text-white/75 text-lg lg:text-xl leading-relaxed mb-6 font-medium max-w-lg">
                            {t('dashboard_update_msg')}
                        </p>

                        <button
                            type="button"
                            onClick={() => setShowAlerts(true)}
                            className="inline-flex items-center gap-3 mb-10 pl-2 pr-5 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-xl transition-all hover:scale-[1.02] group/msg"
                        >
                            <span className="inline-flex items-center justify-center min-w-[32px] h-8 px-2.5 rounded-full bg-white text-slate-900 text-sm font-black">
                                {pendingReviewCount !== '...' ? pendingReviewCount : '0'}
                            </span>
                            <span className="text-white font-bold text-sm">{t('pending_notifications')}</span>
                            <ArrowRight className="w-4 h-4 text-white/80 group-hover/msg:translate-x-1 transition-transform" />
                        </button>

                        <div className="flex flex-wrap gap-5">
                            <button
                                onClick={() => navigate('/tasks')}
                                className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center shadow-2xl hover:bg-slate-50 transition-all hover:scale-[1.05] active:scale-95 group/btn"
                            >
                                {t('view_tasks')} 
                                <ArrowRight className="ml-2.5 w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>

                    {/* Premium Floating Icon Container */}
                    <div className="hidden lg:flex items-center justify-center relative">
                        <div className="w-80 h-80 bg-white/5 backdrop-blur-3xl rounded-[60px] flex items-center justify-center border border-white/10 relative shadow-2xl animate-float">
                            <div className="absolute inset-4 rounded-[45px] border border-white/10 animate-[spin_20s_linear_infinite]"></div>
                            <div className="w-56 h-56 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-3xl rounded-[40px] flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-700">
                                <Activity className="w-24 h-24 text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]" />
                            </div>
                            
                            {/* Floating Micro-cards */}
                            <div className="absolute -top-6 -right-6 p-4 glass-card rounded-2xl shadow-2xl animate-bounce duration-[3000ms] delay-700">
                                <TrendingUp className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div className="absolute -bottom-4 -left-8 p-4 glass-card rounded-2xl shadow-2xl animate-bounce duration-[4000ms]">
                                <Users className="w-6 h-6 text-blue-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat: any, idx: number) => (
                    <div
                        key={idx}
                        onClick={stat.id === 'system_alerts' ? () => setShowAlerts(true) : undefined}
                        role={stat.id === 'system_alerts' ? 'button' : undefined}
                        className={`glass-card p-8 rounded-[32px] hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden ${stat.id === 'system_alerts' ? 'cursor-pointer' : ''}`}
                    >
                        {/* Subtle background icon watermark */}
                        <stat.icon className="absolute -bottom-6 -right-6 w-32 h-32 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500" />
                        
                        <div className="flex items-center justify-between mb-8">
                            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} transition-all duration-500 group-hover:scale-110 shadow-lg group-hover:rotate-6`}>
                                <stat.icon className="w-7 h-7" />
                            </div>
                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${stat.bg} ${stat.color} border border-current/10 uppercase tracking-widest`}>
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{stat.label}</h3>
                        <p className="text-4xl font-outfit font-black text-slate-800 tracking-tighter group-hover:text-primary-600 transition-colors">
                            {stat.value}
                        </p>
                        {stat.id === 'system_alerts' && (
                            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                                {t('view_details', { defaultValue: 'View details' })} <ArrowRight className="w-3 h-3" />
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* System Alerts breakdown — what makes up the counter, with click-through to each area. */}
            <Modal
                isOpen={showAlerts}
                onClose={() => setShowAlerts(false)}
                title={t('system_alerts', { defaultValue: 'System Alerts' })}
            >
                <div className="space-y-3">
                    <p className="text-sm text-slate-500 font-medium">
                        {t('system_alerts_subtitle', { defaultValue: 'Outstanding items that need attention across the system.' })}
                    </p>
                    {([
                        { key: 'evaluations', label: t('evaluations_awaiting', { defaultValue: 'Evaluations awaiting action' }), value: systemAlerts.evaluations, icon: FileText, to: '/evaluations' },
                        { key: 'contracts', label: t('expiring_contracts', { defaultValue: 'Contracts expiring soon' }), value: systemAlerts.expiringContracts, icon: Calendar, to: '/contract-management' },
                    ] as const).map(row => (
                        <button
                            key={row.key}
                            type="button"
                            onClick={() => { setShowAlerts(false); navigate(row.to); }}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors text-left"
                        >
                            <div className={`p-3 rounded-xl shrink-0 ${row.value > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                                <row.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-700 text-sm">{row.label}</p>
                                <p className="text-xs text-slate-400">{row.value > 0 ? t('needs_attention', { defaultValue: 'Needs attention' }) : t('all_clear', { defaultValue: 'All clear' })}</p>
                            </div>
                            <span className={`text-2xl font-outfit font-black ${row.value > 0 ? 'text-red-600' : 'text-slate-300'}`}>{row.value}</span>
                            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </button>
                    ))}
                    <div className="flex items-center justify-between pt-2 px-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('total', { defaultValue: 'Total' })}</span>
                        <span className="text-lg font-outfit font-black text-slate-800">{systemAlerts.total}</span>
                    </div>
                </div>
            </Modal>

            {/* My Signature Section */}
            {canManageSignature && (
                <div className="glass-card p-8 rounded-[32px] relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="p-4 rounded-2xl bg-primary-50 text-primary-600 shadow-lg shrink-0">
                                <PenTool className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight">{t('my_signature', { defaultValue: 'My Signature' })}</h2>
                                <p className="text-slate-500 text-sm font-medium mt-1 max-w-md">
                                    {t('my_signature_dashboard_subtitle', { defaultValue: 'Your signature is used on approval forms. Draw it once and it will be applied when you approve.' })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                            {currentUser?.signature ? (
                                <div className="flex items-center justify-center h-28 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-inner">
                                    <img src={currentUser.signature} alt={t('my_signature', { defaultValue: 'My Signature' })} className="max-h-full max-w-full object-contain" />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-28 w-56 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 text-slate-300 font-bold uppercase tracking-widest text-[11px]">
                                    {t('no_signature_yet', { defaultValue: 'No signature yet' })}
                                </div>
                            )}
                            <button
                                onClick={() => setIsSignatureModalOpen(true)}
                                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#541c2c] text-white font-black text-sm uppercase tracking-wider hover:bg-[#3d1420] transition-all hover:scale-[1.03] active:scale-95 shadow-lg"
                            >
                                <PenTool className="w-4 h-4" />
                                {currentUser?.signature
                                    ? t('edit_signature', { defaultValue: 'Edit Signature' })
                                    : t('create_signature', { defaultValue: 'Create Signature' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* My Lifecycle Data Section */}
            {myEmployeeData && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight">{t('my_lifecycle_data', { defaultValue: 'My Lifecycle Data' })}</h2>
                            <p className="text-slate-500 text-sm font-medium">{t('my_lifecycle_subtitle', { defaultValue: 'Your personal HR record, contract, and leave balances' })}</p>
                        </div>
                    </div>

                    {myEmployeeData.jobDescription && (
                        <div className="glass-card p-8 rounded-[32px] border-none shadow-premium-shadow relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 tracking-tight">{t('my_job_description', { defaultValue: 'My Job Description' })}</h3>
                                    <span className="text-sm font-medium text-slate-400">{t('my_job_description_sub', { defaultValue: 'Your assigned position and responsibilities' })}</span>
                                </div>
                            </div>
                            <div className="relative z-10">
                                <JobDescriptionView jd={myEmployeeData.jobDescription} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Contract Details Card */}
                        <div className="lg:col-span-1 glass-card p-8 rounded-[32px] border-none shadow-premium-shadow relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100 rounded-full blur-[60px] opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            
                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 tracking-tight">{t('contract_status', { defaultValue: 'Contract Status' })}</h3>
                                    <span className="text-sm font-bold text-primary-600 uppercase tracking-wider">{myEmployeeData.contractType || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="space-y-4 relative z-10">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Start Date</span>
                                    <span className="font-bold text-slate-800">{renderDate(myEmployeeData.contractStartDate)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">End Date</span>
                                    <span className="font-bold text-slate-800">{renderDate(myEmployeeData.contractEndDate)}</span>
                                </div>
                                
                                {contractProgress && (
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Remaining</span>
                                            <span className={`text-lg font-black ${contractProgress.remaining < 30 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {contractProgress.remaining} Days
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-700 ${contractProgress.barColor}`} style={{ width: `${contractProgress.pct}%` }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Leave Balances Card */}
                        <div className="lg:col-span-2 glass-card p-8 rounded-[32px] border-none shadow-premium-shadow relative overflow-hidden">
                             <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                    <Plane className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 tracking-tight text-xl">{t('leave_balances', { defaultValue: 'Leave Balances' })}</h3>
                                    <p className="text-sm text-slate-500 font-medium tracking-wide">Track your annual holidays and emergency leaves</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Paid Holidays */}
                                <div className="p-6 rounded-3xl bg-emerald-50/50 border border-emerald-100 relative group/balance hover:bg-emerald-50 transition-colors">
                                    <span className="block text-[10px] font-black tracking-[0.2em] text-emerald-600/70 uppercase mb-4">Paid Holidays</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-outfit font-black text-emerald-600 tracking-tighter">{myEmployeeData.holidaysUsed || 0}</span>
                                        <span className="text-sm font-bold text-emerald-600/50">used</span>
                                    </div>
                                    <div className="mt-4 text-[10px] font-black text-emerald-700/60 uppercase tracking-widest flex justify-between items-center bg-emerald-100/30 px-3 py-1.5 rounded-lg border border-emerald-100/50">
                                        <span>Collected:</span>
                                        <span className="text-emerald-700">{(myEmployeeData.accruedHolidays || 0) + (myEmployeeData.bonusHolidays || 0)} Days</span>
                                    </div>
                                </div>

                                {/* Emergency Leaves */}
                                <div className="p-6 rounded-3xl bg-amber-50/50 border border-amber-100 relative group/balance hover:bg-amber-50 transition-colors">
                                    <span className="block text-[10px] font-black tracking-[0.2em] text-amber-600/70 uppercase mb-4">Emergency Leaves</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-outfit font-black text-amber-600 tracking-tighter">{myEmployeeData.emergencyHolidaysUsed || 0}</span>
                                        <span className="text-sm font-bold text-amber-600/50">used</span>
                                    </div>
                                    <div className="mt-4 text-[10px] font-black text-amber-700/60 uppercase tracking-widest flex justify-between items-center bg-amber-100/30 px-3 py-1.5 rounded-lg border border-amber-100/50">
                                        <span>Remaining:</span>
                                        <span className="text-amber-700">{Math.max(0, myEmployeeData.remainingEmergencyHolidays ?? (3 - (myEmployeeData.emergencyHolidaysUsed || 0)))} Days</span>
                                    </div>
                                </div>

                                {/* Unpaid Leaves */}
                                <div className="p-6 rounded-3xl bg-slate-50/50 border border-slate-200 relative group/balance hover:bg-slate-50 transition-colors">
                                    <span className="block text-[10px] font-black tracking-[0.2em] text-slate-600/70 uppercase mb-4">Unpaid Leaves</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-outfit font-black text-slate-600 tracking-tighter">{myEmployeeData.unpaidHolidaysUsed || 0}</span>
                                        <span className="text-sm font-bold text-slate-500/50">taken</span>
                                    </div>
                                    <div className="mt-4 text-xs font-bold text-slate-500">Requires management approval</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* My Requests + Announcements — personal panels for anyone with an employee record */}
            {myEmployeeData && (
                <EmployeeDashboardPanels
                    employeeId={myEmployeeData.id}
                    userId={currentUser?.id || ''}
                    departmentId={myEmployeeData.departmentId}
                />
            )}

            {/* Workforce Insights — server-aggregated, HR/executive audience */}
            {canViewInsights && insights && (
                <DashboardInsights data={insights} />
            )}

            {/* Analytics Section */}
            {showAnalytics && analyticsData && analyticsData.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary-50 rounded-2xl text-primary-600 border border-primary-100">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight">{t('analytics_review')}</h2>
                            <p className="text-slate-500 text-sm font-medium">{t('analytics_subtitle')}</p>
                        </div>
                    </div>
                    <div className="glass-card rounded-[40px] p-2 overflow-hidden border-none shadow-premium-shadow">
                         <EvaluationAnalytics data={analyticsData} departments={analyticsDepts} />
                    </div>
                </div>
            )}

            {/* My Signature Modal */}
            <Modal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                title={t('my_signature', { defaultValue: 'My Signature' })}
            >
                <SignaturePad
                    initialValue={currentUser?.signature ?? null}
                    onSave={handleSaveSignature}
                    onCancel={() => setIsSignatureModalOpen(false)}
                    saving={isSavingSignature}
                />
            </Modal>
        </div>
    );
};

export default Dashboard;


