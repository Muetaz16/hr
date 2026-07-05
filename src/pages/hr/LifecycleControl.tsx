import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../../services/employeeService';
import {
    Search,
    Filter,
    Download,
    Plus,
    Plane,
    AlertCircle,
    FileSpreadsheet,
    Stethoscope,
    Edit3,
    Check,
    X,
    User,
    CreditCard,
    Globe,
    MinusSquare,
    FileSpreadsheet as ExcelIcon
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { format, isPast, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import type { Employee } from '../../types';
import { 
    POSITION_FACTORS, 
    SKILL_FACTORS, 
    SITE_FACTORS, 
    LANGUAGE_FACTORS 
} from '../../constants/factors';

const LifecycleControl: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Employee>>({});

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['employees-lifecycle'],
        queryFn: employeeService.getAllEmployees
    });

    const updateEmployeeMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<Employee> }) => {
            return employeeService.updateEmployee(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees-lifecycle'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            setEditingId(null);
            toast.success(t('update_success', { defaultValue: 'Employee updated successfully' }));
        },
        onError: () => {
            toast.error(t('update_error', { defaultValue: 'Failed to update employee' }));
        }
    });

    const handleQuickLeave = (emp: Employee, type: 'Paid' | 'Emergency' | 'Unpaid', amount: number) => {
        const currentUsed = type === 'Paid'
            ? (emp.holidaysUsed || 0)
            : type === 'Emergency'
                ? (emp.emergencyHolidaysUsed || 0)
                : (emp.unpaidHolidaysUsed || 0);

        const updateData = type === 'Paid'
            ? { holidaysUsed: currentUsed + amount }
            : type === 'Emergency'
                ? { emergencyHolidaysUsed: currentUsed + amount }
                : { unpaidHolidaysUsed: currentUsed + amount };

        updateEmployeeMutation.mutate({ id: emp.id, data: updateData });
    };

    const startEditing = (emp: Employee) => {
        setEditingId(emp.id);
        setEditForm({
            ...emp,
            joinDate: emp.joinDate ? format(parseISO(emp.joinDate), 'yyyy-MM-dd') : '',
            contractStartDate: emp.contractStartDate ? format(parseISO(emp.contractStartDate), 'yyyy-MM-dd') : '',
            contractEndDate: emp.contractEndDate ? format(parseISO(emp.contractEndDate), 'yyyy-MM-dd') : '',
        });
    };

    const saveEdit = () => {
        if (!editingId) return;
        updateEmployeeMutation.mutate({ id: editingId, data: editForm });
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.staffId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.passportNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'All' || emp.contractType === filterType;
        return matchesSearch && matchesFilter;
    });

    const getStatusStyle = (status?: string) => {
        switch (status) {
            case 'Active': return 'bg-emerald-50  border-emerald-100';
            case 'On Leave': return 'bg-amber-50  border-amber-100';
            case 'Terminated':
            case 'Inactive': return 'bg-rose-50  border-rose-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    if (isLoading) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="text-slate-500 font-bold animate-pulse">Loading Lifecycle Data...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header / Search Area */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-primary-600 rounded-2xl shadow-lg shadow-primary-200">
                            <FileSpreadsheet className="w-8 h-8 text-white" />
                        </div>
                        {t('lifecycle_control_title', { defaultValue: 'Workforce Lifecycle Control' })}
                    </h1>
                    <p className="text-slate-500 text-sm font-semibold ml-16">{t('lifecycle_control_subtitle', { defaultValue: 'Full workforce data management with inline editing' })}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('search_employees_placeholder', { defaultValue: 'Search by name, ID or Passport...' })}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all w-80 shadow-sm"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary-500/10 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="All">{t('all_contracts', { defaultValue: 'All Types' })}</option>
                            <option value="RESDANT">RESDANT</option>
                            <option value="DIRCT NONE RESDANT">DIRCT NONE RESDANT</option>
                            <option value="NONE RESDANT">NONE RESDANT</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Excel-style Table Content Area */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col h-[750px] relative">
                <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar scroll-smooth">
                    <table className="min-w-[2800px] text-left table-fixed border-separate border-spacing-0">
                        <thead className="sticky top-0 z-30">
                            <tr className="uppercase tracking-[0.2em]">
                                <th className="w-16 px-4 py-6 text-[10px] font-black text-center sticky left-0 z-40 lifecycle-header-cell-sticky">#</th>
                                <th className="w-64 px-4 py-6 text-[10px] font-black sticky left-16 z-40 lifecycle-header-cell-sticky">{t('employee')}</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black lifecycle-header-cell">{t('staff_id')}</th>
                                <th className="w-48 px-4 py-6 text-[10px] font-black lifecycle-header-cell">Position</th>
                                <th className="w-48 px-4 py-6 text-[10px] font-black lifecycle-header-cell">FullName (Arabic)</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black lifecycle-header-cell">Passport #</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black lifecycle-header-cell">Nationality</th>
                                <th className="w-48 px-4 py-6 text-[10px] font-black lifecycle-header-cell">Job Category</th>
                                <th className="w-32 px-4 py-6 text-[10px] font-black lifecycle-header-cell">Job Grade</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black lifecycle-header-cell">Contract Type</th>
                                <th className="w-32 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell">C. Num</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell">Status</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black text-center uppercase tracking-widest leading-none lifecycle-header-cell">Base Salary</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black text-center uppercase tracking-widest leading-none lifecycle-header-cell">Join Date</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black text-center uppercase tracking-widest leading-none lifecycle-header-cell">Cont. Start</th>
                                <th className="w-40 px-4 py-6 text-[10px] font-black text-center uppercase tracking-widest leading-none lifecycle-header-cell">Cont. End</th>

                                {/* Factor Columns */}
                                <th className="w-32 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-blue">POS FACTOR</th>
                                <th className="w-32 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-indigo">SKILL FACTOR</th>
                                <th className="w-32 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-purple">SITE FACTOR</th>
                                <th className="w-32 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-pink">LANG FACTOR</th>

                                {/* Paid Leave Sections */}
                                <th className="w-24 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-emerald">PAID ACCRUED</th>
                                <th className="w-24 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-emerald">PAID TAKEN</th>
                                <th className="w-24 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-emerald">PAID BAL</th>

                                {/* Unpaid Leave Sections */}
                                <th className="w-24 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-amber">UNPAID TAKEN</th>
                                <th className="w-24 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-amber">UNPAID BAL (14)</th>

                                {/* Emergency Leave Sections */}
                                <th className="w-24 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-rose">EMERG TAKEN</th>
                                <th className="w-24 px-4 py-6 text-[10px] font-black text-center lifecycle-header-cell lifecycle-factor-rose">EMERG BAL (3)</th>

                                <th className="w-56 px-4 py-6 text-[10px] font-black text-center sticky right-0 z-40 border-l border-white/5 shadow-[-4px_0_15px_rgba(0,0,0,0.15)] lifecycle-header-cell-sticky">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp, idx) => {
                                const isEditing = editingId === emp.id;
                                return (
                                    <tr key={emp.id} className={`hover:bg-primary-50/30 transition-all duration-300 group ${isEditing ? 'bg-primary-50 ring-2 ring-primary-500 ring-inset z-10 relative shadow-lg' : ''}`}>
                                        <td className="px-4 py-5 text-center sticky left-0 transition-colors z-20 border-r border-slate-50 lifecycle-sticky-col-1">
                                            <span className="text-xs font-black transition-colors">{idx + 1}</span>
                                        </td>
                                        <td className="px-4 py-5 sticky left-16 transition-colors z-20 border-r border-slate-100 lifecycle-sticky-col-2">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.fullName || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary-500/20"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                                        <User className="w-4 h-4 text-slate-500" />
                                                    </div>
                                                    <span className="text-sm font-black">{emp.fullName}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-5 font-mono font-bold text-slate-500 text-xs text-center">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.staffId || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, staffId: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs"
                                                />
                                            ) : (emp.staffId || '---')}
                                        </td>
                                        <td className="px-4 py-5 text-sm font-bold text-slate-600 truncate">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.position || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs"
                                                />
                                            ) : (emp.position || '---')}
                                        </td>
                                        <td className="px-4 py-5 text-right font-medium text-slate-500" dir="rtl">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.fullNameArabic || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, fullNameArabic: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs text-right"
                                                />
                                            ) : (emp.fullNameArabic || '---')}
                                        </td>
                                        <td className="px-4 py-5 text-sm font-black text-slate-600 uppercase tracking-tighter">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.passportNumber || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, passportNumber: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs font-black uppercase"
                                                />
                                            ) : (emp.passportNumber || '---')}
                                        </td>
                                        <td className="px-4 py-5 text-sm font-bold text-slate-600">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.nationality || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs"
                                                />
                                            ) : (emp.nationality || '---')}
                                        </td>
                                        <td className="px-4 py-5 text-sm font-medium text-slate-500 italic">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.jobCategory || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, jobCategory: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs"
                                                />
                                            ) : (emp.jobCategory || '---')}
                                        </td>
                                        <td className="px-4 py-5 text-xs font-black text-primary-600">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.jobGrade || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, jobGrade: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs font-black uppercase"
                                                />
                                            ) : (emp.jobGrade || '---')}
                                        </td>
                                        <td className="px-4 py-5">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.contractType || 'RESDANT'}
                                                    onChange={(e) => setEditForm({ ...editForm, contractType: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs font-black"
                                                >
                                                    <option value="RESDANT">RESDANT</option>
                                                    <option value="DIRCT NONE RESDANT">DIRCT NONE RESDANT</option>
                                                    <option value="NONE RESDANT">NONE RESDANT</option>
                                                </select>
                                            ) : (
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-[0.15em] shadow-sm
                                                    ${emp.contractType === 'NONE RESDANT' ? 'bg-amber-50  border-amber-100' :
                                                        emp.contractType === 'DIRCT NONE RESDANT' ? 'bg-indigo-50  border-indigo-100' : 'bg-emerald-50  border-emerald-100'}
                                                `}>
                                                    {emp.contractType || '---'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-5 text-center text-sm font-black text-slate-700">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.contractNumber || '1st'}
                                                    onChange={(e) => setEditForm({ ...editForm, contractNumber: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs font-bold"
                                                >
                                                    <option value="1st">1st</option>
                                                    <option value="2nd">2nd</option>
                                                    <option value="3rd">3rd</option>
                                                    <option value="4th">4th</option>
                                                    <option value="Permanent">Permanent</option>
                                                </select>
                                            ) : (emp.contractNumber || '1st')}
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.contractStatus || 'Active'}
                                                    onChange={(e) => setEditForm({ ...editForm, contractStatus: e.target.value })}
                                                    className="w-full px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs font-bold"
                                                >
                                                    <option value="Active">Active</option>
                                                    <option value="Expired">Expired</option>
                                                    <option value="Inactive">Inactive</option>
                                                    <option value="Terminated">Terminated</option>
                                                    <option value="On Leave">On Leave</option>
                                                </select>
                                            ) : (
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getStatusStyle(emp.contractStatus)}`}>
                                                    {emp.contractStatus || 'ACTIVE'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-xl border border-slate-200 text-slate-700">
                                                <CreditCard className="w-3.5 h-3.5 opacity-50" />
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editForm.baseSalary || 0}
                                                        onChange={(e) => setEditForm({ ...editForm, baseSalary: Number(e.target.value) })}
                                                        className="w-16 bg-transparent border-none p-0 text-sm font-black focus:ring-0"
                                                    />
                                                ) : <span className="text-sm font-black">{emp.baseSalary?.toLocaleString()}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editForm.joinDate || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, joinDate: e.target.value })}
                                                    className="px-2 py-1 bg-white border border-primary-200 rounded-lg text-[10px] font-bold"
                                                />
                                            ) : emp.joinDate ? (
                                                <span className="text-xs font-bold text-slate-600 font-black">{format(parseISO(emp.joinDate), 'dd/MM/yyyy')}</span>
                                            ) : '---'}
                                        </td>
                                        <td className="px-4 py-5 text-center">
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editForm.contractStartDate || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, contractStartDate: e.target.value })}
                                                    className="px-2 py-1 bg-white border border-primary-200 rounded-lg text-[10px] font-bold"
                                                />
                                            ) : emp.contractStartDate ? (
                                                <span className="text-xs font-bold text-slate-600 font-black">{format(parseISO(emp.contractStartDate), 'dd/MM/yyyy')}</span>
                                            ) : '---'}
                                        </td>
                                        <td className="px-4 py-5 text-center border-r border-slate-100 bg-slate-50/10">
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editForm.contractEndDate || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, contractEndDate: e.target.value })}
                                                    className="px-2 py-1 bg-white border border-primary-200 rounded-lg text-[10px] font-bold"
                                                />
                                            ) : emp.contractEndDate ? (
                                                <span className={`text-xs font-black ${isPast(parseISO(emp.contractEndDate)) ? 'text-rose-500 underline' : 'text-slate-600'}`}>
                                                    {format(parseISO(emp.contractEndDate), 'dd/MM/yyyy')}
                                                </span>
                                            ) : <span className="text-slate-300 italic text-[10px]">UNDATED</span>}
                                        </td>

                                        <td className="px-4 py-5 text-center lifecycle-factor-blue">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.positionFactor || 1.0}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setEditForm({ 
                                                            ...editForm, 
                                                            positionFactor: val,
                                                            skillFactor: val > 1.0 ? 1.0 : editForm.skillFactor 
                                                        });
                                                    }}
                                                    className="w-32 px-1 py-1 bg-white border border-blue-200 rounded text-[10px] font-black text-center"
                                                >
                                                    <option value={1.0}>Standard (1.0)</option>
                                                    {POSITION_FACTORS.map(f => (
                                                        <option key={f.name} value={f.value}>{f.name} ({f.value})</option>
                                                    ))}
                                                </select>
                                            ) : <span className="text-sm font-black ">{emp.positionFactor || 1.0}</span>}
                                        </td>
                                        <td className="px-4 py-5 text-center lifecycle-factor-indigo">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.skillFactor || 1.0}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setEditForm({ 
                                                            ...editForm, 
                                                            skillFactor: val,
                                                            positionFactor: val > 1.0 ? 1.0 : editForm.positionFactor 
                                                        });
                                                    }}
                                                    className="w-32 px-1 py-1 bg-white border border-indigo-200 rounded text-[10px] font-black text-center"
                                                >
                                                    <option value={1.0}>Standard (1.0)</option>
                                                    {SKILL_FACTORS.map(f => (
                                                        <option key={f.name} value={f.value}>{f.name} ({f.value})</option>
                                                    ))}
                                                </select>
                                            ) : <span className="text-sm font-black ">{emp.skillFactor || 1.0}</span>}
                                        </td>
                                        <td className="px-4 py-5 text-center lifecycle-factor-purple">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.siteFactor || 1.0}
                                                    onChange={(e) => setEditForm({ ...editForm, siteFactor: Number(e.target.value) })}
                                                    className="w-32 px-1 py-1 bg-white border border-purple-200 rounded text-[10px] font-black text-center"
                                                >
                                                    <option value={1.0}>Office (1.0)</option>
                                                    {SITE_FACTORS.map(f => (
                                                        <option key={f.name} value={f.value}>{f.name} ({f.value})</option>
                                                    ))}
                                                </select>
                                            ) : <span className="text-sm font-black ">{emp.siteFactor || 1.0}</span>}
                                        </td>
                                        <td className="px-4 py-5 text-center border-r border-slate-100 lifecycle-factor-pink">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.languageFactor || 1.0}
                                                    onChange={(e) => setEditForm({ ...editForm, languageFactor: Number(e.target.value) })}
                                                    className="w-32 px-1 py-1 bg-white border border-pink-200 rounded text-[10px] font-black text-center"
                                                >
                                                    <option value={1.0}>Native (1.0)</option>
                                                    {LANGUAGE_FACTORS.map(f => (
                                                        <option key={f.name} value={f.value}>{f.name} ({f.value})</option>
                                                    ))}
                                                </select>
                                            ) : <span className="text-sm font-black ">{emp.languageFactor || 1.0}</span>}
                                        </td>

                                        {/* Paid Leave Cells */}
                                        <td className="px-4 py-5 text-center lifecycle-factor-emerald">
                                            <span className="text-sm font-black ">
                                                {emp.contractStartDate ? Math.floor(differenceInDays(new Date(), parseISO(emp.contractStartDate)) / 12) : 0}
                                            </span>
                                        </td>
                                        <td className="px-4 py-5 text-center lifecycle-factor-emerald">
                                            {isEditing ? (
                                                <input
                                                    type="number" step="0.5"
                                                    value={editForm.holidaysUsed || 0}
                                                    onChange={(e) => setEditForm({ ...editForm, holidaysUsed: Number(e.target.value) })}
                                                    className="w-16 px-1 py-1 bg-white border border-emerald-200 rounded text-xs font-black text-center"
                                                />
                                            ) : <span className="text-sm font-black ">{emp.holidaysUsed || 0}</span>}
                                        </td>
                                        <td className="px-4 py-5 text-center border-r border-emerald-100 lifecycle-factor-emerald">
                                            <span className="text-sm font-black ">
                                                {(emp.contractStartDate ? Math.floor(differenceInDays(new Date(), parseISO(emp.contractStartDate)) / 12) : 0) - (emp.holidaysUsed || 0)}
                                            </span>
                                        </td>

                                        {/* Unpaid Leave Cells */}
                                        <td className="px-4 py-5 text-center lifecycle-factor-amber">
                                            {isEditing ? (
                                                <input
                                                    type="number" step="0.5"
                                                    value={editForm.unpaidHolidaysUsed || 0}
                                                    onChange={(e) => setEditForm({ ...editForm, unpaidHolidaysUsed: Number(e.target.value) })}
                                                    className="w-16 px-1 py-1 bg-white border border-amber-200 rounded text-xs font-black text-center"
                                                />
                                            ) : <span className="text-sm font-black ">{emp.unpaidHolidaysUsed || 0}</span>}
                                        </td>
                                        <td className="px-4 py-5 text-center border-r border-amber-100 lifecycle-factor-amber">
                                            <span className="text-sm font-black ">{14 - (emp.unpaidHolidaysUsed || 0)}</span>
                                        </td>

                                        {/* Emergency Leave Cells */}
                                        <td className="px-4 py-5 text-center lifecycle-factor-rose">
                                            {isEditing ? (
                                                <input
                                                    type="number" step="0.5"
                                                    value={editForm.emergencyHolidaysUsed || 0}
                                                    onChange={(e) => setEditForm({ ...editForm, emergencyHolidaysUsed: Number(e.target.value) })}
                                                    className="w-16 px-1 py-1 bg-white border border-rose-200 rounded text-xs font-black text-center"
                                                />
                                            ) : <span className="text-sm font-black ">{emp.emergencyHolidaysUsed || 0}</span>}
                                        </td>
                                        <td className="px-4 py-5 text-center lifecycle-factor-rose">
                                            <span className="text-sm font-black ">{3 - (emp.emergencyHolidaysUsed || 0)}</span>
                                        </td>

                                        {/* Actions Column */}
                                        <td className="px-4 py-5 text-center sticky right-0 transition-colors z-20 border-l border-slate-100 shadow-[-10px_0_20px_rgba(0,0,0,0.05)] lifecycle-sticky-col-actions">
                                            {isEditing ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={saveEdit}
                                                        disabled={updateEmployeeMutation.isPending}
                                                        className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 active:scale-90 flex items-center gap-1.5"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Save</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-90"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => startEditing(emp)}
                                                        className="p-2.5 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-600 hover:text-white transition-all shadow-sm active:scale-90 group/btn"
                                                        title="Edit Row"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                                                    <button
                                                        onClick={() => handleQuickLeave(emp, 'Paid', 1)}
                                                        className="p-2.5 bg-emerald-50  rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"
                                                        title="+1 Paid"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickLeave(emp, 'Unpaid', 1)}
                                                        className="p-2.5 bg-amber-50  rounded-xl hover:bg-amber-600 hover:text-white transition-all shadow-sm active:scale-90"
                                                        title="+1 Unpaid"
                                                    >
                                                        <MinusSquare className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickLeave(emp, 'Emergency', 1)}
                                                        className="p-2.5 bg-rose-50  rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-90"
                                                        title="+1 Emergency"
                                                    >
                                                        <AlertCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Summary Strip */}
                <div className="p-6 bg-slate-900 border-t border-white/10 flex items-center justify-between z-40">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                            <Plane className="w-4 h-4 text-blue-400" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('total_paid', { defaultValue: 'Total Paid' })}</span>
                                <span className="text-sm font-black text-white">{employees.reduce((acc, curr) => acc + (curr.holidaysUsed || 0), 0)} <span className="text-[10px] font-medium text-slate-400">days</span></span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                            <Stethoscope className="w-4 h-4 text-rose-400" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('total_emergency', { defaultValue: 'Total Emergency' })}</span>
                                <span className="text-sm font-black text-white">{employees.reduce((acc, curr) => acc + (curr.emergencyHolidaysUsed || 0), 0)} <span className="text-[10px] font-medium text-slate-400">days</span></span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                            <MinusSquare className="w-4 h-4 text-amber-400" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('total_unpaid', { defaultValue: 'Total Unpaid' })}</span>
                                <span className="text-sm font-black text-white">{employees.reduce((acc, curr) => acc + (curr.unpaidHolidaysUsed || 0), 0)} <span className="text-[10px] font-medium text-slate-400">days</span></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            {filteredEmployees.length} {t('records_found', { defaultValue: 'RECORDS FOUND' })}
                        </div>
                        <button
                            onClick={() => {
                                // Define Premium Styles
                                const titleStyle: any = {
                                    font: { sz: 18, bold: true, color: { rgb: "FFFFFF" } },
                                    alignment: { horizontal: 'center', vertical: 'center' },
                                    fill: { fgColor: { rgb: "1E293B" } }
                                };
                                const metaStyle: any = {
                                    font: { sz: 10, italic: true, color: { rgb: "64748B" } },
                                    alignment: { horizontal: 'center', vertical: 'center' },
                                    fill: { fgColor: { rgb: "F8FAFC" } }
                                };
                                const baseStyle: any = {
                                    font: { sz: 10, color: { rgb: "1E293B" } },
                                    alignment: { horizontal: 'center', vertical: 'center' },
                                    border: {
                                        top: { style: 'thin', color: { rgb: "E2E8F0" } },
                                        bottom: { style: 'thin', color: { rgb: "E2E8F0" } },
                                        left: { style: 'thin', color: { rgb: "E2E8F0" } },
                                        right: { style: 'thin', color: { rgb: "E2E8F0" } }
                                    }
                                };
                                const zebraStyle: any = {
                                    ...baseStyle,
                                    fill: { fgColor: { rgb: "F1F5F9" } }
                                };
                                const headerGroupStyle: any = {
                                    ...baseStyle,
                                    font: { ...baseStyle.font, bold: true, sz: 11, color: { rgb: "FFFFFF" } },
                                    fill: { fgColor: { rgb: "334155" } }
                                };
                                const subHeaderStyle: any = {
                                    ...baseStyle,
                                    font: { ...baseStyle.font, bold: true, sz: 9, color: { rgb: "FFFFFF" } },
                                    fill: { fgColor: { rgb: "475569" } }
                                };

                                // Leave Category Styles
                                const emeraldHeader: any = { ...subHeaderStyle, fill: { fgColor: { rgb: "059669" } } };
                                const amberHeader: any = { ...subHeaderStyle, fill: { fgColor: { rgb: "D97706" } } };
                                const roseHeader: any = { ...subHeaderStyle, fill: { fgColor: { rgb: "E11D48" } } };

                                // 1. Title Row
                                const row1 = [{ v: "IPH HR SYSTEM - WORKFORCE LIFECYCLE REPORT", s: titleStyle }];
                                for (let i = 1; i < 21; i++) row1.push({ v: "", s: titleStyle });

                                // 2. Metadata Row
                                const row2 = [{ v: `Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')} | Records: ${filteredEmployees.length} | Filter: ${filterType}`, s: metaStyle }];
                                for (let i = 1; i < 21; i++) row2.push({ v: "", s: metaStyle });

                                // 3. Empty Spacer
                                const row3 = Array(21).fill({ v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });

                                // 4. Grouped Headers
                                const row4 = [
                                    { v: "STAFF IDENTITY", s: headerGroupStyle }, "", "", "", "", "",
                                    { v: "CONTRACT DETAILS", s: headerGroupStyle }, "", "", "", "", "", "", "",
                                    { v: "PAID LEAVE", s: emeraldHeader }, "", "",
                                    { v: "UNPAID LEAVE", s: amberHeader }, "",
                                    { v: "EMERGENCY LEAVE", s: roseHeader }, ""
                                ];

                                // 5. Sub-headers
                                const row5 = [
                                    { v: 'Staff ID', s: subHeaderStyle },
                                    { v: 'Full Name', s: subHeaderStyle },
                                    { v: 'Arabic Name', s: subHeaderStyle },
                                    { v: 'Passport #', s: subHeaderStyle },
                                    { v: 'Nationality', s: subHeaderStyle },
                                    { v: 'Position', s: subHeaderStyle },
                                    { v: 'Category', s: subHeaderStyle },
                                    { v: 'Grade', s: subHeaderStyle },
                                    { v: 'Type', s: subHeaderStyle },
                                    { v: 'Status', s: subHeaderStyle },
                                    { v: 'Salary', s: subHeaderStyle },
                                    { v: 'Join Date', s: subHeaderStyle },
                                    { v: 'Cont. Start', s: subHeaderStyle },
                                    { v: 'Cont. End', s: subHeaderStyle },
                                    { v: 'POS FACTOR', s: subHeaderStyle },
                                    { v: 'SKILL FACTOR', s: subHeaderStyle },
                                    { v: 'SITE FACTOR', s: subHeaderStyle },
                                    { v: 'LANG FACTOR', s: subHeaderStyle },
                                    { v: 'ACCRUED', s: emeraldHeader },
                                    { v: 'TAKEN', s: emeraldHeader },
                                    { v: 'BALANCE', s: emeraldHeader },
                                    { v: 'TAKEN', s: amberHeader },
                                    { v: 'BALANCE', s: amberHeader },
                                    { v: 'TAKEN', s: roseHeader },
                                    { v: 'BALANCE', s: roseHeader }
                                ];

                                const dataRows = filteredEmployees.map((e, idx) => {
                                    const rowStyle = idx % 2 === 0 ? baseStyle : zebraStyle;
                                    const paidAccrued = e.contractStartDate ? Math.floor(differenceInDays(new Date(), parseISO(e.contractStartDate)) / 12) : 0;
                                    const paidTaken = e.holidaysUsed || 0;
                                    const unpaidTaken = e.unpaidHolidaysUsed || 0;
                                    const emergTaken = e.emergencyHolidaysUsed || 0;
                                    const paidBal = paidAccrued - paidTaken;
                                    const unpaidBal = 14 - unpaidTaken;
                                    const emergBal = 3 - emergTaken;

                                    const balanceStyle = (val: number, base: any) => ({
                                        ...base,
                                        font: { ...base.font, bold: true, color: { rgb: val < 0 ? "B91C1C" : (val === 0 ? "64748B" : "047857") } }
                                    });

                                    return [
                                        { v: e.staffId || '---', s: rowStyle },
                                        { v: e.fullName, s: { ...rowStyle, alignment: { horizontal: 'left' } } },
                                        { v: e.fullNameArabic || '---', s: { ...rowStyle, alignment: { horizontal: 'right' } } },
                                        { v: e.passportNumber || '---', s: rowStyle },
                                        { v: e.nationality || '---', s: rowStyle },
                                        { v: e.position || '---', s: rowStyle },
                                        { v: e.jobCategory || '---', s: rowStyle },
                                        { v: e.jobGrade || '---', s: rowStyle },
                                        { v: e.contractType || '---', s: rowStyle },
                                        { v: e.contractStatus || 'Active', s: rowStyle },
                                        { v: e.baseSalary || 0, s: { ...rowStyle, numFmt: '#,##0' } },
                                        { v: e.joinDate ? format(parseISO(e.joinDate), 'dd/MM/yyyy') : '---', s: rowStyle },
                                        { v: e.contractStartDate ? format(parseISO(e.contractStartDate), 'dd/MM/yyyy') : '---', s: rowStyle },
                                        { v: e.contractEndDate ? format(parseISO(e.contractEndDate), 'dd/MM/yyyy') : '---', s: rowStyle },
                                        { v: e.positionFactor || 1.0, s: rowStyle },
                                        { v: e.skillFactor || 1.0, s: rowStyle },
                                        { v: e.siteFactor || 1.0, s: rowStyle },
                                        { v: e.languageFactor || 1.0, s: rowStyle },
                                        { v: paidAccrued, s: rowStyle },
                                        { v: paidTaken, s: rowStyle },
                                        { v: paidBal, s: balanceStyle(paidBal, rowStyle) },
                                        { v: unpaidTaken, s: rowStyle },
                                        { v: unpaidBal, s: balanceStyle(unpaidBal, rowStyle) },
                                        { v: emergTaken, s: rowStyle },
                                        { v: emergBal, s: balanceStyle(emergBal, rowStyle) }
                                    ];
                                });

                                const wb = XLSX.utils.book_new();
                                const ws = XLSX.utils.aoa_to_sheet([row1, row2, row3, row4, row5, ...dataRows]);

                                // Merge Configuration
                                ws['!merges'] = [
                                    { s: { r: 0, c: 0 }, e: { r: 0, c: 24 } }, // Title
                                    { s: { r: 1, c: 0 }, e: { r: 1, c: 24 } }, // Metadata
                                    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },  // Group: Staff Identity
                                    { s: { r: 3, c: 6 }, e: { r: 3, c: 13 } }, // Group: Contract Details
                                    { s: { r: 3, c: 14 }, e: { r: 3, c: 17 } }, // Group: Factors
                                    { s: { r: 3, c: 18 }, e: { r: 3, c: 20 } }, // Group: Paid Leave
                                    { s: { r: 3, c: 21 }, e: { r: 3, c: 22 } }, // Group: Unpaid Leave
                                    { s: { r: 3, c: 23 }, e: { r: 3, c: 24 } }, // Group: Emergency Leave
                                ];

                                // Freeze Panes (First 5 rows and first 2 columns)
                                ws['!views'] = [{ state: 'frozen', ySplit: 5, xSplit: 2 }];

                                // Auto-width calculation
                                ws['!cols'] = row5.map((h, i) => {
                                    const maxLen = Math.max(
                                        h.v.length,
                                        ...dataRows.map(row => String(row[i].v).length)
                                    );
                                    return { wch: Math.min(maxLen + 5, 40) };
                                });

                                XLSX.utils.book_append_sheet(wb, ws, "Workforce Lifecycle");
                                XLSX.writeFile(wb, `IPH_Lifecycle_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
                                toast.success(t('export_success', { defaultValue: 'Premium Executive Report Exported' }));
                            }}
                            className="px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 active:scale-95 lifecycle-export-btn"
                        >
                            <ExcelIcon className="w-4 h-4" />
                            {t('export_lifecycle_excel', { defaultValue: 'EXPORT EXECUTIVE REPORT' })}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Insight Card */}
            <div className="p-8 rounded-[3rem] flex items-center justify-between gap-10 relative overflow-hidden lifecycle-insight-card">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                <div className="flex items-center gap-8 relative z-10">
                    <div className="w-20 h-20 rounded-[2.5rem] flex items-center justify-center backdrop-blur-xl lifecycle-insight-icon-bg">
                        <Globe className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xl font-black tracking-tight flex items-center gap-3 lifecycle-insight-title">
                            {t('lifecycle_insight_title', { defaultValue: 'Global Workforce Synchronization' })}
                            <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase lifecycle-insight-badge">Live Update</div>
                        </h4>
                        <p className="text-sm font-medium max-w-xl leading-relaxed lifecycle-insight-desc">{t('lifecycle_insight_desc', { defaultValue: 'You are viewing the comprehensive workforce lifecycle database. All fields (Passport, Nationality, Salary) are synchronized in real-time. Changes made here affect payroll and evaluation eligibility.' })}</p>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 relative z-10">
                    <div className="text-4xl font-black lifecycle-insight-count">{employees.length}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest lifecycle-insight-count-label">Total Active Staff</div>
                </div>
            </div>
        </div>
    );
};

export default LifecycleControl;
