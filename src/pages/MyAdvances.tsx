// "My Salary Advances" — the employee's own screen, replacing the Google Form.
//
// The old form asked for eight things; six of them the company already knows. Those are shown as a
// read-only summary card instead of being typed, because a hand-typed staff ID is how a request
// ends up attached to the wrong person. Only what the employee alone knows is asked for.
//
// Two genuinely different forms, chosen by the employee's own contract type rather than by a
// question they have to answer about themselves:
//   · residents and directly-contracted non-residents pick one, two or three months of basic pay
//   · employees hired through a service provider type an amount and name one salary month
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    HandCoins, Loader2, AlertTriangle, CheckCircle2, Clock, XCircle, Info, Send, Undo2,
} from 'lucide-react';
import { advanceRequestService } from '../services/advanceRequestService';
import type { MyAdvance } from '../services/advanceRequestService';

const STATUS_STYLE: Record<MyAdvance['status'], { cls: string; icon: React.ElementType; label: string }> = {
    PENDING: { cls: 'bg-amber-50 text-amber-700', icon: Clock, label: 'Awaiting a decision' },
    APPROVED: { cls: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2, label: 'Approved' },
    ACTIVE: { cls: 'bg-blue-50 text-blue-700', icon: HandCoins, label: 'Being repaid' },
    SETTLED: { cls: 'bg-slate-100 text-slate-600', icon: CheckCircle2, label: 'Fully repaid' },
    REJECTED: { cls: 'bg-rose-50 text-rose-600', icon: XCircle, label: 'Declined' },
    CANCELLED: { cls: 'bg-slate-100 text-slate-500', icon: XCircle, label: 'Cancelled' },
};

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const MyAdvances: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: ctx, isLoading, error } = useQuery({
        queryKey: ['advance-requests', 'context'],
        queryFn: advanceRequestService.context,
        retry: false,
    });
    const { data: mine = [] } = useQuery({
        queryKey: ['advance-requests', 'mine'],
        queryFn: advanceRequestService.mine,
    });

    // --- form state ---------------------------------------------------------------------------
    const [months, setMonths] = useState<number | null>(null);
    const [instalments, setInstalments] = useState(1);
    const [amount, setAmount] = useState('');
    const [salaryMonth, setSalaryMonth] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [reason, setReason] = useState('');

    // Pre-fill the number we already have on file; the employee can correct it, and the correction
    // travels with the request rather than silently editing their personnel record.
    useEffect(() => {
        if (ctx?.employee.personalPhone && !whatsapp) setWhatsapp(ctx.employee.personalPhone);
        if (ctx?.defaultPeriod && !salaryMonth) setSalaryMonth(ctx.defaultPeriod);
    }, [ctx]);

    const submit = useMutation({
        mutationFn: () => advanceRequestService.create(
            ctx?.viaProvider
                ? { whatsappNumber: whatsapp, reason: reason || undefined, amount: Number(amount), salaryMonth }
                : { whatsappNumber: whatsapp, reason: reason || undefined, basicSalaryMonths: months!, instalmentCount: instalments },
        ),
        onSuccess: () => {
            toast.success(t('advance_submitted', { defaultValue: 'Your request has been sent to Payroll.' }));
            setMonths(null); setAmount(''); setReason(''); setInstalments(1);
            queryClient.invalidateQueries({ queryKey: ['advance-requests'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('advance_submit_failed', { defaultValue: 'Could not send your request.' })),
    });

    const withdraw = useMutation({
        mutationFn: (id: string) => advanceRequestService.withdraw(id),
        onSuccess: () => {
            toast.success(t('advance_withdrawn', { defaultValue: 'Request withdrawn.' }));
            queryClient.invalidateQueries({ queryKey: ['advance-requests'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('advance_withdraw_failed', { defaultValue: 'Could not withdraw the request.' })),
    });

    const chosen = useMemo(() => ctx?.options.find(o => o.months === months) || null, [ctx, months]);
    const minInstalments = chosen?.minInstalments ?? 1;

    // Three months of basic pay cannot come back in one: the instalment would be bigger than the
    // salary it is deducted from. Choosing a larger amount therefore raises the repayment floor,
    // and any shorter period already picked is pushed up to it rather than silently left invalid.
    const pickMonths = (m: number) => {
        setMonths(m);
        const floor = ctx?.options.find(o => o.months === m)?.minInstalments ?? 1;
        setInstalments(prev => Math.max(prev, floor));
    };

    const formError: string | null = !ctx
        ? null
        : !whatsapp.trim()
            ? t('advance_need_whatsapp', { defaultValue: 'Enter your WhatsApp number.' })
            : ctx.viaProvider
                ? (!Number(amount) || Number(amount) <= 0
                    ? t('advance_need_amount', { defaultValue: 'Enter the amount you are requesting.' })
                    : (ctx.maxAdvance != null && Number(amount) > ctx.maxAdvance)
                        ? t('advance_over_ceiling', {
                            max: ctx.maxAdvance, currency: ctx.currency,
                            defaultValue: 'An advance cannot be more than one monthly salary ({{max}} {{currency}}) — it is taken back from a single salary month.',
                        })
                        : !salaryMonth
                            ? t('advance_need_month', { defaultValue: 'Choose the salary month this amount comes from.' })
                            : null)
                : (months === null ? t('advance_need_months', { defaultValue: 'Choose how many months of basic salary.' }) : null);

    if (isLoading) return <div className="p-8 text-slate-400 font-medium">{t('loading', 'Loading...')}</div>;

    if (error || !ctx) {
        return (
            <div className="max-w-2xl mx-auto p-4 md:p-8">
                <Header t={t} />
                <div className="bg-white border border-rose-100 rounded-2xl p-6 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-slate-600">
                        {(error as any)?.response?.data?.error
                            || t('advance_no_employee_record', { defaultValue: 'Your account is not linked to an employee record. Contact Human Resources.' })}
                    </p>
                </div>
            </div>
        );
    }

    const openRequest = mine.find(a => ['PENDING', 'APPROVED', 'ACTIVE'].includes(a.status));

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <Header t={t} viaProvider={ctx.viaProvider} />

            {/* Everything the company already holds. Shown, not asked for. */}
            <div className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    {t('advance_your_details', { defaultValue: 'Your details on file' })}
                </p>
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
                    <Field label={t('employee_name', { defaultValue: 'Name' })} value={ctx.employee.fullName} />
                    <Field label={t('staff_id', { defaultValue: 'Employee ID' })} value={ctx.employee.staffId} />
                    <Field label={t('position', { defaultValue: 'Position' })} value={ctx.employee.position} />
                    <Field label={t('email', { defaultValue: 'Email' })} value={ctx.employee.email} />
                    {ctx.viaProvider && (
                        <Field label={t('service_provider', { defaultValue: 'Service provider' })} value={ctx.serviceProvider?.name} />
                    )}
                    <Field label={t('currency', { defaultValue: 'Currency' })} value={ctx.currency} />
                    {!ctx.viaProvider && ctx.monthlyBasic != null && (
                        <Field
                            label={t('advance_monthly_basic', { defaultValue: 'Monthly basic salary' })}
                            value={`${fmt(ctx.monthlyBasic)} ${ctx.currency || ''}`}
                        />
                    )}
                </dl>
            </div>

            {ctx.blockedReason && (
                <div className="border border-amber-200 bg-amber-50 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-amber-800">
                        {ctx.blockedReason === 'NO_BASIC_SALARY'
                            ? t('advance_blocked_no_basic', { defaultValue: 'Your basic salary cannot be worked out from your job category, grade and salary structure, so the amounts below cannot be offered. Contact Human Resources.' })
                            : t('advance_blocked_no_currency', { defaultValue: 'Your salary structure is not set, so the currency of an advance cannot be determined. Contact Human Resources.' })}
                    </p>
                </div>
            )}

            {openRequest ? (
                <div className="border border-blue-200 bg-blue-50/60 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-blue-900">
                        {t('advance_already_open', {
                            defaultValue: 'You have an advance in progress ({{ref}}). A new one can be requested once it is fully repaid or cancelled.',
                            ref: openRequest.requestNumber,
                        })}
                    </p>
                </div>
            ) : !ctx.blockedReason && (
                <div className="bg-white border border-[#511d29]/10 rounded-2xl p-6 space-y-5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('advance_new_request', { defaultValue: 'New request' })}
                    </p>

                    {ctx.viaProvider ? (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block">
                                    <span className="block text-xs font-bold text-slate-500 mb-1">
                                        {t('advance_amount', { defaultValue: 'Amount requested' })} ({ctx.currency}) *
                                    </span>
                                    <input
                                        type="number" min="0" step="0.01" max={ctx.maxAdvance ?? undefined} value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-700"
                                    />
                                    {ctx.maxAdvance != null && (
                                        <span className="block text-[11px] font-medium text-slate-400 mt-1">
                                            {t('advance_ceiling_hint', {
                                                max: ctx.maxAdvance, currency: ctx.currency,
                                                defaultValue: 'At most {{max}} {{currency}} — one monthly salary, taken back in one go.',
                                            })}
                                        </span>
                                    )}
                                </label>
                                <label className="block">
                                    <span className="block text-xs font-bold text-slate-500 mb-1">
                                        {t('advance_salary_month', { defaultValue: 'Salary month it is taken from' })} *
                                    </span>
                                    <select
                                        value={salaryMonth}
                                        onChange={e => setSalaryMonth(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-700 bg-white"
                                    >
                                        {salaryMonthOptions(ctx.defaultPeriod).map(p => (
                                            <option key={p} value={p}>{monthLabel(p, t)}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <p className="text-xs text-slate-400 font-medium flex items-start gap-2">
                                <Info size={13} className="mt-0.5 shrink-0" />
                                {t('advance_provider_note', {
                                    defaultValue: 'The full amount is recovered from that one salary month — it is not split into instalments.',
                                })}
                            </p>
                        </>
                    ) : (
                        <>
                            <div>
                                <span className="block text-xs font-bold text-slate-500 mb-2">
                                    {t('advance_how_much', { defaultValue: 'How much do you need?' })} *
                                </span>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {ctx.options.map(o => (
                                        <button
                                            key={o.months}
                                            type="button"
                                            onClick={() => pickMonths(o.months)}
                                            className={`text-start px-4 py-3 rounded-xl border-2 transition-colors ${
                                                months === o.months
                                                    ? 'border-[#511d29] bg-[#511d29]/5'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="text-lg font-black text-slate-800">{fmt(o.amount)}</div>
                                            <div className="text-[11px] font-bold text-slate-400">
                                                {ctx.currency} · {t('advance_n_basic_salaries', {
                                                    defaultValue: '{{n}} basic salary/salaries',
                                                    count: o.months, n: o.months,
                                                })}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="block max-w-xs">
                                <span className="block text-xs font-bold text-slate-500 mb-1">
                                    {t('advance_repayment_months', { defaultValue: 'Repay over how many months?' })} *
                                </span>
                                <select
                                    value={instalments}
                                    onChange={e => setInstalments(Number(e.target.value))}
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-700 bg-white"
                                >
                                    {Array.from(
                                        { length: ctx.maxInstalments - minInstalments + 1 },
                                        (_, i) => i + minInstalments,
                                    ).map(n => (
                                        <option key={n} value={n}>
                                            {t('advance_n_months', { defaultValue: '{{n}} month(s)', count: n, n })}
                                        </option>
                                    ))}
                                </select>
                                {minInstalments > 1 && (
                                    <span className="block text-[11px] text-slate-400 font-medium mt-1.5">
                                        {t('advance_min_months_hint', {
                                            defaultValue: 'At least {{min}}, because one instalment cannot exceed one basic salary.',
                                            // Pluralised, or Arabic reads "2 أشهر" instead of "شهرين".
                                            min: t('advance_n_months', { defaultValue: '{{n}} month(s)', count: minInstalments, n: minInstalments }),
                                        })}
                                    </span>
                                )}
                            </label>

                            {chosen && (
                                <p className="text-xs font-bold text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
                                    {t('advance_instalment_preview', {
                                        defaultValue: 'About {{each}} {{cur}} a month over {{months}}. First instalment from the {{period}} salary.',
                                        each: fmt(Math.round((chosen.amount / instalments) * 100) / 100),
                                        cur: ctx.currency,
                                        // Pre-pluralised, so Arabic gets "شهرين" / "3 أشهر" rather
                                        // than a bare number glued to a singular noun.
                                        months: t('advance_n_months', { defaultValue: '{{n}} month(s)', count: instalments, n: instalments }),
                                        // Formatted client-side from the raw YYYY-MM: the server's
                                        // own label is English and was leaking into the Arabic UI.
                                        period: monthLabel(ctx.defaultPeriod, t),
                                    })}
                                </p>
                            )}
                        </>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="block text-xs font-bold text-slate-500 mb-1">
                                {t('advance_whatsapp', { defaultValue: 'WhatsApp number' })} *
                            </span>
                            <input
                                value={whatsapp} onChange={e => setWhatsapp(e.target.value)} dir="ltr"
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-700"
                            />
                        </label>
                        <label className="block">
                            <span className="block text-xs font-bold text-slate-500 mb-1">
                                {t('advance_reason', { defaultValue: 'Reason (optional)' })}
                            </span>
                            <input
                                value={reason} onChange={e => setReason(e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                            onClick={() => submit.mutate()}
                            disabled={!!formError || submit.isPending}
                            className="inline-flex items-center gap-2 bg-[#511d29] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#3f1620] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            {t('advance_submit', { defaultValue: 'Send the request' })}
                        </button>
                        {formError && <span className="text-xs font-semibold text-slate-400">{formError}</span>}
                    </div>
                </div>
            )}

            {/* --- history ------------------------------------------------------------------- */}
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    {t('advance_my_requests', { defaultValue: 'My requests' })}
                </p>
                {mine.length === 0 ? (
                    <div className="bg-white border border-[#511d29]/10 rounded-2xl p-10 text-center">
                        <p className="text-sm font-bold text-slate-400">
                            {t('advance_none_yet', { defaultValue: 'You have not requested an advance yet.' })}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {mine.map(a => (
                            <AdvanceCard
                                key={a.id}
                                advance={a}
                                onWithdraw={() => withdraw.mutate(a.id)}
                                withdrawing={withdraw.isPending}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Names the thing the employee is actually entitled to instead of calling both an advance. While
// the context is still loading there is nothing to base it on, so it stays generic.
const Header: React.FC<{ t: any; viaProvider?: boolean | null }> = ({ t, viaProvider }) => (
    <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <HandCoins size={22} className="text-[#511d29]" />
            {viaProvider == null
                ? t('nav_my_advances', { defaultValue: 'Loans & Advances' })
                : viaProvider
                    ? t('advance_title_advance', { defaultValue: 'Salary Advance' })
                    : t('advance_title_loan', { defaultValue: 'Loan' })}
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            {viaProvider === false
                ? t('loan_page_subtitle', {
                    defaultValue: 'Request a loan against your salary and follow what has been repaid so far. It is repaid over as many months as the number of basic salaries you take. Payroll decides on the request; sending it moves no money.',
                })
                : t('advance_page_subtitle', {
                    defaultValue: 'Request an advance on your salary and follow what has been deducted so far. Payroll decides on the request; sending it moves no money.',
                })}
        </p>
    </div>
);

const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div className="flex justify-between gap-4 border-b border-slate-50 pb-1.5">
        <dt className="text-slate-400 font-semibold shrink-0">{label}</dt>
        <dd className="text-slate-700 font-bold text-end truncate">{value || '—'}</dd>
    </div>
);

/** The next 12 payroll months, starting with the one currently being worked on. */
const salaryMonthOptions = (from: string): string[] => {
    const [y, m] = from.split('-').map(Number);
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(y, m - 1 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
};

const monthLabel = (period: string, t: any): string => {
    const [y, m] = period.split('-').map(Number);
    return `${t(`month_${MONTHS[m - 1].toLowerCase()}`, { defaultValue: MONTHS[m - 1] })} ${y}`;
};

const AdvanceCard: React.FC<{ advance: MyAdvance; onWithdraw: () => void; withdrawing: boolean; t: any }> = ({ advance, onWithdraw, withdrawing, t }) => {
    const meta = STATUS_STYLE[advance.status];
    const Icon = meta.icon;
    const deducted = advance.instalments.filter(i => i.status === 'DEDUCTED');

    return (
        <div className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-base font-black text-slate-800">{fmt(advance.principal)} {advance.currency}</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${meta.cls}`}>
                            <Icon size={11} /> {t(`advance_status_${advance.status}`, { defaultValue: meta.label })}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                        {advance.requestNumber} · {fmtDate(advance.createdAt)}
                        {advance.basicSalaryMonths && (
                            <> · {t('advance_n_basic_salaries', { defaultValue: '{{n}} basic salary/salaries', count: advance.basicSalaryMonths, n: advance.basicSalaryMonths })}</>
                        )}
                    </p>
                </div>
                <div className="text-end">
                    {['ACTIVE', 'APPROVED'].includes(advance.status) && (
                        <>
                            <div className="text-sm font-black text-slate-800">{fmt(advance.outstandingAmount)} {advance.currency}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {t('advance_outstanding', { defaultValue: 'Still to repay' })}
                            </div>
                        </>
                    )}
                    {advance.status === 'PENDING' && (
                        <button
                            onClick={onWithdraw}
                            disabled={withdrawing}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 disabled:opacity-40"
                        >
                            <Undo2 size={13} /> {t('advance_withdraw', { defaultValue: 'Withdraw' })}
                        </button>
                    )}
                </div>
            </div>

            {advance.status === 'REJECTED' && advance.rejectionReason && (
                <p className="mt-3 text-xs font-semibold text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
                    {advance.rejectionReason}
                </p>
            )}

            {advance.instalments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        {t('advance_schedule', { defaultValue: 'Repayment schedule' })}
                        {deducted.length > 0 && (
                            <span className="ms-2 text-slate-300">
                                {deducted.length}/{advance.instalments.length} {t('advance_deducted', { defaultValue: 'deducted' })}
                            </span>
                        )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {advance.instalments.map(i => (
                            <span
                                key={i.id}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                    i.status === 'DEDUCTED' ? 'bg-emerald-50 text-emerald-700'
                                        : i.status === 'WAIVED' ? 'bg-slate-100 text-slate-400 line-through'
                                            : i.status === 'DEFERRED' ? 'bg-amber-50 text-amber-700'
                                                : 'bg-slate-50 text-slate-500'
                                }`}
                                title={t(`advance_inst_${i.status}`, { defaultValue: i.status }) as string}
                            >
                                <span dir="ltr">{i.period}</span> · {fmt(i.amount)}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyAdvances;
