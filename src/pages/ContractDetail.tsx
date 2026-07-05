import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../services/employeeService';
import { departmentService, groupService } from '../services/departmentService';
import { roleThemes } from '../config/roleThemes';
import { useAuth } from '../context/AuthContext';
import type { UserRole, Contract } from '../types';
import {
    Calendar,
    ArrowLeft,
    Clock,
    Shield,
    User,
    Building2,
    AlertCircle,
    FileText,
    History,
    Plus,
    XCircle,
    ArrowUpRight,
    Ban,
    BadgeCheck
} from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import Modal from '../components/Modal';
import { toast } from 'sonner';

const ContractDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
    const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);

    const [renewData, setRenewData] = useState({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        salary: 0,
        contractNumber: '',
        type: 'Limited',
        notes: ''
    });

    const [terminateData, setTerminateData] = useState({
        terminationDate: format(new Date(), 'yyyy-MM-dd'),
        reason: 'Resignation',
        notes: ''
    });

    const { data: employee, isLoading, error } = useQuery({
        queryKey: ['employee-contract', id],
        queryFn: async () => {
            if (!id) throw new Error("ID is required");
            const emp = await employeeService.getEmployeeById(id);
            
            const [depts, groups] = await Promise.all([
                departmentService.getAllDepartments(),
                groupService.getAllGroups()
            ]);

            const deptName = depts.find(d => d.id === emp.departmentId)?.name || 'N/A';
            const groupName = groups.find(g => g.id === emp.groupId)?.name || 'N/A';

            return { ...emp, deptName, groupName };
        },
        enabled: !!id
    });

    const renewMutation = useMutation({
        mutationFn: (data: any) => employeeService.renewContract(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employee-contract', id] });
            setIsRenewModalOpen(false);
            toast.success("Contract renewed successfully");
        },
        onError: () => toast.error("Failed to renew contract")
    });

    const terminateMutation = useMutation({
        mutationFn: (data: any) => employeeService.terminateEmployee(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employee-contract', id] });
            setIsTerminateModalOpen(false);
            toast.success("Employee offboarded successfully");
        },
        onError: () => toast.error("Failed to process offboarding")
    });

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    if (error || !employee) return (
        <div className="p-8 text-center space-y-4">
            <AlertCircle size={48} className="mx-auto text-red-500" />
            <h2 className="text-xl font-bold text-slate-800">{t('error_loading_contract')}</h2>
            <button onClick={() => navigate(-1)} className="text-indigo-600 font-bold hover:underline">
                {t('go_back')}
            </button>
        </div>
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const contractEndDate = employee.contractEndDate ? parseISO(employee.contractEndDate) : null;
    const daysLeft = contractEndDate ? differenceInDays(contractEndDate, today) : null;
    const isExpired = daysLeft !== null && daysLeft < 0;
    const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
    const isMedium = daysLeft !== null && daysLeft > 7 && daysLeft <= 30;
    const isInactive = employee.contractStatus === 'Inactive' || employee.contractStatus === 'Terminated';

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors group"
                >
                    <div className="p-2 rounded-xl group-hover:bg-slate-100 transition-colors">
                        <ArrowLeft size={20} />
                    </div>
                    <span className="font-bold">{t('back_to_list')}</span>
                </button>
                <div className="flex items-center gap-3">
                {isInactive ? (
                    <div className="flex flex-col gap-2">
                        <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white border border-slate-800 text-center">
                           {t('inactive', { defaultValue: 'INACTIVE' })}
                        </span>
                    </div>
                ) : (
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isExpired || isUrgent ? 'bg-red-50 text-red-600 border border-red-100' :
                            isMedium ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}>
                            {isExpired ? t('status_expired') : isUrgent ? t('urgent') : isMedium ? t('expiring_soon') : t('status_active')}
                        </span>
                    )}
                </div>
            </div>

            {/* Profile Overview Card */}
            <div className="glass-card p-8 rounded-[40px] shadow-2xl shadow-slate-200/50 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white text-4xl font-black shadow-xl shrink-0`}>
                    {employee.fullName.charAt(0)}
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-outfit font-black text-slate-800 mb-2">{employee.fullName}</h1>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-slate-500 font-bold uppercase tracking-tight">
                        <div className="flex items-center gap-1.5">
                            <Shield size={16} className="text-indigo-500" />
                            {employee.staffId || 'NO-ID'}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Building2 size={16} className="text-purple-500" />
                            {employee.deptName}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <User size={16} className="text-amber-500" />
                            {t(`role_${employee.role.toLowerCase()}`)}
                        </div>
                    </div>
                </div>

                {/* Header Actions */}
                {!isInactive && (
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => {
                                setRenewData({
                                    ...renewData,
                                    salary: employee.baseSalary,
                                    contractNumber: employee.contractNumber ? `${parseInt(employee.contractNumber) + 1}${employee.contractNumber.replace(/[0-9]/g, '') || 'nd'}` : '2nd'
                                });
                                setIsRenewModalOpen(true);
                            }}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                        >
                            <ArrowUpRight size={16} /> {t('renew_contract', { defaultValue: 'Renew Contract' })}
                        </button>
                        <button 
                            onClick={() => setIsTerminateModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white border border-red-200 text-red-500 text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm"
                        >
                            <Ban size={16} /> {t('offboarding', { defaultValue: 'Offboarding' })}
                        </button>
                    </div>
                )}

                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 -z-10"></div>
            </div>

            {/* Contract Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Days Remaining Card */}
                <div className={`rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl ${
                    isInactive ? 'bg-slate-800' :
                    isExpired ? 'bg-slate-900' : 
                    isUrgent ? 'bg-red-500' : 'bg-indigo-600'
                }`}>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={20} className="text-white/80" />
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-white/70">{t('validity_period')}</span>
                            </div>
                            <h2 className="text-5xl font-outfit font-black mb-1">
                                {isInactive ? t('inactive', { defaultValue: 'INACTIVE' }) : (daysLeft !== null ? Math.abs(daysLeft) : '--')}
                            </h2>
                            <p className="text-lg font-bold text-white/90">
                                {isInactive ? t('contract_inactive', { defaultValue: 'Contract Inactive' }) : (isExpired ? t('days_overdue') : t('days_remaining'))}
                            </p>
                        </div>

                        {!isInactive && (
                            <div className="mt-8">
                                <div className="w-full bg-white/20 h-2 rounded-full mb-3 px-0.5 py-0.5 overflow-hidden">
                                    <div
                                        className="h-full bg-white rounded-full transition-all duration-1000"
                                        style={{ width: isExpired ? '100%' : `${Math.max(0, Math.min(100, (daysLeft || 0) / 3.65))}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/60">
                                    <span>{employee.contractStartDate ? format(new Date(employee.contractStartDate), 'dd MMM yyyy') : 'N/A'}</span>
                                    <span>{employee.contractEndDate ? format(new Date(employee.contractEndDate), 'dd MMM yyyy') : 'N/A'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                {/* Contract Details Listing */}
                <div className="glass-card p-8 rounded-[32px] shadow-xl shadow-slate-100 border border-slate-50 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
                            <FileText size={20} />
                        </div>
                        <h3 className="font-outfit font-bold text-slate-800">{t('contract_profile')}</h3>
                    </div>

                    <div className="space-y-4">
                        <DetailItem
                            label={t('contract_type')}
                            value={t(`contract_${employee.contractType?.toLowerCase()}`)}
                            icon={<BadgeCheck className="text-emerald-500" size={16} />}
                        />
                        <DetailItem
                            label={t('contract_number', { defaultValue: 'Contract No.' })}
                            value={employee.contractNumber || '1st'}
                            icon={<FileText className="text-slate-400" size={16} />}
                        />
                        <DetailItem
                            label={t('base_salary')}
                            value={`${employee.baseSalary} LYD`}
                            icon={<Plus className="text-emerald-400" size={16} />}
                        />
                        <DetailItem
                            label={t('contract_start')}
                            value={employee.contractStartDate ? format(new Date(employee.contractStartDate), 'dd MMM yyyy') : 'N/A'}
                            icon={<Calendar className="text-indigo-400" size={16} />}
                        />
                        <DetailItem
                            label={t('contract_end')}
                            value={employee.contractEndDate ? format(new Date(employee.contractEndDate), 'dd MMM yyyy') : 'N/A'}
                            icon={<Calendar className="text-red-400" size={16} />}
                            bold={isUrgent || isExpired}
                        />
                    </div>
                </div>
            </div>

            {/* Contract History */}
            <div className="space-y-6 mt-12">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <History size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 leading-none">{t('contract_history', { defaultValue: 'Archived Contracts' })}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{t('history_subtitle', { defaultValue: 'Review previous contract terms and historical data' })}</p>
                    </div>
                </div>

                <div className="glass-card rounded-[32px] overflow-hidden border border-slate-100 shadow-xl shadow-slate-100/50">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('contract_no', { defaultValue: 'No.' })}</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('duration', { defaultValue: 'Duration' })}</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('pos_cat', { defaultValue: 'Position & Category' })}</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('leave_usage_snapshot', { defaultValue: 'Leave Usage (P/E/U)' })}</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('salary', { defaultValue: 'Salary' })}</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('status', { defaultValue: 'Status' })}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(employee.contracts || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-10 text-center text-slate-400 italic text-sm">
                                            {t('no_history', { defaultValue: 'No historical contracts found.' })}
                                        </td>
                                    </tr>
                                ) : (
                                    employee.contracts?.map((c: Contract) => (
                                        <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-700">{c.contractNumber || '---'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{c.type || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-600">{format(new Date(c.startDate), 'dd MMM yyyy')}</span>
                                                    {c.endDate && <span className="text-[10px] font-bold text-slate-400">→ {format(new Date(c.endDate), 'dd MMM yyyy')}</span>}
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-700 leading-tight">{c.position || '---'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{c.jobCategory || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{c.holidaysUsed || 0}</span>
                                                        <span className="text-[8px] font-black text-slate-300 uppercase">{t('paid', { defaultValue: 'Paid' })}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{c.emergencyHolidaysUsed || 0}</span>
                                                        <span className="text-[8px] font-black text-slate-300 uppercase">{t('emerg', { defaultValue: 'Emerg' })}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{c.unpaidHolidaysUsed || 0}</span>
                                                        <span className="text-[8px] font-black text-slate-300 uppercase">{t('unpaid', { defaultValue: 'Unpaid' })}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className="text-xs font-black text-slate-700">{c.salary?.toLocaleString()} LYD</span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                                                    c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                    c.status === 'TERMINATED' ? 'bg-red-100 text-red-700 border border-red-200' :
                                                    'bg-slate-100 text-slate-500 border border-slate-200'
                                                }`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Renew Modal */}
            <Modal 
                isOpen={isRenewModalOpen} 
                onClose={() => setIsRenewModalOpen(false)}
                title={t('renew_contract_modal', { defaultValue: 'Renew Contract' })}
            >
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                            <ArrowUpRight size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 leading-tight">{t('renew_contract_modal')}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{employee.fullName}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('new_start_date')}</label>
                            <input 
                                type="date" 
                                value={renewData.startDate}
                                onChange={e => setRenewData({...renewData, startDate: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('new_end_date')}</label>
                            <input 
                                type="date" 
                                value={renewData.endDate}
                                onChange={e => setRenewData({...renewData, endDate: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('new_salary')}</label>
                            <input 
                                type="number" 
                                value={renewData.salary}
                                onChange={e => setRenewData({...renewData, salary: Number(e.target.value)})}
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('contract_number')}</label>
                            <input 
                                type="text" 
                                value={renewData.contractNumber}
                                onChange={e => setRenewData({...renewData, contractNumber: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 mb-8">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('notes')}</label>
                        <textarea 
                            value={renewData.notes}
                            onChange={e => setRenewData({...renewData, notes: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-indigo-100 min-h-[80px]"
                            placeholder="Add renewal terms or internal notes..."
                        />
                    </div>

                    <button 
                        onClick={() => renewMutation.mutate(renewData)}
                        disabled={renewMutation.isPending}
                        className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center"
                    >
                        {renewMutation.isPending ? <Clock className="animate-spin" /> : t('confirm_renewal')}
                    </button>
                </div>
            </Modal>

            {/* Terminate Modal */}
            <Modal 
                isOpen={isTerminateModalOpen} 
                onClose={() => setIsTerminateModalOpen(false)}
                title={t('terminate_contract_modal', { defaultValue: 'Offboarding' })}
            >
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                            <XCircle size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 leading-tight">{t('terminate_contract_modal')}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{employee.fullName}</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('termination_date')}</label>
                            <input 
                                type="date" 
                                value={terminateData.terminationDate}
                                onChange={e => setTerminateData({...terminateData, terminationDate: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-red-100"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('reason')}</label>
                            <select 
                                value={terminateData.reason}
                                onChange={e => setTerminateData({...terminateData, reason: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-red-100 appearance-none"
                            >
                                <option value="Resignation">Resignation</option>
                                <option value="Retirement">Retirement</option>
                                <option value="Termination for Cause">Termination for Cause</option>
                                <option value="Contract Expiry">Contract Expiry</option>
                                <option value="Mutual Agreement">Mutual Agreement</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('internal_notes')}</label>
                            <textarea 
                                value={terminateData.notes}
                                onChange={e => setTerminateData({...terminateData, notes: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-slate-800 border-transparent focus:ring-2 focus:ring-red-100 min-h-[100px]"
                                placeholder="Final exit interview notes or administrative remarks..."
                            />
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-8 flex items-start gap-3">
                        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-tight">
                            {t('termination_warning', { defaultValue: 'Warning: This action will mark the contract as inactive and set the employee status to Terminated. This cannot be undone through this interface.' })}
                        </p>
                    </div>

                    <button 
                        onClick={() => terminateMutation.mutate(terminateData)}
                        disabled={terminateMutation.isPending}
                        className="w-full py-4 rounded-2xl bg-red-600 text-white font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-100 flex items-center justify-center"
                    >
                        {terminateMutation.isPending ? <Clock className="animate-spin" /> : t('confirm_offboarding')}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

const DetailItem: React.FC<{ label: string, value: string, icon: React.ReactNode, bold?: boolean }> = ({ label, value, icon, bold }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 group hover:translate-x-1 transition-all">
        <div className="flex items-center gap-3">
            <div className="opacity-40 group-hover:opacity-100 transition-opacity">
                {icon}
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <span className={`text-sm ${bold ? 'font-black text-red-600' : 'font-bold text-slate-700'}`}>{value}</span>
    </div>
);

export default ContractDetail;
