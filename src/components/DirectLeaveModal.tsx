import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Paperclip, AlertTriangle, Search } from 'lucide-react';
import { staffHubService } from '../services/staffHubService';
import { employeeService } from '../services/employeeService';
import type { Employee } from '../types';

// Recording a leave that senior management already granted on paper.
//
// This bypasses the notice period, the balance check and the whole approval chain, so the form is
// deliberately not a quick one: an employee, a type, the dates, a written justification, an explicit
// answer on the balance, and the signed authorisation. The server re-checks every one of these — the
// document especially — so nothing here is the only thing standing between a click and paid leave.

const LEAVE_TYPES = [
    { value: 'PAID_HOLIDAY', labelKey: 'leave_paid_holiday', defaultLabel: 'Paid Leave' },
    { value: 'EMERGENCY_LEAVE', labelKey: 'leave_emergency', defaultLabel: 'Emergency Leave' },
    { value: 'UNPAID_LEAVE', labelKey: 'leave_unpaid', defaultLabel: 'Unpaid Leave' },
];

const countDays = (start: string, end: string) => {
    if (!start) return 0;
    const s = new Date(`${start}T00:00:00`).getTime();
    const e = new Date(`${(end || start)}T00:00:00`).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
    return Math.round((e - s) / 86400000) + 1;
};

interface Props {
    onClose: () => void;
    onRecorded: () => void;
}

const DirectLeaveModal: React.FC<Props> = ({ onClose, onRecorded }) => {
    const { t } = useTranslation();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [empSearch, setEmpSearch] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [type, setType] = useState('PAID_HOLIDAY');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [deduct, setDeduct] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        employeeService.getAllEmployees().then(setEmployees).catch(() => setEmployees([]));
    }, []);

    const matches = useMemo(() => {
        const q = empSearch.trim().toLowerCase();
        if (!q) return [];
        return employees
            .filter(e => (e.fullName || '').toLowerCase().includes(q) || (e.staffId || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [employees, empSearch]);

    const chosen = employees.find(e => e.id === employeeId) || null;
    const days = countDays(startDate, endDate);

    const submit = async () => {
        if (!employeeId) return toast.error(t('dl_err_employee', { defaultValue: 'Choose the employee this leave is for.' }));
        if (!startDate) return toast.error(t('dl_err_start', { defaultValue: 'Set the first day of the leave.' }));
        if (endDate && endDate < startDate) return toast.error(t('dl_err_range', { defaultValue: 'The end date falls before the start date.' }));
        if (!reason.trim()) return toast.error(t('dl_err_reason', { defaultValue: 'Describe why this leave was granted outside the normal process.' }));
        if (!file) return toast.error(t('dl_err_document', { defaultValue: 'Attach the authorisation signed by senior management.' }));

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('employeeId', employeeId);
            fd.append('type', type);
            fd.append('startDate', startDate);
            if (endDate) fd.append('endDate', endDate);
            fd.append('reason', reason.trim());
            fd.append('deductFromBalance', String(deduct));
            fd.append('attachment', file);
            const res = await staffHubService.recordDirectLeave(fd);
            // The attendance write is fail-soft on the server, so a success here can still mean the
            // days did not reach the attendance system. Say so rather than report a clean save.
            if (res.attendanceWarning) toast.warning(res.attendanceWarning, { duration: 10000 });
            else toast.success(t('dl_recorded', { defaultValue: 'Leave recorded.' }));
            onRecorded();
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('dl_err_failed', { defaultValue: 'Failed to record the leave.' }));
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-2xl my-8 shadow-2xl">
                <div className="flex items-start justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-black text-[#511d29]">{t('dl_title', { defaultValue: 'Record a Leave Directly' })}</h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            {t('dl_subtitle', { defaultValue: 'For a leave senior management already granted on paper. No notice period, no balance check, no approval chain.' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Employee */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('employee', { defaultValue: 'Employee' })}</label>
                        {chosen ? (
                            <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4">
                                <div>
                                    <div className="font-bold text-slate-800">{chosen.fullName}</div>
                                    <div className="text-xs font-mono text-slate-400">{chosen.staffId}</div>
                                </div>
                                <button onClick={() => { setEmployeeId(''); setEmpSearch(''); }} className="text-xs font-black text-[#aa7a51] uppercase tracking-widest">
                                    {t('change', { defaultValue: 'Change' })}
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    autoFocus
                                    value={empSearch}
                                    onChange={e => setEmpSearch(e.target.value)}
                                    placeholder={t('search_name_or_code', { defaultValue: 'Search name or staff code…' })}
                                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20"
                                />
                                {matches.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                                        {matches.map(e => (
                                            <button
                                                key={e.id}
                                                onClick={() => { setEmployeeId(e.id); setEmpSearch(''); }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="font-bold text-sm text-slate-800">{e.fullName}</div>
                                                <div className="text-xs font-mono text-slate-400">{e.staffId}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('type', { defaultValue: 'Type' })}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {LEAVE_TYPES.map(o => (
                                <button
                                    key={o.value}
                                    onClick={() => setType(o.value)}
                                    className={`rounded-2xl border p-3 text-sm font-bold transition-all ${type === o.value ? 'border-[#aa7a51] bg-[#aa7a51]/10 text-[#511d29]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-[#aa7a51]/40'}`}
                                >
                                    {t(o.labelKey, { defaultValue: o.defaultLabel })}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('start_date', { defaultValue: 'From' })}</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('end_date', { defaultValue: 'To' })}</label>
                            <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                    </div>
                    {days > 0 && (
                        <p className="text-xs font-bold text-slate-500">
                            {t('dl_day_count', { count: days, days, defaultValue: '{{days}} day(s)' })}
                        </p>
                    )}

                    {/* Balance — the whole reason this screen exists, so it is a visible choice, not a
                        checkbox tucked at the bottom. */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('dl_balance', { defaultValue: 'The Employee’s Balance' })}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setDeduct(true)}
                                className={`rounded-2xl border p-3 text-sm font-bold transition-all ${deduct ? 'border-[#aa7a51] bg-[#aa7a51]/10 text-[#511d29]' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                            >
                                {t('dl_deduct', { defaultValue: 'Deduct these days' })}
                            </button>
                            <button
                                onClick={() => setDeduct(false)}
                                className={`rounded-2xl border p-3 text-sm font-bold transition-all ${!deduct ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                            >
                                {t('dl_no_deduct', { defaultValue: 'Do not deduct' })}
                            </button>
                        </div>
                        {!deduct && (
                            <p className="text-xs text-amber-600/90 font-medium leading-relaxed">
                                {t('dl_no_deduct_hint', { defaultValue: 'The leave is still recorded in attendance — it simply is not charged against the employee. Use this for a granted case such as a serious illness.' })}
                            </p>
                        )}
                    </div>

                    {/* Justification */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('dl_reason', { defaultValue: 'Why it was granted outside the process' })}</label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder={t('dl_reason_ph', { defaultValue: 'Who granted it and on what grounds…' })}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 h-24"
                        />
                    </div>

                    {/* The authorisation */}
                    <div className="space-y-2">
                        <label className={`text-xs font-bold uppercase tracking-widest ${file ? 'text-slate-400' : 'text-amber-600'}`}>
                            {file
                                ? t('dl_document', { defaultValue: 'Signed Authorisation' })
                                : t('dl_document_required', { defaultValue: 'Signed Authorisation — required' })}
                        </label>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            {t('dl_document_hint', { defaultValue: 'This record will have no approval chain behind it. The signed document is its only authority, and it cannot be attached later.' })}
                        </p>
                        {file ? (
                            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                                <span className="text-sm font-bold text-emerald-800 truncate">{file.name}</span>
                                <button onClick={() => setFile(null)} className="text-xs font-black text-emerald-700 uppercase tracking-widest">{t('remove', { defaultValue: 'Remove' })}</button>
                            </div>
                        ) : (
                            <label className="flex items-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-[#aa7a51]/40 transition-colors">
                                <Paperclip className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-bold text-slate-500">{t('choose_file', { defaultValue: 'Choose a file' })}</span>
                                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                            </label>
                        )}
                    </div>

                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-amber-800 leading-relaxed">
                            {t('dl_warning', { defaultValue: 'This is recorded as already approved and sent to the attendance system immediately. It cannot be sent back for approval afterwards.' })}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
                    <button onClick={onClose} className="px-5 py-3 text-sm font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-colors">
                        {t('cancel', { defaultValue: 'Cancel' })}
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className="px-6 py-3 bg-[#511d29] text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-[#3d1620] transition-colors disabled:opacity-50"
                    >
                        {saving ? t('saving', { defaultValue: 'Saving…' }) : t('dl_record', { defaultValue: 'Record the Leave' })}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default DirectLeaveModal;
