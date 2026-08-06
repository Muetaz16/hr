import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import { SERVER_URL } from '../../services/apiClient';
import Modal from '../../components/Modal';
import {
    Search,
    Filter,
    Plus,
    Plane,
    FileSpreadsheet,
    Stethoscope,
    Edit3,
    Check,
    X,
    User,
    CreditCard,
    Globe,
    MinusSquare,
    Eye,
    Phone,
    Landmark,
    Paperclip,
    Briefcase,
    CalendarDays,
    ExternalLink,
    Upload,
    FileSpreadsheet as ExcelIcon
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import type { Employee } from '../../types';

const LifecycleControl: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
    const [detailEditing, setDetailEditing] = useState(false);
    const [detailForm, setDetailForm] = useState<Partial<Employee>>({});
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

    const handleDetailDocUpload = async (k: string, file?: File) => {
        if (!file) return;
        setUploadingDoc(k);
        try {
            const { url } = await employeeService.uploadDocument(file);
            setDetailForm(f => ({ ...f, [k]: url }));
            toast.success(t('document_uploaded', { defaultValue: 'Document uploaded' }));
        } catch (err) {
            console.error('Document upload failed', err);
            toast.error(t('document_upload_failed', { defaultValue: 'Upload failed. Please try again.' }));
        } finally {
            setUploadingDoc(null);
        }
    };

    const buildDetailForm = (emp: Employee): Partial<Employee> => {
        const d = (x?: string) => x ? format(parseISO(x), 'yyyy-MM-dd') : '';
        return {
            ...emp,
            dateOfBirth: d(emp.dateOfBirth),
            idIssueDate: d(emp.idIssueDate),
            passportExpiryDate: d(emp.passportExpiryDate),
            drivingLicenseExpiry: d(emp.drivingLicenseExpiry),
            arrivalDate: d(emp.arrivalDate),
            joinDate: d(emp.joinDate),
            contractStartDate: d(emp.contractStartDate),
            contractEndDate: d(emp.contractEndDate),
        };
    };
    const openDetail = (emp: Employee, editing = false) => {
        setDetailEmp(emp);
        if (editing) setDetailForm(buildDetailForm(emp));
        setDetailEditing(editing);
    };
    const closeDetail = () => {
        setDetailEmp(null);
        setDetailEditing(false);
    };
    const beginDetailEdit = () => {
        if (!detailEmp) return;
        setDetailForm(buildDetailForm(detailEmp));
        setDetailEditing(true);
    };
    const saveDetailEdit = () => {
        if (!detailEmp) return;
        updateEmployeeMutation.mutate(
            { id: detailEmp.id, data: detailForm },
            {
                onSuccess: (updated: any) => {
                    if (updated) setDetailEmp(updated);
                    setDetailEditing(false);
                }
            }
        );
    };

    // Quick +/- adjust a leave counter straight from the detail view. While editing it just
    // nudges the form value; in view mode it persists immediately (optimistic update).
    const quickAdjustLeave = (
        field: 'holidaysUsed' | 'emergencyHolidaysUsed' | 'unpaidHolidaysUsed',
        amount: number
    ) => {
        if (!detailEmp) return;
        if (detailEditing) {
            setDetailForm(f => ({ ...f, [field]: Math.max(0, (Number((f as any)[field]) || 0) + amount) }));
            return;
        }
        const next = Math.max(0, (Number((detailEmp as any)[field]) || 0) + amount);
        setDetailEmp({ ...detailEmp, [field]: next } as Employee);
        updateEmployeeMutation.mutate({ id: detailEmp.id, data: { [field]: next } as Partial<Employee> });
    };

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['employees-lifecycle'],
        queryFn: employeeService.getAllEmployees
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['departments-lifecycle'],
        queryFn: departmentService.getAllDepartments
    });

    const deptName = (id?: string) => departments.find((d: any) => d.id === id)?.name || '—';

    const updateEmployeeMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: Partial<Employee> }) => {
            return employeeService.updateEmployee(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees-lifecycle'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success(t('update_success', { defaultValue: 'Employee updated successfully' }));
        },
        onError: () => {
            toast.error(t('update_error', { defaultValue: 'Failed to update employee' }));
        }
    });


    // Natural, human-friendly ordering of Staff IDs so the grid always reads
    // sequentially (IPH-125-001, IPH-125-002, … IPH-126-001) instead of a random
    // insertion order. Records without a Staff ID sink to the bottom, then sort by name.
    const compareStaffId = (a: Employee, b: Employee) => {
        const ax = (a.staffId || '').trim();
        const bx = (b.staffId || '').trim();
        if (ax && bx) {
            const cmp = ax.localeCompare(bx, undefined, { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp;
        } else if (ax && !bx) {
            return -1;
        } else if (!ax && bx) {
            return 1;
        }
        return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.staffId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.passportNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'All' || emp.contractType === filterType;
        return matchesSearch && matchesFilter;
    }).sort(compareStaffId);

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
                    <table className="min-w-[1100px] w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-30">
                            <tr className="uppercase tracking-[0.2em]">
                                <th className="w-16 px-5 py-6 text-[10px] font-black text-center lifecycle-header-cell">#</th>
                                <th className="px-5 py-6 text-[10px] font-black lifecycle-header-cell">{t('employee')}</th>
                                <th className="w-44 px-5 py-6 text-[10px] font-black lifecycle-header-cell">{t('staff_id')}</th>
                                <th className="w-56 px-5 py-6 text-[10px] font-black lifecycle-header-cell">Position</th>
                                <th className="w-56 px-5 py-6 text-[10px] font-black lifecycle-header-cell">Department</th>
                                <th className="w-44 px-5 py-6 text-[10px] font-black text-center lifecycle-header-cell">Contract Type</th>
                                <th className="w-40 px-5 py-6 text-[10px] font-black text-center lifecycle-header-cell">Status</th>
                                <th className="w-64 px-5 py-6 text-[10px] font-black text-center lifecycle-header-cell">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp, idx) => (
                                <tr key={emp.id} className={`hover:bg-primary-50/40 transition-all duration-200 group ${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
                                    <td className="px-5 py-4 text-center border-r border-slate-50">
                                        <span className="text-xs font-black text-slate-400">{idx + 1}</span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center shrink-0 font-black text-sm shadow-sm">
                                                {emp.fullName?.trim()?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-black text-slate-800 truncate">{emp.fullName}</div>
                                                {emp.fullNameArabic && (
                                                    <div className="text-[11px] font-bold text-slate-400 truncate" dir="rtl">{emp.fullNameArabic}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        {emp.staffId ? (
                                            <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-mono font-black text-xs tracking-tight">
                                                {emp.staffId}
                                            </span>
                                        ) : <span className="text-slate-300 italic text-xs">---</span>}
                                    </td>
                                    <td className="px-5 py-4 text-sm font-bold text-slate-600 truncate">{emp.position || '—'}</td>
                                    <td className="px-5 py-4 text-sm font-semibold text-slate-500 truncate">{deptName(emp.departmentId)}</td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-[0.15em] shadow-sm
                                            ${emp.contractType === 'NONE RESDANT' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                                emp.contractType === 'DIRCT NONE RESDANT' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}
                                        `}>
                                            {emp.contractType || '---'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getStatusStyle(emp.contractStatus)}`}>
                                            {emp.contractStatus || 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => openDetail(emp)}
                                                className="px-3.5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5"
                                                title={t('view_details', { defaultValue: 'View Details' })}
                                            >
                                                <Eye className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t('details', { defaultValue: 'Details' })}</span>
                                            </button>
                                            <button
                                                onClick={() => openDetail(emp, true)}
                                                className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-90"
                                                title={t('edit', { defaultValue: 'Edit' })}
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-5 py-20 text-center text-slate-400 font-bold">
                                        {t('no_records_found', { defaultValue: 'No matching employees found.' })}
                                    </td>
                                </tr>
                            )}
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

            {/* Full Employee Detail / Edit Page */}
            <Modal
                isOpen={!!detailEmp}
                onClose={closeDetail}
                title={detailEmp ? `${detailEmp.fullName}${detailEmp.staffId ? ' · ' + detailEmp.staffId : ''}` : ''}
                fullScreen
                fullScreenWidth="max-w-7xl"
                headerActions={detailEmp ? (
                    detailEditing ? (
                        <>
                            <button
                                onClick={saveDetailEdit}
                                disabled={updateEmployeeMutation.isPending}
                                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                            >
                                <Check className="w-4 h-4" /> {t('save', { defaultValue: 'Save' })}
                            </button>
                            <button
                                onClick={() => setDetailEditing(false)}
                                className="px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all inline-flex items-center gap-1.5"
                            >
                                <X className="w-4 h-4" /> {t('cancel', { defaultValue: 'Cancel' })}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={beginDetailEdit}
                            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-primary-700 transition-all inline-flex items-center gap-1.5 shadow-sm"
                        >
                            <Edit3 className="w-4 h-4" /> {t('edit', { defaultValue: 'Edit' })}
                        </button>
                    )
                ) : null}
            >
                {detailEmp && (() => {
                    const emp = detailEmp;
                    const src: any = detailEditing ? detailForm : emp;
                    const editing = detailEditing;
                    const fmt = (d?: string) => d ? format(parseISO(d), 'dd MMM yyyy') : '—';
                    const num = (x: any) => Number(x) || 0;
                    const paidAccrued = src.contractStartDate ? Math.floor(differenceInDays(new Date(), parseISO(src.contractStartDate)) / 12) : 0;
                    const paidTaken = num(src.holidaysUsed);
                    const unpaidTaken = num(src.unpaidHolidaysUsed);
                    const emergTaken = num(src.emergencyHolidaysUsed);

                    const setF = (k: string, v: any) => setDetailForm(f => ({ ...f, [k]: v }));
                    const inputCls = "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-bold text-slate-700 shadow-sm";

                    const Section = ({ icon: Icon, title, color, wide, children }: any) => (
                        <div className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm ${wide ? 'xl:col-span-2' : ''}`}>
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">{title}</h4>
                            </div>
                            <div className={`grid grid-cols-1 sm:grid-cols-2 ${wide ? 'lg:grid-cols-3' : ''} gap-x-6 gap-y-4`}>{children}</div>
                        </div>
                    );

                    const Row = ({ label, value, dir }: { label: string; value?: any; dir?: 'rtl' | 'ltr' }) => (
                        <div className="min-w-0">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
                            <div className="text-sm font-bold text-slate-700 break-words" dir={dir}>{(value === 0 || value) ? value : <span className="text-slate-300">—</span>}</div>
                        </div>
                    );

                    const Field = ({ label, k, type = 'text', options, dir }: { label: string; k: string; type?: string; options?: string[]; dir?: 'rtl' | 'ltr' }) => {
                        if (!editing) {
                            let v: any = emp[k as keyof Employee];
                            if (type === 'date') v = v ? fmt(v as string) : '';
                            if (k === 'baseSalary') v = (v || v === 0) ? Number(v).toLocaleString() : '';
                            return <Row label={label} value={v} dir={dir} />;
                        }
                        return (
                            <div className="min-w-0">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
                                {options ? (
                                    <select value={detailForm[k as keyof Employee] as any ?? ''} onChange={e => setF(k, e.target.value)} className={`${inputCls} cursor-pointer`}>
                                        <option value="">—</option>
                                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input type={type} dir={dir} value={detailForm[k as keyof Employee] as any ?? ''} onChange={e => setF(k, e.target.value)} className={`${inputCls} ${dir === 'rtl' ? 'text-right' : ''}`} />
                                )}
                            </div>
                        );
                    };

                    const docs = [
                        { label: t('doc_cv', { defaultValue: 'CV / Resume' }), k: 'cvUrl' },
                        { label: t('doc_degree', { defaultValue: 'University Degree' }), k: 'degreeUrl' },
                        { label: t('doc_birth_cert', { defaultValue: 'Birth Certificate' }), k: 'birthCertUrl' },
                        { label: t('doc_passport_copy', { defaultValue: 'Passport Copy' }), k: 'passportCopyUrl' },
                        { label: t('doc_bank_check', { defaultValue: 'Cancelled Bank Check' }), k: 'bankCheckUrl' },
                        { label: t('doc_photo', { defaultValue: 'Photo' }), k: 'photoUrl' },
                        { label: t('doc_id_card', { defaultValue: 'ID & Driving Card' }), k: 'idCardUrl' },
                        { label: t('doc_job_offer', { defaultValue: 'Signed Job Offer' }), k: 'jobOfferUrl' },
                        { label: t('doc_health_cert', { defaultValue: 'Health Certificate' }), k: 'healthCertUrl' },
                    ];

                    return (
                        <div className="space-y-6">
                            {/* Header banner */}
                            <div className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 text-white shadow-xl shadow-primary-900/25 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900">
                                {/* decorative glows + watermark */}
                                <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                                <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-black/20 blur-3xl pointer-events-none" />
                                <User className="absolute -bottom-8 right-4 w-48 h-48 text-white/[0.06] pointer-events-none select-none" />

                                <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                                    <div className="w-20 h-20 rounded-[22px] bg-white/15 ring-4 ring-white/10 flex items-center justify-center font-black text-3xl shrink-0 shadow-inner backdrop-blur-sm">
                                        {emp.fullName?.trim()?.charAt(0)?.toUpperCase() || <User className="w-8 h-8" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        {editing ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <input value={detailForm.fullName ?? ''} onChange={e => setF('fullName', e.target.value)} placeholder="Full name" className="px-3.5 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 font-black focus:ring-2 focus:ring-white/30 outline-none" />
                                                <input value={detailForm.fullNameArabic ?? ''} onChange={e => setF('fullNameArabic', e.target.value)} placeholder="الاسم بالعربية" dir="rtl" className="px-3.5 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 font-bold text-right focus:ring-2 focus:ring-white/30 outline-none" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-2xl font-black tracking-tight truncate">{emp.fullName}</div>
                                                {emp.fullNameArabic
                                                    ? <div className="text-sm font-bold text-white/70 truncate mt-0.5" dir="rtl">{emp.fullNameArabic}</div>
                                                    : <div className="text-xs font-bold text-white/50 truncate mt-0.5">{emp.email || t('no_email', { defaultValue: 'No email on file' })}</div>}
                                            </>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            {editing ? (
                                                <input value={detailForm.staffId ?? ''} onChange={e => setF('staffId', e.target.value)} placeholder="Staff ID" className="px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 text-white placeholder-white/50 text-[11px] font-mono font-black w-40 outline-none focus:ring-2 focus:ring-white/30" />
                                            ) : (
                                                emp.staffId && <span className="px-3 py-1 rounded-full bg-white/15 border border-white/10 backdrop-blur-sm text-[11px] font-mono font-black tracking-tight">{emp.staffId}</span>
                                            )}
                                            {emp.role && !editing && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/10 backdrop-blur-sm text-[11px] font-bold">
                                                    <Briefcase className="w-3 h-3 opacity-70" />{String(emp.role).replace(/_/g, ' ')}
                                                </span>
                                            )}
                                            {emp.position && !editing && <span className="px-3 py-1 rounded-full bg-white/15 border border-white/10 backdrop-blur-sm text-[11px] font-bold">{emp.position}</span>}
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm text-[11px] font-bold text-white/90">
                                                <Landmark className="w-3 h-3 opacity-70" />{deptName(emp.departmentId)}
                                            </span>
                                            {!editing && (
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${emp.contractStatus === 'Active' || !emp.contractStatus ? 'bg-emerald-400/20 border-emerald-300/30 text-emerald-50' : 'bg-white/10 border-white/15 text-white/80'}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />{emp.contractStatus || 'Active'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section grid — two columns on wide screens so it uses the full width */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                                <Section icon={User} title={t('identity_details', { defaultValue: 'Identity Details' })} color="bg-indigo-50 text-indigo-600">
                                    <Field label={t('gender', { defaultValue: 'Gender' })} k="gender" options={['Male', 'Female']} />
                                    <Field label={t('date_of_birth', { defaultValue: 'Date of Birth' })} k="dateOfBirth" type="date" />
                                    <Field label={t('place_of_birth', { defaultValue: 'Place of Birth' })} k="placeOfBirth" />
                                    <Field label={t('nationality', { defaultValue: 'Nationality' })} k="nationality" />
                                    <Field label={t('national_id', { defaultValue: 'National ID' })} k="nationalId" />
                                    <Field label={t('blood_type', { defaultValue: 'Blood Type' })} k="bloodType" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} />
                                    <Field label={t('academic_qualification', { defaultValue: 'Academic Qualification' })} k="academicQualification" />
                                </Section>

                                <Section icon={CreditCard} title={t('official_documents', { defaultValue: 'ID, Passport & License' })} color="bg-teal-50 text-teal-600">
                                    <Field label={t('id_card_number', { defaultValue: 'ID Card Number' })} k="idCardNumber" />
                                    <Field label={t('id_place_of_issue', { defaultValue: 'ID Place of Issue' })} k="idPlaceOfIssue" />
                                    <Field label={t('id_issue_date', { defaultValue: 'ID Issue Date' })} k="idIssueDate" type="date" />
                                    <Field label={t('passport_number', { defaultValue: 'Passport Number' })} k="passportNumber" />
                                    <Field label={t('passport_place_of_issue', { defaultValue: 'Passport Place of Issue' })} k="passportPlaceOfIssue" />
                                    <Field label={t('passport_expiry_date', { defaultValue: 'Passport Expiry' })} k="passportExpiryDate" type="date" />
                                    <Field label={t('driving_license_type', { defaultValue: 'License Type' })} k="drivingLicenseType" />
                                    <Field label={t('driving_license_number', { defaultValue: 'License Number' })} k="drivingLicenseNumber" />
                                    <Field label={t('driving_license_expiry', { defaultValue: 'License Expiry' })} k="drivingLicenseExpiry" type="date" />
                                    <Field label={t('driving_license_place_of_issue', { defaultValue: 'License Place of Issue' })} k="drivingLicensePlaceOfIssue" />
                                </Section>

                                <Section icon={Phone} title={t('contact_and_address', { defaultValue: 'Contact & Address' })} color="bg-emerald-50 text-emerald-600">
                                    <Field label={t('personal_phone', { defaultValue: 'Personal Phone' })} k="personalPhone" />
                                    <Field label={t('personal_email', { defaultValue: 'Personal E-mail' })} k="personalEmail" />
                                    <Field label={t('email_label', { defaultValue: 'Login Email' })} k="email" />
                                    <Field label={t('emergency_contact', { defaultValue: 'Emergency Contact' })} k="emergencyContactNumber" />
                                    <Field label={t('residential_address', { defaultValue: 'Residential Address' })} k="residentialAddress" />
                                </Section>

                                <Section icon={Briefcase} title={t('employment_details', { defaultValue: 'Employment Details' })} color="bg-blue-50 text-blue-600">
                                    <Row label={t('role_type', { defaultValue: 'Role' })} value={emp.role} />
                                    <Field label="Position" k="position" />
                                    <Field label={t('job_category', { defaultValue: 'Job Category' })} k="jobCategory" />
                                    <Field label={t('job_grade', { defaultValue: 'Job Grade' })} k="jobGrade" />
                                    <Field label="Contract Type" k="contractType" options={['RESDANT', 'DIRCT NONE RESDANT', 'NONE RESDANT']} />
                                    <Field label="Contract #" k="contractNumber" options={['1st', '2nd', '3rd', '4th', 'Permanent']} />
                                    <Field label="Status" k="contractStatus" options={['Active', 'Expired', 'Inactive', 'Terminated', 'On Leave']} />
                                    <Field label="Base Salary" k="baseSalary" type="number" />
                                    <Field label={t('arrival_date', { defaultValue: 'Arrival Date' })} k="arrivalDate" type="date" />
                                    <Field label="Join Date" k="joinDate" type="date" />
                                    <Field label="Contract Start" k="contractStartDate" type="date" />
                                    <Field label="Contract End" k="contractEndDate" type="date" />
                                    <Field label={t('worked_before', { defaultValue: 'Worked Before?' })} k="workedBefore" options={['Yes', 'No']} />
                                    <Field label={t('has_relatives', { defaultValue: 'Relatives in Company?' })} k="hasRelativesInCompany" options={['Yes', 'No']} />
                                    <Field label={t('relatives_names', { defaultValue: "Relatives' Names" })} k="relativesNames" />
                                </Section>

                                <Section icon={CalendarDays} title={t('leave_balances', { defaultValue: 'Leave Balances' })} color="bg-amber-50 text-amber-600">
                                    <Row label="Paid Accrued" value={paidAccrued} />
                                    <Field label="Paid Taken" k="holidaysUsed" type="number" />
                                    <Row label="Paid Balance" value={paidAccrued - paidTaken} />
                                    <Field label="Unpaid Taken" k="unpaidHolidaysUsed" type="number" />
                                    <Row label="Unpaid Balance (14)" value={14 - unpaidTaken} />
                                    <Field label="Emergency Taken" k="emergencyHolidaysUsed" type="number" />
                                    <Row label="Emergency Balance (3)" value={3 - emergTaken} />
                                    {/* Quick add — log a leave day without opening edit mode */}
                                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-4 mt-1 border-t border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">{t('quick_add', { defaultValue: 'Quick Add' })}</span>
                                        <button type="button" onClick={() => quickAdjustLeave('holidaysUsed', 1)} disabled={updateEmployeeMutation.isPending} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-black hover:bg-emerald-600 hover:text-white transition-all active:scale-95 disabled:opacity-50">
                                            <Plus className="w-3.5 h-3.5" /> {t('paid', { defaultValue: 'Paid' })}
                                        </button>
                                        <button type="button" onClick={() => quickAdjustLeave('emergencyHolidaysUsed', 1)} disabled={updateEmployeeMutation.isPending} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-[11px] font-black hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:opacity-50">
                                            <Plus className="w-3.5 h-3.5" /> {t('emergency', { defaultValue: 'Emergency' })}
                                        </button>
                                        <button type="button" onClick={() => quickAdjustLeave('unpaidHolidaysUsed', 1)} disabled={updateEmployeeMutation.isPending} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-black hover:bg-amber-600 hover:text-white transition-all active:scale-95 disabled:opacity-50">
                                            <Plus className="w-3.5 h-3.5" /> {t('unpaid', { defaultValue: 'Unpaid' })}
                                        </button>
                                    </div>
                                </Section>

                                <Section icon={Landmark} title={t('bank_details', { defaultValue: 'Bank Details' })} color="bg-slate-100 text-slate-600">
                                    <Field label={t('bank_name', { defaultValue: 'Bank Name' })} k="bankName" />
                                    <Field label={t('bank_branch', { defaultValue: 'Bank Branch' })} k="bankBranchName" />
                                    <Field label={t('bank_account_number', { defaultValue: 'Account Number' })} k="bankAccountNumber" />
                                </Section>

                                <Section icon={Paperclip} title={t('documents_attachments', { defaultValue: 'Documents & Attachments' })} color="bg-indigo-50 text-indigo-600" wide>
                                    {docs.map(d => {
                                        const raw = (editing ? detailForm[d.k as keyof Employee] : emp[d.k as keyof Employee]) as string | undefined;
                                        const href = raw ? (raw.startsWith('http') ? raw : `${SERVER_URL}${raw}`) : '';
                                        const busy = uploadingDoc === d.k;
                                        if (editing) {
                                            return (
                                                <div key={d.k} className="min-w-0">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{d.label}</label>
                                                    {raw ? (
                                                        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                                                            <span className="flex-1 min-w-0 truncate text-xs font-bold text-slate-700">{raw.split('/').pop()}</span>
                                                            <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-emerald-700 text-[10px] font-black uppercase tracking-wider">{t('view', { defaultValue: 'View' })}</a>
                                                            <button type="button" onClick={() => setF(d.k, '')} className="shrink-0 text-slate-400 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    ) : (
                                                        <label className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${busy ? 'border-primary-300 bg-primary-50/50' : 'border-slate-200 bg-white hover:border-primary-400'}`}>
                                                            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" disabled={busy} onChange={e => handleDetailDocUpload(d.k, e.target.files?.[0])} />
                                                            {busy ? <span className="text-[11px] font-black text-primary-500 uppercase tracking-widest animate-pulse">{t('uploading', { defaultValue: 'Uploading…' })}</span> : <><Upload className="w-4 h-4 text-slate-400" /><span className="text-[11px] font-bold text-slate-500">{t('choose_file', { defaultValue: 'Choose file' })}</span></>}
                                                        </label>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={d.k} className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
                                                <span className="text-xs font-bold text-slate-600 truncate">{d.label}</span>
                                                {raw ? (
                                                    <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
                                                        {t('view', { defaultValue: 'View' })} <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                ) : <span className="shrink-0 text-[10px] font-bold text-slate-300 uppercase tracking-wider">—</span>}
                                            </div>
                                        );
                                    })}
                                </Section>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default LifecycleControl;
