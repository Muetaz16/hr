// "Previous Miscalculation" — fixing a mistake made in an earlier payroll month, on the payslip of
// the current one. Two directions, one form:
//
//   money owed to the employee   → an EARNING, added to Total Earnings
//   money to recover from them   → a DEDUCTION, taken off in Total Deduction
//
// Naming the month being corrected is required, not optional, and it is picked from the employee's
// own payroll history rather than typed. A signed payslip carrying an unexplained 412.30 is worse
// than the original error.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Info, RefreshCw } from 'lucide-react';
import { payrollRunService } from '../../services/payrollRunService';
import { payrollCorrectionService } from '../../services/payrollCorrectionService';
import type { PayrollCorrection } from '../../services/payrollCorrectionService';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
    runId: string;
    lineId: string;
    currency: string;
    /** False once the period is locked — corrections are part of the frozen figures. */
    editable: boolean;
    canManage: boolean;
    /**
     * How many correction rows are actually IN this payslip's figures right now. Compared against
     * what is saved: a mismatch means the period has not been recomputed since, and the amounts on
     * screen do not yet include the correction. This is the single most confusing thing about the
     * feature, so the component says it rather than leaving it to a toast that has already gone.
     */
    appliedCount: number;
}

const PayrollCorrections: React.FC<Props> = ({ runId, lineId, currency, editable, canManage, appliedCount }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [adding, setAdding] = useState(false);
    const [direction, setDirection] = useState<'UNDERPAYMENT' | 'OVERPAYMENT'>('UNDERPAYMENT');
    const [amount, setAmount] = useState('');
    const [correctedLineId, setCorrectedLineId] = useState('');
    const [note, setNote] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['payroll', 'corrections', runId, lineId],
        queryFn: () => payrollCorrectionService.list(runId, lineId),
    });

    const [recomputing, setRecomputing] = useState(false);

    const recompute = async () => {
        setRecomputing(true);
        try {
            await payrollRunService.compute(runId);
            toast.success(t('payroll_recomputed', { defaultValue: 'Period recomputed — the corrections are in the figures now.' }));
            queryClient.invalidateQueries({ queryKey: ['payroll'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payroll_compute_failed', { defaultValue: 'Could not compute the payroll run.' }));
        } finally {
            setRecomputing(false);
        }
    };

    const reset = () => { setAdding(false); setAmount(''); setNote(''); setCorrectedLineId(''); setDirection('UNDERPAYMENT'); };

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['payroll', 'corrections', runId, lineId] });
        queryClient.invalidateQueries({ queryKey: ['payroll', 'run', runId] });
    };

    const add = useMutation({
        mutationFn: () => payrollCorrectionService.add(runId, lineId, {
            direction, amount: Number(amount), correctedLineId, note,
        }),
        onSuccess: () => {
            // The figures on screen do not move until the period is recomputed, and assuming they
            // already have is the obvious mistake to make here.
            toast.success(t('correction_added', { defaultValue: 'Correction saved. Recompute the period for it to reach the payslip.' }));
            reset();
            invalidate();
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('correction_add_failed', { defaultValue: 'Could not save the correction.' })),
    });

    const remove = useMutation({
        mutationFn: (id: string) => payrollCorrectionService.remove(runId, lineId, id),
        onSuccess: () => {
            toast.success(t('correction_removed', { defaultValue: 'Correction removed. Recompute the period to apply it.' }));
            invalidate();
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('correction_remove_failed', { defaultValue: 'Could not remove the correction.' })),
    });

    const corrections = data?.corrections || [];
    const priorLines = (data?.priorLines || []).filter(l => l.currency === currency);

    const formError = !amount || Number(amount) <= 0
        ? t('correction_need_amount', { defaultValue: 'Enter the amount.' })
        : !correctedLineId
            ? t('correction_need_month', { defaultValue: 'Choose the month being corrected.' })
            : !note.trim()
                ? t('correction_need_note', { defaultValue: 'Explain what is being corrected.' })
                : null;

    return (
        <div className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-black text-slate-700">
                        {t('correction_title', { defaultValue: 'Previous miscalculation' })}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5 max-w-lg">
                        {t('correction_subtitle', {
                            defaultValue: 'Add money owed from an earlier month, or recover money overpaid in one. Each correction has to name the month it fixes.',
                        })}
                    </p>
                </div>
                {canManage && editable && !adding && (
                    <button
                        onClick={() => setAdding(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        <Plus size={15} /> {t('correction_add', { defaultValue: 'Add a correction' })}
                    </button>
                )}
            </div>

            {!isLoading && corrections.length > appliedCount && (
                <div className="mt-4 border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                        <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-black text-blue-900">
                                {t('correction_not_applied', {
                                    defaultValue: '{{n}} correction(s) below are saved but not yet in the amounts on this page',
                                    n: corrections.length - appliedCount,
                                })}
                            </p>
                            <p className="text-[11px] text-blue-900/70 font-medium mt-0.5">
                                {t('correction_not_applied_desc', {
                                    defaultValue: 'The figures are rebuilt by a recompute. Nothing is lost — corrections survive it.',
                                })}
                            </p>
                        </div>
                    </div>
                    {canManage && editable && (
                        <button
                            onClick={recompute}
                            disabled={recomputing}
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs hover:bg-blue-700 disabled:opacity-40 shrink-0"
                        >
                            {recomputing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {t('payroll_recompute_now', { defaultValue: 'Recompute now' })}
                        </button>
                    )}
                </div>
            )}

            {isLoading ? (
                <p className="mt-4 text-xs text-slate-400 font-medium">{t('loading', 'Loading...')}</p>
            ) : corrections.length === 0 && !adding ? (
                <p className="mt-4 text-xs text-slate-300 font-semibold">
                    {t('correction_none', { defaultValue: 'No corrections on this payslip.' })}
                </p>
            ) : (
                <ul className="mt-4 space-y-2">
                    {corrections.map(c => (
                        <CorrectionRow
                            key={c.sourceId || c.label}
                            correction={c}
                            canRemove={canManage && editable}
                            removing={remove.isPending}
                            onRemove={() => c.sourceId && remove.mutate(c.sourceId)}
                            t={t}
                        />
                    ))}
                </ul>
            )}

            {adding && (
                <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                        {([
                            ['UNDERPAYMENT', ArrowUpCircle, 'correction_underpayment', 'Money owed to the employee', 'Added to Total Earnings'],
                            ['OVERPAYMENT', ArrowDownCircle, 'correction_overpayment', 'Money to recover', 'Taken off in Total Deduction'],
                        ] as const).map(([value, Icon, key, label, hint]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setDirection(value)}
                                className={`text-start px-4 py-3 rounded-xl border-2 transition-colors ${
                                    direction === value ? 'border-[#511d29] bg-[#511d29]/5' : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <span className="flex items-center gap-2 text-sm font-black text-slate-800">
                                    <Icon size={15} className={value === 'UNDERPAYMENT' ? 'text-emerald-600' : 'text-rose-600'} />
                                    {t(key, { defaultValue: label })}
                                </span>
                                <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
                                    {t(`${key}_hint`, { defaultValue: hint })}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="block text-xs font-bold text-slate-500 mb-1">
                                {t('correction_amount', { defaultValue: 'Amount' })} ({currency}) *
                            </span>
                            <input
                                type="number" min="0" step="0.01" value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-700"
                            />
                        </label>
                        <label className="block">
                            <span className="block text-xs font-bold text-slate-500 mb-1">
                                {t('correction_which_month', { defaultValue: 'Which month is being corrected?' })} *
                            </span>
                            <select
                                value={correctedLineId}
                                onChange={e => setCorrectedLineId(e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-700 bg-white"
                            >
                                <option value="">{t('correction_pick_month', { defaultValue: '— choose a month —' })}</option>
                                {priorLines.map(l => (
                                    <option key={l.lineId} value={l.lineId}>
                                        {l.period} — {fmt(l.netSalary)} {l.currency}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {priorLines.length === 0 && (
                        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-start gap-2">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                            {t('correction_no_prior', {
                                defaultValue: 'This employee has no earlier payroll month in {{cur}} to correct. A correction cannot cross currencies.',
                                cur: currency,
                            })}
                        </p>
                    )}

                    <label className="block">
                        <span className="block text-xs font-bold text-slate-500 mb-1">
                            {t('correction_note', { defaultValue: 'What went wrong?' })} *
                        </span>
                        <textarea
                            value={note} onChange={e => setNote(e.target.value)} rows={2}
                            placeholder={t('correction_note_placeholder', { defaultValue: 'e.g. overtime hours were approved after the period closed' }) as string}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700"
                        />
                    </label>

                    <p className="text-xs text-slate-400 font-medium flex items-start gap-2">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        {t('correction_recompute_note', {
                            defaultValue: 'Saving records the correction; the amounts change when the period is recomputed. Corrections survive a recompute.',
                        })}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => add.mutate()}
                            disabled={!!formError || add.isPending}
                            className="inline-flex items-center gap-2 bg-[#511d29] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#3f1620] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {add.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {t('correction_save', { defaultValue: 'Save the correction' })}
                        </button>
                        <button onClick={reset} className="text-sm font-bold text-slate-400 hover:text-slate-600">
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                        {formError && <span className="text-xs font-semibold text-slate-400">{formError}</span>}
                    </div>
                </div>
            )}
        </div>
    );
};

const CorrectionRow: React.FC<{
    correction: PayrollCorrection;
    canRemove: boolean;
    removing: boolean;
    onRemove: () => void;
    t: any;
}> = ({ correction: c, canRemove, removing, onRemove, t }) => {
    const isEarning = c.kind === 'EARNING';
    return (
        <li className="flex items-start justify-between gap-3 bg-slate-50/70 rounded-xl px-4 py-3">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    {isEarning
                        ? <ArrowUpCircle size={14} className="text-emerald-600 shrink-0" />
                        : <ArrowDownCircle size={14} className="text-rose-600 shrink-0" />}
                    <span className={`text-sm font-black tabular-nums ${isEarning ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isEarning ? '+' : '−'} {fmt(c.amount)} <span className="text-[10px] text-slate-400">{c.currency}</span>
                    </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">{c.correctionNote}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    {t('correction_corrects', { defaultValue: 'Corrects' })}{' '}
                    <span dir="ltr">{c.label.replace(/^.*\(/, '').replace(/\)$/, '')}</span>
                </p>
            </div>
            {canRemove && (
                <button
                    onClick={onRemove}
                    disabled={removing}
                    title={t('correction_remove', { defaultValue: 'Remove' }) as string}
                    className="text-slate-300 hover:text-rose-600 disabled:opacity-40 shrink-0"
                >
                    <Trash2 size={15} />
                </button>
            )}
        </li>
    );
};

export default PayrollCorrections;
