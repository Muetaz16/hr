import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, AlertCircle, UserSquare2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { employeeService } from '../../services/employeeService';
import { rewardService, type RewardCase, type RewardType } from '../../services/rewardService';
import { SERVER_URL } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';

const TYPE_LABELS: Record<RewardType, string> = {
    EMPLOYEE_OF_MONTH: 'Employee of the Month',
    ATTENDANCE_EXCELLENCE: 'Monthly Attendance and Timeliness Excellence Award',
    EMPLOYEE_OF_YEAR: 'Employee of the Year',
    LOYALTY_MILESTONE: 'Loyalty & Service Milestone Award',
    EXCEPTIONAL_PERFORMANCE: 'Exceptional Performance / Exceptional Contribution Award',
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <span className="block font-black uppercase text-[9px] text-slate-400">{label}</span>
        <div>{value}</div>
    </div>
);

const RewardCaseDetailPage: React.FC = () => {
    const { caseId } = useParams<{ caseId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_rewards']);

    const { data: c, isLoading, error } = useQuery({
        queryKey: ['reward-case', caseId],
        queryFn: () => rewardService.get(caseId!),
        enabled: !!caseId,
    });

    const [busy, setBusy] = useState(false);
    const [signedFile, setSignedFile] = useState<File | null>(null);
    const [physicalNote, setPhysicalNote] = useState('');

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['reward-case', caseId] });
        queryClient.invalidateQueries({ queryKey: ['reward-cases'] });
        // Completing a case credits bonusHolidays — keep the roster caches in sync.
        queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
        queryClient.invalidateQueries({ queryKey: ['relations-employees-all'] });
    };

    const handleGenerateLetter = async () => {
        if (!c) return;
        setBusy(true);
        try {
            const blob = await rewardService.generateAppreciationLetter(c.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Appreciation_Letter_${c.caseNumber}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Letter generated. Collect the required signature(s), then upload the signed copy below.');
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'The Appreciation Letter template is not available yet.');
        } finally {
            setBusy(false);
        }
    };

    const run = async (fn: () => Promise<RewardCase>, successMessage: string) => {
        setBusy(true);
        try {
            await fn();
            setSignedFile(null);
            toast.success(successMessage);
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Action failed.');
        } finally {
            setBusy(false);
        }
    };

    const handleComplete = () => {
        if (!signedFile) { toast.error('Attach the signed document before completing this award.'); return; }
        run(async () => {
            const { url, name } = await employeeService.uploadDocument(signedFile);
            return rewardService.complete(c!.id, { documentUrl: url, documentName: name });
        }, 'Award completed and applied to the employee.');
    };

    const handleMarkPhysicalFulfilled = () => {
        run(() => rewardService.markPhysicalRewardFulfilled(c!.id, physicalNote || undefined), 'Marked as fulfilled.');
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-400 text-sm">Loading case…</div>;
    }
    if (error || !c) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-red-500" />
                <h2 className="text-lg font-bold text-slate-800">Case not found.</h2>
                <button onClick={() => navigate('/personnel-relations/rewards')} className="text-red-700 font-bold hover:underline text-sm">
                    Back to Rewards
                </button>
            </div>
        );
    }

    const rewardParts: string[] = [];
    if (c.bonusLeaveDaysGranted > 0) rewardParts.push(`${c.bonusLeaveDaysGranted} additional day${c.bonusLeaveDaysGranted === 1 ? '' : 's'} of paid annual leave`);
    if (c.type === 'EMPLOYEE_OF_YEAR') rewardParts.push('Certificate of Appreciation');
    if (c.type === 'LOYALTY_MILESTONE') rewardParts.push(c.milestoneYears === 10 ? 'Commemorative plaque/trophy' : 'Engraved watch');
    if (c.bonusPercent != null) rewardParts.push(`${c.bonusPercent}% one-time bonus — Pending Payroll Integration`);
    const hasPhysicalComponent = c.type === 'EMPLOYEE_OF_YEAR' || c.type === 'LOYALTY_MILESTONE';

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/personnel-relations/rewards')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black text-[#511d29]">{c.caseNumber} — {c.employee?.fullName || ''}</h1>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                        {TYPE_LABELS[c.type]}{c.completedAt ? ' — Completed' : ' — Draft'}
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/personnel-relations/lifecycle?employeeId=${c.employeeId}`)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                >
                    <UserSquare2 size={14} /> View Employee File
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-600">
                    <Row label="Period" value={c.period || (c.milestoneYears ? `${c.milestoneYears}-Year Milestone` : '—')} />
                    <Row label="Reward" value={rewardParts.length ? rewardParts.join(', ') : 'N/A'} />
                    {c.notes && <Row label="Notes" value={c.notes} />}
                    <Row label="Filed" value={`${format(new Date(c.createdAt), 'dd MMM yyyy')}${c.createdByName ? ` by ${c.createdByName}` : ''}`} />
                </div>

                {c.completedAt && (
                    <div className="border-t border-slate-100 pt-4 text-center">
                        <p className="text-emerald-600 font-bold">
                            Completed on {format(new Date(c.completedAt), 'dd MMM yyyy')} — award applied to the employee.
                        </p>
                        {c.documentUrl && (
                            <a href={`${SERVER_URL}${c.documentUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[11px]">
                                {c.documentName || 'Signed document'}
                            </a>
                        )}
                    </div>
                )}
            </div>

            {canManage && !c.completedAt && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">Complete This Award</span>
                    <p className="text-slate-400 font-normal normal-case">
                        Nothing is applied to the employee yet — generate the letter, collect the required
                        signature(s), then upload the signed copy and complete the case.
                    </p>

                    <button disabled={busy} onClick={handleGenerateLetter} className="w-full py-2 bg-slate-700 text-white font-black uppercase text-[10px] rounded">
                        Generate Appreciation Letter
                    </button>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-red-700 mb-1">
                            <Paperclip size={12} /> Upload signed copy
                        </label>
                        <input type="file" onChange={e => setSignedFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                    </div>

                    <button disabled={busy} onClick={handleComplete} className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded">
                        Complete & Apply Award
                    </button>
                </div>
            )}

            {canManage && c.completedAt && hasPhysicalComponent && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">
                        Physical {c.type === 'EMPLOYEE_OF_YEAR' ? 'Certificate' : 'Gift'}
                    </span>
                    {c.physicalRewardFulfilledAt ? (
                        <p className="text-emerald-600 font-bold">
                            Fulfilled on {format(new Date(c.physicalRewardFulfilledAt), 'dd MMM yyyy')}
                            {c.physicalRewardNote ? ` — "${c.physicalRewardNote}"` : ''}
                        </p>
                    ) : (
                        <>
                            <input
                                type="text" value={physicalNote} onChange={e => setPhysicalNote(e.target.value)}
                                placeholder="Optional note"
                                className="w-full p-2 border border-slate-200 rounded font-normal normal-case"
                            />
                            <button disabled={busy} onClick={handleMarkPhysicalFulfilled} className="w-full py-2 bg-slate-700 text-white font-black uppercase text-[10px] rounded">
                                Mark as Fulfilled
                            </button>
                        </>
                    )}
                </div>
            )}

            {canManage && c.completedAt && (
                <button disabled={busy} onClick={handleGenerateLetter} className="w-full py-2 bg-slate-700 text-white font-black uppercase text-[10px] rounded">
                    Re-generate Appreciation Letter
                </button>
            )}
        </div>
    );
};

export default RewardCaseDetailPage;
