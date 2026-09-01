import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Timer, Filter, AlertTriangle, ShieldOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { attendanceService } from '../services/attendanceService';
import { formatMinutesAsHM, formatHmsAsHM } from '../utils/attendanceFormat';
import { resolveDayStatus, fillMissingDays } from '../utils/attendanceDayStatus';
import DailyBreakdownTable from '../components/DailyBreakdownTable';

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

type DayFilter = 'all' | 'late' | 'earlyOut' | 'holiday' | 'outWork' | 'excused' | 'suspended';

const MyAttendancePage: React.FC = () => {
    const { t } = useTranslation();
    const [start, setStart] = useState(todayStr);
    const [end, setEnd] = useState(todayStr);
    const [dayFilter, setDayFilter] = useState<DayFilter>('all');

    const { data: report, isLoading, isError, error } = useQuery({
        queryKey: ['my-attendance-monthly-report', start, end],
        queryFn: () => attendanceService.getMyMonthlyReport(start || undefined, end || undefined),
        retry: false,
    });

    // The attendance system only returns rows it has data for — filling the gaps first (before
    // the filter below) is what lets a genuine no-show day be caught as Absent at all.
    const filledReportData = report ? fillMissingDays(report.reportData, report.startDate, report.endDate) : [];
    const rows = filledReportData.filter(day => {
        switch (dayFilter) {
            case 'late': return day.lateMins > 0;
            case 'earlyOut': return day.earlyOutMins > 0;
            case 'holiday': return day.isHoliday;
            case 'outWork': return day.isOutWork;
            case 'excused': return day.isExcusedLate || day.isExcusedEarlyOut;
            case 'suspended': return day.isSuspended;
            default: return true;
        }
    });

    return (
        <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight">{t('my_attendance', { defaultValue: 'My Attendance' })}</h1>
                    <p className="text-slate-500 mt-1 font-medium">{t('my_attendance_subtitle', { defaultValue: 'Your own punches, lateness, overtime, and leave — pulled live from the attendance system.' })}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={start} onChange={e => setStart(e.target.value)} className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold" />
                    <span className="text-xs font-bold text-slate-400">{t('to', { defaultValue: 'to' })}</span>
                    <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold" />
                    {(start !== todayStr() || end !== todayStr()) && (
                        <button onClick={() => { setStart(todayStr()); setEnd(todayStr()); }} className="text-[10px] font-black text-[#511d29] uppercase tracking-wider underline">
                            {t('today', { defaultValue: 'Today' })}
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
                            <option value="all">{t('all_days', { defaultValue: 'All Days' })}</option>
                            <option value="late">{t('late_only', { defaultValue: 'Late Only' })}</option>
                            <option value="earlyOut">{t('early_out_only', { defaultValue: 'Early-Out Only' })}</option>
                            <option value="holiday">{t('holidays', { defaultValue: 'Holidays' })}</option>
                            <option value="outWork">{t('out_work', { defaultValue: 'Out-Work' })}</option>
                            <option value="excused">{t('excused_late_early_out', { defaultValue: 'Excused (Late/Early-Out)' })}</option>
                            <option value="suspended">{t('suspended', { defaultValue: 'Suspended' })}</option>
                        </select>
                    </div>
                )}
            </div>

            {isLoading && <p className="text-center text-slate-400 font-bold animate-pulse py-10">{t('loading_your_attendance', { defaultValue: 'Loading your attendance…' })}</p>}

            {isError && (
                <div className="p-10 text-center bg-white border border-[#511d29]/10 rounded-xl">
                    <p className="text-sm font-bold text-rose-600">{(error as any)?.response?.data?.error || t('could_not_load_attendance_period', { defaultValue: 'Could not load your attendance for this period.' })}</p>
                </div>
            )}

            {report && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard icon={CalendarCheck} label={t('worked', { defaultValue: 'Worked' })} value={report.grandTotalWork} color="bg-emerald-50 text-emerald-600" />
                        <StatCard
                            icon={AlertTriangle}
                            label={t('absent_days', { defaultValue: 'Absent Days' })}
                            value={filledReportData.filter(d => resolveDayStatus(d, report.empLeaves, format(new Date(), 'yyyy-MM-dd')).kind === 'absent').length}
                            color="bg-red-50 text-red-600"
                        />
                        <StatCard
                            icon={ShieldOff}
                            label={t('suspended_days', { defaultValue: 'Suspended Days' })}
                            value={filledReportData.filter(d => resolveDayStatus(d, report.empLeaves, format(new Date(), 'yyyy-MM-dd')).kind === 'suspended').length}
                            color="bg-purple-50 text-purple-600"
                        />
                        <StatCard
                            icon={CalendarCheck}
                            label={t('leave_days', { defaultValue: 'Leave Days' })}
                            value={
                                <span>
                                    <span className={report.paidLeaveDays > 0 ? 'text-emerald-600' : 'text-slate-300'}>{report.paidLeaveDays}</span>
                                    <span className="text-slate-300 mx-0.5">/</span>
                                    <span className={report.unpaidLeaveDays > 0 ? 'text-amber-600' : 'text-slate-300'}>{report.unpaidLeaveDays}</span>
                                    <span className="text-slate-300 mx-0.5">/</span>
                                    <span className={report.emergencyLeaveDays > 0 ? 'text-rose-600' : 'text-slate-300'}>{report.emergencyLeaveDays}</span>
                                </span>
                            }
                            color="bg-slate-50 text-slate-500"
                        />
                        <StatCard icon={CalendarCheck} label={t('out_work_days', { defaultValue: 'Out-Work Days' })} value={report.outWorkDays} color="bg-indigo-50 text-indigo-600" />
                        <StatCard icon={Timer} label={t('overtime_approved', { defaultValue: 'Overtime (Approved)' })} value={report.formattedApprovedOT} color="bg-blue-50 text-blue-600" />
                        <StatCard icon={Timer} label={t('overtime_worked', { defaultValue: 'Overtime (Worked)' })} value={report.totalOT} color="bg-blue-50 text-blue-600" />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium -mt-4">
                        {t('worked_calculation_note', { defaultValue: '"Worked" is calculated from your actual punch times (first check-in to last check-out) — it is not shifted to the scheduled start, so a late arrival still shortens this total even when the lateness itself is excused below.' })}
                    </p>

                    {/* Punctuality Breakdown — same late/early-out → excused → chargeable → deduction
                        chain shown on the HR-facing Attendance page, scoped to just this employee. */}
                    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('punctuality_breakdown', { defaultValue: 'Punctuality Breakdown' })}</span>
                            {report.totalDeduction > 0 && (
                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                                    {t('deduction_pts', { defaultValue: 'Deduction: {{pts}} pts', pts: report.totalDeduction })}
                                </span>
                            )}
                        </div>
                        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                            {(() => {
                                const lateRecorded = report.totalLate + report.totalExcusedMins;
                                const latePct = lateRecorded > 0 ? (report.totalLate / lateRecorded) * 100 : 0;
                                return (
                                    <div className="p-4 space-y-2">
                                        <p className="text-xs font-black text-slate-600 uppercase tracking-wide">{t('late_arrival', { defaultValue: 'Late Arrival' })}</p>
                                        {lateRecorded > 0 && (
                                            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                                                <div style={{ width: `${latePct}%` }} className="bg-red-500" />
                                                <div style={{ width: `${100 - latePct}%` }} className="bg-emerald-500" />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">{t('recorded_late', { defaultValue: 'Recorded late' })}</span>
                                            <span className="font-bold text-slate-700">{formatMinutesAsHM(lateRecorded)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">{t('excused', { defaultValue: '− Excused' })}</span>
                                            <span className="font-bold text-emerald-600">{formatMinutesAsHM(report.totalExcusedMins)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                            <span className="font-black text-slate-600">{t('chargeable', { defaultValue: '= Chargeable' })}</span>
                                            <span className={`font-black ${report.totalLate > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatMinutesAsHM(report.totalLate)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                            {(() => {
                                const earlyRecorded = report.totalEarly + report.totalExcusedEarlyOutMins;
                                const earlyPct = earlyRecorded > 0 ? (report.totalEarly / earlyRecorded) * 100 : 0;
                                return (
                                    <div className="p-4 space-y-2">
                                        <p className="text-xs font-black text-slate-600 uppercase tracking-wide">{t('early_departure', { defaultValue: 'Early Departure' })}</p>
                                        {earlyRecorded > 0 && (
                                            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                                                <div style={{ width: `${earlyPct}%` }} className="bg-amber-500" />
                                                <div style={{ width: `${100 - earlyPct}%` }} className="bg-emerald-500" />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">{t('recorded_early_out', { defaultValue: 'Recorded early-out' })}</span>
                                            <span className="font-bold text-slate-700">{formatMinutesAsHM(earlyRecorded)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">{t('excused', { defaultValue: '− Excused' })}</span>
                                            <span className="font-bold text-emerald-600">{formatMinutesAsHM(report.totalExcusedEarlyOutMins)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                            <span className="font-black text-slate-600">{t('chargeable', { defaultValue: '= Chargeable' })}</span>
                                            <span className={`font-black ${report.totalEarly > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{formatMinutesAsHM(report.totalEarly)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <p className="px-4 pb-3 text-[10px] text-slate-400 font-medium">
                            {t('recorded_derived_note', { defaultValue: '"Recorded" is derived (chargeable + excused) to show how much was logged before any excused allowance was applied.' })}
                        </p>
                    </div>

                    <DailyBreakdownTable rows={rows} empLeaves={report.empLeaves} />

                    {report.empLeaves.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('leave_records_in_this_range', { defaultValue: 'Leave Records in This Range' })}</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {report.empLeaves.map(leave => (
                                    <div key={leave.id} className="p-3 flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-700">{leave.leaveType.name}</span>
                                        <span className="text-slate-500">{format(parseISO(leave.startDate), 'dd MMM')} – {format(parseISO(leave.endDate), 'dd MMM yyyy')} ({leave.daysCount} {t('days', { defaultValue: 'days' })})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {report.empOvertimes.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('overtime_records_in_this_range', { defaultValue: 'Overtime Records in This Range' })}</span>
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
