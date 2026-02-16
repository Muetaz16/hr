import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import type { Employee, UserRole } from '../types';
import { format } from 'date-fns';
import {
    CheckCircle2,
    ArrowRight,
    Search,
    Clock,
    User
} from 'lucide-react';
import { roleThemes } from '../config/roleThemes';

const TasksPage: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [pendingTasks, setPendingTasks] = useState<{ emp: Employee, status: string }[]>([]);
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
            if (currentUser.role === 'HEAD_DIRECTOR' && currentUser.groupId) {
                emps = await employeeService.getEmployeesByGroup(currentUser.groupId);
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
            } else if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL') {
                emps = await employeeService.getAllEmployees();
            }

            // 2. Check Evaluation Status for each

            // Optimization: Fetch all evaluations for the month once if possible, but for now loop is safer for logic
            // Actually, let's fetch in parallel batches for speed
            const evalPromises = emps.map(async (emp) => {
                const dirEval = await evaluationService.getDirectorEvaluation(emp.id, currentMonth);
                // If no Director Eval or not locked, it's pending for Director
                // If Dept Eval missing, it's pending for Dept Head

                let isPending = false;
                let status = '';

                if (currentUser.role === 'HEAD_DIRECTOR' || currentUser.role === 'SUPER_ADMIN') {
                    if (!dirEval || !dirEval.locked) {
                        isPending = true;
                        status = 'Final Approval Needed';
                    }
                } else if (currentUser.role === 'HEAD_DEPARTMENT') {
                    const deptEval = await evaluationService.getDeptEvaluation(emp.id, currentMonth);
                    if (!deptEval) {
                        isPending = true;
                        status = 'Department Assessment Needed';
                    }
                } else if (currentUser.role === 'PERSONNEL') {
                    const persEval = await evaluationService.getPersonnelEvaluation(emp.id, currentMonth);
                    if (!persEval) { // Personnel can edit anytime, but let's show "Todo" if not done? Or maybe always "Open"?
                        // Let's assume one record per month is the goal.
                        isPending = true;
                        status = 'Personnel Review Pending';
                    }
                }

                if (isPending) {
                    return { emp, status };
                }
                return null;
            });

            const results = await Promise.all(evalPromises);
            setPendingTasks(results.filter((t): t is { emp: Employee, status: string } => t !== null));

        } catch (error) {
            console.error("Error fetching tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = () => {
        navigate('/evaluations');
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
                    <h1 className="text-4xl font-outfit font-bold text-slate-800 tracking-tight">My Tasks</h1>
                    <p className="text-slate-500 mt-2 font-light text-lg">
                        You have <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{pendingTasks.length} pending items</span> for {format(new Date(), 'MMMM yyyy')}
                    </p>
                </div>
                <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-6 py-3 bg-white/50 backdrop-blur-sm border border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100/50 focus:bg-white transition-all w-full md:w-72 shadow-sm relative z-0"
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {filteredTasks.length > 0 ? (
                    filteredTasks.map(({ emp, status }) => (
                        <div key={emp.id} className="glass-card p-1 rounded-3xl hover:shadow-2xl transition-all duration-300 group">
                            <div className="bg-white/40 backdrop-blur-sm p-5 rounded-[20px] flex items-center justify-between border border-white/50 group-hover:bg-white/60 transition-colors">
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner
                                        ${theme === roleThemes.EMPLOYEE ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}
                                    `}>
                                        {emp.fullName.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800 mb-1">{emp.fullName}</h3>
                                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                            <span className="flex items-center px-2 py-1 bg-slate-100/50 rounded-lg border border-slate-200/50">
                                                <User className="w-3 h-3 mr-1.5" /> {emp.staffId || 'ID: N/A'}
                                            </span>
                                            <span className="flex items-center text-orange-500 px-2 py-1 bg-orange-50/50 rounded-lg border border-orange-100/50">
                                                <Clock className="w-3 h-3 mr-1.5" /> Due Soon
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-right hidden sm:block">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</span>
                                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                            {status}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAction()}
                                        className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-slate-900/20 group-hover:bg-indigo-600 group-hover:shadow-indigo-500/30"
                                    >
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-24 glass-card rounded-3xl border border-dashed border-slate-200/50 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">All Caught Up!</h3>
                        <p className="text-slate-400 max-w-sm mx-auto">You have no pending evaluations to review for this month. Great job!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TasksPage;
