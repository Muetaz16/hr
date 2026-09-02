import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, AlertCircle, UserSquare2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { employeeService } from '../../services/employeeService';
import {
    disciplinaryService, type DisciplinaryCase, type DisciplinaryActionType,
    type DisciplinaryStage, type DisciplinaryOutcome,
} from '../../services/disciplinaryService';
import { DISCIPLINARY_CATEGORY_LABELS, DISCIPLINARY_ACTION_LABELS, DISCIPLINARY_VIOLATIONS, VIOLATIONS_BY_ID, type DisciplinaryCategory } from '../../constants/disciplinaryViolations';
import { SERVER_URL } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';

const STAGE_LABELS: Record<DisciplinaryStage, string> = {
    INCIDENT_REPORT: 'Incident Report',
    NOTICE_TO_EXPLAIN: 'Notice to Explain',
    INVESTIGATION_RESULT: 'Investigation Result',
    DISCIPLINARY_ACTION: 'Disciplinary Action',
    CLOSED: 'Closed',
};

const STAGE_ORDER: DisciplinaryStage[] = ['INCIDENT_REPORT', 'NOTICE_TO_EXPLAIN', 'INVESTIGATION_RESULT', 'DISCIPLINARY_ACTION'];

const STAGE_COMPLETED_AT_FIELD: Record<Exclude<DisciplinaryStage, 'CLOSED'>, keyof DisciplinaryCase> = {
    INCIDENT_REPORT: 'incidentReportCompletedAt',
    NOTICE_TO_EXPLAIN: 'noticeToExplainCompletedAt',
    INVESTIGATION_RESULT: 'investigationCompletedAt',
    DISCIPLINARY_ACTION: 'actionCompletedAt',
};

const Row: React.FC<{ label: string; value: React.ReactNode; rtl?: boolean }> = ({ label, value, rtl }) => (
    <div>
        <span className="block font-black uppercase text-[9px] text-slate-400">{label}</span>
        <div dir={rtl ? 'rtl' : undefined}>{value}</div>
    </div>
);

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

const DisciplinaryCaseDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const { caseId } = useParams<{ caseId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_disciplinary']);
    const canEditReportOverride = canAccess(currentUser, [], ['edit_disciplinary_report']);

    const { data: c, isLoading, error } = useQuery({
        queryKey: ['disciplinary-case', caseId],
        queryFn: () => disciplinaryService.get(caseId!),
        enabled: !!caseId,
    });

    const [busy, setBusy] = useState(false);

    // Editable descriptive/translation fields — available regardless of stage.
    const [editing, setEditing] = useState(false);
    const [reportedDate, setReportedDate] = useState('');
    const [incidentDate, setIncidentDate] = useState('');
    const [reportedByName, setReportedByName] = useState('');
    const [reportedByEmail, setReportedByEmail] = useState('');
    const [preparedByName, setPreparedByName] = useState('');
    const [preparedByNameAr, setPreparedByNameAr] = useState('');
    const [subjectPositionTitle, setSubjectPositionTitle] = useState('');
    const [subjectPositionTitleAr, setSubjectPositionTitleAr] = useState('');
    const [subjectDepartment, setSubjectDepartment] = useState('');
    const [subjectDepartmentAr, setSubjectDepartmentAr] = useState('');
    const [incidentPlace, setIncidentPlace] = useState('');
    const [incidentPlaceAr, setIncidentPlaceAr] = useState('');
    const [incidentDescription, setIncidentDescription] = useState('');
    const [incidentDescriptionAr, setIncidentDescriptionAr] = useState('');

    // Stage-specific draft inputs (not persisted until the matching complete-* call).
    const [signedFile, setSignedFile] = useState<File | null>(null);
    const [noticeToExplainDescription, setNoticeToExplainDescription] = useState('');
    const [noticeToExplainDescriptionAr, setNoticeToExplainDescriptionAr] = useState('');
    const [confirmedViolationId, setConfirmedViolationId] = useState('');
    const [violationSearchQuery, setViolationSearchQuery] = useState('');
    const [showViolationSuggestions, setShowViolationSuggestions] = useState(false);
    const [investigationResult, setInvestigationResult] = useState('');
    const [investigationResultAr, setInvestigationResultAr] = useState('');
    const [investigationRecommendation, setInvestigationRecommendation] = useState('');
    const [investigationRecommendationAr, setInvestigationRecommendationAr] = useState('');
    const [investigationActionTaken, setInvestigationActionTaken] = useState('');
    const [investigationActionTakenAr, setInvestigationActionTakenAr] = useState('');
    const [actionType, setActionType] = useState<DisciplinaryActionType>('WRITTEN_WARNING');
    const [actionEffectiveDate, setActionEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [actionAdditionalInfo, setActionAdditionalInfo] = useState('');

    // Dismiss-at-intake draft inputs.
    const [dismissFile, setDismissFile] = useState<File | null>(null);
    const [closureReason, setClosureReason] = useState('');

    useEffect(() => {
        if (!c) return;
        setReportedDate(toDateInput(c.reportedDate));
        setIncidentDate(toDateInput(c.incidentDate));
        setReportedByName(c.reportedByName || '');
        setReportedByEmail(c.reportedByEmail || '');
        setPreparedByName(c.preparedByName || '');
        setPreparedByNameAr(c.preparedByNameAr || '');
        setSubjectPositionTitle(c.subjectPositionTitle || '');
        setSubjectPositionTitleAr(c.subjectPositionTitleAr || '');
        setSubjectDepartment(c.subjectDepartment || '');
        setSubjectDepartmentAr(c.subjectDepartmentAr || '');
        setIncidentPlace(c.incidentPlace || '');
        setIncidentPlaceAr(c.incidentPlaceAr || '');
        setIncidentDescription(c.incidentDescription || '');
        setIncidentDescriptionAr(c.incidentDescriptionAr || '');
        setNoticeToExplainDescription(c.noticeToExplainDescription || c.incidentDescription || '');
        setNoticeToExplainDescriptionAr(c.noticeToExplainDescriptionAr || c.incidentDescriptionAr || '');
        const initialViolationId = c.violationId || DISCIPLINARY_VIOLATIONS[0]?.id || '';
        setConfirmedViolationId(initialViolationId);
        setViolationSearchQuery(VIOLATIONS_BY_ID[initialViolationId]?.description || '');
        setInvestigationResult(c.investigationResult || '');
        setInvestigationResultAr(c.investigationResultAr || '');
        setInvestigationRecommendation(c.investigationRecommendation || '');
        setInvestigationRecommendationAr(c.investigationRecommendationAr || '');
        setInvestigationActionTaken(c.investigationActionTaken || '');
        setInvestigationActionTakenAr(c.investigationActionTakenAr || '');
        setActionType(c.actionType || 'WRITTEN_WARNING');
        setActionAdditionalInfo(c.actionAdditionalInfo || '');
    }, [c]);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['disciplinary-case', caseId] });
        queryClient.invalidateQueries({ queryKey: ['disciplinary-cases'] });
    };

    const handleSaveDetails = async () => {
        if (!c) return;
        setBusy(true);
        try {
            await disciplinaryService.updateDetails(c.id, {
                reportedDate, incidentDate, reportedByName, reportedByEmail, preparedByName, preparedByNameAr,
                subjectPositionTitle, subjectPositionTitleAr, subjectDepartment, subjectDepartmentAr,
                incidentPlace, incidentPlaceAr, incidentDescription, incidentDescriptionAr,
            });
            toast.success(t('details_saved', { defaultValue: 'Details saved.' }));
            setEditing(false);
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_save_details', { defaultValue: 'Failed to save details.' }));
        } finally {
            setBusy(false);
        }
    };

    // Persists a stage's own draft fields on demand — independent of Report Details' save and of
    // the stage's complete-* action, so HR can save progress without generating/uploading anything.
    const saveStageDraft = async (data: Record<string, any>) => {
        if (!c) return;
        setBusy(true);
        try {
            await disciplinaryService.updateDetails(c.id, data);
            toast.success(t('draft_saved', { defaultValue: 'Draft saved.' }));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_save_draft', { defaultValue: 'Failed to save draft.' }));
        } finally {
            setBusy(false);
        }
    };

    const selectViolation = (violationId: string) => {
        setConfirmedViolationId(violationId);
        setViolationSearchQuery(VIOLATIONS_BY_ID[violationId]?.description || '');
        setShowViolationSuggestions(false);
    };

    const clearViolation = () => {
        setConfirmedViolationId('');
        setViolationSearchQuery('');
        setShowViolationSuggestions(false);
    };

    const confirmedViolationLadder = VIOLATIONS_BY_ID[confirmedViolationId]?.ladder || [];
    const OFFENSE_ORDINALS = ['1st', '2nd', '3rd', '4th'];
    // Code of Conduct violation status is never picked independently — it's the confirmed
    // violation's own category, or "No Violation" once the confirmed violation is cleared.
    const investigationOutcome: DisciplinaryOutcome = confirmedViolationId
        ? ((VIOLATIONS_BY_ID[confirmedViolationId]?.category as DisciplinaryOutcome) || 'MINOR')
        : 'NON_VIOLATION';

    const handleGenerateForm = async (stage: DisciplinaryStage) => {
        if (!c) return;
        setBusy(true);
        try {
            const draft = stage === 'INCIDENT_REPORT'
                ? { preparedByName, preparedByNameAr }
                : stage === 'NOTICE_TO_EXPLAIN'
                ? { noticeToExplainDescription, noticeToExplainDescriptionAr }
                : stage === 'INVESTIGATION_RESULT'
                ? {
                    confirmedViolationId, investigationOutcome,
                    investigationResult, investigationResultAr,
                    investigationRecommendation, investigationRecommendationAr,
                    investigationActionTaken, investigationActionTakenAr,
                  }
                : stage === 'DISCIPLINARY_ACTION'
                ? { actionType, actionEffectiveDate, actionAdditionalInfo }
                : {};
            const blob = await disciplinaryService.generateForm(c.id, stage, draft);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${stage}_${c.caseNumber}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('form_generated_collect_signatures_upload', { defaultValue: 'Form generated. Collect the required signature(s), then upload the signed copy below.' }));
        } catch (err: any) {
            toast.error(t('failed_to_generate_the_form', { defaultValue: 'Failed to generate the form.' }));
        } finally {
            setBusy(false);
        }
    };

    const uploadFile = async (file: File | null): Promise<{ documentUrl: string; documentName: string } | null> => {
        if (!file) { toast.error(t('attach_a_document_before_continuing', { defaultValue: 'Attach a document before continuing.' })); return null; }
        const { url, name } = await employeeService.uploadDocument(file);
        return { documentUrl: url, documentName: name };
    };

    const run = async (fn: () => Promise<DisciplinaryCase & { biotimeSuspensionSynced?: boolean; offboardingCase?: { id: string; caseNumber: string } | null }>) => {
        setBusy(true);
        try {
            const result = await fn();
            setSignedFile(null);
            setDismissFile(null);
            setClosureReason('');
            toast.success(t('case_updated', { defaultValue: 'Case updated.' }));
            if (result.biotimeSuspensionSynced === false) {
                toast.error(t('case_closed_suspension_sync_failed_add_manually', { defaultValue: 'The case closed, but syncing the suspension to the attendance system failed — add it there manually.' }));
            }
            if (result.offboardingCase) {
                toast.success(t('offboarding_case_opened_at_clearance', { caseNumber: result.offboardingCase.caseNumber, defaultValue: 'Offboarding case {{caseNumber}} opened at Clearance.' }), {
                    action: { label: t('view', { defaultValue: 'View' }), onClick: () => navigate(`/personnel-relations/offboarding/${result.offboardingCase!.id}`) },
                });
            }
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
                <button onClick={() => navigate('/personnel-relations/disciplinary')} className="text-red-700 font-bold hover:underline text-sm">
                    {t('back_to_disciplinary_cases', { defaultValue: 'Back to Disciplinary Cases' })}
                </button>
            </div>
        );
    }

    // Read-only recap of a completed stage's own data + uploaded document — always sourced from the
    // persisted case `c`, never from the editable local state, since state like `actionType` is
    // reused across stages (Investigation Result's suggested action and Disciplinary Action's own
    // selector share it) and would otherwise show whatever the currently-active form has typed in.
    const renderStageSummary = (stage: DisciplinaryStage) => {
        const doc = (urlField: keyof DisciplinaryCase, nameField: keyof DisciplinaryCase) =>
            c[urlField] ? (
                <a href={`${SERVER_URL}${c[urlField]}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {(c[nameField] as string) || t('signed_document', { defaultValue: 'Signed document' })}
                </a>
            ) : <span className="text-slate-400">{t('no_document_uploaded', { defaultValue: 'No document uploaded' })}</span>;

        let body: React.ReactNode = null;
        if (stage === 'INCIDENT_REPORT') {
            body = <>
                <Row label={t('prepared_by_en_ar', { defaultValue: 'Prepared By (EN / AR)' })} value={`${c.preparedByName || '—'} / ${c.preparedByNameAr || '—'}`} />
                <Row label={t('signed_document', { defaultValue: 'Signed document' })} value={doc('incidentReportDocumentUrl', 'incidentReportDocumentName')} />
            </>;
        } else if (stage === 'NOTICE_TO_EXPLAIN') {
            body = <>
                <Row label={t('formal_rewrite_en', { defaultValue: 'Formal Rewrite (EN)' })} value={c.noticeToExplainDescription || '—'} />
                <Row label={t('formal_rewrite_ar', { defaultValue: 'Formal Rewrite (AR)' })} value={c.noticeToExplainDescriptionAr || '—'} rtl />
                <Row label={t('signed_document', { defaultValue: 'Signed document' })} value={doc('noticeToExplainDocumentUrl', 'noticeToExplainDocumentName')} />
            </>;
        } else if (stage === 'INVESTIGATION_RESULT') {
            body = <>
                <Row label={t('confirmed_violation', { defaultValue: 'Confirmed Violation' })} value={c.violationId ? (VIOLATIONS_BY_ID[c.violationId]?.description || c.violationId) : t('no_violation', { defaultValue: 'No Violation' })} />
                <Row label={t('code_of_conduct_status', { defaultValue: 'Code of Conduct Status' })} value={c.investigationOutcome || '—'} />
                <Row label={t('result_of_investigation_en', { defaultValue: 'Result of Investigation (EN)' })} value={c.investigationResult || '—'} />
                <Row label={t('result_of_investigation_ar', { defaultValue: 'Result of Investigation (AR)' })} value={c.investigationResultAr || '—'} rtl />
                <Row label={t('recommendation_en', { defaultValue: 'Recommendation (EN)' })} value={c.investigationRecommendation || '—'} />
                <Row label={t('recommendation_ar', { defaultValue: 'Recommendation (AR)' })} value={c.investigationRecommendationAr || '—'} rtl />
                <Row label={t('action_taken_en', { defaultValue: 'Action Taken (EN)' })} value={c.investigationActionTaken || '—'} />
                <Row label={t('action_taken_ar', { defaultValue: 'Action Taken (AR)' })} value={c.investigationActionTakenAr || '—'} rtl />
                <Row label={t('signed_document', { defaultValue: 'Signed document' })} value={doc('investigationDocumentUrl', 'investigationDocumentName')} />
            </>;
        } else if (stage === 'DISCIPLINARY_ACTION') {
            body = <>
                <Row label={t('action_type', { defaultValue: 'Action Type' })} value={c.actionType ? DISCIPLINARY_ACTION_LABELS[c.actionType] : '—'} />
                <Row label={t('effective_start_date', { defaultValue: 'Effective Start Date' })} value={c.actionEffectiveDate ? format(new Date(c.actionEffectiveDate), 'dd MMM yyyy') : '—'} />
                <Row label={t('additional_info', { defaultValue: 'Additional Info' })} value={c.actionAdditionalInfo || '—'} />
                <Row label={t('signed_document', { defaultValue: 'Signed document' })} value={doc('actionDocumentUrl', 'actionDocumentName')} />
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
    // The original report's own fields are only editable while still at Incident Report — editing
    // them after the case has moved on requires the dedicated override permission (enforced again
    // server-side in updateCaseDetails; this just keeps the "Edit" button from appearing when it
    // would only get a 403).
    const canEditReportDetails = c.stage === 'INCIDENT_REPORT' || canEditReportOverride;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/personnel-relations/disciplinary'))}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black text-[#511d29]">{c.caseNumber} — {c.employee?.fullName || ''}</h1>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                        {c.stage === 'CLOSED' ? (c.closureReason ? t('closed_dismissed', { defaultValue: 'Closed — Dismissed' }) : t('closed_resolved', { defaultValue: 'Closed — Resolved' })) : STAGE_LABELS[c.stage]}
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
                    <div><span className="font-black uppercase text-[10px] text-red-700">{t('category', { defaultValue: 'Category' })}</span><div>{c.category ? DISCIPLINARY_CATEGORY_LABELS[c.category as DisciplinaryCategory] : t('pending_investigation', { defaultValue: 'Pending Investigation' })}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">{t('offense_number', { defaultValue: 'Offense #' })}</span><div>{c.offenseNumber || '—'}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">{t('source', { defaultValue: 'Source' })}</span><div>{c.source === 'SYSTEM_ATTENDANCE' ? t('system_attendance', { defaultValue: 'System (Attendance)' }) : t('employee_report', { defaultValue: 'Employee Report' })}</div></div>
                    <div><span className="font-black uppercase text-[10px] text-red-700">{t('reported_by', { defaultValue: 'Reported by' })}</span><div>{c.source === 'SYSTEM_ATTENDANCE' ? '—' : (c.reportedByName || t('not_specified', { defaultValue: 'Not specified' }))}</div></div>
                </div>

                {!!c.evidence?.length && (
                    <div>
                        <span className="font-black uppercase text-[10px] text-red-700">{t('evidence', { defaultValue: 'Evidence' })}</span>
                        <ul className="mt-1 space-y-1">
                            {c.evidence.map(ev => (
                                <li key={ev.id}><a href={`${SERVER_URL}${ev.fileUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{ev.fileName || t('file', { defaultValue: 'File' })}</a></li>
                            ))}
                        </ul>
                    </div>
                )}

                {c.actionType && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded">
                        <span className="font-black uppercase text-[10px] text-red-700">{t('decided_action', { defaultValue: 'Decided Action' })}</span>
                        <div className="text-slate-700 font-bold">{DISCIPLINARY_ACTION_LABELS[c.actionType]}</div>
                    </div>
                )}

                {c.stage === 'CLOSED' && (
                    <div className="border-t border-slate-100 pt-4 text-center">
                        {c.closureReason ? (
                            <>
                                <p className="text-amber-600 font-bold">
                                    {t('dismissed_no_grounds_to_pursue', { defaultValue: 'Dismissed — No Grounds to Pursue' })}{c.closedAt ? ` (${format(new Date(c.closedAt), 'dd MMM yyyy')})` : ''}.
                                </p>
                                <p className="text-slate-500 mt-1">{t('reason', { defaultValue: 'Reason:' })} {c.closureReason}</p>
                            </>
                        ) : (
                            <p className="text-emerald-600 font-bold">
                                {t('resolved_case_closed', { defaultValue: 'Resolved — Case closed' })}{c.closedAt ? ` on ${format(new Date(c.closedAt), 'dd MMM yyyy')}` : ''}.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Editable report details — the reporter may have filed in only one language; HR can
               correct fields and add the missing translation here at any time. */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{t('report_details', { defaultValue: 'Report Details' })}</span>
                    {canManage && canEditReportDetails && !editing && (
                        <button onClick={() => setEditing(true)} className="text-[10px] font-black uppercase text-red-700 hover:underline">{t('edit', { defaultValue: 'Edit' })}</button>
                    )}
                    {canManage && !canEditReportDetails && (
                        <span className="text-[10px] font-bold text-slate-400">{t('locked_after_incident_report', { defaultValue: 'Locked after Incident Report' })}</span>
                    )}
                </div>

                {!editing ? (
                    <div className="grid grid-cols-2 gap-3 text-slate-600">
                        <div><span className="font-black uppercase text-[10px] text-slate-400">{t('date_reported', { defaultValue: 'Date Reported' })}</span><div>{reportedDate || '—'}</div></div>
                        <div><span className="font-black uppercase text-[10px] text-slate-400">{t('date_happened', { defaultValue: 'Date Happened' })}</span><div>{incidentDate || '—'}</div></div>
                        <div><span className="font-black uppercase text-[10px] text-slate-400">{t('position_en_ar', { defaultValue: 'Position (EN / AR)' })}</span><div>{subjectPositionTitle || '—'} / {subjectPositionTitleAr || '—'}</div></div>
                        <div><span className="font-black uppercase text-[10px] text-slate-400">{t('department_en_ar', { defaultValue: 'Department (EN / AR)' })}</span><div>{subjectDepartment || '—'} / {subjectDepartmentAr || '—'}</div></div>
                        <div className="col-span-2"><span className="font-black uppercase text-[10px] text-slate-400">{t('place_of_incident_en_ar', { defaultValue: 'Place of Incident (EN / AR)' })}</span><div>{incidentPlace || '—'} / {incidentPlaceAr || '—'}</div></div>
                        <div className="col-span-2"><span className="font-black uppercase text-[10px] text-slate-400">{t('description_en', { defaultValue: 'Description (EN)' })}</span><p className="mt-1">{incidentDescription || '—'}</p></div>
                        <div className="col-span-2"><span className="font-black uppercase text-[10px] text-slate-400">{t('description_ar', { defaultValue: 'Description (AR)' })}</span><p className="mt-1" dir="rtl">{incidentDescriptionAr || '—'}</p></div>
                        <div><span className="font-black uppercase text-[10px] text-slate-400">{t('reported_by_label', { defaultValue: 'Reported By' })}</span><div>{reportedByName || '—'}</div></div>
                        <div><span className="font-black uppercase text-[10px] text-slate-400">{t('contact_email', { defaultValue: 'Contact Email' })}</span><div>{reportedByEmail || '—'}</div></div>
                        <div><span className="font-black uppercase text-[10px] text-slate-400">{t('prepared_by_en_ar', { defaultValue: 'Prepared By (EN / AR)' })}</span><div>{preparedByName || '—'} / {preparedByNameAr || '—'}</div></div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('date_reported', { defaultValue: 'Date Reported' })}</label>
                                <input type="date" value={reportedDate} onChange={e => setReportedDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('date_happened', { defaultValue: 'Date Happened' })}</label>
                                <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('position_title_en', { defaultValue: 'Position Title (EN)' })}</label>
                                <input value={subjectPositionTitle} onChange={e => setSubjectPositionTitle(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('position_title_ar', { defaultValue: 'Position Title (AR)' })}</label>
                                <input dir="rtl" value={subjectPositionTitleAr} onChange={e => setSubjectPositionTitleAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('department_en', { defaultValue: 'Department (EN)' })}</label>
                                <input value={subjectDepartment} onChange={e => setSubjectDepartment(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('department_ar', { defaultValue: 'Department (AR)' })}</label>
                                <input dir="rtl" value={subjectDepartmentAr} onChange={e => setSubjectDepartmentAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('place_of_incident_en', { defaultValue: 'Place of Incident (EN)' })}</label>
                                <input value={incidentPlace} onChange={e => setIncidentPlace(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('place_of_incident_ar', { defaultValue: 'Place of Incident (AR)' })}</label>
                                <input dir="rtl" value={incidentPlaceAr} onChange={e => setIncidentPlaceAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('description_en', { defaultValue: 'Description (EN)' })}</label>
                                <textarea rows={3} value={incidentDescription} onChange={e => setIncidentDescription(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('description_ar', { defaultValue: 'Description (AR)' })}</label>
                                <textarea dir="rtl" rows={3} value={incidentDescriptionAr} onChange={e => setIncidentDescriptionAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('reported_by_label', { defaultValue: 'Reported By' })}</label>
                                <input value={reportedByName} onChange={e => setReportedByName(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('contact_email', { defaultValue: 'Contact Email' })}</label>
                                <input value={reportedByEmail} onChange={e => setReportedByEmail(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('prepared_by_en', { defaultValue: 'Prepared By (EN)' })}</label>
                                <input value={preparedByName} onChange={e => setPreparedByName(e.target.value)} placeholder={t('name_printed_on_prepared_by_line', { defaultValue: "Name printed on the 'Prepared by' line" })} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                            <div>
                                <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">{t('prepared_by_ar', { defaultValue: 'Prepared By (AR)' })}</label>
                                <input dir="rtl" value={preparedByNameAr} onChange={e => setPreparedByNameAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button disabled={busy} onClick={handleSaveDetails} className="px-4 py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded">{t('save_changes', { defaultValue: 'Save Changes' })}</button>
                            <button disabled={busy} onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-100 text-slate-600 font-black uppercase text-[10px] rounded">{t('cancel', { defaultValue: 'Cancel' })}</button>
                        </div>
                    </div>
                )}
            </div>

            {completedStages.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{t('case_history', { defaultValue: 'Case History' })}</span>
                    {completedStages.map(renderStageSummary)}
                </div>
            )}

            {canManage && c.stage === 'NOTICE_TO_EXPLAIN' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{t('formal_rewrite', { defaultValue: 'Formal Rewrite' })}</span>
                    <p className="text-[10px] text-slate-400">
                        {t('formal_rewrite_prefilled_help', { defaultValue: 'Pre-filled from the original complaint as a starting point — rewrite it in formal language for the printed notice, then generate the form. The original complaint text is kept as-is regardless.' })}
                    </p>
                    <label className="block font-black uppercase text-[10px] text-red-700">{t('incident_description_formal_rewrite_en', { defaultValue: 'Incident description — formal rewrite (EN)' })}</label>
                    <textarea rows={4} value={noticeToExplainDescription} onChange={e => setNoticeToExplainDescription(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder={t('rewrite_incident_description_formal_placeholder', { defaultValue: 'Rewrite the incident description in formal, academic language for the official notice…' })} />
                    <label className="block font-black uppercase text-[10px] text-red-700">{t('incident_description_formal_rewrite_ar', { defaultValue: 'Incident description — formal rewrite (AR)' })}</label>
                    <textarea dir="rtl" rows={4} value={noticeToExplainDescriptionAr} onChange={e => setNoticeToExplainDescriptionAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                    <div className="flex justify-center pt-1">
                        <button
                            disabled={busy}
                            onClick={() => saveStageDraft({ noticeToExplainDescription, noticeToExplainDescriptionAr })}
                            className="px-6 py-2 bg-slate-100 text-slate-700 font-black uppercase text-[10px] rounded"
                        >
                            {t('save', { defaultValue: 'Save' })}
                        </button>
                    </div>
                </div>
            )}

            {canManage && c.stage === 'INVESTIGATION_RESULT' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <span className="font-black uppercase text-[10px] text-red-700 tracking-wider">{t('investigation', { defaultValue: 'Investigation' })}</span>

                    <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('confirmed_violation_label', { defaultValue: 'Confirmed violation' })}</label>
                            {confirmedViolationId && (
                                <button type="button" onMouseDown={e => e.preventDefault()} onClick={clearViolation} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">
                                    ✕ {t('clear_no_violation', { defaultValue: 'Clear (No Violation)' })}
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            value={violationSearchQuery}
                            onChange={e => { setViolationSearchQuery(e.target.value); setShowViolationSuggestions(true); }}
                            onFocus={() => setShowViolationSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowViolationSuggestions(false), 150)}
                            placeholder={t('search_violations_by_name_or_code', { defaultValue: 'Search violations by name or code…' })}
                            className="w-full p-2 border border-slate-200 rounded"
                            autoComplete="off"
                        />
                        {showViolationSuggestions && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-md max-h-64 overflow-auto">
                                {(['MINOR', 'SERIOUS', 'MAJOR'] as DisciplinaryCategory[]).map(cat => {
                                    const q = violationSearchQuery.trim().toLowerCase();
                                    const matches = DISCIPLINARY_VIOLATIONS.filter(v => v.category === cat && (
                                        !q || v.description.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)
                                    ));
                                    if (!matches.length) return null;
                                    return (
                                        <div key={cat}>
                                            <div className="px-3 py-1 text-[10px] font-black uppercase text-red-700 bg-red-50">{DISCIPLINARY_CATEGORY_LABELS[cat]}</div>
                                            {matches.map(v => (
                                                <button
                                                    key={v.id}
                                                    type="button"
                                                    onMouseDown={e => e.preventDefault()}
                                                    onClick={() => selectViolation(v.id)}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                                                >
                                                    {v.description}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <label className="block font-black uppercase text-[10px] text-red-700">{t('code_of_conduct_violation_status', { defaultValue: 'Code of Conduct violation status' })}</label>
                    <p className="text-[10px] text-slate-400 -mt-2 mb-1">{t('derived_from_confirmed_violation_not_editable', { defaultValue: 'Derived from the confirmed violation above — not editable directly.' })}</p>
                    <select value={investigationOutcome} disabled className="w-full p-2 border border-slate-200 rounded bg-slate-50 text-slate-500">
                        <option value="NON_VIOLATION">{t('non_violation_close_the_case', { defaultValue: 'Non Violation — close the case' })}</option>
                        <option value="MINOR">{t('minor_violation', { defaultValue: 'Minor Violation' })}</option>
                        <option value="SERIOUS">{t('serious_violation', { defaultValue: 'Serious Violation' })}</option>
                        <option value="MAJOR">{t('major_violation', { defaultValue: 'Major Violation' })}</option>
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                        <textarea rows={3} value={investigationResult} onChange={e => setInvestigationResult(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder={t('result_of_investigation_en_placeholder', { defaultValue: 'Result of Investigation (EN)…' })} />
                        <textarea dir="rtl" rows={3} value={investigationResultAr} onChange={e => setInvestigationResultAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder="نتيجة التحقيق (AR)…" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <textarea rows={3} value={investigationRecommendation} onChange={e => setInvestigationRecommendation(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder={t('recommendation_en_placeholder', { defaultValue: 'Recommendation (EN)…' })} />
                        <textarea dir="rtl" rows={3} value={investigationRecommendationAr} onChange={e => setInvestigationRecommendationAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder="التوصيات (AR)…" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <textarea rows={3} value={investigationActionTaken} onChange={e => setInvestigationActionTaken(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder={t('action_taken_en_placeholder', { defaultValue: 'Action Taken (EN)…' })} />
                        <textarea dir="rtl" rows={3} value={investigationActionTakenAr} onChange={e => setInvestigationActionTakenAr(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder="الإجراءات المتخذة (AR)…" />
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                        <label className="block font-black uppercase text-[10px] text-red-700 mb-1">{t('action_to_apply_from_penalty_ladder', { defaultValue: "Action to apply (from this violation's penalty ladder)" })}</label>
                        <p className="text-[10px] text-slate-400 mb-1">
                            {t('action_to_apply_internal_only_help', { defaultValue: 'Internal only — not printed on the form. Carries forward as the default at the Disciplinary Action stage; track repeat offenses of the same violation here to escalate the penalty.' })}
                        </p>
                        <select value={actionType} onChange={e => setActionType(e.target.value as DisciplinaryActionType)} className="w-full p-2 border border-slate-200 rounded">
                            {confirmedViolationLadder.length === 0 && <option value="">{t('select_a_violation_first', { defaultValue: 'Select a violation first…' })}</option>}
                            {confirmedViolationLadder.map((action, i) => (
                                <option key={action} value={action}>{`${OFFENSE_ORDINALS[i] || `${i + 1}th`} Offense — ${DISCIPLINARY_ACTION_LABELS[action]}`}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-center pt-1">
                        <button
                            disabled={busy}
                            onClick={() => saveStageDraft({
                                investigationOutcome,
                                investigationResult, investigationResultAr,
                                investigationRecommendation, investigationRecommendationAr,
                                investigationActionTaken, investigationActionTakenAr,
                                actionType,
                            })}
                            className="px-6 py-2 bg-slate-100 text-slate-700 font-black uppercase text-[10px] rounded"
                        >
                            {t('save', { defaultValue: 'Save' })}
                        </button>
                    </div>
                </div>
            )}

            {canManage && c.stage !== 'CLOSED' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <button disabled={busy} onClick={() => handleGenerateForm(c.stage)} className="w-full py-2 bg-slate-700 text-white font-black uppercase text-[10px] rounded">
                        {t('generate_stage_form', { stage: STAGE_LABELS[c.stage], defaultValue: 'Generate {{stage}} Form' })}
                    </button>

                    {c.stage === 'DISCIPLINARY_ACTION' && (
                        <div className="space-y-2">
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('disciplinary_action', { defaultValue: 'Disciplinary action' })}</label>
                            <select value={actionType} onChange={e => setActionType(e.target.value as DisciplinaryActionType)} className="w-full p-2 border border-slate-200 rounded">
                                {Object.entries(DISCIPLINARY_ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <label className="block font-black uppercase text-[10px] text-red-700">{t('effective_start_date_label', { defaultValue: 'Effective start date' })}</label>
                            <input type="date" value={actionEffectiveDate} onChange={e => setActionEffectiveDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded" />
                            <textarea rows={2} value={actionAdditionalInfo} onChange={e => setActionAdditionalInfo(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder={t('additional_info_optional', { defaultValue: 'Additional info (optional)…' })} />
                        </div>
                    )}

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-red-700 mb-1">
                            <Paperclip size={12} /> {t('upload_signed_copy', { defaultValue: 'Upload signed copy' })}
                        </label>
                        <input type="file" onChange={e => setSignedFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                    </div>

                    {c.stage === 'INCIDENT_REPORT' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return disciplinaryService.completeIncidentReport(c.id, doc);
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            {t('proceed_move_to_notice_to_explain', { defaultValue: 'Proceed — Move to Notice to Explain' })}
                        </button>
                    )}
                    {c.stage === 'NOTICE_TO_EXPLAIN' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return disciplinaryService.completeNoticeToExplain(c.id, { noticeToExplainDescription, noticeToExplainDescriptionAr, ...doc });
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            {t('complete_move_to_investigation', { defaultValue: 'Complete & Move to Investigation' })}
                        </button>
                    )}
                    {c.stage === 'INVESTIGATION_RESULT' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return disciplinaryService.completeInvestigationResult(c.id, {
                                    confirmedViolationId, investigationOutcome,
                                    investigationResult, investigationResultAr,
                                    investigationRecommendation, investigationRecommendationAr,
                                    investigationActionTaken, investigationActionTakenAr,
                                    actionType, ...doc,
                                });
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            {investigationOutcome === 'NON_VIOLATION' ? t('complete_close_case_no_violation', { defaultValue: 'Complete & Close Case (No Violation)' }) : t('complete_move_to_disciplinary_action', { defaultValue: 'Complete & Move to Disciplinary Action' })}
                        </button>
                    )}
                    {c.stage === 'DISCIPLINARY_ACTION' && (
                        <button
                            disabled={busy}
                            onClick={() => run(async () => {
                                const doc = await uploadFile(signedFile);
                                if (!doc) throw new Error('no-file');
                                return disciplinaryService.completeDisciplinaryAction(c.id, { actionType, actionEffectiveDate, actionAdditionalInfo, ...doc });
                            })}
                            className="w-full py-2 bg-red-700 text-white font-black uppercase text-[10px] rounded"
                        >
                            {t('complete_close_case', { defaultValue: 'Complete & Close Case' })}
                        </button>
                    )}
                </div>
            )}

            {canManage && c.stage === 'INCIDENT_REPORT' && (
                <div className="bg-white border border-amber-200 rounded-xl p-5 shadow-sm space-y-3 text-xs">
                    <span className="font-black uppercase text-[10px] text-amber-700 tracking-wider">{t('stop_complaint_not_pursued', { defaultValue: 'Stop Complaint — Not Pursued' })}</span>
                    <p className="text-slate-500">
                        {t('stop_complaint_help', { defaultValue: "After reviewing the complaint, if it doesn't warrant proceeding to Notice to Explain, close it here instead." })}
                    </p>
                    <div>
                        <label className="block font-black uppercase text-[10px] text-amber-700 mb-1">{t('reason_for_closing', { defaultValue: 'Reason for closing' })}</label>
                        <textarea rows={3} value={closureReason} onChange={e => setClosureReason(e.target.value)} className="w-full p-2 border border-slate-200 rounded" placeholder={t('reason_for_closing_placeholder', { defaultValue: 'Why this complaint does not warrant proceeding further…' })} />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-700 mb-1">
                            <Paperclip size={12} /> {t('upload_reviewed_document', { defaultValue: 'Upload reviewed document' })}
                        </label>
                        <input type="file" onChange={e => setDismissFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                    </div>
                    <button
                        disabled={busy}
                        onClick={() => {
                            if (!closureReason.trim()) return toast.error(t('reason_for_closing_required', { defaultValue: 'A reason for closing the case is required.' }));
                            run(async () => {
                                const doc = await uploadFile(dismissFile);
                                if (!doc) throw new Error('no-file');
                                return disciplinaryService.dismissIncidentReport(c.id, { closureReason, ...doc });
                            });
                        }}
                        className="w-full py-2 bg-amber-600 text-white font-black uppercase text-[10px] rounded"
                    >
                        {t('stop_close_case_not_pursued', { defaultValue: 'Stop — Close Case (Not Pursued)' })}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DisciplinaryCaseDetailPage;
