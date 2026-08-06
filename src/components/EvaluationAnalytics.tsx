import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

export interface TrendDataPoint {
    month: string;
    [departmentName: string]: string | number; // Dynamic keys for departments
}

interface Props {
    data: TrendDataPoint[];
    departments: string[];
}

const EvaluationAnalytics: React.FC<Props> = ({ data, departments }) => {
    const { t } = useTranslation();
    const colors = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];

    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                {t('no_eval_data')}
            </div>
        );
    }

    return (
        <div className="glass-card p-6 md:p-8 rounded-[2rem] relative overflow-hidden border-none shadow-premium-shadow bg-white/40 backdrop-blur-3xl">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 font-outfit tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        {t('performance_trends_report')}
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-2 ml-14 uppercase tracking-widest">{t('avg_rating_subtitle')}</p>
                </div>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <defs>
                            {departments.map((dept, index) => (
                                <linearGradient key={`grad-${dept}`} id={`color-${index}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0}/>
                                </linearGradient>
                            ))}
                            <filter id="shadow" height="200%">
                                <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000" floodOpacity="0.15" />
                            </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.6} />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            padding={{ left: 30, right: 30 }}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 12, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: t('avg_score'), angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }}
                        />
                        <Tooltip
                            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }}
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                                backdropFilter: 'blur(12px)',
                                borderRadius: '16px', 
                                border: '1px solid rgba(255, 255, 255, 0.5)', 
                                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                padding: '12px 16px',
                                fontWeight: 'bold'
                            }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {departments.map((dept, index) => (
                            <Area
                                key={dept}
                                type="natural"
                                dataKey={dept}
                                name={dept}
                                stroke={colors[index % colors.length]}
                                strokeWidth={4}
                                fillOpacity={1}
                                fill={`url(#color-${index})`}
                                style={{ filter: 'url(#shadow)' }}
                                dot={{ r: 4, strokeWidth: 3, fill: '#fff', stroke: colors[index % colors.length] }}
                                activeDot={{ r: 7, strokeWidth: 4, fill: '#fff', stroke: colors[index % colors.length] }}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default EvaluationAnalytics;
