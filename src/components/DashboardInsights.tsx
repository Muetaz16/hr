import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users,
    UserPlus,
    UserCog,
    ArrowRightLeft,
    Filter,
    CalendarClock,
    Building2,
    BarChart3,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import type { DashboardAnalytics } from '../services/dashboardService';

interface Props {
    data: DashboardAnalytics;
}

const tooltipStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(12px)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
    padding: '10px 14px',
    fontWeight: 600,
} as const;

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; subtitle: string }> = ({ icon: Icon, title, subtitle }) => (
    <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-primary-50 text-primary-600 rounded-2xl border border-primary-100">
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <h3 className="font-bold text-slate-800 tracking-tight">{title}</h3>
            <p className="text-xs font-medium text-slate-400">{subtitle}</p>
        </div>
    </div>
);

const DashboardInsights: React.FC<Props> = ({ data }) => {
    const { t } = useTranslation();

    const tiles = [
        { label: t('active_employees', { defaultValue: 'Active Employees' }), value: data.workforce.active, icon: Users, color: 'text-primary-600', bg: 'bg-primary-50' },
        { label: t('new_hires_this_year', { defaultValue: 'New Hires (This Year)' }), value: data.workforce.newHiresThisYear, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: t('pending_enrollment', { defaultValue: 'Pending Enrollment' }), value: data.workforce.pendingEnrollment, icon: UserCog, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: t('transferred_out', { defaultValue: 'Transferred Out' }), value: data.workforce.transferred, icon: ArrowRightLeft, color: 'text-slate-600', bg: 'bg-slate-100' },
    ];

    const funnelColors = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981'];
    const expiryColors: Record<string, string> = { expired: '#ef4444', d30: '#f59e0b', d60: '#eab308', d90: '#22c55e' };

    const hasHeadcount = data.headcountByDepartment.length > 0;
    const hasLeave = data.leaveByType.length > 0;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary-50 rounded-2xl text-primary-600 border border-primary-100">
                    <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-outfit font-black text-slate-800 tracking-tight">
                        {t('workforce_insights', { defaultValue: 'Workforce Insights' })}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                        {t('workforce_insights_subtitle', { defaultValue: 'Company-wide headcount, hiring pipeline and contract compliance at a glance' })}
                    </p>
                </div>
            </div>

            {/* Workforce summary tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {tiles.map((tile, idx) => (
                    <div key={idx} className="glass-card p-6 rounded-[28px] relative overflow-hidden group">
                        <tile.icon className="absolute -bottom-5 -right-5 w-24 h-24 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity" />
                        <div className={`inline-flex p-3 rounded-2xl ${tile.bg} ${tile.color} shadow-sm mb-5`}>
                            <tile.icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.15em] mb-2">{tile.label}</h3>
                        <p className="text-3xl font-outfit font-black text-slate-800 tracking-tighter">{tile.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recruitment funnel */}
                <div className="glass-card p-8 rounded-[32px] border-none shadow-premium-shadow">
                    <SectionHeader
                        icon={Filter}
                        title={t('recruitment_funnel', { defaultValue: 'Recruitment Funnel' })}
                        subtitle={t('recruitment_funnel_subtitle', { defaultValue: 'Candidates by pipeline stage' })}
                    />
                    <div className="space-y-4">
                        {data.recruitmentFunnel.map((step, idx) => {
                            const max = Math.max(...data.recruitmentFunnel.map(s => s.count), 1);
                            const pct = Math.round((step.count / max) * 100);
                            return (
                                <div key={step.stage}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-sm font-bold text-slate-600">{step.label}</span>
                                        <span className="text-sm font-black text-slate-800">{step.count}</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${pct}%`, backgroundColor: funnelColors[idx % funnelColors.length] }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
                        <div className="text-center">
                            <p className="text-2xl font-outfit font-black text-slate-800">{data.recruitment.openRequisitions}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('open_requisitions', { defaultValue: 'Open Requisitions' })}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-outfit font-black text-slate-800">{data.recruitment.positionsToFill}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('positions_to_fill', { defaultValue: 'Positions to Fill' })}</p>
                        </div>
                    </div>
                </div>

                {/* Contract expiry timeline */}
                <div className="glass-card p-8 rounded-[32px] border-none shadow-premium-shadow">
                    <SectionHeader
                        icon={CalendarClock}
                        title={t('contract_expiry_timeline', { defaultValue: 'Contract Expiry Timeline' })}
                        subtitle={t('contract_expiry_subtitle', { defaultValue: 'Upcoming renewals by window' })}
                    />
                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.contractExpiry} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} contentStyle={tooltipStyle} />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={56}>
                                    {data.contractExpiry.map(entry => (
                                        <Cell key={entry.bucket} fill={expiryColors[entry.bucket] || '#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Headcount by department */}
                <div className="glass-card p-8 rounded-[32px] border-none shadow-premium-shadow">
                    <SectionHeader
                        icon={Building2}
                        title={t('headcount_by_department', { defaultValue: 'Headcount by Department' })}
                        subtitle={t('headcount_by_department_subtitle', { defaultValue: 'Active staff distribution' })}
                    />
                    {hasHeadcount ? (
                        <div style={{ height: Math.max(220, data.headcountByDepartment.length * 38) }} className="w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.headcountByDepartment}
                                    layout="vertical"
                                    margin={{ top: 0, right: 24, left: 10, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} contentStyle={tooltipStyle} />
                                    <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} maxBarSize={26} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                            {t('no_data', { defaultValue: 'No data available' })}
                        </div>
                    )}
                </div>

                {/* Leave volume by type */}
                <div className="glass-card p-8 rounded-[32px] border-none shadow-premium-shadow">
                    <SectionHeader
                        icon={BarChart3}
                        title={t('leave_volume_by_type', { defaultValue: 'Leave Requests by Type' })}
                        subtitle={t('leave_volume_subtitle', { defaultValue: 'This year, all statuses' })}
                    />
                    {hasLeave ? (
                        <div style={{ height: Math.max(220, data.leaveByType.length * 44) }} className="w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.leaveByType}
                                    layout="vertical"
                                    margin={{ top: 0, right: 24, left: 10, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} contentStyle={tooltipStyle} />
                                    <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} maxBarSize={26} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                            {t('no_data', { defaultValue: 'No data available' })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardInsights;
