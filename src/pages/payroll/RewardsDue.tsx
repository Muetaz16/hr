// Payroll → Bonuses Due.
//
// Every reward that carries money, why it was granted, which payroll month pays it, and whether it
// has been paid. The reward cases themselves are raised and signed off in Personnel Relations; this
// screen exists because payroll needs to answer two questions the case list cannot: "what is
// landing on this month's payslips?" and "which approved bonus is going to be missed?"
//
// That second one is the point of the amber rows. A bonus with no payout month is never picked up
// by any run — the engine's predicate requires one — so without this screen it simply never gets
// paid and nobody notices.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Award, AlertTriangle, CheckCircle2, Clock, Search, Info } from 'lucide-react';
import { payrollRewardService } from '../../services/payrollRewardService';
import type { PayrollReward, RewardState } from '../../services/payrollRewardService';
import { canAccess } from '../../utils/access';
import { useAuth } from '../../context/AuthContext';
import PayrollTabs from '../../components/payroll/PayrollTabs';
import { RESIDENCY_LABELS } from '../../utils/payrollLabels';

const ATTENTION: Record<string, { label: string; hint: string }> = {
    NOT_COMPLETED: {
        label: 'Reward case not complete',
        hint: 'Its signed document is still missing, so no payroll run will pay it.',
    },
    NO_PAYOUT_PERIOD: {
        label: 'No payout month set',
        hint: 'Choose the month below, or this bonus will never appear on a payslip.',
    },
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The 12 months around the current period, for the payout-month picker. */
const periodChoices = (current: string): string[] => {
    const [y, m] = current.split('-').map(Number);
    return Array.from({ length: 15 }, (_, i) => {
        const d = new Date(y, m - 1 - 3 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
};

const RewardsDue: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_payroll']);

    const [state, setState] = useState<RewardState>('');
    const [period, setPeriod] = useState('');
    const [search, setSearch] = useState('');

    const { data: periodData } = useQuery({
        queryKey: ['payroll', 'reward-periods'],
        queryFn: payrollRewardService.periods,
    });
    const { data: rewards = [], isLoading } = useQuery({
        queryKey: ['payroll', 'rewards', { state, period }],
        queryFn: () => payrollRewardService.list({ state, period: period || undefined }),
    });

    const setPayout = useMutation({
        mutationFn: ({ id, payoutPeriod }: { id: string; payoutPeriod: string | null }) =>
            payrollRewardService.setPayoutPeriod(id, payoutPeriod),
        onSuccess: () => {
            toast.success(t('reward_payout_updated', { defaultValue: 'Payout month updated' }));
            queryClient.invalidateQueries({ queryKey: ['payroll'] });
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('reward_payout_failed', { defaultValue: 'Could not change the payout month.' })),
    });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rewards;
        return rewards.filter(r =>
            (r.employee.fullName || '').toLowerCase().includes(q)
            || (r.employee.staffId || '').toLowerCase().includes(q)
            || r.caseNumber.toLowerCase().includes(q));
    }, [rewards, search]);

    // Totals per currency only — the same rule as everywhere else in payroll, because there is no
    // exchange rate in this system.
    const totals = useMemo(() => {
        const acc = new Map<string, { currency: string; count: number; amount: number }>();
        for (const r of filtered) {
            if (r.paidInRun) continue;
            const cur = r.currency || '—';
            const row = acc.get(cur) || { currency: cur, count: 0, amount: 0 };
            row.count += 1;
            row.amount += r.actualAmount ?? r.estimatedAmount ?? 0;
            acc.set(cur, row);
        }
        return [...acc.values()];
    }, [filtered]);

    const needsAttention = filtered.filter(r => r.needsAttention).length;
    const choices = periodChoices(periodData?.current || '2026-01');

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <PayrollTabs
                subtitle={t('payroll_subtitle_rewards', {
                    defaultValue: 'Every reward that pays money, why it was granted, and which payroll month pays it. A bonus is a percentage of the basic salary, so the figure is a forecast until the period is computed.',
                })}
            />

            {needsAttention > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-black text-amber-800">
                            {t('reward_attention_banner', { defaultValue: '{{n}} bonus(es) would never be paid as things stand', n: needsAttention })}
                        </p>
                        <p className="text-xs text-amber-800/70 font-medium mt-0.5">
                            {t('reward_attention_banner_desc', { defaultValue: 'A payroll run only picks up a bonus whose reward case is complete AND has a payout month. The rows below are missing one of the two.' })}
                        </p>
                    </div>
                </div>
            )}

            {totals.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {totals.map(x => (
                        <div key={x.currency} className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
                            <div className="flex items-baseline justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{x.currency}</span>
                                <span className="text-xs font-bold text-slate-400">
                                    {x.count} {t('payroll_rewards_pending', { defaultValue: 'unpaid' })}
                                </span>
                            </div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{fmt(x.amount)}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {t('payroll_reward_forecast', { defaultValue: 'Forecast bonus total' })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-white border border-[#511d29]/10 rounded-2xl overflow-hidden">
                <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
                    <div className="flex gap-1.5">
                        {([
                            ['', 'payroll_filter_all', 'All'],
                            ['DUE', 'reward_filter_due', 'Due'],
                            ['PAID', 'reward_filter_paid', 'Paid'],
                            ['UNSCHEDULED', 'reward_filter_unscheduled', 'No month set'],
                        ] as const).map(([value, key, label]) => (
                            <button
                                key={value}
                                onClick={() => { setState(value as RewardState); setPeriod(''); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${state === value ? 'bg-[#511d29] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {t(key, { defaultValue: label })}
                            </button>
                        ))}
                    </div>
                    <select
                        value={period}
                        onChange={e => { setPeriod(e.target.value); setState(''); }}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white"
                    >
                        <option value="">{t('reward_all_periods', { defaultValue: 'Every payout month' })}</option>
                        {(periodData?.periods || []).map(p => (
                            <option key={p.period} value={p.period}>{p.period} ({p.count})</option>
                        ))}
                    </select>
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('reward_search', { defaultValue: 'Search by name, staff ID or case number…' })}
                            className="w-full ps-9 pe-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
                        />
                    </div>
                </div>

                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <Th>{t('employee', { defaultValue: 'Employee' })}</Th>
                            <Th>{t('reward_award', { defaultValue: 'Award' })}</Th>
                            <Th>{t('reward_why', { defaultValue: 'Why' })}</Th>
                            <Th>{t('reward_bonus', { defaultValue: 'Bonus' })}</Th>
                            <Th>{t('reward_payout_month', { defaultValue: 'Paid in' })}</Th>
                            <Th>{t('status', { defaultValue: 'Status' })}</Th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading && (
                            <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">{t('loading', 'Loading...')}</td></tr>
                        )}
                        {!isLoading && filtered.length === 0 && (
                            <tr><td colSpan={6} className="px-5 py-10 text-center">
                                <Award size={26} className="mx-auto text-slate-200 mb-2" />
                                <p className="text-sm font-bold text-slate-400">
                                    {t('reward_none', { defaultValue: 'No bonuses match this filter.' })}
                                </p>
                            </td></tr>
                        )}
                        {filtered.map(r => (
                            <RewardRow
                                key={r.id}
                                reward={r}
                                canManage={canManage}
                                choices={choices}
                                onSetPayout={p => setPayout.mutate({ id: r.id, payoutPeriod: p })}
                                t={t}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-slate-400 font-medium flex items-start gap-2">
                <Info size={13} className="mt-0.5 shrink-0" />
                {t('reward_estimate_note', {
                    defaultValue: 'An unpaid bonus is shown as a forecast from the contractual monthly basic. The real figure is a percentage of the basic actually earned that month, and replaces the forecast once the period is computed.',
                })}
            </p>
        </div>
    );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <th className="px-5 py-3 text-start text-[10px] font-black text-slate-400 uppercase tracking-widest">{children}</th>
);

const RewardRow: React.FC<{
    reward: PayrollReward;
    canManage: boolean;
    choices: string[];
    onSetPayout: (period: string | null) => void;
    t: any;
}> = ({ reward: r, canManage, choices, onSetPayout, t }) => {
    const attention = r.needsAttention ? ATTENTION[r.needsAttention] : null;
    const amount = r.actualAmount ?? r.estimatedAmount;

    return (
        <tr className={attention ? 'bg-amber-50/40' : ''}>
            <td className="px-5 py-3">
                <div className="text-sm font-bold text-slate-800">{r.employee.fullName || '—'}</div>
                <div className="text-[11px] text-slate-400 font-medium">
                    {r.employee.staffId || '—'} · {r.employee.departmentName || '—'}
                    {r.employee.residencyType && (
                        <> · {t(`residency_${r.employee.residencyType}`, { defaultValue: RESIDENCY_LABELS[r.employee.residencyType] || r.employee.residencyType })}</>
                    )}
                </div>
            </td>
            <td className="px-5 py-3">
                <div className="text-sm font-semibold text-slate-700">
                    {t(`reward_type_${r.type}`, { defaultValue: r.typeLabel })}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                    {r.caseNumber}{r.awardedFor && <> · <span dir="ltr">{r.awardedFor}</span></>}
                </div>
            </td>
            <td className="px-5 py-3 max-w-xs">
                <p className="text-xs text-slate-500 font-medium line-clamp-2" title={r.justification || ''}>
                    {r.justification || <span className="text-slate-300">—</span>}
                </p>
            </td>
            <td className="px-5 py-3 whitespace-nowrap">
                <div className="text-sm font-black text-slate-800">
                    {amount != null ? `${fmt(amount)} ${r.currency || ''}` : <span className="text-slate-300">—</span>}
                </div>
                <div className="text-[11px] font-bold text-slate-400">
                    {r.bonusPercent}% {t('reward_of_basic', { defaultValue: 'of basic' })}
                    {r.actualAmount == null && amount != null && (
                        <span className="ms-1 text-slate-300">({t('reward_forecast', { defaultValue: 'forecast' })})</span>
                    )}
                </div>
            </td>
            <td className="px-5 py-3 whitespace-nowrap">
                {r.paidInRun ? (
                    <Link to={`/payroll/runs/${r.paidInRun.id}`} className="text-sm font-bold text-slate-700 hover:text-[#511d29] hover:underline">
                        <span dir="ltr">{r.paidInRun.period}</span>
                    </Link>
                ) : canManage ? (
                    <select
                        value={r.payoutPeriod || ''}
                        onChange={e => onSetPayout(e.target.value || null)}
                        className={`px-2 py-1.5 border rounded-lg text-xs font-bold bg-white ${r.payoutPeriod ? 'border-slate-200 text-slate-700' : 'border-amber-300 text-amber-700'}`}
                    >
                        <option value="">{t('reward_pick_month', { defaultValue: '— pick a month —' })}</option>
                        {choices.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                ) : (
                    <span className="text-sm font-bold text-slate-600">
                        <span dir="ltr">{r.payoutPeriod || '—'}</span>
                    </span>
                )}
            </td>
            <td className="px-5 py-3">
                {r.paidInRun ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600">
                        <CheckCircle2 size={10} /> {t('reward_status_paid', { defaultValue: 'Paid' })}
                    </span>
                ) : attention ? (
                    <div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">
                            <AlertTriangle size={10} /> {t(`reward_attention_${r.needsAttention}`, { defaultValue: attention.label })}
                        </span>
                        <p className="text-[10px] text-amber-800/60 font-medium mt-1 max-w-[200px]">
                            {t(`reward_attention_hint_${r.needsAttention}`, { defaultValue: attention.hint })}
                        </p>
                    </div>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700">
                        <Clock size={10} /> {t('reward_status_due', { defaultValue: 'Due' })}
                    </span>
                )}
            </td>
        </tr>
    );
};

export default RewardsDue;
