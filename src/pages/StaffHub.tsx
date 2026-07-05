import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { staffHubService } from '../services/staffHubService';
import type { LeaveRequest, StaffTask, Announcement } from '../services/staffHubService';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import {
    Bell,
    Calendar,
    Clock,
    MessageSquare,
    Send,
    ClipboardList,
    Plus,
    X,
    User,
    CheckCircle2,
    Edit,
    Trash2,
    Megaphone,
    Search,
    ArrowRight,
    Activity,
    CheckCircle,
    Eye,
    ChevronRight,
    History
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Employee, Department } from '../types';

const StaffHub: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<StaffTask[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [potentialAssignees, setPotentialAssignees] = useState<Employee[]>([]);
    const [taskSearch, setTaskSearch] = useState('');
    const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

    const managerRoles = ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'];
    const isManager = managerRoles.includes(currentUser?.role || '');

    // Form States
    const [newRequest, setNewRequest] = useState({
        type: 'PAID_HOLIDAY',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        startTime: '',
        endTime: '',
        reason: ''
    });

    const [newTask, setNewTask] = useState({
        title: '',
        content: '',
        assigneeId: '',
        priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL',
        deadline: format(new Date(), 'yyyy-MM-dd'),
        category: 'ASSIGNED' as 'ASSIGNED' | 'SELF_REPORT'
    });

    useEffect(() => {
        if (currentUser) {
            fetchInitialData();
        }
    }, [currentUser]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Find employee record for current user directly
            const me = await employeeService.getMyEmployeeRecord();
            if (me) {
                setEmployeeId(me.id);
                const deptId = me.departmentId || 'undefined';

                // Fetch tasks, announcements, and requests in parallel
                const [taskData, announceData, requestData] = await Promise.all([
                    staffHubService.getMyTasks(currentUser!.id, deptId),
                    isManager ? staffHubService.getAllAnnouncements() : staffHubService.getAnnouncements(currentUser!.id, deptId),
                    staffHubService.getMyRequests(me.id)
                ]).catch(err => {
                    console.error("Dashboard partial load failure:", err);
                    return [[], [], []];
                });

                setTasks(taskData);
                setAnnouncements(announceData);
                setRequests(requestData);

                // Fetch potential assignees and departments for managers separately
                if (isManager) {
                    Promise.all([
                        employeeService.getAllEmployees(),
                        departmentService.getAllDepartments()
                    ]).then(([emps, depts]) => {
                        let filteredEmps = emps.filter(e => e.userId && e.userId !== currentUser!.id);

                        // General Manager (HEAD_DIRECTOR) should only assign to Heads
                        if (currentUser!.role === 'HEAD_DIRECTOR') {
                            const headRoles = ['HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER'];
                            filteredEmps = filteredEmps.filter(e => headRoles.includes(e.role));
                        } else if (currentUser!.role === 'HEAD_DIVISION') {
                            // Head of Division assigns to Heads within their division
                            const headRoles = ['HEAD_DEPARTMENT', 'HEAD_UNIT'];
                            filteredEmps = filteredEmps.filter(e => headRoles.includes(e.role) && e.divisionId === me.divisionId);
                        }

                        // Get team members for status monitor
                        let myTeam: Employee[] = [];
                        if (currentUser?.role === 'HEAD_DEPARTMENT') {
                            myTeam = emps.filter(e => e.departmentId === me.departmentId && e.id !== me.id);
                        } else if (currentUser?.role === 'HEAD_UNIT') {
                            myTeam = emps.filter(e => e.unitId === me.unitId && e.id !== me.id);
                        } else if (currentUser?.role === 'HEAD_DIVISION') {
                            myTeam = emps.filter(e => e.divisionId === me.divisionId && e.id !== me.id && ['HEAD_DEPARTMENT', 'HEAD_UNIT'].includes(e.role));
                        } else if (currentUser?.role === 'HEAD_DIRECTOR') {
                            myTeam = emps.filter(e => currentUser.departmentIds?.includes(e.departmentId || ''));
                        } else if (['SUPER_ADMIN', 'HR_MANAGER'].includes(currentUser?.role || '')) {
                            myTeam = emps.filter(e => e.id !== me.id);
                        }
                        
                        setTeamMembers(myTeam);
                        setPotentialAssignees(filteredEmps);
                        setDepartments(depts);
                    }).catch(err => {
                        console.error("Failed to load management data:", err);
                    });
                }
            }
        } catch (error) {
            console.error("Dashboard critical failure:", error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId || !currentUser) return;

        try {
            await staffHubService.createRequest({
                ...newRequest,
                employeeId,
                userId: currentUser.id
            });
            toast.success('Request submitted successfully');
            setShowRequestModal(false);
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to submit request');
        }
    };

    const handleSubmitTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        try {
            await staffHubService.createTask(newTask);
            toast.success(newTask.category === 'SELF_REPORT' ? t('status_updated') : t('task_assigned_success'));
            setShowTaskModal(false);
            setShowStatusModal(false);
            setNewTask({
                title: '',
                content: '',
                assigneeId: '',
                priority: 'NORMAL',
                deadline: format(new Date(), 'yyyy-MM-dd'),
                category: 'ASSIGNED'
            });
            fetchInitialData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save task');
        }
    };

    const handleReviewTask = async (taskId: string) => {
        try {
            await staffHubService.reviewTask(taskId);
            toast.success(t('task_reviewed'));
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to review task');
        }
    };


    const updateTaskStatus = async (taskId: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED';
        try {
            await staffHubService.updateTaskStatus(taskId, nextStatus);
            toast.success('Task updated');
            fetchInitialData();
        } catch (error) {
            toast.error('Failed to update task');
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading Staff Hub...</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
             {/* Header */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                     <h1 className="text-3xl font-bold text-white tracking-tight">Staff Hub</h1>
                     <p className="text-[#e3c4a2]/70">Everything you need in one place.</p>
                 </div>
                 <div className="flex gap-3">
                     {(isManager || currentUser?.permissions?.includes('manage_leaves')) && (
                         <button
                             onClick={() => navigate('/approvals')}
                             className="flex items-center gap-2 bg-[#300a15] text-[#e3c4a2] border border-[#e3c4a2]/15 px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-[#541c2c]/40 hover:scale-[1.02] transition-all active:scale-95"
                         >
                             <ClipboardList className="w-5 h-5" />
                             Approvals
                         </button>
                     )}
                     {(isManager || currentUser?.permissions?.includes('manage_tasks')) && (
                         <button
                             onClick={() => setShowTaskModal(true)}
                             className="flex items-center gap-2 bg-gradient-to-r from-[#e3c4a2] to-[#d4aa80] text-[#300a15] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#d4aa80]/20 hover:scale-[1.02] transition-all active:scale-95"
                         >
                             <Plus className="w-5 h-5" />
                             Assign Task
                         </button>
                     )}
                     {(isManager || currentUser?.permissions?.includes('manage_announcements')) && (
                         <button
                             onClick={() => {
                                 setEditingAnnouncement(null);
                                 setNewAnnouncement({ title: '', content: '', targetType: 'GLOBAL', targetId: '', expiryDate: '' });
                                 setShowAnnouncementModal(true);
                             }}
                             className="flex items-center gap-2 bg-[#541c2c]/40 text-[#e3c4a2]/80 border border-[#e3c4a2]/15 px-6 py-3 rounded-2xl font-bold hover:bg-[#541c2c]/75 hover:text-white transition-all active:scale-95"
                         >
                             <Megaphone className="w-5 h-5" />
                             Post Notice
                         </button>
                     )}
                     <button
                         onClick={() => setShowRequestModal(true)}
                         className="flex items-center gap-2 bg-[#aa7a51] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#aa7a51]/25 hover:bg-[#aa7a51]/85 transition-all active:scale-95"
                     >
                         <Plus className="w-5 h-5" />
                         New Request
                     </button>
                 </div>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Announcements & Tasks */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Notice Board */}
                    <section className="glass-card p-6 rounded-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                            <Bell className="w-24 h-24 text-indigo-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-indigo-500" />
                            Notice Board
                        </h2>
                        <div className="space-y-4">
                            {announcements.length > 0 ? announcements.map(ann => (
                                <div key={ann.id} className="p-5 bg-white/50 border border-white/60 rounded-2xl hover:bg-white/80 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-slate-800">{ann.title}</h3>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {isManager && (
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEditAnnouncement(ann)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAnnouncement(ann.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                                {format(new Date(ann.createdAt), 'MMM dd')}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                                </div>
                            )) : (
                                <div className="text-center py-12 text-slate-400 font-medium">No active announcements</div>
                            )}
                        </div>
                    </section>

                    {/* Task Tracker & Status Updates */}
                    <div className="space-y-8">
                        {/* Status Updates (Self-Report) */}
                        <section className="glass-card p-6 rounded-3xl relative overflow-hidden group border-none shadow-premium-shadow bg-white/40 backdrop-blur-3xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 rounded-xl">
                                        <Activity className="w-6 h-6 text-indigo-500" />
                                    </div>
                                    {t('current_work')}
                                </h2>
                                <button
                                    onClick={() => {
                                        setNewTask({ ...newTask, category: 'SELF_REPORT', title: '', content: '' });
                                        setShowStatusModal(true);
                                    }}
                                    className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    {t('start_new_task')}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Currently Working On */}
                                <div className="space-y-3">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        {t('working_on')}
                                    </span>
                                    {tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'IN_PROGRESS') ? (
                                        <div className="p-5 bg-white/60 border border-indigo-100 rounded-2xl shadow-sm hover:shadow-md transition-all border-l-4 border-l-indigo-500">
                                            <h3 className="font-bold text-slate-800 mb-1">{tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'IN_PROGRESS')?.title}</h3>
                                            <p className="text-xs text-slate-500 line-clamp-2 mb-4">{tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'IN_PROGRESS')?.content}</p>
                                            <button
                                                onClick={() => updateTaskStatus(tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'IN_PROGRESS')!.id, 'IN_PROGRESS')}
                                                className="w-full py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                {t('complete_task', { defaultValue: 'Finish Task' })}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                                            <Plus className="w-8 h-8 mb-2 opacity-20" />
                                            <span className="text-xs font-medium">{t('no_active_task', { defaultValue: 'No active task' })}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Last Completed */}
                                <div className="space-y-3">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <History className="w-3.5 h-3.5" />
                                        {t('last_task_done')}
                                    </span>
                                    {tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'COMPLETED') ? (
                                        <div className="p-5 bg-slate-50/50 border border-slate-100 rounded-2xl opacity-80">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-slate-700">{tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'COMPLETED')?.title}</h3>
                                                {tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'COMPLETED')?.isReviewed && (
                                                    <span className="text-[8px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                        <CheckCircle className="w-2.5 h-2.5" />
                                                        {t('reviewed')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 line-clamp-2">{tasks.find(t => t.assigneeId === currentUser?.id && t.category === 'SELF_REPORT' && t.status === 'COMPLETED')?.content}</p>
                                        </div>
                                    ) : (
                                        <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                                            <History className="w-8 h-8 mb-2 opacity-20" />
                                            <span className="text-xs font-medium">{t('no_completed_tasks', { defaultValue: 'No completed tasks' })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Kanban Board (Assigned Tasks) */}
                        <section className="glass-card p-6 rounded-3xl relative overflow-hidden group border-none shadow-premium-shadow bg-white/40 backdrop-blur-3xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 rounded-xl">
                                        <ClipboardList className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    {t('assigned_tasks')}
                                </h2>
                                <div className="relative group/search">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={t('search_tasks_placeholder')}
                                        value={taskSearch}
                                        onChange={(e) => setTaskSearch(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-white/50 border border-white/60 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 transition-all w-48 shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-x-auto pb-4 scrollbar-hide">
                                {/* TO DO */}
                                <KanbanColumn
                                    title={t('kanban_todo')}
                                    color="slate"
                                    tasks={tasks.filter(t => t.assigneeId === currentUser?.id && t.category === 'ASSIGNED' && t.status === 'PENDING' && t.title.toLowerCase().includes(taskSearch.toLowerCase()))}
                                    onAction={(task) => updateTaskStatus(task.id, 'PENDING')}
                                    onView={(task) => { setSelectedTask(task); setShowDetailModal(true); }}
                                    actionLabel={t('start_task', { defaultValue: 'Start' })}
                                />
                                {/* IN PROGRESS */}
                                <KanbanColumn
                                    title={t('kanban_inprogress')}
                                    color="indigo"
                                    tasks={tasks.filter(t => t.assigneeId === currentUser?.id && t.category === 'ASSIGNED' && t.status === 'IN_PROGRESS' && t.title.toLowerCase().includes(taskSearch.toLowerCase()))}
                                    onAction={(task) => updateTaskStatus(task.id, 'IN_PROGRESS')}
                                    onView={(task) => { setSelectedTask(task); setShowDetailModal(true); }}
                                    actionLabel={t('complete_task', { defaultValue: 'Done' })}
                                />
                                {/* DONE */}
                                <KanbanColumn
                                    title={t('kanban_done')}
                                    color="emerald"
                                    tasks={tasks.filter(t => t.assigneeId === currentUser?.id && t.category === 'ASSIGNED' && t.status === 'COMPLETED' && t.title.toLowerCase().includes(taskSearch.toLowerCase()))}
                                    onView={(task) => { setSelectedTask(task); setShowDetailModal(true); }}
                                    actionLabel={t('archived', { defaultValue: 'Archived' })}
                                />
                            </div>
                        </section>

                        {/* Team Status Monitor (For Managers) */}
                        {isManager && teamMembers.length > 0 && (
                            <section className="glass-card p-6 rounded-3xl relative overflow-hidden group border-none shadow-premium-shadow bg-white/40 backdrop-blur-3xl">
                                <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight flex items-center gap-3 mb-8">
                                    <div className="p-2 bg-blue-50 rounded-xl">
                                        <Activity className="w-6 h-6 text-blue-500" />
                                    </div>
                                    {t('team_status_monitor')}
                                </h2>
                                <div className="space-y-4">
                                    {teamMembers.map(member => {
                                        const memberTasks = tasks.filter(t => t.assigneeId === member.userId && t.category === 'SELF_REPORT');
                                        const current = memberTasks.find(t => t.status === 'IN_PROGRESS');
                                        const last = memberTasks.find(t => t.status === 'COMPLETED');
                                        
                                        return (
                                            <div key={member.id} className="p-4 bg-white/60 border border-white/80 rounded-[2rem] hover:shadow-lg transition-all flex flex-col md:flex-row md:items-center gap-6">
                                                <div className="flex items-center gap-4 min-w-[200px]">
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#541c2c] to-[#aa7a51] flex items-center justify-center font-black text-[#e3c4a2] shadow-md shadow-[#300a15]/50">
                                                        {member.fullName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{member.fullName}</h4>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{member.position || member.role}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{t('working_on')}</span>
                                                        {current ? (
                                                            <p className="text-xs font-bold text-slate-700 line-clamp-1">{current.title}</p>
                                                        ) : (
                                                            <span className="text-xs text-slate-300 italic">{t('no_active_task')}</span>
                                                        )}
                                                    </div>
                                                    <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                                                        <div>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{t('last_task_done')}</span>
                                                            {last ? (
                                                                <p className="text-xs font-bold text-slate-600 line-clamp-1">{last.title}</p>
                                                            ) : (
                                                                <span className="text-xs text-slate-300 italic">{t('no_completed_tasks')}</span>
                                                            )}
                                                        </div>
                                                        {last && !last.isReviewed && (
                                                            <button
                                                                onClick={() => handleReviewTask(last.id)}
                                                                className="ml-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                                                            >
                                                                {t('review_work')}
                                                            </button>
                                                        )}
                                                        {last?.isReviewed && (
                                                            <div className="text-blue-500 flex items-center gap-1">
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    onClick={() => {
                                                        setTaskSearch(member.fullName); // Simple filter hack
                                                    }}
                                                    className="p-3 bg-slate-50 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-indigo-600"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                {/* Right Column: Request History */}
                <div className="space-y-8">
                    <section className="glass-card p-6 rounded-3xl h-full flex flex-col">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-500" />
                            My Requests
                        </h2>
                        <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 scrollbar-hide">
                            {requests.length > 0 ? requests.map(req => (
                                <div key={req.id} className="p-4 bg-white/40 border border-white/60 rounded-2xl space-y-2">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.type.replace(/_/g, ' ')}</span>
                                        <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' :
                                                req.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                                    req.status === 'APPROVED_BY_MANAGER' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                            }`}>
                                            {req.status.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        {format(new Date(req.startDate), 'MMM dd, yyyy')}
                                        {req.endDate && <span className="text-slate-300">→</span>}
                                        {req.endDate && format(new Date(req.endDate), 'MMM dd')}
                                    </div>
                                    {req.managerNote && (
                                        <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs italic text-slate-500 border-l-2 border-slate-200">
                                            Manager: {req.managerNote}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="text-center py-12 text-slate-400 font-medium italic">No requests yet</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Request Modal */}
            {showRequestModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">New Request</h2>
                                <p className="text-slate-500 text-sm">Fill in the details below.</p>
                            </div>
                            <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitRequest} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Request Type</label>
                                    <select
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newRequest.type}
                                        onChange={e => setNewRequest({ ...newRequest, type: e.target.value })}
                                    >
                                        <option value="PAID_HOLIDAY">Paid Holiday</option>
                                        <option value="UNPAID_LEAVE">Unpaid Leave</option>
                                        <option value="EMERGENCY_LEAVE">Emergency Leave</option>
                                        <option value="LATE_COMING">Late Coming</option>
                                        <option value="EARLY_LEAVING">Early Leaving</option>
                                        <option value="HOURS_LEAVE">Few Hours Permission</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newRequest.startDate}
                                        onChange={e => setNewRequest({ ...newRequest, startDate: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">End Date (Optional)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newRequest.endDate}
                                        onChange={e => setNewRequest({ ...newRequest, endDate: e.target.value })}
                                    />
                                </div>

                                {newRequest.type.includes('HOURS') || newRequest.type.includes('LATE') || newRequest.type.includes('EARLY') ? (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pick-up/Start Time</label>
                                            <input
                                                type="time"
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                value={newRequest.startTime}
                                                onChange={e => setNewRequest({ ...newRequest, startTime: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Return/End Time</label>
                                            <input
                                                type="time"
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                value={newRequest.endTime}
                                                onChange={e => setNewRequest({ ...newRequest, endTime: e.target.value })}
                                            />
                                        </div>
                                    </>
                                ) : null}

                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reason / Note (Optional)</label>
                                    <textarea
                                        placeholder="Add a brief note..."
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 h-24"
                                        value={newRequest.reason}
                                        onChange={e => setNewRequest({ ...newRequest, reason: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.01] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                Submit Request
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Task Modal */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                    <ClipboardList className="w-6 h-6 text-emerald-500" />
                                    Assign New Task
                                </h2>
                                <p className="text-slate-500 text-sm">Assign a task to a team member.</p>
                            </div>
                            <button onClick={() => setShowTaskModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitTask} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Task Title</label>
                                    <input
                                        type="text"
                                        placeholder="Enter task title..."
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newTask.title}
                                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assignee</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                                            value={newTask.assigneeId}
                                            onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })}
                                            required
                                        >
                                            <option value="">Select an employee...</option>
                                            {potentialAssignees.map(emp => (
                                                <option key={emp.userId} value={emp.userId}>
                                                    {emp.fullName} - {emp.position || emp.role}
                                                </option>
                                            ))}
                                        </select>
                                        <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Priority</label>
                                        <select
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                            value={newTask.priority}
                                            onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="NORMAL">Normal</option>
                                            <option value="HIGH">High</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Deadline</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                            value={newTask.deadline}
                                            onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                                    <textarea
                                        placeholder="Enter task details..."
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 h-32"
                                        value={newTask.content}
                                        onChange={e => setNewTask({ ...newTask, content: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-emerald-600 text-white py-4 rounded-3xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 hover:scale-[1.01] transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Confirm Assignment
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Task Detail Modal */}
            {showDetailModal && selectedTask && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner ${
                                    selectedTask.priority === 'CRITICAL' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                                }`}>
                                    <ClipboardList className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">{selectedTask.title}</h2>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('task_details')}</span>
                                </div>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('assigned_by')}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#541c2c] to-[#aa7a51] flex items-center justify-center text-[10px] font-black text-[#e3c4a2] shadow-sm shadow-[#300a15]/30">
                                            {selectedTask.author?.fullName?.charAt(0)}
                                        </div>
                                        <span className="text-sm font-bold text-slate-700">{selectedTask.author?.fullName}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('deadline')}</span>
                                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm">{selectedTask.deadline ? format(new Date(selectedTask.deadline), 'MMMM dd, yyyy') : 'No deadline'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('description', { defaultValue: 'Description' })}</span>
                                <div className="p-5 bg-slate-50 rounded-2xl text-slate-600 leading-relaxed whitespace-pre-wrap text-sm border border-slate-100 max-h-64 overflow-y-auto">
                                    {selectedTask.content}
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                <div className="flex gap-3">
                                    <span className={`px-4 py-1.5 rounded-xl text-xs font-bold ${
                                        selectedTask.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' : 
                                        selectedTask.priority === 'HIGH' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                        {selectedTask.priority}
                                    </span>
                                    <span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider">
                                        {selectedTask.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                {selectedTask.status !== 'COMPLETED' && (
                                    <button
                                        onClick={() => {
                                            updateTaskStatus(selectedTask.id, selectedTask.status);
                                            setShowDetailModal(false);
                                        }}
                                        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
                                    >
                                        {selectedTask.status === 'PENDING' ? t('start_task') : t('complete_task')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Modal (Self-Report) */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                                    <Activity className="w-6 h-6 text-indigo-500" />
                                    {t('start_new_task')}
                                </h2>
                                <p className="text-slate-500 text-sm">{t('replaces_previous')}</p>
                            </div>
                            <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitTask} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('working_on')}</label>
                                    <input
                                        type="text"
                                        placeholder="What are you working on right now?"
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newTask.title}
                                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('description')}</label>
                                    <textarea
                                        placeholder="Add more details if needed..."
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 h-32"
                                        value={newTask.content}
                                        onChange={e => setNewTask({ ...newTask, content: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                {t('submit_to_head', { defaultValue: 'Update Status' })}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Components for the Premium UI
const KanbanColumn: React.FC<{
    title: string;
    tasks: StaffTask[];
    color: string;
    onAction?: (task: StaffTask) => void;
    onView: (task: StaffTask) => void;
    actionLabel: string;
}> = ({ title, tasks, color, onAction, onView, actionLabel }) => {
    const { t } = useTranslation();
    return (
        <div className="min-w-[300px] flex-1 space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${color}-500 shadow-[0_0_8px] shadow-${color}-500/50`} />
                    <h3 className="font-bold text-slate-600 uppercase text-[10px] tracking-widest">{title}</h3>
                </div>
                <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md">{tasks.length}</span>
            </div>
            <div className="space-y-3 min-h-[400px]">
                {tasks.map(task => (
                    <div 
                        key={task.id} 
                        className="group bg-white/60 hover:bg-white border border-white/80 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                    >
                        {task.priority === 'CRITICAL' && (
                            <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-red-50 rounded-full opacity-50 group-hover:scale-150 transition-transform" />
                        )}
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                task.priority === 'CRITICAL' ? 'bg-red-100 text-red-600' :
                                task.priority === 'HIGH' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                                {task.priority}
                            </span>
                            <button onClick={() => onView(task)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100">
                                <Eye className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <h4 className="font-bold text-slate-800 mb-1 line-clamp-1">{task.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mb-4 leading-relaxed">{task.content}</p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                                <Clock className="w-3 h-3" />
                                {task.deadline ? format(new Date(task.deadline), 'MMM dd') : 'Soon'}
                            </div>
                            {onAction && (
                                <button
                                    onClick={() => onAction(task)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                        color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-900 text-white hover:bg-indigo-600'
                                    }`}
                                >
                                    {actionLabel}
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                        {t('no_tasks')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffHub;
