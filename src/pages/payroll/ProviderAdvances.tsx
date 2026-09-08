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
import { Building2, AlertTriangle, Info, Filter } from 'lucide-react';
import { providerAdvanceService } from '../../services/payrollAdvanceService';
import { canAccess } from '../../utils/access';
import { useAuth } from '../../context/AuthContext';
import PayrollTabs from '../../components/payroll/PayrollTabs';
import ProviderBatchCard from '../../components/payroll/ProviderAdvanceBatches';

const ProviderAdvances: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_payroll']);

    const [provider, setProvider] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['payroll', 'provider-batches'],
        queryFn: providerAdvanceService.batches,
    });

    const batches = data?.batches || [];
    const hrManagerName = data?.hrManagerName ?? null;

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
        </div>
    );
};

export default ProviderAdvances;
