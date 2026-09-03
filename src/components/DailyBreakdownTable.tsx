import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import type { DailyAttendanceResult, EmployeeLeaveRecord } from '../services/attendanceService';
import { formatMinutesAsHM, cleanReason } from '../utils/attendanceFormat';
import { resolveDayStatus, DAY_STATUS_META } from '../utils/attendanceDayStatus';
import Pagination from './Pagination';

interface DailyBreakdownTableProps {
    rows: DailyAttendanceResult[];
    empLeaves: EmployeeLeaveRecord[];
    pageSize?: number;
}

const DailyBreakdownTable: React.FC<DailyBreakdownTableProps> = ({ rows, empLeaves, pageSize = 10 }) => {
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
                            if (status.kind !== 'present') {
                                return (
                                    <tr key={day.date}>
                                        <td className={`p-3 font-bold ${meta.rowClassName}`}>{format(parseISO(day.date), 'dd MMM yyyy')}</td>
                                        <td colSpan={6} className={`p-3 text-center ${meta.rowClassName}`}>
                                            <span className={`font-bold ${meta.textClassName}`}>{status.reason}</span>
                                        </td>
                                    </tr>
                                );
                            }

                            return (
                                <tr key={day.date} className="hover:bg-slate-50/50">
                                    <td className="p-3 font-bold">{format(parseISO(day.date), 'dd MMM yyyy')}</td>
                                    <td className="p-3 font-mono">
                                        {day.sessions.length > 0 ? (
                                            <div className="flex flex-col gap-1">
                                                {day.sessions.map((s, i) => (
                                                    <span key={i} className="whitespace-nowrap">{s.checkIn} – {s.checkOut}</span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="whitespace-nowrap">{day.firstPunch} – {day.lastPunch}</span>
                                        )}
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
                                    <td className="p-3">{day.overTimeStr}</td>
                                    <td className="p-3 font-bold text-slate-600">{formatMinutesAsHM(day.totalWorkMins)}</td>
                                </tr>
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
