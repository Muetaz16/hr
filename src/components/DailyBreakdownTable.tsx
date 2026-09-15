import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import type { DailyAttendanceResult, EmployeeLeaveRecord } from '../services/attendanceService';
import { formatMinutesAsHM, cleanReason } from '../utils/attendanceFormat';
import { resolveDayStatus, DAY_STATUS_META } from '../utils/attendanceDayStatus';
import { punchAnomalyText } from '../utils/punchAnomalyText';
import { Moon, AlertTriangle } from 'lucide-react';
import Pagination from './Pagination';

interface DailyBreakdownTableProps {
    rows: DailyAttendanceResult[];
    empLeaves: EmployeeLeaveRecord[];
    pageSize?: number;
    /**
     * Offered only where somebody may actually act. The HR Attendance page passes it; My
     * Attendance does not — an employee should see WHY their day reads zero without being able
     * to rewrite their own attendance.
     */
    onCorrect?: (day: DailyAttendanceResult) => void;
}

const DailyBreakdownTable: React.FC<DailyBreakdownTableProps> = ({ rows, empLeaves, pageSize = 10, onCorrect }) => {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    // Clamped fresh every render — if the caller's filter/date-range shrinks `rows` while on a
    // later page, this snaps back to the new last page instead of showing an empty page.
    const currentPage = Math.min(page, totalPages);
    const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const todayKey = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily Breakdown</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                    <thead>
                        <tr className="text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-100">
                            <th className="p-3">{t('date', { defaultValue: 'Date' })}</th>
                            <th className="p-3">{t('sessions', { defaultValue: 'Sessions' })}</th>
                            <th className="p-3">{t('mid_day_gap', { defaultValue: 'Mid-Day Gap' })}</th>
                            <th className="p-3">{t('late_time', { defaultValue: 'Late' })}</th>
                            <th className="p-3">{t('early_out_time', { defaultValue: 'Early Out' })}</th>
                            <th className="p-3">{t('ot_abbr', { defaultValue: 'OT' })}</th>
                            <th className="p-3">{t('worked', { defaultValue: 'Worked' })}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {pageRows.map(day => {
                            const status = resolveDayStatus(day, empLeaves, todayKey);
                            const meta = DAY_STATUS_META[status.kind];

                            // Holiday/Out-Work/On-Leave/Absent/Incomplete days have nothing meaningful
                            // in Sessions/Mid-Day Gap/Late/Early Out/OT/Worked — showing them as zeros
                            // reads as noise, so the whole span is replaced with the reason instead,
                            // and the row is tinted to match at a glance. The tint goes on each <td>
                            // (not the <tr>) and the reason text is wrapped in its own <span> — this
                            // app's global table skin (index.css) forces `tr { background: transparent
                            // !important }` and `td { color: ... !important }`, which a color class on
                            // the tr/td itself can't beat in light mode; a child element's own color
                            // isn't competing with an inherited !important, so it renders through fine
                            // (the same reason the existing Holiday/Out-Work badges already work).
                            // A day the server judged broken. It gets its own amber treatment rather
                            // than the generic grey "incomplete" row, because it is not merely missing
                            // data — it is a day that was worked and paid nothing, and somebody has to
                            // act on it. The reason is shown because it is the evidence, and the
                            // invented lateness is called out separately because it is often the
                            // larger harm: it feeds the presence score and the tardiness signal.
                            const anomaly = day.anomaly;

                            // A day that is NOT a working day — the weekly rest day, or a public
                            // holiday. Checked BEFORE the anomaly branch so neither is ever dressed
                            // up as a broken working day.
                            //
                            // Both take the same treatment because the rule is the same: there is no
                            // scheduled day, so anyone who turns up is working overtime. The
                            // attendance service now books it that way too — a real eid holiday came
                            // back totalWorkMins = 0 with otMins = 301 — which is exactly why the
                            // figure shown here is the OVERTIME one. Reading totalWorkMins would
                            // print five hours of holiday work as "0m".
                            //
                            // Before this, the rest day was hidden from the table altogether and a
                            // worked holiday printed as nothing but its own name: five hours of eid
                            // overtime appeared on screen as the single word "eid".
                            if (status.kind === 'weeklyOff' || status.kind === 'holiday') {
                                const isRestDay = status.kind === 'weeklyOff';
                                const ot = status.overtimeMins ?? 0;
                                return (
                                    <tr key={day.date}>
                                        <td className={`p-3 font-bold ${meta.rowClassName}`}>
                                            <bdi>{format(parseISO(day.date), 'dd MMM yyyy')}</bdi>
                                            <span className={`block mt-1 text-[9px] font-black uppercase tracking-wide border rounded px-1.5 py-0.5 w-fit ${isRestDay ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                                                {isRestDay
                                                    ? t('weekly_rest_day', { defaultValue: 'Weekly rest day' })
                                                    : (day.holidayName || t('public_holiday', { defaultValue: 'Public holiday' }))}
                                            </span>
                                        </td>
                                        <td colSpan={5} className={`p-3 ${meta.rowClassName}`}>
                                            {status.overtimeMins === undefined ? (
                                                <span className={`font-bold ${meta.textClassName}`}>
                                                    {isRestDay
                                                        ? t('friday_rest_day', { defaultValue: 'Friday — the weekly rest day.' })
                                                        : status.reason}
                                                </span>
                                            ) : (
                                                <>
                                                    <span className={`font-bold ${meta.textClassName}`}>
                                                        {isRestDay
                                                            ? t('friday_worked_is_overtime', {
                                                                defaultValue: 'Worked on the rest day — these {{time}} count as overtime, not ordinary hours.',
                                                                time: formatMinutesAsHM(ot),
                                                            })
                                                            : t('holiday_worked_is_overtime', {
                                                                defaultValue: 'Worked on {{holiday}} — these {{time}} count as overtime, not ordinary hours.',
                                                                holiday: day.holidayName || t('public_holiday', { defaultValue: 'Public holiday' }),
                                                                time: formatMinutesAsHM(ot),
                                                            })}
                                                    </span>
                                                    {/* The punches themselves, because on a day with no
                                                        schedule they are the whole story — there is
                                                        nothing to compare them against. */}
                                                    {!!day.punches?.length && (
                                                        <span dir="ltr" className="block mt-1 font-mono text-[11px] text-slate-500">
                                                            {day.punches.map(p => `${p.punchTime} ${p.punchState}`).join('  ·  ')}
                                                        </span>
                                                    )}
                                                    {/* Deliberately never a lateness figure here: there
                                                        is no start time to miss, and the service has been
                                                        seen charging one anyway. */}
                                                    {ot === 0 && (
                                                        <span className="block mt-0.5 text-[10px] font-bold text-amber-700">
                                                            {t('nonworking_punched_no_hours', { defaultValue: 'Punched, but no overtime was credited — those hours would be lost.' })}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td className={`p-3 text-end ${meta.rowClassName}`}>
                                            {onCorrect && anomaly && anomaly.severity === 'blocking' && (
                                                <button
                                                    onClick={() => onCorrect(day)}
                                                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-colors"
                                                >
                                                    {t('correct', { defaultValue: 'Correct' })}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            }

                            if (anomaly && anomaly.severity === 'blocking') {
                                return (
                                    <tr key={day.date} className="bg-amber-50/60">
                                        <td className="p-3 font-bold">
                                            <bdi>{format(parseISO(day.date), 'dd MMM yyyy')}</bdi>
                                            <span className="block mt-1 text-[9px] font-black uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 w-fit">
                                                <AlertTriangle className="w-2.5 h-2.5 inline-block -mt-px me-0.5" />
                                                {t('needs_correction', { defaultValue: 'Needs correction' })}
                                            </span>
                                        </td>
                                        <td colSpan={5} className="p-3">
                                            <span dir="auto" className="text-[11px] font-bold text-amber-800">{punchAnomalyText(anomaly, t)}</span>
                                            {anomaly.phantomLateMins > 0 && (
                                                <span className="block mt-0.5 text-[10px] font-bold text-red-600">
                                                    {t('phantom_late', { defaultValue: 'plus {{mins}} minutes of lateness this created', mins: anomaly.phantomLateMins })}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-end">
                                            {onCorrect && (
                                                <button
                                                    onClick={() => onCorrect(day)}
                                                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-colors"
                                                >
                                                    {t('correct', { defaultValue: 'Correct' })}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            }
                            if (status.kind !== 'present') {
                                return (
                                    <tr key={day.date}>
                                        <td className={`p-3 font-bold ${meta.rowClassName}`}><bdi>{format(parseISO(day.date), 'dd MMM yyyy')}</bdi></td>
                                        <td colSpan={6} className={`p-3 text-center ${meta.rowClassName}`}>
                                            <span className={`font-bold ${meta.textClassName}`}>{status.reason}</span>
                                        </td>
                                    </tr>
                                );
                            }

                            // A night shift that crossed midnight: this row already holds the whole
                            // shift, and its check-out belongs to the NEXT day. Without saying so,
                            // the row reads as nonsense — a session of a minute or two that somehow
                            // earned sixteen hours of overtime.
                            const stitched = !!day.isOvernightStitched;
                            const checkoutDay = stitched && day.overnightCheckoutDate
                                ? format(parseISO(day.overnightCheckoutDate), 'dd MMM')
                                : null;
                            // `dir="ltr"` on every time pair, not just stitched ones. A clock range
                            // is left-to-right in any language; inside the Arabic RTL layout the
                            // browser was flipping it, so "09:22 – 09:23" printed as
                            // "09:23 – 09:22" and every session in the table read backwards.
                            const sessionSpan = (a: string, b: string, key?: number) => (
                                <span key={key} dir="ltr" className="whitespace-nowrap inline-flex items-baseline gap-1">
                                    <span>{a}</span><span className="text-slate-300">→</span><span>{b}</span>
                                    {checkoutDay && (
                                        <span className="text-[9px] font-bold text-indigo-500 ms-0.5">+1 · {checkoutDay}</span>
                                    )}
                                </span>
                            );

                            return (
                                <React.Fragment key={day.date}>
                                <tr className={`hover:bg-slate-50/50 ${stitched ? 'bg-indigo-50/40' : ''}`}>
                                    <td className="p-3 font-bold">
                                        <bdi>{format(parseISO(day.date), 'dd MMM yyyy')}</bdi>
                                        {stitched && (
                                            <span className="block mt-1 text-[9px] font-black uppercase tracking-wide text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 w-fit">
                                                <Moon className="w-2.5 h-2.5 inline-block -mt-px me-0.5" />
                                                {t('overnight_shift', { defaultValue: 'Overnight shift' })}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 font-mono">
                                        {day.sessions.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {day.sessions.map((s, i) =>
                                                    sessionSpan(s.checkIn, s.checkOut, i))}
                                            </div>
                                        ) : sessionSpan(day.firstPunch, day.lastPunch)}
                                    </td>
                                    <td className="p-3">
                                        <span className={day.midDayGapMins > 0 ? 'font-black text-slate-600' : 'text-slate-400'}>{day.midDayGapTime}</span>
                                    </td>
                                    <td className="p-3">
                                        <span className={day.lateMins > 0 ? 'font-black text-red-600' : 'text-slate-400'}>
                                            {day.lateTimeStr}
                                            {day.isExcusedLate && (
                                                <span className="block font-bold text-emerald-600">Excused{cleanReason(day.excusedLateReason) ? `: ${cleanReason(day.excusedLateReason)}` : ''}</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className={day.earlyOutMins > 0 ? 'font-black text-amber-600' : 'text-slate-400'}>
                                            {day.earlyOutStr}
                                            {day.isExcusedEarlyOut && (
                                                <span className="block font-bold text-emerald-600">Excused{cleanReason(day.excusedEarlyOutReason) ? `: ${cleanReason(day.excusedEarlyOutReason)}` : ''}</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className={`p-3 ${stitched ? 'font-black text-indigo-600' : ''}`}>{day.overTimeStr}</td>
                                    <td className="p-3 font-bold text-slate-600">{formatMinutesAsHM(day.totalWorkMins)}</td>
                                </tr>
                                {/* Why this row shows hours of overtime against a session that looks
                                    minutes long.

                                    The attendance system does send a finished sentence in
                                    `overnightNote`, but it is Arabic-only — rendered inside an
                                    English page it sat in an LTR block and the full stop jumped to
                                    the front of the line. Composing it here from the structured
                                    fields instead means it follows whichever language the user is
                                    reading, and `dir="auto"` settles the base direction from the
                                    text itself rather than from the surrounding layout. */}
                                {stitched && (
                                    <tr className="bg-indigo-50/40">
                                        <td colSpan={7} className="px-3 pb-2.5 pt-0">
                                            <div className="flex items-center gap-2 border-s-2 border-indigo-300 ps-2.5">
                                                <Moon className="w-3 h-3 shrink-0 text-indigo-500" />
                                                <span dir="auto" className="text-[11px] font-medium text-indigo-700">
                                                    {t('overnight_note', {
                                                        defaultValue: 'Shift ran past midnight — checked out at {{time}} on {{date}}; {{ot}} counted as overtime.',
                                                        time: day.sessions[day.sessions.length - 1]?.checkOut || day.lastPunch,
                                                        date: checkoutDay ?? '',
                                                        ot: day.overTimeStr,
                                                    })}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">No days match this filter.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={rows.length}
                    pageSize={pageSize}
                    itemLabel="days"
                />
            )}
        </div>
    );
};

export default DailyBreakdownTable;
