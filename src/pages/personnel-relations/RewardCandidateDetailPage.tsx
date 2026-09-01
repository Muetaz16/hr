import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { employeeService } from '../../services/employeeService';
import { evaluationService } from '../../services/evaluationService';
import { rewardService } from '../../services/rewardService';
import { fetchEvaluationBreakdown } from '../../utils/evaluationScoring';
import EvaluationBreakdownView from '../../components/EvaluationBreakdownView';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';
import { useTranslation } from 'react-i18next';

type CandidateType = 'month' | 'attendance' | 'loyalty' | 'year';

const TYPE_TITLES: Record<CandidateType, string> = {
    month: 'Employee of the Month — Candidate Review',
    attendance: 'Attendance Excellence — Candidate Review',
    loyalty: 'Loyalty Milestone — Candidate Review',
    year: 'Employee of the Year — Candidate Review',
};

// No existing tenure formatter anywhere in the codebase (confirmed) — small new addition.
const formatTenure = (months: number): string => {
    const years = Math.floor(months / 12);
    const rem = months % 12;
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
    parts.push(`${rem} month${rem === 1 ? '' : 's'}`);
    return parts.join(', ');
};

const CriteriaRow: React.FC<{ label: string; ok: boolean; detail?: string }> = ({ label, ok, detail }) => (
    <div className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
        {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
        <span className="text-xs font-bold text-slate-700 flex-1">{label}</span>
        {detail && <span className="text-[10px] text-slate-400">{detail}</span>}
    </div>
);

// Live candidate review — nothing is written to the database by visiting this page. Shows the real
// statistics that justify a computed candidate's nomination before HR decides to actually open a case
// (the "Open Case" button below is what creates the draft RewardCase and starts the real
// generate-letter -> upload-signed-copy -> complete cycle on RewardCaseDetailPage).
const RewardCandidateDetailPage: React.FC = () => {
    const { type, employeeId } = useParams<{ type: string; employeeId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const canManage = canAccess(currentUser, [], ['manage_rewards']);

    const validType: CandidateType | null = type === 'month' || type === 'attendance' || type === 'loyalty' || type === 'year' ? type : null;
    const period = searchParams.get('period') || '';
    const milestoneYearsParam = searchParams.get('milestoneYears');
    const milestoneYears = milestoneYearsParam === '5' || milestoneYearsParam === '10' ? (Number(milestoneYearsParam) as 5 | 10) : undefined;
    const year = searchParams.get('year') || String(new Date().getFullYear());

    const { data: employee, isLoading: empLoading } = useQuery({
        queryKey: ['reward-candidate-employee', employeeId],
        queryFn: () => employeeService.getEmployeeById(employeeId!),
        enabled: !!employeeId,
    });

    const monthDetail = useQuery({
        queryKey: ['reward-candidate-month-detail', employeeId, period],
        queryFn: () => rewardService.getMonthCandidateDetail(employeeId!, period),
        enabled: validType === 'month' && !!employeeId && !!period,
        retry: false,
    });
    const attendanceDetail = useQuery({
        queryKey: ['reward-candidate-attendance-detail', employeeId, period],
        queryFn: () => rewardService.getAttendanceCandidateDetail(employeeId!, period),
        enabled: validType === 'attendance' && !!employeeId && !!period,
        retry: false,
    });
    const loyaltyDetail = useQuery({
        queryKey: ['reward-candidate-loyalty-detail', employeeId, milestoneYears],
        queryFn: () => rewardService.getLoyaltyCandidateDetail(employeeId!, milestoneYears!),
        enabled: validType === 'loyalty' && !!employeeId && !!milestoneYears,
        retry: false,
    });
    const yearDetail = useQuery({
        queryKey: ['reward-candidate-year-detail', employeeId, year],
        queryFn: () => rewardService.getYearCandidateDetail(employeeId!, year),
        enabled: validType === 'year' && !!employeeId && !!year,
        retry: false,
    });
    const activeDetailQuery = validType === 'month' ? monthDetail : validType === 'attendance' ? attendanceDetail : validType === 'loyalty' ? loyaltyDetail : yearDetail;

    const breakdownQuery = useQuery({
        queryKey: ['reward-candidate-breakdown', employeeId, period],
        queryFn: () => fetchEvaluationBreakdown(employee as any, period),
        enabled: validType === 'month' && !!employee && !!period && !!monthDetail.data,
    });
    const yearEvalHistory = useQuery({
        queryKey: ['reward-candidate-year-eval-history', employeeId],
        queryFn: () => evaluationService.getEvaluationHistory(employeeId!),
        enabled: validType === 'year' && !!employeeId && !!yearDetail.data,
    });

    const [notes, setNotes] = useState('');
    const [bonusPercent, setBonusPercent] = useState('');

    const [busy, setBusy] = useState(false);
    const handleOpenCase = async () => {
        if (!employeeId || !validType) return;
        setBusy(true);
        try {
            const created = validType === 'month'
                ? await rewardService.createMonthCase(employeeId, period)
                : validType === 'attendance'
                    ? await rewardService.createAttendanceCase(employeeId, period)
                    : validType === 'loyalty'
                        ? await rewardService.createLoyaltyCase(employeeId, milestoneYears!)
                        : await rewardService.createEmployeeOfYear({
                            employeeId, year, notes: notes || undefined,
                            bonusPercent: bonusPercent ? Number(bonusPercent) : undefined,
                        });
            toast.success(`Case ${created.caseNumber} opened — complete it to apply the award.`);
            navigate(`/personnel-relations/rewards/${created.id}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_open_the_case', { defaultValue: 'Failed to open the case.' }));
        } finally {
            setBusy(false);
        }
    };

    if (!validType) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-red-500" />
                <h2 className="text-lg font-bold text-slate-800">{t('unknown_award_type', { defaultValue: 'Unknown award type.' })}</h2>
                <button onClick={() => navigate('/personnel-relations/rewards')} className="text-red-700 font-bold hover:underline text-sm">{t('back_to_rewards', { defaultValue: 'Back to Rewards' })}</button>
            </div>
        );
    }
    if (empLoading || activeDetailQuery.isLoading) {
        return <div className="p-8 text-center text-slate-400 text-sm">{t('loading', { defaultValue: 'Loading…' })}</div>;
    }
    if (!employee || activeDetailQuery.isError) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-red-500" />
                <h2 className="text-lg font-bold text-slate-800">
                    {activeDetailQuery.isError ? t('this_employee_is_no_longer_an_eligible_candidate', { defaultValue: 'This employee is no longer an eligible candidate.' }) : t('employee_not_found', { defaultValue: 'Employee not found.' })}
                </h2>
                <button onClick={() => navigate('/personnel-relations/rewards')} className="text-red-700 font-bold hover:underline text-sm">{t('back_to_rewards', { defaultValue: 'Back to Rewards' })}</button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/personnel-relations/rewards')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black text-[#511d29]">{employee.fullName}</h1>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">{TYPE_TITLES[validType]}</p>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div><span className="block font-black uppercase text-[10px] text-red-700">Staff ID</span>{employee.staffId || '—'}</div>
                <div><span className="block font-black uppercase text-[10px] text-red-700">Department</span>{(employee as any).department?.name || '—'}</div>
            </div>

            {validType === 'month' && monthDetail.data && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
                    <div className="flex items-center gap-8">
                        <div><span className="block font-black uppercase text-[10px] text-red-700">Rank</span><span className="text-2xl font-black text-[#511d29]">#{monthDetail.data.rank}</span></div>
                        <div><span className="block font-black uppercase text-[10px] text-red-700">Final Score</span><span className="text-2xl font-black text-[#511d29]">{monthDetail.data.finalScore.toFixed(2)}%</span></div>
                    </div>
                    {breakdownQuery.data && <EvaluationBreakdownView employee={employee} breakdown={breakdownQuery.data} />}
                </div>
            )}

            {validType === 'attendance' && attendanceDetail.data && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs">
                    <p className="text-slate-400 font-semibold mb-2">Cycle: {attendanceDetail.data.cycleStart} → {attendanceDetail.data.cycleEnd}</p>
                    <CriteriaRow label="No late arrivals" ok={attendanceDetail.data.attendanceSummary.lateDays === 0} detail={`${attendanceDetail.data.attendanceSummary.lateDays} late day(s)`} />
                    <CriteriaRow label="No unauthorized absences" ok={attendanceDetail.data.attendanceSummary.unauthorizedAbsenceDays === 0} detail={`${attendanceDetail.data.attendanceSummary.unauthorizedAbsenceDays} day(s)`} />
                    <CriteriaRow label="No early departures" ok={attendanceDetail.data.attendanceSummary.earlyOutDays === 0} detail={`${attendanceDetail.data.attendanceSummary.earlyOutDays} day(s)`} />
                    <CriteriaRow label="No leave requests filed this period" ok={!attendanceDetail.data.hasLeaveRequestFiled} />
                    <CriteriaRow label="No confirmed disciplinary record" ok={!attendanceDetail.data.hasConfirmedDisciplinaryRecord} />
                    <CriteriaRow label="Resident per BioTime (not using company transportation)" ok />
                </div>
            )}

            {validType === 'loyalty' && loyaltyDetail.data && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2 text-xs">
                    <p><span className="font-black uppercase text-[10px] text-red-700">Join Date:</span> {employee.joinDate ? format(parseISO(employee.joinDate), 'dd MMM yyyy') : '—'}</p>
                    <p><span className="font-black uppercase text-[10px] text-red-700">Tenure:</span> {formatTenure(loyaltyDetail.data.tenureMonths)}</p>
                    <p><span className="font-black uppercase text-[10px] text-red-700">Milestone Reached:</span> {format(parseISO(loyaltyDetail.data.milestoneDate), 'dd MMM yyyy')} ({loyaltyDetail.data.milestoneYears} years)</p>
                </div>
            )}

            {validType === 'year' && yearDetail.data && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <CriteriaRow label="12+ months tenure" ok detail={formatTenure(yearDetail.data.tenureMonths)} />
                    <CriteriaRow label="No confirmed disciplinary record (past 12 months)" ok />
                    <CriteriaRow label="Employee of the Month win(s) this year" ok detail={`${yearDetail.data.monthWinsThisYear.length} win(s): ${yearDetail.data.monthWinsThisYear.join(', ')}`} />
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Evaluation Reference (not a filter)</p>
                        {yearEvalHistory.data?.allowed && yearEvalHistory.data.months.filter(m => m.finalization).length > 0 ? (
                            <ul className="text-[11px] text-slate-500 space-y-0.5">
                                {[...yearEvalHistory.data.months]
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
                </div>
            )}

            {validType === 'year' && yearDetail.data && canManage && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
                    <div>
                        <label className="block text-red-700 font-black uppercase text-[10px] mb-1">Selection Justification</label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Why this employee — outstanding performance, contribution, values alignment…"
                            className="w-full p-2 border border-slate-200 rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-red-700 font-black uppercase text-[10px] mb-1">Bonus % of Salary (subject to management approval)</label>
                        <input
                            type="number" min={0} max={100} step="0.1"
                            value={bonusPercent}
                            onChange={e => setBonusPercent(e.target.value)}
                            placeholder="e.g. 10"
                            className="w-full p-2 border border-slate-200 rounded"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">The actual currency amount is pending Payroll Integration — this only records the agreed percentage.</p>
                    </div>
                </div>
            )}

            {canManage && (
                <button disabled={busy} onClick={handleOpenCase} className="w-full py-3 bg-red-700 text-white font-black uppercase text-[10px] rounded">
                    {validType === 'year' ? 'Grant Employee of the Year' : 'Open Case'}
                </button>
            )}
        </div>
    );
};

export default RewardCandidateDetailPage;
