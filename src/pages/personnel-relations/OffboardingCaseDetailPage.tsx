import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, AlertCircle, UserSquare2, FileBadge } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { employeeService } from '../../services/employeeService';
import { offboardingService, type OffboardingCase, type OffboardingStage } from '../../services/offboardingService';
import { REASON_FOR_LEAVING_OPTIONS, RATING_CATEGORIES } from '../../constants/offboardingExitInterview';
import { SERVER_URL } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';
import { useTranslation } from 'react-i18next';

const STAGE_LABELS: Record<OffboardingStage, string> = {
    RESIGNATION_REQUEST: 'Resignation Request',
    CLEARANCE: 'Employee Clearance',
    SEPARATION_LETTER: 'Separation Letter',
    CLOSED: 'Closed',
};

const SOURCE_LABELS: Record<string, string> = {
    EMPLOYEE_RESIGNATION: 'Employee Resignation',
    DISCIPLINARY_TERMINATION: 'Disciplinary Termination',
    TERMINATION: 'Termination (Manually Recorded)',
    CONTRACT_NON_RENEWAL_EMPLOYEE: 'Contract Non-Renewal (by Employee)',
    CONTRACT_NON_RENEWAL_COMPANY: 'Contract Non-Renewal (by Company)',
};

// The Separation Letter's printed "Reason:" is derived from the case's own source, not typed by
// HR — mirrors offboardingController.ts's SEPARATION_REASON_LABELS/separationReasonLabel exactly.
const SEPARATION_REASON_LABELS: Record<string, string> = {
    EMPLOYEE_RESIGNATION: 'Resignation',
    DISCIPLINARY_TERMINATION: 'Termination',
    TERMINATION: 'Termination',
    CONTRACT_NON_RENEWAL_EMPLOYEE: 'Contract Non-Renewal (by Employee)',
    CONTRACT_NON_RENEWAL_COMPANY: 'Contract Non-Renewal (by Company)',
};
const separationReasonLabel = (c: OffboardingCase): string => SEPARATION_REASON_LABELS[c.source] || c.source;

const STAGE_ORDER: OffboardingStage[] = ['RESIGNATION_REQUEST', 'CLEARANCE', 'SEPARATION_LETTER'];

const STAGE_COMPLETED_AT_FIELD: Record<OffboardingStage, keyof OffboardingCase> = {
    RESIGNATION_REQUEST: 'resignationCompletedAt',
    CLEARANCE: 'clearanceCompletedAt',
    SEPARATION_LETTER: 'separationCompletedAt',
    CLOSED: 'closedAt',
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <span className="block font-black uppercase text-[9px] text-slate-400">{label}</span>
        <div>{value}</div>
    </div>
);

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

const OffboardingCaseDetailPage: React.FC = () => {
    const { caseId } = useParams<{ caseId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const canManage = canAccess(currentUser, [], ['manage_offboarding']);

    const { data: c, isLoading, error } = useQuery({
        queryKey: ['offboarding-case', caseId],
        queryFn: () => offboardingService.get(caseId!),
        enabled: !!caseId,
    });

    const [busy, setBusy] = useState(false);
    const [signedFile, setSignedFile] = useState<File | null>(null);

    // Draft-only fields with no canonical data source elsewhere — typed at generation time, not
    // persisted on the case itself (mirrors how disciplinary's Incident Report handles preparedBy).
    const [reason, setReason] = useState('');
    const [dateOfSeparation, setDateOfSeparation] = useState('');
    const [reportsTo, setReportsTo] = useState('');
    const [headOfDivision, setHeadOfDivision] = useState('');
    const [finalWorkingDate, setFinalWorkingDate] = useState('');
    // The employee only ever types one language for these two — HR provides the missing language's
    // version here before generating the printed (bilingual) form. Persisted on the case once
    // generated, so pre-filled from whatever was saved last time.
    const [resignationReasonAr, setResignationReasonAr] = useState('');
    const [resignationLetterTextAr, setResignationLetterTextAr] = useState('');

    useEffect(() => {
        if (!c) return;
        setReason(c.reason || c.resignationReason || '');
        setDateOfSeparation(toDateInput(c.dateOfSeparation || c.resignationEffectiveDate));
        setFinalWorkingDate(toDateInput(c.finalWorkingDate));
        setResignationReasonAr(c.resignationReasonAr || '');
        setResignationLetterTextAr(c.resignationLetterTextAr || '');
    }, [c]);

    // Mandatory for every case except a disciplinary termination.
    const exitInterviewRequired = c ? !['DISCIPLINARY_TERMINATION', 'TERMINATION'].includes(c.source) : false;
    const exitInterviewSatisfied = !exitInterviewRequired || !!c?.exitInterviewSubmittedAt;

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['offboarding-case', caseId] });
        queryClient.invalidateQueries({ queryKey: ['offboarding-cases'] });
    };

    const handleGenerateForm = async (stage: OffboardingStage) => {
        if (!c) return;
        setBusy(true);
        try {
            const draft = stage === 'RESIGNATION_REQUEST'
                ? { resignationReason: reason, resignationEffectiveDate: dateOfSeparation, headOfDivision, finalWorkingDate, resignationReasonAr, resignationLetterTextAr }
                : { reason, dateOfSeparation, reportsTo };
            const blob = await offboardingService.generateForm(c.id, stage, draft);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${stage}_${c.caseNumber}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('form_generated_collect_the_required_signature_s_then', { defaultValue: 'Form generated. Collect the required signature(s), then upload the signed copy below.' }));
        } catch (err: any) {
            toast.error(t('failed_to_generate_the_form', { defaultValue: 'Failed to generate the form.' }));
        } finally {
            setBusy(false);
        }
    };

    const handleIssueCertificate = async () => {
        if (!c) return;
        setBusy(true);
        try {
            const blob = await offboardingService.issueCertificate(c.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Certificate_of_Employment_${c.caseNumber}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('certificate_of_employment_issued', { defaultValue: 'Certificate of Employment issued.' }));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_issue_the_certificate', { defaultValue: 'Failed to issue the certificate.' }));
        } finally {
            setBusy(false);
        }
    };

    const uploadFile = async (file: File | null): Promise<{ documentUrl: string; documentName: string } | null> => {
        if (!file) { toast.error(t('attach_a_document_before_continuing', { defaultValue: 'Attach a document before continuing.' })); return null; }
        const { url, name } = await employeeService.uploadDocument(file);
        return { documentUrl: url, documentName: name };
    };

    const run = async (fn: () => Promise<OffboardingCase>) => {
        setBusy(true);
        try {
            await fn();
            setSignedFile(null);
            toast.success(t('case_updated', { defaultValue: 'Case updated.' }));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('action_failed', { defaultValue: 'Action failed.' }));
        } finally {
            setBusy(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-400 text-sm">{t('loading_case', { defaultValue: 'Loading case…' })}</div>;
    }
    if (error || !c) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-red-500" />
                <h2 className="text-lg font-bold text-slate-800">{t('case_not_found', { defaultValue: 'Case not found.' })}</h2>
                <button onClick={() => navigate('/personnel-relations/offboarding')} className="text-red-700 font-bold hover:underline text-sm">
                    {t('back_to_offboarding_cases', { defaultValue: 'Back to Offboarding Cases' })}
                </button>
            </div>
        );
    }

    const renderStageSummary = (stage: OffboardingStage) => {
        let body: React.ReactNode = null;
        if (stage === 'RESIGNATION_REQUEST') {
            body = <>
                <Row label={t('reason', { defaultValue: 'Reason' })} value={c.resignationReason || '—'} />
                <Row label={t('resignation_letter', { defaultValue: 'Resignation Letter' })} value={c.resignationLetterText ? <span className="whitespace-pre-wrap">{c.resignationLetterText}</span> : '—'} />
                {!!c.resignationAttachmentUrls?.length && (
                    <Row label={t('attachments', { defaultValue: 'Attachments' })} value={
                        <ul className="space-y-0.5">
                            {c.resignationAttachmentUrls.map((url, i) => (
                                <li key={url}><a href={`${SERVER_URL}${url}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.resignationAttachmentNames?.[i] || t('attachment_n', { defaultValue: 'Attachment {{n}}', n: i + 1 })}</a></li>
                            ))}
                        </ul>
                    } />
                )}
                <Row label={t('effective_date', { defaultValue: 'Effective Date' })} value={c.resignationEffectiveDate ? format(new Date(c.resignationEffectiveDate), 'dd MMM yyyy') : '—'} />
                <Row label={t('final_working_date', { defaultValue: 'Final Working Date' })} value={c.finalWorkingDate ? format(new Date(c.finalWorkingDate), 'dd MMM yyyy') : '—'} />
                <Row label={t('signed_document', { defaultValue: 'Signed document' })} value={c.resignationDocumentUrl ? (
                    <a href={`${SERVER_URL}${c.resignationDocumentUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.resignationDocumentName || t('signed_document', { defaultValue: 'Signed document' })}</a>
                ) : <span className="text-slate-400">{t('no_document_uploaded', { defaultValue: 'No document uploaded' })}</span>} />
            </>;
        } else if (stage === 'CLEARANCE') {
            body = <>
                <Row label={t('date_of_separation', { defaultValue: 'Date of Separation' })} value={c.dateOfSeparation ? format(new Date(c.dateOfSeparation), 'dd MMM yyyy') : '—'} />
                <Row label={t('signed_document', { defaultValue: 'Signed document' })} value={c.clearanceDocumentUrl ? (
                    <a href={`${SERVER_URL}${c.clearanceDocumentUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.clearanceDocumentName || t('signed_document', { defaultValue: 'Signed document' })}</a>
                ) : <span className="text-slate-400">{t('no_document_uploaded', { defaultValue: 'No document uploaded' })}</span>} />
            </>;
        } else if (stage === 'SEPARATION_LETTER') {
            body = <>
                <Row label={t('signed_document', { defaultValue: 'Signed document' })} value={c.separationDocumentUrl ? (
                    <a href={`${SERVER_URL}${c.separationDocumentUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.separationDocumentName || t('signed_document', { defaultValue: 'Signed document' })}</a>
                ) : <span className="text-slate-400">{t('no_document_uploaded', { defaultValue: 'No document uploaded' })}</span>} />
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
                    onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/personnel-relations/offboarding'))}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black text-[#511d29]">{c.caseNumber} — {c.employee?.fullName || ''}</h1>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                        {c.stage === 'CLOSED' ? (c.employee?.enrollmentStatus === 'SEPARATED' ? t('closed_separated', { defaultValue: 'Closed — Separated' }) : t('closed_pending_separation_date', { defaultValue: 'Closed — Pending Separation Date' })) : STAGE_LABELS[c.stage]}
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/personnel-relations/lifecycle?employeeId=${c.employeeId}`)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                >
                    <UserSquare2 size={14} /> {t('view_employee_file', { defaultValue: 'View Employee File' })}
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-600">
                    <div><span className="font-black uppercase text-[10px] text-red-700">{t('type', { defaultValue: 'Type' })}</span><div>{c.type === 'VOLUNTARY' ? t('voluntary', { defaultValue: 'Voluntary' }) : t('involuntary', { defaultValue: 'Involuntary' })}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">{t('source', { defaultValue: 'Source' })}</span><div>{SOURCE_LABELS[c.source] || c.source}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">{t('filed', { defaultValue: 'Filed' })}</span><div>{format(new Date(c.createdAt), 'dd MMM yyyy')}</div></div>
                    <div>
                        <span className="font-black uppercase text-[10px] text-red-700">{t('exit_interview', { defaultValue: 'Exit Interview' })}</span>
                        <div>
                            {c.exitInterviewSubmittedAt ? t('submitted', { defaultValue: 'Submitted' }) : exitInterviewRequired ? (
                                <span className="text-amber-600 font-bold">{t('pending_required', { defaultValue: 'Pending — required' })}</span>
                            ) : t('not_required_termination', { defaultValue: 'Not required (Termination)' })}
                        </div>
                    </div>
                </div>

                {c.linkedDisciplinaryCaseId && (
                    <button
                        onClick={() => navigate(`/personnel-relations/disciplinary/${c.linkedDisciplinaryCaseId}`)}
                        className="text-[#511d29] hover:underline text-[11px] font-bold"
                    >
                        {t('view_linked_disciplinary_case', { defaultValue: 'View linked disciplinary case →' })}
                    </button>
                )}

                {c.stage === 'CLOSED' && (
                    <div className="border-t border-slate-100 pt-4 text-center">
                        {c.employee?.enrollmentStatus === 'SEPARATED' ? (
                            <p className="text-emerald-600 font-bold">Case closed{c.closedAt ? ` on ${format(new Date(c.closedAt), 'dd MMM yyyy')}` : ''}. Employee separated.</p>
                        ) : (
                            <p className="text-amber-600 font-bold">
                                Paperwork complete — the employee keeps normal access until their separation date
                                {c.dateOfSeparation ? ` (${format(new Date(c.dateOfSeparation), 'dd MMM yyyy')})` : ''}, when the system separates them automatically.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {completedStages.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{t('case_history', { defaultValue: 'Case History' })}</span>
                    {completedStages.map(renderStageSummary)}
                </div>
            )}

            {canManage && c.exitInterviewSubmittedAt && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{t('exit_interview', { defaultValue: 'Exit Interview' })}</span>
                    <div className="grid grid-cols-2 gap-3">
                        <Row label={t('reason_for_leaving', { defaultValue: 'Reason for Leaving' })} value={
                            (REASON_FOR_LEAVING_OPTIONS.find(o => o.value === c.exitInterviewReasonCategory)?.label || c.exitInterviewReasonCategory || '—')
                            + (c.exitInterviewReasonCategory === 'OTHERS' && c.exitInterviewReasonOther ? ` — ${c.exitInterviewReasonOther}` : '')
                        } />
                        <Row label={t('interested_in_re_employment', { defaultValue: 'Interested in Re-employment' })} value={c.exitInterviewInterestedInReemployment === null || c.exitInterviewInterestedInReemployment === undefined ? '—' : c.exitInterviewInterestedInReemployment ? t('yes', { defaultValue: 'Yes' }) : t('no', { defaultValue: 'No' })} />
                        <Row label={t('would_recommend_iph', { defaultValue: 'Would Recommend IPH' })} value={c.exitInterviewWouldRecommend === null || c.exitInterviewWouldRecommend === undefined ? '—' : c.exitInterviewWouldRecommend ? t('yes', { defaultValue: 'Yes' }) : t('no', { defaultValue: 'No' })} />
                        {(c.exitInterviewContactEmail || c.exitInterviewContactNumber) && (
                            <Row label={t('contact', { defaultValue: 'Contact' })} value={[c.exitInterviewContactEmail, c.exitInterviewContactNumber].filter(Boolean).join(' · ')} />
                        )}
                    </div>
                    <details className="border border-slate-200 rounded-lg p-3">
                        <summary className="cursor-pointer font-black uppercase text-[10px] text-slate-500">{t('ratings', { defaultValue: 'Ratings' })}</summary>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {RATING_CATEGORIES.map(cat => (
                                <Row key={cat.key} label={cat.label} value={(c as any)[`exitInterviewRating${cat.key.charAt(0).toUpperCase()}${cat.key.slice(1)}`] || '—'} />
                            ))}
                        </div>
                    </details>
                    <Row label={t('appreciated_most', { defaultValue: 'Appreciated Most' })} value={c.exitInterviewAppreciatedMost || '—'} />
                    <Row label={t('liked_least', { defaultValue: 'Liked Least' })} value={c.exitInterviewLikedLeast || '—'} />
                    <Row label={t('improvement_suggestions', { defaultValue: 'Improvement Suggestions' })} value={c.exitInterviewImprovementSuggestions || '—'} />
                </div>
            )}

            {canManage && c.clearanceCompletedAt && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{t('certificate_of_employment', { defaultValue: 'Certificate of Employment' })}</span>
                    <p className="text-slate-500">{t('available_on_request_any_time_after_clearance_completes', { defaultValue: 'Available on request, any time after clearance completes.' })}</p>
                    <button
                        disabled={busy}
                        onClick={handleIssueCertificate}
                        className="w-full py-2 bg-slate-700 text-white font-black uppercase text-[10px] rounded flex items-center justify-center gap-2"
                    >
                        <FileBadge size={14} /> {t('issue_certificate_of_employment', { defaultValue: 'Issue Certificate of Employment' })}
                    </button>
                </div>
            )}

            {canManage && c.stage !== 'CLOSED' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{STAGE_LABELS[c.stage]}</span>

                    {c.stage === 'RESIGNATION_REQUEST' && (
                        <div className="space-y-2">
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('reason_for_resignation', { defaultValue: 'Reason for resignation' })}</label>
                            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('reason_arabic_translation_printed_form_is_bilingual_the', { defaultValue: 'Reason — Arabic translation (printed form is bilingual; the employee only typed one language)' })}</label>
                            <textarea rows={2} dir="rtl" value={resignationReasonAr} onChange={e => setResignationReasonAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />

                            {c.resignationLetterText && (
                                <>
                                    <label className="block font-black uppercase text-[10px] text-red-700">{t('resignation_letter_as_written_by_the_employee', { defaultValue: 'Resignation letter (as written by the employee)' })}</label>
                                    <p className="w-full p-2 bg-slate-50 border border-slate-200 rounded whitespace-pre-wrap text-slate-600">{c.resignationLetterText}</p>
                                </>
                            )}
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('resignation_letter_arabic_translation', { defaultValue: 'Resignation letter — Arabic translation' })}</label>
                            <textarea rows={4} dir="rtl" value={resignationLetterTextAr} onChange={e => setResignationLetterTextAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />

                            <label className="block font-black uppercase text-[10px] text-red-700">{t('effective_date', { defaultValue: 'Effective date' })}</label>
                            <input type="date" value={dateOfSeparation} onChange={e => setDateOfSeparation(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('head_of_division_auto_detected_from_the_org', { defaultValue: 'Head of Division (auto-detected from the org chart — override only if wrong)' })}</label>
                            <input value={headOfDivision} onChange={e => setHeadOfDivision(e.target.value)} placeholder={t('leave_blank_to_auto_detect', { defaultValue: 'Leave blank to auto-detect' })} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                    )}
                    {c.stage === 'CLEARANCE' && (
                        <div className="space-y-2">
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('reason_for_registration', { defaultValue: 'Reason for Registration' })}</label>
                            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('date_of_separation', { defaultValue: 'Date of separation' })}</label>
                            <input type="date" value={dateOfSeparation} onChange={e => setDateOfSeparation(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('reports_to_printed_on_form', { defaultValue: 'Reports to (printed on form)' })}</label>
                            <input value={reportsTo} onChange={e => setReportsTo(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                    )}
                    {c.stage === 'SEPARATION_LETTER' && (
                        <div className="space-y-2">
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('date_of_separation', { defaultValue: 'Date of separation' })}</label>
                            <input type="date" value={dateOfSeparation} onChange={e => setDateOfSeparation(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('reports_to_printed_on_form', { defaultValue: 'Reports to (printed on form)' })}</label>
                            <input value={reportsTo} onChange={e => setReportsTo(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            <p className="text-slate-500">
                                {t('printed_reason', { defaultValue: 'Printed "Reason:" —' })} <span className="font-bold text-slate-700">{separationReasonLabel(c)}</span> {t('derived_from_how_this_case_was_opened_not', { defaultValue: '(derived from how this case was opened, not editable here)' })}
                            </p>
                        </div>
                    )}

                    <button disabled={busy} onClick={() => handleGenerateForm(c.stage)} className="w-full py-2 bg-slate-700 text-white font-black uppercase text-[10px] rounded">
                        {t('generate', { defaultValue: 'Generate' })} {STAGE_LABELS[c.stage]} {t('form', { defaultValue: 'Form' })}
                    </button>

                    {c.stage === 'RESIGNATION_REQUEST' && (
                        <div>
                            <label className="block font-black uppercase text-[10px] text-red-700 mb-1">{t('final_working_date', { defaultValue: 'Final working date' })}</label>
                            <input type="date" value={finalWorkingDate} onChange={e => setFinalWorkingDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                    )}

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-red-700 mb-1">
                            <Paperclip size={12} /> {t('upload_signed_copy', { defaultValue: 'Upload signed copy' })}
                        </label>
                        <input type="file" onChange={e => setSignedFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                    </div>

                    {c.stage === 'RESIGNATION_REQUEST' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return offboardingService.completeResignationRequest(c.id, { ...doc, finalWorkingDate });
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            {t('complete_move_to_clearance', { defaultValue: 'Complete & Move to Clearance' })}
                        </button>
                    )}
                    {c.stage === 'CLEARANCE' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return offboardingService.completeClearance(c.id, doc);
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            {t('complete_move_to_separation_letter', { defaultValue: 'Complete & Move to Separation Letter' })}
                        </button>
                    )}
                    {c.stage === 'SEPARATION_LETTER' && (
                        <>
                            {!exitInterviewSatisfied && (
                                <p className="text-amber-600 text-[11px] font-bold text-center">
                                    {t('the_employee_must_submit_their_exit_interview_before', { defaultValue: 'The employee must submit their Exit Interview before this case can be closed.' })}
                                </p>
                            )}
                            <button
                                disabled={busy || !exitInterviewSatisfied}
                                onClick={() => run(async () => {
                                    const doc = await uploadFile(signedFile);
                                    if (!doc) throw new Error('no-file');
                                    return offboardingService.completeSeparationLetter(c.id, doc);
                                })}
                                className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('complete_close_case', { defaultValue: 'Complete & Close Case' })}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default OffboardingCaseDetailPage;
