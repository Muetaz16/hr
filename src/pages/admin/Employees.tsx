import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { employeeService } from '../../services/employeeService';
import api from '../../services/apiClient';
import { departmentService, divisionService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { toast } from 'sonner';
import { JOB_CATEGORIES, JOB_GRADES } from '../../types';
import type { Employee, Department, Group, Unit, Division } from '../../types';
import {
    Edit,
    Trash2,
    Search,
    Filter,
    MoreHorizontal,
    X,
    Calendar,
    Download,
    DollarSign,
    UserPlus,
    AlertTriangle,
    ChevronDown,
    Check,
    Lock,
    Key,
    Sparkles
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { evaluationService } from '../../services/evaluationService';
import { payrollService } from '../../services/payrollService';
import { format } from 'date-fns';
import type { DirectorEvaluation, PayrollResult } from '../../types';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleThemes } from '../../config/roleThemes';
import type { UserRole } from '../../types';
import Skeleton from '../../components/Skeleton';
import { 
    POSITION_FACTORS, 
    SKILL_FACTORS, 
    SITE_FACTORS, 
    LANGUAGE_FACTORS
} from '../../constants/factors';
import { useConfirm } from '../../components/ConfirmDialog';

const getCurrencySymbol = (type?: string | null) => {
    if (!type) return '$';
    if (type.includes('LYD')) return 'LYD ';
    if (type.includes('EUR')) return '€';
    return '$';
};

const EmployeesPage: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const confirm = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const deptIdFilter = searchParams.get('deptId');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

    // Row Selection
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

    // Advanced Multi-Select Filters
    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    const { data, isLoading: loading, isError, error, refetch: fetchData } = useQuery({
        queryKey: ['employees-admin', selectedMonth],
        queryFn: async () => {
            // The employee list is the core of this page. If it fails we let the error
            // propagate so react-query flags isError and we can show a retry UI, rather
            // than silently rendering an empty table. Secondary data (departments, units,
            // payroll, evaluations) stays resilient so a single outage doesn't blank the page.
            const emps = await employeeService.getAllEmployees();

            const [depts, uns, divs, pRecords] = await Promise.all([
                departmentService.getAllDepartments().catch((e) => { console.error("depts error", e); return []; }),
                unitService.getAllUnits().catch((e) => { console.error("uns error", e); return []; }),
                divisionService.getAllDivisions().catch((e) => { console.error("divs error", e); return []; }),
                payrollService.getPayrollByMonth(selectedMonth).catch((e) => { console.error("payroll error", e); return []; })
            ]);

            const pMap: Record<string, PayrollResult> = {};
            if (pRecords && Array.isArray(pRecords)) {
                pRecords.forEach((r: any) => pMap[r.employeeId] = r);
            }

            const evalPromises = (emps || []).map((e: any) => evaluationService.getDirectorEvaluation(e.id, selectedMonth).catch(() => null));
            const evals = await Promise.all(evalPromises);
            const eMap: Record<string, DirectorEvaluation> = {};
            evals.forEach((ev, idx) => {
                if (ev) eMap[(emps || [])[idx].id] = ev;
            });

            return {
                employees: emps || [],
                departments: depts || [],
                units: uns || [],
                divisions: divs || [],
                payrollRecords: pMap,
                dirEvals: eMap
            };
        }
    });

    const employees = data?.employees || [];
    const departments = data?.departments || [];
    const units = data?.units || [];
    const divisions = data?.divisions || [];
    const payrollRecords = data?.payrollRecords || {};
    const dirEvals = data?.dirEvals || {};



    // Helper Checklist Component for Premium UI
    const FilterChecklist = ({
        label,
        options,
        selected,
        onChange,
        icon: Icon = Filter
    }: {
        label: string,
        options: { id: string, name: string }[],
        selected: string[],
        onChange: (ids: string[]) => void,
        icon?: any
    }) => {
        const [isOpen, setIsOpen] = useState(false);
        const toggle = (id: string) => {
            if (selected.includes(id)) {
                onChange(selected.filter(i => i !== id));
            } else {
                onChange([...selected, id]);
            }
        };

        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center justify-between w-full px-4 py-3 bg-white border rounded-2xl text-xs font-bold transition-all shadow-sm ${selected.length > 0 ? 'border-indigo-500 ring-2 ring-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Icon className={`w-3.5 h-3.5 ${selected.length > 0 ? 'text-indigo-500' : 'text-slate-400'}`} />
                        <span className="truncate">
                            {selected.length === 0 ? label : `${label} (${selected.length})`}
                        </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 max-h-64 overflow-y-auto animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between p-2 mb-1 border-b border-slate-50">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                                <button
                                    onClick={() => onChange([])}
                                    className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700"
                                >
                                    {t('clear', { defaultValue: 'Clear' })}
                                </button>
                            </div>
                            {options.map(opt => (
                                <div
                                    key={opt.id}
                                    onClick={() => toggle(opt.id)}
                                    className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group"
                                >
                                    <span className={`text-xs font-medium ${selected.includes(opt.id) ? 'text-indigo-600 font-bold' : 'text-slate-600'}`}>
                                        {opt.name}
                                    </span>
                                    {selected.includes(opt.id) && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                                </div>
                            ))}
                            {options.length === 0 && (
                                <div className="p-4 text-center text-xs text-slate-400 italic">No options available</div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };



    const handleExport = async () => {
        try {
            const csv = await payrollService.generateCSV(selectedMonth);
            if (!csv || !csv.trim()) {
                toast.error(t('export_no_data', { defaultValue: 'No payroll data available to export for this month.' }));
                return;
            }
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_${selectedMonth}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('export_success', { defaultValue: 'Payroll exported successfully.' }));
        } catch (error: any) {
            console.error("Export failed:", error);
            toast.error(error.response?.data?.error || t('error_export_payroll', { defaultValue: 'Failed to export payroll.' }));
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm({ message: t('confirm_delete_emp'), danger: true }))) return;
        try {
            await employeeService.deleteEmployee(id);
            toast.success(t('employee_deleted', { defaultValue: 'Employee deleted successfully.' }));
            setSelectedEmployeeIds(prev => prev.filter(sid => sid !== id));
            fetchData();
        } catch (error: any) {
            console.error("Delete failed:", error);
            toast.error(error.response?.data?.error || t('error_deleting_emp', { defaultValue: 'Failed to delete employee.' }));
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = !deptIdFilter || emp.departmentId === deptIdFilter;
        const matchesUnit = selectedUnits.length === 0 || selectedUnits.includes(emp.unitId || '');
        const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(emp.role);
        return matchesSearch && matchesDept && matchesUnit && matchesRole;
    });

    const activeDeptName = departments.find(d => d.id === deptIdFilter)?.name;

    if (loading) return (
        <div className="space-y-8 animate-pulse">
            <div className="flex justify-between items-center">
                <Skeleton className="w-64 h-10" />
                <div className="flex gap-4">
                    <Skeleton className="w-40 h-12" />
                    <Skeleton className="w-40 h-12" />
                    <Skeleton className="w-40 h-12" />
                </div>
            </div>
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                    <Skeleton className="w-80 h-10 rounded-xl" />
                </div>
                <div className="p-8 space-y-6">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                            <div className="flex items-center space-x-4">
                                <Skeleton variant="circular" width={48} height={48} />
                                <div className="space-y-2">
                                    <Skeleton className="w-48 h-5" />
                                    <Skeleton className="w-32 h-3" />
                                </div>
                            </div>
                            <Skeleton className="w-24 h-8 rounded-full" />
                            <Skeleton className="w-20 h-8 rounded-full" />
                            <Skeleton className="w-24 h-10" />
                            <div className="flex gap-2">
                                <Skeleton className="w-10 h-10 rounded-xl" />
                                <Skeleton className="w-10 h-10 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    if (isError) return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('personnel_workforce')}</h1>
                <p className="text-slate-500 mt-1">{t('personnel_subtitle')}</p>
            </div>
            <div className="glass-card rounded-[32px] p-12 flex flex-col items-center justify-center text-center shadow-2xl shadow-slate-200/50">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">{t('failed_to_load_data')}</h2>
                <p className="text-sm text-slate-500 mt-2 max-w-md">
                    {(error as any)?.response?.data?.error || t('error_loading_workforce', { defaultValue: 'We could not load the workforce records. Please check your connection and try again.' })}
                </p>
                <button
                    onClick={() => fetchData()}
                    className="mt-6 flex items-center px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                >
                    {t('retry', { defaultValue: 'Retry' })}
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('personnel_workforce')}</h1>
                    <p className="text-slate-500 mt-1">{t('personnel_subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all text-sm"
                    >
                        <Download size={18} className="mr-2" />
                        {t('export_payroll')}
                    </button>
                    {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('register_employees')) && (
                        <button
                            onClick={() => navigate('/employees/new')}
                            className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm group"
                        >
                            <UserPlus size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
                            {t('board_new_employee')}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Table Area */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                {/* Search / Filter Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={t('filter_candidates')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-80"
                                />
                            </div>

                            {deptIdFilter && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl animate-in fade-in slide-in-from-left-2">
                                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{t('department')}: {activeDeptName}</span>
                                    <button
                                        onClick={() => {
                                            searchParams.delete('deptId');
                                            setSearchParams(searchParams);
                                        }}
                                        className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    const headRoles = ['HEAD_UNIT', 'HEAD_DEPARTMENT', 'HEAD_DIRECTOR', 'HR_MANAGER', 'PERSONNEL', 'SUPER_ADMIN'];
                                    setSelectedRoles(headRoles);
                                }}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all"
                            >
                                {t('all_heads', { defaultValue: 'Select All Heads' })}
                            </button>
                            <div className="h-4 w-[1px] bg-slate-200"></div>
                            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                                <Filter className="w-5 h-5" />
                            </button>
                            <div className="h-4 w-[1px] bg-slate-200"></div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredEmployees.length} {t('results')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
                        {/* Unit Filter */}
                        <FilterChecklist
                            label={t('all_units', { defaultValue: 'Units' })}
                            options={units.map(u => ({ id: u.id, name: u.name }))}
                            selected={selectedUnits}
                            onChange={setSelectedUnits}
                        />

                        {/* Role Filter */}
                        <FilterChecklist
                            label={t('all_roles', { defaultValue: 'Roles' })}
                            options={[
                                { id: 'EMPLOYEE', name: t('role_employee') },
                                { id: 'HEAD_UNIT', name: t('role_head_unit') },
                                { id: 'HEAD_DEPARTMENT', name: t('role_head_department') },
                                { id: 'HEAD_OFFICE', name: 'Head of Office' },
                                { id: 'HEAD_DIVISION', name: 'Head of Division' },
                                { id: 'HEAD_DIRECTOR', name: t('role_head_director') },
                                { id: 'HR_MANAGER', name: t('role_hr_manager') },
                                { id: 'GENERAL_MANAGER', name: 'General Manager' },
                                { id: 'CHAIRMAN', name: 'Chairman' },
                                { id: 'PERSONNEL', name: t('role_personnel', { defaultValue: 'Personnel' }) },
                                { id: 'SUPER_ADMIN', name: 'Global Administrator' }
                            ]}
                            selected={selectedRoles}
                            onChange={setSelectedRoles}
                        />

                        {(selectedUnits.length > 0 || selectedRoles.length > 0) && (
                            <button
                                onClick={() => { setSelectedUnits([]); setSelectedRoles([]); }}
                                className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 p-2 rounded-xl transition-all"
                            >
                                {t('clear_filters', { defaultValue: 'Clear Filters' })}
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedEmployeeIds(filteredEmployees.map(emp => emp.id));
                                            } else {
                                                setSelectedEmployeeIds([]);
                                            }
                                        }}
                                    />
                                </th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('personnel')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('performance_status')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('holiday_balance')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Structure & Salary</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <div className="inline-flex flex-col items-center text-slate-400">
                                            <Search className="w-8 h-8 mb-3 text-slate-300" />
                                            <p className="text-sm font-bold uppercase tracking-widest">{t('no_workforce_records')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filteredEmployees.map((emp) => {
                                const empTheme = roleThemes[emp.role as UserRole] || theme;
                                const isSelected = selectedEmployeeIds.includes(emp.id);
                                return (
                                    <tr key={emp.id} className={`group hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-6 py-5">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={isSelected}
                                                onChange={() => {
                                                    if (isSelected) {
                                                        setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                                                    } else {
                                                        setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${empTheme.gradient} flex items-center justify-center text-white font-bold text-lg mr-4 shadow-sm group-hover:scale-105 transition-transform`}>
                                                    {emp.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 group-hover:text-slate-900">{emp.fullName}</p>
                                                    <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                                                        <span className="mr-2 text-indigo-500">{emp.staffId || t('no_id')}</span>
                                                        <Calendar className="w-3 h-3 mr-1" /> {t('bound')} {emp.joinDate ? format(new Date(emp.joinDate), 'dd MMM yyyy') : 'N/A'}
                                                        {emp.contractEndDate && (
                                                            <Link
                                                                to={`/contracts/${emp.id}`}
                                                                className={`ml-3 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-tighter uppercase transition-transform hover:scale-105 active:scale-95 ${new Date(emp.contractEndDate) < new Date() ? 'bg-red-500 text-white' : 'bg-slate-900 text-white'}`}
                                                            >
                                                                {t('expires')}: {format(new Date(emp.contractEndDate), 'dd MMM yyyy')}
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            {dirEvals[emp.id] ? (
                                                <div className="inline-flex flex-col items-center">
                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${dirEvals[emp.id].locked ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                                        {dirEvals[emp.id].locked ? t('locked') : t('drafting')}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 mt-1">{((dirEvals[emp.id].finalScore || 0) / 80 * 100).toFixed(1)}/100</span>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-300 font-bold uppercase">{t('pending_rating')}</div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${(emp.remainingHolidays || 0) <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {emp.remainingHolidays?.toFixed(1) || '0.0'} {t('days_left')}
                                                </div>
                                                <div className="flex flex-col text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                    <span>{t('accrued')}: {emp.accruedHolidays?.toFixed(1) || '0.0'}</span>
                                                    {emp.bonusHolidays > 0 && <span className="text-blue-500">+{t('bonus')}: {emp.bonusHolidays.toFixed(1)}</span>}
                                                    <span className="text-red-400">-{t('used')}: {emp.holidaysUsed?.toFixed(1) || '0.0'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600">
                                                    {emp.salaryStructureType || 'N/A'}
                                                </div>
                                                <div className="flex flex-col text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                    <span>Base: {getCurrencySymbol(emp.salaryStructureType)}{emp.baseSalary?.toLocaleString() || '0'}</span>
                                                    <span className="text-indigo-500 mt-0.5">Total: {getCurrencySymbol(emp.salaryStructureType)}{((emp.baseSalary || 0) * (1.0 + (Math.max(emp.positionFactor || 1, emp.skillFactor || 1) - 1.0) + ((emp.siteFactor || 1) - 1.0) + ((emp.languageFactor || 1) - 1.0))).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('edit_employees')) && (
                                                    <button
                                                        onClick={() => navigate(`/employees/${emp.id}/edit`)}
                                                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm group/btn"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                                {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('delete_employees')) && (
                                                    <button
                                                        onClick={() => handleDelete(emp.id)}
                                                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                                <button className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-all border border-transparent">
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

export default EmployeesPage;
