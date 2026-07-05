import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MonitorSmartphone,
    Search,
    Clock,
    ArrowRight,
    User as UserIcon,
    PackageSearch,
    Bug,
    Users,
    AlertTriangle,
    Trash2
} from 'lucide-react';
import { operationsService, type AssetRequest, type SupportTicket } from '../../services/operationsService';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';

const AdminOperations: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [assets, setAssets] = useState<AssetRequest[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'onboarding' | 'tickets'>('onboarding');
    const [users, setUsers] = useState<User[]>([]);

    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail Modals
    const [viewingAsset, setViewingAsset] = useState<AssetRequest | null>(null);
    const [viewingTicket, setViewingTicket] = useState<SupportTicket | null>(null);
    const [updateNote, setUpdateNote] = useState('');
    const [assigningTo, setAssigningTo] = useState('');
    const [readyTime, setReadyTime] = useState('');
    const [tempPriority, setTempPriority] = useState<string>('');

    useEffect(() => {
        fetchData();
        fetchUsers();
    }, [activeTab]);

    const fetchUsers = async () => {
        try {
            const data = await userService.getAllUsers();
            // Filter only support-capable roles if needed, or show all admins/hr
            setUsers(data.filter(u => ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'].includes(u.role)));
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'onboarding') {
                const data = await operationsService.getAssetRequests();
                setAssets(data);
            } else {
                const data = await operationsService.getTickets();
                setTickets(data);
            }
        } catch (error) {
            console.error("Error fetching admin operations:", error);
            toast.error("Failed to load records");
        } finally {
            setLoading(false);
        }
    };

    const filteredAssets = assets.filter(a => {
        const matchesStatus = !statusFilter || a.status === statusFilter;
        const matchesPriority = !priorityFilter || a.priority === priorityFilter;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            a.employee?.fullName.toLowerCase().includes(searchLower) ||
            a.employee?.staffId.toLowerCase().includes(searchLower) ||
            a.itemType.toLowerCase().includes(searchLower);
        return matchesStatus && matchesPriority && matchesSearch;
    });

    const filteredTickets = tickets.filter(t => {
        const matchesStatus = !statusFilter || t.status === statusFilter;
        const matchesPriority = !priorityFilter || t.priority === priorityFilter;
        const matchesCategory = !categoryFilter || t.category === categoryFilter;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            t.title.toLowerCase().includes(searchLower) ||
            t.requester?.fullName.toLowerCase().includes(searchLower) ||
            t.description.toLowerCase().includes(searchLower);
        return matchesStatus && matchesPriority && matchesCategory && matchesSearch;
    });

    const stats = {
        pendingAssets: assets.filter(a => a.status === 'PENDING').length,
        openTickets: tickets.filter(t => t.status === 'OPEN').length,
        criticalIssues: tickets.filter(t => t.priority === 'CRITICAL' && t.status !== 'CLOSED').length + 
                        assets.filter(a => a.priority === 'CRITICAL' && a.status !== 'ASSIGNED').length,
    };

    const handleUpdateAssetStatus = async (id: string, status: string) => {
        try {
            await operationsService.updateAssetStatus(id, status, updateNote, tempPriority || viewingAsset?.priority);
            toast.success(`Request marked as ${status}`);
            setViewingAsset(null);
            setUpdateNote('');
            setTempPriority('');
            fetchData();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleUpdateTicketStatus = async (id: string, status: string) => {
        try {
            await operationsService.updateTicketStatus(id, status, updateNote, tempPriority || viewingTicket?.priority);
            toast.success(`Ticket marked as ${status}`);
            setViewingTicket(null);
            setUpdateNote('');
            setTempPriority('');
            fetchData();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleAssignTicket = async (id: string, userId: string) => {
        try {
            await operationsService.assignTicket(id, userId, readyTime);
            toast.success("Ticket assigned successfully");
            setViewingTicket(null);
            setAssigningTo('');
            setReadyTime('');
            fetchData();
        } catch (error) {
            toast.error("Failed to assign ticket");
        }
    };

    const handleDeleteTicket = async (id: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this ticket?")) return;
        
        try {
            await operationsService.deleteTicket(id);
            toast.success("Ticket deleted successfully");
            setViewingTicket(null);
            fetchData();
        } catch (error) {
            toast.error("Failed to delete ticket");
        }
    };

    const PriorityBadge = ({ priority }: { priority: string }) => {
        const styles: any = {
            LOW: 'bg-slate-100 text-slate-700',
            NORMAL: 'bg-blue-100 text-blue-700',
            HIGH: 'bg-amber-100 text-amber-700',
            CRITICAL: 'bg-rose-100 text-rose-700',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${styles[priority]}`}>
                {priority}
            </span>
        );
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: any = {
            PENDING: 'bg-amber-100 text-amber-700',
            OPEN: 'bg-blue-100 text-blue-700',
            PREPARING: 'bg-indigo-100 text-indigo-700',
            IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
            READY: 'bg-emerald-100 text-emerald-700 text-opacity-80',
            RESOLVED: 'bg-emerald-100 text-emerald-700',
            COMPLETED: 'bg-emerald-600 text-white',
            ASSIGNED: 'bg-slate-700 text-white',
            REJECTED: 'bg-red-100 text-red-700',
            CLOSED: 'bg-slate-100 text-slate-700',
        };
        return (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[status]}`}>
                {status.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
                        <MonitorSmartphone className="mr-3 text-indigo-600" size={32} />
                        {t('admin_ops_title', { defaultValue: 'Operational Services' })}
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">{t('admin_ops_subtitle', { defaultValue: 'Manage device onboarding and help desk support tickets.' })}</p>
                </div>
                <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit shadow-inner">
                    <button
                        onClick={() => { setActiveTab('onboarding'); setStatusFilter(''); setPriorityFilter(''); }}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'onboarding' ? 'bg-white text-indigo-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {t('onboarding_queue', { defaultValue: 'Device Setup' })}
                    </button>
                    <button
                        onClick={() => { setActiveTab('tickets'); setStatusFilter(''); setPriorityFilter(''); }}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'tickets' ? 'bg-white text-indigo-600 shadow-md transform scale-105' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {t('support_desk', { defaultValue: 'Help Desk' })}
                    </button>
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-5 group hover:border-indigo-200 transition-all cursor-default">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <PackageSearch size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Requests</p>
                        <h3 className="text-2xl font-black text-slate-900">{stats.pendingAssets}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-5 group hover:border-rose-200 transition-all cursor-default">
                    <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                        <Bug size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Tickets</p>
                        <h3 className="text-2xl font-black text-slate-900">{stats.openTickets}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center gap-5 group hover:border-amber-200 transition-all cursor-default">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Critical Issues</p>
                        <h3 className="text-2xl font-black text-slate-900">{stats.criticalIssues}</h3>
                    </div>
                </div>
            </div>

            {/* List Board */}
            <div className="glass-card rounded-[40px] overflow-hidden shadow-2xl shadow-slate-200/50">
                <div className="p-6 md:p-8 border-b border-slate-100 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${activeTab === 'onboarding' ? 'bg-indigo-50 text-indigo-600 shadow-indigo-100' : 'bg-rose-50 text-rose-600 shadow-rose-100'} shadow-lg`}>
                            {activeTab === 'onboarding' ? <MonitorSmartphone size={28} /> : <Bug size={28} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 leading-none">
                                {activeTab === 'onboarding' ? t('hardware_requests', { defaultValue: 'Equipment Queue' }) : t('incident_logs', { defaultValue: 'Incident logs' })}
                            </h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-2">
                                {activeTab === 'onboarding' ? filteredAssets.length : filteredTickets.length} {t('records_match', { defaultValue: 'matching records' })}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <div className="relative group min-w-[240px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, ID, or title..."
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-transparent rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        {/* Status Filter */}
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all cursor-pointer"
                        >
                            <option value="">{t('all_statuses', { defaultValue: 'All Status' })}</option>
                            {activeTab === 'onboarding' ? (
                                <>
                                    <option value="PENDING">Pending</option>
                                    <option value="PREPARING">Preparing</option>
                                    <option value="READY">Ready</option>
                                    <option value="ASSIGNED">Assigned</option>
                                    <option value="REJECTED">Rejected</option>
                                </>
                            ) : (
                                <>
                                    <option value="OPEN">Open</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="RESOLVED">Resolved</option>
                                    <option value="CLOSED">Closed</option>
                                </>
                            )}
                        </select>

                        {/* Priority Filter */}
                        <select 
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-4 py-3 bg-slate-50 border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all cursor-pointer"
                        >
                            <option value="">{t('all_priorities', { defaultValue: 'All Priority' })}</option>
                            <option value="LOW">Low</option>
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                        </select>

                        {activeTab === 'tickets' && (
                            <select 
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="px-4 py-3 bg-slate-50 border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all cursor-pointer"
                            >
                                <option value="">{t('all_categories', { defaultValue: 'All Category' })}</option>
                                <option value="IT">IT</option>
                                <option value="FACILITY">Facility</option>
                                <option value="HR">HR</option>
                            </select>
                        )}
                    </div>
                </div>

                <div className="p-4 md:p-8 min-h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {activeTab === 'onboarding' ? (
                                assets.length === 0 ? (
                                    <NoResults message="No hardware requests in queue" />
                                ) : (
                                    filteredAssets.map(asset => (
                                        <div key={asset.id}
                                            onClick={() => setViewingAsset(asset)}
                                            className="p-6 bg-white border border-slate-100 rounded-3xl hover:border-indigo-300 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/20 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150" />
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                                                <div className="flex items-start gap-5">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors shadow-sm">
                                                        <MonitorSmartphone size={32} className="text-slate-400 group-hover:text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3">
                                                            <h4 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{asset.employee?.fullName}</h4>
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-tighter">{asset.employee?.staffId}</span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider italic">{asset.itemType}</p>
                                                            <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{asset.employee?.department?.name || 'No Dept'}</span>
                                                            <span className="text-[10px] text-slate-300 font-bold uppercase">{asset.employee?.unit?.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-4 text-[11px] font-bold text-slate-500">
                                                            <span className="flex items-center opacity-70"><UserIcon size={12} className="mr-1" /> {t('requested_by', { defaultValue: 'Req by' })} {asset.requester?.fullName}</span>
                                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                                            <span className="flex items-center opacity-70"><Clock size={12} className="mr-1" /> {format(new Date(asset.createdAt), 'dd MMM yyyy')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center self-end lg:self-center gap-4">
                                                    <PriorityBadge priority={asset.priority} />
                                                    <StatusBadge status={asset.status} />
                                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                        <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                tickets.length === 0 ? (
                                    <NoResults message="No support tickets found" />
                                ) : (
                                    filteredTickets.map(ticket => (
                                        <div key={ticket.id}
                                            onClick={() => setViewingTicket(ticket)}
                                            className="p-6 bg-white border border-slate-100 rounded-3xl hover:border-indigo-300 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50/20 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150" />
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                                                <div className="flex items-start gap-5">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-rose-50 transition-colors shadow-sm">
                                                        <Bug size={32} className="text-slate-400 group-hover:text-rose-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-slate-800 group-hover:text-rose-600 transition-colors">{ticket.title}</h4>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{ticket.category}</span>
                                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
                                                                {ticket.requester?.fullName}
                                                                {ticket.requester?.employee?.department && (
                                                                    <span className="text-slate-300 ml-1">({ticket.requester.employee.department.name})</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-3 bg-slate-50/50 p-2 rounded-lg italic">"{ticket.description}"</p>
                                                        
                                                        {ticket.assignee && (
                                                            <div className="flex flex-wrap items-center gap-4 mt-3">
                                                                <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                                    <Users size={12} />
                                                                    Assigned to: {ticket.assignee.fullName}
                                                                </div>
                                                                {ticket.estimatedReadyAt && (
                                                                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                                                        <Clock size={12} />
                                                                        Ready: {format(new Date(ticket.estimatedReadyAt), 'dd MMM p')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center self-end lg:self-center gap-4">
                                                    <PriorityBadge priority={ticket.priority} />
                                                    <StatusBadge status={ticket.status} />
                                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-rose-600 group-hover:text-white transition-all">
                                                        <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Asset Detail Modal */}
            <Modal 
                isOpen={!!viewingAsset} 
                onClose={() => setViewingAsset(null)}
                title="Request Details"
            >
                <div className="p-8">
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                <MonitorSmartphone size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 leading-tight">Equipment Request</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">ID: #{viewingAsset?.id.slice(0, 8)}</p>
                            </div>
                        </div>
                        <StatusBadge status={viewingAsset?.status || ''} />
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject Employee</p>
                            <p className="font-bold text-slate-800">{viewingAsset?.employee?.fullName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{viewingAsset?.employee?.position} ({viewingAsset?.employee?.staffId})</p>
                            <p className="text-[10px] text-indigo-500 font-bold mt-1 uppercase tracking-wider">{viewingAsset?.employee?.department?.name} • {viewingAsset?.employee?.unit?.name}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Requested Item</p>
                            <p className="font-bold text-slate-800 text-lg mb-2">{viewingAsset?.itemType}</p>
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update Priority</p>
                                <select 
                                    value={tempPriority || viewingAsset?.priority}
                                    onChange={(e) => setTempPriority(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-100 border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer w-fit"
                                >
                                    <option value="LOW">Low</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">High</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-6 mb-8 border border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Request Details / Notes</p>
                            <span className="text-[10px] text-slate-400 font-bold">{format(new Date(viewingAsset?.createdAt || new Date()), 'PPP p')}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-600 bg-white p-4 rounded-xl shadow-sm italic leading-relaxed border border-slate-100/50">
                            {viewingAsset?.notes || "No additional notes provided."}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update Action</p>
                        <textarea
                            value={updateNote}
                            onChange={(e) => setUpdateNote(e.target.value)}
                            placeholder="Add a remark (serial numbers, tracking info, or reason for rejection)..."
                            className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-slate-800 min-h-[100px]"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            {viewingAsset?.status === 'PENDING' && (
                                <button
                                    onClick={() => handleUpdateAssetStatus(viewingAsset.id, 'PREPARING')}
                                    className="px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 transition-all shadow-xl"
                                >
                                    Start Preparing
                                </button>
                            )}
                            {viewingAsset?.status === 'PREPARING' && (
                                <button
                                    onClick={() => handleUpdateAssetStatus(viewingAsset.id, 'READY')}
                                    className="px-6 py-4 rounded-2xl bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all shadow-xl"
                                >
                                    Mark as Ready
                                </button>
                            )}
                            {viewingAsset?.status === 'READY' && (
                                <button
                                    onClick={() => handleUpdateAssetStatus(viewingAsset.id, 'ASSIGNED')}
                                    className="px-6 py-4 rounded-2xl bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl"
                                >
                                    Mark as Assigned
                                </button>
                            )}
                            <button
                                onClick={() => handleUpdateAssetStatus(viewingAsset!.id, 'REJECTED')}
                                className="px-6 py-4 rounded-2xl border border-rose-200 text-rose-500 font-black uppercase text-[10px] tracking-widest hover:bg-rose-50 transition-all"
                            >
                                Reject Request
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Ticket Detail Modal */}
            <Modal 
                isOpen={!!viewingTicket} 
                onClose={() => setViewingTicket(null)}
                title="Incident Details"
            >
                <div className="p-8">
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 text-opacity-80">
                                <Bug size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 leading-tight">{viewingTicket?.category} Incident</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Ref: #{viewingTicket?.id.slice(0, 8)}</p>
                            </div>
                        </div>
                        <StatusBadge status={viewingTicket?.status || ''} />
                    </div>

                    <div className="space-y-6 mb-8">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Issue Subject</p>
                            <h4 className="text-xl font-bold text-slate-800">{viewingTicket?.title}</h4>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Description</p>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingTicket?.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reporter</p>
                                <p className="text-sm font-bold text-slate-800">{viewingTicket?.requester?.fullName}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{viewingTicket?.requester?.employee?.department?.name || viewingTicket?.requester?.role}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority & Assignee</p>
                                <div className="flex flex-col gap-3">
                                    <select 
                                        value={tempPriority || viewingTicket?.priority}
                                        onChange={(e) => setTempPriority(e.target.value)}
                                        className="px-3 py-1.5 bg-slate-100 border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer w-fit"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="NORMAL">Normal</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                    
                                    {viewingTicket?.assignee ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase">
                                                <Users size={12} />
                                                {viewingTicket.assignee.fullName}
                                            </div>
                                            {viewingTicket.estimatedReadyAt && (
                                                <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-600 uppercase tracking-tight">
                                                    <Clock size={10} />
                                                    {format(new Date(viewingTicket.estimatedReadyAt), 'dd MMM p')}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] font-bold text-slate-400 italic uppercase">Unassigned</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-slate-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign Ticket</p>
                                    <div className="flex gap-2">
                                        <select 
                                            value={assigningTo}
                                            onChange={(e) => setAssigningTo(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-slate-50 border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                                        >
                                            <option value="">Select Admin...</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.fullName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated Ready Time</p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="datetime-local"
                                            value={readyTime}
                                            onChange={(e) => setReadyTime(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-slate-50 border-transparent rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all"
                                        />
                                        <button
                                            disabled={!assigningTo}
                                            onClick={() => handleAssignTicket(viewingTicket!.id, assigningTo)}
                                            className="px-6 bg-indigo-600 text-white rounded-2xl hover:bg-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest"
                                        >
                                            Assign
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Transition</p>
                                <div className="flex flex-wrap gap-2">
                                    {viewingTicket?.status === 'OPEN' && (
                                        <button
                                            onClick={() => handleUpdateTicketStatus(viewingTicket.id, 'IN_PROGRESS')}
                                            className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                                        >
                                            Take Ticket
                                        </button>
                                    )}
                                    {viewingTicket?.status !== 'RESOLVED' && viewingTicket?.status !== 'CLOSED' && (
                                        <button
                                            onClick={() => handleUpdateTicketStatus(viewingTicket!.id, 'RESOLVED')}
                                            className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                                        >
                                            Resolve
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleUpdateTicketStatus(viewingTicket!.id, 'CLOSED')}
                                        className="px-4 py-2 rounded-xl bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolution Response / Private Note</p>
                            <textarea
                                value={updateNote}
                                onChange={(e) => setUpdateNote(e.target.value)}
                                placeholder="Explain the resolution or add a progress update..."
                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-rose-100 transition-all font-bold text-slate-800 min-h-[100px]"
                            />
                        </div>

                        {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER') && (
                            <div className="pt-6 border-t border-slate-100 mt-6">
                                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-rose-900">Danger Zone</p>
                                        <p className="text-[10px] text-rose-600 font-medium">Permanently remove this incident from the system.</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteTicket(viewingTicket!.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                    >
                                        <Trash2 size={14} />
                                        Delete Ticket
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const NoResults = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-20 p-8 bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
        <PackageSearch size={64} className="text-slate-300 mb-4" />
        <p className="text-slate-500 font-bold text-lg">{message}</p>
        <p className="text-slate-400 text-sm mt-1">Check back later or try adjusting filters.</p>
    </div>
);

export default AdminOperations;
