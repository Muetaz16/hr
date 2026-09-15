import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { attendanceService, type PunchAnomalyRow } from '../services/attendanceService';
import { punchAnomalyText } from '../utils/punchAnomalyText';
import { formatMinutesAsHM } from '../utils/attendanceFormat';
import { periodLabel, recentPeriods } from '../utils/payrollLabels';
import PunchCorrectionModal from './PunchCorrectionModal';

// The cross-employee worklist of days whose punches did not come out as a working day.
//
// The verdict on every row is the SERVER's — the same detectDayAnomaly that flags the day on the
// employee's own daily breakdown. Nothing is re-derived here, so the queue and the day row can
// never disagree about whether a day is broken.
//
// Defaults to the current financial month because that is the window the next payroll run reads:
// a day cleared from here before the run computes costs nobody anything, and the same day cleared
// afterwards means a correction against an approved run.

type Filter = 'all' | 'zero' | 'unpaired' | 'same' | 'double' | 'ot' | 'short';

const MATCHES: Record<Filter, (r: PunchAnomalyRow) => boolean> = {
    all: () => true,
    zero: r => r.anomaly.kind === 'ZERO_WORK_WITH_PUNCHES',
    unpaired: r => r.anomaly.kind === 'UNPAIRED_PUNCH',
    same: r => r.anomaly.kind === 'SAME_STATE_ONLY',
    double: r => r.anomaly.kind === 'DOUBLE_TAP',
    ot: r => r.anomaly.kind === 'OVERTIME_OUT_UNCLOSED',
    short: r => r.anomaly.kind === 'SUSPICIOUSLY_SHORT',
};

interface Props {
    /** Set false where the reader may look but not act (a view_time_tracking holder). */
    canCorrect?: boolean;
}

const PunchAnomalyQueue: React.FC<Props> = ({ canCorrect = false }) => {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [correcting, setCorrecting] = useState<PunchAnomalyRow | null>(null);
    // A whole financial month can be dozens of rows, which buries the manual-transactions table
    // and the archive below it. Collapsing hides only the ROWS — the counts and the filter chips
    // stay, so the size of the problem is still on screen when the list itself is out of the way.
    const [collapsed, setCollapsed] = useState(false);

    // The queue owns its own window rather than sharing the tab's date boxes with the manual-
    // transactions table below. They are asked for different reasons: that table is "what did we
    // hand-correct lately", this one is "what is still wrong in the month about to be paid".
    const PERIODS = useMemo(() => recentPeriods(12), []);
    const [period, setPeriod] = useState<string>(PERIODS[0]);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const isCustom = period === 'custom';
    // The server rejects half a range rather than guessing at it, so a partly-filled pair of date
    // boxes is treated here as no range at all — the officer is mid-typing, and answering with a
    // red "could not reach the attendance system" would be both wrong and alarming.
    const hasRange = !!customStart && !!customEnd;
    const partialRange = isCustom && !hasRange;

    // The server caches a sweep for a few minutes, so a plain refetch would hand back the same
    // answer. Rescan has to say so explicitly — it is the button an officer presses precisely
    // because they just corrected something and want to see it gone.
    const forceRefresh = useRef(false);
    const query = isCustom
        ? (hasRange ? { start: customStart, end: customEnd } : {})
        : { period };
    const { data, isLoading, isError, isFetching, refetch } = useQuery({
        queryKey: ['punch-anomalies', query],
        queryFn: () => {
            const refresh = forceRefresh.current;
            forceRefresh.current = false;
            return attendanceService.getPunchAnomalies({ ...query, refresh });
        },
        retry: false,
    });
    const rescan = () => { forceRefresh.current = true; refetch(); };

    const rows = data?.rows || [];
    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return rows.filter(r => MATCHES[filter](r)
            && (!needle || r.employeeName.toLowerCase().includes(needle) || r.empCode.toLowerCase().includes(needle)));
    }, [rows, filter, search]);

    // Headline figures come from the WHOLE sweep, never the filtered view — the point of the strip
    // is the size of the problem, and it must not shrink because somebody typed in the search box.
    const totals = useMemo(() => ({
        days: rows.length,
        employees: new Set(rows.map(r => r.empCode)).size,
        unpaidDays: rows.filter(r => r.totalWorkMins === 0).length,
        phantomLate: rows.reduce((sum, r) => sum + r.anomaly.phantomLateMins, 0),
    }), [rows]);

    const CHIPS: { key: Filter; label: string }[] = [
        { key: 'all', label: t('all', { defaultValue: 'All' }) },
        { key: 'unpaired', label: t('filter_unpaired', { defaultValue: 'One punch only' }) },
        { key: 'same', label: t('filter_same_state', { defaultValue: 'Same type twice' }) },
        { key: 'double', label: t('filter_double_tap', { defaultValue: 'Double tap' }) },
        { key: 'ot', label: t('filter_ot_uncl', { defaultValue: 'Overtime not closed' }) },
        { key: 'zero', label: t('filter_zero_work', { defaultValue: 'Zero hours' }) },
        { key: 'short', label: t('filter_short_day', { defaultValue: 'Short day' }) },
    ];

    return (
        <div className="bg-white border border-amber-300/60 rounded-xl overflow-hidden shadow-sm">
            <div className={`p-4 bg-amber-50/60 space-y-3 ${collapsed ? '' : 'border-b border-amber-200'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-black text-amber-800 uppercase tracking-wider inline-flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t('punch_anomalies', { defaultValue: 'Punch Anomalies' })}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={period}
                            onChange={e => setPeriod(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-amber-300/60 rounded-lg text-xs font-bold"
                        >
                            {PERIODS.map((p, i) => (
                                <option key={p} value={p}>
                                    {periodLabel(p, t)}{i === 0 ? ` — ${t('current_period', { defaultValue: 'current' })}` : ''}
                                </option>
                            ))}
                            <option value="custom">{t('custom_range', { defaultValue: 'Custom range…' })}</option>
                        </select>

                        {isCustom && (
                            <>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-amber-300/60 rounded-lg text-xs font-bold"
                                />
                                <span className="text-xs font-bold text-amber-800/60">{t('to', { defaultValue: 'to' })}</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="px-3 py-1.5 bg-white border border-amber-300/60 rounded-lg text-xs font-bold"
                                />
                            </>
                        )}

                        <input
                            type="text"
                            placeholder={t('search_name_or_code', { defaultValue: 'Search name or code...' })}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-amber-300/60 rounded-lg text-xs font-bold w-44"
                        />
                        <button
                            onClick={() => setCollapsed(c => !c)}
                            className="px-3 py-1.5 bg-white border border-amber-300/60 rounded-lg font-black text-[10px] uppercase tracking-widest text-amber-800 hover:bg-amber-100 transition-colors inline-flex items-center gap-1.5"
                        >
                            {collapsed
                                ? <><ChevronDown className="w-3 h-3" />{t('show_list', { defaultValue: 'Show list' })}</>
                                : <><ChevronUp className="w-3 h-3" />{t('hide_list', { defaultValue: 'Hide list' })}</>}
                        </button>
                        <button
                            onClick={rescan}
                            disabled={isFetching}
                            className="px-3 py-1.5 bg-white border border-amber-300/60 rounded-lg font-black text-[10px] uppercase tracking-widest text-amber-800 hover:bg-amber-100 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
                            {t('rescan', { defaultValue: 'Rescan' })}
                        </button>
                    </div>
                </div>

                <p className="text-[11px] font-medium text-amber-900/80 leading-relaxed">
                    {t('punch_anomalies_sub', {
                        defaultValue: 'Days an employee was at work but the punches did not pair, so the day paid nothing. Clearing these before the payroll run computes is the whole point — afterwards the money has to be recovered as a correction against an approved run.',
                    })}
                </p>

                {!isLoading && !isError && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-bold text-amber-900">
                        {/* The range is stated because leaving the date boxes empty does NOT mean
                            "everything" — the server answers for the current financial month. */}
                        <span dir="ltr" className="text-amber-900/70">{data?.start} → {data?.end}</span>
                        {/* `count` drives i18next's plural selection, the second variable is what
                            the sentence prints — the shape advance_n_basic_salaries already uses.
                            Arabic has six plural forms and "3 يوماً" would be wrong grammar. */}
                        <span>{t('n_days', { defaultValue: '{{n}} days', count: totals.days, n: totals.days })}</span>
                        <span>{t('n_employees', { defaultValue: '{{n}} employees', count: totals.employees, n: totals.employees })}</span>
                        <span>{t('n_days_paid_nothing', { defaultValue: '{{n}} days paid nothing', count: totals.unpaidDays, n: totals.unpaidDays })}</span>
                        {totals.phantomLate > 0 && (
                            <span className="text-red-700">
                                {t('n_phantom_late', { defaultValue: '{{mins}} minutes of lateness invented', count: totals.phantomLate, mins: totals.phantomLate })}
                            </span>
                        )}
                    </div>
                )}

                {partialRange && (
                    <div className="text-[11px] font-bold text-amber-800 bg-white border border-amber-300/60 rounded-lg px-3 py-2">
                        {t('anomaly_needs_both_dates', {
                            defaultValue: 'Set both dates to narrow this list. Until then it shows the current financial month.',
                        })}
                    </div>
                )}

                {/* A sweep that could not read part of the roster is a SHORT list, and an officer
                    clearing this queue would otherwise have no way to know that. */}
                {!!data?.unreadable && (
                    <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                        {t('anomaly_scan_incomplete', {
                            defaultValue: '{{n}} employees could not be read, so this list is incomplete. Rescan to try again.',
                            count: data.unreadable, n: data.unreadable,
                        })}
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                    {CHIPS.map(c => {
                        const count = c.key === 'all' ? rows.length : rows.filter(MATCHES[c.key]).length;
                        return (
                            <button
                                key={c.key}
                                onClick={() => setFilter(c.key)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                                    filter === c.key
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-white border border-amber-300/60 text-amber-800 hover:bg-amber-100'
                                }`}
                            >
                                {c.label} <span className="opacity-70">{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {isError && (
                <div className="p-10 text-center">
                    <p className="text-sm font-bold text-rose-600">
                        {t('could_not_reach_the_attendance_system', { defaultValue: 'Could not reach the attendance system.' })}
                    </p>
                </div>
            )}

            {!isError && !collapsed && (
                <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse text-xs md:text-sm">
                        <thead>
                            <tr className="bg-amber-100/50 text-amber-900 uppercase font-black tracking-wider text-[10px] border-b border-amber-200">
                                <th className="p-3 text-start">{t('employee', { defaultValue: 'Employee' })}</th>
                                <th className="p-3 text-start">{t('date', { defaultValue: 'Date' })}</th>
                                <th className="p-3 text-start">{t('punches', { defaultValue: 'Punches' })}</th>
                                <th className="p-3 text-start">{t('detected_problem', { defaultValue: 'Detected problem' })}</th>
                                <th className="p-3 text-start">{t('worked', { defaultValue: 'Worked' })}</th>
                                <th className="p-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 font-medium text-slate-700">
                            {visible.map(row => (
                                <tr key={`${row.empCode}-${row.date}`} className="hover:bg-amber-50/40 align-top">
                                    <td className="p-3">
                                        <span className="font-bold block">{row.employeeName}</span>
                                        <span className="font-mono text-[10px] text-slate-400">{row.empCode}</span>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                        {/* <bdi> so the day/month/year order survives an RTL page. */}
                                        <bdi className="font-bold">{format(parseISO(row.date), 'dd MMM yyyy')}</bdi>
                                        <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{row.period}</span>
                                    </td>
                                    <td className="p-3">
                                        {/* dir="ltr": a clock time is left-to-right even on an RTL page. */}
                                        <div dir="ltr" className="flex flex-col gap-0.5 items-start">
                                            {row.punches.map(p => (
                                                <span key={p.id} className="font-mono text-[11px] whitespace-nowrap">
                                                    {p.punchTime}
                                                    <span className="ms-1.5 text-slate-500">{p.punchState}</span>
                                                    {p.isManual && (
                                                        <span className="ms-1 text-[9px] font-black uppercase text-indigo-600">
                                                            {t('manual', { defaultValue: 'manual' })}
                                                        </span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-3 max-w-md">
                                        <span dir="auto" className="text-[11px] font-bold text-amber-800">
                                            {punchAnomalyText(row.anomaly, t)}
                                        </span>
                                        {row.anomaly.phantomLateMins > 0 && (
                                            <span className="block mt-0.5 text-[10px] font-bold text-red-600">
                                                {t('phantom_late', { defaultValue: 'plus {{mins}} minutes of lateness this created', mins: row.anomaly.phantomLateMins })}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 font-bold whitespace-nowrap">
                                        <span className={row.totalWorkMins === 0 ? 'text-red-600' : ''}>
                                            {formatMinutesAsHM(row.totalWorkMins)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-end">
                                        {canCorrect && (
                                            <button
                                                onClick={() => setCorrecting(row)}
                                                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-colors"
                                            >
                                                {t('correct', { defaultValue: 'Correct' })}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {isLoading && (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-400 font-bold animate-pulse">
                                        {t('scanning_the_roster', { defaultValue: 'Scanning the roster… this reads one employee at a time and takes a moment.' })}
                                    </td>
                                </tr>
                            )}
                            {!isLoading && visible.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-slate-400 font-bold">
                                        {rows.length === 0
                                            ? t('no_punch_anomalies', { defaultValue: 'No broken days in this range.' })
                                            : t('no_rows_match_this_filter', { defaultValue: 'No rows match this filter.' })}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Rescan with `refresh` after a save: the server drops its cache when a correction
                lands, but this query's own cached answer would still show the day as broken. */}
            <PunchCorrectionModal
                row={correcting}
                onClose={() => setCorrecting(null)}
                onSaved={rescan}
            />
        </div>
    );
};

export default PunchAnomalyQueue;
