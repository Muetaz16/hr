import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../../services/employeeService';
import { personnelActionService, type PersonnelActionForm } from '../../services/personnelActionService';
import { jobDescriptionService } from '../../services/jobDescriptionService';
import { departmentService, divisionService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { directorateService } from '../../services/directorateService';
import { SERVER_URL } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import {
    Users,
    Clock,
    FileText,
    Award,
    AlertOctagon,
    CheckCircle2,
    Building2,
    ShieldAlert,
    Search,
    Filter,
    Eye,
    User,
    CreditCard,
    Phone,
    Landmark,
    Paperclip,
    Briefcase,
    CalendarDays,
    ExternalLink,
    Trash2,
    Plus,
    ArrowRight,
    Check,
    X,
    Upload,
    FileSpreadsheet as ExcelIcon
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO, addDays, addMonths } from 'date-fns';
import Modal from '../../components/Modal';
import type { Employee, EmployeeDocument } from '../../types';
import { makeFieldVisibility } from '../../utils/employeeFieldVisibility';
import { canAccess } from '../../utils/access';
import EvaluationControl from '../hr/EvaluationControl';
import EvaluationsPage from '../Evaluations';

const PersonnelRelations: React.FC = () => {
    const location = useLocation();
    const currentPath = location.pathname;
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    // Document control (add/replace/delete) is HR-only — everyone else who can see this screen
    // (heads, plain employees) stays view-only, same as the rest of the detail modal.
    const isHRRole = ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'].includes(currentUser?.role || '');

    // Determine active tab from route path
    const getActiveTab = () => {
        if (currentPath.includes('/lifecycle')) return 'lifecycle';
        if (currentPath.includes('/renewals')) return 'renewals';
        if (currentPath.includes('/action-forms')) return 'action-forms';
        if (currentPath.includes('/rewards')) return 'rewards';
        if (currentPath.includes('/disciplinary')) return 'disciplinary';
        if (currentPath.includes('/offboarding')) return 'offboarding';
        if (currentPath.includes('/evaluations')) return 'evaluations';
        return 'lifecycle'; // Fallback
    };

    const activeTab = getActiveTab();

    // Modals
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [isActionFormModalOpen, setIsActionFormModalOpen] = useState(false);
    // Personnel Action Form (internal transfer) — driven by the target Job Description.
    const emptyPaf = {
        employeeId: '', newJobDescriptionId: '', newJobGrade: '', newPlaceOfWork: '',
        reportsTo: '', typeOfTransfer: '', effectiveDate: '', justification: '',
    };
    const [pafForm, setPafForm] = useState({ ...emptyPaf });
    const [pafSubmitting, setPafSubmitting] = useState(false);
    const [decidePaf, setDecidePaf] = useState<PersonnelActionForm | null>(null);
    const [decideFile, setDecideFile] = useState<File | null>(null);
    const [decideBusy, setDecideBusy] = useState<string | null>(null);
    const [pafGenBusy, setPafGenBusy] = useState<string | null>(null);
    const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
    // Initiate Renewal form: the proposed new contract + the signed contract file to attach.
    const [renewForm, setRenewForm] = useState({ startDate: '', endDate: '', salary: 0, contractNumber: '', notes: '' });
    const [renewFile, setRenewFile] = useState<File | null>(null);
    const [renewSubmitting, setRenewSubmitting] = useState(false);
    const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
    const [isDisciplinaryModalOpen, setIsDisciplinaryModalOpen] = useState(false);
    const [isOffboardingModalOpen, setIsOffboardingModalOpen] = useState(false);

    // Lifecycle tab — search/filter + read-only detail view
    const [lifecycleSearch, setLifecycleSearch] = useState('');
    const [lifecycleFilterType, setLifecycleFilterType] = useState('All');
    const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
    const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);
    const [newDocName, setNewDocName] = useState('');
    const [newDocFile, setNewDocFile] = useState<File | null>(null);
    const [addingDoc, setAddingDoc] = useState(false);
    // The "Add Document" name+file form lives in its own popup (not inline in the detail view)
    // because the detail view's Section/Row/Field helpers are re-created on every render, which
    // would remount the inline inputs on every keystroke and kick focus/scroll around.
    const [addDocModalOpen, setAddDocModalOpen] = useState(false);

    // Additional (free-form) documents for the employee currently open in the detail modal.
    const { data: employeeDocuments = [] } = useQuery({
        queryKey: ['employee-documents', detailEmp?.id],
        queryFn: () => employeeService.getEmployeeDocuments(detailEmp!.id),
        enabled: !!detailEmp && isHRRole,
    });

    // Replace/upload one of the fixed document slots (CV, degree, etc.) directly from this screen.
    const handleFixedDocUpload = async (empId: string, key: string, file?: File) => {
        if (!file) return;
        setUploadingDocKey(key);
        try {
            const { url } = await employeeService.uploadDocument(file);
            await employeeService.updateEmployee(empId, { [key]: url } as Partial<Employee>);
            setDetailEmp(prev => (prev && prev.id === empId ? ({ ...prev, [key]: url } as Employee) : prev));
            queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
            toast.success('Document updated.');
        } catch (err) {
            console.error('Failed to upload document', err);
            toast.error('Failed to upload document.');
        } finally {
            setUploadingDocKey(null);
        }
    };

    // Add a brand-new, custom-named document (e.g. a new certificate) for the employee.
    const handleAddDocument = async (empId: string) => {
        if (!newDocName.trim()) { toast.error('Enter a name for the document.'); return; }
        if (!newDocFile) { toast.error('Choose a file to upload.'); return; }
        setAddingDoc(true);
        try {
            const { url, name: fileName } = await employeeService.uploadDocument(newDocFile);
            await employeeService.addEmployeeDocument(empId, newDocName.trim(), url, fileName);
            setNewDocName('');
            setNewDocFile(null);
            setAddDocModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['employee-documents', empId] });
            toast.success('Document added.');
        } catch (err) {
            console.error('Failed to add document', err);
            toast.error('Failed to add document.');
        } finally {
            setAddingDoc(false);
        }
    };

    const handleDeleteDocument = async (empId: string, docId: string) => {
        if (!window.confirm('Remove this document? This cannot be undone.')) return;
        try {
            await employeeService.deleteEmployeeDocument(empId, docId);
            queryClient.invalidateQueries({ queryKey: ['employee-documents', empId] });
            toast.success('Document removed.');
        } catch (err) {
            console.error('Failed to delete document', err);
            toast.error('Failed to delete document.');
        }
    };

    // Queries
    const { data: employees = [], isLoading: isLoadingEmps } = useQuery({
        queryKey: ['relations-employees'],
        queryFn: async () => {
            const emps = await employeeService.getAllEmployees();
            return emps;
        }
    });

    // Contract Renewals — only employees whose contract ends within 30 days (or has already
    // lapsed and hasn't been renewed yet), not every employee who merely has an end date on file.
    const contractsNeedingRenewal = employees
        .filter((e: any) => e.contractEndDate && e.contractStatus !== 'Terminated' && e.contractStatus !== 'Inactive')
        .map((e: any) => ({ ...e, daysLeft: differenceInDays(parseISO(e.contractEndDate), new Date()) }))
        .filter((e: any) => e.daysLeft <= 30)
        .sort((a: any, b: any) => a.daysLeft - b.daysLeft);

    const { data: departments = [] } = useQuery({
        queryKey: ['relations-departments'],
        queryFn: departmentService.getAllDepartments
    });
    const { data: units = [] } = useQuery({
        queryKey: ['relations-units'],
        queryFn: unitService.getAllUnits
    });
    const { data: divisions = [] } = useQuery({
        queryKey: ['relations-divisions'],
        queryFn: divisionService.getAllDivisions
    });
    const { data: directorates = [] } = useQuery({
        queryKey: ['relations-directorates'],
        queryFn: directorateService.getAllDirectorates
    });
    const { data: personnelActions = [] } = useQuery({
        queryKey: ['personnel-actions'],
        queryFn: () => personnelActionService.list(),
    });
    const { data: jobDescriptions = [] } = useQuery({
        queryKey: ['relations-jds'],
        queryFn: jobDescriptionService.getAllJobDescriptions,
    });

    // An employee isn't necessarily attached to a Department — they may belong to a Unit
    // (most specific), a Division, or a Directorate instead (e.g. Head of Division/Directorate
    // roles have no departmentId at all). Show whichever org unit they actually report to.
    const orgUnitName = (emp: any): string => {
        if (emp.unitId) {
            const u = units.find((x: any) => x.id === emp.unitId);
            if (u) return u.name;
        }
        if (emp.departmentId) {
            const d = departments.find((x: any) => x.id === emp.departmentId);
            if (d) return d.isOffice ? `${d.name} (Office)` : d.name;
        }
        if (emp.divisionId) {
            const dv = divisions.find((x: any) => x.id === emp.divisionId);
            if (dv) return dv.name;
        }
        if (emp.directorateId) {
            const dir = directorates.find((x: any) => x.id === emp.directorateId);
            if (dir) return dir.name;
        }
        return '—';
    };

    // Natural, human-friendly ordering of Staff IDs (IPH-125-001, IPH-125-002, … IPH-126-001)
    // instead of insertion order. Records without a Staff ID sink to the bottom, then sort by name.
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

    const filteredLifecycleEmployees = (employees as Employee[]).filter(emp => {
        const matchesSearch = emp.fullName.toLowerCase().includes(lifecycleSearch.toLowerCase()) ||
            (emp.staffId || '').toLowerCase().includes(lifecycleSearch.toLowerCase()) ||
            (emp.passportNumber || '').toLowerCase().includes(lifecycleSearch.toLowerCase());
        const matchesFilter = lifecycleFilterType === 'All' || emp.contractType === lifecycleFilterType;
        return matchesSearch && matchesFilter;
    }).sort(compareStaffId);

    const getLifecycleStatusStyle = (status?: string) => {
        switch (status) {
            case 'Active': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'On Leave': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'Terminated':
            case 'Inactive': return 'bg-rose-50 text-rose-700 border-rose-100';
            default: return 'bg-slate-50 text-slate-600 border-slate-100';
        }
    };

    const exportLifecycleExcel = () => {
        const headerStyle: any = {
            font: { sz: 10, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: "511D29" } }
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
        const zebraStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "F5EBD9" } } };

        const headerRow = ['Staff ID', 'Full Name', 'Arabic Name', 'Position', 'Department / Division', 'Contract Type', 'Status', 'Join Date', 'Contract End'].map(h => ({ v: h, s: headerStyle }));
        const dataRows = filteredLifecycleEmployees.map((e, idx) => {
            const rowStyle = idx % 2 === 0 ? baseStyle : zebraStyle;
            return [
                { v: e.staffId || '---', s: rowStyle },
                { v: e.fullName, s: { ...rowStyle, alignment: { horizontal: 'left' } } },
                { v: e.fullNameArabic || '---', s: { ...rowStyle, alignment: { horizontal: 'right' } } },
                { v: e.position || '---', s: rowStyle },
                { v: orgUnitName(e), s: rowStyle },
                { v: e.contractType || '---', s: rowStyle },
                { v: e.contractStatus || 'Active', s: rowStyle },
                { v: e.joinDate ? format(parseISO(e.joinDate), 'dd/MM/yyyy') : '---', s: rowStyle },
                { v: e.contractEndDate ? format(parseISO(e.contractEndDate), 'dd/MM/yyyy') : '---', s: rowStyle },
            ];
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
        ws['!cols'] = headerRow.map((h, i) => {
            const maxLen = Math.max(String(h.v).length, ...dataRows.map(row => String(row[i].v).length));
            return { wch: Math.min(maxLen + 5, 40) };
        });
        XLSX.utils.book_append_sheet(wb, ws, "Employee Lifecycle");
        XLSX.writeFile(wb, `IPH_Personnel_Relations_Lifecycle_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        toast.success('Lifecycle report exported.');
    };

    const [incidents] = useState<any[]>([
        { id: 'INC-2026-001', name: 'John Doe', type: 'Late Attendance Pattern', date: '2026-08-02', severity: 'Low', status: 'Notice to Explain Issued' },
        { id: 'INC-2026-002', name: 'Sara Connor', type: 'Unexcused Absence', date: '2026-07-29', severity: 'Medium', status: 'Investigation Completed' }
    ]);

    const [clearances] = useState<any[]>([
        { id: 1, name: 'Michael Scott', type: 'Voluntary (Resignation)', date: '2026-08-15', clearance: { IT: true, HR: true, Finance: false }, payrollStatus: 'Withheld' },
        { id: 2, name: 'Jim Halpert', type: 'Voluntary (Resignation)', date: '2026-08-30', clearance: { IT: false, HR: false, Finance: false }, payrollStatus: 'Pending Documentation' }
    ]);

    // Handlers
    // Create a Personnel Action Form (internal transfer). Persists a PENDING record; the DOCX is
    // generated separately, signed offline, then uploaded on Accept.
    // Create a Personnel Action Form (internal transfer). The chosen target Job Description drives
    // the destination; a PENDING record is stored, then generated/signed/uploaded/accepted.
    const handleActionFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pafForm.employeeId) { toast.error('Select an employee.'); return; }
        if (!pafForm.newJobDescriptionId) { toast.error('Select the target position (Job Description).'); return; }
        setPafSubmitting(true);
        try {
            await personnelActionService.create(pafForm);
            queryClient.invalidateQueries({ queryKey: ['personnel-actions'] });
            toast.success('Transfer form created. Generate it to collect signatures.');
            setIsActionFormModalOpen(false);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create the form.');
        } finally {
            setPafSubmitting(false);
        }
    };

    const openCreatePaf = () => { setPafForm({ ...emptyPaf }); setIsActionFormModalOpen(true); };

    // Download the filled Personnel Action Form (.docx).
    const downloadPafForm = async (paf: PersonnelActionForm) => {
        setPafGenBusy(paf.id);
        try {
            const blob = await personnelActionService.generateForm(paf.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Personnel_Action_${(paf.employee?.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Personnel Action Form generated.');
        } catch (error: any) {
            let msg = 'Failed to generate the form.';
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setPafGenBusy(null);
        }
    };

    // Accept (applies the transfer, requires the signed file) or reject a pending form.
    const handleDecide = async (decision: 'ACCEPT' | 'REJECT') => {
        if (!decidePaf) return;
        if (decision === 'ACCEPT' && !decideFile) { toast.error('Attach the signed form to accept.'); return; }
        setDecideBusy(decision);
        try {
            let documentUrl: string | undefined;
            let documentName: string | undefined;
            if (decideFile) {
                const uploaded = await employeeService.uploadDocument(decideFile);
                documentUrl = uploaded.url;
                documentName = uploaded.name;
            }
            await personnelActionService.decide(decidePaf.id, { decision, documentUrl, documentName });
            queryClient.invalidateQueries({ queryKey: ['personnel-actions'] });
            queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
            queryClient.invalidateQueries({ queryKey: ['employee-documents', decidePaf.employeeId] });
            toast.success(decision === 'ACCEPT' ? 'Transfer accepted and applied to the employee.' : 'Form rejected.');
            setDecidePaf(null);
            setDecideFile(null);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to process the decision.');
        } finally {
            setDecideBusy(null);
        }
    };

    // Open the Initiate Renewal modal, pre-filling the new contract as: start = day after the
    // current contract ends, end = start + 6 months (editable), salary carried from the record.
    const openRenewalModal = (emp: any) => {
        const start = emp.contractEndDate ? addDays(parseISO(emp.contractEndDate), 1) : new Date();
        const end = addMonths(start, 6);
        setSelectedEmployee(emp);
        setRenewForm({
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
            salary: emp.baseSalary || 0,
            contractNumber: '',
            notes: '',
        });
        setRenewFile(null);
        setIsRenewalModalOpen(true);
    };

    // Apply the renewal: upload the signed contract, then update the contract (which archives the
    // old one, carries over paid leave, resets emergency/unpaid, and files the signed doc under the
    // employee's Lifecycle documents).
    const handleRenewalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee) return;
        if (!renewForm.startDate || !renewForm.endDate) { toast.error('Enter the new contract start and end dates.'); return; }
        if (!renewFile) { toast.error('Attach the signed contract before confirming.'); return; }
        setRenewSubmitting(true);
        try {
            const { url, name } = await employeeService.uploadDocument(renewFile);
            await employeeService.renewContract(selectedEmployee.id, {
                startDate: renewForm.startDate,
                endDate: renewForm.endDate,
                salary: renewForm.salary,
                contractNumber: renewForm.contractNumber || null,
                type: selectedEmployee.contractType || null,
                notes: renewForm.notes || null,
                documentUrl: url,
                documentName: name,
            });
            queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
            queryClient.invalidateQueries({ queryKey: ['employee-documents', selectedEmployee.id] });
            toast.success('Contract renewed. Signed document filed to the employee lifecycle.');
            setIsRenewalModalOpen(false);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to renew the contract.');
        } finally {
            setRenewSubmitting(false);
        }
    };

    // Generate the Contract Renewal Form (.docx) with the employee's info auto-filled, then trigger
    // a browser download so HR can print it and collect the physical approval signatures.
    const [renewalFormBusy, setRenewalFormBusy] = useState<string | null>(null);
    const handleGenerateRenewalForm = async (emp: any) => {
        setRenewalFormBusy(emp.id);
        try {
            const blob = await employeeService.generateContractRenewalForm(emp.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Contract_Renewal_${(emp.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Contract renewal form generated.');
        } catch (error: any) {
            let msg = 'Failed to generate the form.';
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setRenewalFormBusy(null);
        }
    };

    const handleNominateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        toast.success('Award nomination logged successfully.');
        setIsNominateModalOpen(false);
    };

    const handleDisciplinarySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        toast.success('Disciplinary action log created.');
        setIsDisciplinaryModalOpen(false);
    };

    if (isLoadingEmps) {
        return <div className="p-12 text-center animate-pulse text-[#511d29] font-black uppercase tracking-widest text-sm">Loading Personnel Relations...</div>;
    }

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight">
                        Personnel Relations Department
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        Manage employee lifecycles, contract renewals, disciplinary procedures, offboarding, rewards, and performance metrics.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-4 py-2 bg-[#f5ebd9] border border-[#511d29]/30 text-xs font-black text-[#511d29] uppercase tracking-widest">
                        Relations Center
                    </span>
                </div>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'lifecycle' && (
                <div className="space-y-6">
                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">Employee Lifecycle Tracking</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Tracks the entire career stages of all personnel from probation to active service status, transfers, and promotions.
                            </p>
                        </div>
                    </div>

                    {/* Search / Filter */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, ID or Passport..."
                                    value={lifecycleSearch}
                                    onChange={(e) => setLifecycleSearch(e.target.value)}
                                    className="pl-10 pr-4 py-2.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#511d29]/10 focus:border-[#511d29] transition-all w-72"
                                />
                            </div>
                            <div className="relative">
                                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={lifecycleFilterType}
                                    onChange={(e) => setLifecycleFilterType(e.target.value)}
                                    className="pl-10 pr-8 py-2.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold focus:ring-2 focus:ring-[#511d29]/10 appearance-none cursor-pointer"
                                >
                                    <option value="All">All Types</option>
                                    <option value="RESDANT">RESDANT</option>
                                    <option value="DIRCT NONE RESDANT">DIRCT NONE RESDANT</option>
                                    <option value="NONE RESDANT">NONE RESDANT</option>
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={exportLifecycleExcel}
                            className="px-4 py-2.5 bg-[#511d29] text-white rounded-lg font-black text-[11px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2 active:scale-95 shrink-0"
                        >
                            <ExcelIcon className="w-4 h-4" /> Export Excel
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex justify-between items-center">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Active Workforce Status</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredLifecycleEmployees.length} Records Found</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Staff ID</th>
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Position</th>
                                        <th className="p-4">Department / Division</th>
                                        <th className="p-4">Contract Type</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Joined Date</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {filteredLifecycleEmployees.map((emp) => (
                                        <tr key={emp.id} className="hover:bg-slate-50/50">
                                            <td className="p-4 font-bold">{emp.staffId || 'N/A'}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#511d29] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                                        {emp.fullName?.trim()?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-800 truncate">{emp.fullName}</p>
                                                        <p className="text-[10px] text-slate-500 truncate">{emp.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">{emp.position || 'Standard Staff'}</td>
                                            <td className="p-4 text-slate-500">{orgUnitName(emp)}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-[#511d29]/5 text-[#511d29] border border-[#511d29]/10">
                                                    {emp.contractType || '---'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border ${getLifecycleStatusStyle(emp.contractStatus)}`}>
                                                    {emp.contractStatus || 'Active'}
                                                </span>
                                            </td>
                                            <td className="p-4">{emp.joinDate ? format(parseISO(emp.joinDate), 'yyyy-MM-dd') : 'N/A'}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setDetailEmp(emp)}
                                                    className="px-3 py-1.5 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#3a151d] transition-colors inline-flex items-center gap-1.5"
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLifecycleEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-10 text-center text-slate-400 font-bold">No matching employees found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'renewals' && (
                <div className="space-y-6">
                    <div className="bg-amber-50/50 border border-amber-200 p-6 rounded-lg flex items-start gap-4">
                        <div className="w-12 h-12 bg-amber-500 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-outfit font-black text-lg text-amber-800 uppercase">Contract Renewal Control</h3>
                            <p className="text-sm text-amber-900/80 mt-1">
                                Contract renewals must be reviewed and processed exactly **one month (30 days) before the end of the contract**.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex justify-between items-center">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Contracts Expiring Within 30 Days</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{contractsNeedingRenewal.length} {contractsNeedingRenewal.length === 1 ? 'Employee' : 'Employees'}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">End Date</th>
                                        <th className="p-4">Days Left</th>
                                        <th className="p-4">Renewal Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {contractsNeedingRenewal.map((emp) => {
                                        const isOverdue = emp.daysLeft < 0;
                                        const isUrgent = emp.daysLeft <= 7;
                                        return (
                                            <tr key={emp.id} className="hover:bg-slate-50/50">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-800">{emp.fullName}</p>
                                                    <p className="text-[10px] text-slate-500">{emp.position || 'Standard Staff'}</p>
                                                </td>
                                                <td className="p-4 font-bold">{format(parseISO(emp.contractEndDate), 'dd MMM yyyy')}</td>
                                                <td className="p-4">
                                                    <span className={`font-bold ${isUrgent ? 'text-red-600 font-black animate-pulse' : 'text-amber-600'}`}>
                                                        {isOverdue ? `${Math.abs(emp.daysLeft)} days overdue` : `${emp.daysLeft} days`}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                                                        isOverdue ? 'bg-red-100 text-red-800' : isUrgent ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {isOverdue ? 'Overdue' : isUrgent ? 'Urgent' : 'Action Required'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleGenerateRenewalForm(emp)}
                                                            disabled={renewalFormBusy === emp.id}
                                                            className="px-3 py-1.5 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#3a151d] transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            <FileText className="w-3 h-3" />
                                                            {renewalFormBusy === emp.id ? 'Generating…' : 'Generate Form'}
                                                        </button>
                                                        <button
                                                            onClick={() => openRenewalModal(emp)}
                                                            className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-amber-700 transition-colors"
                                                        >
                                                            Initiate Renewal
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {contractsNeedingRenewal.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center text-slate-400 font-bold">No contracts are nearing expiration.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'action-forms' && (
                <div className="space-y-6">
                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">Personnel Action Forms</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Internal transfers driven by the target Job Description. Generate the form, collect signatures, upload the signed copy, then accept to move the employee.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={openCreatePaf}
                                className="px-4 py-2 bg-[#511d29] text-white text-xs font-black uppercase tracking-widest hover:bg-[#3a151d] inline-flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Create Internal Transfer
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex justify-between items-center">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Transfer Requests</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{personnelActions.length} {personnelActions.length === 1 ? 'Form' : 'Forms'}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Move</th>
                                        <th className="p-4">Effective</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {personnelActions.map((paf) => {
                                        const toName = units.find((u: any) => u.id === paf.newUnitId)?.name
                                            || departments.find((d: any) => d.id === paf.newDepartmentId)?.name
                                            || divisions.find((d: any) => d.id === paf.newDivisionId)?.name || '—';
                                        const fromName = paf.currentUnit || paf.currentDepartment || paf.currentDivision || '—';
                                        const badge = paf.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800'
                                            : paf.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
                                        return (
                                            <tr key={paf.id} className="hover:bg-slate-50/50">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-800">{paf.employee?.fullName || '—'}</p>
                                                    <p className="text-[10px] text-slate-500">{paf.newPositionTitle || paf.typeOfTransfer || 'Internal Transfer'}</p>
                                                </td>
                                                <td className="p-4">
                                                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                                                        <span className="font-bold">{fromName}</span>
                                                        <ArrowRight className="w-3 h-3 text-[#511d29]" />
                                                        <span className="font-black text-[#511d29]">{toName}</span>
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold">{paf.effectiveDate ? format(parseISO(paf.effectiveDate), 'dd MMM yyyy') : '—'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${badge}`}>{paf.status}</span>
                                                    {paf.decidedByName && <p className="text-[9px] text-slate-400 mt-1">by {paf.decidedByName}</p>}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => downloadPafForm(paf)}
                                                            disabled={pafGenBusy === paf.id}
                                                            className="px-3 py-1.5 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#3a151d] transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
                                                        >
                                                            <FileText className="w-3 h-3" />
                                                            {pafGenBusy === paf.id ? 'Generating…' : 'Generate Form'}
                                                        </button>
                                                        {paf.status === 'PENDING' && (
                                                            <button
                                                                onClick={() => { setDecidePaf(paf); setDecideFile(null); }}
                                                                className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-amber-700 transition-colors inline-flex items-center gap-1.5"
                                                            >
                                                                <Upload className="w-3 h-3" /> Upload &amp; Decide
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {personnelActions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center text-slate-400 font-bold">No transfer requests yet. Create one to get started.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'rewards' && (
                <div className="space-y-6">
                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                                <Award className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">Rewards & Recognition</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Recognize exceptional contributions. **All rewards are triggered based on the Employee's Performance Evaluation.**
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsNominateModalOpen(true)}
                            className="px-4 py-2 bg-[#511d29] text-white text-xs font-black uppercase tracking-widest hover:bg-[#3a151d]"
                        >
                            + Log Nomination
                        </button>
                    </div>

                    {/* Cards grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <RewardCard title="Employee of the Month" desc="Awarded to an employee demonstrating stellar performance, task completions, and teamwork during the month." />
                        <RewardCard title="Employee of the Year" desc="Awarded annually to an outstanding employee with consistent record-breaking performances and values alignment." />
                        <RewardCard title="Excellence & Timeliness Award" desc="Recognizes personnel with zero-attendance leaks, fast task resolution rates, and exceptional punctuality." />
                        <RewardCard title="Loyalty Award" desc="Honors long-standing employees for their long service tenure, contribution milestones, and company trust." />
                        <RewardCard title="Exceptional Performance Award" desc="For special acts of problem-solving, cost-reduction leadership, or emergency project resolutions." />
                        <RewardCard title="Bi-Annual Bonus" desc="Performance-related financial bonus calculated and triggered directly after mid-year and year-end evaluations." />
                    </div>
                </div>
            )}

            {activeTab === 'disciplinary' && (
                <div className="space-y-6">
                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-700 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                                <AlertOctagon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-outfit font-black text-lg text-red-700 uppercase">Disciplinary Action Workflows</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Manage formal disciplinary processes from incident logs to official action notices.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsDisciplinaryModalOpen(true)}
                            className="px-4 py-2 bg-red-700 text-white text-xs font-black uppercase tracking-widest hover:bg-red-800"
                        >
                            + Log Incident Report
                        </button>
                    </div>

                    {/* Steps diagram / card links */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DisciplinaryStepCard step="1" title="Incident Report" desc="Formal reporting of a policy breach or performance warning." />
                        <DisciplinaryStepCard step="2" title="Notice to Explain" desc="Notice served to the employee to explain their side of the incident." />
                        <DisciplinaryStepCard step="3" title="Investigation Report" desc="Detailed facts finding log submitted by Personnel Relations." />
                        <DisciplinaryStepCard step="4" title="Notice of Action" desc="Final warning, suspension, or formal disciplinary decision." />
                    </div>

                    {/* Incidents Table */}
                    <div className="bg-white border border-red-700/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-red-700/10 bg-red-50/20">
                            <span className="text-xs font-black text-red-700 uppercase tracking-wider">Active Cases Log</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-red-700/5 text-red-700 uppercase font-black tracking-wider text-[10px] border-b border-red-700/10">
                                        <th className="p-4">Case ID</th>
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Incident Details</th>
                                        <th className="p-4">Severity</th>
                                        <th className="p-4">Current Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-red-700/5 font-medium text-slate-700">
                                    {incidents.map((inc) => (
                                        <tr key={inc.id} className="hover:bg-slate-50/50">
                                            <td className="p-4 font-bold text-red-700">{inc.id}</td>
                                            <td className="p-4 font-bold">{inc.name}</td>
                                            <td className="p-4">{inc.type}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 text-[9px] font-black rounded ${
                                                    inc.severity === 'Low' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {inc.severity}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-slate-600">{inc.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'offboarding' && (
                <div className="space-y-6">
                    {/* CRITICAL WARNING */}
                    <div className="bg-red-50 border-2 border-red-500/30 p-6 rounded-lg flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-600 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <ShieldAlert className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="font-outfit font-black text-lg text-red-700 uppercase">Payroll Withholding Notice</h3>
                            <p className="text-sm text-red-950 mt-1 font-bold">
                                Offboarding is directly connected with Payroll. The Company has the right to withhold the last payment of the employee without proper clearance and offboarding documentation.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Voluntary */}
                        <div className="bg-white border border-[#511d29]/20 p-6 rounded-xl shadow-sm space-y-4">
                            <h4 className="text-md font-black text-[#511d29] uppercase border-b border-[#511d29]/10 pb-2">Voluntary Resignation</h4>
                            <ul className="space-y-2 text-xs font-semibold text-slate-700">
                                <li className="flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 size={16} /> Resignation Letter Submission & Verification
                                </li>
                                <li className="flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 size={16} /> Exit Interview Feedback Log
                                </li>
                                <li className="flex items-center gap-2 text-slate-500">
                                    <Clock size={16} className="text-amber-500" /> Complete Employee Clearance Form (IT, Assets, Finance)
                                </li>
                            </ul>
                        </div>

                        {/* Involuntary */}
                        <div className="bg-white border border-red-700/20 p-6 rounded-xl shadow-sm space-y-4">
                            <h4 className="text-md font-black text-red-700 uppercase border-b border-red-700/10 pb-2">Involuntary Termination</h4>
                            <ul className="space-y-2 text-xs font-semibold text-slate-700">
                                <li className="flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 size={16} /> Formal Termination/Redundancy Notice Issued
                                </li>
                                <li className="flex items-center gap-2 text-slate-500">
                                    <Clock size={16} className="text-amber-500" /> Exit Interview (Optional/Documented)
                                </li>
                                <li className="flex items-center gap-2 text-slate-500">
                                    <Clock size={16} className="text-amber-500" /> Clearance Form Sign-off & Handover
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Clearance Checklist Table */}
                    <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-[#511d29]/10 bg-slate-50/50 flex justify-between items-center">
                            <span className="text-xs font-black text-[#511d29] uppercase tracking-wider">Active Clearance Cases</span>
                            <button
                                onClick={() => setIsOffboardingModalOpen(true)}
                                className="px-3 py-1 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#3a151d]"
                            >
                                Initiate Offboarding
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                        <th className="p-4">Employee</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Effective Date</th>
                                        <th className="p-4">Clearance Status</th>
                                        <th className="p-4">Last Salary Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#511d29]/5 font-medium text-slate-700">
                                    {clearances.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50/50">
                                            <td className="p-4 font-bold">{c.name}</td>
                                            <td className="p-4">{c.type}</td>
                                            <td className="p-4 font-bold">{c.date}</td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${c.clearance.IT ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>IT</span>
                                                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${c.clearance.HR ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>HR</span>
                                                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${c.clearance.Finance ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>Finance</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                                                    c.payrollStatus === 'Withheld' ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {c.payrollStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'evaluations' && (
                canAccess(currentUser, ['SUPER_ADMIN', 'HR_MANAGER'], ['manage_evaluation_control']) ? (
                    // HR/Admin: open/close the evaluation window, monitor & delete submitted evaluations.
                    <EvaluationControl embedded />
                ) : canAccess(currentUser, ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL'], ['view_evaluations']) ? (
                    // Managers: fill in evaluations for the employees under them.
                    <EvaluationsPage />
                ) : (
                    <div className="bg-white border border-[#511d29]/10 rounded-xl p-12 text-center text-slate-400">
                        You don't have permission to view evaluation controls.
                    </div>
                )
            )}

            {/* MODALS */}
            {/* Modal 1: Create Internal Transfer (Personnel Action Form) */}
            <Modal isOpen={isActionFormModalOpen} onClose={() => setIsActionFormModalOpen(false)} title="Create Internal Transfer" maxWidth="max-w-xl">
                <form onSubmit={handleActionFormSubmit} className="space-y-4 text-xs font-semibold text-slate-700 max-h-[70vh] overflow-y-auto pr-1">
                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Employee <span className="text-red-500">*</span></label>
                        <select value={pafForm.employeeId} onChange={e => setPafForm({ ...pafForm, employeeId: e.target.value })}
                            className="w-full p-2 border border-[#511d29]/20 bg-white">
                            <option value="">— Select employee —</option>
                            {[...employees].sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || '')).map((e: any) => (
                                <option key={e.id} value={e.id}>{e.fullName}{e.staffId ? ` (${e.staffId})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Target Position — Job Description <span className="text-red-500">*</span></label>
                        <select value={pafForm.newJobDescriptionId} onChange={e => setPafForm({ ...pafForm, newJobDescriptionId: e.target.value })}
                            className="w-full p-2 border border-[#511d29]/20 bg-white">
                            <option value="">— Select the position to move into —</option>
                            {[...jobDescriptions].sort((a: any, b: any) => (a.title || '').localeCompare(b.title || '')).map((j: any) => (
                                <option key={j.id} value={j.id}>{j.title}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">The new division / department / unit / position / category come from the selected Job Description. On accept the employee is assigned to it.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Type of Transfer</label>
                            <input type="text" value={pafForm.typeOfTransfer} placeholder="e.g. Internal Transfer, Promotion" onChange={e => setPafForm({ ...pafForm, typeOfTransfer: e.target.value })} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                        </div>
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Effectivity Date</label>
                            <input type="date" value={pafForm.effectiveDate} onChange={e => setPafForm({ ...pafForm, effectiveDate: e.target.value })} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">New Job Grade (Optional)</label>
                            <input type="text" value={pafForm.newJobGrade} placeholder="Defaults to current" onChange={e => setPafForm({ ...pafForm, newJobGrade: e.target.value })} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                        </div>
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Reports To (Optional)</label>
                            <input type="text" value={pafForm.reportsTo} placeholder="Defaults to the JD" onChange={e => setPafForm({ ...pafForm, reportsTo: e.target.value })} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Place of Work (Optional)</label>
                        <input type="text" value={pafForm.newPlaceOfWork} placeholder="Defaults to the JD" onChange={e => setPafForm({ ...pafForm, newPlaceOfWork: e.target.value })} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Justification / Remarks</label>
                        <textarea rows={2} value={pafForm.justification} onChange={e => setPafForm({ ...pafForm, justification: e.target.value })} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                    </div>

                    <button type="submit" disabled={pafSubmitting} className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest hover:bg-[#3a151d] disabled:opacity-60 disabled:cursor-not-allowed">
                        {pafSubmitting ? 'Creating…' : 'Create Transfer Form'}
                    </button>
                </form>
            </Modal>

            {/* Modal 1b: Upload signed form + Accept/Reject */}
            <Modal isOpen={!!decidePaf} onClose={() => { setDecidePaf(null); setDecideFile(null); }} title="Personnel Action — Decision" maxWidth="max-w-md">
                <div className="space-y-4 text-xs font-semibold text-slate-700">
                    <p className="text-slate-500">Employee: <span className="font-black text-[#511d29]">{decidePaf?.employee?.fullName}</span></p>
                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Signed Form <span className="text-red-500">*</span></label>
                        <input type="file" accept=".pdf,.doc,.docx,image/*"
                            onChange={e => setDecideFile(e.target.files?.[0] || null)}
                            className="w-full p-2 border border-[#511d29]/20 bg-white text-slate-600" />
                        {decideFile && <p className="text-[10px] text-emerald-600 mt-1 font-bold">{decideFile.name}</p>}
                    </div>
                    <div className="bg-amber-50/60 border border-amber-200 p-2.5 rounded text-[10px] text-amber-900/90 leading-relaxed">
                        Accepting will move the employee into the target Job Description (division/department/unit/position/category) and file the signed form to their Lifecycle documents. Blocked if the JD is above its staffing plan.
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleDecide('REJECT')} disabled={!!decideBusy}
                            className="flex-1 py-3 bg-white border border-red-300 text-red-600 font-black uppercase tracking-widest hover:bg-red-50 disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                            <X className="w-4 h-4" /> {decideBusy === 'REJECT' ? 'Rejecting…' : 'Reject'}
                        </button>
                        <button onClick={() => handleDecide('ACCEPT')} disabled={!!decideBusy}
                            className="flex-1 py-3 bg-emerald-600 text-white font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                            <Check className="w-4 h-4" /> {decideBusy === 'ACCEPT' ? 'Applying…' : 'Accept & Apply'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal 2: Contract Renewal */}
            <Modal isOpen={isRenewalModalOpen} onClose={() => setIsRenewalModalOpen(false)} title="Initiate Contract Renewal" maxWidth="max-w-md">
                <form onSubmit={handleRenewalSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
                    <p className="text-slate-500 mb-2">Renew contract for: <span className="font-black text-[#511d29]">{selectedEmployee?.fullName}</span></p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">New Start Date</label>
                            <input type="date" value={renewForm.startDate}
                                onChange={e => setRenewForm({ ...renewForm, startDate: e.target.value })}
                                className="w-full p-2 border border-[#511d29]/20 bg-white" />
                        </div>
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">New End Date</label>
                            <input type="date" value={renewForm.endDate}
                                onChange={e => setRenewForm({ ...renewForm, endDate: e.target.value })}
                                className="w-full p-2 border border-[#511d29]/20 bg-white" />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 -mt-2">Pre-filled to 6 months from the day after the current contract ends — adjust if needed.</p>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Contract No. (Optional)</label>
                        <input type="text" value={renewForm.contractNumber}
                            onChange={e => setRenewForm({ ...renewForm, contractNumber: e.target.value })}
                            className="w-full p-2 border border-[#511d29]/20 bg-white" />
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Signed Contract <span className="text-red-500">*</span></label>
                        <input type="file" accept=".pdf,.doc,.docx,image/*"
                            onChange={e => setRenewFile(e.target.files?.[0] || null)}
                            className="w-full p-2 border border-[#511d29]/20 bg-white text-slate-600" />
                        {renewFile && <p className="text-[10px] text-emerald-600 mt-1 font-bold">{renewFile.name}</p>}
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Notes (Optional)</label>
                        <textarea value={renewForm.notes} rows={2}
                            onChange={e => setRenewForm({ ...renewForm, notes: e.target.value })}
                            className="w-full p-2 border border-[#511d29]/20 bg-white" />
                    </div>

                    <div className="bg-amber-50/60 border border-amber-200 p-2.5 rounded text-[10px] text-amber-900/90 leading-relaxed">
                        Confirming will archive the current contract, start the new one, carry over remaining paid leave (capped at 14 days), reset emergency &amp; unpaid leave, and file the signed contract to the employee's Lifecycle documents.
                    </div>

                    <button type="submit" disabled={renewSubmitting}
                        className="w-full py-3 bg-amber-600 text-white font-black uppercase tracking-widest hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed">
                        {renewSubmitting ? 'Processing…' : 'Confirm Renewal'}
                    </button>
                </form>
            </Modal>

            {/* Modal 3: Log Nomination */}
            <Modal isOpen={isNominateModalOpen} onClose={() => setIsNominateModalOpen(false)} title="Reward Nomination" maxWidth="max-w-md">
                <form onSubmit={handleNominateSubmit} className="space-y-4 text-xs font-semibold text-slate-700">
                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Select Nominee</label>
                        <select className="w-full p-2 border border-[#511d29]/20 bg-white">
                            {employees.map((e: any) => (
                                <option key={e.id} value={e.id}>{e.fullName}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Reward Category</label>
                        <select className="w-full p-2 border border-[#511d29]/20 bg-white">
                            <option>Employee of the Month</option>
                            <option>Employee of the Year</option>
                            <option>Excellence and Timeliness Award</option>
                            <option>Loyalty Award</option>
                            <option>Exceptional Performance Award</option>
                            <option>Bi-Annual Bonus nomination</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Evaluation Details / Achievement</label>
                        <textarea rows={3} required placeholder="Justify nomination based on evaluation score" className="w-full p-2 border border-[#511d29]/20 bg-white" />
                    </div>

                    <button type="submit" className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest hover:bg-[#3a151d]">
                        Log Nomination
                    </button>
                </form>
            </Modal>

            {/* Modal 4: Disciplinary Log */}
            <Modal isOpen={isDisciplinaryModalOpen} onClose={() => setIsDisciplinaryModalOpen(false)} title="Log Incident / Policy Breach" maxWidth="max-w-md">
                <form onSubmit={handleDisciplinarySubmit} className="space-y-4 text-xs font-semibold text-slate-700">
                    <div>
                        <label className="block text-red-700 font-black uppercase text-[10px] mb-1">Select Employee</label>
                        <select className="w-full p-2 border border-red-700/20 bg-white">
                            {employees.map((e: any) => (
                                <option key={e.id} value={e.id}>{e.fullName}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-red-700 font-black uppercase text-[10px] mb-1">Incident Type</label>
                        <select className="w-full p-2 border border-red-700/20 bg-white">
                            <option>Incident Report</option>
                            <option>Notice to Explain request</option>
                            <option>Investigation Report draft</option>
                            <option>Notice of Disciplinary Action</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-red-700 font-black uppercase text-[10px] mb-1">Incident Details</label>
                        <textarea rows={3} required placeholder="Describe breach details..." className="w-full p-2 border border-red-700/20 bg-white" />
                    </div>

                    <button type="submit" className="w-full py-3 bg-red-700 text-white font-black uppercase tracking-widest hover:bg-red-800">
                        Create Disciplinary Log
                    </button>
                </form>
            </Modal>

            {/* Modal 5: Offboarding Log */}
            <Modal isOpen={isOffboardingModalOpen} onClose={() => setIsOffboardingModalOpen(false)} title="Initiate Offboarding Process" maxWidth="max-w-md">
                <form onSubmit={(e) => { e.preventDefault(); toast.success('Offboarding case registered. IT, HR, and Finance clearance processes initialized.'); setIsOffboardingModalOpen(false); }} className="space-y-4 text-xs font-semibold text-slate-700">
                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Select Employee</label>
                        <select className="w-full p-2 border border-[#511d29]/20 bg-white">
                            {employees.map((e: any) => (
                                <option key={e.id} value={e.id}>{e.fullName}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Offboarding Type</label>
                        <select className="w-full p-2 border border-[#511d29]/20 bg-white">
                            <option value="VOLUNTARY">Voluntary (Resignation Letter, Exit Interview)</option>
                            <option value="INVOLUNTARY">Involuntary (Termination, Direct Exit)</option>
                        </select>
                    </div>

                    <div className="bg-red-50 p-3 border border-red-200 text-[10px] text-red-700 font-bold uppercase">
                        ⚠️ Note: Last payment withholding will be automatically flagged in Payroll until all clearance items are complete.
                    </div>

                    <button type="submit" className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest hover:bg-[#3a151d]">
                        Initialize Offboarding
                    </button>
                </form>
            </Modal>

            {/* Employee Lifecycle — Full read-only detail view */}
            <Modal
                isOpen={!!detailEmp}
                onClose={() => setDetailEmp(null)}
                title={detailEmp ? `${detailEmp.fullName}${detailEmp.staffId ? ' · ' + detailEmp.staffId : ''}` : ''}
                fullScreen
                fullScreenWidth="max-w-7xl"
            >
                {detailEmp && (() => {
                    const emp = detailEmp;
                    const fmt = (d?: string) => d ? format(parseISO(d), 'dd MMM yyyy') : '—';
                    const num = (x: any) => Number(x) || 0;
                    // accruedHolidays/remainingHolidays come straight from the API (calculateHolidayMetrics
                    // server-side) — recomputing them here from contractStartDate alone used to ignore
                    // bonusHolidays entirely, which now also holds any renewal carry-over.
                    const paidAccrued = num((emp as any).accruedHolidays);
                    const paidRemaining = num((emp as any).remainingHolidays);
                    const paidTaken = num(emp.holidaysUsed);
                    const unpaidTaken = num(emp.unpaidHolidaysUsed);
                    const emergTaken = num(emp.emergencyHolidaysUsed);
                    // Only show the identity/contact/bank/document fields this employee's contract
                    // type actually collects — same Resident / Direct Non-Resident / Service Provider
                    // split used on the onboarding review screen.
                    const showField = makeFieldVisibility(emp.contractType);

                    // Cards sit in a CSS-columns (masonry) flow rather than a row-based grid, so a
                    // short card (e.g. Service Provider's sparse Identity section) never leaves a
                    // tall dead gap next to/under a taller neighbour — each card just packs into
                    // whichever column has room, sized to its own content.
                    const Section = ({ icon: Icon, title, color, wide, children }: any) => (
                        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm mb-6 break-inside-avoid">
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

                    const Field = ({ label, k, type, dir }: { label: string; k: string; type?: string; dir?: 'rtl' | 'ltr' }) => {
                        let v: any = emp[k as keyof Employee];
                        if (type === 'date') v = v ? fmt(v as string) : '';
                        if (k === 'baseSalary') v = (v || v === 0) ? Number(v).toLocaleString() : '';
                        return <Row label={label} value={v} dir={dir} />;
                    };

                    const docs = [
                        { label: 'CV / Resume', k: 'cvUrl' },
                        { label: 'University Degree', k: 'degreeUrl' },
                        { label: 'Birth Certificate', k: 'birthCertUrl' },
                        { label: 'Passport Copy', k: 'passportCopyUrl' },
                        { label: 'Cancelled Bank Check', k: 'bankCheckUrl' },
                        { label: 'Photo', k: 'photoUrl' },
                        { label: 'ID & Driving Card', k: 'idCardUrl' },
                        { label: 'Signed Job Offer', k: 'jobOfferUrl' },
                        { label: 'Health Certificate', k: 'healthCertUrl' },
                        { label: 'Airplane Ticket', k: 'ticketUrl' },
                        { label: 'Residency Document', k: 'residencyDocumentUrl' },
                        { label: 'Interview Evaluation', k: 'interviewEvaluationUrl' },
                    ].filter(d => showField(d.k));

                    return (
                        <div className="space-y-6">
                            {/* Header banner */}
                            <div className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 text-white shadow-xl bg-gradient-to-br from-[#511d29] via-[#3a151d] to-[#2a0f16]">
                                <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                                <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-black/20 blur-3xl pointer-events-none" />
                                <User className="absolute -bottom-8 right-4 w-48 h-48 text-white/[0.06] pointer-events-none select-none" />

                                <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                                    <div className="w-20 h-20 rounded-[22px] bg-white/15 ring-4 ring-white/10 flex items-center justify-center font-black text-3xl shrink-0 shadow-inner backdrop-blur-sm">
                                        {emp.fullName?.trim()?.charAt(0)?.toUpperCase() || <User className="w-8 h-8" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-2xl font-black tracking-tight truncate">{emp.fullName}</div>
                                        {emp.fullNameArabic
                                            ? <div className="text-sm font-bold text-white/70 truncate mt-0.5" dir="rtl">{emp.fullNameArabic}</div>
                                            : <div className="text-xs font-bold text-white/50 truncate mt-0.5">{emp.email || 'No email on file'}</div>}
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            {emp.staffId && <span className="px-3 py-1 rounded-full bg-white/15 border border-white/10 backdrop-blur-sm text-[11px] font-mono font-black tracking-tight">{emp.staffId}</span>}
                                            {emp.role && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/10 backdrop-blur-sm text-[11px] font-bold">
                                                    <Briefcase className="w-3 h-3 opacity-70" />{String(emp.role).replace(/_/g, ' ')}
                                                </span>
                                            )}
                                            {emp.position && <span className="px-3 py-1 rounded-full bg-white/15 border border-white/10 backdrop-blur-sm text-[11px] font-bold">{emp.position}</span>}
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm text-[11px] font-bold text-white/90">
                                                <Landmark className="w-3 h-3 opacity-70" />{orgUnitName(emp)}
                                            </span>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${emp.contractStatus === 'Active' || !emp.contractStatus ? 'bg-emerald-400/20 border-emerald-300/30 text-emerald-50' : 'bg-white/10 border-white/15 text-white/80'}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />{emp.contractStatus || 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section cards — masonry flow (see Section component note above) */}
                            <div className="columns-1 xl:columns-2 gap-6">
                                <Section icon={User} title="Identity Details" color="bg-indigo-50 text-indigo-600">
                                    {showField('gender') && <Field label="Gender" k="gender" />}
                                    <Field label="Date of Birth" k="dateOfBirth" type="date" />
                                    <Field label="Place of Birth" k="placeOfBirth" />
                                    {showField('placeOfBirthArabic') && <Field label="Place of Birth (Arabic)" k="placeOfBirthArabic" dir="rtl" />}
                                    <Field label="Nationality" k="nationality" />
                                    {showField('nationalityArabic') && <Field label="Nationality (Arabic)" k="nationalityArabic" dir="rtl" />}
                                    {showField('nationalId') && <Field label="National ID" k="nationalId" />}
                                    <Field label="Blood Type" k="bloodType" />
                                    <Field label="Academic Qualification" k="academicQualification" />
                                    {showField('academicQualificationArabic') && <Field label="Academic Qualification (Arabic)" k="academicQualificationArabic" dir="rtl" />}
                                </Section>

                                <Section icon={CreditCard} title="ID, Passport & License" color="bg-teal-50 text-teal-600">
                                    {showField('idCardNumber') && <Field label="ID Card Number" k="idCardNumber" />}
                                    {showField('idPlaceOfIssue') && <Field label="ID Place of Issue" k="idPlaceOfIssue" />}
                                    {showField('idPlaceOfIssueArabic') && <Field label="ID Place of Issue (Arabic)" k="idPlaceOfIssueArabic" dir="rtl" />}
                                    {showField('idIssueDate') && <Field label="ID Issue Date" k="idIssueDate" type="date" />}
                                    <Field label="Passport Number" k="passportNumber" />
                                    {showField('passportPlaceOfIssue') && <Field label="Passport Place of Issue" k="passportPlaceOfIssue" />}
                                    {showField('passportPlaceOfIssueArabic') && <Field label="Passport Place of Issue (Arabic)" k="passportPlaceOfIssueArabic" dir="rtl" />}
                                    <Field label="Passport Expiry" k="passportExpiryDate" type="date" />
                                    {showField('drivingLicenseType') && <Field label="License Type" k="drivingLicenseType" />}
                                    {showField('drivingLicenseTypeArabic') && <Field label="License Type (Arabic)" k="drivingLicenseTypeArabic" dir="rtl" />}
                                    {showField('drivingLicenseNumber') && <Field label="License Number" k="drivingLicenseNumber" />}
                                    {showField('drivingLicenseExpiry') && <Field label="License Expiry" k="drivingLicenseExpiry" type="date" />}
                                    {showField('drivingLicensePlaceOfIssue') && <Field label="License Place of Issue" k="drivingLicensePlaceOfIssue" />}
                                    {showField('drivingLicensePlaceOfIssueArabic') && <Field label="License Place of Issue (Arabic)" k="drivingLicensePlaceOfIssueArabic" dir="rtl" />}
                                </Section>

                                <Section icon={Phone} title="Contact & Address" color="bg-emerald-50 text-emerald-600">
                                    <Field label="Personal Phone" k="personalPhone" />
                                    <Field label="Personal E-mail" k="personalEmail" />
                                    <Field label="Login Email" k="email" />
                                    <Field label="Emergency Contact" k="emergencyContactNumber" />
                                    <Field label="Residential Address" k="residentialAddress" />
                                    {showField('residentialAddressArabic') && <Field label="Residential Address (Arabic)" k="residentialAddressArabic" dir="rtl" />}
                                </Section>

                                <Section icon={Briefcase} title="Employment Details" color="bg-blue-50 text-blue-600">
                                    <Row label="Role" value={emp.role} />
                                    <Field label="Position" k="position" />
                                    <Field label="Job Category" k="jobCategory" />
                                    <Field label="Job Grade" k="jobGrade" />
                                    <Field label="Contract Type" k="contractType" />
                                    <Field label="Contract #" k="contractNumber" />
                                    <Field label="Status" k="contractStatus" />
                                    <Field label="Base Salary" k="baseSalary" />
                                    <Field label="Arrival Date" k="arrivalDate" type="date" />
                                    <Field label="Join Date" k="joinDate" type="date" />
                                    <Field label="Contract Start" k="contractStartDate" type="date" />
                                    <Field label="Contract End" k="contractEndDate" type="date" />
                                    <Field label="Worked Before?" k="workedBefore" />
                                    {showField('hasRelativesInCompany') && <Field label="Relatives in Company?" k="hasRelativesInCompany" />}
                                    {showField('hasRelativesInCompany') && emp.hasRelativesInCompany === 'Yes' && <Field label="Relatives' Names" k="relativesNames" />}
                                    {showField('hasRelativesInCompany') && emp.hasRelativesInCompany === 'Yes' && showField('relativesNamesArabic') && <Field label="Relatives' Names (Arabic)" k="relativesNamesArabic" dir="rtl" />}
                                </Section>

                                {(showField('serviceProviderCompany') || showField('employeeTravelDate')) && (emp.serviceProviderCompany || emp.employeeTravelDate) && (
                                    <Section icon={Building2} title="Onboarding Submission Details" color="bg-cyan-50 text-cyan-600">
                                        <Field label="Service Provider Company" k="serviceProviderCompany" />
                                        <Field label="Travel Date" k="employeeTravelDate" type="date" />
                                    </Section>
                                )}

                                <Section icon={CalendarDays} title="Leave Balances" color="bg-amber-50 text-amber-600">
                                    <Row label="Paid Accrued" value={paidAccrued} />
                                    <Row label="Paid Taken" value={paidTaken} />
                                    <Row label="Paid Balance" value={paidRemaining} />
                                    <Row label="Unpaid Taken" value={unpaidTaken} />
                                    <Row label="Unpaid Balance (14)" value={14 - unpaidTaken} />
                                    <Row label="Emergency Taken" value={emergTaken} />
                                    <Row label="Emergency Balance (3)" value={3 - emergTaken} />
                                </Section>

                                {showField('bankName') && (
                                    <Section icon={Landmark} title="Bank Details" color="bg-slate-100 text-slate-600">
                                        <Field label="Bank Name" k="bankName" />
                                        <Field label="Bank Name (Arabic)" k="bankNameArabic" dir="rtl" />
                                        <Field label="Bank Branch" k="bankBranchName" />
                                        <Field label="Bank Branch (Arabic)" k="bankBranchNameArabic" dir="rtl" />
                                        <Field label="Account Number" k="bankAccountNumber" />
                                    </Section>
                                )}

                            </div>

                            {/* Documents live outside the masonry flow — always full width */}
                            <Section icon={Paperclip} title="Documents & Attachments" color="bg-indigo-50 text-indigo-600" wide>
                                {docs.map(d => {
                                    const raw = emp[d.k as keyof Employee] as string | undefined;
                                    const href = raw ? (raw.startsWith('http') ? raw : `${SERVER_URL}${raw}`) : '';
                                    const busy = uploadingDocKey === d.k;
                                    return (
                                        <div key={d.k} className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
                                            <span className="text-xs font-bold text-slate-600 truncate">{d.label}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {raw && (
                                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#511d29] hover:text-[#3a151d] inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
                                                        View <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                                {!raw && !isHRRole && <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">—</span>}
                                                {isHRRole && (
                                                    <label className={`cursor-pointer text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${busy ? 'text-slate-300 border-slate-100' : 'text-[#511d29] border-[#511d29]/20 hover:bg-[#511d29]/5'}`}>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            disabled={busy}
                                                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                            onChange={e => handleFixedDocUpload(emp.id, d.k, e.target.files?.[0])}
                                                        />
                                                        {busy ? 'Uploading…' : (raw ? 'Replace' : 'Upload')}
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </Section>

                            {/* Free-form documents beyond the fixed slots above — HR can add/remove; everyone else views. */}
                            {(isHRRole || employeeDocuments.length > 0) && (
                                <Section icon={FileText} title="Additional Documents" color="bg-cyan-50 text-cyan-600" wide>
                                    <div className="sm:col-span-2 lg:col-span-3 space-y-3">
                                        {employeeDocuments.length === 0 && (
                                            <p className="text-xs text-slate-400 font-medium">No additional documents on file.</p>
                                        )}
                                        {employeeDocuments.map((doc: EmployeeDocument) => {
                                            const href = doc.fileUrl.startsWith('http') ? doc.fileUrl : `${SERVER_URL}${doc.fileUrl}`;
                                            return (
                                                <div key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-700 truncate">{doc.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium truncate">
                                                            {[doc.fileName, doc.uploadedByName ? `by ${doc.uploadedByName}` : '', format(parseISO(doc.createdAt), 'dd MMM yyyy')].filter(Boolean).join(' · ')}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#511d29] hover:text-[#3a151d] inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
                                                            View <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                        {isHRRole && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteDocument(emp.id, doc.id)}
                                                                className="text-slate-400 hover:text-rose-600 transition-colors"
                                                                title="Remove document"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {isHRRole && (
                                            <div className="pt-3 mt-1 border-t border-dashed border-slate-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setAddDocModalOpen(true)}
                                                    className="px-4 py-2.5 bg-[#511d29] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-all inline-flex items-center gap-2"
                                                >
                                                    <FileText className="w-3.5 h-3.5" /> Add Document
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </Section>
                            )}
                        </div>
                    );
                })()}
            </Modal>

            {/* Add Document popup — kept separate from the detail view above so typing the name
                doesn't trigger a remount of the field (see addDocModalOpen declaration). */}
            <Modal
                isOpen={addDocModalOpen}
                onClose={() => { setAddDocModalOpen(false); setNewDocName(''); setNewDocFile(null); }}
                title="Add Document"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-medium">
                        Attach a new document for <span className="font-black text-[#511d29]">{detailEmp?.fullName}</span>.
                    </p>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Document Name</label>
                        <input
                            type="text"
                            value={newDocName}
                            onChange={e => setNewDocName(e.target.value)}
                            placeholder="e.g. Training Certificate"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#511d29]/10 focus:border-[#511d29] transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">File</label>
                        <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            onChange={e => setNewDocFile(e.target.files?.[0] || null)}
                            className="w-full text-xs font-medium text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#511d29]/5 file:text-[#511d29] file:text-[10px] file:font-black file:uppercase"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => detailEmp && handleAddDocument(detailEmp.id)}
                        disabled={addingDoc}
                        className="w-full py-3 bg-[#511d29] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#3a151d] transition-all disabled:opacity-50"
                    >
                        {addingDoc ? 'Adding…' : 'Add Document'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

const RewardCard = ({ title, desc }: { title: string, desc: string }) => (
    <div className="bg-white border border-[#511d29]/15 p-5 rounded-xl shadow-sm space-y-3 relative overflow-hidden group hover:border-[#511d29]/30 transition-all hover:shadow-md">
        <div className="w-10 h-10 bg-[#f5ebd9] text-[#511d29] flex items-center justify-center rounded-lg">
            <Award className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-black text-[#511d29] uppercase tracking-wide">{title}</h4>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
);

const DisciplinaryStepCard = ({ step, title, desc }: { step: string, title: string, desc: string }) => (
    <div className="bg-white border border-red-700/10 p-5 rounded-xl shadow-sm space-y-2 relative">
        <div className="absolute top-3 right-4 text-3xl font-black text-red-700/10">{step}</div>
        <h4 className="text-xs font-black text-red-700 uppercase tracking-wider">{title}</h4>
        <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
    </div>
);

export default PersonnelRelations;
