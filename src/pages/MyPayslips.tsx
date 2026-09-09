// "My Payslips" — the employee's own screen.
//
// Only periods that have been signed off appear here. A draft month is rebuilt from scratch on
// every recompute, so showing one would hand somebody a figure that changes tomorrow — worse than
// making them wait for the month to close.
//
// The summary on each card is the same arithmetic the document prints (earnings − deductions = net),
// so the screen and the payslip can be checked against each other at a glance.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { FileText, Download, Loader2, Receipt, CheckCircle2, Banknote, Info, Eye } from 'lucide-react';
import { payslipService } from '../services/payslipService';
import type { MyPayslip } from '../services/payslipService';

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

const MyPayslips: React.FC = () => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState<string | null>(null);

    const { data: slips = [], isLoading } = useQuery({
        queryKey: ['payslips', 'mine'],
        queryFn: payslipService.mine,
    });

    const download = async (slip: MyPayslip) => {
        setBusy(slip.period);
        try {
            saveBlob(await payslipService.myDocument(slip.period), `Payslip_${slip.period}.docx`);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payslip_download_failed', { defaultValue: 'Could not produce your payslip.' }));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Receipt size={22} className="text-[#511d29]" />
                    {t('nav_my_payslips', { defaultValue: 'My Payslips' })}
                </h1>
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                    {t('payslip_page_subtitle', {
                        defaultValue: 'Your payslip for every month that has been signed off. A month still being worked on does not appear here until it is closed.',
                    })}
                </p>
            </div>

            {isLoading ? (
                <p className="text-sm text-slate-400 font-medium">{t('loading', 'Loading...')}</p>
            ) : slips.length === 0 ? (
                <div className="bg-white border border-[#511d29]/10 rounded-2xl p-12 flex flex-col items-center text-center gap-2">
                    <FileText size={28} className="text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">
                        {t('payslip_none', { defaultValue: 'You have no payslips yet.' })}
                    </p>
                    <p className="text-xs text-slate-400 font-medium max-w-md">
                        {t('payslip_none_desc', {
                            defaultValue: 'One appears here as soon as a monthly payroll period covering you has been signed off.',
                        })}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {slips.map(s => (
                        <div key={s.period} className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h3 className="text-base font-black text-slate-800">{s.periodLabel}</h3>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            s.status === 'PAID' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                                        }`}>
                                            {s.status === 'PAID'
                                                ? <><Banknote size={11} /> {t('payslip_status_paid', { defaultValue: 'Paid' })}</>
                                                : <><CheckCircle2 size={11} /> {t('payslip_status_approved', { defaultValue: 'Approved' })}</>}
                                        </span>
                                    </div>
                                    {/* dir="ltr" or RTL reorders the range into end -> start. */}
                                    <p className="text-xs text-slate-400 font-medium mt-1">
                                        <span dir="ltr">{fmtDate(s.periodStart)} → {fmtDate(s.periodEnd)}</span>
                                        {' · '}
                                        {s.totalWorkingHours} {t('payslip_hours', { defaultValue: 'hours' })}
                                    </p>
                                </div>
                                <div className="text-end">
                                    <div className="text-xl font-black text-slate-800">{fmt(s.netSalary)}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {s.currency} · {t('payslip_net', { defaultValue: 'net salary' })}
                                    </div>
                                </div>
                            </div>

                            <dl className="mt-4 pt-3 border-t border-slate-100 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 text-xs">
                                <Row label={t('payslip_earnings', { defaultValue: 'Total earnings' })} value={`${fmt(s.totalEarnings)} ${s.currency}`} />
                                <Row label={t('payslip_deductions', { defaultValue: 'Total deductions' })} value={`- ${fmt(s.deductionsTotal)} ${s.currency}`} />
                                <Row label={t('payslip_basic', { defaultValue: 'Basic salary' })} value={`${fmt(s.basicSalary)} ${s.currency}`} />
                                {s.bonusAmount > 0 && (
                                    <Row label={t('payslip_bonus', { defaultValue: 'Bonus' })} value={`${fmt(s.bonusAmount)} ${s.currency}`} />
                                )}
                            </dl>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                    to={`/my-payslips/${s.period}`}
                                    className="inline-flex items-center gap-2 bg-[#511d29] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#3f1620]"
                                >
                                    <Eye size={15} />
                                    {t('payslip_open_on_screen', { defaultValue: 'Open the payslip' })}
                                </Link>
                                <button
                                    onClick={() => download(s)}
                                    disabled={busy === s.period}
                                    className="inline-flex items-center gap-2 bg-white border border-[#511d29]/20 text-[#511d29] px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#511d29]/5 disabled:opacity-40"
                                >
                                    {busy === s.period ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                    {t('payslip_download', { defaultValue: 'Download the payslip' })}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-slate-400 font-medium flex items-start gap-2">
                <Info size={13} className="mt-0.5 shrink-0" />
                {t('payslip_both_note', {
                    defaultValue: 'Open a payslip to read every figure on screen, or download it as a Word document to print or keep.',
                })}{' '}
                {t('payslip_footer_note', {
                    defaultValue: 'A month runs from the 25th to the 24th and is named after the month it ends in. For any question about your salary, email payroll@iph-ly.com.',
                })}
            </p>
        </div>
    );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between gap-4">
        <dt className="text-slate-400 font-semibold">{label}</dt>
        <dd className="text-slate-700 font-bold">{value}</dd>
    </div>
);

export default MyPayslips;
