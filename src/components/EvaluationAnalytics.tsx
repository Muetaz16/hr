import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

export interface TrendDataPoint {
    month: string;
    [departmentName: string]: string | number; // Dynamic keys for departments
}

interface Props {
    data: TrendDataPoint[];
    departments: string[];
}

// Validated categorical palette (light surface) — assigned in fixed order, never cycled by rank.
// Verified with the data-viz validator: lightness band / chroma / CVD separation all pass; the
// sub-3:1 contrast warning is covered by the always-present legend + end-of-line direct labels.
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const rows = [...payload]
        .filter((p) => p.value !== null && p.value !== undefined)
        .sort((a, b) => (b.value as number) - (a.value as number));
    if (rows.length === 0) return null;
    return (
        <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur-xl px-4 py-3 shadow-xl min-w-[180px]">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
            <div className="space-y-1.5">
                {rows.map((r) => (
                    <div key={r.dataKey} className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-xs font-semibold text-slate-600 flex-1 truncate">{r.name}</span>
                        <span className="text-xs font-black text-slate-800 tabular-nums">{r.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const EvaluationAnalytics: React.FC<Props> = ({ data, departments }) => {
    const { t } = useTranslation();
    // Legend entries toggle their line on/off, so a busy chart can be narrowed to a few departments.
    const [hidden, setHidden] = useState<Record<string, boolean>>({});

    const colorOf = (dept: string) => COLORS[departments.indexOf(dept) % COLORS.length];

    // Overall average across every visible department/month — a quiet reference baseline.
    const average = useMemo(() => {
        let sum = 0;
        let n = 0;
        data.forEach((point) => {
            departments.forEach((dept) => {
                const v = point[dept];
                if (typeof v === 'number' && !hidden[dept]) {
                    sum += v;
                    n += 1;
                }
            });
        });
        return n > 0 ? Math.round(sum / n) : null;
    }, [data, departments, hidden]);

    const visibleDepts = departments.filter((d) => !hidden[d]);
    // Only clutter the plot with end-of-line labels when there are few enough to not collide.
    const showEndLabels = visibleDepts.length > 0 && visibleDepts.length <= 4;

    if (data.length === 0) {
        return (
            <div className="glass-card p-8 rounded-[2rem] border-none shadow-premium-shadow bg-white/40 backdrop-blur-3xl">
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                    <TrendingUp className="w-8 h-8 opacity-40" />
                    <span className="font-semibold">{t('no_eval_data')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6 md:p-8 rounded-[2rem] relative overflow-hidden border-none shadow-premium-shadow bg-white/40 backdrop-blur-3xl">
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 font-outfit tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        {t('performance_trends_report')}
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-2 ml-14 uppercase tracking-widest">{t('avg_rating_subtitle')}</p>
                </div>
                {average !== null && (
                    <div className="text-right px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('avg_score', { defaultValue: 'Avg Score' })}</p>
                        <p className="text-2xl font-outfit font-black text-slate-800 tabular-nums leading-tight">{average}</p>
                    </div>
                )}
            </div>

            {/* Interactive legend — click to isolate departments */}
            <div className="flex flex-wrap gap-2 mb-6 ml-1">
                {departments.map((dept) => {
                    const isHidden = hidden[dept];
                    const color = colorOf(dept);
                    return (
                        <button
                            key={dept}
                            type="button"
                            onClick={() => setHidden((prev) => ({ ...prev, [dept]: !prev[dept] }))}
                            className={`inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                                isHidden
                                    ? 'border-slate-200 bg-slate-50 text-slate-300'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-sm'
                            }`}
                        >
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                                style={{ backgroundColor: color, opacity: isHidden ? 0.3 : 1 }}
                            />
                            <span className={isHidden ? 'line-through' : ''}>{dept}</span>
                        </button>
                    );
                })}
            </div>

            {/* Chart */}
            <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 16, right: showEndLabels ? 96 : 24, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef2f6" />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            padding={{ left: 20, right: 20 }}
                            dy={8}
                        />
                        <YAxis
                            domain={[0, 100]}
                            ticks={[0, 25, 50, 75, 100]}
                            tick={{ fontSize: 12, fill: '#cbd5e1', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            width={34}
                        />
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                        />
                        {average !== null && (
                            <ReferenceLine
                                y={average}
                                stroke="#cbd5e1"
                                strokeDasharray="6 6"
                                strokeWidth={1.5}
                                label={{ value: `avg ${average}`, position: 'left', fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            />
                        )}
                        {departments.map((dept) => (
                            <Line
                                key={dept}
                                type="monotone"
                                dataKey={dept}
                                name={dept}
                                hide={!!hidden[dept]}
                                stroke={colorOf(dept)}
                                strokeWidth={2.5}
                                connectNulls
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 3, fill: '#fff', stroke: colorOf(dept) }}
                                label={
                                    showEndLabels
                                        ? (props: any) => {
                                              const { x, y, index, value } = props;
                                              if (index !== data.length - 1 || value === null || value === undefined) {
                                                  return <g key={`${dept}-${index}`} />;
                                              }
                                              return (
                                                  <text
                                                      key={`${dept}-label`}
                                                      x={x + 10}
                                                      y={y}
                                                      dy={4}
                                                      fill={colorOf(dept)}
                                                      fontSize={11}
                                                      fontWeight={800}
                                                  >
                                                      {dept}
                                                  </text>
                                              );
                                          }
                                        : false
                                }
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default EvaluationAnalytics;
