import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { employeeService } from '../../services/employeeService';
import api, { SERVER_URL } from '../../services/apiClient';
import { departmentService, groupService, divisionService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { directorateService } from '../../services/directorateService';
import { jobDescriptionService } from '../../services/jobDescriptionService';
import { candidateService } from '../../services/candidateService';
import { toast } from 'sonner';
import { JOB_CATEGORIES, JOB_GRADES } from '../../types';
import type { Employee } from '../../types';
import {
    Search,
    Key,
    Lock,
    Sparkles,
    ArrowLeft,
    Save,
    X,
    User,
    Building2,
    Briefcase,
    CreditCard,
    CalendarDays,
    FileText,
    ChevronDown,
    Phone,
    MapPin,
    Landmark,
    Paperclip,
    IdCard,
    Car,
    Upload
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
    POSITION_FACTORS,
    SKILL_FACTORS,
    SITE_FACTORS,
    LANGUAGE_FACTORS
} from '../../constants/factors';

const getCurrencySymbol = (type?: string | null) => {
    if (!type) return '$';
    if (type.includes('LYD')) return 'LYD ';
    if (type.includes('EUR')) return '€';
    return '$';
};

const EmployeeForm: React.FC = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isEditMode = Boolean(id);

    const [formData, setFormData] = useState<Partial<Employee & { password?: string }>>({
        fullName: '',
        email: '',
        password: '',
        directorateId: '',
        divisionId: '',
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
        contractNumber: '1st',
        nationality: '',
        jobCategory: '',
        jobGrade: '',
        salaryStructureType: '',
        positionFactor: 1.0,
        skillFactor: 1.0,
        siteFactor: 1.0,
        languageFactor: 1.0,
        evaluationPoints: 0,
        permissions: [],
        jobDescriptionId: '',
        // Extended Identity Details
        dateOfBirth: '',
        placeOfBirth: '',
        nationalId: '',
        academicQualification: '',
        gender: '',
        bloodType: '',
        idCardNumber: '',
        idPlaceOfIssue: '',
        idIssueDate: '',
        passportPlaceOfIssue: '',
        passportExpiryDate: '',
        drivingLicenseType: '',
        drivingLicenseNumber: '',
        drivingLicenseExpiry: '',
        drivingLicensePlaceOfIssue: '',
        personalPhone: '',
        personalEmail: '',
        emergencyContactNumber: '',
        residentialAddress: '',
        workedBefore: '',
        hasRelativesInCompany: '',
        relativesNames: '',
        bankName: '',
        bankBranchName: '',
        bankAccountNumber: '',
        arrivalDate: '',
        cvUrl: '',
        degreeUrl: '',
        birthCertUrl: '',
        passportCopyUrl: '',
        bankCheckUrl: '',
        photoUrl: '',
        idCardUrl: '',
        jobOfferUrl: '',
        healthCertUrl: ''
    });

    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [fetchedHourlyRate, setFetchedHourlyRate] = useState<number | null>(null);
    const [deptSearchTerm, setDeptSearchTerm] = useState('');
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
    const deptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (deptRef.current && !deptRef.current.contains(event.target as Node)) {
                setIsDeptDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [deptRef]);

    const { data: orgData, isLoading: orgLoading } = useQuery({
        queryKey: ['org-data-form', 'v3'],
        queryFn: async () => {
            const [depts, grps, uns, divs, dirs, jds] = await Promise.all([
                departmentService.getAllDepartments().catch(() => []),
                groupService.getAllGroups().catch(() => []),
                unitService.getAllUnits().catch(() => []),
                divisionService.getAllDivisions().catch(() => []),
                directorateService.getAllDirectorates().catch(() => []),
                jobDescriptionService.getAllJobDescriptions().catch(() => [])
            ]);
            return { departments: depts, groups: grps, units: uns, divisions: divs, directorates: dirs, jobDescriptions: jds };
        }
    });

    const departments = orgData?.departments || [];
    const groups = orgData?.groups || [];
    const units = orgData?.units || [];
    const divisions = orgData?.divisions || [];
    const directorates = orgData?.directorates || [];
    const jobDescriptions = orgData?.jobDescriptions || [];

    const isGlobalScopeRole = ['GENERAL_MANAGER', 'CHAIRMAN'].includes(formData.role || '');

    // Every enrolled person now gets a login account created right here from their email — no matter
    // the role (standard Employee, any Head, GM, HR, Personnel, etc.).

    const availableJobDescriptions = jobDescriptions.filter(jd => {
        // Scope match: only JDs belonging to the employee's selected org unit
        let scopeMatch = false;
        if (formData.role === 'HEAD_DIRECTOR') scopeMatch = jd.directorateId === formData.directorateId;
        else if (formData.role === 'HEAD_DIVISION') scopeMatch = jd.divisionId === formData.divisionId;
        else if (formData.unitId) scopeMatch = jd.unitId === formData.unitId;
        else if (formData.departmentId) scopeMatch = jd.departmentId === formData.departmentId;
        if (!scopeMatch) return false;

        // Hide JDs already filled to their planned headcount (staffing plan is full),
        // but always keep the one currently assigned to this employee (edit mode).
        const filled = jd._count?.employees || 0;
        const isFull = filled >= jd.plannedCount;
        return !isFull || jd.id === formData.jobDescriptionId;
    });

    // ---- Onboarding locks: when enrolling a hired candidate (arriving with a candidateId),
    // job category, position title and place of work are driven by the Job Description and locked.
    const fromOnboarding = Boolean(searchParams.get('candidateId'));
    const selectedJd = jobDescriptions.find(jd => jd.id === formData.jobDescriptionId);
    const jdCategories = selectedJd?.jobCategories || [];
    const jdLocations = selectedJd?.workLocations || [];
    // Category is locked to the JD unless the JD offers two categories (then HR picks one).
    const categoryLocked = fromOnboarding && jdCategories.length === 1;
    const categoryChoice = fromOnboarding && jdCategories.length >= 2;
    // Position title is always locked to the JD title during onboarding.
    const positionLocked = fromOnboarding && !!selectedJd;
    // Place of work is locked to the JD unless it lists both Office and Site (then HR picks one).
    const placeLocked = fromOnboarding && jdLocations.length === 1;
    const placeChoice = fromOnboarding && jdLocations.length >= 2;
    const placeOptions = fromOnboarding && jdLocations.length ? jdLocations : ['OFFICE', 'SITE'];

    useEffect(() => {
        if (isEditMode && id) {
            employeeService.getEmployeeById(id).then(emp => {
                const formatDate = (date: any) => {
                    if (!date) return '';
                    try { return new Date(date).toISOString().split('T')[0]; } catch { return ''; }
                };
                setFormData({
                    ...emp,
                    joinDate: formatDate(emp.joinDate),
                    contractStartDate: formatDate(emp.contractStartDate),
                    contractEndDate: formatDate(emp.contractEndDate),
                    fullNameArabic: emp.fullNameArabic || '',
                    passportNumber: emp.passportNumber || '',
                    contractNumber: emp.contractNumber || '1st',
                    nationality: emp.nationality || '',
                    jobCategory: emp.jobCategory || '',
                    jobGrade: emp.jobGrade || '',
                    emergencyHolidaysUsed: emp.emergencyHolidaysUsed || 0,
                    positionFactor: emp.positionFactor || 1.0,
                    skillFactor: emp.skillFactor || 1.0,
                    siteFactor: emp.siteFactor || 1.0,
                    languageFactor: emp.languageFactor || 1.0,
                    evaluationPoints: emp.evaluationPoints || 0,
                    permissions: (emp as any).permissions || [],
                    jobDescriptionId: emp.jobDescriptionId || '',
                    // Extended Identity Details
                    dateOfBirth: formatDate(emp.dateOfBirth),
                    placeOfBirth: emp.placeOfBirth || '',
                    nationalId: emp.nationalId || '',
                    academicQualification: emp.academicQualification || '',
                    gender: emp.gender || '',
                    bloodType: emp.bloodType || '',
                    idCardNumber: emp.idCardNumber || '',
                    idPlaceOfIssue: emp.idPlaceOfIssue || '',
                    idIssueDate: formatDate(emp.idIssueDate),
                    passportPlaceOfIssue: emp.passportPlaceOfIssue || '',
                    passportExpiryDate: formatDate(emp.passportExpiryDate),
                    drivingLicenseType: emp.drivingLicenseType || '',
                    drivingLicenseNumber: emp.drivingLicenseNumber || '',
                    drivingLicenseExpiry: formatDate(emp.drivingLicenseExpiry),
                    drivingLicensePlaceOfIssue: emp.drivingLicensePlaceOfIssue || '',
                    personalPhone: emp.personalPhone || '',
                    personalEmail: emp.personalEmail || '',
                    emergencyContactNumber: emp.emergencyContactNumber || '',
                    residentialAddress: emp.residentialAddress || '',
                    workedBefore: emp.workedBefore || '',
                    hasRelativesInCompany: emp.hasRelativesInCompany || '',
                    relativesNames: emp.relativesNames || '',
                    bankName: emp.bankName || '',
                    bankBranchName: emp.bankBranchName || '',
                    bankAccountNumber: emp.bankAccountNumber || '',
                    arrivalDate: formatDate(emp.arrivalDate),
                    cvUrl: emp.cvUrl || '',
                    degreeUrl: emp.degreeUrl || '',
                    birthCertUrl: emp.birthCertUrl || '',
                    passportCopyUrl: emp.passportCopyUrl || '',
                    bankCheckUrl: emp.bankCheckUrl || '',
                    photoUrl: emp.photoUrl || '',
                    idCardUrl: emp.idCardUrl || '',
                    jobOfferUrl: emp.jobOfferUrl || '',
                    healthCertUrl: emp.healthCertUrl || ''
                });
            }).catch(err => {
                console.error("Error loading employee", err);
                toast.error(t('error_loading_employee', { defaultValue: 'Failed to load employee details.' }));
                navigate('/employees');
            });
        }
    }, [id, isEditMode, navigate, t]);

    // When enrolling a hired candidate, remember which candidate to close out after saving.
    const candidateId = searchParams.get('candidateId');

    // Prefill scope + position (and, from onboarding, the candidate's details) when arriving from a requisition.
    // NOTE: email is intentionally NOT prefilled — onboarding creates a fresh login account rather than
    // reusing the address captured on the hiring list.
    useEffect(() => {
        if (isEditMode) return;
        const dep = searchParams.get('departmentId');
        const jd = searchParams.get('jobDescriptionId');
        const unit = searchParams.get('unitId');
        const fullName = searchParams.get('fullName');
        const position = searchParams.get('position');
        const jobGrade = searchParams.get('jobGrade');
        const salaryStructure = searchParams.get('salaryStructure');
        const residentStatus = searchParams.get('residentStatus');
        const placeOfWork = searchParams.get('placeOfWork');
        const contractMonths = searchParams.get('contractMonths');
        const onboarding = Boolean(searchParams.get('candidateId'));
        if (dep || jd || unit || fullName || position || jobGrade || salaryStructure || residentStatus || placeOfWork || contractMonths) {
            // Contract runs from today for the agreed length (default 6 months).
            const start = new Date();
            const months = Number(contractMonths) === 3 ? 3 : 6;
            const end = new Date(start);
            end.setMonth(end.getMonth() + months);
            const isoDate = (d: Date) => d.toISOString().split('T')[0];
            setFormData(prev => ({
                ...prev,
                departmentId: dep || prev.departmentId,
                unitId: unit || prev.unitId,
                jobDescriptionId: jd || prev.jobDescriptionId,
                fullName: fullName || prev.fullName,
                position: position || prev.position,
                // Offer details captured on the hiring list — pre-filled (and locked in the UI).
                jobGrade: jobGrade || prev.jobGrade,
                salaryStructureType: salaryStructure || prev.salaryStructureType,
                contractType: residentStatus || prev.contractType,
                placeOfWork: placeOfWork || prev.placeOfWork,
                contractStartDate: onboarding ? isoDate(start) : prev.contractStartDate,
                contractEndDate: onboarding ? isoDate(end) : prev.contractEndDate,
            }));
        }
    }, [isEditMode, searchParams]);

    // Sync category / place of work from the selected Job Description during onboarding (when the JD
    // only offers one option, it is fixed automatically).
    useEffect(() => {
        if (!fromOnboarding || !selectedJd) return;
        setFormData(prev => {
            const patch: Partial<typeof prev> = {};
            const cats = selectedJd.jobCategories || [];
            const locs = selectedJd.workLocations || [];
            if (cats.length === 1 && prev.jobCategory !== cats[0]) patch.jobCategory = cats[0];
            if (locs.length === 1 && !prev.placeOfWork) patch.placeOfWork = locs[0];
            if (!prev.position && selectedJd.title) patch.position = selectedJd.title;
            return Object.keys(patch).length ? { ...prev, ...patch } : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromOnboarding, selectedJd?.id]);

    // Corporate Group is derived from the department (no longer chosen manually). Keep it in sync
    // whenever a department is set but the group is still empty — covers onboarding prefills too.
    useEffect(() => {
        if (isEditMode) return;
        if (formData.departmentId && !formData.groupId && departments.length) {
            const dep = departments.find(d => d.id === formData.departmentId);
            const gid = (dep as any)?.groupId || groups[0]?.id || '';
            if (gid) setFormData(prev => ({ ...prev, groupId: gid }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.departmentId, formData.groupId, departments, groups, isEditMode]);

    // Auto Staff ID from residency (contract type) + year → IPH-<digit><YY>-<SEQ>.
    const [staffIdBusy, setStaffIdBusy] = useState(false);
    const residencyKnown = ['RESDANT', 'DIRCT NONE RESDANT', 'NONE RESDANT'].includes(formData.contractType || '');
    const handleGenerateStaffId = async () => {
        if (!residencyKnown) {
            toast.error(t('residency_required_for_id', { defaultValue: 'Select the contract type (residency) first to generate a Staff ID.' }));
            return;
        }
        setStaffIdBusy(true);
        try {
            const year = formData.joinDate ? new Date(formData.joinDate).getFullYear() : undefined;
            const { staffId } = await employeeService.getNextStaffId(formData.contractType as string, year);
            setFormData(prev => ({ ...prev, staffId }));
            toast.success(t('staff_id_generated', { defaultValue: 'Staff ID generated.' }));
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('err_generate_staff_id', { defaultValue: 'Failed to generate a Staff ID.' }));
        } finally {
            setStaffIdBusy(false);
        }
    };

    const generateEmailFromFullName = (name: string) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length < 2) return parts[0].toLowerCase() + '@iph.com';
        const firstInitial = parts[0].charAt(0).toLowerCase();
        const lastName = parts[parts.length - 1].toLowerCase();
        const cleanFirst = firstInitial.replace(/[^a-z0-9]/g, '');
        const cleanLast = lastName.replace(/[^a-z0-9]/g, '');
        return `${cleanFirst}.${cleanLast}@iph.com`;
    };

    useEffect(() => {
        if (formData.jobCategory && formData.jobGrade && formData.salaryStructureType) {
            api.get(`/salary-structures/lookup?jobCategory=${encodeURIComponent(formData.jobCategory)}&jobGrade=${encodeURIComponent(formData.jobGrade)}&structureLevel=${encodeURIComponent(formData.salaryStructureType)}`)
                .then(res => {
                    const data = res.data;
                    if (data) {
                        const monthly = data.monthlyRate || (data.hourlyRate * 208);
                        setFormData(prev => ({ ...prev, baseSalary: monthly }));
                        setFetchedHourlyRate(data.hourlyRate);
                    }
                })
                .catch(err => console.error("Failed to fetch salary structure:", err));
        }
    }, [formData.jobCategory, formData.jobGrade, formData.salaryStructureType]);

    useEffect(() => {
        let newFactor = 1.0;
        const isHeadRole = ['HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_DIVISION', 'HEAD_DIRECTOR', 'HEAD_UNIT', 'GENERAL_MANAGER', 'CHAIRMAN'].includes(formData.role || '');
        if (isHeadRole) {
            if ((formData.role === 'HEAD_DEPARTMENT' || formData.role === 'HEAD_OFFICE') && formData.departmentId) {
                const dept = departments.find(d => d.id === formData.departmentId);
                if (dept && (dept as any).positionFactor) newFactor = (dept as any).positionFactor;
            } else if (formData.role === 'HEAD_DIVISION' && formData.divisionId) {
                const div = divisions.find(d => d.id === formData.divisionId);
                if (div && (div as any).positionFactor) newFactor = (div as any).positionFactor;
            } else if (formData.role === 'HEAD_UNIT') {
                newFactor = 1.20;
            } else if (formData.role === 'GENERAL_MANAGER' || formData.role === 'CHAIRMAN') {
                newFactor = 1.70;
            }
        }
        if (formData.positionFactor !== newFactor) {
            setFormData(prev => ({ ...prev, positionFactor: newFactor }));
        }
    }, [formData.role, formData.departmentId, formData.divisionId, departments, divisions, formData.positionFactor]);

    useEffect(() => {
        if (formData.contractType && formData.contractType.includes('NONE RESDANT')) {
            if (formData.languageFactor !== 1.0) {
                setFormData(prev => ({ ...prev, languageFactor: 1.0 }));
            }
        }
    }, [formData.contractType, formData.languageFactor]);

    const displayBaseSalary = formData.baseSalary || (fetchedHourlyRate ? fetchedHourlyRate * 208 : 0);
    const posSkill = Math.max(formData.positionFactor || 1.0, formData.skillFactor || 1.0);
    const site = formData.siteFactor || 1.0;
    const lang = formData.languageFactor || 1.0;
    const combinedFactor = 1.0 + (posSkill - 1.0) + (site - 1.0) + (lang - 1.0);
    const factoredSalaryForm = displayBaseSalary * combinedFactor;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const unitsForSelectedDept = units.filter(u => u.departmentId === formData.departmentId);

        if (!formData.fullName) {
            toast.error(t('full_name_required'));
            return;
        }

        const globalRoles = ['GENERAL_MANAGER', 'CHAIRMAN', 'HEAD_DIVISION', 'HEAD_OFFICE', 'SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'];

        if (!globalRoles.includes(formData.role || '') && formData.role !== 'HEAD_DIRECTOR' && !formData.departmentId) {
            toast.error(t('dept_group_required'));
            return;
        }

        if (formData.role === 'EMPLOYEE' && !formData.unitId && unitsForSelectedDept.length > 0) {
            toast.error(t('unit_required', { defaultValue: 'Unit selection is required for standard employees in this department.' }));
            return;
        }

        if (!isEditMode && !isGlobalScopeRole && !formData.jobDescriptionId) {
            toast.error(t('job_description_required', { defaultValue: 'A Job Description must be selected. New employees cannot be added without an assigned Job Description (Staffing Plan slot).' }));
            return;
        }

        if (!formData.salaryStructureType) {
            toast.error(t('salary_structure_required', { defaultValue: 'A salary structure must be selected.' }));
            return;
        }

        try {
            if (isEditMode && id) {
                await employeeService.updateEmployee(id, formData);
                toast.success(t('employee_updated'));
            } else {
                const created = await employeeService.createEmployee(formData as any);
                // If enrolling a hired candidate, close them out and mark the requisition filled.
                if (candidateId && created?.id) {
                    try {
                        await candidateService.markHired(candidateId, created.id);
                    } catch (linkErr) {
                        console.error('Failed to link candidate after enrollment', linkErr);
                        toast.error(t('candidate_link_failed', { defaultValue: 'Employee created, but linking the candidate failed. Update the candidate manually.' }));
                    }
                }
                toast.success(t('employee_created'));
            }
            navigate(candidateId ? '/recruitment/onboarding' : '/employees');
        } catch (error: any) {
            console.error("Error saving employee:", error, error.response?.data);
            const data = error.response?.data;
            // Prefer the server's explicit message so the user sees the exact reason
            // (e.g. "A Job Description must be selected", "A Division is required", or a
            // duplicate-email/capacity message) instead of a generic "status code 400".
            let detail = data?.error || data?.details || data?.message || error.message;

            if (data?.code === 'P2002') {
                detail = `A record with this ${data.meta?.target?.join(', ') || 'value'} already exists.`;
            } else if (data?.code === 'P2003') {
                detail = `Invalid reference — please re-check the selected Department / Group / Unit.`;
            }

            toast.error(`${t('error_saving_employee')}: ${detail}`, { duration: 6000 });
        }
    };

    if (orgLoading && !isEditMode) return <div className="p-8 text-center text-slate-500">Loading form data...</div>;

    // --- Reusable field renderers for the extended Identity Details ---
    const setField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));
    const fieldClass = "w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all font-bold text-slate-800 shadow-sm";

    const renderText = (key: string, label: string, opts: { placeholder?: string; dir?: 'rtl' | 'ltr'; type?: string } = {}) => (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{label}</label>
            <input
                type={opts.type || 'text'}
                dir={opts.dir}
                value={(formData as any)[key] || ''}
                onChange={(e) => setField(key, e.target.value)}
                className={`${fieldClass} ${opts.dir === 'rtl' ? 'text-right' : ''}`}
                placeholder={opts.placeholder || ''}
            />
        </div>
    );

    const renderDate = (key: string, label: string) => (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{label}</label>
            <input
                type="date"
                value={(formData as any)[key] || ''}
                onChange={(e) => setField(key, e.target.value)}
                className={fieldClass}
            />
        </div>
    );

    const renderSelect = (key: string, label: string, options: string[], placeholder = '—') => (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{label}</label>
            <select
                value={(formData as any)[key] || ''}
                onChange={(e) => setField(key, e.target.value)}
                className={`${fieldClass} cursor-pointer`}
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );

    const handleDocUpload = async (key: string, file?: File) => {
        if (!file) return;
        setUploadingDoc(key);
        try {
            const { url } = await employeeService.uploadDocument(file);
            setField(key, url);
            setField(`${key}__name`, file.name);
            toast.success(t('document_uploaded', { defaultValue: 'Document uploaded' }));
        } catch (err) {
            console.error('Document upload failed', err);
            toast.error(t('document_upload_failed', { defaultValue: 'Upload failed. Please try again.' }));
        } finally {
            setUploadingDoc(null);
        }
    };

    const renderFile = (key: string, label: string) => {
        const val = (formData as any)[key] || '';
        const fileName = (formData as any)[`${key}__name`] || (val ? String(val).split('/').pop() : '');
        const busy = uploadingDoc === key;
        const href = val ? (String(val).startsWith('http') ? val : `${SERVER_URL}${val}`) : '';
        return (
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Paperclip size={12} />{label}
                </label>
                {val ? (
                    <div className="flex items-center gap-2 px-4 py-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <FileText size={16} className="text-emerald-600 shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-xs font-bold text-slate-700">{fileName}</span>
                        <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-emerald-700 hover:text-emerald-900 text-[10px] font-black uppercase tracking-widest">
                            {t('view', { defaultValue: 'View' })}
                        </a>
                        <button
                            type="button"
                            onClick={() => { setField(key, ''); setField(`${key}__name`, ''); }}
                            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white transition-all"
                            title={t('remove', { defaultValue: 'Remove' })}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <label className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${busy ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
                        <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            disabled={busy}
                            onChange={(e) => handleDocUpload(key, e.target.files?.[0])}
                        />
                        {busy ? (
                            <span className="text-xs font-black text-indigo-500 uppercase tracking-widest animate-pulse">{t('uploading', { defaultValue: 'Uploading…' })}</span>
                        ) : (
                            <>
                                <Upload size={16} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500">{t('choose_file', { defaultValue: 'Choose file to upload' })}</span>
                            </>
                        )}
                    </label>
                )}
            </div>
        );
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

                <form onSubmit={handleSubmit} className="px-2 lg:px-0 space-y-8">
                    {/* 1. Identity Details */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-indigo-500/10">
                            <User size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                <User size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('identity_details')}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('full_name')}</label>
                                <input
                                    type="text" required
                                    value={formData.fullName}
                                    onChange={(e) => {
                                        const newName = e.target.value;
                                        const suggestedEmail = generateEmailFromFullName(newName);
                                        setFormData(prev => ({
                                            ...prev,
                                            fullName: newName,
                                            email: (!prev.email || prev.email === generateEmailFromFullName(prev.fullName || '')) ? suggestedEmail : prev.email
                                        }));
                                    }}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all font-bold text-slate-800 text-lg shadow-sm"
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
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all font-bold text-slate-800 text-lg text-right shadow-sm"
                                    placeholder={t('name_arabic_placeholder', { defaultValue: 'الاسم الكامل باللغة العربية' })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('staff_id_code')}</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.staffId || ''}
                                        onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                        className="flex-1 min-w-0 px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all font-bold text-slate-800 shadow-sm"
                                        placeholder="IPH-126-001"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleGenerateStaffId}
                                        disabled={staffIdBusy || !residencyKnown}
                                        title={residencyKnown ? t('auto_generate_id', { defaultValue: 'Auto-generate ID' }) : t('residency_required_for_id', { defaultValue: 'Select the contract type (residency) first to generate a Staff ID.' })}
                                        className="shrink-0 px-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                                    >
                                        <Sparkles size={14} />{staffIdBusy ? t('generating', { defaultValue: 'Generating…' }) : t('auto', { defaultValue: 'Auto' })}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">{t('staff_id_hint', { defaultValue: 'IPH-<1 resident / 2 direct non-resident / 3 non-resident><year>-<seq>. Auto-generate or type the sequence yourself.' })}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('passport_number', { defaultValue: 'Passport Number' })}</label>
                                <input
                                    type="text"
                                    value={formData.passportNumber || ''}
                                    onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all font-bold text-slate-800 uppercase shadow-sm"
                                    placeholder={t('passport_placeholder', { defaultValue: 'Passport #' })}
                                />
                            </div>

                            {renderDate('dateOfBirth', t('date_of_birth', { defaultValue: 'Date of Birth' }))}
                            {renderText('placeOfBirth', t('place_of_birth', { defaultValue: 'Place of Birth' }), { placeholder: t('place_of_birth', { defaultValue: 'Place of Birth' }) })}
                            {renderText('nationalId', t('national_id', { defaultValue: 'National ID (الرقم الوطني)' }), { placeholder: t('national_id', { defaultValue: 'National ID' }) })}
                            {renderSelect('gender', t('gender', { defaultValue: 'Gender' }), ['Male', 'Female'], t('select', { defaultValue: 'Select…' }))}
                            {renderSelect('bloodType', t('blood_type', { defaultValue: 'Blood Type' }), ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], t('select', { defaultValue: 'Select…' }))}
                            {renderText('academicQualification', t('academic_qualification', { defaultValue: 'Academic Qualification (المؤهل العلمي)' }), { placeholder: t('academic_qualification', { defaultValue: 'e.g. Bachelor of Engineering' }) })}
                        </div>
                    </section>

                    {/* 1b. ID Card, Passport & Driving License */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-teal-500/10">
                            <IdCard size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-sm">
                                <IdCard size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('official_documents', { defaultValue: 'ID, Passport & License' })}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            {renderText('idCardNumber', t('id_card_number', { defaultValue: 'ID Card Number (رقم البطاقة الشخصية)' }), { placeholder: t('id_card_number', { defaultValue: 'ID Card Number' }) })}
                            {renderText('idPlaceOfIssue', t('id_place_of_issue', { defaultValue: 'ID Place of Issue (مكان الاصدار)' }), { placeholder: t('id_place_of_issue', { defaultValue: 'Place of Issue' }) })}
                            {renderDate('idIssueDate', t('id_issue_date', { defaultValue: 'ID Issue Date' }))}
                            {renderText('passportPlaceOfIssue', t('passport_place_of_issue', { defaultValue: 'Passport Place of Issue' }), { placeholder: t('passport_place_of_issue', { defaultValue: 'Place of Issue' }) })}
                            {renderDate('passportExpiryDate', t('passport_expiry_date', { defaultValue: 'Passport Expiry Date' }))}
                            <div className="md:col-span-2 border-t border-dashed border-slate-200 pt-6 flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                                <Car size={14} /> {t('driving_license', { defaultValue: 'Driving License' })}
                            </div>
                            {renderText('drivingLicenseType', t('driving_license_type', { defaultValue: 'Driving License Type' }), { placeholder: t('driving_license_type', { defaultValue: 'e.g. B / Heavy' }) })}
                            {renderText('drivingLicenseNumber', t('driving_license_number', { defaultValue: 'Driving License Number' }), { placeholder: t('driving_license_number', { defaultValue: 'License Number' }) })}
                            {renderDate('drivingLicenseExpiry', t('driving_license_expiry', { defaultValue: 'License Expiration Date' }))}
                            {renderText('drivingLicensePlaceOfIssue', t('driving_license_place_of_issue', { defaultValue: 'License Place of Issue' }), { placeholder: t('driving_license_place_of_issue', { defaultValue: 'Place of Issue' }) })}
                        </div>
                    </section>

                    {/* 1c. Contact & Address */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-emerald-500/10">
                            <Phone size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                                <Phone size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('contact_and_address', { defaultValue: 'Contact & Address' })}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            {renderText('personalPhone', t('personal_phone', { defaultValue: 'Personal Phone Number' }), { type: 'tel', placeholder: '+218 …' })}
                            {renderText('personalEmail', t('personal_email', { defaultValue: 'Personal E-mail' }), { type: 'email', placeholder: 'name@example.com' })}
                            {renderText('emergencyContactNumber', t('emergency_contact', { defaultValue: 'Emergency Contact Number' }), { type: 'tel', placeholder: '+218 …' })}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><MapPin size={12} />{t('residential_address', { defaultValue: 'Residential Address' })}</label>
                                <input
                                    type="text"
                                    value={formData.residentialAddress || ''}
                                    onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
                                    className={fieldClass}
                                    placeholder={t('residential_address', { defaultValue: 'Residential Address' })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* 1d. Background & Bank Details */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-amber-500/10">
                            <Landmark size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
                                <Landmark size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('background_and_bank', { defaultValue: 'Background & Bank Details' })}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            {renderSelect('workedBefore', t('worked_before', { defaultValue: 'Worked in this company before?' }), ['Yes', 'No'], t('select', { defaultValue: 'Select…' }))}
                            {renderSelect('hasRelativesInCompany', t('has_relatives', { defaultValue: 'Relatives in the company?' }), ['Yes', 'No'], t('select', { defaultValue: 'Select…' }))}
                            {formData.hasRelativesInCompany === 'Yes' && (
                                <div className="md:col-span-2">
                                    {renderText('relativesNames', t('relatives_names', { defaultValue: "Relatives' Names" }), { placeholder: t('relatives_names', { defaultValue: 'Names of relatives' }) })}
                                </div>
                            )}
                            {renderDate('arrivalDate', t('arrival_date', { defaultValue: 'Arrival / Start Date' }))}
                            <div className="md:col-span-2 border-t border-dashed border-slate-200 pt-6 flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                                <Landmark size={14} /> {t('bank_details', { defaultValue: 'Bank Details' })}
                            </div>
                            {renderText('bankName', t('bank_name', { defaultValue: 'Bank Name' }), { placeholder: t('bank_name', { defaultValue: 'Bank Name' }) })}
                            {renderText('bankBranchName', t('bank_branch', { defaultValue: 'Bank Branch Name' }), { placeholder: t('bank_branch', { defaultValue: 'Branch Name' }) })}
                            {renderText('bankAccountNumber', t('bank_account_number', { defaultValue: 'Bank Account Number (IBAN)' }), { placeholder: t('bank_account_number', { defaultValue: 'Account Number' }) })}
                        </div>
                    </section>

                    {/* 1e. Documents & Attachments */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-indigo-500/10">
                            <Paperclip size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                <Paperclip size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('documents_attachments', { defaultValue: 'Documents & Attachments' })}</h2>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mb-6 relative z-10">{t('documents_hint', { defaultValue: 'Upload each document (PDF, image or Word — up to 15 MB).' })}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            {renderFile('cvUrl', t('doc_cv', { defaultValue: 'CV / Resume' }))}
                            {renderFile('degreeUrl', t('doc_degree', { defaultValue: 'University Degree' }))}
                            {renderFile('birthCertUrl', t('doc_birth_cert', { defaultValue: 'Birth Certificate' }))}
                            {renderFile('passportCopyUrl', t('doc_passport_copy', { defaultValue: 'Passport Copy' }))}
                            {renderFile('bankCheckUrl', t('doc_bank_check', { defaultValue: 'Cancelled Bank Check' }))}
                            {renderFile('photoUrl', t('doc_photo', { defaultValue: 'Photo (white background)' }))}
                            {renderFile('idCardUrl', t('doc_id_card', { defaultValue: 'ID & Driving Card' }))}
                            {renderFile('jobOfferUrl', t('doc_job_offer', { defaultValue: 'Signed Job Offer' }))}
                            {renderFile('healthCertUrl', t('doc_health_cert', { defaultValue: 'Health Certificate' }))}
                        </div>
                    </section>

                    {/* 2. Organizational Units */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative z-20">
                        <div className="absolute top-0 right-0 p-8 text-blue-500/10 pointer-events-none overflow-hidden rounded-[32px] w-full h-full">
                            <Building2 size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                                <Building2 size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('organizational_units')}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('role_type')}</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                >
                                    <option value="EMPLOYEE">{t('role_employee')}</option>
                                    <option value="HEAD_UNIT">{t('role_head_unit', { defaultValue: 'Head of Unit' })}</option>
                                    <option value="HEAD_DEPARTMENT">{t('role_head_department')}</option>
                                    <option value="HEAD_OFFICE">Head of Office</option>
                                    <option value="HEAD_DIVISION">Head of Division</option>
                                    <option value="HEAD_DIRECTOR">{t('role_head_director')}</option>
                                    <option value="HR_MANAGER">{t('role_hr_manager')}</option>
                                    <option value="GENERAL_MANAGER">General Manager</option>
                                    <option value="CHAIRMAN">Chairman</option>
                                    <option value="PERSONNEL">{t('role_personnel')}</option>
                                </select>
                            </div>

                            {['CHAIRMAN', 'GENERAL_MANAGER'].includes(formData.role || '') ? (
                                <div className="md:col-span-2 text-sm font-bold text-slate-500 italic p-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl flex items-center justify-center h-full">
                                    This role has global scope and does not require specific unit assignment.
                                </div>
                            ) : (
                                <>
                                    {formData.role === 'HEAD_DIVISION' ? (
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Assigned Division</label>
                                            <select
                                                value={formData.divisionId || ''}
                                                onChange={(e) => setFormData({ ...formData, divisionId: e.target.value })}
                                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                            >
                                                <option value="">Select Division</option>
                                                {divisions.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : formData.role === 'HEAD_OFFICE' ? (
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Assigned Office</label>
                                            <select
                                                value={formData.departmentId || ''}
                                                onChange={(e) => {
                                                    const off = departments.find(d => d.id === e.target.value);
                                                    setFormData({ ...formData, departmentId: e.target.value, groupId: (off as any)?.groupId || groups[0]?.id || '' });
                                                }}
                                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                            >
                                                <option value="">Select Office</option>
                                                {departments.filter(d => d.isOffice).map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : formData.role === 'HEAD_DIRECTOR' ? (
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Directorate Name</label>
                                            <select
                                                value={formData.directorateId || ''}
                                                onChange={(e) => setFormData({ ...formData, directorateId: e.target.value })}
                                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                            >
                                                <option value="">Select Directorate</option>
                                                {directorates.map(dir => (
                                                    <option key={dir.id} value={dir.id}>{dir.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Corporate Group is no longer chosen here — it is derived automatically
                                                from the selected department. */}
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('department')} / Office</label>
                                                    <div className="relative" ref={deptRef}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                                                            className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-bold text-slate-800 shadow-sm flex justify-between items-center text-left"
                                                        >
                                                            <span className="truncate">
                                                                {formData.departmentId
                                                                    ? departments.find(d => d.id === formData.departmentId)?.name
                                                                    : t('select_department')
                                                                }
                                                            </span>
                                                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isDeptDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {isDeptDropdownOpen && (
                                                            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                                                                <div className="p-3 border-b border-slate-100 bg-slate-50">
                                                                    <div className="relative">
                                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Search department..."
                                                                            value={deptSearchTerm}
                                                                            onChange={e => setDeptSearchTerm(e.target.value)}
                                                                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="max-h-60 overflow-y-auto p-1">
                                                                    <div
                                                                        onClick={() => {
                                                                            setFormData({ ...formData, departmentId: '', unitId: '', groupId: '' });
                                                                            setIsDeptDropdownOpen(false);
                                                                            setDeptSearchTerm('');
                                                                        }}
                                                                        className={`px-4 py-3 text-sm rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${!formData.departmentId ? 'bg-blue-50/50 font-bold text-blue-600' : 'text-slate-600'}`}
                                                                    >
                                                                        {t('select_department')}
                                                                    </div>
                                                                    {departments
                                                                        .filter(d => d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()))
                                                                        .map(d => (
                                                                            <div
                                                                                key={d.id}
                                                                                onClick={() => {
                                                                                    // Group is derived from the chosen department (fallback to the first group).
                                                                                    setFormData({ ...formData, departmentId: d.id, unitId: '', groupId: (d as any).groupId || groups[0]?.id || '' });
                                                                                    setIsDeptDropdownOpen(false);
                                                                                    setDeptSearchTerm('');
                                                                                }}
                                                                                className={`px-4 py-3 text-sm rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${formData.departmentId === d.id ? 'bg-blue-50/50 font-bold text-blue-600' : 'text-slate-700'}`}
                                                                            >
                                                                                {d.name} {d.isOffice ? '(Office)' : ''}
                                                                            </div>
                                                                        ))
                                                                    }
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                                        {t('unit', { defaultValue: 'Unit' })}
                                                        {formData.role === 'EMPLOYEE' && units.filter(u => u.departmentId === formData.departmentId).length > 0 && <span className="text-red-500 ml-1">*</span>}
                                                    </label>
                                                    <select
                                                        value={formData.unitId || ''}
                                                        onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                                                        required={formData.role === 'EMPLOYEE' && units.filter(u => u.departmentId === formData.departmentId).length > 0}
                                                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
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
                                        </>
                                    )}
                                    {!isGlobalScopeRole && (
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                                {t('job_description', { defaultValue: 'Job Description' })}
                                                {!isEditMode && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <select
                                                value={formData.jobDescriptionId || ''}
                                                onChange={(e) => {
                                                    const newJdId = e.target.value;
                                                    const newJd = jobDescriptions.find(jd => jd.id === newJdId);
                                                    const prevJd = jobDescriptions.find(jd => jd.id === formData.jobDescriptionId);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        jobDescriptionId: newJdId,
                                                        // Auto-fill the position from the selected Job Description, unless the
                                                        // user has typed a custom position (i.e. it isn't the previous JD's title).
                                                        position: (!prev.position || prev.position === prevJd?.title)
                                                            ? (newJd?.title || prev.position)
                                                            : prev.position,
                                                    }));
                                                }}
                                                required={!isEditMode}
                                                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-bold text-slate-800 shadow-sm cursor-pointer"
                                            >
                                                <option value="">{t('select_job_description', { defaultValue: 'Select Job Description' })}</option>
                                                {availableJobDescriptions.map(jd => {
                                                    const filled = jd._count?.employees || 0;
                                                    return (
                                                        <option key={jd.id} value={jd.id}>
                                                            {jd.title} {jd.isHead ? '(Head)' : ''} — {filled}/{jd.plannedCount}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {availableJobDescriptions.length === 0 && (
                                                <p className="text-[11px] font-bold text-red-500">{t('no_available_jd_for_scope', { defaultValue: 'No available Job Descriptions for the selected organizational unit. They may all be filled to their staffing plan — increase a planned headcount or create a new Job Description.' })}</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </section>

                    {/* 3. Employment Details */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-emerald-500/10">
                            <Briefcase size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                                <Briefcase size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('employment_details', { defaultValue: 'Employment Details' })}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider  items-center gap-1.5 flex">Position Title {positionLocked && <Lock size={12} className="text-slate-400" />}</label>
                                <input
                                    type="text"
                                    value={formData.position || ''}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    disabled={positionLocked}
                                    className={`w-full px-5 py-4 border rounded-2xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all font-bold text-slate-800 shadow-sm ${positionLocked ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500' : 'bg-white border-slate-200'}`}
                                    placeholder="e.g. Senior Developer"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('nationality', { defaultValue: 'Nationality' })}</label>
                                <input
                                    type="text"
                                    value={formData.nationality || ''}
                                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all font-bold text-slate-800 shadow-sm"
                                    placeholder="Libyan"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider items-center gap-1.5 flex">{t('job_category', { defaultValue: 'Job Category' })} {categoryLocked && <Lock size={12} className="text-slate-400" />}</label>
                                {categoryLocked ? (
                                    <div className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 shadow-sm">{formData.jobCategory || jdCategories[0]}</div>
                                ) : (
                                    <select
                                        value={formData.jobCategory || ''}
                                        onChange={(e) => setFormData({ ...formData, jobCategory: e.target.value })}
                                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                    >
                                        <option value="">Select Category</option>
                                        {(categoryChoice ? jdCategories : JOB_CATEGORIES).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider items-center gap-1.5 flex">{t('place_of_work', { defaultValue: 'Place of Work' })} {placeLocked && <Lock size={12} className="text-slate-400" />}</label>
                                {placeLocked ? (
                                    <div className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 shadow-sm">{formData.placeOfWork || jdLocations[0]}</div>
                                ) : (
                                    <select
                                        value={formData.placeOfWork || ''}
                                        onChange={(e) => setFormData({ ...formData, placeOfWork: e.target.value })}
                                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                    >
                                        <option value="">{t('select_place', { defaultValue: 'Select Place of Work' })}</option>
                                        {placeOptions.map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('job_grade', { defaultValue: 'Job Grade' })}</label>
                                <select
                                    value={formData.jobGrade || ''}
                                    onChange={(e) => setFormData({ ...formData, jobGrade: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                >
                                    <option value="">Select Grade</option>
                                    {JOB_GRADES.map(grade => (
                                        <option key={grade} value={grade}>{grade}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-emerald-500 uppercase tracking-wider block">Evaluation Index</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.evaluationPoints || 0}
                                    onChange={(e) => setFormData({ ...formData, evaluationPoints: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all font-bold text-slate-800 shadow-sm"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 4. System Access */}
                    <section className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[32px] p-8 shadow-2xl relative overflow-hidden text-white">
                        <div className="absolute top-0 right-0 p-8 text-white/5">
                            <Lock size={160} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-indigo-500/30 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                                <Key size={20} className="text-indigo-300" />
                            </div>
                            <h2 className="text-lg font-black uppercase tracking-widest text-indigo-50">{t('system_access_credentials', { defaultValue: 'System Access Credentials' })}</h2>
                        </div>

                        <div className="relative z-10">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                                <div>
                                    <p className="text-sm font-bold text-indigo-200">{t('auth_configuration', { defaultValue: 'Authentication Configuration' })}</p>
                                    <p className="text-xs text-indigo-300/70 font-medium">
                                        {t('auth_hint', { defaultValue: 'A login account is created automatically from the email — the person can sign in and appears in Access Management. If the password is left blank, a default of "123456" is set.' })}
                                    </p>
                                </div>
                                {formData.fullName && (
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, email: generateEmailFromFullName(formData.fullName!) })}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-xs font-bold text-indigo-200 hover:bg-indigo-500/40 transition-all shadow-sm backdrop-blur-md"
                                    >
                                        <Sparkles size={14} />
                                        Generate Suggestion
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">{t('system_email', { defaultValue: 'Login Email' })}</label>
                                    <div className="relative">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300/50" />
                                        <input
                                            type="email"
                                            required={!isEditMode}
                                            value={formData.email || ''}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full pl-12 pr-5 py-4 bg-white/10 border border-indigo-400/20 rounded-2xl focus:ring-4 focus:ring-indigo-500/30 transition-all font-bold text-white placeholder:text-indigo-200/40 backdrop-blur-md"
                                            placeholder="user@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">{t('account_password', { defaultValue: 'System Password' })}</label>
                                    <div className="relative">
                                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300/50" />
                                        <input
                                            type="password"
                                            value={formData.password || ''}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full pl-12 pr-5 py-4 bg-white/10 border border-indigo-400/20 rounded-2xl focus:ring-4 focus:ring-indigo-500/30 transition-all font-bold text-white placeholder:text-indigo-200/40 backdrop-blur-md"
                                            placeholder={isEditMode ? "•••••••• (Leave blank to keep)" : "••••••••"}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 5. Salary & Financials */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-yellow-500/10">
                            <CreditCard size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shadow-sm">
                                <CreditCard size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Financials & Multipliers</h2>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                            {/* Factors */}
                            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                                <h3 className="col-span-full text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Salary Factors</h3>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-blue-500 uppercase tracking-wider block">Position Factor</label>
                                    {(() => {
                                        const isHeadRole = ['HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_DIVISION', 'HEAD_DIRECTOR', 'HEAD_UNIT', 'GENERAL_MANAGER', 'CHAIRMAN'].includes(formData.role || '');
                                        let dynamicFactor = 1.0;
                                        if (isHeadRole) {
                                            if ((formData.role === 'HEAD_DEPARTMENT' || formData.role === 'HEAD_OFFICE') && formData.departmentId) {
                                                const dept = departments.find(d => d.id === formData.departmentId);
                                                if (dept && (dept as any).positionFactor) dynamicFactor = (dept as any).positionFactor;
                                            } else if (formData.role === 'HEAD_DIVISION' && formData.divisionId) {
                                                const div = divisions.find(d => d.id === formData.divisionId);
                                                if (div && (div as any).positionFactor) dynamicFactor = (div as any).positionFactor;
                                            } else if (formData.role === 'HEAD_UNIT') {
                                                dynamicFactor = 1.20;
                                            } else if (formData.role === 'GENERAL_MANAGER' || formData.role === 'CHAIRMAN') {
                                                dynamicFactor = 1.70;
                                            }
                                        }

                                        return (
                                            <div className={`w-full px-5 py-4 border-transparent rounded-2xl transition-all font-bold shadow-inner ${!isHeadRole ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                                {isHeadRole ? `Auto-Assigned: ${dynamicFactor.toFixed(2)}` : 'Standard (1.00)'}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider block">Skill Factor</label>
                                    <select
                                        value={formData.skillFactor || 1.0}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setFormData({
                                                ...formData,
                                                skillFactor: val,
                                                positionFactor: val > 1.0 ? 1.0 : formData.positionFactor
                                            });
                                        }}
                                        className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-indigo-900  shadow-sm cursor-pointer"
                                    >
                                        <option value={1.0}>Standard (1.0)</option>
                                        {SKILL_FACTORS.map(f => (
                                            <option key={f.name} value={f.value}>{f.name} ({f.value})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-purple-500 uppercase tracking-wider block">Site Factor</label>
                                    <select
                                        value={formData.siteFactor || 1.0}
                                        onChange={(e) => setFormData({ ...formData, siteFactor: Number(e.target.value) })}
                                        className="w-full px-5 py-4 bg-purple-50/50 border border-purple-100 rounded-2xl focus:ring-4 focus:ring-purple-100 transition-all font-bold text-purple-900  shadow-sm cursor-pointer"
                                    >
                                        <option value={1.0}>Office (1.0)</option>
                                        {SITE_FACTORS.map(f => (
                                            <option key={f.name} value={f.value}>{f.name} ({f.value})</option>
                                        ))}
                                    </select>
                                </div>
                                {!formData.contractType?.includes('NONE RESDANT') && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-pink-500 uppercase tracking-wider block">Language Factor</label>
                                        <select
                                            value={formData.languageFactor || 1.0}
                                            onChange={(e) => setFormData({ ...formData, languageFactor: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-pink-50/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-pink-100 transition-all font-bold text-pink-900  shadow-sm cursor-pointer"
                                        >
                                            <option value={1.0}>Native (1.0)</option>
                                            {LANGUAGE_FACTORS.map(f => (
                                                <option key={f.name} value={f.value}>{f.name} ({f.value})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Calculations */}
                            <div className="lg:col-span-5 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider items-center gap-1.5 flex">Salary Structure <span className="text-red-500">*</span> {fromOnboarding && <Lock size={12} className="text-slate-400" />}</label>
                                    <select
                                        required
                                        disabled={fromOnboarding}
                                        value={formData.salaryStructureType || ''}
                                        onChange={(e) => setFormData({ ...formData, salaryStructureType: e.target.value })}
                                        className={`w-full px-5 py-4 border rounded-2xl focus:ring-4 transition-all font-bold text-slate-800 shadow-sm ${fromOnboarding ? 'bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500' : 'bg-white cursor-pointer'} ${!fromOnboarding && (formData.salaryStructureType ? 'border-slate-200 focus:ring-slate-100 focus:border-slate-500' : 'border-red-300 focus:ring-red-100 focus:border-red-500')}`}
                                    >
                                        <option value="">Select Structure</option>
                                        <option value="SS-01-LYD">SS-01-LYD</option>
                                        <option value="SS-02-USD">SS-02-USD</option>
                                        <option value="SS-03-USD">SS-03-USD</option>
                                        <option value="SS-04-EUR">SS-04-EUR</option>
                                        <option value="SS-05-EUR">SS-05-EUR</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t('base_salary')}</label>
                                        <div className="flex bg-slate-100/50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                                            <div className="flex items-center justify-center px-4 border-r border-slate-200 bg-slate-200/50">
                                                <span className="text-sm font-black text-slate-500">{getCurrencySymbol(formData.salaryStructureType)}</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={displayBaseSalary?.toLocaleString() || '0'}
                                                disabled
                                                className="w-full px-4 py-4 bg-transparent border-none font-black text-slate-600 text-lg text-center"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Factored Salary</label>
                                        <div className="flex bg-emerald-50/50 border border-emerald-200 rounded-2xl overflow-hidden shadow-inner">
                                            <div className="flex items-center justify-center px-4 border-r border-emerald-200 bg-emerald-100/50">
                                                <span className="text-sm font-black text-emerald-600">{getCurrencySymbol(formData.salaryStructureType)}</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={factoredSalaryForm.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                disabled
                                                className="w-full px-4 py-4 bg-transparent border-none font-black text-emerald-700 text-lg text-center"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 6. Contract & Leaves */}
                    <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 text-cyan-500/10">
                            <FileText size={120} />
                        </div>
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shadow-sm">
                                <CalendarDays size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('contract_details')} & Leaves</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 mb-8">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('engagement_date')}</label>
                                <input
                                    type="date" required
                                    value={formData.joinDate}
                                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-50 focus:border-cyan-500 transition-all font-bold text-slate-800 shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('contract_start')}</label>
                                <input
                                    type="date"
                                    value={formData.contractStartDate || ''}
                                    onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-50 focus:border-cyan-500 transition-all font-bold text-slate-800 shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('contract_end')}</label>
                                <input
                                    type="date"
                                    value={formData.contractEndDate || ''}
                                    onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-50 focus:border-cyan-500 transition-all font-bold text-slate-800 shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('contract_number', { defaultValue: 'Contract Number' })}</label>
                                <select
                                    value={formData.contractNumber || '1st'}
                                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-50 focus:border-cyan-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
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
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-cyan-50 focus:border-cyan-500 transition-all font-bold text-slate-800  shadow-sm cursor-pointer"
                                >
                                    <option value="RESDANT">RESDANT</option>
                                    <option value="DIRCT NONE RESDANT">DIRCT NONE RESDANT</option>
                                    <option value="NONE RESDANT">NONE RESDANT</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 relative z-10">
                            <h3 className="col-span-full text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('leave_adjustment')}</h3>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('holidays_taken')}</label>
                                <input
                                    type="number" step="0.5" min="0"
                                    value={formData.holidaysUsed || 0}
                                    onChange={(e) => setFormData({ ...formData, holidaysUsed: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-slate-100 transition-all font-bold text-slate-800 shadow-sm"
                                    placeholder="0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-red-500 uppercase tracking-wider block">{t('emergency_taken', { defaultValue: 'Emergency Taken' })}</label>
                                <input
                                    type="number" step="1" min="0"
                                    value={formData.emergencyHolidaysUsed || 0}
                                    onChange={(e) => setFormData({ ...formData, emergencyHolidaysUsed: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-red-50/30 border border-red-100 rounded-2xl focus:ring-4 focus:ring-red-50 transition-all font-bold text-red-900 shadow-sm"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-orange-500 uppercase tracking-wider block">{t('unpaid_taken', { defaultValue: 'Unpaid Taken' })}</label>
                                <input
                                    type="number" step="0.5" min="0"
                                    value={formData.unpaidHolidaysUsed || 0}
                                    onChange={(e) => setFormData({ ...formData, unpaidHolidaysUsed: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-orange-50/30 border border-orange-100 rounded-2xl focus:ring-4 focus:ring-orange-50 transition-all font-bold text-orange-900 shadow-sm"
                                    placeholder="0.0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-blue-500 uppercase tracking-wider block">{t('bonus_holidays')}</label>
                                <input
                                    type="number" step="0.5" min="0"
                                    value={formData.bonusHolidays || 0}
                                    onChange={(e) => setFormData({ ...formData, bonusHolidays: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-blue-50/30 border border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-50 transition-all font-bold text-blue-900 shadow-sm"
                                    placeholder="0.0"
                                />
                            </div>
                        </div>
                    </section>
                </form>
            </div>

            {/* Footer Static Bar */}
            <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500 delay-300 mt-2">
                <div className="flex flex-col sm:flex-row items-center justify-between p-6 glass-card shadow-sm border border-slate-200 bg-white/95 backdrop-blur-xl gap-4 rounded-[32px]">
                    <div className="flex items-center gap-4 w-full">
                        <button
                            onClick={() => navigate('/employees')}
                            className="p-3 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-outfit font-black text-slate-800 tracking-tight">
                                {isEditMode ? t('modify_personnel') : t('enroll_personnel')}
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-1 hidden sm:block">
                                {isEditMode ? `Updating record for ${formData.fullName}` : 'Complete the form below to board a new employee'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => navigate('/employees')}
                            className="flex-1 sm:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                            <X size={16} />
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex-1 sm:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group whitespace-nowrap"
                        >
                            <Save size={16} className="group-hover:rotate-12 transition-transform" />
                            {isEditMode ? t('commit_changes') : t('confirm_enrollment')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default EmployeeForm;
