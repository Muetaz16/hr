// One month's payslip, shown on screen.
//
// The point of this screen is that the employee can read every figure without a file leaving the
// system. A .docx in someone's hands is editable — they can change their own net salary and forward
// it as though payroll had issued it — whereas what is on this screen is served fresh from the
// signed-off payroll line each time it is opened.
//
// Every label, every value and their order come from the server, out of the same payslipSections()
// that fills the Word document. So this screen cannot drift from that file: change a label in one
// place and both move together.
//
// Deliberately built from divs, not <table>: src/index.css styles every table in the app with
// !important (rounded corners, 1.25rem cell padding, forced td colour), which a dense bilingual
// payslip cannot survive. Fighting that with more !important would leave a rule nobody can safely
// touch later.
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Loader2, Receipt, CheckCircle2, Banknote, Info } from 'lucide-react';

import { payslipService, isSubheading } from '../services/payslipService';
import type { PayslipSection } from '../services/payslipService';

const fmtDate = (s?: string | null) =>
    (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

/** A "Total …" row is what the reader checks the others against, so it is set apart. */
const isTotalRow = (label: string) => label.startsWith('Total');

const Section: React.FC<{ section: PayslipSection; emphasise?: boolean }> = ({ section, emphasise }) => (
    <div className={`bg-white border rounded-2xl overflow-hidden ${emphasise ? 'border-[#511d29]/40 shadow-sm' : 'border-[#511d29]/10'}`}>
        <div className="bg-[#511d29] text-white px-4 py-2 flex items-center justify-between gap-3 border-y border-[#e3c4a2]/40">
            <span className="text-[11px] font-black uppercase tracking-widest">{section.title}</span>
            <span className="text-xs font-black" dir="rtl">{section.titleAr}</span>
        </div>

        {section.valueHeader && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 px-4 py-1.5 bg-[#f5ebd9] border-b border-[#511d29]/10">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#511d29]">
                    {/* The template's own column caption for this box. */}
                    Criteria
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#511d29] text-center min-w-[7rem]">
                    {section.valueHeader}
                </span>
                {/* text-end belongs on the cell, which inherits the page direction; dir="rtl" goes
                    on a <bdi> inside it. On the span itself, "end" would resolve against RTL and
                    align the Arabic to the LEFT, i.e. against the value instead of the card edge. */}
                <span className="text-[10px] font-black text-[#511d29] text-end">
                    <bdi dir="rtl">المعيار</bdi>
                </span>
            </div>
        )}

        <div className="divide-y divide-slate-100">
            {section.rows.map((row, i) =>
                isSubheading(row) ? (
                    <div key={`s${i}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 px-4 py-1.5 bg-[#f5ebd9]/70">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#511d29]">{row.subheading}</span>
                        <span className="min-w-[7rem]" />
                        <span className="text-[11px] font-black text-[#511d29] text-end">
                            <bdi dir="rtl">{row.subheadingAr}</bdi>
                        </span>
                    </div>
                ) : (
                    <div
                        key={row.label}
                        className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 px-4 py-2 items-center ${
                            isTotalRow(row.label) ? 'bg-slate-50' : ''
                        }`}
                    >
                        <span className={`text-xs ${isTotalRow(row.label) ? 'font-black text-slate-800' : 'font-semibold text-slate-500'}`}>
                            {row.label}
                        </span>
                        <span className={`text-xs text-center min-w-[7rem] ${isTotalRow(row.label) ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                            {row.value}
                        </span>
                        <span className={`text-xs text-end ${isTotalRow(row.label) ? 'font-black text-slate-800' : 'font-semibold text-slate-500'}`}>
                            <bdi dir="rtl">{row.labelAr}</bdi>
                        </span>
                    </div>
                ),
            )}
        </div>
    </div>
);

const MyPayslipDetail: React.FC = () => {
    const { t } = useTranslation();
    const { period = '' } = useParams();
    const [busy, setBusy] = React.useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['payslip', 'view', period],
        queryFn: () => payslipService.myView(period),
        enabled: !!period,
    });

    const download = async () => {
        setBusy(true);
        try {
            saveBlob(await payslipService.myDocument(period), `Payslip_${period}.docx`);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payslip_download_failed', { defaultValue: 'Could not produce your payslip.' }));
        } finally {
            setBusy(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <p className="text-sm text-slate-400 font-medium">{t('loading', 'Loading...')}</p>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-4">
                <p className="text-sm font-bold text-rose-600">
                    {(error as any)?.response?.data?.error
                        || t('payslip_view_failed', { defaultValue: 'That payslip could not be loaded.' })}
                </p>
                <Link to="/my-payslips" className="inline-flex items-center gap-2 text-[#511d29] font-bold text-sm">
                    <ArrowLeft size={15} className="rtl:rotate-180" />
                    {t('back_to_my_payslips', { defaultValue: 'Back to my payslips' })}
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5 animate-in fade-in duration-500">
            <Link to="/my-payslips" className="inline-flex items-center gap-2 text-slate-500 hover:text-[#511d29] font-bold text-xs">
                <ArrowLeft size={14} className="rtl:rotate-180" />
                {t('back_to_my_payslips', { defaultValue: 'Back to my payslips' })}
            </Link>

            {/* Header — the period, how far it has got, and the one number most people open this for. */}
            <div className="bg-white border border-[#511d29]/10 rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <Receipt size={20} className="text-[#511d29]" />
                        <h1 className="text-xl font-black text-slate-800">{data.periodLabel}</h1>
                        <span className="text-sm font-bold text-slate-400" dir="rtl">{data.monthNameArabic}</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            data.status === 'PAID' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                            {data.status === 'PAID'
                                ? <><Banknote size={11} /> {t('payslip_status_paid', { defaultValue: 'Paid' })}</>
                                : <><CheckCircle2 size={11} /> {t('payslip_status_approved', { defaultValue: 'Approved' })}</>}
                        </span>
                    </div>
                    {/* dir="ltr" or RTL reorders the range into end -> start. */}
                    <p className="text-xs text-slate-400 font-medium mt-1.5" dir="ltr">
                        {fmtDate(data.periodStart)} → {fmtDate(data.periodEnd)}
                    </p>
                </div>
                <div className="text-end">
                    <div className="text-2xl font-black text-slate-800">
                        {data.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {data.currency} · {t('payslip_net', { defaultValue: 'net salary' })}
                    </div>
                </div>
            </div>

            {data.sections.map(section => (
                <Section key={section.key} section={section} emphasise={section.key === 'net'} />
            ))}

            <button
                onClick={download}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-white border border-[#511d29]/20 text-[#511d29] px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#511d29]/5 disabled:opacity-40"
            >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {t('payslip_download', { defaultValue: 'Download the payslip' })}
            </button>

            <p className="text-xs text-slate-400 font-medium flex items-start gap-2">
                <Info size={13} className="mt-0.5 shrink-0" />
                {t('payslip_screen_note', {
                    defaultValue: 'These figures are read from the signed-off payroll period every time you open this screen. A month runs from the 25th to the 24th and is named after the month it ends in. For any question about your salary, email payroll@iph-ly.com.',
                })}
            </p>
        </div>
    );
};

export default MyPayslipDetail;
