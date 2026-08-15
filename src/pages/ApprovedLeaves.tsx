import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CheckCircle2, Search, CalendarDays, RefreshCw, ClipboardCheck, FileDown } from 'lucide-react';
import { staffHubService, type LeaveRequestWithEmployee } from '../services/staffHubService';
import { SERVER_URL } from '../services/apiClient';

// Fetch the filled Leave Request Form (.docx) and trigger a browser download.
const downloadLeaveForm = async (requestId: string, employeeName?: string) => {
    try {
        const blob = await staffHubService.getLeaveForm(requestId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Leave_Request_${(employeeName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (err: any) {
        let msg = 'Failed to generate the leave form.';
        const data = err?.response?.data;
        if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
        toast.error(msg);
    }
};

// Inclusive day count — mirrors the backend's countLeaveDays so the figure shown here matches
// what was deducted from the employee's balance and written to the attendance system.
const countDays = (start: string, end?: string) => {
    const s = new Date(start);
    const e = end ? new Date(end) : s;
    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};

const fmtDate = (d?: string) => (d ? new Date(d).toISOString().split('T')[0] : '—');

const TYPE_META: Record<string, { label: string; className: string }> = {
    PAID_HOLIDAY: { label: 'Paid Leave', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    EMERGENCY_LEAVE: { label: 'Emergency Leave', className: 'bg-rose-50 text-rose-700 border-rose-200' },
    UNPAID_LEAVE: { label: 'Unpaid Leave', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    LATE_COMING: { label: 'Late Coming', className: 'bg-slate-50 text-slate-700 border-slate-200' },
    EARLY_LEAVING: { label: 'Early Leaving', className: 'bg-slate-50 text-slate-700 border-slate-200' },
    HOURS_LEAVE: { label: 'Hours Leave', className: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const ApprovedLeaves: React.FC = () => {
    const { t } = useTranslation();
    const [leaves, setLeaves] = useState<LeaveRequestWithEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');

    const load = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await staffHubService.getApprovedLeaves();
            setLeaves(Array.isArray(data) ? data : []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return leaves.filter(l => {
            if (typeFilter !== 'ALL' && l.type !== typeFilter) return false;
            if (!q) return true;
            const name = l.employee?.fullName?.toLowerCase() || '';
            const code = l.employee?.staffId?.toLowerCase() || '';
            return name.includes(q) || code.includes(q);
        });
    }, [leaves, search, typeFilter]);

    const totalDays = useMemo(() => filtered.reduce((sum, l) => sum + countDays(l.startDate, l.endDate), 0), [filtered]);

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight flex items-center gap-3">
                        <ClipboardCheck className="w-8 h-8" />
                        {t('approved_leaves', { defaultValue: 'Approved Leaves' })}
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        {t('approved_leaves_subtitle', { defaultValue: 'Every leave request that has passed its full approval chain — automatically recorded in the attendance system.' })}
                    </p>
                </div>
                <button
                    onClick={load}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#511d29]/20 text-[#511d29] text-xs font-black uppercase tracking-widest hover:bg-[#511d29]/5 transition-colors rounded-lg"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {t('refresh', { defaultValue: 'Refresh' })}
                </button>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white border border-[#511d29]/10 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('approved_count', { defaultValue: 'Approved Leaves' })}</p>
                    <p className="text-3xl font-black text-[#511d29] mt-1">{filtered.length}</p>
                </div>
                <div className="bg-white border border-[#511d29]/10 rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('total_leave_days', { defaultValue: 'Total Days' })}</p>
                    <p className="text-3xl font-black text-[#511d29] mt-1">{totalDays}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm flex items-center gap-3 col-span-2 md:col-span-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                    <p className="text-xs font-bold text-emerald-800">{t('synced_to_attendance', { defaultValue: 'Approved leaves are pushed to the attendance system automatically.' })}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('search_name_or_code', { defaultValue: 'Search name or staff code…' })}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-[#511d29]/15 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-[#511d29]/10 focus:border-[#511d29]/40 transition-all"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="px-4 py-3 bg-white border border-[#511d29]/15 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-[#511d29]/10"
                >
                    <option value="ALL">{t('all_types', { defaultValue: 'All Types' })}</option>
                    <option value="PAID_HOLIDAY">{TYPE_META.PAID_HOLIDAY.label}</option>
                    <option value="EMERGENCY_LEAVE">{TYPE_META.EMERGENCY_LEAVE.label}</option>
                    <option value="UNPAID_LEAVE">{TYPE_META.UNPAID_LEAVE.label}</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#511d29]/5 border-b border-[#511d29]/10">
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider">{t('employee', { defaultValue: 'Employee' })}</th>
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider">{t('type', { defaultValue: 'Type' })}</th>
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider">{t('period', { defaultValue: 'Period' })}</th>
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider text-center">{t('days', { defaultValue: 'Days' })}</th>
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider">{t('approved_on', { defaultValue: 'Approved On' })}</th>
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider">{t('reason', { defaultValue: 'Reason' })}</th>
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider text-center">{t('gm_document', { defaultValue: 'GM Document' })}</th>
                                <th className="p-4 text-xs font-black text-[#511d29] uppercase tracking-wider text-center">{t('form', { defaultValue: 'Form' })}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(l => {
                                const meta = TYPE_META[l.type] || { label: l.type.replace(/_/g, ' '), className: 'bg-slate-50 text-slate-700 border-slate-200' };
                                return (
                                    <tr key={l.id} className="hover:bg-[#511d29]/[0.02] transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{l.employee?.fullName || '—'}</div>
                                            {l.employee?.staffId && <div className="text-xs font-mono text-slate-400 mt-0.5">{l.employee.staffId}</div>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black border ${meta.className}`}>{meta.label}</span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-slate-700">
                                            <div className="inline-flex items-center gap-1.5">
                                                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                {fmtDate(l.startDate)}{l.endDate && l.endDate !== l.startDate ? ` → ${fmtDate(l.endDate)}` : ''}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center font-black text-[#511d29]">{countDays(l.startDate, l.endDate)}</td>
                                        <td className="p-4 text-sm font-bold text-slate-600">{fmtDate(l.updatedAt || l.createdAt)}</td>
                                        <td className="p-4 text-sm text-slate-500 max-w-xs truncate" title={l.reason || ''}>{l.reason || '—'}</td>
                                        <td className="p-4 text-center">
                                            {l.finalDocumentUrl ? (
                                                <a
                                                    href={`${SERVER_URL}${l.finalDocumentUrl}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={l.finalDocumentName || t('gm_document', { defaultValue: 'GM Document' })}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black rounded-lg hover:bg-emerald-100 transition-colors"
                                                >
                                                    <FileDown className="w-3.5 h-3.5" /> {t('view', { defaultValue: 'View' })}
                                                </a>
                                            ) : (
                                                <span className="text-xs text-slate-300 font-bold">—</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => downloadLeaveForm(l.id, l.employee?.fullName)}
                                                title={t('download_leave_form', { defaultValue: 'Download Leave Request Form' })}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#511d29]/5 border border-[#511d29]/20 text-[#511d29] text-xs font-black rounded-lg hover:bg-[#511d29]/10 transition-colors"
                                            >
                                                <FileDown className="w-3.5 h-3.5" /> {t('form', { defaultValue: 'Form' })}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && filtered.length === 0 && !error && (
                                <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-bold">{t('no_approved_leaves', { defaultValue: 'No approved leaves yet.' })}</td></tr>
                            )}
                            {loading && (
                                <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-bold animate-pulse">{t('loading', { defaultValue: 'Loading…' })}</td></tr>
                            )}
                            {error && (
                                <tr><td colSpan={8} className="p-12 text-center text-rose-600 font-bold">{t('failed_to_load', { defaultValue: 'Failed to load approved leaves.' })}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ApprovedLeaves;
