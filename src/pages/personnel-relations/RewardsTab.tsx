import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Award, Search, Filter } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { evaluationService } from '../../services/evaluationService';
import {
    rewardService,
    type RewardType,
    type RewardCase,
    type RewardMonthCandidate,
    type RewardAttendanceCandidate,
    type RewardAttendanceExclusion,
    type RewardLoyaltyCandidate,
} from '../../services/rewardService';
import Modal from '../../components/Modal';
import type { Employee } from '../../types';

// Exported for the Employee Lifecycle tree's "Rewards Record" section (PersonnelRelations.tsx),
// which lists an employee's own cases outside this tab.
export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
    EMPLOYEE_OF_MONTH: 'Employee of the Month',
    ATTENDANCE_EXCELLENCE: 'Attendance Excellence',
    EMPLOYEE_OF_YEAR: 'Employee of the Year',
    LOYALTY_MILESTONE: 'Loyalty Milestone',
};

// One shared badge for every Draft/Completed indicator across the tab — same formula the
// Disciplinary tab (this page's sibling) already uses for its own status chips.
const CaseStatusBadge: React.FC<{ completed: boolean }> = ({ completed }) => (
    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
        {completed ? 'Completed' : 'Draft'}
    </span>
);

// Shared table shell — Rewards' own #511d29 maroon accent, same structural formula the
// Disciplinary tab already uses with its own red-700 accent.
const TH = 'p-3';
const THEAD_TR = 'bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10';
const TBODY = 'divide-y divide-slate-100 font-medium text-slate-700';
const TR_HOVER = 'hover:bg-[#511d29]/5';

const defaultPrevMonth = (): string => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const RewardsTab: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [view, setView] = useState<'awards' | 'history'>('awards');

    // Same query key the parent (PersonnelRelations.tsx) uses for its own employee roster — React
    // Query dedupes this against the already-cached data, no extra network call.
    const { data: employees = [] } = useQuery({
        queryKey: ['relations-employees'],
        queryFn: () => employeeService.getAllEmployees(),
    });

    const { data: rewardCases = [] } = useQuery({
        queryKey: ['reward-cases'],
        queryFn: () => rewardService.list(),
    });
    const refreshRewards = () => {
        queryClient.invalidateQueries({ queryKey: ['reward-cases'] });
        // Completing a case credits bonusHolidays — keep the roster caches in sync, same as
        // promotion completion does.
        queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
        queryClient.invalidateQueries({ queryKey: ['relations-employees-all'] });
    };

    // Employee of the Month — HR triggers computation on demand (never automatic); the returned list
    // is the full ranked eligible set, not just #1, so ties are visible and HR's grant click is the
    // tie-break.
    const [momMonth, setMomMonth] = useState(defaultPrevMonth());
    const [momLoading, setMomLoading] = useState(false);
    const [momCandidates, setMomCandidates] = useState<RewardMonthCandidate[] | null>(null);
    const computeMonthCandidates = async () => {
        setMomLoading(true);
        setMomCandidates(null);
        try {
            const { candidates } = await rewardService.getMonthCandidates(momMonth);
            setMomCandidates(candidates);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to compute candidates.');
        } finally {
            setMomLoading(false);
        }
    };

    // Monthly Attendance and Timeliness Excellence Award — a threshold award: every employee who
    // clears the bar qualifies, so "Open All" loops the single-case-creation endpoint client-side.
    // Each case still needs its own signed-document upload before it's actually applied.
    const [attMonth, setAttMonth] = useState(defaultPrevMonth());
    const [attLoading, setAttLoading] = useState(false);
    const [attResult, setAttResult] = useState<{ candidates: RewardAttendanceCandidate[]; excluded: RewardAttendanceExclusion[] } | null>(null);
    const computeAttendanceCandidates = async () => {
        setAttLoading(true);
        setAttResult(null);
        try {
            const result = await rewardService.getAttendanceCandidates(attMonth);
            setAttResult(result);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to compute candidates.');
        } finally {
            setAttLoading(false);
        }
    };
    const openAllAttendanceCases = async () => {
        if (!attResult || attResult.candidates.length === 0) return;
        for (const c of attResult.candidates) {
            try {
                await rewardService.createAttendanceCase(c.employeeId, attMonth);
            } catch (err: any) {
                toast.error(`${c.employee.fullName}: ${err?.response?.data?.error || 'Failed to open a case.'}`);
            }
        }
        toast.success('Cases opened for all eligible employees — complete each one below to apply the award.');
        setAttResult(null);
        refreshRewards();
    };

    // Loyalty & Service Milestone Award — on-demand scan, satisfying the spec's "automatic alerts"
    // via an HR-triggered check rather than a background cron/push notification.
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [loyaltyCandidates, setLoyaltyCandidates] = useState<RewardLoyaltyCandidate[] | null>(null);
    const checkLoyaltyMilestones = async () => {
        setLoyaltyLoading(true);
        setLoyaltyCandidates(null);
        try {
            const { candidates } = await rewardService.getLoyaltyCandidates();
            setLoyaltyCandidates(candidates);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to check milestones.');
        } finally {
            setLoyaltyLoading(false);
        }
    };

    // Employee of the Year — manual HR/management pick, mirrors the "Add Exceptional Promotion"
    // searchable employee picker exactly. Evaluation data is shown as reference only, never a filter.
    const [isEoyModalOpen, setIsEoyModalOpen] = useState(false);
    const [eoyYear, setEoyYear] = useState(String(new Date().getFullYear()));
    const [eoyEmployeeQuery, setEoyEmployeeQuery] = useState('');
    const [eoyEmployee, setEoyEmployee] = useState<Employee | null>(null);
    const [showEoySuggestions, setShowEoySuggestions] = useState(false);
    const eoyBlurTimeout = useRef<number | null>(null);
    const [eoyNotes, setEoyNotes] = useState('');
    const [eoyBonusPercent, setEoyBonusPercent] = useState('');
    const eoySuggestions = useMemo(() => {
        const q = eoyEmployeeQuery.trim().toLowerCase();
        if (!q || eoyEmployee) return [];
        return (employees as Employee[])
            .filter((emp: any) => emp.fullName.toLowerCase().includes(q) || (emp.staffId || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [eoyEmployeeQuery, eoyEmployee, employees]);
    const selectEoyEmployee = (emp: Employee) => {
        setEoyEmployee(emp);
        setEoyEmployeeQuery(emp.fullName);
        setShowEoySuggestions(false);
    };
    const handleEoyEmployeeChange = (value: string) => {
        setEoyEmployeeQuery(value);
        if (eoyEmployee && value !== eoyEmployee.fullName) setEoyEmployee(null);
        setShowEoySuggestions(true);
    };
    const { data: eoyEvalHistory } = useQuery({
        queryKey: ['reward-eoy-eval-history', eoyEmployee?.id],
        queryFn: () => evaluationService.getEvaluationHistory(eoyEmployee!.id),
        enabled: !!eoyEmployee && isEoyModalOpen,
    });

    // History view — every RewardCase ever created, searchable/filterable (replaces the old buried
    // <details> at the bottom of the page).
    const [historySearch, setHistorySearch] = useState('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | RewardType>('all');
    const filteredHistory = useMemo(() => {
        const q = historySearch.trim().toLowerCase();
        return (rewardCases as RewardCase[]).filter(rc => {
            if (historyTypeFilter !== 'all' && rc.type !== historyTypeFilter) return false;
            if (!q) return true;
            return rc.caseNumber.toLowerCase().includes(q) || (rc.employee?.fullName || '').toLowerCase().includes(q);
        });
    }, [rewardCases, historySearch, historyTypeFilter]);

    return (
        <>
            <div className="space-y-6">
                <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">Rewards & Recognition</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Nothing here runs automatically — candidates are computed on demand, and no award is
                                applied to the employee until its case is completed with a signed, uploaded document.
                                Bi-Annual Bonus and Exceptional Performance Award are not yet configured.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => setView('awards')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${view === 'awards' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}
                        >
                            Awards
                        </button>
                        <button
                            onClick={() => setView('history')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${view === 'history' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}
                        >
                            History{rewardCases.length > 0 ? ` (${rewardCases.length})` : ''}
                        </button>
                    </div>
                </div>

                {view === 'awards' && (
                    <>
                        {/* Employee of the Month */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">Employee of the Month</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        Ranked by finalized monthly evaluation score. Requires active full-time employment,
                                        6+ months tenure, and no confirmed disciplinary action in the last 6 months.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="month" value={momMonth} onChange={e => setMomMonth(e.target.value)} className="p-2 border border-slate-200 rounded text-xs font-semibold" />
                                    <button onClick={computeMonthCandidates} disabled={momLoading} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d] disabled:opacity-50">
                                        {momLoading ? 'Computing…' : 'Compute Candidates'}
                                    </button>
                                </div>
                            </div>
                            {(() => {
                                const existingCase = rewardCases.find(c => c.type === 'EMPLOYEE_OF_MONTH' && c.period === momMonth);
                                if (existingCase) return (
                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <CaseStatusBadge completed={!!existingCase.completedAt} />
                                            <p className="text-xs font-black text-slate-700">{existingCase.employee?.fullName} — {existingCase.caseNumber}</p>
                                            {existingCase.finalScoreSnapshot != null && <span className="text-[10px] text-slate-400">Score {existingCase.finalScoreSnapshot.toFixed(2)}%</span>}
                                        </div>
                                        <button onClick={() => navigate(`/personnel-relations/rewards/${existingCase.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                            {existingCase.completedAt ? 'View Case' : 'Complete Case'}
                                        </button>
                                    </div>
                                );
                                if (momCandidates === null) return <p className="text-xs text-slate-400 font-semibold">Pick a month and click "Compute Candidates" to see the ranked list.</p>;
                                if (momCandidates.length === 0) return <p className="text-xs text-slate-400 font-semibold">No eligible candidates found for {momMonth}.</p>;
                                return (
                                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead><tr className={THEAD_TR}>
                                                <th className={TH}>Rank</th>
                                                <th className={TH}>Employee</th>
                                                <th className={TH}>Score</th>
                                                <th className={`${TH} text-right`}>Action</th>
                                            </tr></thead>
                                            <tbody className={TBODY}>
                                                {momCandidates.map((c, i) => (
                                                    <tr key={c.employeeId} className={TR_HOVER}>
                                                        <td className="p-3 font-black text-[#511d29]">#{i + 1}</td>
                                                        <td className="p-3">
                                                            <p className="font-bold text-slate-800">{c.employee.fullName}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{c.employee.staffId}</p>
                                                        </td>
                                                        <td className="p-3 font-bold">{c.finalScore.toFixed(2)}%</td>
                                                        <td className="p-3 text-right">
                                                            <button onClick={() => navigate(`/personnel-relations/rewards/candidates/month/${c.employeeId}?period=${momMonth}`)} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">Review</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Monthly Attendance and Timeliness Excellence Award */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">Monthly Attendance & Timeliness Excellence Award</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        Threshold award — every qualifying employee is eligible, not just one winner. Requires
                                        BioTime-resident status (no company transportation), zero late arrivals or unauthorized
                                        absences, no leave filed, and no confirmed disciplinary record this cycle.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)} className="p-2 border border-slate-200 rounded text-xs font-semibold" />
                                    <button onClick={computeAttendanceCandidates} disabled={attLoading} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d] disabled:opacity-50">
                                        {attLoading ? 'Computing…' : 'Compute Candidates'}
                                    </button>
                                </div>
                            </div>
                            {(() => {
                                const casesThisMonth = rewardCases.filter(c => c.type === 'ATTENDANCE_EXCELLENCE' && c.period === attMonth);
                                return (
                                    <>
                                        {casesThisMonth.length > 0 && (
                                            <div className="space-y-2">
                                                {casesThisMonth.map(g => (
                                                    <div key={g.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <CaseStatusBadge completed={!!g.completedAt} />
                                                            <p className="text-xs font-black text-slate-700">{g.employee?.fullName} — {g.caseNumber}</p>
                                                        </div>
                                                        <button onClick={() => navigate(`/personnel-relations/rewards/${g.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                                            {g.completedAt ? 'View Case' : 'Complete Case'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {attResult === null ? (
                                            <p className="text-xs text-slate-400 font-semibold">Pick a month and click "Compute Candidates" to check who qualifies.</p>
                                        ) : attResult.candidates.length === 0 ? (
                                            <p className="text-xs text-slate-400 font-semibold">No qualifying employees for this month.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex justify-end">
                                                    <button onClick={openAllAttendanceCases} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">Open Cases for All Eligible</button>
                                                </div>
                                                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead><tr className={THEAD_TR}>
                                                            <th className={TH}>Employee</th>
                                                            <th className={`${TH} text-right`}>Action</th>
                                                        </tr></thead>
                                                        <tbody className={TBODY}>
                                                            {attResult.candidates.map(c => (
                                                                <tr key={c.employeeId} className={TR_HOVER}>
                                                                    <td className="p-3">
                                                                        <p className="font-bold text-slate-800">{c.employee.fullName}</p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">{c.employee.staffId}</p>
                                                                    </td>
                                                                    <td className="p-3 text-right">
                                                                        <button onClick={() => navigate(`/personnel-relations/rewards/candidates/attendance/${c.employeeId}?period=${attMonth}`)} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">Review</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                        {attResult && attResult.excluded.length > 0 && (
                                            <details className="text-[11px] text-slate-400">
                                                <summary className="cursor-pointer font-black uppercase tracking-widest text-slate-400">Excluded ({attResult.excluded.length})</summary>
                                                <ul className="mt-2 space-y-1">
                                                    {attResult.excluded.map(e => (
                                                        <li key={e.employeeId}>{e.employeeName} — {e.reason === 'NO_BIO_ID' ? 'No attendance device linked' : e.reason === 'BIOTIME_UNREACHABLE' ? 'Could not reach BioTime to confirm residency — try again' : 'Attendance data unavailable'}</li>
                                                    ))}
                                                </ul>
                                            </details>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Employee of the Year */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">Employee of the Year</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        Manual selection by HR/Management for the year. Evaluation history is shown as
                                        reference only — this is not formula-driven.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="number" value={eoyYear} onChange={e => setEoyYear(e.target.value)} className="w-24 p-2 border border-slate-200 rounded text-xs font-semibold" />
                                    <button onClick={() => setIsEoyModalOpen(true)} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d]">
                                        + Select Employee of the Year
                                    </button>
                                </div>
                            </div>
                            {(() => {
                                const existingCase = rewardCases.find(c => c.type === 'EMPLOYEE_OF_YEAR' && c.period === eoyYear);
                                if (!existingCase) return <p className="text-xs text-slate-400 font-semibold">No one selected for {eoyYear} yet.</p>;
                                return (
                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <CaseStatusBadge completed={!!existingCase.completedAt} />
                                                <p className="text-xs font-black text-slate-700">{existingCase.employee?.fullName} — {existingCase.caseNumber}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">{existingCase.bonusPercent != null ? `${existingCase.bonusPercent}% bonus — Pending Payroll Integration` : 'No bonus % set'}</span>
                                        </div>
                                        {existingCase.notes && <p className="text-[11px] italic text-slate-500">"{existingCase.notes}"</p>}
                                        <button onClick={() => navigate(`/personnel-relations/rewards/${existingCase.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                            {existingCase.completedAt ? 'View Case' : 'Complete Case'}
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Loyalty & Service Milestone Award */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">Loyalty & Service Milestone Award</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        Surfaces employees who newly reached 5 or 10 years of continuous active service. Each
                                        milestone is granted once per employee.
                                    </p>
                                </div>
                                <button onClick={checkLoyaltyMilestones} disabled={loyaltyLoading} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d] disabled:opacity-50 shrink-0">
                                    {loyaltyLoading ? 'Checking…' : 'Check Milestones'}
                                </button>
                            </div>
                            {loyaltyCandidates === null ? (
                                <p className="text-xs text-slate-400 font-semibold">Click "Check Milestones" to find employees who newly reached 5 or 10 years of service.</p>
                            ) : loyaltyCandidates.length === 0 ? (
                                <p className="text-xs text-slate-400 font-semibold">No new milestones reached.</p>
                            ) : (
                                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead><tr className={THEAD_TR}>
                                            <th className={TH}>Employee</th>
                                            <th className={TH}>Milestone</th>
                                            <th className={`${TH} text-right`}>Action</th>
                                        </tr></thead>
                                        <tbody className={TBODY}>
                                            {loyaltyCandidates.map(c => (
                                                <tr key={`${c.employeeId}:${c.milestoneYears}`} className={TR_HOVER}>
                                                    <td className="p-3">
                                                        <p className="font-bold text-slate-800">{c.employee.fullName}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">{c.employee.staffId}</p>
                                                    </td>
                                                    <td className="p-3 font-bold">{c.milestoneYears}-year</td>
                                                    <td className="p-3 text-right">
                                                        <button onClick={() => navigate(`/personnel-relations/rewards/candidates/loyalty/${c.employeeId}?milestoneYears=${c.milestoneYears}`)} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">Review</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {(() => {
                                const opened = rewardCases.filter(c => c.type === 'LOYALTY_MILESTONE');
                                if (opened.length === 0) return null;
                                return (
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cases</span>
                                        {opened.map(g => (
                                            <div key={g.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <CaseStatusBadge completed={!!g.completedAt} />
                                                    <p className="text-xs font-black text-slate-700">{g.employee?.fullName} — {g.milestoneYears}-year Milestone</p>
                                                    <span className="text-[10px] text-slate-400">{g.bonusPercent}% bonus — Pending Payroll Integration{g.physicalRewardFulfilledAt ? ' · Gift Fulfilled' : ''}</span>
                                                </div>
                                                <button onClick={() => navigate(`/personnel-relations/rewards/${g.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                                    {g.completedAt ? 'View Case' : 'Complete Case'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                )}

                {view === 'history' && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
                            <div className="relative flex items-center">
                                <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search employee or case number..."
                                    value={historySearch}
                                    onChange={e => setHistorySearch(e.target.value)}
                                    className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold w-64"
                                />
                            </div>
                            <div className="relative flex items-center">
                                <Filter className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                                <select
                                    value={historyTypeFilter}
                                    onChange={e => setHistoryTypeFilter(e.target.value as 'all' | RewardType)}
                                    className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold appearance-none cursor-pointer"
                                >
                                    <option value="all">All Types</option>
                                    {Object.entries(REWARD_TYPE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-auto">
                                {filteredHistory.length} / {rewardCases.length} shown
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead><tr className={THEAD_TR}>
                                    <th className={TH}>Case #</th>
                                    <th className={TH}>Employee</th>
                                    <th className={TH}>Type</th>
                                    <th className={TH}>Period</th>
                                    <th className={TH}>Status</th>
                                    <th className={`${TH} text-right`}>Action</th>
                                </tr></thead>
                                <tbody className={TBODY}>
                                    {filteredHistory.length === 0 && (
                                        <tr><td colSpan={6} className="p-6 text-center text-slate-400">No reward cases found.</td></tr>
                                    )}
                                    {filteredHistory.map(rc => (
                                        <tr key={rc.id} className={TR_HOVER}>
                                            <td className="p-3 text-slate-400 font-mono text-[10px]">{rc.caseNumber}</td>
                                            <td className="p-3 font-bold text-slate-800">{rc.employee?.fullName || '—'}</td>
                                            <td className="p-3">{REWARD_TYPE_LABELS[rc.type]}</td>
                                            <td className="p-3 text-slate-500">{rc.period || (rc.milestoneYears ? `${rc.milestoneYears}yr` : '—')}</td>
                                            <td className="p-3">
                                                <CaseStatusBadge completed={!!rc.completedAt} />
                                                {rc.completedAt && <p className="text-[10px] text-slate-400 mt-1">{format(parseISO(rc.completedAt), 'dd MMM yyyy')}</p>}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => navigate(`/personnel-relations/rewards/${rc.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                                    {rc.completedAt ? 'View Case' : 'Complete Case'}
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

            {/* Select Employee of the Year — manual HR/management pick, evaluation history shown as
                reference only, never as a filter. */}
            <Modal
                isOpen={isEoyModalOpen}
                onClose={() => { setIsEoyModalOpen(false); setEoyEmployeeQuery(''); setEoyEmployee(null); setEoyNotes(''); setEoyBonusPercent(''); }}
                title="Select Employee of the Year"
                maxWidth="max-w-md"
            >
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!eoyEmployee) return toast.error('Select the employee from the suggestions.');
                        try {
                            const created = await rewardService.createEmployeeOfYear({
                                employeeId: eoyEmployee.id, year: eoyYear,
                                notes: eoyNotes || undefined,
                                bonusPercent: eoyBonusPercent ? Number(eoyBonusPercent) : undefined,
                            });
                            toast.success(`Case ${created.caseNumber} opened — complete it to apply the award.`);
                            setIsEoyModalOpen(false);
                            setEoyEmployeeQuery(''); setEoyEmployee(null); setEoyNotes(''); setEoyBonusPercent('');
                            refreshRewards();
                            navigate(`/personnel-relations/rewards/${created.id}`);
                        } catch (err: any) {
                            toast.error(err?.response?.data?.error || 'Failed to open the case.');
                        }
                    }}
                    className="space-y-4 text-xs font-semibold text-slate-700"
                >
                    <p className="text-[10px] text-slate-400 font-normal normal-case">
                        A subjective HR/management pick for {eoyYear} — evaluation history is shown below only as
                        reference context, it is not a filter.
                    </p>
                    <div className="relative">
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Select Employee</label>
                        <input
                            type="text"
                            value={eoyEmployeeQuery}
                            onChange={e => handleEoyEmployeeChange(e.target.value)}
                            onFocus={() => setShowEoySuggestions(true)}
                            onBlur={() => { eoyBlurTimeout.current = window.setTimeout(() => setShowEoySuggestions(false), 150); }}
                            placeholder="Start typing the employee's name…"
                            className="w-full p-2 border border-[#511d29]/20 bg-white font-normal normal-case"
                            autoComplete="off"
                        />
                        {showEoySuggestions && eoySuggestions.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full bg-white border border-[#511d29]/20 rounded shadow-md max-h-56 overflow-auto">
                                {eoySuggestions.map((emp: any) => (
                                    <li key={emp.id}>
                                        <button
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => selectEoyEmployee(emp)}
                                            className="w-full text-left px-3 py-2 text-xs font-normal normal-case hover:bg-slate-50"
                                        >
                                            {emp.fullName}{emp.staffId ? ` (${emp.staffId})` : ''}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {eoyEmployee && (
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded space-y-1.5 font-normal normal-case">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Evaluation Reference</p>
                            <p className="text-[11px] text-slate-600">Evaluation Index: {(eoyEmployee.evaluationPoints || 0).toFixed(2)}</p>
                            {eoyEvalHistory?.allowed && eoyEvalHistory.months.filter(m => m.finalization).length > 0 ? (
                                <ul className="text-[11px] text-slate-500 space-y-0.5">
                                    {[...eoyEvalHistory.months]
                                        .filter(m => m.finalization)
                                        .sort((a, b) => b.month.localeCompare(a.month))
                                        .slice(0, 6)
                                        .map(m => (
                                            <li key={m.month}>{m.month}: {m.finalization!.finalScore.toFixed(2)}%</li>
                                        ))}
                                </ul>
                            ) : (
                                <p className="text-[11px] text-slate-400">No finalized monthly evaluations on file.</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Selection Justification</label>
                        <textarea
                            rows={3}
                            value={eoyNotes}
                            onChange={e => setEoyNotes(e.target.value)}
                            placeholder="Why this employee — outstanding performance, contribution, values alignment…"
                            className="w-full p-2 border border-[#511d29]/20 bg-white font-normal normal-case"
                        />
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Bonus % of Salary (subject to management approval)</label>
                        <input
                            type="number" min={0} max={100} step="0.1"
                            value={eoyBonusPercent}
                            onChange={e => setEoyBonusPercent(e.target.value)}
                            placeholder="e.g. 10"
                            className="w-full p-2 border border-[#511d29]/20 bg-white font-normal normal-case"
                        />
                        <p className="text-[10px] text-slate-400 font-normal normal-case mt-1">
                            The actual currency amount is pending Payroll Integration — this only records the agreed percentage.
                        </p>
                    </div>

                    <button type="submit" className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest hover:bg-[#3a151d]">
                        Grant Employee of the Year
                    </button>
                </form>
            </Modal>
        </>
    );
};

export default RewardsTab;
