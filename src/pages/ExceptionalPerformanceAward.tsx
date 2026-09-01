import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Award, Search, Paperclip, FileDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../utils/access';
import { usePrompt } from '../components/PromptDialog';
import { staffHubService } from '../services/staffHubService';
import type {
    NominationTeamEmployee, ExceptionalPerformanceEligibility, LeaveApprovalStep, LeaveRequestWithEmployee,
} from '../services/staffHubService';

const NOMINATOR_ROLES = ['HEAD_UNIT', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_DIVISION', 'HEAD_DIRECTOR'];

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

    const canNominate = canAccess(currentUser, NOMINATOR_ROLES, ['nominate_exceptional_award']);
    const canDecideHR = canAccess(currentUser, ['HR_MANAGER'], ['approve_hr_manager']);
    const canDecideGM = canAccess(currentUser, ['GENERAL_MANAGER'], ['approve_gm']);
    const canDecide = canDecideHR || canDecideGM;
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
        setNomineeQuery(''); setNominee(null); setEligibility(null); setJustification(''); setBonusPercent('');
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
        if (!nominee) { toast.error('Select the employee to nominate from the suggestions.'); return; }
        if (!justification.trim()) { toast.error('A justification / reference to the external letter is required.'); return; }
        const pct = Number(bonusPercent);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 25) { toast.error('Enter a bonus percentage between 0 and 25.'); return; }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('employeeId', nominee.id);
            formData.append('userId', currentUser!.id);
            formData.append('type', 'EXCEPTIONAL_PERFORMANCE');
            formData.append('reason', justification.trim());
            formData.append('proposedBonusPercent', bonusPercent);
            await staffHubService.createRequest(formData);
            toast.success('Nomination submitted — awaiting HR Manager then General Manager decision.');
            resetNominationForm();
            loadNominateData();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to submit the nomination.');
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
            toast.error('Please upload the signed nomination form before approving.');
            return;
        }
        let note: string | undefined;
        if (decision === 'REJECT') {
            const result = await prompt({ title: 'Reject Nomination', message: 'Reason for rejecting this nomination (optional):', placeholder: 'Reason (optional)' });
            if (result === null) return;
            note = result || undefined;
        }
        setDeciding(step.id);
        try {
            await staffHubService.decideApprovalStep(step.leaveRequestId, step.id, decision, note, isGM ? doc : null);
            toast.success(decision === 'APPROVE' ? 'Nomination approved.' : 'Nomination rejected.');
            setGmDocs(prev => { const n = { ...prev }; delete n[step.id]; return n; });
            loadDecideData();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to record the decision.');
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
            toast.error('Failed to generate the form.');
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
            <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                    <Award className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">Exceptional Performance / Exceptional Contribution Award</h3>
                    <p className="text-sm text-slate-600 mt-1">
                        A Head nominates a full-time, resident employee (referencing the external letter already sent
                        to the General Manager) — HR Manager approves, then the General Manager approves with the
                        signed nomination form. Once fully approved, HR finalizes the award from the Rewards screen.
                    </p>
                </div>
            </div>

            <div className="flex gap-2">
                {canNominate && (
                    <button onClick={() => setTab('nominate')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${tab === 'nominate' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}>
                        Nominate
                    </button>
                )}
                {canDecide && (
                    <button onClick={() => setTab('decide')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${tab === 'decide' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}>
                        Pending My Decision{pendingSteps.length > 0 ? ` (${pendingSteps.length})` : ''}
                    </button>
                )}
                {canViewHistory && (
                    <button onClick={() => setTab('history')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg ${tab === 'history' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}>
                        History
                    </button>
                )}
            </div>

            {tab === 'nominate' && canNominate && (
                <div className="grid md:grid-cols-2 gap-6">
                    <form onSubmit={submitNomination} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs font-semibold text-slate-700">
                        <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">New Nomination</h4>
                        <div className="relative">
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Nominee (your organizational branch only)</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    autoComplete="off"
                                    value={nomineeQuery}
                                    onChange={e => handleQueryChange(e.target.value)}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => { blurTimeout.current = window.setTimeout(() => setShowSuggestions(false), 150); }}
                                    placeholder="Start typing the employee's name…"
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
                                    <p className="text-[11px]">Eligible — {2 - eligibility.grantedCount} nomination(s) remaining this contract period.</p>
                                ) : (
                                    <ul className="text-[11px] list-disc pl-4">
                                        {eligibility.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Justification (reference the external letter to the GM)</label>
                            <textarea rows={3} value={justification} onChange={e => setJustification(e.target.value)} placeholder="Why this employee — exceptional dedication, urgent/high-impact assignment beyond normal duties…" className="w-full p-2.5 border border-slate-200 rounded-xl font-normal normal-case" />
                        </div>

                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Proposed Bonus % of Monthly Basic Salary (max 25%)</label>
                            <input type="number" min={0} max={25} step="0.1" value={bonusPercent} onChange={e => setBonusPercent(e.target.value)} placeholder="e.g. 15" className="w-full p-2.5 border border-slate-200 rounded-xl font-normal normal-case" />
                            <p className="text-[10px] text-slate-400 font-normal normal-case mt-1">The General Manager approves or rejects this nomination — including the proposed % — as a whole. The actual currency amount is pending Payroll Integration.</p>
                        </div>

                        <button type="submit" disabled={submitting || (!!nominee && !!eligibility && !eligibility.eligible)} className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest rounded-xl hover:bg-[#3a151d] disabled:opacity-50">
                            {submitting ? 'Submitting…' : 'Submit Nomination'}
                        </button>
                    </form>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                        <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">My Nominations</h4>
                        {myNominations.length === 0 ? (
                            <p className="text-xs text-slate-400 font-semibold">You haven't submitted any nominations yet.</p>
                        ) : myNominations.map(nom => (
                            <div key={nom.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-black text-slate-700">{nom.employee?.fullName || 'Employee'}</p>
                                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${STATUS_BADGE[nom.status] || 'bg-slate-100 text-slate-600'}`}>{statusLabel(nom.status)}</span>
                                </div>
                                <p className="text-[10px] text-slate-400">{nom.proposedBonusPercent}% proposed · {format(new Date(nom.createdAt), 'dd MMM yyyy')}</p>
                                <button onClick={() => downloadForm(nom.id)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-100">
                                    <FileDown className="w-3.5 h-3.5" /> Download Form
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'decide' && canDecide && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">Pending My Decision</h4>
                    {pendingSteps.length === 0 ? (
                        <p className="text-xs text-slate-400 font-semibold">No nominations awaiting your decision.</p>
                    ) : pendingSteps.map(step => {
                        const req = step.leaveRequest;
                        const isGM = step.stage === 'GENERAL_MANAGER';
                        return (
                            <div key={step.id} className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{(req as any)?.employee?.fullName || 'Employee'}</p>
                                        <p className="text-[11px] text-slate-400">Nominated by {(req as any)?.user?.fullName || 'a Head'} · {(req as any)?.proposedBonusPercent}% proposed · {isGM ? 'General Manager stage' : 'HR Manager stage'}</p>
                                    </div>
                                    <button onClick={() => downloadForm(step.leaveRequestId)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-100">
                                        <FileDown className="w-3.5 h-3.5" /> Download Form
                                    </button>
                                </div>
                                {req?.reason && <p className="text-xs italic text-slate-500">"{req.reason}"</p>}
                                {isGM && (
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer w-fit">
                                        <Paperclip className="w-4 h-4 shrink-0" />
                                        <span>{gmDocs[step.id]?.name || 'Upload signed nomination form (required to approve)'}</span>
                                        <input type="file" className="hidden" onChange={e => setGmDocs(prev => ({ ...prev, [step.id]: e.target.files?.[0] || null }))} />
                                    </label>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => decideStep(step, 'APPROVE')}
                                        disabled={deciding === step.id || (isGM && !gmDocs[step.id])}
                                        className="px-4 py-2 bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => decideStep(step, 'REJECT')}
                                        disabled={deciding === step.id}
                                        className="px-4 py-2 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-800 disabled:opacity-50"
                                    >
                                        Reject
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
                                <th className={TH}>Employee</th>
                                <th className={TH}>Nominated By</th>
                                <th className={TH}>Bonus %</th>
                                <th className={TH}>Status</th>
                                <th className={TH}>Submitted</th>
                                <th className={`${TH} text-right`}>Action</th>
                            </tr></thead>
                            <tbody className={TBODY}>
                                {history.length === 0 && (
                                    <tr><td colSpan={6} className="p-6 text-center text-slate-400">No nominations found.</td></tr>
                                )}
                                {history.map(row => (
                                    <tr key={row.id}>
                                        <td className="p-3 font-bold text-slate-800">{row.employee?.fullName || '—'}</td>
                                        <td className="p-3">{(row as any).user?.fullName || '—'}</td>
                                        <td className="p-3">{row.proposedBonusPercent}%</td>
                                        <td className="p-3"><span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${STATUS_BADGE[row.status] || 'bg-slate-100 text-slate-600'}`}>{statusLabel(row.status)}</span></td>
                                        <td className="p-3 text-slate-500">{format(new Date(row.createdAt), 'dd MMM yyyy')}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => downloadForm(row.id)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                                Download Form
                                            </button>
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
