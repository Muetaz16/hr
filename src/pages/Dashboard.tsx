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
    Clock,
    CheckCircle2,
    Activity,
    Building2,
    Briefcase,
    BarChart3,
    Plane,
    ShieldCheck,
    PenTool
} from 'lucide-react';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { timeService } from '../services/timeService';
import { departmentService, groupService } from '../services/departmentService';
import { unitService } from '../services/unitService';
import { staffHubService } from '../services/staffHubService';
import { getHREvaluation } from '../services/hrEvaluationService';
import { isEvaluationEnabled } from '../services/evaluationPeriodService';

import { useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import EvaluationAnalytics from '../components/EvaluationAnalytics';
import ContractNotifications from '../components/ContractNotifications';
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

            const [emps, depts, groups, units, _timeRecords, expiringSoonList, staffTaskCount] = await Promise.all([
                isManager ? employeeService.getAllEmployees().catch(() => []) : Promise.resolve([]),
                departmentService.getAllDepartments().catch(() => []),
                groupService.getAllGroups().catch(() => []),
                unitService.getAllUnits().catch(() => []),
                // Only fetch time records for Admin/HR
                (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER')
                    ? timeService.getTimeRecordsByMonth(currentMonth).catch(() => [])
                    : Promise.resolve([]),
                (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL' || currentUser.permissions?.includes('view_lifecycle') || currentUser.permissions?.includes('manage_lifecycle_control'))
                    ? employeeService.getExpiringContracts(7).catch(() => [])
                    : Promise.resolve([]),
                // Fetch Staff Tasks & Employee Record for the current user
                (async () => {
                    try {
                        const me = await employeeService.getMyEmployeeRecord();
                        if (me) {
                            const myTasks = await staffHubService.getMyTasks(currentUser.id, me.departmentId);
                            return {
                                count: myTasks.filter((t: any) => t.status !== 'COMPLETED').length,
                                employee: me
                            };
                        }
                        return { count: 0, employee: null };
                    } catch { return { count: 0, employee: null }; }
                })()
            ]);

            const userTaskData: any = staffTaskCount;
            const myEmployeeData = userTaskData.employee;
            const actualTaskCount = userTaskData.count;

            // const urgentContractsCount = (expiringSoonList as any[]).length;

            // Filter employees based on scope
            let scopedEmps = emps;
            if (currentUser.role === 'HEAD_DIRECTOR') {
                if (myEmployeeData?.directorateId) {
                    scopedEmps = emps.filter(e => e.directorateId === myEmployeeData.directorateId);
                } else if (currentUser.departmentIds && currentUser.departmentIds.length > 0) {
                    scopedEmps = emps.filter(e => currentUser.departmentIds?.includes(e.departmentId));
                } else if (currentUser.departmentId) {
                    scopedEmps = emps.filter(e => e.departmentId === currentUser.departmentId);
                } else if (currentUser.groupId) {
                    scopedEmps = emps.filter(e => e.groupId === currentUser.groupId);
                }
            } else if (currentUser.role === 'HEAD_DIVISION') {
                if (myEmployeeData?.divisionId) {
                    scopedEmps = emps.filter(e => e.divisionId === myEmployeeData.divisionId);
                } else {
                    scopedEmps = [];
                }
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                scopedEmps = emps.filter(e => e.departmentId === currentUser.departmentId);
            } else if (currentUser.role === 'HEAD_UNIT' && (currentUser as any).unitId) {
                scopedEmps = emps.filter(e => e.unitId === (currentUser as any).unitId);
            }

            // Analytics Data Preparation (Only for Super Admin / HR)
            let analyticsData: any[] = [];
            let analyticsDepts: string[] = [];
            const showAnalytics = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER';

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
            } else if (currentUser.role === 'PERSONNEL') {
                positionName = 'Personnel Officer';
                managedEntity = 'Human Resources';
                myGroup = 'Human Resources IPH SYSTEM';
                myDept = 'Corporate Administration';
            }

            // Refined Pending Counts
            let totalPendingAction = evaluationPendingCount + (actualTaskCount as number);
            
            if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL') {
                totalPendingAction += (expiringSoonList as any[]).length;
            }

            const stats = [
                { label: t('active_employees'), value: scopedEmps.length.toString(), icon: Users, change: t('current'), color: 'text-primary-600', bg: 'bg-primary-50', visible: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT'], permission: 'view_employees' },
                { label: 'Evaluation Ratio', value: `${evalPercent}%`, icon: CheckCircle2, change: `${finishedEvals}/${scopedEmps.length}`, color: 'text-green-600', bg: 'bg-green-50', visible: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT'], permission: 'view_evaluations' },
                { label: 'Evaluations Awaiting', value: evaluationPendingCount.toString(), icon: FileText, change: 'Action Required', color: 'text-orange-600', bg: 'bg-orange-50', visible: ['HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL'], permission: 'view_hr_evaluations' },
                { label: 'System Alerts', value: totalPendingAction.toString(), icon: Activity, change: 'Critical', color: 'text-red-600', bg: 'bg-red-50', visible: ['SUPER_ADMIN', 'HR_MANAGER'], permission: 'manage_users' },
            ].filter(s => 
                (!s.visible || s.visible.includes(currentUser.role)) || 
                (s.permission && currentUser.permissions?.includes(s.permission))
            );

            return {
                stats,
                orgInfo: { department: myDept, group: myGroup, positionName, managedEntity },
                analyticsData,
                analyticsDepts,
                myEmployeeData
            };
        },
        enabled: !!currentUser,
    });

    const stats = data?.stats || [];
    const orgInfo = data?.orgInfo || { department: '', group: '', positionName: '', managedEntity: '' };
    const { positionName, managedEntity } = orgInfo;
    const analyticsData = data?.analyticsData || [];
    const analyticsDepts = data?.analyticsDepts || [];
    const myEmployeeData = data?.myEmployeeData || null;

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

    const pendingReviewCount = stats[3]?.value || '0';
    const showAnalytics = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER';

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

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-12">
            {/* Hero Welcome Section */}
            <div className={`relative overflow-hidden rounded-[40px] bg-gradient-to-br ${theme.gradient} p-10 lg:p-16 text-white shadow-2xl shadow-primary-600/15 group border border-white/10`}>
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-10 transition-opacity duration-1000"></div>
                
                {/* Animated Background Shapes */}
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-white/10 blur-3xl rounded-full animate-pulse transition-all duration-1000 group-hover:scale-110"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-80 h-80 bg-black/10 blur-[100px] rounded-full"></div>

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
                        
                        <p className="text-white/80 text-xl leading-relaxed mb-10 font-medium max-w-lg">
                            {t('dashboard_update_msg')}
                            <span className="block mt-2 text-white font-bold cursor-pointer hover:text-primary-100 transition-colors inline-flex items-center gap-2 group/msg" onClick={() => navigate('/approvals')}>
                                {pendingReviewCount !== '...' ? pendingReviewCount : '0'} {t('pending_notifications')}
                                <ArrowRight className="w-5 h-5 group-hover/msg:translate-x-1 transition-transform" />
                            </span>
                        </p>

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
                        className="glass-card p-8 rounded-[32px] hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden"
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
                    </div>
                ))}
            </div>

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
                                
                                {myEmployeeData.contractEndDate && (
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Remaining</span>
                                            <span className={`text-lg font-black ${differenceInDays(new Date(myEmployeeData.contractEndDate), new Date()) < 30 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {Math.max(0, differenceInDays(new Date(myEmployeeData.contractEndDate), new Date()))} Days
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            {/* Decorative progress bar, can be computed based on total duration in future */}
                                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: '75%' }}></div>
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
                                        <span>Collected:</span>
                                        <span className="text-amber-700">3 Days</span>
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

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <section className="lg:col-span-2 glass-card rounded-[40px] p-10 relative group overflow-hidden border-none shadow-premium-shadow">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-primary-50/50 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none group-hover:bg-blue-100/50 transition-colors duration-1000"></div>

                    <div className="flex items-center justify-between mb-10 relative z-10">
                        <div>
                            <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight">{t('organization_profile')}</h2>
                            <p className="text-slate-500 text-sm font-medium">{t('organization_subtitle')}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <TrendingUp className="w-6 h-6 text-slate-400" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        {[
                            { label: t('department'), val: orgInfo.department, sub: 'Global Corporate Center', icon: Building2, color: 'from-blue-500 to-indigo-600' },
                            { label: t('group_membership'), val: orgInfo.group, sub: 'Operation & Strategy Unit', icon: Briefcase, color: 'from-purple-500 to-fuchsia-600' }
                        ].map((box, bIdx) => (
                            <div key={bIdx} className="p-8 bg-white/60 backdrop-blur-xl rounded-[32px] border border-white/60 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-500 group/box">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5">{box.label}</span>
                                <div className="flex items-center">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${box.color} text-white flex items-center justify-center mr-5 shadow-xl group-hover/box:rotate-6 transition-all duration-500`}>
                                        <box.icon className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="font-extrabold text-slate-800 text-xl tracking-tight leading-tight mb-1">{box.val}</p>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider opacity-60">{box.sub}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl border border-white/10 group">
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="mb-10">
                            <h2 className="text-2xl font-outfit font-black tracking-tight">{t('quick_actions')}</h2>
                            <p className="text-slate-400 text-sm font-medium">{t('quick_actions_subtitle')}</p>
                        </div>

                        <div className="mb-10 group-hover:scale-[1.02] transition-transform duration-500">
                            {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER') && (
                                <ContractNotifications />
                            )}
                        </div>

                        <div className="space-y-4 flex-1">
                            {[
                                { label: t('schedule_meeting'), icon: Calendar, color: 'bg-indigo-500/10 text-indigo-400' },
                                { label: t('log_time_manually'), icon: Clock, color: 'bg-orange-500/10 text-orange-400' },
                                { label: t('employee_search'), icon: Users, color: 'bg-emerald-500/10 text-emerald-400' }
                            ].map((btn, bIdx) => (
                                <button key={bIdx} className="w-full p-5 bg-white/5 hover:bg-white/10 rounded-[24px] transition-all text-left flex items-center group/act font-bold border border-white/5 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]">
                                    <div className={`p-3 rounded-xl mr-5 group-hover/act:scale-110 transition-transform ${btn.color}`}>
                                        <btn.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-slate-300 group-hover/act:text-white transition-colors">{btn.label}</span>
                                    <ArrowRight className="ml-auto w-5 h-5 opacity-0 group-hover/act:opacity-100 transition-all group-hover/act:translate-x-1 text-slate-500" />
                                </button>
                            ))}
                        </div>

                        <div className="mt-12 pt-8 border-t border-white/10">
                            <div className="flex items-center text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-5">
                                {t('system_status')}
                            </div>
                            <div className="flex items-center bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-xl">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-4 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse"></div>
                                <span className="text-sm font-bold text-slate-200 tracking-tight">{t('systems_operational')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Decorative element */}
                    <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-primary-500/10 blur-[100px] rounded-full group-hover:bg-primary-500/20 transition-colors duration-1000"></div>
                </section>
            </div>

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


