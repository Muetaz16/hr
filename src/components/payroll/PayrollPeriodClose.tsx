// Closing a monthly payroll period — the last step of the review procedure, as three numbered
// actions rather than one button, because that is how it actually happens:
//
//   1. Export the MASTER DATA review sheet and send it to Internal Audit and the Finance Division.
//   2. Print the Salary Approval memo and collect the four wet signatures.
//   3. Upload the signed memo, and only then close the period.
//
// Closing sets approvedAt, which a database trigger reads to refuse every later change to the
// run's lines, items and totals. There is no re-open: a mistake is corrected by cancelling the run
// and computing a new revision, so superseded numbers stay on record.
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2, Paperclip, AlertTriangle, Printer } from 'lucide-react';
import { payrollRunService } from '../../services/payrollRunService';
import { fileUrl } from '../../services/apiClient';
import type { PayrollRun } from '../../services/payrollRunService';
import { buildMasterDataWorkbook } from '../../utils/payrollMasterData';
import { payslipService } from '../../services/payslipService';
import { BLOCK_LABELS, BLOCK_FIXES } from '../../utils/payrollLabels';

/** Hands a generated file to the browser. */
export const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

export const exportMasterData = async (runId: string) => {
    const { run, lines } = await payrollRunService.masterData(runId);
    saveBlob(await buildMasterDataWorkbook(run, lines), `MASTER_DATA_${run.period}_${run.runNumber}.xlsx`);
};

/** Every payable employee's payslip in one document, one per page, ready to print. */
export const downloadAllPayslips = async (runId: string, period: string) => {
    saveBlob(await payslipService.forRun(runId), `Payslips_${period}.docx`);
};

export const downloadApprovalForm = async (runId: string, period: string) => {
    saveBlob(await payrollRunService.approvalForm(runId), `Salary_Approval_${period}.docx`);
};

// The memo has exactly five printed amount rows. A currency x residency combination outside them
// carries money that a signed document would not mention, so it is named on screen instead of
// being silently dropped.
const FORM_SLOTS: [string, string][] = [
    ['RESDANT', 'LYD'],
    ['DIRCT NONE RESDANT', 'EUR'],
    ['DIRCT NONE RESDANT', 'USD'],
    ['NONE RESDANT', 'EUR'],
    ['NONE RESDANT', 'USD'],
];

export const uncoveredApprovalTotals = (run: PayrollRun) =>
    (run.totals || [])
        .filter(x => x.residencyType !== 'ALL' && (x.netTotal !== 0 || x.employerCostTotal !== 0))
        .filter(x => !FORM_SLOTS.some(([r, c]) => r === x.residencyType && c === x.currency));

interface Props {
    run: PayrollRun;
    blockedCount: number;
    canManage: boolean;
}

const PayrollPeriodClose: React.FC<Props> = ({ run, blockedCount, canManage }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);

    const [busy, setBusy] = useState<null | 'excel' | 'form' | 'upload' | 'close' | 'payslips'>(null);
    const [doc, setDoc] = useState<{ url: string; name: string } | null>(null);
    const [note, setNote] = useState('');
    const [ackBlocked, setAckBlocked] = useState(false);

    const computed = !!run.attendanceFetchedAt;
    const uncovered = uncoveredApprovalTotals(run);

    // --- already closed -----------------------------------------------------------------------
    if (run.approvedAt) {
        return (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-base font-black text-emerald-800">
                            {t('payroll_period_closed', { defaultValue: 'This period is closed' })}
                        </h3>
                        <p className="text-xs text-emerald-800/70 font-medium mt-1">
                            {t('payroll_period_closed_desc', {
                                defaultValue: 'Closed on {{date}}{{by}}. Nothing in this run can be changed any more — a correction is made by cancelling it and computing a new revision.',
                                date: new Date(run.approvedAt).toLocaleString('en-GB'),
                                by: run.approvedByName ? ` ${t('payroll_closed_by', { defaultValue: 'by' })} ${run.approvedByName}` : '',
                            })}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4">
                            {run.approvalDocumentUrl && (
                                <a
                                    href={fileUrl(run.approvalDocumentUrl) ?? undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 bg-white border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-50"
                                >
                                    <Paperclip size={15} />
                                    {run.approvalDocumentName || t('payroll_signed_approval', { defaultValue: 'Signed approval form' })}
                                </a>
                            )}
                            {/* Only once the period is closed: before that the figures are rebuilt
                                on every recompute, and a printed stack would go stale in the hand. */}
                            <button
                                onClick={async () => {
                                    setBusy('payslips');
                                    try {
                                        await downloadAllPayslips(run.id, run.period);
                                    } catch (err: any) {
                                        toast.error(err?.response?.data?.error
                                            || t('payslip_bulk_failed', { defaultValue: 'Could not produce the payslips.' }));
                                    } finally {
                                        setBusy(null);
                                    }
                                }}
                                disabled={busy === 'payslips'}
                                className="inline-flex items-center gap-2 bg-[#511d29] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#3f1620] disabled:opacity-40"
                            >
                                {busy === 'payslips' ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                                {t('payslip_bulk_download', { defaultValue: 'All payslips for printing' })}
                            </button>
                            <ExportButtons run={run} busy={busy} setBusy={setBusy} tone="light" />
                        </div>
                        {blockedCount > 0 && (
                            <p className="text-xs font-semibold text-amber-800 mt-3 flex items-start gap-1.5">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                {t('payslip_bulk_skips', {
                                    defaultValue: '{{n}} employee(s) are not in the printed stack — their line was not payable, so a payslip would have printed zeros.',
                                    n: blockedCount,
                                })}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (!canManage) return null;

    // --- still open ---------------------------------------------------------------------------
    const handleUpload = async (file: File) => {
        setBusy('upload');
        try {
            setDoc(await payrollRunService.uploadDocument(run.id, file));
            toast.success(t('payroll_document_uploaded', { defaultValue: 'Signed form attached' }));
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payroll_document_upload_failed', { defaultValue: 'Could not upload the file.' }));
        } finally {
            setBusy(null);
        }
    };

    const handleClose = async () => {
        if (!doc) return;
        // Irreversible, so it is confirmed once in words rather than behind a second screen.
        const message = blockedCount > 0
            ? t('payroll_close_confirm_blocked', {
                defaultValue: 'Close {{period}}? {{n}} employee(s) will be paid nothing because their data is incomplete. Every line freezes permanently and a correction needs a new revision of the whole period.',
                period: run.period, n: blockedCount,
            })
            : t('payroll_close_confirm', {
                defaultValue: 'Close {{period}}? Every line freezes permanently. A correction after this needs a new revision of the whole period.',
                period: run.period,
            });
        if (!window.confirm(message as string)) return;

        setBusy('close');
        try {
            await payrollRunService.close(run.id, {
                documentUrl: doc.url,
                documentName: doc.name,
                note: note.trim() || undefined,
                acknowledgeBlocked: blockedCount > 0 ? true : undefined,
            });
            toast.success(t('payroll_period_closed', { defaultValue: 'This period is closed' }));
            queryClient.invalidateQueries({ queryKey: ['payroll'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payroll_close_failed', { defaultValue: 'Could not close this period.' }));
        } finally {
            setBusy(null);
        }
    };

    // Only two things genuinely stop a close: nothing to close, and no signed form. Blocked lines
    // are a warning — while employee records are still being filled in, most of a period can be
    // blocked and the people whose data IS complete still have to be paid. It just cannot happen
    // by accident, so it takes a tick.
    const blocker = !computed
        ? t('payroll_close_blocked_not_computed', { defaultValue: 'Compute this period first.' })
        : !doc
            ? t('payroll_close_blocked_no_doc', { defaultValue: 'Attach the signed approval form first.' })
            : blockedCount > 0 && !ackBlocked
                ? t('payroll_close_needs_ack', { defaultValue: 'Confirm the blocked lines below before closing.' })
                : null;

    return (
        <div className="bg-white border-2 border-[#511d29]/15 rounded-2xl p-6">
            <div className="flex items-start gap-3 pb-5 border-b border-slate-100">
                <Lock size={18} className="text-[#511d29] shrink-0 mt-0.5" />
                <div>
                    <h3 className="text-base font-black text-slate-800">
                        {t('payroll_close_period', { defaultValue: 'Close this monthly period' })}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 max-w-2xl">
                        {t('payroll_close_period_desc', {
                            defaultValue: 'Send the review sheet to Internal Audit and the Finance Division, collect the signatures on the approval form, then attach it here. Closing is permanent.',
                        })}
                    </p>
                </div>
            </div>

            <ol className="mt-5 space-y-5">
                <Step n={1} title={t('payroll_close_step1', { defaultValue: 'Send the review sheet for checking' })}>
                    <ExportButtons run={run} busy={busy} setBusy={setBusy} tone="dark" />
                </Step>

                <Step n={2} title={t('payroll_close_step2', { defaultValue: 'Print the approval form and collect the signatures' })}>
                    <p className="text-xs text-slate-400 font-medium">
                        {t('payroll_close_step2_desc', {
                            defaultValue: 'The form comes out already carrying this period\'s amounts. It is signed by the Head of Human Resources, the Finance Division, Internal Audit, and finally the Administrative Director.',
                        })}
                    </p>
                    {uncovered.length > 0 && (
                        <div className="mt-3 border border-amber-200 bg-amber-50 rounded-xl px-3 py-2">
                            <p className="text-[11px] font-bold text-amber-800">
                                {t('payroll_form_uncovered', { defaultValue: 'The form has no printed row for these amounts — add them by hand before signing:' })}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                                {uncovered.map(x => (
                                    <li key={x.id} className="text-[11px] text-amber-900/80 font-medium">
                                        · {t(`residency_${x.residencyType}`, { defaultValue: x.residencyType })} — {x.currency} {x.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Step>

                <Step n={3} title={t('payroll_close_step3', { defaultValue: 'Attach the signed form and close' })}>
                    <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.docx"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={busy === 'upload'}
                            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-40"
                        >
                            {busy === 'upload' ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                            {t('payroll_upload_signed', { defaultValue: 'Upload the signed form' })}
                        </button>
                        {doc && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">
                                <CheckCircle2 size={13} /> {doc.name}
                            </span>
                        )}
                    </div>

                    <input
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder={t('payroll_close_note', { defaultValue: 'Note (optional) — e.g. the approval reference number' }) as string}
                        className="mt-3 w-full max-w-xl px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium"
                    />

                    {blockedCount > 0 && (
                        <div className="mt-4 border border-amber-200 bg-amber-50/70 rounded-xl p-4">
                            <p className="text-sm font-black text-amber-800 flex items-center gap-2">
                                <AlertTriangle size={15} />
                                {t('payroll_close_review_needed', {
                                    defaultValue: '{{n}} employee(s) need review and will be paid nothing',
                                    n: blockedCount,
                                })}
                            </p>
                            <p className="text-xs text-amber-800/70 font-medium mt-1">
                                {t('payroll_close_review_needed_desc', {
                                    defaultValue: 'Each is missing an input the salary cannot be worked out without, so its amounts are all zero. You can still close the period — everyone else is paid normally.',
                                })}
                            </p>
                            {(run.blockReasonCounts?.length ?? 0) > 0 && (
                                <ul className="mt-3 space-y-1.5">
                                    {run.blockReasonCounts!.map(r => (
                                        <li key={r.code} className="text-xs text-amber-900/90">
                                            <b>{r.count}</b> — {t(`payroll_block_${r.code}`, { defaultValue: BLOCK_LABELS[r.code] || r.code })}
                                            <span className="block text-amber-800/60 ms-4">
                                                {t(`payroll_fix_${r.code}`, { defaultValue: BLOCK_FIXES[r.code] || '' })}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <label className="mt-4 flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={ackBlocked}
                                    onChange={e => setAckBlocked(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 accent-[#511d29]"
                                />
                                <span className="text-xs font-bold text-amber-900">
                                    {t('payroll_close_ack', {
                                        defaultValue: 'I understand these {{n}} employee(s) will receive nothing for this period.',
                                        n: blockedCount,
                                    })}
                                </span>
                            </label>
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleClose}
                            disabled={!!blocker || busy === 'close'}
                            className="inline-flex items-center gap-2 bg-[#511d29] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#3f1620] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {busy === 'close' ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                            {t('payroll_close_action', { defaultValue: 'Close the period' })}
                        </button>
                        {blocker && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                <AlertTriangle size={13} /> {blocker}
                            </span>
                        )}
                    </div>
                </Step>
            </ol>
        </div>
    );
};

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
    <li className="flex gap-4">
        <span className="w-7 h-7 shrink-0 rounded-full bg-[#511d29]/8 text-[#511d29] text-xs font-black flex items-center justify-center">{n}</span>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-700 mb-2">{title}</p>
            {children}
        </div>
    </li>
);

/** The two downloads. Shared between the open and the closed state — a closed period still needs
    its review sheet and memo re-printable for the audit file. */
export const ExportButtons: React.FC<{
    run: PayrollRun;
    busy: null | 'excel' | 'form' | 'upload' | 'close' | 'payslips';
    setBusy: (v: null | 'excel' | 'form' | 'upload' | 'close' | 'payslips') => void;
    tone: 'dark' | 'light' | 'neutral';
}> = ({ run, busy, setBusy, tone }) => {
    const { t } = useTranslation();
    const computed = !!run.attendanceFetchedAt;

    const run1 = async (kind: 'excel' | 'form') => {
        setBusy(kind);
        try {
            if (kind === 'excel') await exportMasterData(run.id);
            else await downloadApprovalForm(run.id, run.period);
        } catch (err: any) {
            toast.error(
                err?.response?.data?.error
                || t('payroll_export_failed', { defaultValue: 'Could not produce the file.' }),
            );
        } finally {
            setBusy(null);
        }
    };

    const NEUTRAL = 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
    const cls = tone === 'dark'
        ? 'bg-[#511d29] text-white hover:bg-[#3f1620]'
        : tone === 'neutral'
            ? NEUTRAL
            : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50';

    return (
        <div className="flex flex-wrap gap-2">
            <button
                onClick={() => run1('excel')}
                disabled={!computed || busy === 'excel'}
                title={!computed ? (t('payroll_close_blocked_not_computed', { defaultValue: 'Compute this period first.' }) as string) : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
            >
                {busy === 'excel' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                {t('payroll_export_master_data', { defaultValue: 'Review sheet (Excel)' })}
            </button>
            <button
                onClick={() => run1('form')}
                disabled={!computed || busy === 'form'}
                title={!computed ? (t('payroll_close_blocked_not_computed', { defaultValue: 'Compute this period first.' }) as string) : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${tone === 'light' ? cls : NEUTRAL}`}
            >
                {busy === 'form' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                {t('payroll_download_approval_form', { defaultValue: 'Approval form (Word)' })}
            </button>
        </div>
    );
};

export default PayrollPeriodClose;
