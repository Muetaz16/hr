// The per-provider salary report, on the run detail page.
//
// Listed rather than hidden behind one button, because the numbers themselves are the useful part:
// what each provider is owed this period, before anyone opens a file. The download is one file per
// provider — never a single workbook with a tab each, which is how one provider ends up reading
// another's salaries.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, FileSpreadsheet, Loader2, Download, AlertTriangle } from 'lucide-react';
import { payrollRunService } from '../../services/payrollRunService';
import type { PayrollRun } from '../../services/payrollRunService';
import {
    groupLinesByProvider, buildProviderReportWorkbook, providerReportFilename,
} from '../../utils/payrollProviderReport';

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

const ProviderPayrollReports: React.FC<{ run: PayrollRun }> = ({ run }) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState<string | null>(null);

    // Only fetched once the period has been computed — before that there are no lines to report on.
    const { data, isLoading } = useQuery({
        queryKey: ['payroll', 'run', run.id, 'master-data'],
        queryFn: () => payrollRunService.masterData(run.id),
        enabled: !!run.attendanceFetchedAt,
    });

    if (!run.attendanceFetchedAt) return null;

    const groups = groupLinesByProvider(data?.lines || []);

    if (isLoading) {
        return (
            <div className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
                <p className="text-sm text-slate-400 font-medium">{t('loading', 'Loading...')}</p>
            </div>
        );
    }

    if (groups.length === 0) return null;

    const download = async (key: string, fn: () => Promise<void> | void) => {
        setBusy(key);
        try { await fn(); } catch (e: any) {
            toast.error(e?.message || t('provider_report_failed', { defaultValue: 'Could not produce the report.' }));
        } finally { setBusy(null); }
    };

    return (
        <div className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
            <div className="pb-4 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Building2 size={16} className="text-[#511d29]" />
                    {t('provider_reports_title', { defaultValue: 'Service-provider reports' })}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1 max-w-2xl">
                    {t('provider_reports_desc', {
                        defaultValue: 'One file per provider, holding only their own employees — a shorter version of the sheet Finance receives. Each file totals the net pay, the service fee and the amount to transfer.',
                    })}
                </p>
            </div>

            <div className="mt-4 space-y-3">
                {groups.map(g => {
                    const key = `${g.providerId}|${g.currency}`;
                    return (
                        <div key={key} className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 rounded-xl px-4 py-3">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800">
                                    {g.providerName}
                                    <span className="ms-2 px-2 py-0.5 rounded bg-white text-slate-600 text-[10px] font-black">{g.currency}</span>
                                    {g.percentage != null && (
                                        <span className="ms-1.5 text-[11px] font-bold text-slate-400">{g.percentage}%</span>
                                    )}
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    {g.payable.length} {t('payroll_employees', { defaultValue: 'employees' })}
                                    {' · '}
                                    {t('provider_report_net', { defaultValue: 'net' })} {fmt(g.netTotal)}
                                    {' · '}
                                    {t('provider_report_fee', { defaultValue: 'fee' })} {fmt(g.feeTotal)}
                                </p>
                                {g.notPayable.length > 0 && (
                                    <p className="text-[11px] font-semibold text-amber-700 mt-1 flex items-start gap-1">
                                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                                        {t('provider_report_excluded', {
                                            defaultValue: '{{n}} employee(s) could not be paid and are named in the file rather than left out silently.',
                                            n: g.notPayable.length,
                                        })}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="text-end">
                                    <div className="text-base font-black text-slate-800">{fmt(g.payableTotal)}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {g.currency} · {t('provider_report_total', { defaultValue: 'to transfer' })}
                                    </div>
                                </div>
                                <button
                                    onClick={() => download(key, async () => {
                                        if (!data) return;
                                        saveBlob(await buildProviderReportWorkbook(data.run, g), providerReportFilename(data.run, g));
                                    })}
                                    disabled={busy === key || g.payable.length === 0}
                                    title={g.payable.length === 0
                                        ? (t('provider_report_nothing', { defaultValue: 'Nothing payable for this provider this period.' }) as string)
                                        : undefined}
                                    className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {busy === key
                                        ? <Loader2 size={15} className="animate-spin" />
                                        : g.payable.length === 0 ? <FileSpreadsheet size={15} /> : <Download size={15} />}
                                    {t('provider_report_download', { defaultValue: 'Excel' })}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProviderPayrollReports;
