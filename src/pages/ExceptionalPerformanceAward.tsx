import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Award, Search, Paperclip, FileDown, FileCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../utils/access';
import { usePrompt } from '../components/PromptDialog';
import { staffHubService } from '../services/staffHubService';
import { SERVER_URL } from '../services/apiClient';
import type {
    NominationTeamEmployee, ExceptionalPerformanceEligibility, LeaveApprovalStep, LeaveRequestWithEmployee,
} from '../services/staffHubService';

const NOMINATOR_ROLES = ['HEAD_UNIT', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_DIVISION', 'HEAD_DIRECTOR'];

const STAGE_LABELS: Record<string, string> = {
    DEPT_HEAD: 'Head of Department',
    DIVISION_HEAD: 'Head of Division',
    HR_MANAGER: 'HR Manager',
    GENERAL_MANAGER: 'General Manager',
};

const STATUS_BADGE: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    COMPLETED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
};
const statusLabel = (status: string) => (status === 'COMPLETED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending');

const TH = 'p-3';
const THEAD_TR = 'bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10';
const TBODY = 'divide-y divide-slate-100 font-medium text-slate-700';

type TabKey = 'nominate' | 'decide' | 'history';

const ExceptionalPerformanceAward: React.FC = () => {
    const { currentUser } = useAuth();
    const prompt = usePrompt();
    const { t } = useTranslation();

    const canNominate = canAccess(currentUser, NOMINATOR_ROLES, ['nominate_exceptional_award']);
    const canDecideHR = canAccess(currentUser, ['HR_MANAGER'], ['approve_hr_manager']);
    const canDecideGM = canAccess(currentUser, ['GENERAL_MANAGER'], ['approve_gm']);
    // The chain now also escalates through the submitting Head's own Department/Division Head
    // before HR — any of the 5 head roles can be an intermediate approver, not just HR/GM. Real
    // authorization is still server-side (decideApprovalStep checks approverUserId); this only
    // controls whether the tab is visible.
    const canDecide = canDecideHR || canDecideGM || canAccess(currentUser, NOMINATOR_ROLES, []);
    const canViewHistory = canAccess(currentUser, ['HR_MANAGER', 'PERSONNEL', 'GENERAL_MANAGER'], ['manage_rewards', 'approve_gm']);

    const [tab, setTab] = useState<TabKey>(canNominate ? 'nominate' : canDecide ? 'decide' : 'history');

    // --- Nominate ---
    const [team, setTeam] = useState<NominationTeamEmployee[]>([]);
    const [myNominations, setMyNominations] = useState<LeaveRequestWithEmployee[]>([]);
    const [nomineeQuery, setNomineeQuery] = useState('');
    const [nominee, setNominee] = useState<NominationTeamEmployee | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const blurTimeout = useRef<number | null>(null);
    const [eligibility, setEligibility] = useState<ExceptionalPerformanceEligibility | null>(null);
    const [justification, setJustification] = useState('');
    const [natureOfContribution, setNatureOfContribution] = useState('');
    const [payrollCoverageMonth, setPayrollCoverageMonth] = useState('');
    const [bonusPercent, setBonusPercent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const suggestions = useMemo(() => {
        const q = nomineeQuery.trim().toLowerCase();
        if (!q || nominee) return [];
        return team.filter(e => e.fullName.toLowerCase().includes(q) || (e.staffId || '').toLowerCase().includes(q)).slice(0, 8);
    }, [nomineeQuery, nominee, team]);

    const selectNominee = (emp: NominationTeamEmployee) => {
        setNominee(emp);
        setNomineeQuery(emp.fullName);
        setShowSuggestions(false);
        setEligibility(null);
        staffHubService.getExceptionalPerformanceEligibility(emp.id).then(setEligibility).catch(() => {});
    };
    const handleQueryChange = (value: string) => {
        setNomineeQuery(value);
        if (nominee && value !== nominee.fullName) { setNominee(null); setEligibility(null); }
        setShowSuggestions(true);
    };
    const resetNominationForm = () => {
        setNomineeQuery(''); setNominee(null); setEligibility(null); setJustification('');
        setNatureOfContribution(''); setPayrollCoverageMonth(''); setBonusPercent('');
    };

    const loadNominateData = async () => {
        const [teamRes, mine] = await Promise.all([
            staffHubService.getMyNominationTeam().then(r => r.employees).catch(() => []),
            staffHubService.getMySubmittedNominations().catch(() => []),
        ]);
        setTeam(teamRes);
        setMyNominations(mine);
    };

    const submitNomination = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nominee) { toast.error(t('select_the_employee_to_nominate_from_the_suggestions', { defaultValue: 'Select the employee to nominate from the suggestions.' })); return; }
        if (!justification.trim()) { toast.error(t('a_justification_for_exceptional_recognition_is_required', { defaultValue: 'A justification for exceptional recognition is required.' })); return; }
        if (!natureOfContribution.trim()) { toast.error(t('the_nature_of_the_exceptional_contribution_is_required', { defaultValue: 'The nature of the exceptional contribution is required.' })); return; }
        if (!payrollCoverageMonth) { toast.error(t('the_payroll_coverage_month_is_required', { defaultValue: 'The payroll coverage month is required.' })); return; }
        const pct = Number(bonusPercent);
        if (!Number.isFinite(pct) || pct < 5 || pct > 25) { toast.error(t('enter_a_bonus_percentage_between_5_and_25', { defaultValue: 'Enter a bonus percentage between 5 and 25.' })); return; }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('employeeId', nominee.id);
            formData.append('userId', currentUser!.id);
            formData.append('type', 'EXCEPTIONAL_PERFORMANCE');
            formData.append('reason', justification.trim());
            formData.append('natureOfContribution', natureOfContribution.trim());
            formData.append('payrollCoverageMonth', payrollCoverageMonth);
            formData.append('proposedBonusPercent', bonusPercent);
            await staffHubService.createRequest(formData);
            toast.success(t('nomination_submitted_awaiting_hr_manager_then_general_manager', { defaultValue: 'Nomination submitted — awaiting HR Manager then General Manager decision.' }));
            resetNominationForm();
            loadNominateData();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_submit_the_nomination', { defaultValue: 'Failed to submit the nomination.' }));
        } finally {
            setSubmitting(false);
        }
    };

    // --- Pending My Decision ---
    const [pendingSteps, setPendingSteps] = useState<LeaveApprovalStep[]>([]);
    const [gmDocs, setGmDocs] = useState<Record<string, File | null>>({});
    const [deciding, setDeciding] = useState<string | null>(null);

    const loadDecideData = async () => {
        const steps = await staffHubService.getMyPendingSteps().catch(() => []);
        setPendingSteps(steps.filter(s => s.leaveRequest?.type === 'EXCEPTIONAL_PERFORMANCE'));
    };

    const decideStep = async (step: LeaveApprovalStep, decision: 'APPROVE' | 'REJECT') => {
        const isGM = step.stage === 'GENERAL_MANAGER';
        const doc = gmDocs[step.id] || null;
        if (isGM && decision === 'APPROVE' && !doc) {
            toast.error(t('please_upload_the_signed_nomination_form_before_approving', { defaultValue: 'Please upload the signed nomination form before approving.' }));
            return;
        }
        let note: string | undefined;
        if (decision === 'REJECT') {
            const result = await prompt({ title: t('reject_nomination', { defaultValue: 'Reject Nomination' }), message: t('reason_for_rejecting_this_nomination_optional', { defaultValue: 'Reason for rejecting this nomination (optional):' }), placeholder: t('reason_optional', { defaultValue: 'Reason (optional)' }) });
            if (result === null) return;
            note = result || undefined;
        }
        setDeciding(step.id);
        try {
            await staffHubService.decideApprovalStep(step.leaveRequestId, step.id, decision, note, isGM ? doc : null);
            toast.success(decision === 'APPROVE' ? t('nomination_approved', { defaultValue: 'Nomination approved.' }) : t('nomination_rejected', { defaultValue: 'Nomination rejected.' }));
            setGmDocs(prev => { const n = { ...prev }; delete n[step.id]; return n; });
            loadDecideData();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_record_the_decision', { defaultValue: 'Failed to record the decision.' }));
        } finally {
            setDeciding(null);
        }
    };

    // --- History ---
    const [history, setHistory] = useState<LeaveRequestWithEmployee[]>([]);
    const loadHistory = async () => {
        const rows = await staffHubService.getExceptionalPerformanceHistory().catch(() => []);
        setHistory(rows as LeaveRequestWithEmployee[]);
    };

    useEffect(() => {
        if (canNominate) loadNominateData();
        if (canDecide) loadDecideData();
        if (canViewHistory) loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const downloadForm = async (requestId: string) => {
        try {
            const blob = await staffHubService.getLeaveForm(requestId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Exceptional_Performance_Nomination_${requestId.slice(0, 8)}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error(t('failed_to_generate_the_form', { defaultValue: 'Failed to generate the form.' }));
        }
    };

    // Once the General Manager has uploaded the signed nomination form at the final approval, that
    // document becomes the request's official artifact — link straight to it and stop offering the
    // system-generated form. Mirrors the same rule on Staff Hub / Approved Leaves / Approvals.
    const FormArtifact: React.FC<{ req: { id: string; finalDocumentUrl?: string; finalDocumentName?: string }; className: string }> = ({ req, className }) => (
        req.finalDocumentUrl ? (
            <a
                href={`${SERVER_URL}${req.finalDocumentUrl}`}
                target="_blank"
                rel="noreferrer"
                title={req.finalDocumentName || t('final_document', { defaultValue: 'Final Document' })}
                className={`${className} bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100`}
            >
                <FileCheck className="w-3.5 h-3.5" /> {t('view_final_document', { defaultValue: 'View Final Document' })}
            </a>
        ) : (
            <button onClick={() => downloadForm(req.id)} className={`${className} bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100`}>
                <FileDown className="w-3.5 h-3.5" /> {t('download_form', { defaultValue: 'Download Form' })}
            </button>
        )
    );

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
            <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                    <Award className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">{t('exceptional_performance_exceptional_contribution_award', { defaultValue: 'Exceptional Performance / Exceptional Contribution Award' })}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                        {t('a_head_nominates_a_full_time_resident_employee', { defaultValue: 'A Head nominates a full-time, resident employee (referencing the external letter already sent to the General Manager) — HR Manager approves, then the General Manager approves with the signed nomination form. Once fully approved, HR finalizes the award from the Rewards screen.' })}
                    </p>
                </div>
            </div>

            <div className="flex gap-2">
                {canNominate && (
                    <button onClick={() => setTab('nominate')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${tab === 'nominate' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}>
                        {t('nominate', { defaultValue: 'Nominate' })}
                    </button>
                )}
                {canDecide && (
                    <button onClick={() => setTab('decide')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${tab === 'decide' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}>
                        {t('pending_my_decision', { defaultValue: 'Pending My Decision' })}{pendingSteps.length > 0 ? ` (${pendingSteps.length})` : ''}
                    </button>
                )}
                {canViewHistory && (
                    <button onClick={() => setTab('history')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${tab === 'history' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}>
                        {t('history', { defaultValue: 'History' })}
                    </button>
                )}
            </div>

            {tab === 'nominate' && canNominate && (
                <div className="grid md:grid-cols-2 gap-6">
                    <form onSubmit={submitNomination} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs font-semibold text-slate-700">
                        <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('new_nomination', { defaultValue: 'New Nomination' })}</h4>
                        <div className="relative">
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">{t('nominee_your_organizational_branch_only', { defaultValue: 'Nominee (your organizational branch only)' })}</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    autoComplete="off"
                                    value={nomineeQuery}
                                    onChange={e => handleQueryChange(e.target.value)}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => { blurTimeout.current = window.setTimeout(() => setShowSuggestions(false), 150); }}
                                    placeholder={t('start_typing_the_employee_s_name', { defaultValue: "Start typing the employee's name…" })}
                                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl font-normal normal-case"
                                />
                            </div>
                            {showSuggestions && suggestions.length > 0 && (
                                <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-md max-h-56 overflow-auto">
                                    {suggestions.map(emp => (
                                        <li key={emp.id}>
                                            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => selectNominee(emp)} className="w-full text-left px-3 py-2 text-xs font-normal normal-case hover:bg-slate-50">
                                                {emp.fullName}{emp.staffId ? ` (${emp.staffId})` : ''}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {nominee && eligibility && (
                            <div className={`p-3 border rounded-xl space-y-1 font-normal normal-case ${eligibility.eligible ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                {eligibility.eligible ? (
                                    <p className="text-[11px]">{t('eligible_nominations_remaining_this_contract_period', { defaultValue: 'Eligible — {{count}} nomination(s) remaining this contract period.', count: 2 - eligibility.grantedCount })}</p>
                                ) : (
                                    <ul className="text-[11px] list-disc pl-4">
                                        {eligibility.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">{t('nature_of_exceptional_contribution', { defaultValue: 'Nature of Exceptional Contribution' })}</label>
                            <textarea rows={3} value={natureOfContribution} onChange={e => setNatureOfContribution(e.target.value)} placeholder={t('describe_the_exceptional_contribution_performed_by_the_employee', { defaultValue: "Describe the exceptional contribution performed by the employee, including the actions taken and responsibilities undertaken beyond the employee's regular duties." })} className="w-full p-2.5 border border-slate-200 rounded-xl font-normal normal-case" />
                        </div>

                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">{t('justification_for_exceptional_recognition', { defaultValue: 'Justification for Exceptional Recognition' })}</label>
                            <textarea rows={3} value={justification} onChange={e => setJustification(e.target.value)} placeholder={t('explain_why_the_contribution_is_considered_exceptional_and', { defaultValue: "Explain why the contribution is considered exceptional and merits recognition beyond the employee's normal job responsibilities." })} className="w-full p-2.5 border border-slate-200 rounded-xl font-normal normal-case" />
                        </div>

                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">{t('payroll_coverage', { defaultValue: 'Payroll Coverage' })}</label>
                            <input type="month" value={payrollCoverageMonth} onChange={e => setPayrollCoverageMonth(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl font-normal normal-case" />
                            <p className="text-[10px] text-slate-400 font-normal normal-case mt-1">{t('the_payroll_month_this_award_should_be_reflected', { defaultValue: 'The payroll month this award should be reflected in.' })}</p>
                        </div>

                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">{t('proposed_bonus_of_monthly_basic_salary_5_25', { defaultValue: 'Proposed Bonus % of Monthly Basic Salary (5–25%)' })}</label>
                            <input type="number" min={5} max={25} step="0.1" value={bonusPercent} onChange={e => setBonusPercent(e.target.value)} placeholder="e.g. 15" className="w-full p-2.5 border border-slate-200 rounded-xl font-normal normal-case" />
                            <p className="text-[10px] text-slate-400 font-normal normal-case mt-1">{t('the_department_division_head_decides_the_percentage_5', { defaultValue: 'The Department/Division Head decides the percentage (5–25%). The General Manager approves or rejects this nomination — including the proposed % — as a whole. The actual currency amount is pending Payroll Integration.' })}</p>
                        </div>

                        <button type="submit" disabled={submitting || (!!nominee && !!eligibility && !eligibility.eligible)} className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest rounded-xl hover:bg-[#3a151d] disabled:opacity-50">
                            {submitting ? t('submitting', { defaultValue: 'Submitting…' }) : t('submit_nomination', { defaultValue: 'Submit Nomination' })}
                        </button>
                    </form>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                        <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('my_nominations', { defaultValue: 'My Nominations' })}</h4>
                        {myNominations.length === 0 ? (
                            <p className="text-xs text-slate-400 font-semibold">{t('you_haven_t_submitted_any_nominations_yet', { defaultValue: "You haven't submitted any nominations yet." })}</p>
                        ) : myNominations.map(nom => (
                            <div key={nom.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-black text-slate-700">{nom.employee?.fullName || t('employee', { defaultValue: 'Employee' })}</p>
                                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${STATUS_BADGE[nom.status] || 'bg-slate-100 text-slate-600'}`}>{statusLabel(nom.status)}</span>
                                </div>
                                <p className="text-[10px] text-slate-400">{nom.proposedBonusPercent}% proposed · {format(new Date(nom.createdAt), 'dd MMM yyyy')}</p>
                                <FormArtifact req={nom} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'decide' && canDecide && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('pending_my_decision', { defaultValue: 'Pending My Decision' })}</h4>
                    {pendingSteps.length === 0 ? (
                        <p className="text-xs text-slate-400 font-semibold">{t('no_nominations_awaiting_your_decision', { defaultValue: 'No nominations awaiting your decision.' })}</p>
                    ) : pendingSteps.map(step => {
                        const req = step.leaveRequest;
                        const isGM = step.stage === 'GENERAL_MANAGER';
                        const stageLabel = STAGE_LABELS[step.stage] || step.stage;
                        return (
                            <div key={step.id} className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{(req as any)?.employee?.fullName || t('employee', { defaultValue: 'Employee' })}</p>
                                        <p className="text-[11px] text-slate-400">Nominated by {(req as any)?.user?.fullName || 'a Head'} · {(req as any)?.proposedBonusPercent}% proposed · {stageLabel} stage</p>
                                    </div>
                                    <FormArtifact req={{ id: step.leaveRequestId, finalDocumentUrl: req?.finalDocumentUrl, finalDocumentName: req?.finalDocumentName }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest rounded-lg" />
                                </div>
                                {req?.reason && <p className="text-xs italic text-slate-500">"{req.reason}"</p>}
                                {isGM && (
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer w-fit">
                                        <Paperclip className="w-4 h-4 shrink-0" />
                                        <span>{gmDocs[step.id]?.name || t('upload_signed_nomination_form_required_to_approve', { defaultValue: 'Upload signed nomination form (required to approve)' })}</span>
                                        <input type="file" className="hidden" onChange={e => setGmDocs(prev => ({ ...prev, [step.id]: e.target.files?.[0] || null }))} />
                                    </label>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => decideStep(step, 'APPROVE')}
                                        disabled={deciding === step.id || (isGM && !gmDocs[step.id])}
                                        className="px-4 py-2 bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                                    >
                                        {t('approve', { defaultValue: 'Approve' })}
                                    </button>
                                    <button
                                        onClick={() => decideStep(step, 'REJECT')}
                                        disabled={deciding === step.id}
                                        className="px-4 py-2 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-800 disabled:opacity-50"
                                    >
                                        {t('reject', { defaultValue: 'Reject' })}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === 'history' && canViewHistory && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead><tr className={THEAD_TR}>
                                <th className={TH}>{t('employee', { defaultValue: 'Employee' })}</th>
                                <th className={TH}>{t('nominated_by', { defaultValue: 'Nominated By' })}</th>
                                <th className={TH}>{t('bonus', { defaultValue: 'Bonus %' })}</th>
                                <th className={TH}>{t('status', { defaultValue: 'Status' })}</th>
                                <th className={TH}>{t('submitted', { defaultValue: 'Submitted' })}</th>
                                <th className={`${TH} text-right`}>{t('action', { defaultValue: 'Action' })}</th>
                            </tr></thead>
                            <tbody className={TBODY}>
                                {history.length === 0 && (
                                    <tr><td colSpan={6} className="p-6 text-center text-slate-400">{t('no_nominations_found', { defaultValue: 'No nominations found.' })}</td></tr>
                                )}
                                {history.map(row => (
                                    <tr key={row.id}>
                                        <td className="p-3 font-bold text-slate-800">{row.employee?.fullName || '—'}</td>
                                        <td className="p-3">{(row as any).user?.fullName || '—'}</td>
                                        <td className="p-3">{row.proposedBonusPercent}%</td>
                                        <td className="p-3"><span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${STATUS_BADGE[row.status] || 'bg-slate-100 text-slate-600'}`}>{statusLabel(row.status)}</span></td>
                                        <td className="p-3 text-slate-500">{format(new Date(row.createdAt), 'dd MMM yyyy')}</td>
                                        <td className="p-3 text-right">
                                            <FormArtifact req={row} className="inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest rounded" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExceptionalPerformanceAward;
