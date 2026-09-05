import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { AttendanceSummaryEmployee } from '../services/attendanceService';

// Fixed status meaning (good/warning/critical), not free categorical identity — the same
// emerald/amber/rose convention already used throughout this app for paid/unpaid/emergency
// leave and late/early-out. Stepped one shade darker than the -500 defaults so the trio clears
// the OKLCH lightness band on this app's dark maroon surface (validated with the dataviz
// skill's validate_palette.js against both light and #3a151d dark surfaces).
const STATUS = {
    good: '#059669', // emerald-600
    warning: '#d97706', // amber-600
    critical: '#e11d48', // rose-600
};

interface Props {
    rows: AttendanceSummaryEmployee[];
}

const cardClass = 'bg-white border border-[#511d29]/10 rounded-xl p-5 shadow-sm';

const AttendanceInsights: React.FC<Props> = ({ rows }) => {
    if (rows.length === 0) return null;

    const paidDays = rows.reduce((s, r) => s + (r.paidLeaveDays || 0), 0);
    const unpaidDays = rows.reduce((s, r) => s + (r.unpaidLeaveDays || 0), 0);
    const emergencyDays = rows.reduce((s, r) => s + (r.emergencyLeaveDays || 0), 0);
    const totalLeaveDays = paidDays + unpaidDays + emergencyDays;
    const leaveData = [{ name: 'Leave Days', Paid: paidDays, Unpaid: unpaidDays, Emergency: emergencyDays }];

    // Not mutually exclusive — an employee can be both late and early-out in the same period —
    // so this is 3 independent counts (a comparison), not a stacked part-to-whole.
    const onTimeCount = rows.filter(r => r.totalLateMins === 0 && r.totalEarlyOutMins === 0).length;
    const lateCount = rows.filter(r => r.totalLateMins > 0).length;
    const earlyOutCount = rows.filter(r => r.totalEarlyOutMins > 0).length;
    const punctualityData = [
        { name: 'On-Time', count: onTimeCount, color: STATUS.good },
        { name: 'Late', count: lateCount, color: STATUS.critical },
        { name: 'Early-Out', count: earlyOutCount, color: STATUS.warning },
    ];

    const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 };

    return (
        <div className="grid md:grid-cols-2 gap-4">
            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Leave Breakdown</span>
                    <span className="text-xs font-bold text-slate-400">{totalLeaveDays} days total</span>
                </div>
                {totalLeaveDays === 0 ? (
                    <p className="text-xs font-bold text-slate-400 py-6 text-center">No leave days recorded in this period.</p>
                ) : (
                    <>
                        <div className="h-10 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={leaveData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                    <XAxis type="number" hide domain={[0, totalLeaveDays]} />
                                    <YAxis type="category" dataKey="name" hide />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={tooltipStyle} />
                                    <Bar dataKey="Paid" stackId="a" fill={STATUS.good} radius={[4, 0, 0, 4]} />
                                    <Bar dataKey="Unpaid" stackId="a" fill={STATUS.warning} />
                                    <Bar dataKey="Emergency" stackId="a" fill={STATUS.critical} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3">
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS.good }} /> Paid: {paidDays}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS.warning }} /> Unpaid: {unpaidDays}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS.critical }} /> Emergency: {emergencyDays}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Punctuality Snapshot</span>
                    <span className="text-xs font-bold text-slate-400">{rows.length} employees</span>
                </div>
                <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={punctualityData} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={14}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={tooltipStyle}
                                formatter={(value: any) => [`${value ?? 0} employee${value === 1 ? '' : 's'}`, '']}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                                {punctualityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                <LabelList dataKey="count" position="right" style={{ fontWeight: 900, fontSize: 12, fill: '#334155' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AttendanceInsights;
