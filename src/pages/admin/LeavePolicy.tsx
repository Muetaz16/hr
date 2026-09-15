import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarClock, Save } from 'lucide-react';
import { leavePolicyService, LEAVE_POLICY_DEFAULTS, type LeavePolicy } from '../../services/leavePolicyService';

// The leave policy numbers. These were literals in the code — in two files for the allowances,
// which is how the payslip and the leave form came to print different entitlements for the same
// person. They are regulation, not physics, so they belong here.
const LeavePolicyPage: React.FC = () => {
    const { t } = useTranslation();
    const [form, setForm] = useState<LeavePolicy>(LEAVE_POLICY_DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        leavePolicyService.get()
            .then(setForm)
            .catch(() => toast.error(t('failed_to_load_data', { defaultValue: 'Failed to load data.' })))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            setForm(await leavePolicyService.update(form));
            toast.success(t('saved_successfully', { defaultValue: 'Saved.' }));
        } catch (e: any) {
            toast.error(e?.response?.data?.error || t('failed_to_save', { defaultValue: 'Failed to save.' }));
        } finally {
            setSaving(false);
        }
    };

    const FIELDS: { key: keyof LeavePolicy; labelKey: string; label: string; hintKey: string; hint: string }[] = [
        {
            key: 'noticeDays', labelKey: 'policy_notice_days', label: 'Advance notice (days)',
            hintKey: 'policy_notice_days_hint',
            hint: 'Annual and Unpaid leave are normally filed this far ahead. Filing closer is still possible, but only with a written reason and the letter authorising it — and every approver is shown both. Emergency leave is exempt.',
        },
        {
            key: 'emergencyLeaveAllowance', labelKey: 'policy_emergency_allowance', label: 'Emergency leave (days per contract)',
            hintKey: 'policy_emergency_allowance_hint',
            hint: 'Reset at hire and at every renewal, never accrued. Also printed on the leave form as the entitlement.',
        },
        {
            key: 'unpaidLeaveAllowance', labelKey: 'policy_unpaid_allowance', label: 'Unpaid leave (days per contract)',
            hintKey: 'policy_unpaid_allowance_hint',
            hint: 'Reset at hire and at every renewal, never accrued. Also printed on the leave form and the payslip.',
        },
    ];

    if (loading) return <div className="p-12 text-center animate-pulse text-slate-400">{t('loading', { defaultValue: 'Loading…' })}</div>;

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#511d29]/5 border border-[#511d29]/10 flex items-center justify-center">
                    <CalendarClock className="w-6 h-6 text-[#511d29]" />
                </div>
                <div>
                    <h1 className="text-3xl font-outfit font-black text-slate-800 tracking-tight">
                        {t('leave_policy', { defaultValue: 'Leave Policy' })}
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-0.5">
                        {t('leave_policy_sub', { defaultValue: 'Applies to new requests. Requests already filed keep the numbers that were in force when they were filed.' })}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-6 shadow-sm">
                {FIELDS.map(f => (
                    <div key={f.key} className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                            {t(f.labelKey, { defaultValue: f.label })}
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={365}
                            value={form[f.key]}
                            onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) })}
                            className="w-40 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-800 font-bold focus:ring-2 focus:ring-[#aa7a51]/20"
                        />
                        <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                            {t(f.hintKey, { defaultValue: f.hint })}
                        </p>
                    </div>
                ))}

                <button
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-[#511d29] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-[#3f1620] transition-colors disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? t('saving', { defaultValue: 'Saving…' }) : t('save', { defaultValue: 'Save' })}
                </button>
            </div>
        </div>
    );
};

export default LeavePolicyPage;
