// One provider's cash-advance round: its requesting employees, and the three steps that move them.
//
// Rendered as numbered steps rather than a row of buttons, because the order matters and skipping
// step 2 means paying out money nobody outside IPH authorised. The list, the provider filter and
// the empty state live on the page (pages/payroll/ProviderAdvances.tsx); this is only the card.
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Building2, FileText, Upload, HandCoins, Loader2, CheckCircle2, Clock, AlertTriangle, Phone, Paperclip,
} from 'lucide-react';
import { payrollAdvanceService, providerAdvanceService } from '../../services/payrollAdvanceService';
import { fileUrl } from '../../services/apiClient';
import type { ProviderBatch } from '../../services/payrollAdvanceService';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

const ProviderBatchCard: React.FC<{ batch: ProviderBatch; canManage: boolean }> = ({ batch: b, canManage }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState<null | 'form' | 'upload' | 'approve' | 'disburse'>(null);
    const [doc, setDoc] = useState<{ url: string; name: string } | null>(null);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payroll'] });
    const providerKey = b.providerId || 'UNASSIGNED';

    const getForm = async () => {
        setBusy('form');
        try {
            const blob = await providerAdvanceService.form(providerKey, b.currency, b.formRef);
            const safe = (b.providerName || 'provider').replace(/[^a-zA-Z0-9]+/g, '_');
            saveBlob(blob, `Cash_Advance_${safe}_${b.currency}_${b.formRef || 'new'}.docx`);
            toast.success(b.formRef
                ? t('provider_batch_form_reprinted', { defaultValue: 'The same form reprinted, unchanged. Its reference and its list are as they were sent.' })
                : t('provider_batch_form_ready', { defaultValue: 'Form generated. Send it to the provider for signature. Anyone who asks from now on goes on the next form.' }));
            invalidate();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('provider_batch_form_failed', { defaultValue: 'Could not generate the form.' }));
        } finally {
            setBusy(null);
        }
    };

    const upload = async (file: File) => {
        setBusy('upload');
        try {
            setDoc(await payrollAdvanceService.uploadDocument(file));
            toast.success(t('provider_batch_uploaded', { defaultValue: 'Signed form attached.' }));
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payroll_document_upload_failed', { defaultValue: 'Could not upload the file.' }));
        } finally {
            setBusy(null);
        }
    };

    const approve = useMutation({
        mutationFn: () => providerAdvanceService.approve(providerKey, {
            currency: b.currency, formRef: b.formRef!, documentUrl: doc!.url, documentName: doc!.name,
        }),
        onSuccess: (r) => {
            // "Approved" reads like "done" and it is not — nothing is deducted until the cash is
            // recorded as handed over, so the next step is named in the message itself.
            toast.success(t('provider_batch_approved', {
                defaultValue: '{{n}} request(s) approved. Record the handover to schedule the deduction.',
                n: r.approved,
            }));
            setDoc(null);
            invalidate();
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('provider_batch_approve_failed', { defaultValue: 'Could not approve the requests.' })),
    });

    const disburse = useMutation({
        mutationFn: () => providerAdvanceService.disburse(providerKey, { currency: b.currency, formRef: b.formRef! }),
        onSuccess: (r) => {
            toast.success(t('provider_batch_disbursed', {
                defaultValue: '{{n}} advance(s) handed over and scheduled for deduction.',
                n: r.disbursed,
            }));
            // A deduction landing in a different month from the one the employee named is
            // something they WILL notice on their payslip, so it is said now, not discovered later.
            r.movedPeriods.forEach(m => toast.warning(t('provider_batch_period_moved', {
                defaultValue: '{{ref}}: the month requested is already closed — deduction moved to {{label}}.',
                ref: m.requestNumber, label: m.label,
            })));
            invalidate();
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('provider_batch_disburse_failed', { defaultValue: 'Could not record the handover.' })),
    });

    const noProvider = !b.providerId;

    return (
        <div className="bg-white border border-[#511d29]/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <Building2 size={17} className="text-[#511d29]" />
                        {b.providerName || t('provider_batch_unassigned', { defaultValue: 'No provider set on these requests' })}
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-black">{b.currency}</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                        {b.pendingCount > 0 && (
                            <span>{b.pendingCount} {t('provider_batch_awaiting', { defaultValue: 'awaiting the provider' })}</span>
                        )}
                        {b.pendingCount > 0 && b.approvedCount > 0 && ' · '}
                        {b.approvedCount > 0 && (
                            <span>{b.approvedCount} {t('provider_batch_awaiting_handover', { defaultValue: 'signed, awaiting handover' })}</span>
                        )}
                        {b.formRef && <> · <span dir="ltr">{b.formRef}</span> ({fmtDate(b.formIssuedAt)})</>}
                    </p>
                </div>
                <div className="text-end">
                    <div className="text-xl font-black text-slate-800">{fmt(b.total)}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {b.currency} · {t('provider_batch_total', { defaultValue: 'total requested' })}
                    </div>
                </div>
            </div>

            {noProvider && (
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-amber-800">
                        {t('provider_batch_unassigned_desc', {
                            defaultValue: 'These employees have no service provider on their record, so there is nobody to send the form to. Set the provider on the employee first.',
                        })}
                    </p>
                </div>
            )}

            <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                    <tr>
                        {['employee', 'passport_number', 'advance_amount', 'advance_salary_month', 'status'].map(k => (
                            <th key={k} className="px-5 py-2.5 text-start text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {t(k, {
                                    defaultValue: {
                                        employee: 'Employee', passport_number: 'Passport',
                                        advance_amount: 'Amount', advance_salary_month: 'From salary month', status: 'Status',
                                    }[k],
                                })}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {b.advances.map(a => (
                        <tr key={a.id}>
                            <td className="px-5 py-3">
                                <div className="text-sm font-bold text-slate-800">{a.employee?.fullName || '—'}</div>
                                <div className="text-[11px] text-slate-400 font-medium">
                                    {a.employee?.staffId || '—'} · <span dir="ltr">{a.requestNumber}</span>
                                </div>
                                {a.whatsappNumber && (
                                    <a
                                        href={`https://wa.me/${a.whatsappNumber.replace(/[^0-9]/g, '')}`}
                                        target="_blank" rel="noreferrer" dir="ltr"
                                        className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold text-emerald-700 hover:underline"
                                    >
                                        <Phone size={10} /> {a.whatsappNumber}
                                    </a>
                                )}
                            </td>
                            <td className="px-5 py-3 text-xs font-mono text-slate-500" dir="ltr">
                                {a.employee?.passportNumber || <span className="text-amber-600 font-sans font-bold">{t('provider_batch_no_passport', { defaultValue: 'missing' })}</span>}
                            </td>
                            <td className="px-5 py-3 text-sm font-bold text-slate-700 whitespace-nowrap">{fmt(a.principal)} {a.currency}</td>
                            <td className="px-5 py-3 text-xs font-semibold text-slate-500" dir="ltr">{a.firstDeductionPeriod}</td>
                            <td className="px-5 py-3">
                                {a.status === 'PENDING' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700">
                                        <Clock size={10} /> {t('provider_batch_pending', { defaultValue: 'With the provider' })}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">
                                        <CheckCircle2 size={10} /> {t('provider_batch_signed', { defaultValue: 'Signed' })}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {canManage && (
                <div className="p-5 border-t border-slate-100 space-y-4">
                    {b.pendingCount > 0 && (
                        <>
                            <Step n={1} title={t('provider_batch_step1', { defaultValue: 'Print the form and send it to the provider' })}>
                                <button
                                    onClick={getForm}
                                    disabled={busy === 'form' || noProvider}
                                    className="inline-flex items-center gap-2 bg-[#511d29] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#3f1620] disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {busy === 'form' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                                    {b.formRef
                                        ? t('provider_batch_reprint_form', { defaultValue: 'Reprint the same form (Word)' })
                                        : t('provider_batch_get_form', { defaultValue: 'Cash Advance Request form (Word)' })}
                                </button>
                                <p className="text-[11px] text-slate-400 font-medium mt-2">
                                    {b.formRef
                                        ? t('provider_batch_reprint_desc', {
                                            defaultValue: 'Reprints this form exactly as it was sent — same reference, same names, same total. It does not pick up requests made since.',
                                        })
                                        : t('provider_batch_step1_desc', {
                                            defaultValue: 'One form lists every request above with its total, under a reference number stamped on each of them. Printing it closes this round: anyone who asks afterwards goes onto the next form.',
                                        })}
                                </p>
                            </Step>

                            {!b.formRef ? (
                                <p className="text-[11px] font-semibold text-slate-400 ps-8">
                                    {t('provider_batch_print_first', {
                                        defaultValue: 'Print the form before approving — approval is recorded against the reference of the form the provider actually signed.',
                                    })}
                                </p>
                            ) : (
                            <Step n={2} title={t('provider_batch_step2', { defaultValue: 'Attach the signed form and approve' })}>
                                <input
                                    ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.docx"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => fileRef.current?.click()}
                                        disabled={busy === 'upload'}
                                        className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        {busy === 'upload' ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                        {t('provider_batch_upload', { defaultValue: 'Upload the signed form' })}
                                    </button>
                                    {doc && (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">
                                            <CheckCircle2 size={13} /> {doc.name}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => approve.mutate()}
                                        disabled={!doc || approve.isPending}
                                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {approve.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                        {t('provider_batch_approve', { defaultValue: 'Approve {{n}} request(s)', n: b.pendingCount })}
                                    </button>
                                </div>
                            </Step>
                            )}
                        </>
                    )}

                    {b.approvedCount > 0 && (
                        <Step n={b.pendingCount > 0 ? 3 : 1} title={t('provider_batch_step3', { defaultValue: 'Record the cash handover' })}>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => disburse.mutate()}
                                    disabled={disburse.isPending}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40"
                                >
                                    {disburse.isPending ? <Loader2 size={15} className="animate-spin" /> : <HandCoins size={15} />}
                                    {t('provider_batch_disburse', { defaultValue: 'Handed over to {{n}} employee(s)', n: b.approvedCount })}
                                </button>
                                {b.signedDocumentUrl && (
                                    <a
                                        href={fileUrl(b.signedDocumentUrl) ?? undefined} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#511d29]"
                                    >
                                        <Paperclip size={13} /> {b.signedDocumentName || t('provider_batch_signed_form', { defaultValue: 'Signed form' })}
                                    </a>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-2">
                                {t('provider_batch_step3_desc', {
                                    defaultValue: 'This is what schedules the deduction. Nothing comes off a salary until the cash is recorded as handed over.',
                                })}
                            </p>
                        </Step>
                    )}
                </div>
            )}
        </div>
    );
};

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
    <div className="flex gap-3">
        <span className="w-6 h-6 shrink-0 rounded-full bg-[#511d29]/8 text-[#511d29] text-[11px] font-black flex items-center justify-center">{n}</span>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-700 mb-2">{title}</p>
            {children}
        </div>
    </div>
);

export default ProviderBatchCard;
