import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { employeeService } from '../services/employeeService';
import { departmentService, groupService } from '../services/departmentService';
import { roleThemes } from '../config/roleThemes';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import {
    Search,
    Filter,
    FileText,
    ArrowRight,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ChevronDown,
    MoreHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { differenceInDays, parseISO, format } from 'date-fns';

const ContractManagement: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const { data, isLoading } = useQuery({
        queryKey: ['contract-management'],
        queryFn: async () => {
            const [employees, departments, groups] = await Promise.all([
                employeeService.getAllEmployees(),
                departmentService.getAllDepartments(),
                groupService.getAllGroups()
            ]);

            const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));
            const groupMap = Object.fromEntries(groups.map(g => [g.id, g.name]));

            return employees.map(emp => ({
                ...emp,
                deptName: deptMap[emp.departmentId] || 'N/A',
                groupName: groupMap[emp.groupId] || 'N/A'
            }));
        }
    });

    const filteredEmployees = (data || []).filter(emp => {
        const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.staffId && emp.staffId.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'expiring' && emp.contractEndDate && differenceInDays(parseISO(emp.contractEndDate), new Date()) <= 30 && differenceInDays(parseISO(emp.contractEndDate), new Date()) >= 0) ||
            (statusFilter === 'expired' && emp.contractEndDate && new Date(emp.contractEndDate) < new Date()) ||
            (statusFilter === 'active' && emp.contractStatus === 'Active');

        return matchesSearch && matchesStatus;
    });

    // KPI Calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalActive = (data || []).filter(e => e.contractStatus === 'Active').length;
    const criticalExpirations = (data || []).filter(e => {
        if (!e.contractEndDate) return false;
        const days = differenceInDays(parseISO(e.contractEndDate), today);
        return days <= 7; // Both Urgent and Expired
    }).length;
    const expiringSoon = (data || []).filter(e => {
        if (!e.contractEndDate) return false;
        const days = differenceInDays(parseISO(e.contractEndDate), today);
        return days > 7 && days <= 30;
    }).length;

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-outfit font-black text-slate-800 tracking-tight">{t('contract_management')}</h1>
                <p className="text-slate-500 mt-1 font-medium">{t('contract_management_subtitle')}</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    label={t('active_contracts')}
                    value={totalActive}
                    icon={<CheckCircle2 size={24} />}
                    color="emerald"
                />
                <KPICard
                    label={t('expiring_soon')}
                    value={expiringSoon}
                    icon={<Clock size={24} />}
                    color="amber"
                />
                <KPICard
                    label={t('critical_contracts')}
                    value={criticalExpirations}
                    icon={<AlertTriangle size={24} />}
                    color="red"
                />
            </div>

            {/* Toolbar */}
            <div className="glass-card p-6 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl shadow-slate-200/50">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('search_by_name_id')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-initial">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                        >
                            <option value="all">{t('all_contracts')}</option>
                            <option value="active">{t('status_active')}</option>
                            <option value="expiring">{t('expiring_soon')}</option>
                            <option value="expired">{t('status_expired')}</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="glass-card rounded-[40px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-white">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('employee_details')}</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('contract_type')}</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('start_date')}</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('expiry_date')}</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('status')}</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredEmployees.map((emp) => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const days = emp.contractEndDate ? differenceInDays(parseISO(emp.contractEndDate), today) : null;
                                const isExpired = days !== null && days < 0;
                                const isUrgent = days !== null && days >= 0 && days <= 7;
                                const isMedium = days !== null && days > 7 && days <= 30;

                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-105 transition-transform`}>
                                                    {emp.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 leading-none mb-1 group-hover:text-indigo-600 transition-colors">{emp.fullName}</p>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-tight">
                                                        <span className="text-indigo-500">{emp.staffId || 'NO-ID'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                        <span>{emp.deptName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                                <FileText size={12} />
                                                {t(`contract_${emp.contractType?.toLowerCase()}`)}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className="text-sm font-bold text-slate-700">
                                                {emp.contractStartDate ? format(new Date(emp.contractStartDate), 'dd MMM yyyy') : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-sm font-bold ${isUrgent || isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                                                    {emp.contractEndDate ? format(new Date(emp.contractEndDate), 'dd MMM yyyy') : 'N/A'}
                                                </span>
                                                {days !== null && !isExpired && (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                        {days} {t('days_left')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isExpired || isUrgent ? 'bg-red-50 text-red-600 border border-red-100' :
                                                isMedium ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                    'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                }`}>
                                                {isExpired ? t('status_expired') : isUrgent ? t('urgent') : isMedium ? t('expiring_soon') : t('status_active')}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    to={`/contracts/${emp.id}`}
                                                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm"
                                                >
                                                    <ArrowRight size={16} />
                                                </Link>
                                                <button className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-all border border-transparent">
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const KPICard: React.FC<{ label: string, value: number, icon: React.ReactNode, color: 'emerald' | 'amber' | 'red' }> = ({ label, value, icon, color }) => {
    const colors = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        red: 'bg-red-50 text-red-600 border-red-100'
    };

    return (
        <div className={`glass-card p-6 rounded-[32px] border shadow-xl shadow-slate-100/50 flex items-center justify-between ${colors[color]}`}>
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">{label}</p>
                <p className="text-3xl font-outfit font-black">{value}</p>
            </div>
            <div className="p-4 rounded-3xl bg-white/50 backdrop-blur-sm shadow-sm transition-transform hover:rotate-12">
                {icon}
            </div>
        </div>
    );
};

export default ContractManagement;
