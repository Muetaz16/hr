import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { employeeService } from '../../services/employeeService';
import { rewardService } from '../../services/rewardService';
import { fetchEvaluationBreakdown } from '../../utils/evaluationScoring';
import EvaluationBreakdownView from '../../components/EvaluationBreakdownView';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';

type CandidateType = 'month' | 'attendance' | 'loyalty';

const TYPE_TITLES: Record<CandidateType, string> = {
    month: 'Employee of the Month — Candidate Review',
    attendance: 'Attendance Excellence — Candidate Review',
    loyalty: 'Loyalty Milestone — Candidate Review',
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
    const canManage = canAccess(currentUser, [], ['manage_rewards']);

    const validType: CandidateType | null = type === 'month' || type === 'attendance' || type === 'loyalty' ? type : null;
    const period = searchParams.get('period') || '';
    const milestoneYearsParam = searchParams.get('milestoneYears');
    const milestoneYears = milestoneYearsParam === '5' || milestoneYearsParam === '10' ? (Number(milestoneYearsParam) as 5 | 10) : undefined;

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
    const activeDetailQuery = validType === 'month' ? monthDetail : validType === 'attendance' ? attendanceDetail : loyaltyDetail;

    const breakdownQuery = useQuery({
        queryKey: ['reward-candidate-breakdown', employeeId, period],
        queryFn: () => fetchEvaluationBreakdown(employee as any, period),
        enabled: validType === 'month' && !!employee && !!period && !!monthDetail.data,
    });

    const [busy, setBusy] = useState(false);
    const handleOpenCase = async () => {
        if (!employeeId || !validType) return;
        setBusy(true);
        try {
            const created = validType === 'month'
                ? await rewardService.createMonthCase(employeeId, period)
                : validType === 'attendance'
                    ? await rewardService.createAttendanceCase(employeeId, period)
                    : await rewardService.createLoyaltyCase(employeeId, milestoneYears!);
            toast.success(`Case ${created.caseNumber} opened — complete it to apply the award.`);
            navigate(`/personnel-relations/rewards/${created.id}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to open the case.');
        } finally {
            setBusy(false);
        }
    };

    if (!validType) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-red-500" />
                <h2 className="text-lg font-bold text-slate-800">Unknown award type.</h2>
                <button onClick={() => navigate('/personnel-relations/rewards')} className="text-red-700 font-bold hover:underline text-sm">Back to Rewards</button>
            </div>
        );
    }
    if (empLoading || activeDetailQuery.isLoading) {
        return <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>;
    }
    if (!employee || activeDetailQuery.isError) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-red-500" />
                <h2 className="text-lg font-bold text-slate-800">
                    {activeDetailQuery.isError ? 'This employee is no longer an eligible candidate.' : 'Employee not found.'}
                </h2>
                <button onClick={() => navigate('/personnel-relations/rewards')} className="text-red-700 font-bold hover:underline text-sm">Back to Rewards</button>
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

            {canManage && (
                <button disabled={busy} onClick={handleOpenCase} className="w-full py-3 bg-red-700 text-white font-black uppercase text-[10px] rounded">
                    Open Case
                </button>
            )}
        </div>
    );
};

export default RewardCandidateDetailPage;
