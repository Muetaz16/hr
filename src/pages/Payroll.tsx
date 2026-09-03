import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet } from 'lucide-react';

// Empty scaffold — the real Payroll screens land here later (see project_payroll_section memory).
// Deliberately its own page/nav item, separate from Attendance.
const PayrollPage: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight">
                        {t('payroll', { defaultValue: 'Payroll' })}
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        {t('payroll_subtitle', { defaultValue: 'Payroll processing and review.' })}
                    </p>
                </div>
            </div>

            <div className="bg-white border border-[#511d29]/10 rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#511d29]/5 text-[#511d29] flex items-center justify-center">
                    <Wallet className="w-7 h-7" />
                </div>
                <p className="text-base font-black text-slate-700">{t('payroll_coming_soon', { defaultValue: 'Payroll is coming soon' })}</p>
                <p className="text-sm text-slate-400 font-medium max-w-md">
                    {t('payroll_coming_soon_desc', { defaultValue: 'This section is not built yet — check back once it is ready.' })}
                </p>
            </div>
        </div>
    );
};

export default PayrollPage;
