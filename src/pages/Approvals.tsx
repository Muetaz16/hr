import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { staffHubService } from '../services/staffHubService';
import type { LeaveRequest, LeaveApprovalStep } from '../services/staffHubService';

// PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE now flow through the org-based approval-step chain
// (fetched separately via getMyPendingSteps) instead of the legacy status-based flow below —
// exclude them from the old pending-requests list so the old Approve/Reject buttons (which write
// directly to LeaveRequest.status) can't bypass the new per-step chain.
const CHAIN_LEAVE_TYPES = ['PAID_HOLIDAY', 'UNPAID_LEAVE', 'EMERGENCY_LEAVE', 'LATE_COMING', 'EARLY_LEAVING', 'HOURS_LEAVE', 'WORK_AUTHORIZATION', 'MISSING_PUNCH'];
const STAGE_LABELS: Record<string, string> = {
    HEAD_ATTENDANCE: 'Head of Attendance & Payroll',
    DIRECT_SUPERVISOR: 'Direct Supervisor',
    HEAD_DEPT_DIVISION: 'Head of Department / Division',
    UNIT_HEAD: 'Unit Head',
    DEPT_HEAD: 'Department/Office Head',
    DIVISION_HEAD: 'Division Head',
    HR_MANAGER: 'HR Manager',
    DIRECTORATE: 'Directorate',
    GENERAL_MANAGER: 'General Manager',
};
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import { 
    Check,
    LayoutDashboard,
    Calendar,
    Megaphone,
    XCircle,
    Archive,
    Clock,
    Paperclip,
    Download,
    Edit,
    Trash2,
    FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SERVER_URL } from '../services/apiClient';
import { useConfirm } from '../components/ConfirmDialog';
import { usePrompt } from '../components/PromptDialog';

const Approvals: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const confirm = useConfirm();
    const prompt = usePrompt();
    const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
    const [historyRequests, setHistoryRequests] = useState<LeaveRequest[]>([]);
    const [pendingSteps, setPendingSteps] = useState<LeaveApprovalStep[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'requests' | 'history' | 'announcements'>('requests');
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    // The document the General Manager must upload to grant the final approval, keyed by step id.
    const [gmDocs, setGmDocs] = useState<Record<string, File | null>>({});
    // The step whose decision is currently being submitted — guards against double submits while an
    // upload is in flight (a large GM document can take a moment).
    const [submittingStep, setSubmittingStep] = useState<string | null>(null);

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

    useEffect(() => {
        if (activeTab === 'announcements') {
            loadAnnouncements();
        }
    }, [activeTab]);

    const loadAnnouncements = async () => {
        try {
            const data = await staffHubService.getAllAnnouncements();
            setAnnouncements(data);
        } catch (error) {
            console.error('Failed to load announcements', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let statusFilter = 'PENDING';
            if (currentUser?.role === 'HEAD_UNIT') {
                statusFilter = 'PENDING';
            } else if (currentUser?.role === 'HEAD_DEPARTMENT') {
                statusFilter = 'PENDING,APPROVED_BY_UNIT';
            } else if (currentUser?.role === 'HEAD_DIVISION') {
                statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT';
            } else if (currentUser?.role === 'HEAD_DIRECTOR') {
                statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT,APPROVED_BY_DIVISION';
            } else if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER') {
                statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT,APPROVED_BY_DIVISION,APPROVED_BY_DIRECTOR';
            }

            const [reqs, hist, emps, depts, steps] = await Promise.all([
                staffHubService.getPendingRequests({
                    departmentId: currentUser?.departmentId || undefined,
                    groupId: currentUser?.groupId || undefined,
                    unitId: currentUser?.unitId || undefined,
                    divisionId: currentUser?.divisionId || undefined,
                    status: statusFilter
                }),
                staffHubService.getPendingRequests({
                    departmentId: currentUser?.departmentId || undefined,
                    groupId: currentUser?.groupId || undefined,
                    unitId: currentUser?.unitId || undefined,
                    divisionId: currentUser?.divisionId || undefined,
                    status: 'COMPLETED,REJECTED'
                }),
                employeeService.getAllEmployees(),
                departmentService.getAllDepartments(),
                staffHubService.getMyPendingSteps().catch(() => [] as LeaveApprovalStep[])
            ]);
            // PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE now progress via pendingSteps (identity-
            // scoped server-side) — drop them from the legacy org-scoped list so its Approve/
            // Reject buttons can't bypass the new per-step chain.
            setPendingRequests(reqs.filter((r: LeaveRequest) => !CHAIN_LEAVE_TYPES.includes(r.type)));
            setHistoryRequests(hist);
            setEmployees(emps);
            setDepartments(depts);
            setPendingSteps(steps);
        } catch (error) {
            toast.error(t('failed_to_load_data'));
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
                else if (currentUser?.role === 'HEAD_DIVISION') status = 'APPROVED_BY_DIVISION';
                else if (currentUser?.role === 'HEAD_DIRECTOR') status = 'APPROVED_BY_DIRECTOR';
                else status = 'COMPLETED'; // Admins can fast-track
            }

            await staffHubService.updateRequestStatus(id, { status, managerNote });
            toast.success(status === 'REJECTED' ? t('request_rejected') : t('request_approved'));
            fetchData();
        } catch (error) {
            toast.error(t('failed_to_update_status'));
        }
    };

    // For the new org-based approval chain — the server verifies this user is actually the
    // step's assigned approver and that it's genuinely their turn; the client just sends the
    // decision, no role/status guessing needed.
    const handleStepDecision = async (step: LeaveApprovalStep, decision: 'APPROVE' | 'REJECT', note: string = '') => {
        // The General Manager must attach a document before their (final) approval.
        const isGM = step.stage === 'GENERAL_MANAGER';
        const doc = gmDocs[step.id] || null;
        if (isGM && decision === 'APPROVE' && !doc) {
            toast.error(t('gm_document_required', { defaultValue: 'Please upload a supporting document before approving.' }));
            return;
        }
        if (submittingStep) return; // a decision is already in flight
        setSubmittingStep(step.id);
        try {
            await staffHubService.decideApprovalStep(step.leaveRequestId, step.id, decision, note, isGM ? doc : null);
            toast.success(decision === 'REJECT' ? t('request_rejected') : t('request_approved'));
            setGmDocs(prev => { const n = { ...prev }; delete n[step.id]; return n; });
            fetchData();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('failed_to_update_status'));
        } finally {
            setSubmittingStep(null);
        }
    };

    // Download the official request form (.docx) for an approver to review / sign. The backend
    // returns the right template per request type (Work Authorization, Permission, or Leave).
    const downloadRequestForm = async (requestId: string, type?: string) => {
        try {
            const blob = await staffHubService.getLeaveForm(requestId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const prefix = type === 'WORK_AUTHORIZATION'
                ? 'Work_Authorization'
                : (['LATE_COMING', 'EARLY_LEAVING', 'HOURS_LEAVE'].includes(type || '') ? 'Permission_Request' : 'Leave_Request');
            a.download = `${prefix}_${requestId.slice(0, 8)}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error(t('leave_form_failed', { defaultValue: 'Failed to generate the form.' }));
        }
    };

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('title', newAnnounce.title);
            formData.append('content', newAnnounce.content);
            formData.append('targetType', newAnnounce.targetType);
            if (newAnnounce.targetId) formData.append('targetId', newAnnounce.targetId);
            if (newAnnounce.expiryDate) formData.append('expiryDate', newAnnounce.expiryDate);
            if (attachmentFile) formData.append('attachment', attachmentFile);

            if (editingAnnouncement) {
                await staffHubService.updateAnnouncement(editingAnnouncement.id, formData);
                toast.success(t('announcement_updated'));
            } else {
                await staffHubService.createAnnouncement(formData);
                toast.success(t('announcement_posted'));
            }
            
            setNewAnnounce({ title: '', content: '', targetType: 'GLOBAL', targetId: '', expiryDate: '' });
            setAttachmentFile(null);
            setEditingAnnouncement(null);
            loadAnnouncements();
        } catch (error) {
            toast.error(editingAnnouncement ? t('failed_to_update_announcement') : t('failed_to_post_announcement'));
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (await confirm({ message: t('confirm_delete_announcement'), danger: true })) {
            try {
                await staffHubService.deleteAnnouncement(id);
                toast.success(t('announcement_deleted'));
                loadAnnouncements();
            } catch (error) {
                toast.error(t('failed_to_delete_announcement'));
            }
        }
    };

    const handleEditClick = (ann: any) => {
        setEditingAnnouncement(ann);
        setNewAnnounce({
            title: ann.title,
            content: ann.content,
            targetType: ann.targetType,
            targetId: ann.targetId || '',
            expiryDate: ann.expiryDate ? new Date(ann.expiryDate).toISOString().split('T')[0] : ''
        });
        setAttachmentFile(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">{t('loading_approvals')}</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#300a15] to-[#541c2c] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-[#e3c4a2]/20">
                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                    <LayoutDashboard className="w-48 h-48" />
                </div>
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-[#e3c4a2]/15 border border-[#e3c4a2]/25 items-center justify-center shadow-inner shrink-0">
                            <LayoutDashboard className="w-7 h-7 text-[#e3c4a2]" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-1">{t('manager_control_room', { defaultValue: 'Manager Control Room' })}</h1>
                            <p className="text-[#e3c4a2]/70 font-light text-base md:text-lg">{t('manage_approvals_desc')}</p>
                        </div>
                    </div>
                    {/* Quick stats — a glance at how much is on this desk right now. */}
                    <div className="flex flex-wrap gap-3">
                        <div className="rounded-2xl bg-[#e3c4a2]/10 border border-[#e3c4a2]/20 px-4 py-3 min-w-[116px] backdrop-blur-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#e3c4a2]/60">{t('awaiting_you', { defaultValue: 'Awaiting You' })}</p>
                            <p className="text-2xl font-black text-white">{pendingSteps.length + pendingRequests.length}</p>
                        </div>
                        <div className="rounded-2xl bg-[#e3c4a2]/10 border border-[#e3c4a2]/20 px-4 py-3 min-w-[116px] backdrop-blur-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#e3c4a2]/60">{t('in_history', { defaultValue: 'In History' })}</p>
                            <p className="text-2xl font-black text-white">{historyRequests.length}</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mt-8 pb-2 overflow-x-auto">
                    {[
                        { id: 'requests', label: t('leave_requests'), icon: Calendar, count: pendingRequests.length + pendingSteps.length, visible: currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('manage_leaves') || currentUser?.permissions?.includes('manager_approvals') || currentUser?.permissions?.includes('approve_attendance') || currentUser?.permissions?.includes('approve_gm') },
                        { id: 'history', label: t('request_history'), icon: Archive, visible: currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('manage_leaves') || currentUser?.permissions?.includes('manager_approvals') || currentUser?.permissions?.includes('approve_attendance') || currentUser?.permissions?.includes('approve_gm') },
                        {
                            id: 'announcements',
                            label: t('broadcasting'), 
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
                    <div className="space-y-8">
                    {/* Leave requests (PAID_HOLIDAY/UNPAID_LEAVE/EMERGENCY_LEAVE) — org-based
                        approval chain, one card per step currently awaiting this user. */}
                    {pendingSteps.length > 0 && (
                        <div className="grid grid-cols-1 gap-6">
                            {pendingSteps.map(step => {
                                const req = step.leaveRequest;
                                if (!req) return null;
                                return (
                                    <div key={step.id} className="bg-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-lg transition-all border border-slate-100 group">
                                        <div className="flex items-center gap-6 w-full md:w-auto">
                                            <div className="w-16 h-16 rounded-2xl bg-[#511d29]/5 flex flex-col items-center justify-center font-bold text-[#511d29] border border-[#511d29]/10 shadow-inner">
                                                <span className="text-[10px] uppercase font-bold">{format(new Date(req.startDate), 'MMM')}</span>
                                                <span className="text-xl font-black">{format(new Date(req.startDate), 'dd')}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-xl font-bold text-slate-800 truncate">{(req as any).employee?.fullName || t('unknown_staff')}</h3>
                                                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                    <span className="text-amber-700">{t(req.type.toLowerCase())}</span>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                    <span className="flex items-center gap-1 text-slate-400">
                                                        <Clock className="w-3 h-3" />
                                                        {format(new Date(req.startDate), 'MMM dd')}
                                                        {req.endDate && ` → ${format(new Date(req.endDate), 'MMM dd')}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-3">
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-sm text-slate-600">
                                                "{req.reason || t('no_specific_reason')}"
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                                {(() => {
                                                    // Smart signature: a single approval can fill several printed rows
                                                    // (e.g. you are both the direct manager and the division head).
                                                    const roles = (step.coversStages && step.coversStages.length > 0)
                                                        ? step.coversStages.map(s => STAGE_LABELS[s] || s)
                                                        : [STAGE_LABELS[step.stage] || step.stage];
                                                    return `Awaiting your approval as ${roles.join(' + ')}`;
                                                })()}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 w-full md:w-auto">
                                            {/* Download the form to review (and, for the GM, to sign
                                                before uploading the signed copy). */}
                                            <button
                                                onClick={() => downloadRequestForm(step.leaveRequestId, req.type)}
                                                className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 hover:bg-indigo-100 transition-colors"
                                            >
                                                <Download className="w-4 h-4 shrink-0" />
                                                {t('download_form', { defaultValue: 'Download Form' })}
                                            </button>
                                            {step.stage === 'GENERAL_MANAGER' && (
                                                gmDocs[step.id] ? (
                                                    /* Selected — show the chosen file with a clear way to replace/remove it. */
                                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-3 py-2.5">
                                                        <FileCheck className="w-4 h-4 shrink-0" />
                                                        <span className="truncate max-w-[150px]" title={gmDocs[step.id]?.name}>{gmDocs[step.id]?.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setGmDocs(prev => { const n = { ...prev }; delete n[step.id]; return n; })}
                                                            className="ml-auto shrink-0 text-red-300 hover:text-red-200"
                                                            title={t('remove_file', { defaultValue: 'Remove' })}
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="flex items-center gap-2 text-xs font-bold text-[#e3c4a2] bg-[#300a15]/50 border border-[#e3c4a2]/25 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-[#300a15]/70 transition-colors">
                                                        <Paperclip className="w-4 h-4 shrink-0" />
                                                        <span className="truncate max-w-[180px]">
                                                            {t('upload_document_required', { defaultValue: 'Upload document (required)' })}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                            className="hidden"
                                                            onChange={e => setGmDocs(prev => ({ ...prev, [step.id]: e.target.files?.[0] || null }))}
                                                        />
                                                    </label>
                                                )
                                            )}
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleStepDecision(step, 'APPROVE')}
                                                    disabled={(step.stage === 'GENERAL_MANAGER' && !gmDocs[step.id]) || submittingStep === step.id}
                                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-900/30 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                >
                                                    <Check className="w-5 h-5" />
                                                    {submittingStep === step.id ? t('submitting', { defaultValue: 'Submitting…' }) : t('approve', { defaultValue: 'Approve' })}
                                                </button>
                                                <button
                                                    disabled={submittingStep === step.id}
                                                    onClick={async () => {
                                                        const note = await prompt({
                                                            title: t('reject_request', { defaultValue: 'Reject Request' }),
                                                            message: t('add_rejection_note'),
                                                            placeholder: t('rejection_note_placeholder', { defaultValue: 'Reason for rejection (optional)' }),
                                                            multiline: true,
                                                            confirmText: t('reject', { defaultValue: 'Reject' }),
                                                        });
                                                        if (note === null) return; // cancelled — don't reject
                                                        handleStepDecision(step, 'REJECT', note);
                                                    }}
                                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#300a15] text-red-400 border border-red-900/30 px-6 py-3 rounded-2xl font-bold hover:bg-red-950/20 hover:text-red-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                    {t('reject', { defaultValue: 'Reject' })}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6">
                        {pendingRequests.length > 0 ? pendingRequests.map(req => (
                             <div key={req.id} className="glass-card p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-2xl transition-all border border-[#e3c4a2]/15 group">
                                 <div className="flex items-center gap-6 w-full md:w-auto">
                                     <div className="w-16 h-16 rounded-2xl bg-[#e3c4a2]/15 flex flex-col items-center justify-center font-bold text-[#e3c4a2] border border-[#e3c4a2]/20 shadow-inner">
                                         <span className="text-[10px] uppercase font-bold text-[#aa7a51]">{format(new Date(req.startDate), 'MMM')}</span>
                                         <span className="text-xl">{format(new Date(req.startDate), 'dd')}</span>
                                     </div>
                                     <div className="space-y-1">
                                         <h3 className="text-xl font-bold text-white truncate">{(req as any).employee?.fullName || t('unknown_staff')}</h3>
                                         <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                             <span className="text-[#aa7a51]">{t(req.type.toLowerCase())}</span>
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
                                         "{req.reason || t('no_specific_reason')}"
                                     </div>
                                     
                                     {/* Approval Timeline */}
                                     <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider overflow-x-auto pb-1">
                                         <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${req.status !== 'PENDING' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' : 'bg-[#541c2c]/40 text-[#e3c4a2]/50 border-[#e3c4a2]/10'}`}>
                                             <div className={`w-2 h-2 rounded-full ${req.status !== 'PENDING' ? 'bg-emerald-500' : 'bg-[#aa7a51]/50'}`}></div>
                                             Unit: {(req as any).unitApprovedBy?.fullName || t('pending')}
                                         </div>
                                         <div className="w-4 h-[1px] bg-[#e3c4a2]/20"></div>
                                         <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${['APPROVED_BY_DEPT', 'APPROVED_BY_DIVISION', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' : 'bg-[#541c2c]/40 text-[#e3c4a2]/50 border-[#e3c4a2]/10'}`}>
                                             <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DEPT', 'APPROVED_BY_DIVISION', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-[#aa7a51]/50'}`}></div>
                                             Dept: {(req as any).deptApprovedBy?.fullName || t('pending')}
                                         </div>
                                         <div className="w-4 h-[1px] bg-[#e3c4a2]/20"></div>
                                         <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${['APPROVED_BY_DIVISION', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' : 'bg-[#541c2c]/40 text-[#e3c4a2]/50 border-[#e3c4a2]/10'}`}>
                                             <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DIVISION', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-[#aa7a51]/50'}`}></div>
                                             Division: {(req as any).divisionApprovedBy?.fullName || t('pending')}
                                         </div>
                                         <div className="w-4 h-[1px] bg-[#e3c4a2]/20"></div>
                                         <div className={`flex items-center gap-1 p-1.5 rounded-lg border ${['APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' : 'bg-[#541c2c]/40 text-[#e3c4a2]/50 border-[#e3c4a2]/10'}`}>
                                             <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-[#aa7a51]/50'}`}></div>
                                             Director: {(req as any).directorApprovedBy?.fullName || t('pending')}
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
                                         onClick={async () => {
                                             const note = await prompt({
                                                 title: t('reject_request', { defaultValue: 'Reject Request' }),
                                                 message: t('add_rejection_note'),
                                                 placeholder: t('rejection_note_placeholder', { defaultValue: 'Reason for rejection (optional)' }),
                                                 multiline: true,
                                                 confirmText: t('reject', { defaultValue: 'Reject' }),
                                             });
                                             if (note === null) return; // cancelled — don't reject
                                             handleRequestAction(req.id, 'REJECT', note);
                                         }}
                                         className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#300a15] text-red-400 border border-red-900/30 px-6 py-3 rounded-2xl font-bold hover:bg-red-950/20 hover:text-red-300 transition-all"
                                     >
                                         <XCircle className="w-5 h-5" />
                                         Reject
                                     </button>
                                 </div>
                             </div>
                        )) : (pendingSteps.length === 0 && (
                            <div className="text-center py-24 glass-card rounded-3xl animate-in zoom-in">
                                <Archive className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-slate-800">{t('inbox_zero')}</h3>
                                <p className="text-slate-400">{t('no_pending_leave_requests')}</p>
                            </div>
                        ))}
                    </div>
                    </div>
                )}

                {/* Request History Tab */}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-slate-800">{t('decision_archive')}</h2>
                            <p className="text-slate-400 text-sm">{historyRequests.length} {t('historical_records')}</p>
                        </div>
                        
                        <div className="grid gap-4">
                            {historyRequests.map(req => (
                                <div key={req.id} className="bg-white rounded-3xl p-6 border border-slate-100 flex flex-col md:flex-row items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-14 h-14 rounded-2xl bg-[#511d29]/5 flex flex-col items-center justify-center text-[#511d29] border border-[#511d29]/10">
                                        <span className="text-[8px] font-bold uppercase">{format(new Date(req.startDate), 'MMM')}</span>
                                        <span className="text-lg font-black">{format(new Date(req.startDate), 'dd')}</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800">{(req as any).employee?.fullName || t('staff_member')}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                req.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-medium">{t(req.type.toLowerCase())} • {format(new Date(req.startDate), 'PPP')}</div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-xl flex-1 max-w-md italic text-xs text-slate-500 border border-slate-100">
                                        "{req.reason || t('no_specific_note')}"
                                    </div>

                                    {/* Uploaded final document (the GM's signed copy) — shown so the decision
                                        archive links straight to the document instead of re-generating a form. */}
                                    {req.finalDocumentUrl ? (
                                        <a
                                            href={`${SERVER_URL}${req.finalDocumentUrl}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            title={req.finalDocumentName || t('final_document', { defaultValue: 'Final Document' })}
                                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors"
                                        >
                                            <FileCheck className="w-4 h-4" /> {t('view_document', { defaultValue: 'View Document' })}
                                        </a>
                                    ) : req.status === 'COMPLETED' && (
                                        <button
                                            onClick={() => downloadRequestForm(req.id, req.type)}
                                            title={t('download_form', { defaultValue: 'Download Form' })}
                                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                                        >
                                            <Download className="w-4 h-4" /> {t('form', { defaultValue: 'Form' })}
                                        </button>
                                    )}

                                    {/* History Status Nodes */}
                                    <div className="flex items-center gap-2 text-[8px] font-bold uppercase text-slate-400">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${req.status !== 'PENDING' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="text-slate-400">{t('unit_approval')}</span>
                                        </div>
                                        <div className="w-3 h-[1px] bg-slate-200"></div>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DEPT', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="text-slate-400">{t('dept_approval')}</span>
                                        </div>
                                        <div className="w-3 h-[1px] bg-slate-200"></div>
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="text-slate-400">{t('dir_approval')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {historyRequests.length === 0 && (
                                <div className="py-20 text-center glass-card rounded-3xl text-slate-400 italic">No {t('historical_records')} found.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Announcement Tab */}
                {activeTab === 'announcements' && (['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT'].includes(currentUser?.role || '') || (currentUser?.permissions || []).includes('manage_announcements')) && (
                    <div className="max-w-3xl mx-auto">
                        <div className="glass-card p-10 rounded-[2.5rem] shadow-xl">
                            <form onSubmit={handleCreateAnnouncement} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('broadcast_title')}</label>
                                    <input 
                                        type="text" 
                                        placeholder={t('important_office_policy')}
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-indigo-500/20"
                                        value={newAnnounce.title}
                                        onChange={e => setNewAnnounce({...newAnnounce, title: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('target_audience')}</label>
                                        <select 
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold"
                                            value={newAnnounce.targetType}
                                            onChange={e => setNewAnnounce({...newAnnounce, targetType: e.target.value, targetId: ''})}
                                        >
                                            <option value="GLOBAL">{t('global_everyone')}</option>
                                            <option value="DEPARTMENT">{t('specific_department')}</option>
                                            <option value="INDIVIDUAL">{t('private_individual')}</option>
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('select_target')}</label>
                                        <select 
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold"
                                            value={newAnnounce.targetId}
                                            onChange={e => setNewAnnounce({...newAnnounce, targetId: e.target.value})}
                                            disabled={newAnnounce.targetType === 'GLOBAL'}
                                        >
                                            <option value="">{t('choose_target')}</option>
                                            {newAnnounce.targetType === 'DEPARTMENT' 
                                                ? departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                                : employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)
                                            }
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('expiry_date_optional')}</label>
                                        <input 
                                            type="date"
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-600"
                                            value={newAnnounce.expiryDate}
                                            onChange={e => setNewAnnounce({...newAnnounce, expiryDate: e.target.value})}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('attach_document')}</label>
                                        <input 
                                            type="file"
                                            className="w-full bg-slate-50 border-none rounded-2xl p-3 font-bold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 text-sm text-slate-500"
                                            onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                                        />
                                        {editingAnnouncement && editingAnnouncement.attachmentName && !attachmentFile && (
                                            <div className="text-xs font-medium text-slate-500 ml-2">Current: {editingAnnouncement.attachmentName}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t('broadcast_message')}</label>
                                    <textarea 
                                        placeholder={t('type_announcement_here')}
                                        className="w-full bg-slate-50 border-none rounded-2xl p-6 min-h-[200px] font-medium leading-relaxed"
                                        value={newAnnounce.content}
                                        onChange={e => setNewAnnounce({...newAnnounce, content: e.target.value})}
                                        required
                                    />
                                </div>

                                <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                                    {editingAnnouncement ? <Edit className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
                                    {editingAnnouncement ? t('edit_announcement') : t('broadcast_announcement')}
                                </button>
                                {editingAnnouncement && (
                                    <button type="button" onClick={() => { setEditingAnnouncement(null); setNewAnnounce({ title: '', content: '', targetType: 'GLOBAL', targetId: '', expiryDate: '' }); setAttachmentFile(null); }} className="w-full bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all mt-4">
                                        {t('cancel')}
                                    </button>
                                )}
                            </form>
                        </div>

                        <div className="mt-12 space-y-6">
                            <h2 className="text-2xl font-bold text-slate-800 px-2">{t('posted_announcements')}</h2>
                            {announcements.length === 0 ? (
                                <div className="text-center p-12 glass-card rounded-3xl text-slate-500 font-medium">
                                    {t('no_announcements_posted')}
                                </div>
                            ) : (
                                announcements.map(ann => (
                                    <div key={ann.id} className="glass-card p-6 rounded-3xl space-y-4 hover:shadow-xl transition-all border border-slate-100">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-2 flex-1">
                                                <h3 className="text-lg font-bold text-slate-800">{ann.title}</h3>
                                                <div className="flex flex-wrap gap-2 text-xs font-bold">
                                                    <span className={`px-2 py-1 rounded-md ${ann.targetType === 'GLOBAL' ? 'bg-blue-100 text-blue-700' : ann.targetType === 'DEPARTMENT' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700'}`}>
                                                        {ann.targetType === 'GLOBAL' ? t('target_global') : ann.targetType === 'DEPARTMENT' ? t('target_dept') : t('target_individual')}
                                                    </span>
                                                    {ann.expiryDate && (
                                                        <span className="bg-red-50 text-red-600 px-2 py-1 rounded-md flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Exp: {new Date(ann.expiryDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => handleEditClick(ann)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-all" title={t('edit')}>
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteAnnouncement(ann.id)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all" title={t('delete')}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">{ann.content}</p>
                                        
                                        {ann.attachmentUrl && (
                                            <div className="pt-4 border-t border-slate-100">
                                                <a href={`${SERVER_URL}${ann.attachmentUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all">
                                                    <Paperclip className="w-4 h-4" />
                                                    <span className="truncate max-w-[200px]">{ann.attachmentName || t('download_attachment')}</span>
                                                    <Download className="w-4 h-4 ml-1 opacity-50" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
                </main>
            </div>
        );
};


export default Approvals;
