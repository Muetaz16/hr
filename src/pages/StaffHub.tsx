import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { staffHubService } from '../services/staffHubService';
import type { LeaveRequest, LeaveRequestWithEmployee } from '../services/staffHubService';
import { employeeService } from '../services/employeeService';
import {
    Calendar,
    Send,
    ClipboardList,
    Plus,
    X,
    Megaphone,
    Paperclip,
    CheckCircle2,
    Clock,
    XCircle,
    MinusCircle,
    FileDown,
    UserCheck,
    Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Employee } from '../types';

// Human-readable labels for the org approval-chain stages, shown in each request's progress trail.
const STAGE_LABELS: Record<string, string> = {
    HEAD_ATTENDANCE: 'Head of Attendance',
    DIRECT_SUPERVISOR: 'Direct Supervisor',
    UNIT_HEAD: 'Unit Head',
    DEPT_HEAD: 'Department Head',
    DIVISION_HEAD: 'Division Head',
    HR_MANAGER: 'HR Manager',
    DIRECTORATE: 'Directorate',
    GENERAL_MANAGER: 'General Manager',
};

const StaffHub: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [employeeRecord, setEmployeeRecord] = useState<Employee | null>(null);
    // Replacement (cover) employee nomination.
    const [replacementCandidates, setReplacementCandidates] = useState<{ userId: string; employeeId: string; fullName: string; position: string }[]>([]);
    const [replacementUserId, setReplacementUserId] = useState('');
    // Requests where I've been nominated as someone's replacement and must accept/decline.
    const [myReplacementRequests, setMyReplacementRequests] = useState<LeaveRequestWithEmployee[]>([]);
    const [deciding, setDeciding] = useState<string | null>(null);

    // Leave types that use the org approval chain and therefore require a replacement.
    const CHAIN_TYPES = ['PAID_HOLIDAY', 'UNPAID_LEAVE', 'EMERGENCY_LEAVE'];

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
    const [requestFile, setRequestFile] = useState<File | null>(null);

    const resetRequestForm = () => {
        setNewRequest({
            type: 'PAID_HOLIDAY',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: '',
            startTime: '',
            endTime: '',
            reason: ''
        });
        setRequestFile(null);
        setReplacementUserId('');
    };

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
                setEmployeeRecord(me);

                const [requestData, candidates, replacementReqs] = await Promise.all([
                    staffHubService.getMyRequests(me.id).catch(err => {
                        console.error("Staff Hub requests load failure:", err);
                        return [];
                    }),
                    staffHubService.getReplacementCandidates(me.id).catch(() => []),
                    staffHubService.getMyReplacementRequests().catch(() => []),
                ]);
                setRequests(requestData);
                setReplacementCandidates(candidates);
                setMyReplacementRequests(replacementReqs);
            }
        } catch (error) {
            console.error("Staff Hub critical failure:", error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId || !currentUser) return;

        // Emergency leave cannot be requested without a supporting document
        if (newRequest.type === 'EMERGENCY_LEAVE' && !requestFile) {
            toast.error(t('err_emergency_doc_required'));
            return;
        }

        // Replacement is optional: a chosen colleague must accept (and sign); "N/A" (empty) means no
        // replacement and no replacement approval.
        const hasReplacement = CHAIN_TYPES.includes(newRequest.type) && !!replacementUserId;

        try {
            const formData = new FormData();
            formData.append('employeeId', employeeId);
            formData.append('userId', currentUser.id);
            formData.append('type', newRequest.type);
            formData.append('startDate', newRequest.startDate);
            if (newRequest.endDate) formData.append('endDate', newRequest.endDate);
            if (newRequest.startTime) formData.append('startTime', newRequest.startTime);
            if (newRequest.endTime) formData.append('endTime', newRequest.endTime);
            if (newRequest.reason) formData.append('reason', newRequest.reason);
            if (hasReplacement) formData.append('replacementUserId', replacementUserId);
            if (requestFile) formData.append('attachment', requestFile);

            await staffHubService.createRequest(formData);
            toast.success(t('req_submitted_success'));
            setShowRequestModal(false);
            resetRequestForm();
            fetchInitialData();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('err_submit_req'));
        }
    };

    const handleReplacementDecision = async (requestId: string, decision: 'ACCEPT' | 'DECLINE') => {
        setDeciding(requestId);
        try {
            await staffHubService.decideReplacement(requestId, decision);
            toast.success(decision === 'ACCEPT'
                ? t('replacement_accepted_toast', { defaultValue: 'Accepted — your signature will be added to the leave form.' })
                : t('replacement_declined_toast', { defaultValue: 'Declined. The request was cancelled.' }));
            setMyReplacementRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('err_generic', { defaultValue: 'Something went wrong.' }));
        } finally {
            setDeciding(null);
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">{t("loading_staff_hub")}</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
             {/* Header */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                     <h1 className="text-3xl font-bold tracking-tight flex items-center gap-4">
                         {t("staff_hub")}
                         {employeeRecord && (
                             <span className="text-sm font-black bg-gradient-to-r from-amber-200 to-amber-400 text-amber-900 px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                                 ★ {t("evaluation_index", { defaultValue: 'Index' })}: {(employeeRecord.evaluationPoints || 0).toFixed(2)}
                             </span>
                         )}
                     </h1>
                     <p className="text-slate-500">{t("staff_hub_subtitle")}</p>
                 </div>
                 <div className="flex gap-3">
                     {(isManager || currentUser?.permissions?.includes('manage_leaves')) && (
                         <button
                             onClick={() => navigate('/approvals')}
                             className="flex items-center gap-2 bg-[#300a15] text-[#e3c4a2] border border-[#e3c4a2]/15 px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-[#541c2c]/40 hover:scale-[1.02] transition-all active:scale-95"
                         >
                             <ClipboardList className="w-5 h-5" />
                             {t("approvals")}
                         </button>
                     )}
                     {(isManager || currentUser?.permissions?.includes('manage_announcements')) && (
                         <button
                             onClick={() => {
                                 navigate('/approvals');
                             }}
                             className="flex items-center gap-2 bg-[#541c2c]/40 text-[#e3c4a2]/80 border border-[#e3c4a2]/15 px-6 py-3 rounded-2xl font-bold hover:bg-[#541c2c]/75 hover:text-white transition-all active:scale-95"
                         >
                             <Megaphone className="w-5 h-5" />
                             {t("post_notice")}
                         </button>
                     )}
                     <button
                         onClick={() => setShowRequestModal(true)}
                         className="flex items-center gap-2 bg-[#aa7a51] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#aa7a51]/25 hover:bg-[#aa7a51]/85 transition-all active:scale-95"
                     >
                         <Plus className="w-5 h-5" />
                         {t("new_request")}
                     </button>
                 </div>
             </div>

            {/* Replacement nominations awaiting my acceptance — these block a colleague's leave chain. */}
            {myReplacementRequests.length > 0 && (
                <section className="glass-card p-6 rounded-3xl border-2 border-amber-200 bg-amber-50/40">
                    <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-amber-600" />
                        {t("replacement_requests_title", { defaultValue: 'Replacement Requests For You' })}
                    </h2>
                    <p className="text-sm text-slate-500 mb-5">
                        {t("replacement_requests_subtitle", { defaultValue: 'A colleague nominated you to cover their leave. Accepting adds your saved signature to their form and lets their approvals proceed.' })}
                    </p>
                    <div className="space-y-3">
                        {myReplacementRequests.map(req => (
                            <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white/70 border border-amber-100 rounded-2xl">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{req.employee?.fullName || t('a_colleague', { defaultValue: 'A colleague' })}</p>
                                    <p className="text-xs text-slate-500">
                                        {t(req.type.toLowerCase())} · {req.startDate?.slice(0, 10)}{req.endDate ? ` → ${req.endDate.slice(0, 10)}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleReplacementDecision(req.id, 'ACCEPT')}
                                        disabled={deciding === req.id}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {t("accept", { defaultValue: 'Accept' })}
                                    </button>
                                    <button
                                        onClick={() => handleReplacementDecision(req.id, 'DECLINE')}
                                        disabled={deciding === req.id}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        {t("decline", { defaultValue: 'Decline' })}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* My Requests */}
            <section className="glass-card p-6 rounded-3xl flex flex-col">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    {t("my_requests")}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {requests.length > 0 ? requests.map(req => (
                        <div key={req.id} className="p-4 bg-white/40 border border-white/60 rounded-2xl space-y-2">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t(req.type.toLowerCase())}</span>
                                <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${req.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' :
                                        req.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                                            req.status.startsWith('APPROVED_BY_') ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                    }`}>
                                    {t(req.status.toLowerCase())}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {format(new Date(req.startDate), 'MMM dd, yyyy')}
                                {req.endDate && <span className="text-slate-300">→</span>}
                                {req.endDate && format(new Date(req.endDate), 'MMM dd')}
                            </div>
                            {/* Blocked on the replacement's acceptance — the approval chain won't start
                                until they accept. */}
                            {req.status === 'PENDING' && req.replacementStatus === 'PENDING' && (
                                <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-amber-600">
                                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>{t('awaiting_replacement', { defaultValue: 'Waiting for replacement to accept' })}</span>
                                </div>
                            )}
                            {/* Approval trail — shows exactly where the request sits in the chain. The
                                first still-pending step is the desk it's on right now. */}
                            {req.approvalSteps && req.approvalSteps.length > 0 && (() => {
                                const steps = req.approvalSteps.filter(s => s.status !== 'SKIPPED');
                                const currentId = steps.find(s => s.status === 'PENDING')?.id;
                                return (
                                    <div className="mt-3 pt-3 border-t border-slate-200/70 space-y-1.5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('approval_progress', { defaultValue: 'Approval Progress' })}</p>
                                        {steps.map(s => {
                                            const isCurrent = s.id === currentId;
                                            const Icon = s.status === 'APPROVED' ? CheckCircle2 : s.status === 'REJECTED' ? XCircle : isCurrent ? Clock : MinusCircle;
                                            const color = s.status === 'APPROVED' ? 'text-emerald-500' : s.status === 'REJECTED' ? 'text-red-500' : isCurrent ? 'text-orange-500' : 'text-slate-300';
                                            return (
                                                <div key={s.id} className={`flex items-center gap-2 text-xs ${isCurrent ? 'font-bold text-slate-700' : 'font-semibold text-slate-500'}`}>
                                                    <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                                                    <span className="shrink-0">{STAGE_LABELS[s.stage] || s.stage}</span>
                                                    {s.approver?.fullName && <span className="text-slate-400 truncate">· {s.approver.fullName}</span>}
                                                    {isCurrent && <span className="ml-auto shrink-0 text-[9px] font-black text-orange-500 uppercase tracking-wider">{t('current', { defaultValue: 'Now' })}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                            {req.managerNote && (
                                <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs italic text-slate-500 border-l-2 border-slate-200">
                                    {t("manager_note")} {req.managerNote}
                                </div>
                            )}
                            {req.approvalSteps && req.approvalSteps.length > 0 && (
                                <button
                                    onClick={async () => {
                                        try {
                                            const blob = await staffHubService.getLeaveForm(req.id);
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `Leave_Request_${req.id.slice(0, 8)}.docx`;
                                            a.click();
                                            window.URL.revokeObjectURL(url);
                                        } catch {
                                            toast.error(t('leave_form_failed', { defaultValue: 'Failed to generate the leave form.' }));
                                        }
                                    }}
                                    className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                                >
                                    <FileDown className="w-3.5 h-3.5" /> {t('download_form', { defaultValue: 'Download Form' })}
                                </button>
                            )}
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-12 text-slate-400 font-medium italic">{t("no_requests_yet")}</div>
                    )}
                </div>
            </section>

            {/* Request Modal */}
            {showRequestModal && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowRequestModal(false); resetRequestForm(); } }}
                >
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain animate-in zoom-in-95 fade-in duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-br from-slate-50 to-white sticky top-0 z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">{t("new_request")}</h2>
                                <p className="text-slate-500 text-sm">{t("fill_details_below")}</p>
                            </div>
                            <button onClick={() => { setShowRequestModal(false); resetRequestForm(); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitRequest} className="p-8 space-y-6">
                            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs font-medium text-amber-800 leading-relaxed">
                                    {t("exception_request_note", { defaultValue: 'Note: Exception requests can be done outside the system, and must be aligned with company policy.' })}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("request_type")}</label>
                                    <select
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newRequest.type}
                                        onChange={e => setNewRequest({ ...newRequest, type: e.target.value, startTime: '', endTime: '' })}
                                    >
                                        <option value="PAID_HOLIDAY">{t("paid_holiday")}</option>
                                        <option value="UNPAID_LEAVE">{t("unpaid_leave")}</option>
                                        <option value="EMERGENCY_LEAVE">{t("emergency_leave")}</option>
                                        <option value="LATE_COMING">{t("late_coming")}</option>
                                        <option value="EARLY_LEAVING">{t("early_leaving")}</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("start_date")}</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newRequest.startDate}
                                        onChange={e => setNewRequest({ ...newRequest, startDate: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("end_date_optional")}</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        value={newRequest.endDate}
                                        onChange={e => setNewRequest({ ...newRequest, endDate: e.target.value })}
                                    />
                                </div>

                                {newRequest.type === 'HOURS_LEAVE' ? (
                                    /* Few Hours Permission — a time window (from → to). */
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("from_time", { defaultValue: 'From (Time)' })}</label>
                                            <input
                                                type="time"
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                value={newRequest.startTime}
                                                onChange={e => setNewRequest({ ...newRequest, startTime: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("to_time", { defaultValue: 'To (Time)' })}</label>
                                            <input
                                                type="time"
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                value={newRequest.endTime}
                                                onChange={e => setNewRequest({ ...newRequest, endTime: e.target.value })}
                                            />
                                        </div>
                                    </>
                                ) : (newRequest.type === 'EARLY_LEAVING' || newRequest.type === 'LATE_COMING') ? (
                                    /* A single time: when you leave (Early Departure) or arrive (Late Arrival). */
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            {newRequest.type === 'EARLY_LEAVING'
                                                ? t("departure_time", { defaultValue: 'Departure Time (when you leave)' })
                                                : t("arrival_time", { defaultValue: 'Arrival Time (when you arrive)' })}
                                        </label>
                                        <input
                                            type="time"
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                            value={newRequest.startTime}
                                            onChange={e => setNewRequest({ ...newRequest, startTime: e.target.value })}
                                        />
                                    </div>
                                ) : null}

                                {/* Replacement (cover) employee — required for chain leave types when
                                    the requester has a colleague; skipped when they're the only one. */}
                                {CHAIN_TYPES.includes(newRequest.type) && (
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            {t("replacement_employee", { defaultValue: 'Replacement Employee' })}
                                        </label>
                                        <select
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                            value={replacementUserId}
                                            onChange={e => setReplacementUserId(e.target.value)}
                                        >
                                            <option value="">{t("replacement_na", { defaultValue: 'N/A — No replacement needed' })}</option>
                                            {replacementCandidates.map(c => (
                                                <option key={c.userId} value={c.userId}>
                                                    {c.fullName}{c.position ? ` — ${c.position}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            {replacementUserId
                                                ? t("replacement_hint", { defaultValue: 'They will be notified and must accept to add their signature before your request goes to approvals.' })
                                                : t("replacement_na_hint", { defaultValue: 'No replacement — the request goes straight to approvals, no replacement acceptance required.' })}
                                        </p>
                                    </div>
                                )}

                                <div className="col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("reason_note")}</label>
                                    <textarea
                                        placeholder={t("add_brief_note")}
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 h-24"
                                        value={newRequest.reason}
                                        onChange={e => setNewRequest({ ...newRequest, reason: e.target.value })}
                                    />
                                </div>

                                {/* Supporting document — required for emergency leave */}
                                <div className="col-span-2 space-y-2">
                                    <label className={`text-xs font-bold uppercase tracking-widest ${newRequest.type === 'EMERGENCY_LEAVE' ? 'text-amber-600' : 'text-slate-400'}`}>
                                        {newRequest.type === 'EMERGENCY_LEAVE' ? t("supporting_document_required") : t("supporting_document")}
                                    </label>
                                    {newRequest.type === 'EMERGENCY_LEAVE' && (
                                        <p className="text-xs text-amber-600/80 leading-relaxed">{t("emergency_doc_hint")}</p>
                                    )}
                                    {requestFile ? (
                                        <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Paperclip className="w-5 h-5 text-indigo-500 shrink-0" />
                                                <span className="text-sm font-medium text-slate-700 truncate">{requestFile.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setRequestFile(null)}
                                                className="text-xs font-bold text-red-500 hover:text-red-600 shrink-0"
                                            >
                                                {t("remove_file")}
                                            </button>
                                        </div>
                                    ) : (
                                        <label className={`flex flex-col items-center justify-center gap-1 w-full rounded-2xl p-6 cursor-pointer border-2 border-dashed transition-colors ${newRequest.type === 'EMERGENCY_LEAVE' ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500'}`}>
                                            <Paperclip className="w-5 h-5" />
                                            <span className="text-sm font-semibold">{t("click_to_upload")}</span>
                                            <span className="text-[11px] opacity-70">{t("upload_file_types")}</span>
                                            <input
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className="hidden"
                                                onChange={e => setRequestFile(e.target.files?.[0] || null)}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={newRequest.type === 'EMERGENCY_LEAVE' && !requestFile}
                                className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.01] transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-indigo-600"
                            >
                                <Send className="w-5 h-5" />
                                {t("submit_request")}
                            </button>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default StaffHub;
