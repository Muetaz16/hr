import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { History, ChevronDown, ChevronUp, Pencil, Ban, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Modal from './Modal';
import { attendanceService, type OvertimeApprovalRecord } from '../services/attendanceService';
import { formatMinutesAsHM } from '../utils/attendanceFormat';
import { periodLabel, recentPeriods } from '../utils/payrollLabels';

// Every overtime approval this system has recorded, and the only two ways it can be changed.
//
// WHAT "DELETE" CAN MEAN HERE, measured against the live attendance service: nothing is ever
// removed. `/api/attendance/overtimes` is POST-only — there is no delete endpoint, unlike every
// comparable entity. Re-posting the SAME period upserts, so:
//
//   · Edit   → re-post with new hours. Verified: 5h became 2h on the same record.
//   · Revoke → re-post with zero. Verified: the record REMAINS at 00:00:00 and pays nothing.
//
// So the button says Revoke, not Delete, and the screen says the record survives at zero. Calling
// it a deletion would be a lie that only surfaces when somebody goes looking in the attendance
// system and finds the row still there.
//
// Our own log is append-only: a change marks the old row SUPERSEDED and writes a new one. The
// history is therefore complete, which matters because it is the only place the exact period can
// be found again — and the exact period is the sole handle for correcting an approval.

const STATUS_STYLE: Record<string, string> = {
    APPLIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REVOKED: 'bg-slate-100 text-slate-500 border-slate-200',
    SUPERSEDED: 'bg-slate-100 text-slate-400 border-slate-200',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
};

interface Props {
    /** False for a read-only holder: they may read the archive but not change an approval. */
    canApprove?: boolean;
}

const OvertimeArchive: React.FC<Props> = ({ canApprove = false }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const PERIODS = useMemo(() => recentPeriods(12), []);
    const [period, setPeriod] = useState<string>(PERIODS[0]);
    const [search, setSearch] = useState('');
    const [collapsed, setCollapsed] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const [editing, setEditing] = useState<OvertimeApprovalRecord | null>(null);
    const [revoking, setRevoking] = useState<OvertimeApprovalRecord | null>(null);
    const [hours, setHours] = useState('0');
    const [minutes, setMinutes] = useState('0');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['overtime-approvals', period],
        queryFn: () => attendanceService.getOvertimeApprovals(period === 'all' ? {} : { period }),
        retry: false,
    });

    const rows = data?.approvals || [];
    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return rows
            // A superseded row is the previous value of something already shown; keeping both by
            // default would double every edited approval and make the totals unreadable.
            .filter(r => showHistory || r.status !== 'SUPERSEDED')
            .filter(r => !needle || r.empCode.toLowerCase().includes(needle) || r.reason.toLowerCase().includes(needle));
    }, [rows, search, showHistory]);

    const openEdit = (r: OvertimeApprovalRecord) => {
        setEditing(r);
        setHours(String(Math.floor(r.minutes / 60)));
        setMinutes(String(r.minutes % 60));
        setReason('');
    };

    const submitEdit = async () => {
        if (!editing) return;
        if (reason.trim().length < 3) { toast.error(t('ot_change_reason_required', { defaultValue: 'Say why this is changing.' })); return; }
        setBusy(true);
        try {
            await attendanceService.editOvertimeApproval(editing.id, {
                hours: Number(hours) || 0, minutes: Number(minutes) || 0, reason: reason.trim(),
            });
            toast.success(t('ot_approval_changed', { defaultValue: 'The approved hours were changed.' }));
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ['overtime-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['overtime-report'] });
        } catch (e: any) {
            toast.error(e?.response?.data?.error || t('failed_to_save', { defaultValue: 'Failed to save.' }));
        } finally {
            setBusy(false);
        }
    };

    const submitRevoke = async () => {
        if (!revoking) return;
        if (reason.trim().length < 3) { toast.error(t('ot_change_reason_required', { defaultValue: 'Say why this is changing.' })); return; }
        setBusy(true);
        try {
            await attendanceService.revokeOvertimeApproval(revoking.id, { reason: reason.trim() });
            toast.success(t('ot_approval_revoked', { defaultValue: 'The approval was revoked — it now pays nothing.' }));
            setRevoking(null);
            queryClient.invalidateQueries({ queryKey: ['overtime-approvals'] });
            queryClient.invalidateQueries({ queryKey: ['overtime-report'] });
        } catch (e: any) {
            toast.error(e?.response?.data?.error || t('failed_to_save', { defaultValue: 'Failed to save.' }));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
            <div className={`p-4 bg-slate-50/50 space-y-3 ${collapsed ? '' : 'border-b border-[#511d29]/10'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-black text-[#511d29] uppercase tracking-wider inline-flex items-center gap-2">
                        <History className="w-4 h-4" />
                        {t('ot_archive', { defaultValue: 'Approved Overtime — Archive' })}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={period} onChange={e => setPeriod(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold">
                            {PERIODS.map((p, i) => (
                                <option key={p} value={p}>
                                    {periodLabel(p, t)}{i === 0 ? ` — ${t('current_period', { defaultValue: 'current' })}` : ''}
                                </option>
                            ))}
                            <option value="all">{t('all_periods', { defaultValue: 'All periods' })}</option>
                        </select>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t('search_code_or_reason', { defaultValue: 'Search code or reason...' })}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold w-44" />
                        <button onClick={() => setShowHistory(h => !h)}
                            className={`px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors border ${showHistory ? 'bg-[#511d29] text-white border-[#511d29]' : 'bg-white border-[#511d29]/20 text-[#511d29] hover:bg-slate-100'}`}>
                            {t('ot_show_history', { defaultValue: 'Show earlier versions' })}
                        </button>
                        <button onClick={() => setCollapsed(c => !c)}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg font-black text-[10px] uppercase tracking-widest text-[#511d29] hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5">
                            {collapsed ? <><ChevronDown className="w-3 h-3" />{t('show_list', { defaultValue: 'Show list' })}</>
                                : <><ChevronUp className="w-3 h-3" />{t('hide_list', { defaultValue: 'Hide list' })}</>}
                        </button>
                    </div>
                </div>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    {t('ot_archive_sub', {
                        defaultValue: 'Every approval recorded, with who authorised it. Hours can be changed, and an approval can be revoked so it pays nothing — but nothing is ever removed: the attendance system has no delete for overtime, so a revoked approval stays there at zero.',
                    })}
                </p>
            </div>

            {isError && (
                <div className="p-10 text-center">
                    <p className="text-sm font-bold text-rose-600">{t('failed_to_load_data', { defaultValue: 'Failed to load data.' })}</p>
                </div>
            )}

            {!isError && !collapsed && (
                <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse text-xs md:text-sm">
                        <thead>
                            <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                <th className="p-3 text-start">{t('staff_code', { defaultValue: 'Staff Code' })}</th>
                                <th className="p-3 text-start">{t('ot_period', { defaultValue: 'Period' })}</th>
                                <th className="p-3 text-start">{t('ot_approved_hours', { defaultValue: 'Approved' })}</th>
                                <th className="p-3 text-start">{t('reason', { defaultValue: 'Reason' })}</th>
                                <th className="p-3 text-start">{t('by', { defaultValue: 'By' })}</th>
                                <th className="p-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                            {visible.map(r => {
                                const superseded = r.status === 'SUPERSEDED';
                                return (
                                    <tr key={r.id} className={`hover:bg-slate-50/50 align-top ${superseded ? 'opacity-50' : ''}`}>
                                        <td className="p-3 font-mono text-[11px]">{r.empCode}</td>
                                        <td className="p-3 whitespace-nowrap">
                                            {/* dir="ltr": a date range reads left-to-right on an RTL page too. */}
                                            <span dir="ltr" className="font-mono text-[11px]">{r.startDate} → {r.endDate}</span>
                                            <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{r.period}</span>
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            <span className={`font-bold ${r.minutes > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {formatMinutesAsHM(r.minutes)}
                                            </span>
                                            <span className={`block mt-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase w-fit ${STATUS_STYLE[r.status] || STATUS_STYLE.SUPERSEDED}`}>
                                                {r.status === 'APPLIED' ? t('status_applied', { defaultValue: 'applied' })
                                                    : r.status === 'REVOKED' ? t('ot_status_revoked', { defaultValue: 'revoked' })
                                                        : r.status === 'FAILED' ? t('status_failed', { defaultValue: 'did not go through' })
                                                            : t('status_superseded', { defaultValue: 'superseded' })}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-xs">
                                            <span dir="auto" className="text-[11px]">{r.reason}</span>
                                            {r.headName && (
                                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                                    {t('ot_authorised_by', { defaultValue: 'authorised by {{name}}', name: r.headName })}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            <span className="font-bold text-[11px] block">{r.createdByName || '—'}</span>
                                            <span className="text-[10px] text-slate-400">
                                                <bdi>{format(parseISO(r.appliedAt), 'dd MMM yyyy HH:mm')}</bdi>
                                            </span>
                                        </td>
                                        <td className="p-3 text-end whitespace-nowrap">
                                            {/* Only the CURRENT value of a period can be acted on — editing a
                                                superseded row would re-post an older figure over the newer one. */}
                                            {canApprove && !superseded && r.status !== 'FAILED' && (
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button onClick={() => openEdit(r)}
                                                        className="px-2.5 py-1.5 bg-white border border-[#511d29]/20 text-[#511d29] rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors inline-flex items-center gap-1">
                                                        <Pencil className="w-3 h-3" /> {t('edit', { defaultValue: 'Edit' })}
                                                    </button>
                                                    {r.minutes > 0 && (
                                                        <button onClick={() => { setRevoking(r); setReason(''); }}
                                                            className="px-2.5 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-colors inline-flex items-center gap-1">
                                                            <Ban className="w-3 h-3" /> {t('ot_revoke', { defaultValue: 'Revoke' })}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {isLoading && (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold animate-pulse">{t('loading', { defaultValue: 'Loading…' })}</td></tr>
                            )}
                            {!isLoading && visible.length === 0 && (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold">
                                    {t('ot_no_approvals', { defaultValue: 'No overtime has been approved in this period.' })}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={!!editing} onClose={() => setEditing(null)} maxWidth="max-w-md"
                title={t('ot_edit_approval', { defaultValue: 'Change the approved hours' })}>
                {editing && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="font-mono text-xs font-bold">{editing.empCode}</p>
                            <p dir="ltr" className="font-mono text-[11px] text-slate-500 mt-0.5">{editing.startDate} → {editing.endDate}</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                {t('ot_currently', { defaultValue: 'Currently {{time}}', time: formatMinutesAsHM(editing.minutes) })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" min={0} value={hours} onChange={e => setHours(e.target.value)}
                                className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                            <span className="text-xs font-bold text-slate-400">{t('hours', { defaultValue: 'hours' })}</span>
                            <input type="number" min={0} max={59} value={minutes} onChange={e => setMinutes(e.target.value)}
                                className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold" />
                            <span className="text-xs font-bold text-slate-400">{t('minutes', { defaultValue: 'minutes' })}</span>
                        </div>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                            placeholder={t('ot_change_reason_placeholder', { defaultValue: 'Why is this changing' })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" />
                        <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
                            {t('ot_edit_note', {
                                defaultValue: 'The same period is re-sent with the new figure, which replaces the old one in the attendance system. The previous value is kept here as history.',
                            })}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditing(null)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">
                                {t('cancel', { defaultValue: 'Cancel' })}
                            </button>
                            <button onClick={submitEdit} disabled={busy}
                                className="px-5 py-2.5 bg-[#511d29] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] disabled:opacity-50">
                                {busy ? t('saving', { defaultValue: 'Saving…' }) : t('save', { defaultValue: 'Save' })}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!revoking} onClose={() => setRevoking(null)} maxWidth="max-w-md"
                title={t('ot_revoke_approval', { defaultValue: 'Revoke this approval' })}>
                {revoking && (
                    <div className="space-y-4">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1">
                            <p className="font-mono text-xs font-bold">{revoking.empCode}</p>
                            <p dir="ltr" className="font-mono text-[11px] text-rose-700">{revoking.startDate} → {revoking.endDate}</p>
                            <p className="text-xs font-bold text-rose-800">
                                {t('ot_revoke_effect', {
                                    defaultValue: '{{time}} will no longer be paid.', time: formatMinutesAsHM(revoking.minutes),
                                })}
                            </p>
                        </div>
                        {/* Said plainly, because the alternative is somebody later finding the row still
                            present in the attendance system and concluding the revoke did not work. */}
                        <p className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0 text-slate-500" />
                            {t('ot_revoke_note', {
                                defaultValue: 'The approval is set to zero, not deleted. The attendance system has no delete for overtime, so the record stays there showing 0 — it simply pays nothing.',
                            })}
                        </p>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                            placeholder={t('ot_change_reason_placeholder', { defaultValue: 'Why is this changing' })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setRevoking(null)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">
                                {t('cancel', { defaultValue: 'Cancel' })}
                            </button>
                            <button onClick={submitRevoke} disabled={busy}
                                className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50">
                                {busy ? t('saving', { defaultValue: 'Saving…' }) : t('ot_revoke', { defaultValue: 'Revoke' })}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default OvertimeArchive;
