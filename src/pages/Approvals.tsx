import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { staffHubService } from '../services/staffHubService';
import type { LeaveRequest, StaffTask } from '../services/staffHubService';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import { 
    Check, 
    Send, 
    LayoutDashboard,
    Calendar,
    UserPlus,
    ClipboardList,
    Megaphone,
    XCircle,
    Archive,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const Approvals: React.FC = () => {
    const { currentUser } = useAuth();
    const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
    const [historyRequests, setHistoryRequests] = useState<LeaveRequest[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [scopedTasks, setScopedTasks] = useState<StaffTask[]>([]);
    const [taskFilter, setTaskFilter] = useState('ALL');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'requests' | 'history' | 'tasks' | 'announcements' | 'task-progress'>('requests');

    // New Task State
    const [newTask, setNewTask] = useState({
        title: '',
        content: '',
        assigneeId: '',
        departmentId: '',
        deadline: '',
        priority: 'NORMAL'
    });

    // New Announcement State
    const [newAnnounce, setNewAnnounce] = useState({
        title: '',
        content: '',
        targetType: 'GLOBAL',
        targetId: '',
        expiryDate: ''
    });

    useEffect(() => {
        fetchData();
    }, [currentUser]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let statusFilter = 'PENDING';
            if (currentUser?.role === 'HEAD_UNIT') {
                statusFilter = 'PENDING';
            } else if (currentUser?.role === 'HEAD_DEPARTMENT') {
                statusFilter = 'PENDING,APPROVED_BY_UNIT';
            } else if (currentUser?.role === 'HEAD_DIRECTOR') {
                statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT';
            } else if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER') {
                statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT,APPROVED_BY_DIRECTOR';
            }

            const [reqs, hist, emps, depts, tasks] = await Promise.all([
                staffHubService.getPendingRequests({ 
                    departmentId: currentUser?.departmentId || undefined,
                    groupId: currentUser?.groupId || undefined,
                    unitId: currentUser?.unitId || undefined,
                    status: statusFilter
                }),
                staffHubService.getPendingRequests({ 
                    departmentId: currentUser?.departmentId || undefined,
                    groupId: currentUser?.groupId || undefined,
                    unitId: currentUser?.unitId || undefined,
                    status: 'COMPLETED,REJECTED'
                }),
                employeeService.getAllEmployees(),
                departmentService.getAllDepartments(),
                staffHubService.getScopedTasks()
            ]);
            setPendingRequests(reqs);
            setHistoryRequests(hist);
            setEmployees(emps);
            setDepartments(depts);
            setScopedTasks(tasks);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestAction = async (id: string, actionType: 'APPROVE' | 'REJECT', managerNote: string = '') => {
        try {
            let status = 'REJECTED';
            if (actionType === 'APPROVE') {
                if (currentUser?.role === 'HEAD_UNIT') status = 'APPROVED_BY_UNIT';
                else if (currentUser?.role === 'HEAD_DEPARTMENT') status = 'APPROVED_BY_DEPT';
                else if (currentUser?.role === 'HEAD_DIRECTOR') status = 'APPROVED_BY_DIRECTOR';
                else status = 'COMPLETED'; // Admins can fast-track
            }

            await staffHubService.updateRequestStatus(id, { status, managerNote });
            toast.success(`Request ${status === 'REJECTED' ? 'Rejected' : 'Approved'}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await staffHubService.createTask({
                ...newTask,
                authorId: currentUser?.id,
                assigneeId: newTask.assigneeId || undefined,
                departmentId: newTask.departmentId || undefined,
                priority: newTask.priority as any
            });
            toast.success('Task assigned successfully');
            setNewTask({ title: '', content: '', assigneeId: '', departmentId: '', deadline: '', priority: 'NORMAL' });
        } catch (error) {
            toast.error('Failed to assign task');
        }
    };

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await staffHubService.createAnnouncement({
                ...newAnnounce,
                authorId: currentUser?.id,
                targetId: newAnnounce.targetId || undefined,
                targetType: newAnnounce.targetType as any
            });
            toast.success('Announcement posted');
            setNewAnnounce({ title: '', content: '', targetType: 'GLOBAL', targetId: '', expiryDate: '' });
        } catch (error) {
            toast.error('Failed to post announcement');
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading Approvals Dashboard...</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#300a15] to-[#541c2c] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-[#e3c4a2]/20">
                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                    <LayoutDashboard className="w-48 h-48" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight mb-2">Manager Control Room</h1>
                <p className="text-[#e3c4a2]/70 font-light text-lg">Manage approvals, delegate work, and broadcast news.</p>
                
                {/* Tabs */}
                <div className="flex gap-4 mt-8 pb-2 overflow-x-auto">
                    {[
                        { id: 'requests', label: 'Leave Requests', icon: Calendar, count: pendingRequests.length, visible: currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('manage_leaves') || currentUser?.permissions?.includes('manager_approvals') },
                        { id: 'history', label: 'Request History', icon: Archive, visible: currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('manage_leaves') || currentUser?.permissions?.includes('manager_approvals') },
                        { 
                            id: 'tasks', 
                            label: 'Assign Tasks', 
                            icon: UserPlus,
                            visible: currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('manage_tasks')
                        },
                        { 
                            id: 'task-progress', 
                            label: 'Task Progress', 
                            icon: ClipboardList,
                            visible: currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('manage_tasks')
                        },
                        { 
                            id: 'announcements', 
                            label: 'Broadcasting', 
                            icon: Megaphone,
                            visible: currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('manage_announcements')
                        }
                    ].filter(tab => tab.visible !== false).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${
                                activeTab === tab.id 
                                ? 'bg-gradient-to-r from-[#e3c4a2] to-[#d4aa80] text-[#300a15] shadow-xl shadow-[#d4aa80]/20' 
                                : 'text-[#e3c4a2]/70 hover:text-white hover:bg-[#541c2c]/40'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ring-2 ring-[#300a15] animate-pulse">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <main>
                {/* Pending Requests Tab */}
                {activeTab === 'requests' && (
                    <div className="grid grid-cols-1 gap-6">
                        {pendingRequests.length > 0 ? pendingRequests.map(req => (
                             <div key={req.id} className="glass-card p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-2xl transition-all border border-[#e3c4a2]/15 group">
                                 <div className="flex items-center gap-6 w-full md:w-auto">
                                     <div className="w-16 h-16 rounded-2xl bg-[#e3c4a2]/15 flex flex-col items-center justify-center font-bold text-[#e3c4a2] border border-[#e3c4a2]/20 shadow-inner">
                                         <span className="text-[10px] uppercase font-bold text-[#aa7a51]">{format(new Date(req.startDate), 'MMM')}</span>
                                         <span className="text-xl">{format(new Date(req.startDate), 'dd')}</span>
                                     </div>
                                     <div className="space-y-1">
                                         <h3 className="text-xl font-bold text-white truncate">{(req as any).employee?.fullName || 'Unknown Staff'}</h3>
                                         <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                             <span className="text-[#aa7a51]">{req.type.replace(/_/g, ' ')}</span>
                                             <span className="w-1 h-1 bg-[#e3c4a2]/20 rounded-full"></span>
                                             <span className="flex items-center gap-1 text-[#e3c4a2]/60">
                                                 <Clock className="w-3 h-3" />
                                                 {format(new Date(req.startDate), 'MMM dd')}
                                                 {req.endDate && ` → ${format(new Date(req.endDate), 'MMM dd')}`}
                                             </span>
                                         </div>
                                     </div>
                                 </div>
 
                                 <div className="flex-1 space-y-3">
                                     <div className="bg-[#541c2c]/30 p-4 rounded-2xl border border-[#e3c4a2]/10 italic text-sm text-stone-200">
                                         "{req.reason || 'No specific reason provided'}"
                                     </div>
                                     
                                     {/* Approval Timeline */}
                                     <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider overflow-x-auto pb-1">
                                         <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${req.status !== 'PENDING' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' : 'bg-[#541c2c]/40 text-[#e3c4a2]/50 border-[#e3c4a2]/10'}`}>
                                             <div className={`w-2 h-2 rounded-full ${req.status !== 'PENDING' ? 'bg-emerald-500' : 'bg-[#aa7a51]/50'}`}></div>
                                             Unit: {(req as any).unitApprovedBy?.fullName || 'Pending'}
                                         </div>
                                         <div className="w-4 h-[1px] bg-[#e3c4a2]/20"></div>
                                         <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${['APPROVED_BY_DEPT', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' : 'bg-[#541c2c]/40 text-[#e3c4a2]/50 border-[#e3c4a2]/10'}`}>
                                             <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DEPT', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-[#aa7a51]/50'}`}></div>
                                             Dept: {(req as any).deptApprovedBy?.fullName || 'Pending'}
                                         </div>
                                         <div className="w-4 h-[1px] bg-[#e3c4a2]/20"></div>
                                         <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${['APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' : 'bg-[#541c2c]/40 text-[#e3c4a2]/50 border-[#e3c4a2]/10'}`}>
                                             <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-[#aa7a51]/50'}`}></div>
                                             Director: {(req as any).directorApprovedBy?.fullName || 'Pending'}
                                         </div>
                                     </div>
                                 </div>
 
                                 <div className="flex items-center gap-3 w-full md:w-auto">
                                     <button 
                                         onClick={() => handleRequestAction(req.id, 'APPROVE')}
                                         className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-900/30 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all"
                                     >
                                         <Check className="w-5 h-5" />
                                         Approve
                                     </button>
                                     <button 
                                         onClick={() => {
                                             const note = prompt('Add rejection note (optional):');
                                             handleRequestAction(req.id, 'REJECT', note || '');
                                         }}
                                         className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#300a15] text-red-400 border border-red-900/30 px-6 py-3 rounded-2xl font-bold hover:bg-red-950/20 hover:text-red-300 transition-all"
                                     >
                                         <XCircle className="w-5 h-5" />
                                         Reject
                                     </button>
                                 </div>
                             </div>
                        )) : (
                            <div className="text-center py-24 glass-card rounded-3xl animate-in zoom-in">
                                <Archive className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-slate-800">Inbox Zero!</h3>
                                <p className="text-slate-400">No pending leave requests to review.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Request History Tab */}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-slate-800">Decision Archive</h2>
                            <p className="text-slate-400 text-sm">{historyRequests.length} historical records</p>
                        </div>
                        
                        <div className="grid gap-4">
                            {historyRequests.map(req => (
                                <div key={req.id} className="glass-card rounded-3xl p-6 border border-[#e3c4a2]/15 flex flex-col md:flex-row items-center gap-6 opacity-80 hover:opacity-100 transition-opacity">
                                    <div className="w-14 h-14 rounded-2xl bg-[#e3c4a2]/15 flex flex-col items-center justify-center text-[#e3c4a2] border border-[#e3c4a2]/20">
                                        <span className="text-[8px] font-bold uppercase">{format(new Date(req.startDate), 'MMM')}</span>
                                        <span className="text-lg font-bold">{format(new Date(req.startDate), 'dd')}</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-white">{(req as any).employee?.fullName || 'Staff Member'}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                req.status === 'COMPLETED' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-red-950/40 text-red-400 border border-red-900/30'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-[#e3c4a2]/60">{req.type.replace(/_/g, ' ')} • {format(new Date(req.startDate), 'PPP')}</div>
                                    </div>

                                    <div className="bg-[#541c2c]/30 p-3 rounded-xl flex-1 max-w-md italic text-xs text-[#e3c4a2]/60 border border-[#e3c4a2]/10">
                                        "{req.reason || 'No specific note provided'}"
                                    </div>

                                    {/* History Status Nodes */}
                                    <div className="flex items-center gap-2 text-[8px] font-bold uppercase text-slate-300">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${req.status !== 'PENDING' ? 'bg-emerald-400' : 'bg-[#aa7a51]/50'}`}></div>
                                            <span className="text-[#e3c4a2]/50">Unit</span>
                                        </div>
                                        <div className="w-3 h-[1px] bg-[#e3c4a2]/15"></div>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DEPT', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-400' : 'bg-[#aa7a51]/50'}`}></div>
                                            <span className="text-[#e3c4a2]/50">Dept</span>
                                        </div>
                                        <div className="w-3 h-[1px] bg-[#e3c4a2]/15"></div>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-400' : 'bg-[#aa7a51]/50'}`}></div>
                                            <span className="text-[#e3c4a2]/50">Dir</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {historyRequests.length === 0 && (
                                <div className="py-20 text-center glass-card rounded-3xl text-slate-400 italic">No historical records found.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Task Assignment Tab */}
                {activeTab === 'tasks' && currentUser?.role === 'SUPER_ADMIN' && (
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 drop-shadow-sm">Assign New Task</h2>
                        <form onSubmit={handleCreateTask} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2 space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Task Headline</label>
                                    <input 
                                        type="text" 
                                        placeholder="What needs to be done?"
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-lg font-medium focus:ring-2 focus-ring-indigo-500/20"
                                        value={newTask.title}
                                        onChange={e => setNewTask({...newTask, title: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Assign to Dept (Optional)</label>
                                    <select 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-medium"
                                        value={newTask.departmentId}
                                        onChange={e => setNewTask({...newTask, departmentId: e.target.value, assigneeId: ''})}
                                    >
                                        <option value="">Select Department</option>
                                        {departments.filter(d => {
                                            if (currentUser?.role === 'HEAD_UNIT' || currentUser?.role === 'HEAD_DEPARTMENT') {
                                                return d.id === currentUser.departmentId;
                                            }
                                            if (currentUser?.role === 'HEAD_DIRECTOR') {
                                                return currentUser.departmentIds?.includes(d.id);
                                            }
                                            if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER' || currentUser?.role === 'PERSONNEL') {
                                                return true;
                                            }
                                            return false;
                                        }).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>

                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Assign to Individual</label>
                                    <select 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-medium"
                                        value={newTask.assigneeId}
                                        onChange={e => setNewTask({...newTask, assigneeId: e.target.value, departmentId: ''})}
                                    >
                                        <option value="">Select Employee</option>
                                        {employees.filter(e => {
                                            if (!e.userId) return false;
                                            if (currentUser?.role === 'HEAD_UNIT') {
                                                return e.unitId === currentUser.unitId;
                                            }
                                            if (currentUser?.role === 'HEAD_DEPARTMENT') {
                                                return e.departmentId === currentUser.departmentId;
                                            }
                                            if (currentUser?.role === 'HEAD_DIRECTOR') {
                                                const isManagedDept = currentUser.departmentIds?.includes(e.departmentId);
                                                const allowedRoles = ['HEAD_UNIT', 'HEAD_DEPARTMENT'];
                                                return isManagedDept && allowedRoles.includes(e.role);
                                            }
                                            if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER' || currentUser?.role === 'PERSONNEL') {
                                                return true;
                                            }
                                            return false;
                                        }).map(e => <option key={e.id} value={e.userId}>{e.fullName} ({e.role.replace('_', ' ')})</option>)}
                                    </select>

                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Deadline Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-medium"
                                        value={newTask.deadline}
                                        onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Priority Level</label>
                                    <select 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-medium"
                                        value={newTask.priority}
                                        onChange={e => setNewTask({...newTask, priority: e.target.value})}
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="NORMAL">Normal</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>

                                <div className="col-span-2 space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Instructions (Markdown Support)</label>
                                    <textarea 
                                        placeholder="Describe the task in detail..."
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 min-h-[150px] font-medium"
                                        value={newTask.content}
                                        onChange={e => setNewTask({...newTask, content: e.target.value})}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-bold shadow-2xl hover:bg-black hover:scale-[1.01] transition-all flex items-center justify-center gap-2 tracking-wide">
                                <Send className="w-5 h-5" />
                                Deploy Task
                            </button>
                        </form>
                    </div>
                )}

                {/* Announcement Tab */}
                {activeTab === 'announcements' && currentUser?.role === 'SUPER_ADMIN' && (
                    <div className="max-w-3xl mx-auto glass-card p-10 rounded-[2.5rem] shadow-xl">
                        <form onSubmit={handleCreateAnnouncement} className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Broadcast Title</label>
                                <input 
                                    type="text" 
                                    placeholder="Important: New Office Policy..."
                                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-indigo-500/20"
                                    value={newAnnounce.title}
                                    onChange={e => setNewAnnounce({...newAnnounce, title: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Target Audience</label>
                                    <select 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold"
                                        value={newAnnounce.targetType}
                                        onChange={e => setNewAnnounce({...newAnnounce, targetType: e.target.value, targetId: ''})}
                                    >
                                        <option value="GLOBAL">Global (Everyone)</option>
                                        <option value="DEPARTMENT">Specific Department</option>
                                        <option value="INDIVIDUAL">Private (One Individual)</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Select Target</label>
                                    <select 
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold"
                                        value={newAnnounce.targetId}
                                        onChange={e => setNewAnnounce({...newAnnounce, targetId: e.target.value})}
                                        disabled={newAnnounce.targetType === 'GLOBAL'}
                                    >
                                        <option value="">Choose Target...</option>
                                        {newAnnounce.targetType === 'DEPARTMENT' 
                                            ? departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                            : employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)
                                        }
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Broadcast Message</label>
                                <textarea 
                                    placeholder="Type your announcement here..."
                                    className="w-full bg-slate-50 border-none rounded-2xl p-6 min-h-[200px] font-medium leading-relaxed"
                                    value={newAnnounce.content}
                                    onChange={e => setNewAnnounce({...newAnnounce, content: e.target.value})}
                                    required
                                />
                            </div>

                            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                                <Megaphone className="w-5 h-5" />
                                Broadcast Announcement
                            </button>
                        </form>
                    </div>
                )}
                    {activeTab === 'task-progress' && currentUser?.role === 'SUPER_ADMIN' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Department Task Tracker</h2>
                                    <p className="text-slate-400 text-sm">Monitoring workload and progress across your scope.</p>
                                </div>
                                <div className="flex gap-2">
                                    {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map(s => (
                                        <button 
                                            key={s}
                                            onClick={() => setTaskFilter(s)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                                taskFilter === s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {scopedTasks.filter(t => (taskFilter === 'ALL' || t.status === taskFilter) && t.category === 'ASSIGNED').map(task => (
                                    <div key={task.id} className="glass-card p-6 rounded-3xl border border-white/50 hover:shadow-xl transition-all flex flex-col gap-4 group">
                                        <div className="flex justify-between items-start">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                                task.priority === 'CRITICAL' ? 'bg-red-100 text-red-600' :
                                                task.priority === 'HIGH' ? 'bg-orange-100 text-orange-600' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {task.priority}
                                            </span>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                                task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' :
                                                task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                                                'bg-amber-100 text-amber-600'
                                            }`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors uppercase text-sm tracking-tight">{task.title}</h4>
                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{task.content}</p>
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {task.assignee?.fullName?.charAt(0) || 'U'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Assignee</span>
                                                    <span className="text-[11px] font-bold text-slate-700">{task.assignee?.fullName || 'Unassigned'}</span>
                                                </div>
                                            </div>
                                            {task.deadline && (
                                                <div className="text-right">
                                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Deadline</span>
                                                    <span className="text-[11px] font-bold text-slate-700">{format(new Date(task.deadline), 'MMM dd')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {scopedTasks.length === 0 && (
                                    <div className="col-span-full py-20 text-center glass-card rounded-[2.5rem]">
                                        <Archive className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold text-slate-800">No tasks found</h3>
                                        <p className="text-slate-400 text-sm">Tasks assigned by you or within your scope will appear here.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        );
};


export default Approvals;
