import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarClock, Megaphone, ArrowRight, Inbox } from 'lucide-react';
import { staffHubService } from '../services/staffHubService';
import type { LeaveRequest, Announcement } from '../services/staffHubService';

interface Props {
    employeeId: string;
    userId: string;
    departmentId?: string | null;
}

const LEAVE_LABELS: Record<string, string> = {
    PAID_HOLIDAY: 'Paid Leave',
    UNPAID_LEAVE: 'Unpaid Leave',
    EMERGENCY_LEAVE: 'Emergency Leave',
    LATE_COMING: 'Late Coming',
    EARLY_LEAVING: 'Early Leaving',
    HOURS_LEAVE: 'Hourly Permission',
};

const statusMeta = (status: LeaveRequest['status']): { label: string; cls: string } => {
    switch (status) {
        case 'COMPLETED':
            return { label: 'Approved', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
        case 'REJECTED':
            return { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-100' };
        case 'PENDING':
            return { label: 'Pending', cls: 'bg-amber-50 text-amber-600 border-amber-100' };
        default:
            return { label: 'In Review', cls: 'bg-blue-50 text-blue-600 border-blue-100' };
    }
};

const fmtDay = (d?: string) => (d ? format(new Date(d), 'MMM d') : '');

const EmployeeDashboardPanels: React.FC<Props> = ({ employeeId, userId, departmentId }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { data: requests = [] } = useQuery<LeaveRequest[]>({
        queryKey: ['my-requests', employeeId],
        queryFn: () => staffHubService.getMyRequests(employeeId),
        enabled: !!employeeId,
        staleTime: 60 * 1000,
    });

    const { data: announcements = [] } = useQuery<Announcement[]>({
        queryKey: ['my-announcements', userId, departmentId],
        queryFn: () => staffHubService.getAnnouncements(userId, departmentId || 'undefined'),
        enabled: !!userId,
        staleTime: 60 * 1000,
    });

    const recentRequests = [...requests]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    const recentAnnouncements = [...announcements]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* My Requests */}
            <div className="glass-card p-8 rounded-[32px] border-none shadow-premium-shadow">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary-50 text-primary-600 rounded-2xl border border-primary-100">
                            <CalendarClock className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 tracking-tight">{t('my_requests', { defaultValue: 'My Requests' })}</h3>
                            <p className="text-xs font-medium text-slate-400">{t('my_requests_subtitle', { defaultValue: 'Your leave & permission requests' })}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/staff-hub')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:gap-2 transition-all"
                    >
                        {t('view_all', { defaultValue: 'View all' })} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {recentRequests.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-300">
                        <Inbox className="w-8 h-8" />
                        <span className="text-sm font-semibold text-slate-400">{t('no_requests_yet', { defaultValue: 'No requests yet' })}</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentRequests.map((req) => {
                            const meta = statusMeta(req.status);
                            const range = req.endDate && req.endDate !== req.startDate
                                ? `${fmtDay(req.startDate)} → ${fmtDay(req.endDate)}`
                                : fmtDay(req.startDate);
                            return (
                                <div
                                    key={req.id}
                                    className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 bg-white/60 hover:bg-white transition-colors"
                                >
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-700 text-sm truncate">{LEAVE_LABELS[req.type] || req.type}</p>
                                        <p className="text-xs text-slate-400 font-medium">{range}</p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border shrink-0 ${meta.cls}`}>
                                        {meta.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Announcements */}
            <div className="glass-card p-8 rounded-[32px] border-none shadow-premium-shadow">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                            <Megaphone className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 tracking-tight">{t('announcements', { defaultValue: 'Announcements' })}</h3>
                            <p className="text-xs font-medium text-slate-400">{t('announcements_subtitle', { defaultValue: 'Latest news & updates' })}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/announcements')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:gap-2 transition-all"
                    >
                        {t('view_all', { defaultValue: 'View all' })} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {recentAnnouncements.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-300">
                        <Megaphone className="w-8 h-8" />
                        <span className="text-sm font-semibold text-slate-400">{t('no_announcements', { defaultValue: 'No announcements found' })}</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentAnnouncements.map((ann) => (
                            <div key={ann.id} className="p-4 rounded-2xl border border-slate-100 bg-white/60 hover:bg-white transition-colors">
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <p className="font-bold text-slate-700 text-sm truncate">{ann.title}</p>
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{fmtDay(ann.createdAt)}</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium line-clamp-2">{ann.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeDashboardPanels;
