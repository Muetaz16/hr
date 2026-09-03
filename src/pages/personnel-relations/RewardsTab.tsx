import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Award, Search, Filter } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import {
    rewardService,
    type RewardType,
    type RewardCase,
    type RewardMonthCandidate,
    type RewardAttendanceCandidate,
    type RewardAttendanceExclusion,
    type RewardLoyaltyCandidate,
    type RewardLoyaltyExclusion,
    type RewardYearCandidate,
} from '../../services/rewardService';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';

// Exported for the Employee Lifecycle tree's "Rewards Record" section (PersonnelRelations.tsx),
// which lists an employee's own cases outside this tab.
export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
    EMPLOYEE_OF_MONTH: 'Employee of the Month',
    ATTENDANCE_EXCELLENCE: 'Attendance Excellence',
    EMPLOYEE_OF_YEAR: 'Employee of the Year',
    LOYALTY_MILESTONE: 'Loyalty Milestone',
    EXCEPTIONAL_PERFORMANCE: 'Exceptional Performance / Exceptional Contribution Award',
};

// One shared badge for every Draft/Completed indicator across the tab — same formula the
// Disciplinary tab (this page's sibling) already uses for its own status chips.
const CaseStatusBadge: React.FC<{ completed: boolean }> = ({ completed }) => {
    const { t } = useTranslation();
    return (
        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${completed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {completed ? t('completed', { defaultValue: 'Completed' }) : t('draft', { defaultValue: 'Draft' })}
        </span>
    );
};

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
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();

    const canManageAwards = canAccess(currentUser, ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], ['manage_rewards']);

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
            toast.error(err?.response?.data?.error || t('failed_to_compute_candidates', { defaultValue: 'Failed to compute candidates.' }));
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
            toast.error(err?.response?.data?.error || t('failed_to_compute_candidates', { defaultValue: 'Failed to compute candidates.' }));
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
                toast.error(`${c.employee.fullName}: ${err?.response?.data?.error || t('failed_to_open_a_case', { defaultValue: 'Failed to open a case.' })}`);
            }
        }
        toast.success(t('cases_opened_for_all_eligible', { defaultValue: 'Cases opened for all eligible employees — complete each one below to apply the award.' }));
        setAttResult(null);
        refreshRewards();
    };

    // Loyalty & Service Milestone Award — on-demand scan, satisfying the spec's "automatic alerts"
    // via an HR-triggered check rather than a background cron/push notification.
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [loyaltyCandidates, setLoyaltyCandidates] = useState<RewardLoyaltyCandidate[] | null>(null);
    const [loyaltyExcluded, setLoyaltyExcluded] = useState<RewardLoyaltyExclusion[]>([]);
    const checkLoyaltyMilestones = async () => {
        setLoyaltyLoading(true);
        setLoyaltyCandidates(null);
        try {
            const { candidates, excluded } = await rewardService.getLoyaltyCandidates();
            setLoyaltyCandidates(candidates);
            setLoyaltyExcluded(excluded);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_check_milestones', { defaultValue: 'Failed to check milestones.' }));
        } finally {
            setLoyaltyLoading(false);
        }
    };

    // Employee of the Year — the pool is filtered (12-month tenure, 12-month disciplinary-free, at
    // least one Employee of the Month win this year); the final pick among these candidates is still
    // manual, matching how Month/Attendance/Loyalty already work.
    const [eoyYear, setEoyYear] = useState(String(new Date().getFullYear()));
    const [eoyLoading, setEoyLoading] = useState(false);
    const [eoyCandidates, setEoyCandidates] = useState<RewardYearCandidate[] | null>(null);
    const computeYearCandidates = async () => {
        setEoyLoading(true);
        setEoyCandidates(null);
        try {
            const { candidates } = await rewardService.getYearCandidates(eoyYear);
            setEoyCandidates(candidates);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_compute_candidates', { defaultValue: 'Failed to compute candidates.' }));
        } finally {
            setEoyLoading(false);
        }
    };

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
                            <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">{t('rewards_and_recognition', { defaultValue: 'Rewards & Recognition' })}</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                {t('rewards_intro', { defaultValue: 'Nothing here runs automatically — candidates are computed on demand, and no award is applied to the employee until its case is completed with a signed, uploaded document. Bi-Annual Bonus is not yet configured.' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => setView('awards')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${view === 'awards' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}
                        >
                            {t('awards', { defaultValue: 'Awards' })}
                        </button>
                        <button
                            onClick={() => setView('history')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${view === 'history' ? 'bg-[#511d29] text-white' : 'bg-white border border-[#511d29]/20 text-[#511d29]'}`}
                        >
                            {t('history', { defaultValue: 'History' })}{rewardCases.length > 0 ? ` (${rewardCases.length})` : ''}
                        </button>
                    </div>
                </div>

                {view === 'awards' && (
                    <>
                        {canManageAwards && <>
                        {/* Employee of the Month */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('employee_of_the_month', { defaultValue: 'Employee of the Month' })}</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        {t('employee_of_month_hint', { defaultValue: 'Ranked by finalized monthly evaluation score. Requires active full-time employment, 6+ months tenure, and no confirmed disciplinary action in the last 6 months.' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="month" value={momMonth} onChange={e => setMomMonth(e.target.value)} className="p-2 border border-slate-200 rounded text-xs font-semibold" />
                                    <button onClick={computeMonthCandidates} disabled={momLoading} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d] disabled:opacity-50">
                                        {momLoading ? t('computing', { defaultValue: 'Computing…' }) : t('compute_candidates', { defaultValue: 'Compute Candidates' })}
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
                                            {existingCase.finalScoreSnapshot != null && <span className="text-[10px] text-slate-400">{t('score', { defaultValue: 'Score' })} {existingCase.finalScoreSnapshot.toFixed(2)}%</span>}
                                        </div>
                                        <button onClick={() => navigate(`/personnel-relations/rewards/${existingCase.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                            {existingCase.completedAt ? t('view_case', { defaultValue: 'View Case' }) : t('complete_case', { defaultValue: 'Complete Case' })}
                                        </button>
                                    </div>
                                );
                                if (momCandidates === null) return <p className="text-xs text-slate-400 font-semibold">{t('pick_month_compute_ranked', { defaultValue: 'Pick a month and click "Compute Candidates" to see the ranked list.' })}</p>;
                                if (momCandidates.length === 0) return <p className="text-xs text-slate-400 font-semibold">{t('no_eligible_candidates_for', { period: momMonth, defaultValue: 'No eligible candidates found for {{period}}.' })}</p>;
                                return (
                                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                        <table className="w-full text-start border-collapse text-xs">
                                            <thead><tr className={THEAD_TR}>
                                                <th className={TH}>{t('rank', { defaultValue: 'Rank' })}</th>
                                                <th className={TH}>{t('employee', { defaultValue: 'Employee' })}</th>
                                                <th className={TH}>{t('score', { defaultValue: 'Score' })}</th>
                                                <th className={`${TH} text-end`}>{t('action', { defaultValue: 'Action' })}</th>
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
                                                        <td className="p-3 text-end">
                                                            <button onClick={() => navigate(`/personnel-relations/rewards/candidates/month/${c.employeeId}?period=${momMonth}`)} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">{t('review', { defaultValue: 'Review' })}</button>
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
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('attendance_excellence_award', { defaultValue: 'Monthly Attendance & Timeliness Excellence Award' })}</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        {t('attendance_excellence_hint', { defaultValue: 'Threshold award — every qualifying employee is eligible, not just one winner. Requires BioTime-resident status (no company transportation), zero late arrivals or unauthorized absences, no leave filed, and no confirmed disciplinary record this cycle.' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)} className="p-2 border border-slate-200 rounded text-xs font-semibold" />
                                    <button onClick={computeAttendanceCandidates} disabled={attLoading} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d] disabled:opacity-50">
                                        {attLoading ? t('computing', { defaultValue: 'Computing…' }) : t('compute_candidates', { defaultValue: 'Compute Candidates' })}
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
                                                            {g.completedAt ? t('view_case', { defaultValue: 'View Case' }) : t('complete_case', { defaultValue: 'Complete Case' })}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {attResult === null ? (
                                            <p className="text-xs text-slate-400 font-semibold">{t('pick_month_compute_qualifies', { defaultValue: 'Pick a month and click "Compute Candidates" to check who qualifies.' })}</p>
                                        ) : attResult.candidates.length === 0 ? (
                                            <p className="text-xs text-slate-400 font-semibold">{t('no_qualifying_employees_this_month', { defaultValue: 'No qualifying employees for this month.' })}</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex justify-end">
                                                    <button onClick={openAllAttendanceCases} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">{t('open_cases_for_all_eligible', { defaultValue: 'Open Cases for All Eligible' })}</button>
                                                </div>
                                                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                                    <table className="w-full text-start border-collapse text-xs">
                                                        <thead><tr className={THEAD_TR}>
                                                            <th className={TH}>{t('employee', { defaultValue: 'Employee' })}</th>
                                                            <th className={`${TH} text-end`}>{t('action', { defaultValue: 'Action' })}</th>
                                                        </tr></thead>
                                                        <tbody className={TBODY}>
                                                            {attResult.candidates.map(c => (
                                                                <tr key={c.employeeId} className={TR_HOVER}>
                                                                    <td className="p-3">
                                                                        <p className="font-bold text-slate-800">{c.employee.fullName}</p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">{c.employee.staffId}</p>
                                                                    </td>
                                                                    <td className="p-3 text-end">
                                                                        <button onClick={() => navigate(`/personnel-relations/rewards/candidates/attendance/${c.employeeId}?period=${attMonth}`)} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">{t('review', { defaultValue: 'Review' })}</button>
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
                                                <summary className="cursor-pointer font-black uppercase tracking-widest text-slate-400">{t('excluded_count', { count: attResult.excluded.length, defaultValue: 'Excluded ({{count}})' })}</summary>
                                                <ul className="mt-2 space-y-1">
                                                    {attResult.excluded.map(e => (
                                                        <li key={e.employeeId}>{e.employeeName} — {e.reason === 'NO_BIO_ID' ? t('no_attendance_device_linked', { defaultValue: 'No attendance device linked' }) : e.reason === 'BIOTIME_UNREACHABLE' ? t('could_not_reach_biotime', { defaultValue: 'Could not reach BioTime to confirm residency — try again' }) : t('attendance_data_unavailable', { defaultValue: 'Attendance data unavailable' })}</li>
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
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('employee_of_the_year', { defaultValue: 'Employee of the Year' })}</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        {t('employee_of_year_hint', { defaultValue: 'Restricted to employees with 12+ months tenure, no confirmed disciplinary action in the last 12 months, and at least one Employee of the Month win this year. The final pick among these candidates is still a manual HR/Management decision.' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <input type="number" value={eoyYear} onChange={e => setEoyYear(e.target.value)} className="w-24 p-2 border border-slate-200 rounded text-xs font-semibold" />
                                    <button onClick={computeYearCandidates} disabled={eoyLoading} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d] disabled:opacity-50">
                                        {eoyLoading ? t('computing', { defaultValue: 'Computing…' }) : t('compute_candidates', { defaultValue: 'Compute Candidates' })}
                                    </button>
                                </div>
                            </div>
                            {(() => {
                                const existingCase = rewardCases.find(c => c.type === 'EMPLOYEE_OF_YEAR' && c.period === eoyYear);
                                if (existingCase) return (
                                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <CaseStatusBadge completed={!!existingCase.completedAt} />
                                                <p className="text-xs font-black text-slate-700">{existingCase.employee?.fullName} — {existingCase.caseNumber}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">{existingCase.bonusPercent != null ? t('bonus_pending_payroll', { percent: existingCase.bonusPercent, defaultValue: '{{percent}}% bonus — Pending Payroll Integration' }) : t('no_bonus_set', { defaultValue: 'No bonus % set' })}</span>
                                        </div>
                                        {existingCase.notes && <p className="text-[11px] italic text-slate-500">"{existingCase.notes}"</p>}
                                        <button onClick={() => navigate(`/personnel-relations/rewards/${existingCase.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                            {existingCase.completedAt ? t('view_case', { defaultValue: 'View Case' }) : t('complete_case', { defaultValue: 'Complete Case' })}
                                        </button>
                                    </div>
                                );
                                if (eoyCandidates === null) return <p className="text-xs text-slate-400 font-semibold">{t('pick_year_compute_eligible', { defaultValue: "Pick a year and click \"Compute Candidates\" to see who's eligible." })}</p>;
                                if (eoyCandidates.length === 0) return <p className="text-xs text-slate-400 font-semibold">{t('no_eligible_candidates_for', { period: eoyYear, defaultValue: 'No eligible candidates found for {{period}}.' })}</p>;
                                return (
                                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                        <table className="w-full text-start border-collapse text-xs">
                                            <thead><tr className={THEAD_TR}>
                                                <th className={TH}>{t('employee', { defaultValue: 'Employee' })}</th>
                                                <th className={TH}>{t('month_wins_this_year', { defaultValue: 'Month Wins This Year' })}</th>
                                                <th className={`${TH} text-end`}>{t('action', { defaultValue: 'Action' })}</th>
                                            </tr></thead>
                                            <tbody className={TBODY}>
                                                {eoyCandidates.map(c => (
                                                    <tr key={c.employeeId} className={TR_HOVER}>
                                                        <td className="p-3">
                                                            <p className="font-bold text-slate-800">{c.employee.fullName}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{c.employee.staffId}</p>
                                                        </td>
                                                        <td className="p-3 font-bold">{c.monthWinsThisYear.length}</td>
                                                        <td className="p-3 text-end">
                                                            <button onClick={() => navigate(`/personnel-relations/rewards/candidates/year/${c.employeeId}?year=${eoyYear}`)} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">{t('review', { defaultValue: 'Review' })}</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Loyalty & Service Milestone Award */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('loyalty_milestone_award', { defaultValue: 'Loyalty & Service Milestone Award' })}</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                        {t('loyalty_milestone_hint', { defaultValue: 'Surfaces employees who newly reached 5 or 10 years of continuous active service. Each milestone is granted once per employee.' })}
                                    </p>
                                </div>
                                <button onClick={checkLoyaltyMilestones} disabled={loyaltyLoading} className="px-3 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-[#3a151d] disabled:opacity-50 shrink-0">
                                    {loyaltyLoading ? t('checking', { defaultValue: 'Checking…' }) : t('check_milestones', { defaultValue: 'Check Milestones' })}
                                </button>
                            </div>
                            {loyaltyCandidates === null ? (
                                <p className="text-xs text-slate-400 font-semibold">{t('click_check_milestones_hint', { defaultValue: 'Click "Check Milestones" to find employees who newly reached 5 or 10 years of service.' })}</p>
                            ) : loyaltyCandidates.length === 0 ? (
                                <p className="text-xs text-slate-400 font-semibold">{t('no_new_milestones_reached', { defaultValue: 'No new milestones reached.' })}</p>
                            ) : (
                                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                    <table className="w-full text-start border-collapse text-xs">
                                        <thead><tr className={THEAD_TR}>
                                            <th className={TH}>{t('employee', { defaultValue: 'Employee' })}</th>
                                            <th className={TH}>{t('milestone', { defaultValue: 'Milestone' })}</th>
                                            <th className={`${TH} text-end`}>{t('action', { defaultValue: 'Action' })}</th>
                                        </tr></thead>
                                        <tbody className={TBODY}>
                                            {loyaltyCandidates.map(c => (
                                                <tr key={`${c.employeeId}:${c.milestoneYears}`} className={TR_HOVER}>
                                                    <td className="p-3">
                                                        <p className="font-bold text-slate-800">{c.employee.fullName}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">{c.employee.staffId}</p>
                                                    </td>
                                                    <td className="p-3 font-bold">{t('n_year', { years: c.milestoneYears, defaultValue: '{{years}}-year' })}</td>
                                                    <td className="p-3 text-end">
                                                        <button onClick={() => navigate(`/personnel-relations/rewards/candidates/loyalty/${c.employeeId}?milestoneYears=${c.milestoneYears}`)} className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-800">{t('review', { defaultValue: 'Review' })}</button>
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
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('cases', { defaultValue: 'Cases' })}</span>
                                        {opened.map(g => (
                                            <div key={g.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <CaseStatusBadge completed={!!g.completedAt} />
                                                    <p className="text-xs font-black text-slate-700">{g.employee?.fullName} — {t('n_year_milestone', { years: g.milestoneYears, defaultValue: '{{years}}-year Milestone' })}</p>
                                                    <span className="text-[10px] text-slate-400">{t('bonus_pending_payroll', { percent: g.bonusPercent, defaultValue: '{{percent}}% bonus — Pending Payroll Integration' })}{g.physicalRewardFulfilledAt ? t('gift_fulfilled_suffix', { defaultValue: ' · Gift Fulfilled' }) : ''}</span>
                                                </div>
                                                <button onClick={() => navigate(`/personnel-relations/rewards/${g.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                                    {g.completedAt ? t('view_case', { defaultValue: 'View Case' }) : t('complete_case', { defaultValue: 'Complete Case' })}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                            {loyaltyExcluded.length > 0 && (
                                <details className="text-[11px] text-slate-400">
                                    <summary className="cursor-pointer font-black uppercase tracking-widest text-slate-400">{t('excluded_count', { count: loyaltyExcluded.length, defaultValue: 'Excluded ({{count}})' })}</summary>
                                    <ul className="mt-2 space-y-1">
                                        {loyaltyExcluded.map(e => (
                                            <li key={e.employeeId}>{e.employeeName} — {e.reason === 'NO_BIO_ID' ? t('no_attendance_device_linked', { defaultValue: 'No attendance device linked' }) : t('attendance_data_unavailable', { defaultValue: 'Attendance data unavailable' })}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                        </>}

                        {canManageAwards && (() => {
                            const readyToFinalize = rewardCases.filter(c => c.type === 'EXCEPTIONAL_PERFORMANCE' && !c.completedAt);
                            return (
                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                    <div>
                                        <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{t('exceptional_performance_award', { defaultValue: 'Exceptional Performance / Exceptional Contribution Award' })}</h4>
                                        <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                                            {t('exceptional_performance_hint', { defaultValue: 'Nominated by a Head, approved by HR Manager then the General Manager — via Staff Hub → Approvals, not this screen. A case appears here automatically once that chain fully completes, ready for the usual signed-document finalize step.' })}
                                        </p>
                                    </div>
                                    {readyToFinalize.length === 0 ? (
                                        <p className="text-xs text-slate-400 font-semibold">{t('no_approved_nominations', { defaultValue: 'No approved nominations awaiting finalization.' })}</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {readyToFinalize.map(rc => (
                                                <div key={rc.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-black text-slate-700">{rc.employee?.fullName} — {rc.caseNumber}</p>
                                                        <p className="text-[10px] text-slate-400">{t('nominated_by_proposed', { name: rc.createdByName || t('a_head', { defaultValue: 'a Head' }), percent: rc.bonusPercent, defaultValue: 'Nominated by {{name}} · {{percent}}% proposed' })}</p>
                                                    </div>
                                                    <button onClick={() => navigate(`/personnel-relations/rewards/${rc.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">{t('complete_case', { defaultValue: 'Complete Case' })}</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}

                {view === 'history' && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
                            <div className="relative flex items-center">
                                <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder={t('search_employee_or_case', { defaultValue: 'Search employee or case number...' })}
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
                                    <option value="all">{t('all_types', { defaultValue: 'All Types' })}</option>
                                    {Object.entries(REWARD_TYPE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-auto">
                                {filteredHistory.length} / {rewardCases.length} {t('shown', { defaultValue: 'shown' })}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-start border-collapse text-xs md:text-sm">
                                <thead><tr className={THEAD_TR}>
                                    <th className={TH}>{t('case_number_hash', { defaultValue: 'Case #' })}</th>
                                    <th className={TH}>{t('employee', { defaultValue: 'Employee' })}</th>
                                    <th className={TH}>{t('type', { defaultValue: 'Type' })}</th>
                                    <th className={TH}>{t('period', { defaultValue: 'Period' })}</th>
                                    <th className={TH}>{t('status', { defaultValue: 'Status' })}</th>
                                    <th className={`${TH} text-end`}>{t('action', { defaultValue: 'Action' })}</th>
                                </tr></thead>
                                <tbody className={TBODY}>
                                    {filteredHistory.length === 0 && (
                                        <tr><td colSpan={6} className="p-6 text-center text-slate-400">{t('no_reward_cases_found', { defaultValue: 'No reward cases found.' })}</td></tr>
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
                                            <td className="p-3 text-end">
                                                <button onClick={() => navigate(`/personnel-relations/rewards/${rc.id}`)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded hover:bg-slate-100">
                                                    {rc.completedAt ? t('view_case', { defaultValue: 'View Case' }) : t('complete_case', { defaultValue: 'Complete Case' })}
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
        </>
    );
};

export default RewardsTab;
