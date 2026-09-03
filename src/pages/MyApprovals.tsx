import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { staffHubService } from '../services/staffHubService';
import type { LeaveRequest, LeaveApprovalStep, LeaveRequestWithEmployee } from '../services/staffHubService';
import { recruitmentService } from '../services/recruitmentService';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import type { RecruitmentRequest } from '../types';
import { canAccess } from '../utils/access';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { usePrompt } from '../components/PromptDialog';
import RequestHistoryTab from '../components/RequestHistoryTab';
import BroadcastingTab from '../components/BroadcastingTab';
import {
    Check,
    XCircle,
    Inbox,
    Calendar,
    Award,
    UserPlus,
    Users,
    Download,
    Paperclip,
    Clock,
    Archive,
    Megaphone,
} from 'lucide-react';

// Leave types that flow through the org-based approval-step chain (identity-scoped, fetched via
// getMyPendingSteps). Everything else is a legacy status-ladder request.
const CHAIN_LEAVE_TYPES = ['PAID_HOLIDAY', 'UNPAID_LEAVE', 'EMERGENCY_LEAVE', 'LATE_COMING', 'EARLY_LEAVING', 'HOURS_LEAVE', 'WORK_AUTHORIZATION', 'EXCEPTIONAL_PERFORMANCE', 'MISSING_PUNCH'];

const STAGE_LABEL_KEYS: Record<string, string> = {
    HEAD_ATTENDANCE: 'role_head_attendance',
    UNIT_HEAD: 'head_of_unit',
    DEPT_HEAD: 'stage_dept_head',
    DIVISION_HEAD: 'head_of_division',
    HR_MANAGER: 'hr_manager',
    DIRECTORATE: 'directorate',
    GENERAL_MANAGER: 'general_manager',
};

const TYPE_LABEL_KEYS: Record<string, string> = {
    PAID_HOLIDAY: 'leave_paid_holiday',
    UNPAID_LEAVE: 'leave_unpaid',
    EMERGENCY_LEAVE: 'leave_emergency',
    LATE_COMING: 'permission_late_coming',
    EARLY_LEAVING: 'permission_early_leaving',
    HOURS_LEAVE: 'permission_hours',
    WORK_AUTHORIZATION: 'work_authorization',
    MISSING_PUNCH: 'missing_punch',
    EXCEPTIONAL_PERFORMANCE: 'exceptional_performance',
};

// First letters of the first two words — used for the card avatar.
const initials = (name: string) => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

const PRF_STAGES = ['deptHead', 'divHead', 'hrRecruitment', 'hrManager', 'gm'] as const;
const PRF_STAGE_LABEL_KEYS: Record<string, string> = {
    deptHead: 'head_of_department', divHead: 'head_of_division_office', hrManager: 'head_of_hr',
    hrRecruitment: 'head_of_hiring_unit', gm: 'general_manager',
};

// Every category the unified inbox can surface. A category tab only renders when the current
// approver actually has ≥1 pending item in it — nothing empty is ever shown.
type Category = 'staff' | 'exceptional' | 'recruitment' | 'cover';

interface InboxItem {
    key: string;
    category: Category;
    typeLabel: string;
    title: string;          // employee name, or job title for recruitment
    subtitle: string;
    stageLabel: string;
    dateText: string;
    approveLabel: string;
    rejectLabel: string;
    needsDoc: boolean;              // GM final step must upload a signed document
    canDownload: boolean;
    // payloads (exactly one is set)
    step?: LeaveApprovalStep;
    legacy?: LeaveRequest;
    recruitment?: RecruitmentRequest;
    cover?: LeaveRequestWithEmployee;
}

const MyApprovals: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const prompt = usePrompt();

    const [items, setItems] = useState<InboxItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'approvals' | 'history' | 'broadcasting'>('approvals');
    const [activeCategory, setActiveCategory] = useState<'all' | Category>('all');
    // Broadcasting is only for those who can post announcements (same gate as the old Control Room).
    const canBroadcast = canAccess(currentUser, ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT'], ['manage_announcements']);
    const [docs, setDocs] = useState<Record<string, File | null>>({});
    const [submitting, setSubmitting] = useState<string | null>(null);

    // Recruitment eligibility mirrors Recruitment.tsx exactly.
    const isHR = canAccess(currentUser, ['HR_MANAGER'], ['manage_recruitment']);
    const isDirector = canAccess(currentUser, ['HEAD_DIRECTOR'], ['recruitment_approvals']);
    const isDivisionHead = canAccess(currentUser, ['HEAD_DIVISION'], ['recruitment_approvals']);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    const dateRange = (r?: { startDate?: string; endDate?: string }) => {
        if (!r?.startDate) return '';
        try {
            const s = format(new Date(r.startDate), 'MMM d');
            const e = r.endDate ? format(new Date(r.endDate), 'MMM d') : '';
            return e && e !== s ? `${s} → ${e}` : s;
        } catch { return ''; }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Role-scoped status filter for the legacy status-ladder leaves (mirrors Approvals.tsx).
            let statusFilter = 'PENDING';
            if (currentUser?.role === 'HEAD_DEPARTMENT') statusFilter = 'PENDING,APPROVED_BY_UNIT';
            else if (currentUser?.role === 'HEAD_DIVISION') statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT';
            else if (currentUser?.role === 'HEAD_DIRECTOR') statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT,APPROVED_BY_DIVISION';
            else if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER') statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT,APPROVED_BY_DIVISION,APPROVED_BY_DIRECTOR';

            const [steps, legacy, recruitment, coverReqs, employees, departments, myRecord] = await Promise.all([
                staffHubService.getMyPendingSteps().catch(() => [] as LeaveApprovalStep[]),
                staffHubService.getPendingRequests({
                    departmentId: currentUser?.departmentId || undefined,
                    groupId: currentUser?.groupId || undefined,
                    unitId: currentUser?.unitId || undefined,
                    divisionId: currentUser?.divisionId || undefined,
                    status: statusFilter,
                }).catch(() => [] as LeaveRequest[]),
                recruitmentService.getAllRequests().catch(() => [] as RecruitmentRequest[]),
                staffHubService.getMyReplacementRequests().catch(() => [] as LeaveRequestWithEmployee[]),
                employeeService.getAllEmployees().catch(() => [] as any[]),
                departmentService.getAllDepartments().catch(() => [] as any[]),
                employeeService.getMyEmployeeRecord().catch(() => null),
            ]);

            const empName = (employeeId: string) =>
                employees.find((e: any) => e.id === employeeId)?.fullName || t('unknown_employee', { defaultValue: 'Employee' });

            const out: InboxItem[] = [];
            const approve = t('approve', { defaultValue: 'Approve' });
            const reject = t('reject', { defaultValue: 'Reject' });

            // --- 1 & 2: org-chain approval steps (leaves, permissions, work-auth, missing-punch, and
            //     exceptional performance). The server already scoped these to this approver. ---
            for (const step of steps) {
                const type = step.leaveRequest?.type || '';
                const isExceptional = type === 'EXCEPTIONAL_PERFORMANCE';
                out.push({
                    key: `step-${step.id}`,
                    category: isExceptional ? 'exceptional' : 'staff',
                    typeLabel: t(TYPE_LABEL_KEYS[type] || 'request', { defaultValue: type.replace(/_/g, ' ') }),
                    title: step.leaveRequest?.employee?.fullName || t('unknown_employee', { defaultValue: 'Employee' }),
                    subtitle: step.leaveRequest?.reason || step.leaveRequest?.natureOfContribution || '',
                    stageLabel: t(STAGE_LABEL_KEYS[step.stage] || 'approval', { defaultValue: step.stage.replace(/_/g, ' ') }),
                    dateText: dateRange(step.leaveRequest),
                    approveLabel: approve, rejectLabel: reject,
                    needsDoc: step.stage === 'GENERAL_MANAGER',
                    canDownload: true,
                    step,
                });
            }

            // --- 3: legacy status-ladder leaves (non-chain types only) ---
            for (const r of legacy) {
                if (CHAIN_LEAVE_TYPES.includes(r.type)) continue;
                out.push({
                    key: `legacy-${r.id}`,
                    category: 'staff',
                    typeLabel: t(TYPE_LABEL_KEYS[r.type] || 'request', { defaultValue: r.type.replace(/_/g, ' ') }),
                    title: empName(r.employeeId),
                    subtitle: r.reason || '',
                    stageLabel: t('pending', { defaultValue: 'Pending' }),
                    dateText: dateRange(r),
                    approveLabel: approve, rejectLabel: reject,
                    needsDoc: false,
                    canDownload: true,
                    legacy: r,
                });
            }

            // --- 4: recruitment requisitions awaiting this approver ---
            const myDepartmentId = myRecord?.departmentId || currentUser?.departmentId || null;
            const myDivisionId = myRecord?.divisionId || departments.find((d: any) => d.id === myDepartmentId)?.divisionId || null;
            const reqDivisionId = (r: RecruitmentRequest) => r.divisionId || departments.find((d: any) => d.id === r.departmentId)?.divisionId || null;
            const prfNextStage = (r: RecruitmentRequest): string | null => {
                const a: any = (r as any).prfApprovals || {};
                return PRF_STAGES.find(s => !a[s]) || null;
            };
            const canActPrfStage = (stage: string): boolean => {
                const role = currentUser?.role;
                const perms = currentUser?.permissions || [];
                if (role === 'SUPER_ADMIN') return true;
                switch (stage) {
                    case 'deptHead': return role === 'HEAD_DEPARTMENT' || role === 'HEAD_OFFICE' || perms.includes('manage_recruitment');
                    case 'divHead': return role === 'HEAD_DIVISION' || role === 'HEAD_OFFICE' || perms.includes('recruitment_approvals');
                    case 'hrManager': return role === 'HR_MANAGER' || perms.includes('approve_hr_manager');
                    case 'hrRecruitment': return perms.includes('approve_hr_recruitment');
                    case 'gm': return role === 'GENERAL_MANAGER' || perms.includes('approve_gm');
                    default: return false;
                }
            };
            const canActOn = (r: RecruitmentRequest): { ok: boolean; stage: string | null } => {
                if (r.status === 'REJECTED' || r.status === 'FULLY_APPROVED') return { ok: false, stage: null };
                if (r.type === 'HIRE') {
                    const stage = prfNextStage(r);
                    return { ok: stage ? canActPrfStage(stage) : false, stage };
                }
                if (r.status === 'PENDING') return { ok: currentUser?.role === 'SUPER_ADMIN' || (isDivisionHead && reqDivisionId(r) === myDivisionId), stage: null };
                if (r.status === 'DEPT_APPROVED') return { ok: isHR, stage: null };
                if (r.status === 'HR_APPROVED') return { ok: isDirector, stage: null };
                return { ok: false, stage: null };
            };
            for (const r of recruitment) {
                const { ok, stage } = canActOn(r);
                if (!ok) continue;
                out.push({
                    key: `rec-${r.id}`,
                    category: 'recruitment',
                    typeLabel: r.type === 'JD_CHANGE' ? t('jd_change', { defaultValue: 'Job Description Change' }) : t('hire_requisition', { defaultValue: 'Hire Requisition' }),
                    title: r.jobTitle,
                    subtitle: r.department?.name || r.division?.name || r.reason || '',
                    stageLabel: stage ? t(PRF_STAGE_LABEL_KEYS[stage] || 'approval', { defaultValue: stage }) : t('pending', { defaultValue: 'Pending' }),
                    dateText: (() => { try { return format(new Date(r.createdAt), 'MMM d'); } catch { return ''; } })(),
                    approveLabel: approve, rejectLabel: reject,
                    needsDoc: r.type === 'HIRE' && stage === 'gm',
                    canDownload: true,
                    recruitment: r,
                });
            }

            // --- 5: cover/replacement nominations awaiting MY acceptance (any role, incl. heads) ---
            for (const r of coverReqs) {
                out.push({
                    key: `cover-${r.id}`,
                    category: 'cover',
                    typeLabel: t('cover_request', { defaultValue: 'Cover Request' }),
                    title: (r as any).employee?.fullName || empName(r.employeeId),
                    subtitle: t('nominated_you_as_cover', { defaultValue: 'Nominated you as their cover during this leave.' }),
                    stageLabel: t('your_acceptance', { defaultValue: 'Your acceptance' }),
                    dateText: dateRange(r),
                    approveLabel: t('accept', { defaultValue: 'Accept' }),
                    rejectLabel: t('decline', { defaultValue: 'Decline' }),
                    needsDoc: false,
                    canDownload: false,
                    cover: r,
                });
            }

            setItems(out);
        } catch {
            toast.error(t('failed_to_load_data', { defaultValue: 'Failed to load data.' }));
        } finally {
            setLoading(false);
        }
    };

    // --- Decision handler (reuses the exact existing services; the server re-verifies eligibility) ---
    const decide = async (item: InboxItem, decision: 'APPROVE' | 'REJECT') => {
        if (submitting) return;
        let note = '';
        if (decision === 'REJECT') {
            const res = await prompt({
                title: item.cover ? t('decline_cover', { defaultValue: 'Decline Cover Request' }) : t('reject_request', { defaultValue: 'Reject Request' }),
                message: t('add_rejection_note', { defaultValue: 'Add a note explaining the decision.' }),
                placeholder: t('rejection_note_placeholder', { defaultValue: 'Reason (optional)' }),
                multiline: true,
                confirmText: item.rejectLabel,
            });
            if (res === null) return; // cancelled
            note = res;
        }

        const doc = docs[item.key] || null;
        if (decision === 'APPROVE' && item.needsDoc && !doc) {
            toast.error(t('gm_document_required', { defaultValue: 'Please upload the signed document before approving.' }));
            return;
        }

        setSubmitting(item.key);
        try {
            if (item.step) {
                await staffHubService.decideApprovalStep(item.step.leaveRequestId, item.step.id, decision, note, item.needsDoc ? doc : null);
            } else if (item.recruitment) {
                await recruitmentService.prfApprove(item.recruitment.id, decision === 'APPROVE' ? 'approve' : 'reject', note, item.needsDoc ? doc : undefined);
            } else if (item.cover) {
                await staffHubService.decideReplacement(item.cover.id, decision === 'APPROVE' ? 'ACCEPT' : 'DECLINE');
            } else if (item.legacy) {
                let status = 'REJECTED';
                if (decision === 'APPROVE') {
                    if (currentUser?.role === 'HEAD_UNIT') status = 'APPROVED_BY_UNIT';
                    else if (currentUser?.role === 'HEAD_DEPARTMENT') status = 'APPROVED_BY_DEPT';
                    else if (currentUser?.role === 'HEAD_DIVISION') status = 'APPROVED_BY_DIVISION';
                    else if (currentUser?.role === 'HEAD_DIRECTOR') status = 'APPROVED_BY_DIRECTOR';
                    else status = 'COMPLETED';
                }
                await staffHubService.updateRequestStatus(item.legacy.id, { status, managerNote: note });
            }
            toast.success(decision === 'REJECT'
                ? t('request_rejected', { defaultValue: 'Recorded.' })
                : t('request_approved', { defaultValue: 'Approved.' }));
            setDocs(prev => { const n = { ...prev }; delete n[item.key]; return n; });
            fetchData();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('failed_to_update_status', { defaultValue: 'Failed to update.' }));
        } finally {
            setSubmitting(null);
        }
    };

    const downloadForm = async (item: InboxItem) => {
        try {
            if (item.step) {
                triggerDownload(await staffHubService.getLeaveForm(item.step.leaveRequestId), `Request_${item.step.leaveRequestId.slice(0, 8)}.docx`);
            } else if (item.legacy) {
                triggerDownload(await staffHubService.getLeaveForm(item.legacy.id), `Request_${item.legacy.id.slice(0, 8)}.docx`);
            } else if (item.recruitment) {
                triggerDownload(await recruitmentService.generatePrf(item.recruitment.id), `Requisition_${(item.recruitment.jobTitle || 'form').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`);
            }
        } catch {
            toast.error(t('leave_form_failed', { defaultValue: 'Failed to generate the form.' }));
        }
    };

    const triggerDownload = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        window.URL.revokeObjectURL(url);
    };

    const CATEGORY_META: Record<Category, { label: string; icon: React.ElementType; accent: string; dot: string; ring: string }> = {
        staff: { label: t('leaves_and_requests', { defaultValue: 'Leaves & Requests' }), icon: Calendar, accent: 'text-blue-600 bg-blue-50', dot: 'bg-blue-500', ring: 'before:bg-blue-500' },
        exceptional: { label: t('exceptional_performance', { defaultValue: 'Exceptional Performance' }), icon: Award, accent: 'text-amber-600 bg-amber-50', dot: 'bg-amber-500', ring: 'before:bg-amber-500' },
        recruitment: { label: t('nav_recruitment', { defaultValue: 'Recruitment' }), icon: UserPlus, accent: 'text-violet-600 bg-violet-50', dot: 'bg-violet-500', ring: 'before:bg-violet-500' },
        cover: { label: t('cover_requests', { defaultValue: 'Cover Requests' }), icon: Users, accent: 'text-teal-600 bg-teal-50', dot: 'bg-teal-500', ring: 'before:bg-teal-500' },
    };

    const count = (c: Category) => items.filter(i => i.category === c).length;
    // Only categories with ≥1 pending item ever render a tab — nothing empty is shown.
    const activeCategories = (Object.keys(CATEGORY_META) as Category[]).filter(c => count(c) > 0);

    // If the currently-selected tab becomes empty (e.g. after acting), fall back to "All".
    useEffect(() => {
        if (activeCategory !== 'all' && count(activeCategory) === 0) setActiveCategory('all');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory);

    const topTabs: { id: 'approvals' | 'history' | 'broadcasting'; label: string; icon: React.ElementType; visible: boolean }[] = [
        { id: 'approvals', label: t('my_approvals', { defaultValue: 'My Approvals' }), icon: Inbox, visible: true },
        { id: 'history', label: t('request_history', { defaultValue: 'Request History' }), icon: Archive, visible: true },
        { id: 'broadcasting', label: t('broadcasting', { defaultValue: 'Broadcasting' }), icon: Megaphone, visible: canBroadcast },
    ];

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#300a15] via-[#48162340] to-[#541c2c] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-[#e3c4a2]/20">
                {/* decorative watermark */}
                <Inbox className="absolute -bottom-10 -end-8 w-56 h-56 text-white/[0.03] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#e3c4a2]/15 border border-[#e3c4a2]/25 flex items-center justify-center shadow-inner shrink-0">
                            <Inbox className="w-7 h-7 text-[#e3c4a2]" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight">{t('my_approvals', { defaultValue: 'My Approvals' })}</h1>
                            <p className="text-[#e3c4a2]/70 mt-1 font-light">{t('my_approvals_sub', { defaultValue: 'Every request awaiting your decision, of every type, in one place.' })}</p>
                        </div>
                    </div>
                    <div className="ms-auto text-center bg-white/10 rounded-2xl px-6 py-3 border border-white/10 shrink-0">
                        <div className="text-4xl font-black text-[#e3c4a2] leading-none">{items.length}</div>
                        <div className="text-[10px] uppercase tracking-widest text-white/60 mt-1.5">{t('awaiting_you', { defaultValue: 'Awaiting You' })}</div>
                    </div>
                </div>
                {/* Per-category breakdown — only shown for categories that actually have items */}
                {view === 'approvals' && activeCategories.length > 0 && (
                    <div className="relative z-10 flex flex-wrap gap-2 mt-6">
                        {activeCategories.map(c => {
                            const Meta = CATEGORY_META[c];
                            return (
                                <div key={c} className="flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-xl px-3 py-1.5">
                                    <span className={`w-2 h-2 rounded-full ${Meta.dot}`} />
                                    <span className="text-xs font-semibold text-white/80">{Meta.label}</span>
                                    <span className="text-xs font-black text-[#e3c4a2]">{count(c)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Top-level view switch: Approvals inbox / Request History / Broadcasting */}
            <div className="inline-flex flex-wrap p-1 bg-white rounded-2xl border border-slate-200 shadow-sm gap-1">
                {topTabs.filter(tb => tb.visible).map(tb => (
                    <button
                        key={tb.id}
                        onClick={() => setView(tb.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${view === tb.id ? 'bg-[#541c2c] text-white shadow' : 'text-slate-500 hover:text-[#541c2c] hover:bg-slate-50'}`}
                    >
                        <tb.icon className="w-4 h-4" />
                        {tb.label}
                    </button>
                ))}
            </div>

            {view === 'history' && <RequestHistoryTab />}
            {view === 'broadcasting' && canBroadcast && <BroadcastingTab />}

            {view === 'approvals' && loading && (
                <div className="p-8 text-center animate-pulse text-slate-500">{t('loading_approvals', { defaultValue: 'Loading approvals…' })}</div>
            )}

            {/* Category filter tabs — only categories the approver actually has items in */}
            {view === 'approvals' && !loading && items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${activeCategory === 'all' ? 'bg-[#541c2c] text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#541c2c]/40'}`}
                    >
                        {t('all', { defaultValue: 'All' })}
                        <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center font-black ${activeCategory === 'all' ? 'bg-[#e3c4a2] text-[#300a15]' : 'bg-[#541c2c] text-white'}`}>{items.length}</span>
                    </button>
                    {activeCategories.map(c => {
                        const Meta = CATEGORY_META[c];
                        const n = count(c);
                        const isActive = activeCategory === c;
                        return (
                            <button
                                key={c}
                                onClick={() => setActiveCategory(c)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${isActive ? 'bg-[#541c2c] text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${Meta.dot}`} />
                                {Meta.label}
                                <span className={`text-[11px] font-black ${isActive ? 'text-[#e3c4a2]' : Meta.accent.split(' ')[0]}`}>{n}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* List */}
            {view === 'approvals' && !loading && (filtered.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center border border-slate-100">
                    <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold">{t('no_pending_approvals', { defaultValue: 'Nothing awaiting your decision. You are all caught up.' })}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(item => {
                        const Meta = CATEGORY_META[item.category];
                        const Icon = Meta.icon;
                        const busy = submitting === item.key;
                        return (
                            <div
                                key={item.key}
                                className={`relative bg-white rounded-3xl p-5 md:p-6 ps-7 border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all flex flex-col lg:flex-row lg:items-center gap-4 overflow-hidden before:absolute before:inset-y-3 before:start-0 before:w-1.5 before:rounded-full ${Meta.ring}`}
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm ${Meta.accent}`}>
                                        {item.category === 'recruitment' ? <Icon className="w-5 h-5" /> : initials(item.title)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-slate-800 truncate">{item.title}</h3>
                                            <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full ${Meta.accent}`}>{item.typeLabel}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                                            {item.dateText && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.dateText}</span>}
                                            <span className="flex items-center gap-1">{t('awaiting_your_approval_as', { defaultValue: 'Awaiting' })} <b className="text-slate-600">{item.stageLabel}</b></span>
                                        </div>
                                        {item.subtitle && <p className="text-sm text-slate-400 mt-1.5 truncate italic">"{item.subtitle}"</p>}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                                    {item.canDownload && (
                                        <button
                                            onClick={() => downloadForm(item)}
                                            className="flex items-center justify-center gap-2 text-[#541c2c] bg-[#f8f0e8] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#efe2d4] transition-all"
                                        >
                                            <Download className="w-4 h-4" /> {t('form', { defaultValue: 'Form' })}
                                        </button>
                                    )}

                                    {item.needsDoc && (
                                        <label className="flex items-center justify-center gap-2 text-slate-600 bg-slate-50 border border-dashed border-slate-300 px-4 py-2.5 rounded-xl font-semibold text-sm cursor-pointer hover:border-[#541c2c]/40 transition-all">
                                            <Paperclip className="w-4 h-4" />
                                            {docs[item.key]?.name ? <span className="max-w-[120px] truncate">{docs[item.key]!.name}</span> : t('upload_signed_document', { defaultValue: 'Upload document (required)' })}
                                            <input type="file" className="hidden" onChange={e => setDocs(prev => ({ ...prev, [item.key]: e.target.files?.[0] || null }))} />
                                        </label>
                                    )}
                                    <button
                                        disabled={busy}
                                        onClick={() => decide(item, 'APPROVE')}
                                        className="flex items-center justify-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-600 shadow-sm shadow-emerald-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Check className="w-4 h-4" /> {busy ? t('submitting', { defaultValue: 'Submitting…' }) : item.approveLabel}
                                    </button>
                                    <button
                                        disabled={busy}
                                        onClick={() => decide(item, 'REJECT')}
                                        className="flex items-center justify-center gap-2 bg-white text-red-500 border border-red-200 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <XCircle className="w-4 h-4" /> {item.rejectLabel}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default MyApprovals;
