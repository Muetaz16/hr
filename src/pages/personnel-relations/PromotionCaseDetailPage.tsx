import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, AlertCircle, UserSquare2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { employeeService } from '../../services/employeeService';
import { promotionService, type PromotionCase, type PromotionStage } from '../../services/promotionService';
import { PROMOTION_REASON_OPTIONS } from '../../constants/promotionReasons';
import { SERVER_URL } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';
import { useTranslation } from 'react-i18next';

const STAGE_LABELS: Record<PromotionStage, string> = {
    PROMOTION_REPORT: 'Promotion Report',
    NOTICE_OF_PROMOTION: 'Notice of Promotion',
    CLOSED: 'Closed',
};

const BASIS_LABELS: Record<string, string> = {
    TENURE: 'Tenure',
    EVALUATION: 'Evaluation Index',
    EXCEPTIONAL: 'Exceptional',
};

// "Reason for Promotion" is never chosen by a person — the backend derives it from the case's
// basis and always returns one of these fixed values; this is display-only.
const reasonLabel = (value?: string | null): string => PROMOTION_REASON_OPTIONS.find(o => o.value === value)?.label || value || '—';

const STAGE_ORDER: PromotionStage[] = ['NOTICE_OF_PROMOTION', 'PROMOTION_REPORT'];

const STAGE_COMPLETED_AT_FIELD: Record<PromotionStage, keyof PromotionCase> = {
    PROMOTION_REPORT: 'promotionReportCompletedAt',
    NOTICE_OF_PROMOTION: 'noticeOfPromotionCompletedAt',
    CLOSED: 'closedAt',
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <span className="block font-black uppercase text-[9px] text-slate-400">{label}</span>
        <div>{value}</div>
    </div>
);

const PromotionCaseDetailPage: React.FC = () => {
    const { caseId } = useParams<{ caseId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const canManage = canAccess(currentUser, [], ['manage_promotions']);

    const { data: c, isLoading, error } = useQuery({
        queryKey: ['promotion-case', caseId],
        queryFn: () => promotionService.get(caseId!),
        enabled: !!caseId,
    });

    const [busy, setBusy] = useState(false);
    const [signedFile, setSignedFile] = useState<File | null>(null);

    // Effectivity Date is the ONLY value a person provides — everything else (identity, org
    // placement, new job title/category, the last-3-months evaluation summary, "Reason for
    // Promotion", "Overall performance rating", and every approver name) is derived automatically.
    const [effectiveDate, setEffectiveDate] = useState('');

    useEffect(() => {
        if (!c) return;
        setEffectiveDate(c.effectiveDate ? c.effectiveDate.slice(0, 10) : '');
    }, [c]);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['promotion-case', caseId] });
        queryClient.invalidateQueries({ queryKey: ['promotion-cases'] });
        queryClient.invalidateQueries({ queryKey: ['promotion-candidates'] });
        // Completing a stage can change the employee's jobGrade/currentGradeSince/evaluationPoints —
        // refresh the roster caches too so the Employee Lifecycle/File view shows the new data.
        queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
        queryClient.invalidateQueries({ queryKey: ['relations-employees-all'] });
    };

    const handleGenerateForm = async (stage: PromotionStage) => {
        if (!c) return;
        if (!c.effectiveDate && !effectiveDate) { toast.error(t('enter_the_effectivity_date_first', { defaultValue: 'Enter the effectivity date first.' })); return; }
        setBusy(true);
        try {
            const blob = await promotionService.generateForm(c.id, stage, { effectiveDate });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${stage}_${c.caseNumber}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Form generated. Collect the required signature(s), then upload the signed copy below.');
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to generate the form.');
        } finally {
            setBusy(false);
        }
    };

    const uploadFile = async (file: File | null): Promise<{ documentUrl: string; documentName: string } | null> => {
        if (!file) { toast.error('Attach a document before continuing.'); return null; }
        const { url, name } = await employeeService.uploadDocument(file);
        return { documentUrl: url, documentName: name };
    };

    const run = async (fn: () => Promise<PromotionCase>) => {
        setBusy(true);
        try {
            await fn();
            setSignedFile(null);
            toast.success('Case updated.');
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Action failed.');
        } finally {
            setBusy(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-400 text-sm">Loading case…</div>;
    }
    if (error || !c) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-red-500" />
                <h2 className="text-lg font-bold text-slate-800">Case not found.</h2>
                <button onClick={() => navigate('/personnel-relations/promotions')} className="text-red-700 font-bold hover:underline text-sm">
                    Back to Promotions
                </button>
            </div>
        );
    }

    const renderStageSummary = (stage: PromotionStage) => {
        let body: React.ReactNode = null;
        if (stage === 'PROMOTION_REPORT') {
            body = <>
                <Row label="Last 3 Months' Evaluation Scores" value={
                    [c.performanceMarch, c.performanceApril, c.performanceMay].filter(Boolean).join(' → ') || '—'
                } />
                <Row label="Overall Performance Rating" value={c.overallPerformanceRating || '—'} />
                <Row label="Signed document" value={c.promotionReportDocumentUrl ? (
                    <a href={`${SERVER_URL}${c.promotionReportDocumentUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.promotionReportDocumentName || 'Signed document'}</a>
                ) : <span className="text-slate-400">No document uploaded</span>} />
            </>;
        } else if (stage === 'NOTICE_OF_PROMOTION') {
            body = <>
                <Row label="Signed document" value={c.noticeOfPromotionDocumentUrl ? (
                    <a href={`${SERVER_URL}${c.noticeOfPromotionDocumentUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.noticeOfPromotionDocumentName || 'Signed document'}</a>
                ) : <span className="text-slate-400">No document uploaded</span>} />
            </>;
        }
        return (
            <details key={stage} className="border border-slate-200 rounded-lg p-3 open:bg-slate-50">
                <summary className="cursor-pointer font-black uppercase text-[10px] text-red-700">{STAGE_LABELS[stage]}</summary>
                <div className="mt-2 space-y-2">{body}</div>
            </details>
        );
    };

    const completedStages = STAGE_ORDER.filter(stage => !!c[STAGE_COMPLETED_AT_FIELD[stage]]);

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/personnel-relations/promotions')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black text-[#511d29]">{c.caseNumber} — {c.employee?.fullName || ''}</h1>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                        {c.stage === 'CLOSED' ? `Closed — Promoted to ${c.toGrade}` : STAGE_LABELS[c.stage]}
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
                    <div><span className="font-black uppercase text-[10px] text-red-700">Basis</span><div>{BASIS_LABELS[c.basis || ''] || c.basis || '—'}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">Current Grade</span><div>{c.employee?.jobGrade || '—'}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">Target Grade</span><div>{c.toGrade}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">Reason for Promotion</span><div>{reasonLabel(c.reason)}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">Filed</span><div>{format(new Date(c.createdAt), 'dd MMM yyyy')}</div></div>
                </div>

                {c.stage === 'CLOSED' && (
                    <div className="border-t border-slate-100 pt-4 text-center">
                        <p className="text-emerald-600 font-bold">
                            Case closed{c.closedAt ? ` on ${format(new Date(c.closedAt), 'dd MMM yyyy')}` : ''}. Employee promoted to {c.toGrade}.
                        </p>
                    </div>
                )}
            </div>

            {completedStages.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">Case History</span>
                    {completedStages.map(renderStageSummary)}
                </div>
            )}

            {canManage && c.stage !== 'CLOSED' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{STAGE_LABELS[c.stage]}</span>
                    <p className="text-slate-400 font-normal normal-case">
                        Employee identity, org placement, new job title/category, reason for promotion, overall
                        performance rating and every approver name are all filled in automatically from the system.
                        {!c.effectiveDate && ' Only the effectivity date needs your input.'}
                    </p>

                    {c.effectiveDate ? (
                        <Row label="Effectivity Date" value={format(new Date(c.effectiveDate), 'dd MMM yyyy')} />
                    ) : (
                        <>
                            <label className="block font-black uppercase text-[10px] text-red-700">Effectivity Date</label>
                            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                        </>
                    )}

                    <button disabled={busy} onClick={() => handleGenerateForm(c.stage)} className="w-full py-2 bg-slate-700 text-white font-black uppercase text-[10px] rounded">
                        Generate {STAGE_LABELS[c.stage]} Form
                    </button>

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-red-700 mb-1">
                            <Paperclip size={12} /> Upload signed copy
                        </label>
                        <input type="file" onChange={e => setSignedFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                    </div>

                    {c.stage === 'NOTICE_OF_PROMOTION' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return promotionService.completeNoticeOfPromotion(c.id, doc);
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            Complete & Move to Promotion Report
                        </button>
                    )}
                    {c.stage === 'PROMOTION_REPORT' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return promotionService.completePromotionReport(c.id, doc);
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            Complete & Promote Employee to {c.toGrade}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PromotionCaseDetailPage;
