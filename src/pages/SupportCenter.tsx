import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    MonitorSmartphone, 
    LifeBuoy, 
    Plus, 
    Clock, 
    CheckCircle2, 
    AlertCircle,
    ChevronRight,
    Search,
    Filter,
    PackageSearch,
    Bug
} from 'lucide-react';
import { operationsService, type AssetRequest, type SupportTicket } from '../services/operationsService';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import Modal from '../components/Modal';

const SupportCenter: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [assets, setAssets] = useState<AssetRequest[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'assets' | 'tickets'>('tickets');

    // Modals
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

    // Form Data
    const [assetForm, setAssetForm] = useState({ itemType: 'LAPTOP', priority: 'NORMAL', notes: '' });
    const [ticketForm, setTicketForm] = useState({ title: '', description: '', category: 'IT', priority: 'NORMAL' });

    useEffect(() => {
        fetchMyData();
    }, []);

    const fetchMyData = async () => {
        setLoading(true);
        try {
            const [assetData, ticketData] = await Promise.all([
                operationsService.getAssetRequests(),
                operationsService.getTickets()
            ]);
            setAssets(assetData);
            setTickets(ticketData);
        } catch (error) {
            console.error("Error fetching operations data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Need my employee ID
            const myEmp = await employeeService.getAllEmployees().then(emps => emps.find(e => e.userId === currentUser?.id));
            if (!myEmp) throw new Error("No employee record linked to your user account.");

            await operationsService.createAssetRequest({
                ...assetForm,
                employeeId: myEmp.id
            });
            toast.success(t('asset_request_submitted', { defaultValue: 'Request submitted successfully!' }));
            setIsAssetModalOpen(false);
            fetchMyData();
        } catch (error: any) {
            toast.error(error.message || "Failed to submit request");
        }
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await operationsService.createTicket(ticketForm);
            toast.success(t('ticket_submitted', { defaultValue: 'Ticket submitted successfully!' }));
            setIsTicketModalOpen(false);
            fetchMyData();
        } catch (error) {
            toast.error("Failed to submit ticket");
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: any = {
            PENDING: 'bg-amber-100 text-amber-700',
            OPEN: 'bg-blue-100 text-blue-700',
            PREPARING: 'bg-indigo-100 text-indigo-700',
            IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
            READY: 'bg-emerald-100 text-emerald-700',
            RESOLVED: 'bg-emerald-100 text-emerald-700',
            COMPLETED: 'bg-emerald-100 text-emerald-700',
            ASSIGNED: 'bg-slate-100 text-slate-700',
            REJECTED: 'bg-red-100 text-red-700',
            CLOSED: 'bg-slate-100 text-slate-700',
        };
        return (
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
                {status.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[40px] p-8 md:p-12 text-white shadow-2xl">
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-outfit font-bold tracking-tight mb-4">
                        {t('support_center_title', { defaultValue: 'Service Hub' })}
                    </h1>
                    <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed">
                        {t('support_center_subtitle', { defaultValue: 'How can we help you today? Request hardware or report issues directly to our operations team.' })}
                    </p>
                </div>
                <div className="absolute top-0 right-0 p-12 opacity-10 blur-2xl hidden md:block">
                    <LifeBuoy size={300} />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                    onClick={() => setIsAssetModalOpen(true)}
                    className="group relative p-8 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 hover:scale-[1.02] transition-all text-left overflow-hidden active:scale-95"
                >
                    <div className="flex items-start justify-between">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <MonitorSmartphone size={32} />
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                            <Plus size={20} className="text-slate-400 group-hover:text-indigo-600" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mt-6">{t('request_equipment', { defaultValue: 'Request Equipment' })}</h3>
                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">{t('request_equipment_desc', { defaultValue: 'Order a new laptop, mobile device, or accessories for your role.' })}</p>
                </button>

                <button 
                    onClick={() => setIsTicketModalOpen(true)}
                    className="group relative p-8 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 hover:scale-[1.02] transition-all text-left overflow-hidden active:scale-95"
                >
                    <div className="flex items-start justify-between">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                            <Bug size={32} />
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-rose-50 transition-colors">
                            <Plus size={20} className="text-slate-400 group-hover:text-rose-600" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mt-6">{t('report_issue', { defaultValue: 'Report an Issue' })}</h3>
                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">{t('report_issue_desc', { defaultValue: 'Facing technical problems or system errors? Let us know.' })}</p>
                </button>
            </div>

            {/* My Requests Section */}
            <div className="glass-card rounded-[40px] overflow-hidden shadow-2xl shadow-slate-200/50">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t('my_requests', { defaultValue: 'My Activity' })}</h2>
                        <p className="text-slate-500 text-sm mt-1">{t('track_status_subtitle', { defaultValue: 'Track the status of your equipment and support logs.' })}</p>
                    </div>
                    <div className="flex p-1 bg-white border border-slate-200 rounded-2xl">
                        <button 
                            onClick={() => setActiveTab('tickets')}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tickets' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t('support_tickets', { defaultValue: 'Support Tickets' })}
                        </button>
                        <button 
                            onClick={() => setActiveTab('assets')}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'assets' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t('equipment_requests', { defaultValue: 'Hardware' })}
                        </button>
                    </div>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="space-y-4">
                            {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-3xl" />)}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeTab === 'tickets' ? (
                                tickets.length === 0 ? (
                                    <div className="text-center py-12 p-8 bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                                        <LifeBuoy size={48} className="mx-auto text-slate-300 mb-4" />
                                        <p className="text-slate-500 font-bold">{t('no_tickets_yet', { defaultValue: 'No active support tickets' })}</p>
                                    </div>
                                ) : (
                                    tickets.map(ticket => (
                                        <div key={ticket.id} className="p-6 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 transition-all shadow-sm group">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                                                        <Bug size={24} className="text-slate-400 group-hover:text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{ticket.title}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{ticket.category}</span>
                                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(ticket.createdAt), 'dd MMM yyyy')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className={`px-3 py-1 rounded-full text-[9px] font-black ${ticket.priority === 'HIGH' || ticket.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                                                        {ticket.priority}
                                                    </div>
                                                    <StatusBadge status={ticket.status} />
                                                </div>
                                            </div>
                                            {ticket.resolution && (
                                                <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Resolution Note</p>
                                                    <p className="text-xs text-emerald-700 font-medium">{ticket.resolution}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )
                            ) : (
                                assets.length === 0 ? (
                                    <div className="text-center py-12 p-8 bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                                        <MonitorSmartphone size={48} className="mx-auto text-slate-300 mb-4" />
                                        <p className="text-slate-500 font-bold">{t('no_assets_yet', { defaultValue: 'No equipment requests yet' })}</p>
                                    </div>
                                ) : (
                                    assets.map(asset => (
                                        <div key={asset.id} className="p-6 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 transition-all shadow-sm group">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 transition-colors">
                                                        <MonitorSmartphone size={24} className="text-slate-400 group-hover:text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{asset.itemType}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(asset.createdAt), 'dd MMM yyyy')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <StatusBadge status={asset.status} />
                                                </div>
                                            </div>
                                            {asset.notes && (
                                                <p className="mt-4 text-[11px] text-slate-500 font-medium italic border-t border-slate-50 pt-3">
                                                    "{asset.notes}"
                                                </p>
                                            )}
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Equipment Modal */}
            <Modal isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)}>
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                            <MonitorSmartphone size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{t('request_new_equipment', { defaultValue: 'New Equipment' })}</h3>
                            <p className="text-xs text-slate-500">{t('equipment_modal_desc', { defaultValue: 'Tell us which hardware you need for your role.' })}</p>
                        </div>
                    </div>

                    <form onSubmit={handleCreateAsset} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('item_type', { defaultValue: 'Category' })}</label>
                            <select 
                                value={assetForm.itemType}
                                onChange={(e) => setAssetForm({...assetForm, itemType: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 transition-all font-bold text-slate-800"
                            >
                                <option value="LAPTOP">Laptop (Mac/PC)</option>
                                <option value="PHONE">Mobile Phone</option>
                                <option value="SIM">SIM Card</option>
                                <option value="MONITOR">Dual Monitor Setup</option>
                                <option value="ACCESSORIES">General Accessories</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('request_notes', { defaultValue: 'Specification & Reason' })}</label>
                            <textarea 
                                value={assetForm.notes}
                                onChange={(e) => setAssetForm({...assetForm, notes: e.target.value})}
                                placeholder="e.g. Need high memory for video editing, or replacing a broken unit..."
                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 transition-all font-bold text-slate-800 min-h-[100px]"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button 
                                type="button" 
                                onClick={() => setIsAssetModalOpen(false)}
                                className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 px-6 py-4 rounded-xl bg-slate-900 text-white font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all"
                            >
                                {t('submit_request', { defaultValue: 'Submit Order' })}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            {/* Ticket Modal */}
            <Modal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)}>
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                            <Bug size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{t('report_new_issue', { defaultValue: 'New Support Ticket' })}</h3>
                            <p className="text-xs text-slate-500">{t('ticket_modal_desc', { defaultValue: 'Report bugs, system crashes, or hardware issues.' })}</p>
                        </div>
                    </div>

                    <form onSubmit={handleCreateTicket} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('category')}</label>
                                <select 
                                    value={ticketForm.category}
                                    onChange={(e) => setTicketForm({...ticketForm, category: e.target.value as any})}
                                    className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 transition-all font-bold text-slate-800"
                                >
                                    <option value="IT">IT (HW/SW)</option>
                                    <option value="FACILITY">Office Facility</option>
                                    <option value="HR">HR / Access</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('urgency', { defaultValue: 'Priority' })}</label>
                                <select 
                                    value={ticketForm.priority}
                                    onChange={(e) => setTicketForm({...ticketForm, priority: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 transition-all font-bold text-slate-800"
                                >
                                    <option value="LOW">Low</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">High</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('subject', { defaultValue: 'Problem Title' })}</label>
                            <input 
                                type="text"
                                required
                                value={ticketForm.title}
                                onChange={(e) => setTicketForm({...ticketForm, title: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 transition-all font-bold text-slate-800"
                                placeholder="Short summary of the issue"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('detailed_desc', { defaultValue: 'Full Description' })}</label>
                            <textarea 
                                required
                                value={ticketForm.description}
                                onChange={(e) => setTicketForm({...ticketForm, description: e.target.value})}
                                placeholder="Proivde as much detail as possible. Steps to reproduce if software bug."
                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 transition-all font-bold text-slate-800 min-h-[120px]"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button 
                                type="button" 
                                onClick={() => setIsTicketModalOpen(false)}
                                className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                            >
                                {t('cancel')}
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 px-6 py-4 rounded-xl bg-slate-900 text-white font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all"
                            >
                                {t('submit_ticket', { defaultValue: 'Send Ticket' })}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

export default SupportCenter;
