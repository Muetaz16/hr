import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { employeeService } from '../../services/employeeService';
import { departmentService, groupService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { toast } from 'sonner';
import type { Employee, Department, Group, Unit } from '../../types';
import Modal from '../../components/Modal';
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
    AlertTriangle
} from 'lucide-react';
import { evaluationService } from '../../services/evaluationService';
import { payrollService } from '../../services/payrollService';
import { format } from 'date-fns';
import type { DirectorEvaluation, PayrollResult } from '../../types';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleThemes } from '../../config/roleThemes';
import type { UserRole } from '../../types';
import Skeleton from '../../components/Skeleton';

const EmployeesPage: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const deptIdFilter = searchParams.get('deptId');

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [dirEvals, setDirEvals] = useState<Record<string, DirectorEvaluation>>({});
    const [payrollRecords, setPayrollRecords] = useState<Record<string, PayrollResult>>({});

    const [formData, setFormData] = useState<Partial<Employee & { password?: string }>>({
        fullName: '',
        email: '',
        password: '',
        departmentId: '',
        unitId: '',
        groupId: '',
        role: 'EMPLOYEE',
        baseSalary: 0,
        joinDate: new Date().toISOString().split('T')[0],
        staffId: '',
        position: '',
        contractStartDate: '',
        contractEndDate: '',
        contractType: 'Limited',
        contractStatus: 'Active',
        holidaysUsed: 0,
        emergencyHolidaysUsed: 0,
        bonusHolidays: 0,
        fullNameArabic: '',
        passportNumber: '',
        contractNumber: '',
        nationality: '',
        jobCategory: '',
        jobGrade: ''
    });

    useEffect(() => {
        fetchData();
    }, [currentUser, selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [emps, depts, grps, uns, pRecords] = await Promise.all([
                employeeService.getAllEmployees(),
                departmentService.getAllDepartments(),
                groupService.getAllGroups(),
                unitService.getAllUnits(),
                payrollService.getPayrollByMonth(selectedMonth)
            ]);

            setEmployees(emps);
            setDepartments(depts);
            setGroups(grps);
            setUnits(uns);

            const pMap: Record<string, PayrollResult> = {};
            pRecords.forEach(r => pMap[r.employeeId] = r);
            setPayrollRecords(pMap);

            // Fetch evaluations concurrently
            const evalPromises = emps.map(e => evaluationService.getDirectorEvaluation(e.id, selectedMonth));
            const evals = await Promise.all(evalPromises);
            const eMap: Record<string, DirectorEvaluation> = {};
            evals.forEach((ev, idx) => {
                if (ev) eMap[emps[idx].id] = ev;
            });
            setDirEvals(eMap);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const csv = await payrollService.generateCSV(selectedMonth);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_${selectedMonth}.csv`;
            a.click();
        } catch (error) {
            console.error("Export failed:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.fullName) {
            alert(t('full_name_required'));
            return;
        }
        if (formData.role !== 'HEAD_DIRECTOR' && (!formData.departmentId || !formData.groupId)) {
            alert(t('dept_group_required'));
            return;
        }

        if (formData.role === 'HEAD_DIRECTOR' && !formData.groupId) {
            alert(t('group_required', { defaultValue: 'Group selection is required.' }));
            return;
        }

        if (formData.role === 'EMPLOYEE' && !formData.unitId) {
            alert(t('unit_required', { defaultValue: 'Unit selection is required for standard employees.' }));
            return;
        }

        try {
            if (editingId) {
                await employeeService.updateEmployee(editingId, formData);
            } else {
            await employeeService.createEmployee(formData as any);
        }
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ fullName: '', email: '', password: '', departmentId: '', unitId: '', groupId: '', role: 'EMPLOYEE', baseSalary: 0, joinDate: new Date().toISOString().split('T')[0], staffId: '', position: '', contractStartDate: '', contractEndDate: '', contractType: 'Limited', contractStatus: 'Active', holidaysUsed: 0, bonusHolidays: 0 });
            fetchData();
            toast.success(editingId ? t('employee_updated') : t('employee_created'));
        } catch (error: any) {
            console.error("Error saving employee:", error);
            const data = error.response?.data;
            let detail = data?.details || error.message;

            // Handle specific Prisma codes if available
            if (data?.code === 'P2002') {
                detail = `Unique constraint failed on: ${data.meta?.target?.join(', ') || 'unknown field'}`;
            } else if (data?.code === 'P2003') {
                detail = `Foreign key constraint failed (check department/group)`;
            }

            toast.error(`${t('error_saving_employee')}: ${detail}`, {
                duration: 5000
            });
        }
    };

    const handleEdit = (emp: Employee) => {
        setEditingId(emp.id);
        const formatDate = (date: any) => {
            if (!date) return '';
            try {
                return new Date(date).toISOString().split('T')[0];
            } catch {
                return '';
            }
        };

        setFormData({
            ...emp,
            joinDate: formatDate(emp.joinDate),
            contractStartDate: formatDate(emp.contractStartDate),
            contractEndDate: formatDate(emp.contractEndDate),
            fullNameArabic: emp.fullNameArabic || '',
            passportNumber: emp.passportNumber || '',
            contractNumber: emp.contractNumber || '',
            nationality: emp.nationality || '',
            jobCategory: emp.jobCategory || '',
            jobGrade: emp.jobGrade || '',
            emergencyHolidaysUsed: emp.emergencyHolidaysUsed || 0
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm(t('confirm_delete_emp'))) {
            await employeeService.deleteEmployee(id);
            fetchData();
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = !deptIdFilter || emp.departmentId === deptIdFilter;
        return matchesSearch && matchesDept;
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
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData({
                                fullName: '', email: '', password: '', departmentId: '', unitId: '', groupId: '', role: 'EMPLOYEE', baseSalary: 0,
                                joinDate: new Date().toISOString().split('T')[0], staffId: '', position: '', contractStartDate: '', contractEndDate: '',
                                contractType: 'RESDANT', contractStatus: 'Active', holidaysUsed: 0, emergencyHolidaysUsed: 0, unpaidHolidaysUsed: 0, bonusHolidays: 0,
                                fullNameArabic: '', passportNumber: '', contractNumber: '', nationality: '', jobCategory: '', jobGrade: ''
                            });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm group"
                    >
                        <UserPlus size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
                        {t('board_new_employee')}
                    </button>
                </div>
            </div>

            {/* Content Table Area */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                {/* Search / Filter Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
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
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                            <Filter className="w-5 h-5" />
                        </button>
                        <div className="h-4 w-[1px] bg-slate-200"></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredEmployees.length} {t('results')}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('personnel')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('performance_status')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('holiday_balance')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('payroll_status')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => {
                                const empTheme = roleThemes[emp.role as UserRole] || theme;
                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
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
                                            {payrollRecords[emp.id] ? (
                                                <div className="inline-flex flex-col items-center">
                                                    <div className="text-sm font-bold text-emerald-600">${payrollRecords[emp.id].finalSalary.toLocaleString()}</div>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{t('settlement_ready')}</span>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-300 font-bold uppercase">{t('awaiting_lock')}</div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(emp)}
                                                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm group/btn"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(emp.id)}
                                                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
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

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? t('modify_personnel') : t('enroll_personnel')}
            >
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('identity_details')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('full_name')}</label>
                                    <input
                                        type="text" required
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder={t('full_legal_name')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('full_name_arabic', { defaultValue: 'Full Name (Arabic)' })}</label>
                                    <input
                                        type="text"
                                        value={formData.fullNameArabic || ''}
                                        onChange={(e) => setFormData({ ...formData, fullNameArabic: e.target.value })}
                                        dir="rtl"
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 text-right"
                                        placeholder={t('name_arabic_placeholder', { defaultValue: 'الاسم الكامل باللغة العربية' })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('staff_id_code')}</label>
                                    <input
                                        type="text"
                                        value={formData.staffId || ''}
                                        onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder={t('emp_id_placeholder')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('passport_number', { defaultValue: 'Passport Number' })}</label>
                                    <input
                                        type="text"
                                        value={formData.passportNumber || ''}
                                        onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 uppercase"
                                        placeholder={t('passport_placeholder', { defaultValue: 'Passport #' })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Position</label>
                                    <input
                                        type="text"
                                        value={formData.position || ''}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="e.g. Senior Developer"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('role_type')}</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="EMPLOYEE">{t('role_employee')}</option>
                                        <option value="HEAD_UNIT">{t('role_head_unit', { defaultValue: 'Head of Unit' })}</option>
                                        <option value="HR_MANAGER">{t('role_hr_manager')}</option>
                                        <option value="PERSONNEL">{t('role_personnel')}</option>
                                        <option value="HEAD_DEPARTMENT">{t('role_head_department')}</option>
                                        <option value="HEAD_DIRECTOR">{t('role_head_director')}</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        {formData.role === 'EMPLOYEE' ? (
                            <section className="space-y-4">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('system_access_credentials', { defaultValue: 'System Access Credentials' })}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('corporate_email')}</label>
                                        <input
                                            type="email"
                                            value={formData.email || ''}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                            placeholder={t('email_placeholder')}
                                        />
                                        <p className="text-[9px] text-slate-400 font-medium italic">* {t('login_email_hint', { defaultValue: 'Required for platform access' })}</p>
                                    </div>
                                    {!editingId && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('initial_password', { defaultValue: 'Initial Password' })}</label>
                                            <input
                                                type="password"
                                                value={formData.password || ''}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    )}
                                </div>
                            </section>
                        ) : (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                                <p className="text-[10px] text-amber-700 font-medium italic">
                                    {t('admin_access_note', { defaultValue: 'For administrative roles (Manager/Director), please create the system account separately in Access Management after enrollment.' })}
                                </p>
                            </div>
                        )}

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('organizational_units')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('corporate_group')}</label>
                                    <select
                                        value={formData.groupId}
                                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="">{t('select_group')}</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {formData.role !== 'HEAD_DIRECTOR' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('department')}</label>
                                            <select
                                                value={formData.departmentId}
                                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value, unitId: '' })}
                                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                            >
                                                <option value="">{t('select_department')}</option>
                                                {departments
                                                    .filter(d => !formData.groupId || d.groupId === formData.groupId)
                                                    .map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                                {t('unit', { defaultValue: 'Unit' })}
                                                {formData.role === 'EMPLOYEE' && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <select
                                                value={formData.unitId || ''}
                                                onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                                                required={formData.role === 'EMPLOYEE'}
                                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                            >
                                                <option value="">{formData.role === 'EMPLOYEE' ? t('select_unit_req', { defaultValue: 'Select Unit' }) : t('select_unit', { defaultValue: 'Select Unit (Optional)' })}</option>
                                                {units
                                                    .filter(u => !formData.departmentId || u.departmentId === formData.departmentId)
                                                    .map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('nationality', { defaultValue: 'Nationality' })}</label>
                                    <input
                                        type="text"
                                        value={formData.nationality || ''}
                                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="Libyan"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('job_category', { defaultValue: 'Job Category' })}</label>
                                    <input
                                        type="text"
                                        value={formData.jobCategory || ''}
                                        onChange={(e) => setFormData({ ...formData, jobCategory: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="Administrative Officer"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('job_grade', { defaultValue: 'Job Grade' })}</label>
                                    <input
                                        type="text"
                                        value={formData.jobGrade || ''}
                                        onChange={(e) => setFormData({ ...formData, jobGrade: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="Junior"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('financials_date')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('base_salary')}</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="number" min="0" required
                                            value={formData.baseSalary}
                                            onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('engagement_date')}</label>
                                    <input
                                        type="date" required
                                        value={formData.joinDate}
                                        onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('contract_details')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('contract_start')}</label>
                                    <input
                                        type="date"
                                        value={formData.contractStartDate || ''}
                                        onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('contract_end')}</label>
                                    <input
                                        type="date"
                                        value={formData.contractEndDate || ''}
                                        onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-100 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('contract_number', { defaultValue: 'Contract Number' })}</label>
                                    <select
                                        value={formData.contractNumber || '1st'}
                                        onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="1st">1st Contract</option>
                                        <option value="2nd">2nd Contract</option>
                                        <option value="3rd">3rd Contract</option>
                                        <option value="4th">4th Contract</option>
                                        <option value="Permanent">Permanent</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('contract_type')}</label>
                                    <select
                                        value={formData.contractType || 'RESDANT'}
                                        onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="RESDANT">RESDANT</option>
                                        <option value="DIRCT NONE RESDANT">DIRCT NONE RESDANT</option>
                                        <option value="NONE RESDANT">NONE RESDANT</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('leave_adjustment')}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('holidays_taken')}</label>
                                    <input
                                        type="number" step="0.5" min="0"
                                        value={formData.holidaysUsed || 0}
                                        onChange={(e) => setFormData({ ...formData, holidaysUsed: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="0.0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-red-500 uppercase tracking-wider block">{t('emergency_taken', { defaultValue: 'Emergency Taken' })}</label>
                                    <input
                                        type="number" step="1" min="0"
                                        value={formData.emergencyHolidaysUsed || 0}
                                        onChange={(e) => setFormData({ ...formData, emergencyHolidaysUsed: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-red-50/30 border-red-100 rounded-xl focus:ring-2 focus:ring-red-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-orange-500 uppercase tracking-wider block">{t('unpaid_taken', { defaultValue: 'Unpaid Taken' })}</label>
                                    <input
                                        type="number" step="0.5" min="0"
                                        value={formData.unpaidHolidaysUsed || 0}
                                        onChange={(e) => setFormData({ ...formData, unpaidHolidaysUsed: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-orange-50/30 border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="0.0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-blue-500 uppercase tracking-wider block">{t('bonus_holidays')}</label>
                                    <input
                                        type="number" step="0.5" min="0"
                                        value={formData.bonusHolidays || 0}
                                        onChange={(e) => setFormData({ ...formData, bonusHolidays: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-blue-50/30 border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="0.0"
                                    />
                                </div>
                                <div className="col-span-full">
                                    <p className="text-[9px] text-slate-400 font-medium leading-relaxed italic">
                                        * {t('accrual_hint')}
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-4 rounded-xl bg-slate-900 text-white font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            {editingId ? t('commit_changes') : t('confirm_enrollment')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default EmployeesPage;
