import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { History, Lock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { attendanceService, type PunchCorrectionRecord } from '../services/attendanceService';
import { formatMinutesAsHM } from '../utils/attendanceFormat';
import { periodLabel, recentPeriods } from '../utils/payrollLabels';

// Every punch this system has changed, and who changed it.
//
// This is the accountability half of the correction feature: a correction moves money, so the
// record of it has to be somewhere a person can actually look, not only in the database. It is
// APPEND-ONLY by design — there is no edit and no delete here, and none server-side either. A
// wrong correction is answered by recording another one, which is also the literal truth of what
// happened: the attendance service cannot write an `Overtime Out` back through our whitelist, so
// "undo" is not a thing that exists.
//
// Distinct from the Manual Transactions table below it, which lists punches BioTime itself
// considers hand-entered. This one carries what that table cannot: the reason, the person, the
// before/after, and whether the payroll run for that month had already closed.

const STATUS_STYLE: Record<string, string> = {
    APPLIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
    SUPERSEDED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const PunchCorrectionArchive: React.FC = () => {
    const { t } = useTranslation();
    const PERIODS = useMemo(() => recentPeriods(12), []);
    const [period, setPeriod] = useState<string>(PERIODS[0]);
    const [search, setSearch] = useState('');

    const { data, isLoading, isError } = useQuery({
        queryKey: ['punch-corrections', period],
        queryFn: () => attendanceService.getPunchCorrections(period === 'all' ? {} : { period }),
        retry: false,
    });

    const rows: PunchCorrectionRecord[] = data?.corrections || [];
    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter(r => r.empCode.toLowerCase().includes(needle) || r.reason.toLowerCase().includes(needle));
    }, [rows, search]);

    /** "17:05 Check In → Check Out", or the add/delete equivalent. */
    const describe = (r: PunchCorrectionRecord) => {
        if (r.action === 'ADD') return `+ ${r.afterTime} ${r.afterState}`;
        if (r.action === 'DELETE') return `− ${r.beforeTime} ${r.beforeState}`;
        const moved = r.afterTime && r.beforeTime && r.afterTime !== r.beforeTime;
        return `${r.beforeTime} ${r.beforeState} → ${moved ? `${r.afterTime} ` : ''}${r.afterState}`;
    };

    return (
        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-black text-[#511d29] uppercase tracking-wider inline-flex items-center gap-2">
                        <History className="w-4 h-4" />
                        {t('corrected_punches_archive', { defaultValue: 'Corrected Punches' })}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={period}
                            onChange={e => setPeriod(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold"
                        >
                            {PERIODS.map((p, i) => (
                                <option key={p} value={p}>
                                    {periodLabel(p, t)}{i === 0 ? ` — ${t('current_period', { defaultValue: 'current' })}` : ''}
                                </option>
                            ))}
                            <option value="all">{t('all_periods', { defaultValue: 'All periods' })}</option>
                        </select>
                        <input
                            type="text"
                            placeholder={t('search_code_or_reason', { defaultValue: 'Search code or reason...' })}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold w-44"
                        />
                    </div>
                </div>
                <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    {t('corrected_punches_archive_sub', {
                        defaultValue: 'Every punch this system changed, with the reason and the person who changed it. Nothing here can be edited or removed — a mistake is answered by recording another correction.',
                    })}
                </p>
            </div>

            {isError && (
                <div className="p-10 text-center">
                    <p className="text-sm font-bold text-rose-600">{t('failed_to_load_data', { defaultValue: 'Failed to load data.' })}</p>
                </div>
            )}

            {!isError && (
                <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse text-xs md:text-sm">
                        <thead>
                            <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                <th className="p-3 text-start">{t('staff_code', { defaultValue: 'Staff Code' })}</th>
                                <th className="p-3 text-start">{t('date', { defaultValue: 'Date' })}</th>
                                <th className="p-3 text-start">{t('what_changed', { defaultValue: 'What changed' })}</th>
                                <th className="p-3 text-start">{t('worked', { defaultValue: 'Worked' })}</th>
                                <th className="p-3 text-start">{t('reason', { defaultValue: 'Reason' })}</th>
                                <th className="p-3 text-start">{t('by', { defaultValue: 'By' })}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                            {visible.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50/50 align-top">
                                    <td className="p-3 font-mono text-[11px]">{r.empCode}</td>
                                    <td className="p-3 whitespace-nowrap">
                                        <bdi className="font-bold">{format(parseISO(r.workDate), 'dd MMM yyyy')}</bdi>
                                        <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{r.period}</span>
                                    </td>
                                    <td className="p-3">
                                        {/* dir="ltr": clock times and the arrow read left-to-right even on an RTL page. */}
                                        <span dir="ltr" className="font-mono text-[11px] whitespace-nowrap inline-block">{describe(r)}</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${STATUS_STYLE[r.status] || STATUS_STYLE.SUPERSEDED}`}>
                                                {r.status === 'APPLIED' ? t('status_applied', { defaultValue: 'applied' })
                                                    : r.status === 'FAILED' ? t('status_failed', { defaultValue: 'did not go through' })
                                                        : t('status_superseded', { defaultValue: 'superseded' })}
                                            </span>
                                            {!r.wasManual && (
                                                <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-600 text-[9px] font-black uppercase">
                                                    {t('from_the_terminal', { defaultValue: 'from the terminal' })}
                                                </span>
                                            )}
                                            {/* The money signal: this correction can never enter the run it belongs to. */}
                                            {r.payrollWasLocked && (
                                                <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700 text-[9px] font-black uppercase inline-flex items-center gap-1">
                                                    <Lock className="w-2.5 h-2.5" />
                                                    {t('run_was_closed', { defaultValue: 'run already closed' })}
                                                </span>
                                            )}
                                            {r.evaluationWasFinalized && (
                                                <span className="px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase">
                                                    {t('evaluation_was_finalized', { defaultValue: 'evaluation finalized' })}
                                                </span>
                                            )}
                                        </div>
                                        {/* What re-reading the day actually showed. Only worth surfacing when it
                                            contradicts the intent — the service reports success either way. */}
                                        {r.status === 'FAILED' && (
                                            <p className="text-[10px] font-bold text-rose-600 mt-1">
                                                {t('day_still_reads', { defaultValue: 'The day still reads "{{state}}".', state: r.verifiedState })}
                                            </p>
                                        )}
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-bold">
                                        <span dir="ltr" className="inline-block">
                                            {formatMinutesAsHM(r.workMinsBefore ?? 0)}
                                            <span className="mx-1 text-slate-400">→</span>
                                            <span className={(r.workMinsAfter ?? 0) > (r.workMinsBefore ?? 0) ? 'text-emerald-600' : ''}>
                                                {formatMinutesAsHM(r.workMinsAfter ?? 0)}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="p-3 max-w-xs">
                                        <span dir="auto" className="text-[11px]">{r.reason}</span>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                        <span className="font-bold text-[11px] block">{r.correctedByName || '—'}</span>
                                        <span className="text-[10px] text-slate-400">
                                            <bdi>{format(parseISO(r.appliedAt), 'dd MMM yyyy HH:mm')}</bdi>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {isLoading && (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-bold animate-pulse">{t('loading', { defaultValue: 'Loading…' })}</td></tr>
                            )}
                            {!isLoading && visible.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-400 font-bold">
                                        {t('no_punch_corrections_yet', { defaultValue: 'No punches have been corrected in this period.' })}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {!isLoading && !isError && rows.some(r => r.status === 'FAILED') && (
                <div className="p-3 border-t border-rose-200 bg-rose-50 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-bold text-rose-700">
                        {t('some_corrections_failed_note', {
                            defaultValue: 'Some corrections did not go through. They are kept here rather than hidden, because the attendance system reports success either way — only re-reading the day tells the truth.',
                        })}
                    </p>
                </div>
            )}
        </div>
    );
};

export default PunchCorrectionArchive;
