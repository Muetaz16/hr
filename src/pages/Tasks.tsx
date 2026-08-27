import React, { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { getHREvaluation } from '../services/hrEvaluationService';
import { isEvaluationEnabled } from '../services/evaluationPeriodService';
import type { Employee, UserRole } from '../types';
import { format } from 'date-fns';
import {
    CheckCircle2,
    ArrowRight,
    Search,
    Clock,
    User,
    AlertTriangle,
    FileSignature
} from 'lucide-react';
import { roleThemes } from '../config/roleThemes';

const TasksPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [pendingTasks, setPendingTasks] = useState<{
        emp: Employee,
        status: string,
        type: 'evaluation' | 'contract',
        id: string,
        data?: any
    }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const currentMonth = format(new Date(), 'yyyy-MM');
    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    useEffect(() => {
        fetchTasks();
    }, [currentUser]);

    const fetchTasks = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // 1. Fetch Employees based on scope
            let emps: Employee[] = [];
            if (currentUser.role === 'HEAD_DIRECTOR') {
                if (currentUser.departmentIds && currentUser.departmentIds.length > 0) {
                    const all = await employeeService.getAllEmployees();
                    emps = all.filter(e => currentUser.departmentIds?.includes(e.departmentId));
                } else if (currentUser.departmentId) {
                    emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
                } else if (currentUser.groupId) {
                    emps = await employeeService.getEmployeesByGroup(currentUser.groupId);
                }
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
            } else if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL') {
                emps = await employeeService.getAllEmployees();
            }

            // 2. Check Evaluation Status for each
            const evalPromises = emps.map(async (emp) => {
                // Check if evaluation is enabled for this department/month
                const isEnabled = await isEvaluationEnabled(currentMonth, emp.departmentId);
                if (!isEnabled && currentUser.role !== 'SUPER_ADMIN') return null;

                const dirEval = await evaluationService.getDirectorEvaluation(emp.id, currentMonth);
                let isPending = false;
                let status = '';

                if (currentUser.role === 'HEAD_DIRECTOR' || currentUser.role === 'SUPER_ADMIN') {
                    // Only show to Director if Department assessment is done
                    const deptEval = await evaluationService.getDeptEvaluation(emp.id, currentMonth);
                    if (deptEval && (!dirEval || !dirEval.locked)) {
                        isPending = true;
                        status = t('final_approval_needed');
                    }
                } else if (currentUser.role === 'HEAD_DEPARTMENT') {
                    // Only show to Dept Head if HR assessment is done
                    const hrEval = await getHREvaluation(emp.id, currentMonth);
                    const deptEval = await evaluationService.getDeptEvaluation(emp.id, currentMonth);
                    if (hrEval && !deptEval) {
                        isPending = true;
                        status = t('department_assessment_needed');
                    }
                } else if (currentUser.role === 'PERSONNEL') {
                    const persEval = await evaluationService.getPersonnelEvaluation(emp.id, currentMonth);
                    if (!persEval) {
                        isPending = true;
                        status = t('personnel_review_pending');
                    }
                }

                if (isPending) {
                    return { emp, status, type: 'evaluation' as const, id: `eval-${emp.id}` };
                }
                return null;
            });

            // 3. Fetch Urgent Contracts (only for HR/Admin/Personnel)
            let contractTasks: any[] = [];
            if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL') {
                try {
                    const urgentContracts = await employeeService.getExpiringContracts(7);
                    contractTasks = urgentContracts.map(emp => ({
                        emp,
                        status: t('renewal_alert_title', { defaultValue: 'Contract Renewal Required' }),
                        type: 'contract' as const,
                        id: `contract-${emp.id}`
                    }));
                } catch (contractError: any) {
                    console.warn('[Tasks] Could not fetch urgent contracts:', contractError?.response?.status, contractError?.message);
                }
            }

            const evalResults = await Promise.all(evalPromises);
            const evaluationTasks = evalResults.filter((t): t is any => t !== null);

            setPendingTasks([...evaluationTasks, ...contractTasks]);

        } catch (error) {
            console.error("Error fetching tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (task: any) => {
        if (task.type === 'contract') {
            navigate(`/contracts/${task.emp.id}`);
        } else {
            navigate('/evaluations');
        }
    };

    const filteredTasks = pendingTasks.filter(t =>
        t.emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${theme.primary}`}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-[slideIn_0.5s_ease-out_forwards] max-w-6xl mx-auto py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/20">
                <div>
                    <h1 className="text-4xl font-outfit font-bold text-slate-800 tracking-tight">{t('my_tasks_title')}</h1>
                    <p className="text-slate-500 mt-2 font-light text-lg">
                        <Trans
                            i18nKey="my_tasks_subtitle"
                            count={pendingTasks.length}
                            values={{
                                date: format(new Date(), 'MMMM yyyy'),
                                count: pendingTasks.length
                            }}
                            components={{
                                1: <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md" />
                            }}
                        />
                    </p>
                </div>
                <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <input
                        type="text"
                        placeholder={t('search_tasks_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-6 py-3 bg-white/50 backdrop-blur-sm border border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100/50 focus:bg-white transition-all w-full md:w-72 shadow-sm relative z-0"
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => {
                        const { emp, status, type, id } = task;
                        const isContract = type === 'contract';
                        return (
                            <div key={id} className="glass-card p-1 rounded-3xl hover:shadow-2xl transition-all duration-300 group">
                                <div className="bg-white/40 backdrop-blur-sm p-5 rounded-[20px] flex items-center justify-between border border-white/50 group-hover:bg-white/60 transition-colors">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-md
                                            ${isContract ? 'bg-rose-500/10 text-red-400 border border-rose-500/25 shadow-rose-950/20' :
                                                'bg-gradient-to-br from-[#541c2c] to-[#aa7a51] text-[#e3c4a2] shadow-[#300a15]/50'}
                                        `}>
                                            {isContract ? <FileSignature className="w-8 h-8" /> : emp.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-800 mb-1">{emp.fullName}</h3>
                                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                <span className="flex items-center px-2 py-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
                                                    <User className="w-3 h-3 mr-1.5" /> {emp.staffId || 'ID: N/A'}
                                                </span>
                                                {isContract ? (
                                                    <span className="flex items-center text-red-500 px-2 py-1 bg-red-50/50 rounded-lg border border-red-100/50">
                                                        <AlertTriangle className="w-3 h-3 mr-1.5" /> {t('urgent')}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-orange-500 px-2 py-1 bg-orange-50/50 rounded-lg border border-orange-100/50">
                                                        <Clock className="w-3 h-3 mr-1.5" /> {t('due_soon')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="text-right hidden sm:block">
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('status_label')}</span>
                                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                                                isContract ? 'bg-red-50 text-red-700 border-red-100' :
                                                'bg-indigo-50 text-indigo-700 border-indigo-100'
                                            }`}>
                                                {status}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleAction(task)}
                                            className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg 
                                                ${isContract ? 'bg-red-600 shadow-red-900/20 group-hover:bg-red-700' : 'bg-slate-900 shadow-slate-900/20 group-hover:bg-indigo-600 group-hover:shadow-indigo-500/30'}
                                            `}
                                        >
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-24 glass-card rounded-3xl border border-dashed border-slate-200/50 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('all_caught_up_title')}</h3>
                        <p className="text-slate-400 max-w-sm mx-auto">{t('all_caught_up_subtitle')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TasksPage;
