import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Timer, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { attendanceService } from '../services/attendanceService';
import { formatMinutesAsHM, formatHmsAsHM, cleanReason } from '../utils/attendanceFormat';

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: React.ReactNode; color: string }) => (
    <div className="bg-white border border-[#511d29]/10 rounded-xl p-5 shadow-sm flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-slate-800">{value}</p>
        </div>
    </div>
);

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

type DayFilter = 'all' | 'late' | 'earlyOut' | 'holiday' | 'outWork' | 'excused';

const MyAttendancePage: React.FC = () => {
    const [start, setStart] = useState(todayStr);
    const [end, setEnd] = useState(todayStr);
    const [dayFilter, setDayFilter] = useState<DayFilter>('all');

    const { data: report, isLoading, isError, error } = useQuery({
        queryKey: ['my-attendance-monthly-report', start, end],
        queryFn: () => attendanceService.getMyMonthlyReport(start || undefined, end || undefined),
        retry: false,
    });

    const rows = (report?.reportData || []).filter(day => {
        switch (dayFilter) {
            case 'late': return day.lateMins > 0;
            case 'earlyOut': return day.earlyOutMins > 0;
            case 'holiday': return day.isHoliday;
            case 'outWork': return day.isOutWork;
            case 'excused': return day.isExcusedLate || day.isExcusedEarlyOut;
            default: return true;
        }
    });

    return (
        <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight">My Attendance</h1>
                    <p className="text-slate-500 mt-1 font-medium">Your own punches, lateness, overtime, and leave — pulled live from the attendance system.</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={start} onChange={e => setStart(e.target.value)} className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold" />
                    <span className="text-xs font-bold text-slate-400">to</span>
                    <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold" />
                    {(start !== todayStr() || end !== todayStr()) && (
                        <button onClick={() => { setStart(todayStr()); setEnd(todayStr()); }} className="text-[10px] font-black text-[#511d29] uppercase tracking-wider underline">
                            Today
                        </button>
                    )}
                </div>
                {report && (
                    <div className="relative flex items-center">
                        <Filter className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select
                            value={dayFilter}
                            onChange={e => setDayFilter(e.target.value as DayFilter)}
                            className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold appearance-none cursor-pointer"
                        >
                            <option value="all">All Days</option>
                            <option value="late">Late Only</option>
                            <option value="earlyOut">Early-Out Only</option>
                            <option value="holiday">Holidays</option>
                            <option value="outWork">Out-Work</option>
                            <option value="excused">Excused (Late/Early-Out)</option>
                        </select>
                    </div>
                )}
            </div>

            {isLoading && <p className="text-center text-slate-400 font-bold animate-pulse py-10">Loading your attendance…</p>}

            {isError && (
                <div className="p-10 text-center bg-white border border-[#511d29]/10 rounded-xl">
                    <p className="text-sm font-bold text-rose-600">{(error as any)?.response?.data?.error || 'Could not load your attendance for this period.'}</p>
                </div>
            )}

            {report && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard icon={CalendarCheck} label="Worked" value={report.grandTotalWork} color="bg-emerald-50 text-emerald-600" />
                        <StatCard icon={Timer} label="Overtime (Worked)" value={report.totalOT} color="bg-blue-50 text-blue-600" />
                        <StatCard icon={Timer} label="Overtime (Approved)" value={report.formattedApprovedOT} color="bg-blue-50 text-blue-600" />
                        <StatCard icon={CalendarCheck} label="Out-Work Days" value={report.outWorkDays} color="bg-indigo-50 text-indigo-600" />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium -mt-4">
                        "Worked" is calculated from your actual punch times (first check-in to last check-out) — it is not shifted to the scheduled start, so a late arrival still shortens this total even when the lateness itself is excused below.
                    </p>

                    {/* Punctuality Breakdown — same late/early-out → excused → chargeable → deduction
                        chain shown on the HR-facing Attendance page, scoped to just this employee. */}
                    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Punctuality Breakdown</span>
                            {report.totalDeduction > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                                    Deduction: {report.totalDeduction} pts
                                </span>
                            )}
                        </div>
                        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                            <div className="p-4 space-y-2">
                                <p className="text-xs font-black text-slate-600 uppercase tracking-wide">Late Arrival</p>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">Recorded late</span>
                                    <span className="font-bold text-slate-700">{formatMinutesAsHM(report.totalLate + report.totalExcusedMins)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">− Excused</span>
                                    <span className="font-bold text-emerald-600">{formatMinutesAsHM(report.totalExcusedMins)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <span className="font-black text-slate-600">= Chargeable</span>
                                    <span className={`font-black ${report.totalLate > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatMinutesAsHM(report.totalLate)}</span>
                                </div>
                            </div>
                            <div className="p-4 space-y-2">
                                <p className="text-xs font-black text-slate-600 uppercase tracking-wide">Early Departure</p>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">Recorded early-out</span>
                                    <span className="font-bold text-slate-700">{formatMinutesAsHM(report.totalEarly + report.totalExcusedEarlyOutMins)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">− Excused</span>
                                    <span className="font-bold text-emerald-600">{formatMinutesAsHM(report.totalExcusedEarlyOutMins)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <span className="font-black text-slate-600">= Chargeable</span>
                                    <span className={`font-black ${report.totalEarly > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{formatMinutesAsHM(report.totalEarly)}</span>
                                </div>
                            </div>
                        </div>
                        <p className="px-4 pb-3 text-[10px] text-slate-400 font-medium">
                            "Recorded" is derived (chargeable + excused) to show how much was logged before any excused allowance was applied.
                        </p>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily Breakdown</span>
                        </div>
                        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="sticky top-0 bg-white">
                                    <tr className="text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-100">
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Sessions</th>
                                        <th className="p-3">Mid-Day Gap</th>
                                        <th className="p-3">Late</th>
                                        <th className="p-3">Early Out</th>
                                        <th className="p-3">OT</th>
                                        <th className="p-3">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {rows.map(day => (
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
                                                <span className={day.lateMins > 0 ? 'font-black text-red-600' : 'text-slate-400'}>{day.lateTimeStr}</span>
                                            </td>
                                            <td className="p-3">
                                                <span className={day.earlyOutMins > 0 ? 'font-black text-amber-600' : 'text-slate-400'}>{day.earlyOutStr}</span>
                                            </td>
                                            <td className="p-3">{day.overTimeStr}</td>
                                            <td className="p-3 text-slate-500">
                                                {day.isHoliday && <span className="mr-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">{day.holidayName || 'Holiday'}</span>}
                                                {day.isOutWork && <span className="mr-2 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">Out-work: {day.outWorkReason}</span>}
                                                {day.isExcusedLate && (
                                                    <span className="mr-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                                                        Excused Late{cleanReason(day.excusedLateReason) ? `: ${cleanReason(day.excusedLateReason)}` : ''}
                                                    </span>
                                                )}
                                                {day.isExcusedEarlyOut && (
                                                    <span className="mr-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                                                        Excused Early-Out{cleanReason(day.excusedEarlyOutReason) ? `: ${cleanReason(day.excusedEarlyOutReason)}` : ''}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold">No days match this filter.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {report.empLeaves.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Leave Records in This Range</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {report.empLeaves.map(leave => (
                                    <div key={leave.id} className="p-3 flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-700">{leave.leaveType.name}</span>
                                        <span className="text-slate-500">{format(parseISO(leave.startDate), 'dd MMM')} – {format(parseISO(leave.endDate), 'dd MMM yyyy')} ({leave.daysCount} days)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {report.empOvertimes.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Overtime Records in This Range</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {report.empOvertimes.map(ot => (
                                    <div key={ot.id} className="p-3 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-bold text-slate-700">{format(parseISO(ot.date), 'dd MMM yyyy')}</span>
                                            {ot.reason && <span className="text-slate-400 ml-2">— {ot.reason}</span>}
                                        </div>
                                        <span className="font-black text-blue-600">{formatHmsAsHM(ot.approvedMinutes)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MyAttendancePage;
