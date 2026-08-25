import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '../../services/auditLogService';
import { Search, ScrollText, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const METHOD_STYLE: Record<string, string> = {
    POST: 'bg-emerald-100 text-emerald-700',
    PUT: 'bg-blue-100 text-blue-700',
    PATCH: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
};

const SystemLogs: React.FC = () => {
    const [searchInput, setSearchInput] = useState('');
    const [q, setQ] = useState('');
    const [method, setMethod] = useState('');
    const [page, setPage] = useState(1);
    const limit = 25;

    // Debounce the free-text search so we don't hit the API on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['audit-logs', q, method, page],
        queryFn: () => auditLogService.list({ q, method, page, limit }),
        placeholderData: (prev) => prev,
    });

    const logs = data?.logs || [];
    const total = data?.total || 0;
    const pages = data?.pages || 1;

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#511d29] text-white flex items-center justify-center shrink-0">
                        <ScrollText className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-outfit font-black text-slate-800 tracking-tight">System Activity Log</h1>
                        <p className="text-slate-500 text-sm font-medium">Every create, update and delete across the system — who did it and when.</p>
                    </div>
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{total.toLocaleString()} entries</span>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        placeholder="Search by user, action, role or path… (e.g. “admin deleted”)"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-[#511d29]/15 focus:border-[#511d29] transition-all"
                    />
                </div>
                <select
                    value={method}
                    onChange={e => { setMethod(e.target.value); setPage(1); }}
                    className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#511d29]/15"
                >
                    <option value="">All actions</option>
                    <option value="POST">Created</option>
                    <option value="PUT">Updated (PUT)</option>
                    <option value="PATCH">Updated (PATCH)</option>
                    <option value="DELETE">Deleted</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs md:text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                                <th className="p-4">When</th>
                                <th className="p-4">User</th>
                                <th className="p-4">Action</th>
                                <th className="p-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {isLoading ? (
                                <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold animate-pulse">Loading activity…</td></tr>
                            ) : isError ? (
                                <tr><td colSpan={4} className="p-10 text-center text-rose-600 font-bold">Failed to load the activity log.</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold">No matching activity.</td></tr>
                            ) : logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/60">
                                    <td className="p-4 whitespace-nowrap">
                                        <p className="font-bold text-slate-700">{format(parseISO(log.createdAt), 'dd MMM yyyy')}</p>
                                        <p className="text-[11px] text-slate-400">{format(parseISO(log.createdAt), 'HH:mm:ss')}</p>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-[#511d29] text-white flex items-center justify-center text-[11px] font-black shrink-0">
                                                {log.userName?.trim()?.charAt(0)?.toUpperCase() || <User className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-800 truncate">{log.userName || '—'}</p>
                                                {log.userRole && <p className="text-[10px] text-slate-400 uppercase tracking-wider">{log.userRole.replace(/_/g, ' ')}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mr-2 ${METHOD_STYLE[log.method] || 'bg-slate-100 text-slate-600'}`}>{log.method}</span>
                                        <span className="font-bold text-slate-700">{log.action}</span>
                                        {log.details && <span className="block text-[11px] text-[#8f6544] font-semibold mt-0.5">{log.details}</span>}
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[11px] text-slate-400 font-mono">{log.path}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <span className="text-[11px] font-bold text-slate-400">Page {page} of {pages}</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-40"
                            >
                                <ChevronLeft className="w-4 h-4" /> Prev
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pages, p + 1))}
                                disabled={page >= pages}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-40"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemLogs;
