import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    LineChart,
    Line,
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
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 font-outfit">{t('performance_trends_report')}</h3>
                <p className="text-sm text-slate-500">{t('avg_rating_subtitle')}</p>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                            cursor={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {departments.map((dept, index) => (
                            <Line
                                key={dept}
                                type="monotone"
                                dataKey={dept}
                                name={dept}
                                stroke={colors[index % colors.length]}
                                strokeWidth={3}
                                dot={{ r: 4, strokeWidth: 2 }}
                                activeDot={{ r: 8 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default EvaluationAnalytics;
