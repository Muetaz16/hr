// Payroll → Provider Advances.
//
// Its own screen, not a section of the advances register, because it is a different procedure with
// a different counterparty: an employee hired through a service provider cannot be granted an
// advance by IPH alone — their provider is the employer of record and signs for it.
//
// One card per provider. Each provider bills in a single currency, so a card is also one Cash
// Advance Request form. If a provider ever shows requests in two currencies the card says so and
// splits them, because the form carries one total and there is no exchange rate in this system.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Building2, AlertTriangle, Info, Filter, Archive } from 'lucide-react';
import { payrollAdvanceService, providerAdvanceService } from '../../services/payrollAdvanceService';
import type { AdvanceStatus } from '../../services/payrollAdvanceService';
import { periodLabel } from '../../utils/payrollLabels';
import { canAccess } from '../../utils/access';
import { useAuth } from '../../context/AuthContext';
import PayrollTabs from '../../components/payroll/PayrollTabs';
import ProviderBatchCard from '../../components/payroll/ProviderAdvanceBatches';

const STATUS_STYLES: Record<AdvanceStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    ACTIVE: 'bg-blue-50 text-blue-700',
    SETTLED: 'bg-slate-100 text-slate-500',
    REJECTED: 'bg-rose-50 text-rose-600',
    CANCELLED: 'bg-slate-100 text-slate-400',
};

const ARCHIVE_FILTERS: (AdvanceStatus | '')[] = ['', 'PENDING', 'APPROVED', 'ACTIVE', 'SETTLED', 'REJECTED', 'CANCELLED'];

const fmtMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWhen = (s?: string | null) =>
    (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const ProviderAdvances: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_payroll']);

    const [provider, setProvider] = useState('');
    const [archiveStatus, setArchiveStatus] = useState<AdvanceStatus | ''>('');

    const { data, isLoading } = useQuery({
        queryKey: ['payroll', 'provider-batches'],
        queryFn: providerAdvanceService.batches,
    });

    const batches = data?.batches || [];
    const hrManagerName = data?.hrManagerName ?? null;

    // Every provider advance, whatever state it is in. The open rounds above are a working queue,
    // not a record — once an advance is handed over it drops out of them and would be unfindable.
    const { data: archive = [], isLoading: archiveLoading } = useQuery({
        queryKey: ['payroll', 'provider-advances', 'archive', archiveStatus],
        queryFn: () => payrollAdvanceService.list({ scope: 'provider', ...(archiveStatus ? { status: archiveStatus } : {}) }),
    });

    // The filter the procedure is actually driven by: one provider at a time, with its employees.
    const providers = useMemo(() => {
        const seen = new Map<string, string>();
        for (const b of batches) {
            const key = b.providerId || 'UNASSIGNED';
            if (!seen.has(key)) seen.set(key, b.providerName || t('provider_batch_unassigned', { defaultValue: 'No provider set' }));
        }
        return [...seen.entries()].map(([id, name]) => ({ id, name }));
    }, [batches, t]);

    const shown = provider ? batches.filter(b => (b.providerId || 'UNASSIGNED') === provider) : batches;

    // The provider chips filter the archive too — one provider at a time is how this desk works.
    const archiveRows = provider
        ? archive.filter(a => (a.serviceProviderId || 'UNASSIGNED') === provider)
        : archive;

    // A provider appearing under two currencies contradicts "one provider, one currency" and would
    // otherwise just look like two unrelated cards.
    const mixedCurrency = useMemo(() => {
        const byProvider = new Map<string, Set<string>>();
        for (const b of batches) {
            const key = b.providerId || 'UNASSIGNED';
            if (!byProvider.has(key)) byProvider.set(key, new Set());
            byProvider.get(key)!.add(b.currency);
        }
        return [...byProvider.entries()]
            .filter(([, curs]) => curs.size > 1)
            .map(([id, curs]) => ({
                name: batches.find(b => (b.providerId || 'UNASSIGNED') === id)?.providerName || id,
                currencies: [...curs],
            }));
    }, [batches]);

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <PayrollTabs
                subtitle={t('provider_advances_subtitle', {
                    defaultValue: 'Advance requests from employees hired through a service provider. Their provider has to sign for the advance, so requests are collected per provider onto one form: print it, get it signed, then record the handover — which is what schedules the deduction.',
                })}
            />

            {/* Whose name the form will carry. Shown here rather than discovered in the document. */}
            <div className={`rounded-2xl px-5 py-3.5 flex items-start gap-3 border ${hrManagerName ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'}`}>
                {hrManagerName
                    ? <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    : <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />}
                <p className={`text-xs font-semibold ${hrManagerName ? 'text-slate-500' : 'text-amber-800'}`}>
                    {hrManagerName
                        ? t('provider_form_signed_by', {
                            defaultValue: 'The form will be signed as Head of HR Division by: {{name}}',
                            name: hrManagerName,
                        })
                        : t('provider_form_no_hr_manager', {
                            defaultValue: 'No single Head of HR is designated, so the form leaves that line blank for the signer to write in. Assign the "Approve as Head of HR" permission to exactly one person to have it printed.',
                        })}
                </p>
            </div>

            {mixedCurrency.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-black text-amber-800">
                            {t('provider_mixed_currency', { defaultValue: 'A provider has requests in more than one currency' })}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {mixedCurrency.map(m => (
                                <li key={m.name} className="text-xs text-amber-900/80 font-medium">
                                    · {m.name} — {m.currencies.join(' / ')}
                                </li>
                            ))}
                        </ul>
                        <p className="text-xs text-amber-800/70 font-medium mt-1.5">
                            {t('provider_mixed_currency_desc', {
                                defaultValue: 'Each provider is expected to bill in one currency. A separate form is produced per currency, since one form carries one total and there is no exchange rate here. Check the salary structures on those employees.',
                            })}
                        </p>
                    </div>
                </div>
            )}

            {providers.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                    <Filter size={14} className="text-slate-400" />
                    <button
                        onClick={() => setProvider('')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${provider === '' ? 'bg-[#511d29] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        {t('provider_filter_all', { defaultValue: 'All providers' })}
                    </button>
                    {providers.map(pv => (
                        <button
                            key={pv.id}
                            onClick={() => setProvider(pv.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${provider === pv.id ? 'bg-[#511d29] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                            {pv.name}
                        </button>
                    ))}
                </div>
            )}

            {isLoading ? (
                <p className="text-sm text-slate-400 font-medium">{t('loading', 'Loading...')}</p>
            ) : shown.length === 0 ? (
                <div className="bg-white border border-[#511d29]/10 rounded-2xl p-12 flex flex-col items-center text-center gap-2">
                    <Building2 size={28} className="text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">
                        {t('provider_batch_none', { defaultValue: 'No service-provider advance requests are waiting.' })}
                    </p>
                    <p className="text-xs text-slate-400 font-medium max-w-md">
                        {t('provider_batch_none_desc', {
                            defaultValue: 'When an employee hired through a provider requests an advance, it appears here grouped by provider so one form can be sent for all of them.',
                        })}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {shown.map(b => <ProviderBatchCard key={b.key} batch={b} canManage={canManage} />)}
                </div>
            )}

            {/* --- Archive ---------------------------------------------------------------------
                Every provider advance ever filed, in whatever state. The rounds above are a working
                queue: an advance leaves them the moment the cash is handed over, so without this a
                signed-off advance could not be found on its own screen. Read-only — the record. */}
            <div className="pt-2">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <Archive size={15} className="text-[#511d29]" />
                        {t('provider_archive', { defaultValue: 'Archive — every request' })}
                    </h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {ARCHIVE_FILTERS.map(st => (
                            <button
                                key={st || 'ALL'}
                                onClick={() => setArchiveStatus(st)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                    archiveStatus === st ? 'bg-[#511d29] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                {st
                                    ? t(`advance_status_${st}`, { defaultValue: st })
                                    : t('all', { defaultValue: 'All' })}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white border border-[#511d29]/10 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    {['employee', 'provider', 'advance_amount', 'provider_form', 'advance_salary_month', 'status', 'requested_on'].map(k => (
                                        <th key={k} className="px-5 py-2.5 text-start text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            {t(k, {
                                                defaultValue: {
                                                    employee: 'Employee', provider: 'Provider', advance_amount: 'Amount',
                                                    provider_form: 'Form', advance_salary_month: 'From salary month',
                                                    status: 'Status', requested_on: 'Requested',
                                                }[k],
                                            })}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {archiveLoading ? (
                                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400 font-medium">{t('loading', 'Loading...')}</td></tr>
                                ) : archiveRows.length === 0 ? (
                                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400 font-medium">
                                        {t('provider_archive_none', { defaultValue: 'Nothing here for this filter.' })}
                                    </td></tr>
                                ) : archiveRows.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50/60">
                                        <td className="px-5 py-3">
                                            <div className="text-sm font-bold text-slate-800">{a.employee?.fullName || '—'}</div>
                                            <div className="text-[11px] text-slate-400 font-medium" dir="ltr">
                                                {a.employee?.staffId || '—'} · {a.requestNumber}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-xs font-semibold text-slate-500">{a.serviceProviderName || '—'}</td>
                                        <td className="px-5 py-3 text-sm font-bold text-slate-700 whitespace-nowrap">{fmtMoney(a.principal)} {a.currency}</td>
                                        <td className="px-5 py-3 text-[11px] font-mono text-slate-500" dir="ltr">{a.providerFormRef || '—'}</td>
                                        <td className="px-5 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{periodLabel(a.firstDeductionPeriod, t)}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[a.status]}`}>
                                                {t(`advance_status_${a.status}`, { defaultValue: a.status })}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-400 font-medium whitespace-nowrap">{fmtWhen(a.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProviderAdvances;
