import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../../services/employeeService';
import { personnelActionService, type PersonnelActionForm } from '../../services/personnelActionService';
import { jobDescriptionService } from '../../services/jobDescriptionService';
import { departmentService, divisionService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { directorateService } from '../../services/directorateService';
import { timeService } from '../../services/timeService';
import { staffHubService } from '../../services/staffHubService';
import { evaluationService, type EvaluationHistoryMonth } from '../../services/evaluationService';
import { disciplinaryService, type DisciplinaryCase, type DisciplinaryActionType, type DisciplinaryStage, type DisciplinaryOutcome } from '../../services/disciplinaryService';
import { offboardingService, type OffboardingCase, type OffboardingStage } from '../../services/offboardingService';
import { promotionService, type PromotionStage, type PromotionCase } from '../../services/promotionService';
import { rewardService, type RewardCase } from '../../services/rewardService';
import { getPromotionRule, monthsSince, EVALUATION_INDEX_THRESHOLD } from '../../utils/jobGrades';
import { DISCIPLINARY_CATEGORY_LABELS, DISCIPLINARY_ACTION_LABELS, DISCIPLINARY_VIOLATIONS, VIOLATIONS_BY_ID, type DisciplinaryCategory } from '../../constants/disciplinaryViolations';
import { payrollService } from '../../services/payrollService';
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
    ChevronRight,
    ChevronDown,
    Lock,
    TrendingUp,
    FileSpreadsheet as ExcelIcon
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO, addDays, addMonths } from 'date-fns';
import Modal from '../../components/Modal';
import type { Employee, EmployeeDocument } from '../../types';
import { JOB_GRADES } from '../../types';
import { makeFieldVisibility } from '../../utils/employeeFieldVisibility';
import { canAccess } from '../../utils/access';
import { getRequiredLevels, type EvalLevel } from '../../utils/evaluationHierarchy';
import { buildEvaluationBreakdown } from '../../utils/evaluationScoring';
import EvaluationBreakdownView from '../../components/EvaluationBreakdownView';
import JobDescriptionView from '../../components/JobDescriptionView';
import EvaluationControl from '../hr/EvaluationControl';
import EvaluationsPage from '../Evaluations';
import EmployeesPage from '../admin/Employees';
import RewardsTab, { REWARD_TYPE_LABELS } from './RewardsTab';

// Collapsible tree node — file-explorer style. Module-scope (not defined inside
// PersonnelRelations' render) so its identity is stable across renders: a component
// redefined on every render is a *different type* to React at the same tree position,
// so it fully unmounts/remounts (losing the just-clicked button's focus and churning the
// whole DOM subtree) instead of patching in place — that was the cause of the page
// jumping/scrolling on every branch toggle. Expand state lives in the parent and is
// passed in as isOpen/onToggle rather than read from a nodeKey here, so this component
// has no closure dependencies at all.
const TreeBranch = ({ icon: Icon, title, color = 'bg-slate-100 text-slate-600', count, level = 0, restricted, isOpen, onToggle, action, children }: any) => {
    if (restricted) {
        return (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-center gap-2.5" style={{ marginLeft: level * 20 }}>
                <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex-1">{title}</span>
                <span className="text-[10px] font-bold text-slate-300">{restricted}</span>
            </div>
        );
    }
    return (
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm" style={{ marginLeft: level * 20 }}>
            <div className="w-full flex items-center gap-2 pr-2 hover:bg-slate-50/70 transition-colors rounded-xl">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-3 text-left"
                >
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                    {Icon && <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}><Icon className="w-3.5 h-3.5" /></div>}
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-[0.15em] flex-1 min-w-0">{title}</h4>
                    {count !== undefined && <span className="text-[10px] font-black text-slate-400 shrink-0">{count}</span>}
                </button>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            {isOpen && <div className="px-4 pb-4 pt-1 border-t border-slate-50">{children}</div>}
        </div>
    );
};

interface SearchOption { value: string; label: string; sub?: string; group?: string }

// A compact searchable dropdown (combobox): shows the selected label, opens a filterable list on
// click, groups options by `group`, and closes on outside-click. Used for the Employee and Target
// Position pickers in the Create Internal Transfer modal.
const SearchSelect: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: SearchOption[];
    placeholder?: string;
    emptyText?: string;
}> = ({ value, onChange, options, placeholder, emptyText }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const selected = options.find(o => o.value === value);
    const q = query.trim().toLowerCase();
    const filtered = q
        ? options.filter(o => `${o.label} ${o.sub || ''} ${o.group || ''}`.toLowerCase().includes(q))
        : options;
    const groups: Record<string, SearchOption[]> = {};
    filtered.forEach(o => { const g = o.group || ''; (groups[g] = groups[g] || []).push(o); });
    const groupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full p-2 border border-[#511d29]/20 bg-white text-left flex items-center justify-between gap-2">
                <span className={`truncate ${selected ? 'text-slate-700' : 'text-slate-400'}`}>{selected ? selected.label : (placeholder || t('select_ellipsis', { defaultValue: 'Select…' }))}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-[#511d29]/20 shadow-xl rounded-lg max-h-64 overflow-auto">
                    <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                                placeholder={t('search_ellipsis', { defaultValue: 'Search…' })} className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded text-xs" />
                        </div>
                    </div>
                    {filtered.length === 0 && <div className="px-3 py-4 text-center text-slate-400 text-xs">{emptyText || t('no_matches', { defaultValue: 'No matches' })}</div>}
                    {groupKeys.map(g => (
                        <div key={g}>
                            {g && <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 sticky top-[49px]">{g}</div>}
                            {groups[g].map(o => (
                                <button type="button" key={o.value} onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[#511d29]/5 ${o.value === value ? 'bg-[#511d29]/10 font-black text-[#511d29]' : 'text-slate-600'}`}>
                                    {o.label}{o.sub ? <span className="text-slate-400 font-normal"> · {o.sub}</span> : null}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Row = ({ label, value, dir }: { label: string; value?: any; dir?: 'rtl' | 'ltr' }) => (
    <div className="min-w-0">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className="text-sm font-bold text-slate-700 break-words" dir={dir}>{(value === 0 || value) ? value : <span className="text-slate-300">—</span>}</div>
    </div>
);

// Module-scope for the same reason as TreeBranch above — takes `emp` as an explicit prop
// instead of closing over it.
const Field = ({ emp, label, k, type, dir }: { emp: Employee; label: string; k: string; type?: string; dir?: 'rtl' | 'ltr' }) => {
    let v: any = (emp as any)[k];
    if (type === 'date') v = v ? format(parseISO(v as string), 'dd MMM yyyy') : '';
    return <Row label={label} value={v} dir={dir} />;
};
const DISCIPLINARY_STAGE_COLUMNS: { key: DisciplinaryStage; label: string }[] = [
    { key: 'INCIDENT_REPORT', label: 'Incident Report' },
    { key: 'NOTICE_TO_EXPLAIN', label: 'Notice to Explain' },
    { key: 'INVESTIGATION_RESULT', label: 'Investigation Result' },
    { key: 'DISCIPLINARY_ACTION', label: 'Disciplinary Action' },
];
const OFFBOARDING_STAGE_COLUMNS: { key: OffboardingStage; label: string }[] = [
    { key: 'RESIGNATION_REQUEST', label: 'Resignation Request' },
    { key: 'CLEARANCE', label: 'Employee Clearance' },
    { key: 'SEPARATION_LETTER', label: 'Separation Letter' },
];
const PROMOTION_STAGE_COLUMNS: { key: PromotionStage; label: string }[] = [
    { key: 'NOTICE_OF_PROMOTION', label: 'Notice of Promotion' },
    { key: 'PROMOTION_REPORT', label: 'Promotion Report' },
];
const BASIS_LABELS: Record<string, string> = {
    TENURE: 'Tenure',
    EVALUATION: 'Evaluation Index',
    EXCEPTIONAL: 'Exceptional',
};
// Mirrors offboardingController.ts's SEPARATION_REASON_LABELS — the reason shown here in an
// employee's own file for why they left, one of the 4 real separation types.
const OFFBOARDING_SOURCE_LABELS: Record<string, string> = {
    EMPLOYEE_RESIGNATION: 'Resignation',
    DISCIPLINARY_TERMINATION: 'Termination',
    TERMINATION: 'Termination',
    CONTRACT_NON_RENEWAL_EMPLOYEE: 'Contract Non-Renewal (by Employee)',
    CONTRACT_NON_RENEWAL_COMPANY: 'Contract Non-Renewal (by Company)',
};

const PersonnelRelations: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    // Document control (add/replace/delete) is HR-only — everyone else who can see this screen
    // (heads, plain employees) stays view-only, same as the rest of the detail modal.
    const isHRRole = canAccess(currentUser, ['HR_MANAGER', 'PERSONNEL'], ['manage_lifecycle_control']);

    // Determine active tab from route path
    const getActiveTab = () => {
        if (currentPath.includes('/lifecycle')) return 'lifecycle';
        if (currentPath.includes('/renewals')) return 'renewals';
        if (currentPath.includes('/action-forms')) return 'action-forms';
        if (currentPath.includes('/promotions')) return 'promotions';
        if (currentPath.includes('/rewards')) return 'rewards';
        if (currentPath.includes('/disciplinary')) return 'disciplinary';
        if (currentPath.includes('/offboarding')) return 'offboarding';
        if (currentPath.includes('/evaluations')) return 'evaluations';
        if (currentPath.includes('/employee-control')) return 'employee-control';
        return 'lifecycle'; // Fallback
    };

    const activeTab = getActiveTab();

    // Per-section access. A user must hold the SECTION's own permission to see inside it — not just
    // to act. Sections they aren't assigned to are hidden entirely (locked panel below), matching
    // the nav gating in MainLayout. canAccess bypasses SUPER_ADMIN and treats permissions as
    // authoritative for anyone who has any.
    const TAB_ACCESS: Record<string, { roles: string[]; perms: string[] }> = {
        'lifecycle': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], perms: ['view_lifecycle'] },
        'renewals': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], perms: ['manage_contract_management', 'view_lifecycle'] },
        'action-forms': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], perms: ['manage_personnel_actions'] },
        'promotions': { roles: ['SUPER_ADMIN', 'HR_MANAGER'], perms: ['manage_promotions'] },
        'rewards': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], perms: ['manage_rewards'] },
        'disciplinary': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], perms: ['manage_disciplinary'] },
        'offboarding': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], perms: ['manage_offboarding'] },
        'evaluations': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT'], perms: ['manage_evaluation_control', 'view_evaluations'] },
        'employee-control': { roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], perms: ['view_employees', 'manage_employees'] },
    };
    const tabAccess = TAB_ACCESS[activeTab];
    const canSeeActiveTab = !tabAccess || canAccess(currentUser, tabAccess.roles, tabAccess.perms);

    // Modals
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [isActionFormModalOpen, setIsActionFormModalOpen] = useState(false);
    // Personnel Action Form (internal transfer) — driven by the target Job Description.
    const emptyPaf = {
        employeeId: '', newJobDescriptionId: '', newJobGrade: '', newPlaceOfWork: '',
        reportsTo: '', typeOfTransfer: '', effectiveDate: '', newJobCategory: '',
    };
    const [pafForm, setPafForm] = useState({ ...emptyPaf });
    const [pafSubmitting, setPafSubmitting] = useState(false);
    // Filter the Target Position list. Encoded as "<type>:<id>" — dir: directorate, div: division, off: office.
    const [pafJdScope, setPafJdScope] = useState('');
    // Inter-company transfer — free-text destination (another company) + entered factors.
    const emptyIc = {
        employeeId: '', newCompany: '', newDivisionName: '', newDepartmentName: '', newUnitName: '',
        newPositionTitle: '', newJobCategory: '', newJobGrade: '', reportsTo: '', newPlaceOfWork: '',
        englishFactor: '', positionFactor: '', locationFactor: '', skillFactor: '',
        typeOfTransfer: '', effectiveDate: '', justification: '',
    };
    const [icForm, setIcForm] = useState({ ...emptyIc });
    const [isIcModalOpen, setIsIcModalOpen] = useState(false);
    const [icSubmitting, setIcSubmitting] = useState(false);
    const [decidePaf, setDecidePaf] = useState<PersonnelActionForm | null>(null);
    const [decideFile, setDecideFile] = useState<File | null>(null);
    const [decideNewCompany, setDecideNewCompany] = useState('');
    const [decideBusy, setDecideBusy] = useState<string | null>(null);
    const [pafGenBusy, setPafGenBusy] = useState<string | null>(null);
    // Which employee+month evaluation form is currently being exported (key: `${employeeId}:${month}`).
    const [evalDocBusy, setEvalDocBusy] = useState<string | null>(null);
    const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
    // Initiate Renewal form: the proposed new contract + the signed contract file to attach.
    const [renewForm, setRenewForm] = useState({ startDate: '', endDate: '', contractNumber: '', notes: '' });
    const [renewFile, setRenewFile] = useState<File | null>(null);
    const [renewSubmitting, setRenewSubmitting] = useState(false);
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

    // Which tree branches are expanded in the detail view — lifted up here (rather than living
    // inside TreeBranch itself) because TreeBranch is defined inside this component's render, so
    // its own useState would remount and reset on every unrelated re-render (e.g. a query refetch).
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
        () => new Set(['personal', 'identity', 'identity.idpassport'])
    );
    const toggleNode = (key: string) => setExpandedNodes(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    // Additional (free-form) documents for the employee currently open in the detail modal.
    const { data: employeeDocuments = [] } = useQuery({
        queryKey: ['employee-documents', detailEmp?.id],
        queryFn: () => employeeService.getEmployeeDocuments(detailEmp!.id),
        enabled: !!detailEmp && isHRRole,
    });

    // Full record (incl. contract history) for the employee open in the detail modal. Each renewal
    // archives the old contract and adds a new ACTIVE one, so this list grows with every renewal —
    // e.g. a renewed employee shows Contract 1 (archived) + Contract 2 (active).
    const { data: detailFull } = useQuery({
        queryKey: ['employee-contracts', detailEmp?.id],
        queryFn: () => employeeService.getEmployeeById(detailEmp!.id),
        enabled: !!detailEmp,
    });
    const detailContracts: any[] = (detailFull as any)?.contracts || [];
    // Join Date = start date of the employee's first (oldest) contract, not the separately
    // stored Employee.joinDate — some legacy records had the two drift apart.
    const firstContractStartDate = detailContracts.length
        ? [...detailContracts].sort((a, b) => new Date(a.startDate || a.createdAt).getTime() - new Date(b.startDate || b.createdAt).getTime())[0].startDate
        : detailEmp?.joinDate || null; // no Contract rows yet (e.g. pending enrolment) — fall back to the stored value

    // --- New Lifecycle tree data: Career Transfers, Attendance & Leave, Monthly Evaluations ---
    const { data: detailTransfers = [] } = useQuery({
        queryKey: ['employee-transfers', detailEmp?.id],
        queryFn: () => personnelActionService.getByEmployee(detailEmp!.id),
        enabled: !!detailEmp,
    });
    const { data: detailTimeRecords = [] } = useQuery({
        queryKey: ['employee-time-records', detailEmp?.id],
        queryFn: () => timeService.getTimeRecordsByEmployee(detailEmp!.id),
        enabled: !!detailEmp,
    });
    const { data: detailLeaveRequests = [] } = useQuery({
        queryKey: ['employee-leave-requests', detailEmp?.id],
        queryFn: () => staffHubService.getMyRequests(detailEmp!.id),
        enabled: !!detailEmp,
    });
    // `allowed: false` (a 403) means this viewer isn't permitted to see this employee's scores —
    // rendered as a locked row rather than an error, never inferred purely client-side.
    const { data: detailEvalHistory = { allowed: true, months: [] as EvaluationHistoryMonth[] } } = useQuery({
        queryKey: ['employee-evaluation-history', detailEmp?.id],
        queryFn: () => evaluationService.getEvaluationHistory(detailEmp!.id),
        enabled: !!detailEmp,
    });
    // New — confirmed disciplinary record, part of the employee's permanent file. Only cases that
    // actually completed the Disciplinary Action stage (actionCompletedAt set) count as "confirmed
    // against the employee" — excludes cases still in progress, dismissed at intake, and
    // investigations that concluded Non Violation. Gated client-side on manage_disciplinary so a
    // viewer without it never fires a request that would just 403.
    const canSeeDisciplinaryRecord = canAccess(currentUser, [], ['manage_disciplinary']);
    const { data: detailDisciplinaryCases = [] } = useQuery({
        queryKey: ['employee-disciplinary-history', detailEmp?.id],
        queryFn: () => disciplinaryService.getByEmployee(detailEmp!.id),
        enabled: !!detailEmp && canSeeDisciplinaryRecord,
    });
    const detailDisciplinaryRecord = detailDisciplinaryCases.filter(c => !!c.actionCompletedAt);

    // Separation details for a SEPARATED employee's detail view — fetched on demand, only for
    // someone actually separated (everyone else has no offboarding case worth showing here).
    const { data: detailOffboardingCases = [] } = useQuery({
        queryKey: ['employee-offboarding-cases', detailEmp?.id],
        queryFn: () => offboardingService.list({ employeeId: detailEmp!.id }),
        enabled: !!detailEmp && detailEmp.enrollmentStatus === 'SEPARATED',
    });
    const detailSeparationCase = detailOffboardingCases.find(c => c.stage === 'CLOSED') || detailOffboardingCases[0];

    // New — this employee's promotion history. The backend route is gated behind manage_promotions
    // (see promotionRoutes.ts), so mirror that here the same way canSeeDisciplinaryRecord does below
    // — check client-side before firing the request rather than letting it 403.
    const canSeePromotionRecord = canAccess(currentUser, [], ['manage_promotions']);
    const { data: detailPromotionCases = [] } = useQuery({
        queryKey: ['employee-promotion-cases', detailEmp?.id],
        queryFn: () => promotionService.list({ employeeId: detailEmp!.id }),
        enabled: !!detailEmp && canSeePromotionRecord,
    });

    // New — this employee's reward case history (Employee of the Month, Attendance Excellence,
    // Employee of the Year, Loyalty Milestone). Same gating as the Promotion Record above —
    // reward-cases routes are gated behind manage_rewards (see rewardRoutes.ts).
    const canSeeRewardsRecord = canAccess(currentUser, [], ['manage_rewards']);
    const { data: detailRewardCases = [] } = useQuery({
        queryKey: ['employee-reward-cases', detailEmp?.id],
        queryFn: () => rewardService.list({ employeeId: detailEmp!.id }),
        enabled: !!detailEmp && canSeeRewardsRecord,
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
            toast.success(t('document_updated', { defaultValue: 'Document updated.' }));
        } catch (err) {
            console.error('Failed to upload document', err);
            toast.error(t('failed_to_upload_document', { defaultValue: 'Failed to upload document.' }));
        } finally {
            setUploadingDocKey(null);
        }
    };

    // Add a brand-new, custom-named document (e.g. a new certificate) for the employee.
    const handleAddDocument = async (empId: string) => {
        if (!newDocName.trim()) { toast.error(t('enter_a_name_for_the_document', { defaultValue: 'Enter a name for the document.' })); return; }
        if (!newDocFile) { toast.error(t('choose_a_file_to_upload', { defaultValue: 'Choose a file to upload.' })); return; }
        setAddingDoc(true);
        try {
            const { url, name: fileName } = await employeeService.uploadDocument(newDocFile);
            await employeeService.addEmployeeDocument(empId, newDocName.trim(), url, fileName);
            setNewDocName('');
            setNewDocFile(null);
            setAddDocModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['employee-documents', empId] });
            toast.success(t('document_added', { defaultValue: 'Document added.' }));
        } catch (err) {
            console.error('Failed to add document', err);
            toast.error(t('failed_to_add_document', { defaultValue: 'Failed to add document.' }));
        } finally {
            setAddingDoc(false);
        }
    };

    const handleDeleteDocument = async (empId: string, docId: string) => {
        if (!window.confirm(t('remove_this_document_this_cannot_be_undone', { defaultValue: 'Remove this document? This cannot be undone.' }))) return;
        try {
            await employeeService.deleteEmployeeDocument(empId, docId);
            queryClient.invalidateQueries({ queryKey: ['employee-documents', empId] });
            toast.success(t('document_removed', { defaultValue: 'Document removed.' }));
        } catch (err) {
            console.error('Failed to delete document', err);
            toast.error(t('failed_to_delete_document', { defaultValue: 'Failed to delete document.' }));
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

    // Separated employees don't disappear from history — the Lifecycle tab (and the "View Employee
    // File" deep-link every disciplinary/offboarding case's detail page uses) must still be able to
    // find and open their record. A separate roster from the one above, which every "pick an
    // employee for a NEW action" dropdown deliberately keeps excluding them from.
    const { data: employeesIncludingSeparated = [] } = useQuery({
        queryKey: ['relations-employees-all'],
        queryFn: () => employeeService.getAllEmployees({ includeSeparated: true }),
    });

    // Deep-link support: other pages (e.g. a disciplinary case's "View Employee File" action) link
    // straight to /personnel-relations/lifecycle?employeeId=... — once the roster is loaded, open
    // that employee's detail view automatically instead of requiring a manual search.
    useEffect(() => {
        if (currentPath.indexOf('/lifecycle') === -1) return;
        const employeeId = new URLSearchParams(location.search).get('employeeId');
        if (!employeeId || detailEmp) return;
        const match = (employeesIncludingSeparated as Employee[]).find(e => e.id === employeeId);
        if (match) setDetailEmp(match);
    }, [currentPath, location.search, employeesIncludingSeparated, detailEmp]);

    // Keep an already-open detail view in sync with the roster — e.g. completing a promotion case
    // updates the employee's jobGrade/evaluationPoints server-side; once that refetches here, this
    // re-syncs detailEmp instead of letting it keep showing the snapshot captured when it was opened.
    useEffect(() => {
        if (!detailEmp) return;
        const fresh = (employeesIncludingSeparated as Employee[]).find(e => e.id === detailEmp.id)
            || (employees as Employee[]).find(e => e.id === detailEmp.id);
        if (fresh && fresh !== detailEmp) setDetailEmp(fresh);
    }, [employeesIncludingSeparated, employees]);

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
    const { data: disciplinaryCases = [] } = useQuery({
        queryKey: ['disciplinary-cases'],
        queryFn: () => disciplinaryService.list(),
        enabled: activeTab === 'disciplinary',
    });
    const [disciplinaryView, setDisciplinaryView] = useState<'board' | 'attendance'>('board');
    const [showClosedCases, setShowClosedCases] = useState(false);
    const { data: offboardingCases = [] } = useQuery({
        queryKey: ['offboarding-cases'],
        queryFn: () => offboardingService.list(),
        enabled: activeTab === 'offboarding',
    });
    const [showClosedOffboardingCases, setShowClosedOffboardingCases] = useState(false);
    // Searchable employee picker, same pattern as ReportIncident.tsx's "Subject employee/s" field —
    // type-ahead against the roster instead of a plain <select> (impractical once the roster gets
    // into the hundreds).
    const [involuntaryEmployeeQuery, setInvoluntaryEmployeeQuery] = useState('');
    const [involuntaryEmployee, setInvoluntaryEmployee] = useState<Employee | null>(null);
    const [showInvoluntarySuggestions, setShowInvoluntarySuggestions] = useState(false);
    const involuntaryBlurTimeout = useRef<number | null>(null);
    const involuntarySuggestions = useMemo(() => {
        const q = involuntaryEmployeeQuery.trim().toLowerCase();
        if (!q || involuntaryEmployee) return [];
        return (employees as Employee[])
            .filter((emp: any) => emp.fullName.toLowerCase().includes(q) || (emp.staffId || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [involuntaryEmployeeQuery, involuntaryEmployee, employees]);
    const selectInvoluntaryEmployee = (emp: Employee) => {
        setInvoluntaryEmployee(emp);
        setInvoluntaryEmployeeQuery(emp.fullName);
        setShowInvoluntarySuggestions(false);
    };
    const handleInvoluntaryEmployeeChange = (value: string) => {
        setInvoluntaryEmployeeQuery(value);
        if (involuntaryEmployee && value !== involuntaryEmployee.fullName) setInvoluntaryEmployee(null);
        setShowInvoluntarySuggestions(true);
    };
    const [involuntarySource, setInvoluntarySource] = useState<'TERMINATION' | 'EMPLOYEE_RESIGNATION' | 'CONTRACT_NON_RENEWAL_EMPLOYEE' | 'CONTRACT_NON_RENEWAL_COMPANY'>('CONTRACT_NON_RENEWAL_COMPANY');
    const [involuntaryReason, setInvoluntaryReason] = useState('');
    const [involuntaryDate, setInvoluntaryDate] = useState('');

    const { data: promotionCandidates = [] } = useQuery({
        queryKey: ['promotion-candidates'],
        queryFn: () => promotionService.getCandidates(),
        enabled: activeTab === 'promotions',
    });
    const { data: promotionCases = [] } = useQuery({
        queryKey: ['promotion-cases'],
        queryFn: () => promotionService.list(),
        enabled: activeTab === 'promotions',
    });
    const [showClosedPromotionCases, setShowClosedPromotionCases] = useState(false);
    const [isExceptionalPromotionModalOpen, setIsExceptionalPromotionModalOpen] = useState(false);
    const openCaseFromCandidate = async (employeeId: string) => {
        try {
            const created = await promotionService.createFromCandidate(employeeId);
            toast.success(t('promotion_case_opened', { defaultValue: 'Promotion case {{caseNumber}} opened.', caseNumber: created.caseNumber }));
            queryClient.invalidateQueries({ queryKey: ['promotion-cases'] });
            queryClient.invalidateQueries({ queryKey: ['promotion-candidates'] });
            navigate(`/personnel-relations/promotions/${created.id}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_open_the_promotion_case', { defaultValue: 'Failed to open the promotion case.' }));
        }
    };
    // Searchable employee picker for "Add Exceptional Promotion", same pattern as the offboarding
    // manual-case modal above.
    const [exceptionalEmployeeQuery, setExceptionalEmployeeQuery] = useState('');
    const [exceptionalEmployee, setExceptionalEmployee] = useState<Employee | null>(null);
    const [showExceptionalSuggestions, setShowExceptionalSuggestions] = useState(false);
    const exceptionalBlurTimeout = useRef<number | null>(null);
    const exceptionalSuggestions = useMemo(() => {
        const q = exceptionalEmployeeQuery.trim().toLowerCase();
        if (!q || exceptionalEmployee) return [];
        return (employees as Employee[])
            .filter((emp: any) => emp.fullName.toLowerCase().includes(q) || (emp.staffId || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [exceptionalEmployeeQuery, exceptionalEmployee, employees]);
    const selectExceptionalEmployee = (emp: Employee) => {
        setExceptionalEmployee(emp);
        setExceptionalEmployeeQuery(emp.fullName);
        setShowExceptionalSuggestions(false);
        setExceptionalToGrade('');
    };
    const handleExceptionalEmployeeChange = (value: string) => {
        setExceptionalEmployeeQuery(value);
        if (exceptionalEmployee && value !== exceptionalEmployee.fullName) { setExceptionalEmployee(null); setExceptionalToGrade(''); }
        setShowExceptionalSuggestions(true);
    };
    const [exceptionalToGrade, setExceptionalToGrade] = useState<string>('');

    // Recent 25th-to-24th cycles (most recent first), for the Attendance Candidates month picker —
    // HR previously had no way to browse past cycles, only ever seeing "now". Approximated
    // client-side (mirrors currentCycleMonth()'s server-side logic); exact Africa/Tripoli-timezone
    // precision isn't needed just to populate a recent-months picklist.
    const attendanceMonthOptions = useMemo(() => {
        const now = new Date();
        let y = now.getFullYear();
        let m = now.getMonth() + 1;
        if (now.getDate() >= 25) { m += 1; if (m > 12) { m = 1; y += 1; } }
        const options: { value: string; label: string }[] = [];
        for (let i = 0; i < 12; i++) {
            const value = `${y}-${String(m).padStart(2, '0')}`;
            const endDate = new Date(y, m - 1, 24);
            const startDate = new Date(y, m - 2, 25);
            const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
            options.push({ value, label: `${fmt(startDate)} – ${fmt(endDate)}, ${y}` });
            m -= 1;
            if (m < 1) { m = 12; y -= 1; }
        }
        return options;
    }, []);
    const [attendanceMonth, setAttendanceMonth] = useState(() => attendanceMonthOptions[0].value);

    const attendanceCandidatesQuery = useQuery({
        queryKey: ['disciplinary-attendance-candidates', attendanceMonth],
        queryFn: () => disciplinaryService.getAttendanceCandidates(attendanceMonth),
        enabled: activeTab === 'disciplinary' && disciplinaryView === 'attendance',
    });
    const handleExecuteAttendanceCase = async (employeeId: string, violationId: string) => {
        try {
            await disciplinaryService.executeAttendanceCase(employeeId, violationId, attendanceMonth);
            toast.success(t('disciplinary_case_opened_at_the_disciplinary_action_stage', { defaultValue: 'Disciplinary case opened at the Disciplinary Action stage.' }));
            queryClient.invalidateQueries({ queryKey: ['disciplinary-attendance-candidates'] });
            queryClient.invalidateQueries({ queryKey: ['disciplinary-cases'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_execute_the_disciplinary_case', { defaultValue: 'Failed to execute the disciplinary case.' }));
        }
    };
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

    const filteredLifecycleEmployees = (employeesIncludingSeparated as Employee[]).filter(emp => {
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
        toast.success(t('lifecycle_report_exported', { defaultValue: 'Lifecycle report exported.' }));
    };

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
        if (!pafForm.employeeId) { toast.error(t('select_an_employee', { defaultValue: 'Select an employee.' })); return; }
        if (!pafForm.newJobDescriptionId) { toast.error(t('select_the_target_position_job_description', { defaultValue: 'Select the target position (Job Description).' })); return; }
        {
            const jd = (jobDescriptions as any[]).find(j => j.id === pafForm.newJobDescriptionId);
            const cats: string[] = Array.isArray(jd?.jobCategories) ? jd.jobCategories : [];
            if (cats.length > 1 && !pafForm.newJobCategory) { toast.error(t('select_a_job_category_for_this_transfer', { defaultValue: 'Select a job category for this transfer.' })); return; }
        }
        setPafSubmitting(true);
        try {
            await personnelActionService.create(pafForm);
            queryClient.invalidateQueries({ queryKey: ['personnel-actions'] });
            toast.success(t('transfer_form_created_generate_it_to_collect_signatures', { defaultValue: 'Transfer form created. Generate it to collect signatures.' }));
            setIsActionFormModalOpen(false);
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('failed_to_create_the_form', { defaultValue: 'Failed to create the form.' }));
        } finally {
            setPafSubmitting(false);
        }
    };

    const openCreatePaf = () => {
        setPafForm({ ...emptyPaf });
        setPafJdScope('');
        setIsActionFormModalOpen(true);
    };

    const openCreateIc = () => {
        setIcForm({ ...emptyIc });
        setIsIcModalOpen(true);
    };

    // Create an inter-company transfer (free-text destination). Stored PENDING; generated/signed/
    // uploaded, then Accept marks the employee TRANSFERRED.
    const handleIcSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!icForm.employeeId) { toast.error(t('select_an_employee', { defaultValue: 'Select an employee.' })); return; }
        if (!icForm.newCompany.trim()) { toast.error(t('enter_the_destination_company', { defaultValue: 'Enter the destination company.' })); return; }
        setIcSubmitting(true);
        try {
            await personnelActionService.createInterCompany(icForm);
            queryClient.invalidateQueries({ queryKey: ['personnel-actions'] });
            toast.success(t('inter_company_transfer_created_generate_it_to_collect', { defaultValue: 'Inter-company transfer created. Generate it to collect signatures.' }));
            setIsIcModalOpen(false);
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('failed_to_create_the_transfer', { defaultValue: 'Failed to create the transfer.' }));
        } finally {
            setIcSubmitting(false);
        }
    };

    // Resolve which division / department a Job Description belongs to (JDs are scoped to one level,
    // so a unit-level JD's division comes from its department's division, etc.). Used to filter the
    // Target Position picker by division and group it by department.
    const jdDivisionId = (jd: any): string | undefined => {
        if (jd.divisionId) return jd.divisionId;
        if (jd.departmentId) return departments.find((d: any) => d.id === jd.departmentId)?.divisionId;
        if (jd.unitId) {
            const u = units.find((x: any) => x.id === jd.unitId);
            return u ? departments.find((d: any) => d.id === u.departmentId)?.divisionId : undefined;
        }
        return undefined;
    };
    const jdDepartmentId = (jd: any): string | undefined => {
        if (jd.departmentId) return jd.departmentId;
        if (jd.unitId) return units.find((x: any) => x.id === jd.unitId)?.departmentId;
        return undefined;
    };

    const jdDirectorateId = (jd: any): string | undefined => {
        if (jd.directorateId) return jd.directorateId;
        const divId = jdDivisionId(jd);
        return divId ? divisions.find((d: any) => d.id === divId)?.directorateId : undefined;
    };

    // The DIRECT head the employee will report to in the target position — the head of the position's
    // OWN org unit, matched by role + org membership (same resolution the JD document uses for
    // dept/division/directorate heads, incl. HEAD_OFFICE). Falls up unit → department → division →
    // directorate only if the position's own level has no head on record.
    const headOfJd = (jd: any): string => {
        if (!jd) return '';
        const find = (roles: string[], key: string, id?: string) =>
            id ? (employees as any[]).find(e => roles.includes(e.role) && e[key] === id) : undefined;
        const head =
            find(['HEAD_UNIT'], 'unitId', jd.unitId)
            || find(['HEAD_DEPARTMENT', 'HEAD_OFFICE'], 'departmentId', jdDepartmentId(jd))
            || find(['HEAD_DIVISION', 'HEAD_OFFICE'], 'divisionId', jdDivisionId(jd))
            || find(['HEAD_DIRECTOR'], 'directorateId', jdDirectorateId(jd));
        return head?.fullName || '';
    };

    // Selecting the target JD auto-fills Reports To with the head of that position (still editable).
    // When the JD lists a single job category we pre-select it; with several the user picks one.
    const selectJd = (jdId: string) => {
        const jd = (jobDescriptions as any[]).find(j => j.id === jdId);
        const cats: string[] = Array.isArray(jd?.jobCategories) ? jd.jobCategories : [];
        setPafForm(prev => ({
            ...prev,
            newJobDescriptionId: jdId,
            reportsTo: jd ? headOfJd(jd) : '',
            newJobCategory: cats.length === 1 ? cats[0] : '',
        }));
    };

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
            toast.success(t('personnel_action_form_generated', { defaultValue: 'Personnel Action Form generated.' }));
        } catch (error: any) {
            let msg = t('failed_to_generate_the_form', { defaultValue: 'Failed to generate the form.' });
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setPafGenBusy(null);
        }
    };

    // Download the official IPH Monthly (Efficiency) Evaluation Word form for one employee + month,
    // filled live from that month's HR / manager / personnel evaluations.
    const downloadEvalForm = async (employeeId: string, month: string, employeeName: string) => {
        const key = `${employeeId}:${month}`;
        setEvalDocBusy(key);
        try {
            const blob = await payrollService.generateEvaluationDoc(employeeId, month);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Monthly_Evaluation_${(employeeName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_')}_${month}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('evaluation_form_generated', { defaultValue: 'Evaluation form generated.' }));
        } catch (error: any) {
            let msg = t('failed_to_generate_the_evaluation_form', { defaultValue: 'Failed to generate the evaluation form.' });
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setEvalDocBusy(null);
        }
    };

    // Accept (applies the transfer, requires the signed file) or reject a pending form.
    const handleDecide = async (decision: 'ACCEPT' | 'REJECT') => {
        if (!decidePaf) return;
        if (decision === 'ACCEPT' && !decideFile) { toast.error(t('attach_the_signed_form_to_accept', { defaultValue: 'Attach the signed form to accept.' })); return; }
        const isInterCompany = decidePaf.actionType === 'INTER_COMPANY_TRANSFER';
        const newCompany = (decideNewCompany || decidePaf.newCompany || '').trim();
        if (decision === 'ACCEPT' && isInterCompany && !newCompany) { toast.error(t('enter_the_company_the_employee_is_transferring', { defaultValue: 'Enter the company the employee is transferring to.' })); return; }
        setDecideBusy(decision);
        try {
            let documentUrl: string | undefined;
            let documentName: string | undefined;
            if (decideFile) {
                const uploaded = await employeeService.uploadDocument(decideFile);
                documentUrl = uploaded.url;
                documentName = uploaded.name;
            }
            await personnelActionService.decide(decidePaf.id, { decision, documentUrl, documentName, newCompany: isInterCompany ? newCompany : undefined });
            queryClient.invalidateQueries({ queryKey: ['personnel-actions'] });
            queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
            queryClient.invalidateQueries({ queryKey: ['employee-documents', decidePaf.employeeId] });
            toast.success(decision === 'ACCEPT'
                ? (isInterCompany ? t('transfer_accepted_employee_marked_as_transferred', { defaultValue: 'Transfer accepted — employee marked as Transferred.' }) : t('transfer_accepted_and_applied_to_the_employee', { defaultValue: 'Transfer accepted and applied to the employee.' }))
                : t('form_rejected', { defaultValue: 'Form rejected.' }));
            setDecidePaf(null);
            setDecideFile(null);
            setDecideNewCompany('');
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('failed_to_process_the_decision', { defaultValue: 'Failed to process the decision.' }));
        } finally {
            setDecideBusy(null);
        }
    };

    // Open the Initiate Renewal modal, pre-filling the new contract as: start = day after the
    // current contract ends, end = start + 6 months (editable). Salary is derived server-side from
    // the salary structure table at renewal time — never entered here.
    const openRenewalModal = (emp: any) => {
        const start = emp.contractEndDate ? addDays(parseISO(emp.contractEndDate), 1) : new Date();
        const end = addDays(addMonths(start, 6), -1); // 6 months minus a day → an exact 6-month term
        setSelectedEmployee(emp);
        setRenewForm({
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
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
        if (!renewForm.startDate || !renewForm.endDate) { toast.error(t('enter_the_new_contract_start_and_end_dates', { defaultValue: 'Enter the new contract start and end dates.' })); return; }
        if (!renewFile) { toast.error(t('attach_the_signed_contract_before_confirming', { defaultValue: 'Attach the signed contract before confirming.' })); return; }
        setRenewSubmitting(true);
        try {
            const { url, name } = await employeeService.uploadDocument(renewFile);
            await employeeService.renewContract(selectedEmployee.id, {
                startDate: renewForm.startDate,
                endDate: renewForm.endDate,
                contractNumber: renewForm.contractNumber || null,
                type: selectedEmployee.contractType || null,
                notes: renewForm.notes || null,
                documentUrl: url,
                documentName: name,
            });
            queryClient.invalidateQueries({ queryKey: ['relations-employees'] });
            queryClient.invalidateQueries({ queryKey: ['employee-documents', selectedEmployee.id] });
            queryClient.invalidateQueries({ queryKey: ['employee-contracts', selectedEmployee.id] });
            toast.success(t('contract_renewed_signed_document_filed_to_the_employee', { defaultValue: 'Contract renewed. Signed document filed to the employee lifecycle.' }));
            setIsRenewalModalOpen(false);
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('failed_to_renew_the_contract', { defaultValue: 'Failed to renew the contract.' }));
        } finally {
            setRenewSubmitting(false);
        }
    };

    // Generate the Contract Renewal Form (.docx) with the employee's info auto-filled, then trigger
    // a browser download so HR can print it and collect the physical approval signatures.
    const [renewalFormBusy, setRenewalFormBusy] = useState<string | null>(null);
    const [summaryBusy, setSummaryBusy] = useState<string | null>(null);
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
            toast.success(t('contract_renewal_form_generated', { defaultValue: 'Contract renewal form generated.' }));
        } catch (error: any) {
            let msg = t('failed_to_generate_the_form', { defaultValue: 'Failed to generate the form.' });
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setRenewalFormBusy(null);
        }
    };

    // Generate the one-page employee handover summary (IPH letterhead) as a Word download.
    const handleGenerateSummary = async (emp: any) => {
        setSummaryBusy(emp.id);
        try {
            const blob = await employeeService.generateHandoverSummary(emp.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Employee_Summary_${(emp.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('employee_summary_generated', { defaultValue: 'Employee summary generated.' }));
        } catch (error: any) {
            let msg = t('failed_to_generate_the_summary', { defaultValue: 'Failed to generate the summary.' });
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setSummaryBusy(null);
        }
    };


    if (isLoadingEmps) {
        return <div className="p-12 text-center animate-pulse text-[#511d29] font-black uppercase tracking-widest text-sm">{t('loading_personnel_relations', { defaultValue: 'Loading Personnel Relations...' })}</div>;
    }

    // Not assigned to this section → don't reveal its contents at all.
    if (!canSeeActiveTab) {
        return (
            <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
                <div className="border-b-2 border-[#511d29]/10 pb-6">
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight">{t('personnel_relations_department', { defaultValue: 'Personnel Relations Department' })}</h1>
                </div>
                <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Lock className="w-7 h-7 text-slate-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-700">{t('access_restricted', { defaultValue: 'Access Restricted' })}</h2>
                        <p className="text-slate-500 mt-1 max-w-md">
                            {t('you_arent_assigned_to_this_section_ask', { defaultValue: "You aren't assigned to this section. Ask an administrator to grant you the matching permission in Access Management." })}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <h1 className="text-3xl font-outfit font-black text-[#511d29] tracking-tight">
                        {t('personnel_relations_department', { defaultValue: 'Personnel Relations Department' })}
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">
                        {t('manage_employee_lifecycles_contract_renewals_disciplinary', { defaultValue: 'Manage employee lifecycles, contract renewals, disciplinary procedures, offboarding, rewards, and performance metrics.' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-4 py-2 bg-[#f5ebd9] border border-[#511d29]/30 text-xs font-black text-[#511d29] uppercase tracking-widest">
                        {t('relations_center', { defaultValue: 'Relations Center' })}
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
                            <h3 className="font-outfit font-black text-lg text-[#511d29] uppercase">{t('employee_lifecycle_tracking', { defaultValue: 'Employee Lifecycle Tracking' })}</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                {t('tracks_the_entire_career_stages_of_all', { defaultValue: 'Tracks the entire career stages of all personnel from probation to active service status, transfers, and promotions.' })}
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
                                                {emp.enrollmentStatus === 'SEPARATED' ? (
                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border ${getLifecycleStatusStyle('Terminated')}`}>
                                                        Separated
                                                    </span>
                                                ) : (emp as any).enrollmentStatus === 'TRANSFERRED' ? (
                                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded border bg-[#aa7a51]/15 text-[#8f6544] border-[#aa7a51]/30"
                                                        title={(emp as any).transferredCompany ? `Transferred to ${(emp as any).transferredCompany}` : 'Transferred'}>
                                                        Transferred{(emp as any).transferredCompany ? ` → ${(emp as any).transferredCompany}` : ''}
                                                    </span>
                                                ) : (
                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border ${getLifecycleStatusStyle(emp.contractStatus)}`}>
                                                        {emp.contractStatus || 'Active'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">{emp.joinDate ? format(parseISO(emp.joinDate), 'yyyy-MM-dd') : 'N/A'}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => { setDetailEmp(emp); navigate(`/personnel-relations/lifecycle?employeeId=${emp.id}`); }}
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
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={openCreatePaf}
                                className="px-4 py-2 bg-[#511d29] text-white text-xs font-black uppercase tracking-widest hover:bg-[#3a151d] inline-flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Create Internal Transfer
                            </button>
                            <button
                                onClick={openCreateIc}
                                className="px-4 py-2 bg-[#aa7a51] text-white text-xs font-black uppercase tracking-widest hover:bg-[#8f6544] inline-flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" /> Create Inter-Company Transfer
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
                                        const isIc = paf.actionType === 'INTER_COMPANY_TRANSFER';
                                        const toName = isIc
                                            ? (paf.newCompany || paf.newDivisionName || paf.newDepartmentName || '—')
                                            : (units.find((u: any) => u.id === paf.newUnitId)?.name
                                                || departments.find((d: any) => d.id === paf.newDepartmentId)?.name
                                                || divisions.find((d: any) => d.id === paf.newDivisionId)?.name || '—');
                                        const fromName = paf.currentUnit || paf.currentDepartment || paf.currentDivision || '—';
                                        const badge = paf.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800'
                                            : paf.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
                                        return (
                                            <tr key={paf.id} className="hover:bg-slate-50/50">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-800">{paf.employee?.fullName || '—'}</p>
                                                    <p className="text-[10px] text-slate-500">
                                                        <span className={`inline-block mr-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${isIc ? 'bg-[#aa7a51]/15 text-[#8f6544]' : 'bg-[#511d29]/10 text-[#511d29]'}`}>
                                                            {isIc ? 'Inter-Company' : 'Internal'}
                                                        </span>
                                                        {paf.newPositionTitle || paf.typeOfTransfer || 'Transfer'}
                                                    </p>
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

            {activeTab === 'rewards' && <RewardsTab />}

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
                                    Incident Report → Notice to Explain → Investigation Result → Notice of Disciplinary Action.
                                    Any employee can file an incident report from the "Report an Incident" page.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDisciplinaryView('board')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${disciplinaryView === 'board' ? 'bg-red-700 text-white' : 'bg-white border border-red-700/20 text-red-700'}`}
                            >
                                Cases Board
                            </button>
                            <button
                                onClick={() => setDisciplinaryView('attendance')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${disciplinaryView === 'attendance' ? 'bg-red-700 text-white' : 'bg-white border border-red-700/20 text-red-700'}`}
                            >
                                Attendance Candidates
                            </button>
                        </div>
                    </div>

                    {disciplinaryView === 'board' && (
                        <>
                            {DISCIPLINARY_STAGE_COLUMNS.map(col => {
                                const cases = disciplinaryCases.filter(c => c.stage === col.key);
                                return (
                                    <div key={col.key} className="bg-white border border-red-700/10 rounded-xl overflow-hidden shadow-sm">
                                        <div className="p-3 border-b border-red-700/10 bg-red-50/20 flex items-center justify-between">
                                            <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">{col.label}</span>
                                            <span className="text-[10px] font-black text-red-700/60">{cases.length}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-red-700/5 text-red-700 uppercase font-black tracking-wider text-[10px] border-b border-red-700/10">
                                                        <th className="p-3">Case #</th>
                                                        <th className="p-3">Employee</th>
                                                        <th className="p-3">Category</th>
                                                        <th className="p-3">Source</th>
                                                        <th className="p-3"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                                    {cases.length === 0 && (
                                                        <tr><td colSpan={5} className="p-4 text-center text-slate-400">No cases</td></tr>
                                                    )}
                                                    {cases.map(c => (
                                                        <tr key={c.id} className="hover:bg-red-50/10">
                                                            <td className="p-3 text-slate-400">{c.caseNumber}</td>
                                                            <td className="p-3 font-bold">{c.employee?.fullName || '—'}</td>
                                                            <td className="p-3">
                                                                <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                                                                    !c.category ? 'bg-slate-100 text-slate-500' : c.category === 'MINOR' ? 'bg-amber-100 text-amber-800' : c.category === 'SERIOUS' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                    {c.category ? DISCIPLINARY_CATEGORY_LABELS[c.category as DisciplinaryCategory] : 'Pending Investigation'}
                                                                </span>
                                                            </td>
                                                            <td className="p-3">{c.source === 'SYSTEM_ATTENDANCE' ? 'Attendance' : 'Report'}</td>
                                                            <td className="p-3 text-right">
                                                                <button
                                                                    onClick={() => navigate(`/personnel-relations/disciplinary/${c.id}`)}
                                                                    className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-800"
                                                                >
                                                                    Details
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <button onClick={() => setShowClosedCases(v => !v)} className="w-full p-4 flex items-center justify-between text-left">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                        Closed Cases ({disciplinaryCases.filter(c => c.stage === 'CLOSED').length})
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showClosedCases ? 'rotate-180' : ''}`} />
                                </button>
                                {showClosedCases && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <tbody className="divide-y divide-slate-100">
                                                {disciplinaryCases.filter(c => c.stage === 'CLOSED').map(c => (
                                                    <tr key={c.id} className="hover:bg-slate-50/50">
                                                        <td className="p-3 px-4 text-slate-400">{c.caseNumber}</td>
                                                        <td className="p-3 px-4 font-bold text-slate-700">{c.employee?.fullName}</td>
                                                        <td className="p-3 px-4">
                                                            <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${c.closureReason ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                                {c.closureReason ? 'Dismissed' : 'Resolved'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 px-4 text-slate-400">{c.closedAt ? format(new Date(c.closedAt), 'dd MMM yyyy') : ''}</td>
                                                        <td className="p-3 px-4 text-right">
                                                            <button
                                                                onClick={() => navigate(`/personnel-relations/disciplinary/${c.id}`)}
                                                                className="px-3 py-1.5 bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800"
                                                            >
                                                                Details
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {disciplinaryCases.filter(c => c.stage === 'CLOSED').length === 0 && (
                                            <p className="text-center text-[11px] text-slate-400 py-4">No closed cases.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {disciplinaryView === 'attendance' && (
                        <div className="bg-white border border-red-700/10 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-red-700/10 bg-red-50/20 flex items-center justify-between gap-4">
                                <div>
                                    <span className="text-xs font-black text-red-700 uppercase tracking-wider">
                                        Attendance Candidates {attendanceCandidatesQuery.data ? `(${attendanceCandidatesQuery.data.cycleStart} → ${attendanceCandidatesQuery.data.cycleEnd})` : ''}
                                    </span>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Employees who triggered an attendance-based violation this cycle (5+ late arrivals, an unauthorized full-day absence, or 3+ consecutive unauthorized absent days). Nothing is executed automatically — review and execute per employee.
                                    </p>
                                </div>
                                <select
                                    value={attendanceMonth}
                                    onChange={e => setAttendanceMonth(e.target.value)}
                                    className="flex-shrink-0 px-3 py-2 text-xs font-bold border border-red-700/20 rounded-lg bg-white text-red-700"
                                >
                                    {attendanceMonthOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                    <thead>
                                        <tr className="bg-red-700/5 text-red-700 uppercase font-black tracking-wider text-[10px] border-b border-red-700/10">
                                            <th className="p-4">Employee</th>
                                            <th className="p-4">Violation</th>
                                            <th className="p-4">Detail</th>
                                            <th className="p-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-700/5 font-medium text-slate-700">
                                        {attendanceCandidatesQuery.isLoading && (
                                            <tr><td colSpan={4} className="p-6 text-center text-slate-400">Computing candidates…</td></tr>
                                        )}
                                        {!attendanceCandidatesQuery.isLoading && (attendanceCandidatesQuery.data?.candidates.length || 0) === 0 && (
                                            <tr><td colSpan={4} className="p-6 text-center text-slate-400">No employees currently meet any attendance-violation threshold.</td></tr>
                                        )}
                                        {attendanceCandidatesQuery.data?.candidates.map(cand => (
                                            <tr key={`${cand.employeeId}-${cand.violationId}`} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-bold">{cand.employeeName}{cand.staffId ? ` (${cand.staffId})` : ''}</td>
                                                <td className="p-4">{cand.violationLabel}</td>
                                                <td className="p-4">{cand.detail}</td>
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => handleExecuteAttendanceCase(cand.employeeId, cand.violationId)}
                                                        className="px-3 py-1.5 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-800"
                                                    >
                                                        Execute
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'offboarding' && (
                <div className="space-y-6">
                    <div className="bg-red-50 border-2 border-red-500/30 p-6 rounded-lg flex items-start gap-4">
                        <div className="w-12 h-12 bg-red-600 text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <ShieldAlert className="w-6 h-6 animate-pulse" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-outfit font-black text-lg text-red-700 uppercase">Payroll Withholding Notice</h3>
                            <p className="text-sm text-red-950 mt-1 font-bold">
                                Offboarding is directly connected with Payroll. The Company has the right to withhold the last payment of the employee without proper clearance and offboarding documentation.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsOffboardingModalOpen(true)}
                            className="flex-shrink-0 px-4 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#3a151d]"
                        >
                            Initiate Offboarding
                        </button>
                    </div>

                    {OFFBOARDING_STAGE_COLUMNS.map(col => {
                        const cases = offboardingCases.filter(c => c.stage === col.key);
                        return (
                            <div key={col.key} className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                                <div className="p-3 border-b border-[#511d29]/10 bg-red-50/20 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-[#511d29] uppercase tracking-wider">{col.label}</span>
                                    <span className="text-[10px] font-black text-[#511d29]/60">{cases.length}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                                <th className="p-3">Case #</th>
                                                <th className="p-3">Employee</th>
                                                <th className="p-3">Type</th>
                                                <th className="p-3">Source</th>
                                                <th className="p-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                            {cases.length === 0 && (
                                                <tr><td colSpan={5} className="p-4 text-center text-slate-400">No cases</td></tr>
                                            )}
                                            {cases.map(c => (
                                                <tr key={c.id} className="hover:bg-red-50/10">
                                                    <td className="p-3 text-slate-400">{c.caseNumber}</td>
                                                    <td className="p-3 font-bold">{c.employee?.fullName || '—'}</td>
                                                    <td className="p-3">{c.type === 'VOLUNTARY' ? 'Voluntary' : 'Involuntary'}</td>
                                                    <td className="p-3">{c.source.replace(/_/g, ' ')}</td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            onClick={() => navigate(`/personnel-relations/offboarding/${c.id}`)}
                                                            className="px-3 py-1.5 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#3a151d]"
                                                        >
                                                            Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <button onClick={() => setShowClosedOffboardingCases(v => !v)} className="w-full p-4 flex items-center justify-between text-left">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                Closed Cases ({offboardingCases.filter(c => c.stage === 'CLOSED').length})
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showClosedOffboardingCases ? 'rotate-180' : ''}`} />
                        </button>
                        {showClosedOffboardingCases && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <tbody className="divide-y divide-slate-100">
                                        {offboardingCases.filter(c => c.stage === 'CLOSED').map(c => (
                                            <tr key={c.id} className="hover:bg-slate-50/50">
                                                <td className="p-3 px-4 text-slate-400">{c.caseNumber}</td>
                                                <td className="p-3 px-4 font-bold text-slate-700">{c.employee?.fullName}</td>
                                                <td className="p-3 px-4 text-slate-400">{c.closedAt ? format(new Date(c.closedAt), 'dd MMM yyyy') : ''}</td>
                                                <td className="p-3 px-4 text-right">
                                                    <button
                                                        onClick={() => navigate(`/personnel-relations/offboarding/${c.id}`)}
                                                        className="px-3 py-1.5 bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800"
                                                    >
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {offboardingCases.filter(c => c.stage === 'CLOSED').length === 0 && (
                                    <p className="text-center text-[11px] text-slate-400 py-4">No closed cases.</p>
                                )}
                            </div>
                        )}
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

            {activeTab === 'employee-control' && (
                canAccess(currentUser, ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], ['view_employees', 'manage_employees']) ? (
                    <EmployeesPage minimal />
                ) : (
                    <div className="bg-white border border-[#511d29]/10 rounded-xl p-12 text-center text-slate-400">
                        You don't have permission to view employee control.
                    </div>
                )
            )}

            {activeTab === 'promotions' && (
                <div className="space-y-6">
                    {/* Intro */}
                    <div className="bg-[#f5ebd9]/30 border border-[#511d29]/20 p-6 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="w-12 h-12 bg-[#511d29] text-white flex items-center justify-center rounded-lg flex-shrink-0">
                            <Award className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-black text-[#511d29]">Promotion Management</h2>
                            <p className="text-slate-500 text-sm font-medium mt-0.5">
                                Track promotion-eligible employees and open a promotion case. Trainees and Interns become
                                eligible on tenure; every grade above that once its Evaluation Index reaches {EVALUATION_INDEX_THRESHOLD}.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsExceptionalPromotionModalOpen(true)}
                            className="flex-shrink-0 px-4 py-2 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#3a151d]"
                        >
                            Add Exceptional Promotion
                        </button>
                    </div>

                    {PROMOTION_STAGE_COLUMNS.map(col => {
                        const cases = promotionCases.filter(c => c.stage === col.key);
                        // Notice of Promotion is the intake stage (stage 1) — an eligible employee IS
                        // a Notice of Promotion candidate, so live candidates (no case opened yet) are
                        // listed alongside cases already at this stage rather than in a separate
                        // panel. getCandidates already excludes anyone with an open case, so there's
                        // no overlap to dedupe against `cases`.
                        const candidateRows = col.key === 'NOTICE_OF_PROMOTION' ? promotionCandidates : [];
                        const rowCount = cases.length + candidateRows.length;
                        return (
                            <div key={col.key} className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
                                <div className="p-3 border-b border-[#511d29]/10 bg-red-50/20 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-[#511d29] uppercase tracking-wider">{col.label}</span>
                                    <span className="text-[10px] font-black text-[#511d29]/60">{rowCount}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-[#511d29]/5 text-[#511d29] uppercase font-black tracking-wider text-[10px] border-b border-[#511d29]/10">
                                                <th className="p-3">Case #</th>
                                                <th className="p-3">Employee</th>
                                                <th className="p-3">Grade</th>
                                                <th className="p-3">Basis</th>
                                                <th className="p-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                            {rowCount === 0 && (
                                                <tr><td colSpan={5} className="p-4 text-center text-slate-400">No cases</td></tr>
                                            )}
                                            {cases.map(c => (
                                                <tr key={c.id} className="hover:bg-red-50/10">
                                                    <td className="p-3 text-slate-400">{c.caseNumber}</td>
                                                    <td className="p-3 font-bold">{c.employee?.fullName || '—'}</td>
                                                    <td className="p-3">{c.employee?.jobGrade || '—'} → {c.toGrade}</td>
                                                    <td className="p-3">{BASIS_LABELS[c.basis || ''] || c.basis || '—'}</td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            onClick={() => navigate(`/personnel-relations/promotions/${c.id}`)}
                                                            className="px-3 py-1.5 bg-[#511d29] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#3a151d]"
                                                        >
                                                            Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {candidateRows.map(cand => {
                                                const isTenure = cand.basis === 'TENURE';
                                                const progress = cand.progress as any;
                                                return (
                                                    <tr key={cand.employeeId} className="hover:bg-amber-50/30 bg-amber-50/10">
                                                        <td className="p-3 text-amber-600 font-bold uppercase text-[10px]">Eligible — no case yet</td>
                                                        <td className="p-3 font-bold">{cand.employee.fullName || '—'}</td>
                                                        <td className="p-3">{cand.employee.jobGrade || '—'} → {cand.toGrade}</td>
                                                        <td className="p-3">
                                                            {BASIS_LABELS[cand.basis] || cand.basis}
                                                            <span className="block text-[10px] text-slate-400 font-bold">
                                                                {isTenure ? `${progress.months} / ${progress.required} months` : `${progress.points.toFixed(2)} / ${progress.required}`}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <button
                                                                onClick={() => openCaseFromCandidate(cand.employeeId)}
                                                                className="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-700"
                                                            >
                                                                Details
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <button onClick={() => setShowClosedPromotionCases(v => !v)} className="w-full p-4 flex items-center justify-between text-left">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                Closed Cases ({promotionCases.filter(c => c.stage === 'CLOSED').length})
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showClosedPromotionCases ? 'rotate-180' : ''}`} />
                        </button>
                        {showClosedPromotionCases && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <tbody className="divide-y divide-slate-100">
                                        {promotionCases.filter(c => c.stage === 'CLOSED').map(c => (
                                            <tr key={c.id} className="hover:bg-slate-50/50">
                                                <td className="p-3 px-4 text-slate-400">{c.caseNumber}</td>
                                                <td className="p-3 px-4 font-bold text-slate-700">{c.employee?.fullName}</td>
                                                <td className="p-3 px-4 text-slate-500">Promoted to {c.toGrade}</td>
                                                <td className="p-3 px-4 text-slate-400">{c.closedAt ? format(new Date(c.closedAt), 'dd MMM yyyy') : ''}</td>
                                                <td className="p-3 px-4 text-right">
                                                    <button
                                                        onClick={() => navigate(`/personnel-relations/promotions/${c.id}`)}
                                                        className="px-3 py-1.5 bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800"
                                                    >
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {promotionCases.filter(c => c.stage === 'CLOSED').length === 0 && (
                                    <p className="text-center text-[11px] text-slate-400 py-4">No closed cases.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODALS */}
            {/* Modal 1: Create Internal Transfer (Personnel Action Form) */}
            <Modal isOpen={isActionFormModalOpen} onClose={() => setIsActionFormModalOpen(false)} title="Create Internal Transfer" maxWidth="max-w-xl">
                <form onSubmit={handleActionFormSubmit} className="space-y-5 text-xs font-semibold text-slate-700">
                    <p className="flex items-start gap-2 text-[11px] font-medium text-slate-500 leading-relaxed">
                        <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-[#511d29]" />
                        Move an employee into a new position. The transfer starts as a draft form for review and signature before it takes effect.
                    </p>

                    {/* Section: Employee */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[#511d29] font-black uppercase text-[10px] tracking-wide">
                            <User className="w-3.5 h-3.5" /> Employee <span className="text-red-500">*</span>
                        </label>
                        <SearchSelect
                            value={pafForm.employeeId}
                            onChange={(v) => setPafForm(prev => ({ ...prev, employeeId: v }))}
                            placeholder="— Select employee —"
                            emptyText="No employees match"
                            options={[...employees]
                                .sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || ''))
                                .map((e: any) => ({ value: e.id, label: e.fullName || '—', sub: e.staffId || undefined }))}
                        />
                    </div>

                    {/* Section: Target Position — grouped in a subtle card */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                        <label className="flex items-center gap-1.5 text-[#511d29] font-black uppercase text-[10px] tracking-wide">
                            <Briefcase className="w-3.5 h-3.5" /> Target Position — Job Description <span className="text-red-500">*</span>
                        </label>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Filter by directorate / division / office</span>
                            <select value={pafJdScope} onChange={e => setPafJdScope(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none transition focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15">
                                <option value="">All directorates / divisions / offices</option>
                                <optgroup label="Directorates">
                                    {[...directorates].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((d: any) => (
                                        <option key={`dir-${d.id}`} value={`dir:${d.id}`}>{d.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Divisions">
                                    {[...divisions].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((d: any) => (
                                        <option key={`div-${d.id}`} value={`div:${d.id}`}>{d.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Offices">
                                    {(departments as any[]).filter((d: any) => d.isOffice)
                                        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((d: any) => (
                                            <option key={`off-${d.id}`} value={`off:${d.id}`}>{d.name}</option>
                                        ))}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Position to move into</span>
                            <SearchSelect
                                value={pafForm.newJobDescriptionId}
                                onChange={selectJd}
                                placeholder="— Select the position to move into —"
                                emptyText="No positions match this filter/search"
                                options={(jobDescriptions as any[])
                                    .filter((j) => {
                                        if (!pafJdScope) return true;
                                        const [type, id] = pafJdScope.split(':');
                                        if (type === 'dir') return jdDirectorateId(j) === id;
                                        if (type === 'div') return jdDivisionId(j) === id;
                                        if (type === 'off') return jdDepartmentId(j) === id;
                                        return true;
                                    })
                                    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
                                    .map((j) => ({
                                        value: j.id,
                                        label: j.title || 'Untitled',
                                        group: departments.find((d: any) => d.id === jdDepartmentId(j))?.name || 'Division-level (no department)',
                                    }))}
                            />
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 leading-relaxed">The new division / department / unit / position / category come from the selected Job Description. On accept the employee is assigned to it.</p>
                    </div>

                    {(() => {
                        const jd = (jobDescriptions as any[]).find(j => j.id === pafForm.newJobDescriptionId);
                        const cats: string[] = Array.isArray(jd?.jobCategories) ? jd.jobCategories : [];
                        if (cats.length <= 1) return null; // single (or no) category — nothing to choose.
                        return (
                            <div className="space-y-1.5">
                                <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">Job Category <span className="text-red-500">*</span></label>
                                <select value={pafForm.newJobCategory} onChange={e => setPafForm({ ...pafForm, newJobCategory: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none transition focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15">
                                    <option value="">— Select a job category —</option>
                                    {cats.map((c) => (<option key={c} value={c}>{c}</option>))}
                                </select>
                                <p className="text-[10px] font-medium text-slate-400">This Job Description covers several categories — pick the one for this transfer.</p>
                            </div>
                        );
                    })()}

                    {/* Section: Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[#511d29] font-black uppercase text-[10px] tracking-wide">
                                <CalendarDays className="w-3.5 h-3.5" /> Effectivity Date
                            </label>
                            <input type="date" value={pafForm.effectiveDate} onChange={e => setPafForm({ ...pafForm, effectiveDate: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none transition focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">New Job Grade</label>
                            {(() => {
                                const cur: any = (employees as any[]).find(e => e.id === pafForm.employeeId);
                                return (
                                    <select value={pafForm.newJobGrade} onChange={e => setPafForm({ ...pafForm, newJobGrade: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none transition focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15">
                                        <option value="">{cur?.jobGrade ? `Same grade (${cur.jobGrade})` : 'Same as current grade'}</option>
                                        {JOB_GRADES.filter(g => g !== cur?.jobGrade).map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">Reports To</label>
                        <input type="text" value={pafForm.reportsTo} placeholder="Head of the selected position (auto-filled)" onChange={e => setPafForm({ ...pafForm, reportsTo: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">Type of Transfer <span className="text-slate-400 font-bold normal-case">/ نوع الانتقال</span></label>
                        <select value={pafForm.typeOfTransfer} onChange={e => setPafForm({ ...pafForm, typeOfTransfer: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none transition focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15">
                            <option value="">— Select —</option>
                            <option value="Lateral transfer">Lateral transfer / نقل على نفس الدرجة</option>
                            <option value="Promotion">Promotion / ترقية</option>
                        </select>
                    </div>

                    <button type="submit" disabled={pafSubmitting}
                        className="w-full py-3.5 rounded-xl bg-[#511d29] text-white font-black uppercase tracking-widest shadow-sm hover:bg-[#3a151d] disabled:opacity-60 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-2">
                        {pafSubmitting ? 'Creating…' : (<><Plus className="w-4 h-4" /> Create Transfer Form</>)}
                    </button>
                </form>
            </Modal>

            {/* Modal 1c: Create Inter-Company Transfer (free-text destination + factors) */}
            <Modal isOpen={isIcModalOpen} onClose={() => setIsIcModalOpen(false)} title="Create Inter-Company Transfer" maxWidth="max-w-xl">
                <form onSubmit={handleIcSubmit} className="space-y-5 text-xs font-semibold text-slate-700">
                    <p className="flex items-start gap-2 text-[11px] font-medium text-slate-500 leading-relaxed">
                        <ExternalLink className="w-4 h-4 mt-0.5 shrink-0 text-[#aa7a51]" />
                        Transfer an employee to another company. Fill the new placement (free text), generate the form for signatures, upload the signed copy, then accept — the employee becomes <b>Transferred</b> (data kept, remains in attendance, excluded from evaluation &amp; payroll).
                    </p>

                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[#511d29] font-black uppercase text-[10px] tracking-wide">
                            <User className="w-3.5 h-3.5" /> Employee <span className="text-red-500">*</span>
                        </label>
                        <SearchSelect
                            value={icForm.employeeId}
                            onChange={(v) => setIcForm(prev => ({ ...prev, employeeId: v }))}
                            placeholder="— Select employee —"
                            emptyText="No employees match"
                            options={[...employees]
                                .sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || ''))
                                .map((e: any) => ({ value: e.id, label: e.fullName || '—', sub: e.staffId || undefined }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">New Company <span className="text-red-500">*</span> <span className="text-slate-400 font-bold normal-case">/ الشركة الجديدة</span></label>
                        <input type="text" value={icForm.newCompany} onChange={e => setIcForm({ ...icForm, newCompany: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {([
                            ['newDivisionName', 'New Division', 'الادارة الجديدة'],
                            ['newDepartmentName', 'New Department', 'القسم الجديد'],
                            ['newUnitName', 'New Unit', 'الوحدة الجديدة'],
                            ['newPositionTitle', 'New Position Title', 'المسمى الوظيفي الجديد'],
                            ['newJobCategory', 'New Job Category', 'الفئة الوظيفة الجديدة'],
                            ['newJobGrade', 'New Job Grade', 'درجة الوظيفة الجديدة'],
                            ['reportsTo', 'Reports To', 'يقدم تقريره الي'],
                            ['newPlaceOfWork', 'Place of Work', 'مكان العمل'],
                        ] as const).map(([key, en, ar]) => (
                            <div key={key} className="space-y-1.5">
                                <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">{en} <span className="text-slate-400 font-bold normal-case">/ {ar}</span></label>
                                <input type="text" value={(icForm as any)[key]} onChange={e => setIcForm({ ...icForm, [key]: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15" />
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {([
                            ['englishFactor', 'English Factor', 'علاوة اللغة'],
                            ['positionFactor', 'Factor for Position', 'علاوه وظيفة'],
                            ['locationFactor', 'Factor for Location / Frontline', 'عامل الموقع/الخط الأمامي'],
                            ['skillFactor', 'Skill Factor', 'عامل المهارة'],
                        ] as const).map(([key, en, ar]) => (
                            <div key={key} className="space-y-1.5">
                                <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">{en} <span className="text-slate-400 font-bold normal-case">/ {ar}</span></label>
                                <input type="number" step="0.01" value={(icForm as any)[key]} onChange={e => setIcForm({ ...icForm, [key]: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15" />
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">Type of Transfer <span className="text-slate-400 font-bold normal-case">/ نوع الانتقال</span></label>
                            <select value={icForm.typeOfTransfer} onChange={e => setIcForm({ ...icForm, typeOfTransfer: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15">
                                <option value="">— Select —</option>
                                <option value="Lateral transfer">Lateral transfer / نقل على نفس الدرجة</option>
                                <option value="Promotion">Promotion / ترقية</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[#511d29] font-black uppercase text-[10px] tracking-wide">Effectivity Date <span className="text-slate-400 font-bold normal-case">/ تاريخ السريان</span></label>
                            <input type="date" value={icForm.effectiveDate} onChange={e => setIcForm({ ...icForm, effectiveDate: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15" />
                        </div>
                    </div>

                    <button type="submit" disabled={icSubmitting}
                        className="w-full py-3.5 rounded-xl bg-[#aa7a51] text-white font-black uppercase tracking-widest shadow-sm hover:bg-[#8f6544] disabled:opacity-60 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-2">
                        {icSubmitting ? 'Creating…' : (<><Plus className="w-4 h-4" /> Create Inter-Company Transfer</>)}
                    </button>
                </form>
            </Modal>

            {/* Modal 1b: Upload signed form + Accept/Reject */}
            <Modal isOpen={!!decidePaf} onClose={() => { setDecidePaf(null); setDecideFile(null); setDecideNewCompany(''); }} title="Personnel Action — Decision" maxWidth="max-w-md">
                <div className="space-y-4 text-xs font-semibold text-slate-700">
                    <p className="text-slate-500">Employee: <span className="font-black text-[#511d29]">{decidePaf?.employee?.fullName}</span></p>
                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Signed Form <span className="text-red-500">*</span></label>
                        <input type="file" accept=".pdf,.doc,.docx,image/*"
                            onChange={e => setDecideFile(e.target.files?.[0] || null)}
                            className="w-full p-2 border border-[#511d29]/20 bg-white text-slate-600" />
                        {decideFile && <p className="text-[10px] text-emerald-600 mt-1 font-bold">{decideFile.name}</p>}
                    </div>
                    {decidePaf?.actionType === 'INTER_COMPANY_TRANSFER' && (
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">New Company <span className="text-red-500">*</span></label>
                            <input type="text" placeholder="Company the employee is transferring to"
                                value={decideNewCompany || decidePaf?.newCompany || ''}
                                onChange={e => setDecideNewCompany(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-[#511d29] focus:ring-2 focus:ring-[#511d29]/15" />
                        </div>
                    )}
                    <div className="bg-amber-50/60 border border-amber-200 p-2.5 rounded text-[10px] text-amber-900/90 leading-relaxed">
                        {decidePaf?.actionType === 'INTER_COMPANY_TRANSFER'
                            ? 'Accepting marks the employee as Transferred to the new company: their data is kept and stays visible, and they remain in attendance, but they are excluded from evaluation and payroll. The signed form is filed to their Lifecycle documents.'
                            : 'Accepting will move the employee into the target Job Description (division/department/unit/position/category) and file the signed form to their Lifecycle documents. Blocked if the JD is above its staffing plan.'}
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
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Signed Contract <span className="text-red-500">*</span></label>
                        <input type="file" accept=".pdf,.doc,.docx,image/*"
                            onChange={e => setRenewFile(e.target.files?.[0] || null)}
                            className="w-full p-2 border border-[#511d29]/20 bg-white text-slate-600" />
                        {renewFile && <p className="text-[10px] text-emerald-600 mt-1 font-bold">{renewFile.name}</p>}
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

            {/* Modal 5: Offboarding Log */}
            <Modal isOpen={isOffboardingModalOpen} onClose={() => setIsOffboardingModalOpen(false)} title="Initiate Offboarding Manually" maxWidth="max-w-md">
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!involuntaryEmployee) return toast.error(t('select_the_employee_from_the_suggestions', { defaultValue: 'Select the employee from the suggestions.' }));
                        try {
                            const created = await offboardingService.createManualCase({
                                employeeId: involuntaryEmployee.id, source: involuntarySource,
                                reason: involuntaryReason || undefined, dateOfSeparation: involuntaryDate || undefined,
                            });
                            const startedAt = involuntarySource === 'EMPLOYEE_RESIGNATION' ? t('resignation_request', { defaultValue: 'Resignation Request' }) : t('clearance', { defaultValue: 'Clearance' });
                            toast.success(t('offboarding_case_casenumber_opened_at_stage', { defaultValue: 'Offboarding case {{caseNumber}} opened at {{stage}}.', caseNumber: created.caseNumber, stage: startedAt }));
                            setIsOffboardingModalOpen(false);
                            setInvoluntaryEmployeeQuery(''); setInvoluntaryEmployee(null); setInvoluntaryReason(''); setInvoluntaryDate('');
                            queryClient.invalidateQueries({ queryKey: ['offboarding-cases'] });
                        } catch (err: any) {
                            toast.error(err?.response?.data?.error || t('failed_to_create_the_offboarding_case', { defaultValue: 'Failed to create the offboarding case.' }));
                        }
                    }}
                    className="space-y-4 text-xs font-semibold text-slate-700"
                >
                    <p className="text-[10px] text-slate-400 font-normal normal-case">
                        Use this only when the case didn't come through its own dedicated path — a disciplinary
                        action reaching Termination, or the employee's own Resignation Request page — already
                        open their offboarding case automatically.
                    </p>
                    <div className="relative">
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Select Employee</label>
                        <input
                            type="text"
                            value={involuntaryEmployeeQuery}
                            onChange={e => handleInvoluntaryEmployeeChange(e.target.value)}
                            onFocus={() => setShowInvoluntarySuggestions(true)}
                            onBlur={() => { involuntaryBlurTimeout.current = window.setTimeout(() => setShowInvoluntarySuggestions(false), 150); }}
                            placeholder="Start typing the employee's name…"
                            className="w-full p-2 border border-[#511d29]/20 bg-white font-normal normal-case"
                            autoComplete="off"
                        />
                        {showInvoluntarySuggestions && involuntarySuggestions.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full bg-white border border-[#511d29]/20 rounded shadow-md max-h-56 overflow-auto">
                                {involuntarySuggestions.map((emp: any) => (
                                    <li key={emp.id}>
                                        <button
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => selectInvoluntaryEmployee(emp)}
                                            className="w-full text-left px-3 py-2 text-xs font-normal normal-case hover:bg-slate-50"
                                        >
                                            {emp.fullName}{emp.staffId ? ` (${emp.staffId})` : ''}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Reason</label>
                        <select value={involuntarySource} onChange={e => setInvoluntarySource(e.target.value as typeof involuntarySource)} className="w-full p-2 border border-[#511d29]/20 bg-white">
                            <option value="TERMINATION">Termination</option>
                            <option value="EMPLOYEE_RESIGNATION">Resignation</option>
                            <option value="CONTRACT_NON_RENEWAL_COMPANY">Contract Non-Renewal (by Company)</option>
                            <option value="CONTRACT_NON_RENEWAL_EMPLOYEE">Contract Non-Renewal (by Employee)</option>
                        </select>
                    </div>

                    {involuntarySource !== 'EMPLOYEE_RESIGNATION' && (
                        <div>
                            <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Date of separation</label>
                            <input type="date" value={involuntaryDate} onChange={e => setInvoluntaryDate(e.target.value)} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                        </div>
                    )}

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Notes (optional)</label>
                        <textarea value={involuntaryReason} onChange={e => setInvoluntaryReason(e.target.value)} rows={2} className="w-full p-2 border border-[#511d29]/20 bg-white" />
                    </div>

                    <div className="bg-red-50 p-3 border border-red-200 text-[10px] text-red-700 font-bold uppercase">
                        ⚠️ Note: Last payment withholding will be automatically flagged in Payroll until all clearance items are complete.
                    </div>

                    <button type="submit" className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest hover:bg-[#3a151d]">
                        Initialize Offboarding
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isExceptionalPromotionModalOpen} onClose={() => setIsExceptionalPromotionModalOpen(false)} title="Add Exceptional Promotion" maxWidth="max-w-md">
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!exceptionalEmployee) return toast.error(t('select_the_employee_from_the_suggestions', { defaultValue: 'Select the employee from the suggestions.' }));
                        if (!exceptionalToGrade) return toast.error(t('select_the_target_job_grade', { defaultValue: 'Select the target job grade.' }));
                        try {
                            const created = await promotionService.createExceptional({
                                employeeId: exceptionalEmployee.id, toGrade: exceptionalToGrade,
                            });
                            toast.success(t('promotion_case_opened_at_promotion_report', { defaultValue: 'Promotion case {{caseNumber}} opened at Promotion Report.', caseNumber: created.caseNumber }));
                            setIsExceptionalPromotionModalOpen(false);
                            setExceptionalEmployeeQuery(''); setExceptionalEmployee(null); setExceptionalToGrade('');
                            queryClient.invalidateQueries({ queryKey: ['promotion-cases'] });
                            navigate(`/personnel-relations/promotions/${created.id}`);
                        } catch (err: any) {
                            toast.error(err?.response?.data?.error || t('failed_to_create_the_exceptional_promotion', { defaultValue: 'Failed to create the exceptional promotion.' }));
                        }
                    }}
                    className="space-y-4 text-xs font-semibold text-slate-700"
                >
                    <p className="text-[10px] text-slate-400 font-normal normal-case">
                        Use this to promote an employee outside the normal tenure/Evaluation Index eligibility rules.
                        The case skips straight to Promotion Report.
                    </p>
                    <div className="relative">
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Select Employee</label>
                        <input
                            type="text"
                            value={exceptionalEmployeeQuery}
                            onChange={e => handleExceptionalEmployeeChange(e.target.value)}
                            onFocus={() => setShowExceptionalSuggestions(true)}
                            onBlur={() => { exceptionalBlurTimeout.current = window.setTimeout(() => setShowExceptionalSuggestions(false), 150); }}
                            placeholder="Start typing the employee's name…"
                            className="w-full p-2 border border-[#511d29]/20 bg-white font-normal normal-case"
                            autoComplete="off"
                        />
                        {showExceptionalSuggestions && exceptionalSuggestions.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full bg-white border border-[#511d29]/20 rounded shadow-md max-h-56 overflow-auto">
                                {exceptionalSuggestions.map((emp: any) => (
                                    <li key={emp.id}>
                                        <button
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => selectExceptionalEmployee(emp)}
                                            className="w-full text-left px-3 py-2 text-xs font-normal normal-case hover:bg-slate-50"
                                        >
                                            {emp.fullName}{emp.staffId ? ` (${emp.staffId})` : ''}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <label className="block text-[#511d29] font-black uppercase text-[10px] mb-1">Target Job Grade</label>
                        <select
                            value={exceptionalToGrade}
                            onChange={e => setExceptionalToGrade(e.target.value)}
                            disabled={!exceptionalEmployee}
                            className="w-full p-2 border border-[#511d29]/20 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                        >
                            <option value="">— Select grade —</option>
                            {exceptionalEmployee && JOB_GRADES
                                .filter((g, idx) => idx > JOB_GRADES.indexOf(exceptionalEmployee.jobGrade))
                                .map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    <button type="submit" className="w-full py-3 bg-[#511d29] text-white font-black uppercase tracking-widest hover:bg-[#3a151d]">
                        Create Exceptional Promotion
                    </button>
                </form>
            </Modal>

            {/* Employee Lifecycle — Full read-only detail view */}
            <Modal
                isOpen={!!detailEmp}
                onClose={() => {
                    setDetailEmp(null);
                    // Drop the ?employeeId= deep-link param on explicit close so a later browser Back
                    // doesn't re-open this record. (Navigating away to a case page keeps the param, so
                    // returning re-opens the detail view — that is the desired back behaviour.)
                    if (new URLSearchParams(location.search).get('employeeId')) {
                        navigate('/personnel-relations/lifecycle', { replace: true });
                    }
                }}
                title={detailEmp ? `${detailEmp.fullName}${detailEmp.staffId ? ' · ' + detailEmp.staffId : ''}` : ''}
                fullScreen
                fullScreenWidth="max-w-7xl"
            >
                {detailEmp && (() => {
                    const emp = detailEmp;
                    const fmt = (d?: string) => d ? format(parseISO(d), 'dd MMM yyyy') : '—';
                    const num = (x: any) => Number(x) || 0;
                    // remainingHolidays comes straight from the API (calculateHolidayMetrics server-side,
                    // computed live from contractStartDate/bonusHolidays/holidaysUsed) — not a stored column.
                    const paidRemaining = num((emp as any).remainingHolidays);
                    const unpaidTaken = num(emp.unpaidHolidaysUsed);
                    // Emergency leave is a fixed 3 days per contract, depletion-only, reset at renewal —
                    // no bonus/carry-over concept applies here (unlike paid leave).
                    const emergTaken = num(emp.emergencyHolidaysUsed);
                    // Only show the identity/contact/bank/document fields this employee's contract
                    // type actually collects — same Resident / Direct Non-Resident / Service Provider
                    // split used on the onboarding review screen.
                    const showField = makeFieldVisibility(emp.contractType);

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
                    const uploadedDocsCount = docs.filter(d => emp[d.k as keyof Employee]).length;

                    // Resolve a transfer's target org unit id (division/department/unit) to its name
                    // from the org lists this page already fetches — PersonnelActionForm stores ids
                    // only for the new placement, no server-side join.
                    const nameOfOrgUnit = (list: any[], id?: string | null): string | null =>
                        id ? (list.find((x: any) => x.id === id)?.name || null) : null;

                    // Which raw evaluation record backs a given evaluator level, from one month's
                    // slice of the employee's evaluation history (already fetched in bulk).
                    const pickLevelRecord = (level: EvalLevel | undefined, monthSlice: EvaluationHistoryMonth): any => {
                        if (!level) return null;
                        switch (level) {
                            case 'UNIT': return monthSlice.unit || null;
                            case 'DEPARTMENT': return monthSlice.department || null;
                            case 'DIVISION': return monthSlice.division || null;
                            case 'DIRECTOR': return monthSlice.director || null;
                            case 'GM': return monthSlice.gm || null;
                            case 'CHAIRMAN': return monthSlice.chairman || null;
                        }
                    };

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
                                            {emp.enrollmentStatus === 'SEPARATED' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-rose-500/20 border-rose-300/30 text-rose-50">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />Separated
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${emp.contractStatus === 'Active' || !emp.contractStatus ? 'bg-emerald-400/20 border-emerald-300/30 text-emerald-50' : 'bg-white/10 border-white/15 text-white/80'}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />{emp.contractStatus || 'Active'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleGenerateSummary(emp)}
                                        disabled={summaryBusy === emp.id}
                                        title="Download a one-page summary (profile, attendance, last evaluation, leave balances) on the IPH letterhead"
                                        className="self-start shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white font-black text-[11px] uppercase tracking-widest hover:bg-white/25 transition-colors disabled:opacity-50 backdrop-blur-sm"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {summaryBusy === emp.id ? 'Generating…' : 'Extract Summary (Word)'}
                                    </button>
                                </div>
                            </div>

                            {emp.enrollmentStatus === 'SEPARATED' && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                                    <div className="flex items-center gap-2 font-black text-rose-700 uppercase text-xs tracking-widest">
                                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Separation Details
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-black uppercase text-rose-400">Separation Date</span>
                                        <span className="font-bold text-rose-800">{emp.separationDate ? format(parseISO(emp.separationDate), 'dd MMM yyyy') : '—'}</span>
                                    </div>
                                    {detailSeparationCase && (
                                        <>
                                            <div>
                                                <span className="block text-[10px] font-black uppercase text-rose-400">Reason</span>
                                                <span className="font-bold text-rose-800">{OFFBOARDING_SOURCE_LABELS[detailSeparationCase.source] || detailSeparationCase.source}</span>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/personnel-relations/offboarding/${detailSeparationCase.id}`)}
                                                className="ml-auto text-rose-700 hover:underline font-black text-xs uppercase tracking-wider"
                                            >
                                                View Offboarding Case ({detailSeparationCase.caseNumber}) →
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* The information tree — one collapsible branch per category, file-explorer
                                style. See TreeBranch/expandedNodes above for how expand state works. */}
                            <div className="space-y-2">
                                <TreeBranch isOpen={expandedNodes.has('personal')} onToggle={() => toggleNode('personal')} icon={User} title="Personal Information" color="bg-indigo-50 text-indigo-600">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                        {showField('gender') && <Field emp={emp} label="Gender" k="gender" />}
                                        <Field emp={emp} label="Date of Birth" k="dateOfBirth" type="date" />
                                        <Field emp={emp} label="Place of Birth" k="placeOfBirth" />
                                        {showField('placeOfBirthArabic') && <Field emp={emp} label="Place of Birth (Arabic)" k="placeOfBirthArabic" dir="rtl" />}
                                        <Field emp={emp} label="Nationality" k="nationality" />
                                        {showField('nationalityArabic') && <Field emp={emp} label="Nationality (Arabic)" k="nationalityArabic" dir="rtl" />}
                                        {showField('nationalId') && <Field emp={emp} label="National ID" k="nationalId" />}
                                        <Field emp={emp} label="Blood Type" k="bloodType" />
                                        <Field emp={emp} label="Academic Qualification" k="academicQualification" />
                                        {showField('academicQualificationArabic') && <Field emp={emp} label="Academic Qualification (Arabic)" k="academicQualificationArabic" dir="rtl" />}
                                    </div>
                                </TreeBranch>

                                <TreeBranch isOpen={expandedNodes.has('identity')} onToggle={() => toggleNode('identity')} icon={CreditCard} title="Identity & Documents" color="bg-teal-50 text-teal-600">
                                    <div className="space-y-2">
                                        <TreeBranch isOpen={expandedNodes.has('identity.idpassport')} onToggle={() => toggleNode('identity.idpassport')} level={1} icon={CreditCard} title="ID, Passport & License" color="bg-teal-50 text-teal-600">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                                {showField('idCardNumber') && <Field emp={emp} label="ID Card Number" k="idCardNumber" />}
                                                {showField('idPlaceOfIssue') && <Field emp={emp} label="ID Place of Issue" k="idPlaceOfIssue" />}
                                                {showField('idPlaceOfIssueArabic') && <Field emp={emp} label="ID Place of Issue (Arabic)" k="idPlaceOfIssueArabic" dir="rtl" />}
                                                {showField('idIssueDate') && <Field emp={emp} label="ID Issue Date" k="idIssueDate" type="date" />}
                                                <Field emp={emp} label="Passport Number" k="passportNumber" />
                                                {showField('passportPlaceOfIssue') && <Field emp={emp} label="Passport Place of Issue" k="passportPlaceOfIssue" />}
                                                {showField('passportPlaceOfIssueArabic') && <Field emp={emp} label="Passport Place of Issue (Arabic)" k="passportPlaceOfIssueArabic" dir="rtl" />}
                                                <Field emp={emp} label="Passport Expiry" k="passportExpiryDate" type="date" />
                                                {showField('drivingLicenseType') && <Field emp={emp} label="License Type" k="drivingLicenseType" />}
                                                {showField('drivingLicenseTypeArabic') && <Field emp={emp} label="License Type (Arabic)" k="drivingLicenseTypeArabic" dir="rtl" />}
                                                {showField('drivingLicenseNumber') && <Field emp={emp} label="License Number" k="drivingLicenseNumber" />}
                                                {showField('drivingLicenseExpiry') && <Field emp={emp} label="License Expiry" k="drivingLicenseExpiry" type="date" />}
                                                {showField('drivingLicensePlaceOfIssue') && <Field emp={emp} label="License Place of Issue" k="drivingLicensePlaceOfIssue" />}
                                                {showField('drivingLicensePlaceOfIssueArabic') && <Field emp={emp} label="License Place of Issue (Arabic)" k="drivingLicensePlaceOfIssueArabic" dir="rtl" />}
                                            </div>
                                        </TreeBranch>

                                        <TreeBranch isOpen={expandedNodes.has('identity.documents')} onToggle={() => toggleNode('identity.documents')} level={1} icon={Paperclip} title="Documents & Attachments" color="bg-indigo-50 text-indigo-600" count={`${uploadedDocsCount}/${docs.length}`}>
                                            <div className="space-y-2">
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
                                            </div>
                                        </TreeBranch>

                                        {/* Always rendered now (was HR-only-or-non-empty before) — an empty branch is
                                            still a branch. Non-HR viewers still never fetch this list (query stays
                                            isHRRole-gated below), so they just see the empty state either way. */}
                                        <TreeBranch isOpen={expandedNodes.has('identity.additional')} onToggle={() => toggleNode('identity.additional')} level={1} icon={FileText} title="Additional Documents" color="bg-cyan-50 text-cyan-600" count={employeeDocuments.length}>
                                            <div className="space-y-3">
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
                                        </TreeBranch>
                                    </div>
                                </TreeBranch>

                                <TreeBranch isOpen={expandedNodes.has('contact')} onToggle={() => toggleNode('contact')} icon={Phone} title="Contact & Address" color="bg-emerald-50 text-emerald-600">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                        <Field emp={emp} label="Personal Phone" k="personalPhone" />
                                        <Field emp={emp} label="Personal E-mail" k="personalEmail" />
                                        <Field emp={emp} label="Login Email" k="email" />
                                        <Field emp={emp} label="Emergency Contact" k="emergencyContactNumber" />
                                        <Field emp={emp} label="Residential Address" k="residentialAddress" />
                                        {showField('residentialAddressArabic') && <Field emp={emp} label="Residential Address (Arabic)" k="residentialAddressArabic" dir="rtl" />}
                                    </div>
                                </TreeBranch>

                                <TreeBranch isOpen={expandedNodes.has('employment')} onToggle={() => toggleNode('employment')} icon={Briefcase} title="Employment & Career History" color="bg-blue-50 text-blue-600">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                            <Row label="Role" value={emp.role} />
                                            <Row label="Enrollment Status" value={emp.enrollmentStatus || 'ACTIVE'} />
                                            <Field emp={emp} label="Position" k="position" />
                                            <Field emp={emp} label="Place of Work" k="placeOfWork" />
                                            <Field emp={emp} label="Job Category" k="jobCategory" />
                                            <Field emp={emp} label="Job Grade" k="jobGrade" />
                                            <Field emp={emp} label="Contract Type" k="contractType" />
                                            <Field emp={emp} label="Status" k="contractStatus" />
                                            <Row label="In Current Grade Since" value={fmt(emp.currentGradeSince)} />
                                            <Row label="Join Date" value={fmt(firstContractStartDate)} />
                                            <Field emp={emp} label="Contract Start" k="contractStartDate" type="date" />
                                            <Field emp={emp} label="Contract End" k="contractEndDate" type="date" />
                                            <Field emp={emp} label="Worked Before?" k="workedBefore" />
                                            {showField('hasRelativesInCompany') && <Field emp={emp} label="Relatives in Company?" k="hasRelativesInCompany" />}
                                            {showField('hasRelativesInCompany') && emp.hasRelativesInCompany === 'Yes' && <Field emp={emp} label="Relatives' Names" k="relativesNames" />}
                                            {showField('hasRelativesInCompany') && emp.hasRelativesInCompany === 'Yes' && showField('relativesNamesArabic') && <Field emp={emp} label="Relatives' Names (Arabic)" k="relativesNamesArabic" dir="rtl" />}
                                            <Row label="Directorate" value={nameOfOrgUnit(directorates, emp.directorateId)} />
                                            <Row label="Division" value={nameOfOrgUnit(divisions, emp.divisionId)} />
                                            <Row label="Department" value={nameOfOrgUnit(departments, emp.departmentId)} />
                                            <Row label="Unit" value={nameOfOrgUnit(units, emp.unitId)} />
                                            <Row label="Login Account" value={emp.userId ? 'Yes' : 'No'} />
                                        </div>

                                        {(showField('serviceProviderCompany') || showField('employeeTravelDate') || showField('employeeStartDate')) && (emp.serviceProviderCompany || emp.employeeTravelDate || emp.employeeStartDate) && (
                                            <TreeBranch isOpen={expandedNodes.has('employment.onboarding')} onToggle={() => toggleNode('employment.onboarding')} level={1} icon={Building2} title="Onboarding Submission Details" color="bg-cyan-50 text-cyan-600">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                                    <Field emp={emp} label="Service Provider Company" k="serviceProviderCompany" />
                                                    <Field emp={emp} label="Travel Date" k="employeeTravelDate" type="date" />
                                                    <Field emp={emp} label="Employee Start Date" k="employeeStartDate" type="date" />
                                                </div>
                                            </TreeBranch>
                                        )}

                                        <TreeBranch isOpen={expandedNodes.has('employment.jobdescription')} onToggle={() => toggleNode('employment.jobdescription')} level={1} icon={Building2} title="Assigned Job Description" color="bg-indigo-50 text-indigo-600">
                                            {(detailFull as any)?.jobDescription ? (
                                                <JobDescriptionView jd={(detailFull as any).jobDescription} accent="text-[#511d29]" />
                                            ) : (
                                                <div className="text-sm font-bold text-slate-300">No job description assigned.</div>
                                            )}
                                        </TreeBranch>

                                        {/* Every renewal archives the old contract and adds a new one, so a
                                            renewed employee shows Contract 1 (archived) + Contract 2 (active). */}
                                        <TreeBranch isOpen={expandedNodes.has('employment.contracts')} onToggle={() => toggleNode('employment.contracts')} level={1} icon={FileText} title="Contract History" color="bg-rose-50 text-rose-600" count={detailContracts.length}>
                                            {detailContracts.length === 0 ? (
                                                <div className="text-sm font-bold text-slate-300">No contract records yet.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {[...detailContracts]
                                                        .sort((a, b) => {
                                                            const sa = new Date(a.startDate || a.createdAt).getTime();
                                                            const sb = new Date(b.startDate || b.createdAt).getTime();
                                                            return sa - sb;
                                                        })
                                                        .map((c, i) => (
                                                            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <span className="w-7 h-7 rounded-lg bg-[#511d29] text-white text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-black text-slate-700 truncate">Contract {i + 1}{c.contractNumber ? ` · ${c.contractNumber}` : ''}{c.type ? ` · ${c.type}` : ''}</p>
                                                                        <p className="text-[10px] text-slate-500">
                                                                            {c.startDate ? fmt(c.startDate) : '—'}{c.endDate ? ` → ${fmt(c.endDate)}` : ''}
                                                                            {c.position ? ` · ${c.position}` : ''}
                                                                            {(c.salary || c.salary === 0) ? ` · ${Number(c.salary).toLocaleString()}` : ''}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded shrink-0 ${c.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : c.status === 'TERMINATED' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{c.status}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </TreeBranch>

                                        {/* New — internal transfer history (PersonnelActionForm). Ungated beyond
                                            authentication, same exposure level as Contract History above. */}
                                        <TreeBranch isOpen={expandedNodes.has('employment.transfers')} onToggle={() => toggleNode('employment.transfers')} level={1} icon={ArrowRight} title="Career Transfers & Internal Moves" color="bg-orange-50 text-orange-600" count={detailTransfers.length}>
                                            {detailTransfers.length === 0 ? (
                                                <div className="text-sm font-bold text-slate-300">No transfer records yet.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {detailTransfers.map((t) => {
                                                        const statusStyle = t.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : t.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                                                        const isIc = t.actionType === 'INTER_COMPANY_TRANSFER';
                                                        const currentPlacement = [t.currentDivision, t.currentDepartment, t.currentUnit].filter(Boolean).join(' · ');
                                                        // Inter-company moves are company → company (IPH → the new company); internal moves are
                                                        // org-unit → org-unit resolved from the target JD's ids.
                                                        const newPlacementIc = [t.newDivisionName, t.newDepartmentName, t.newUnitName].filter(Boolean).join(' · ');
                                                        const newPlacement = isIc
                                                            ? newPlacementIc
                                                            : [nameOfOrgUnit(divisions, t.newDivisionId), nameOfOrgUnit(departments, t.newDepartmentId), nameOfOrgUnit(units, t.newUnitId)].filter(Boolean).join(' · ');
                                                        const fromLabel = isIc ? `IPH${currentPlacement ? ` · ${currentPlacement}` : ''}` : (currentPlacement || '—');
                                                        const toLabel = isIc ? `${t.newCompany || '—'}${newPlacementIc ? ` · ${newPlacementIc}` : ''}` : (newPlacement || t.newPositionTitle || '—');
                                                        const typeLabel = isIc
                                                            ? `Inter-Company${t.typeOfTransfer && t.typeOfTransfer !== 'Inter-Company' ? ` · ${t.typeOfTransfer}` : ''}${t.newPositionTitle ? ` · ${t.newPositionTitle}` : ''}`
                                                            : `${t.typeOfTransfer || t.actionType}${t.newPositionTitle ? ` · ${t.newPositionTitle}` : ''}`;
                                                        const docHref = t.documentUrl ? (t.documentUrl.startsWith('http') ? t.documentUrl : `${SERVER_URL}${t.documentUrl}`) : '';
                                                        return (
                                                            <div key={t.id} className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <p className="text-xs font-black text-slate-700 truncate">{typeLabel}</p>
                                                                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded shrink-0 ${statusStyle}`}>{t.status}</span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-bold">{fromLabel}</span>
                                                                    <ArrowRight className="w-3 h-3 shrink-0" />
                                                                    <span className="font-bold text-[#511d29]">{toLabel}</span>
                                                                </p>
                                                                {t.justification && <p className="text-[11px] text-slate-500 italic">"{t.justification}"</p>}
                                                                <p className="text-[10px] text-slate-400">
                                                                    {t.effectiveDate ? `Effective ${fmt(t.effectiveDate)}` : ''}{t.createdByName ? ` · Requested by ${t.createdByName}` : ''}
                                                                    {t.decidedByName ? ` · Decided by ${t.decidedByName}${t.decidedAt ? ' on ' + fmt(t.decidedAt) : ''}` : ''}
                                                                </p>
                                                                <div className="flex items-center gap-4 pt-0.5">
                                                                    <button type="button" onClick={() => navigate(`/personnel-relations/transfer/${t.id}`)} className="text-[#aa7a51] hover:text-[#8f6544] inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
                                                                        View detail <Eye className="w-3 h-3" />
                                                                    </button>
                                                                    {t.documentUrl && (
                                                                        <a href={docHref} target="_blank" rel="noopener noreferrer" className="text-[#511d29] hover:text-[#3a151d] inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
                                                                            View signed form <ExternalLink className="w-3 h-3" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </TreeBranch>
                                    </div>
                                </TreeBranch>

                                {/* New — monthly evaluation history across all 9 evaluation tables. Server-side
                                    gated: `allowed` is false (403) for any viewer who isn't HR/Admin or the
                                    employee themself, in which case no score data is fetched at all. */}
                                <TreeBranch
                                    isOpen={expandedNodes.has('evaluations')} onToggle={() => toggleNode('evaluations')}
                                    icon={TrendingUp}
                                    title="Monthly Performance Evaluations"
                                    color="bg-purple-50 text-purple-600"
                                    count={detailEvalHistory.allowed ? detailEvalHistory.months.length : undefined}
                                    restricted={!detailEvalHistory.allowed ? 'Restricted to HR/Personnel or the employee' : undefined}
                                >
                                    <div className="space-y-2">
                                        {detailEvalHistory.allowed && (() => {
                                            const rule = getPromotionRule(emp.jobGrade);
                                            const points = emp.evaluationPoints || 0;
                                            return (
                                                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100">
                                                    <span className="text-xs font-black text-amber-700 flex items-center gap-1.5">★ Evaluation Index: {points.toFixed(2)}</span>
                                                    <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">
                                                        {!rule ? 'Top grade reached' : rule.type === 'EVALUATION'
                                                            ? `${points.toFixed(2)} / ${rule.threshold} to promotion (${rule.nextGrade})`
                                                            : `${Math.max(0, monthsSince(emp.currentGradeSince || emp.contractStartDate || emp.joinDate))} / ${rule.months} months to promotion (${rule.nextGrade})`}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        {detailEvalHistory.months.length === 0 ? (
                                            <div className="text-sm font-bold text-slate-300">No evaluation records yet.</div>
                                        ) : (
                                            [...detailEvalHistory.months].sort((a, b) => b.month.localeCompare(a.month)).map((m) => {
                                                const requiredLevels = getRequiredLevels(emp);
                                                const breakdown = buildEvaluationBreakdown({
                                                    employeeId: emp.id,
                                                    month: m.month,
                                                    requiredLevels,
                                                    levelARecord: pickLevelRecord(requiredLevels[0], m),
                                                    levelBRecord: pickLevelRecord(requiredLevels[1], m),
                                                    hrEval: m.hr || null,
                                                    persEval: m.personnel || null,
                                                });
                                                const monthLabel = format(parseISO(`${m.month}-01`), 'MMM yyyy');
                                                const statusLabel = m.finalization ? 'Finalized' : 'Provisional';
                                                const evalKey = `${emp.id}:${m.month}`;
                                                return (
                                                    <TreeBranch key={m.month} isOpen={expandedNodes.has(`evaluations.${m.month}`)} onToggle={() => toggleNode(`evaluations.${m.month}`)} level={1} title={`${monthLabel} — ${statusLabel} ${breakdown.finalScore.toFixed(1)}%`}
                                                        action={
                                                            <button
                                                                type="button"
                                                                onClick={() => downloadEvalForm(emp.id, m.month, emp.fullName)}
                                                                disabled={evalDocBusy === evalKey}
                                                                title="Export this month's evaluation as the official Word form"
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                                                            >
                                                                <FileText className="w-3.5 h-3.5" />
                                                                {evalDocBusy === evalKey ? 'Generating…' : 'Export Form'}
                                                            </button>
                                                        }
                                                    >
                                                        <EvaluationBreakdownView employee={emp} breakdown={breakdown} />
                                                    </TreeBranch>
                                                );
                                            })
                                        )}
                                    </div>
                                </TreeBranch>

                                {/* New — this employee's promotion case history. Gated on manage_promotions,
                                    same pattern as the Confirmed Disciplinary Record above. */}
                                <TreeBranch
                                    isOpen={expandedNodes.has('promotions')} onToggle={() => toggleNode('promotions')}
                                    icon={Award} title="Promotion Record" color="bg-yellow-50 text-yellow-700"
                                    count={canSeePromotionRecord ? detailPromotionCases.length : undefined}
                                    restricted={!canSeePromotionRecord ? 'Restricted to Personnel Relations' : undefined}
                                >
                                    {detailPromotionCases.length === 0 ? (
                                        <div className="text-sm font-bold text-slate-300">No promotion records yet.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {[...detailPromotionCases]
                                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                                .map((c: PromotionCase) => {
                                                    const stageLabel = c.stage === 'CLOSED' ? 'Closed' : (PROMOTION_STAGE_COLUMNS.find(s => s.key === c.stage)?.label || c.stage);
                                                    const statusStyle = c.stage === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
                                                    return (
                                                        <div key={c.id} className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-xs font-black text-slate-700 truncate">{c.caseNumber}{c.isExceptional ? ' · Exceptional' : ''}</p>
                                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded shrink-0 ${statusStyle}`}>{stageLabel}</span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                                                {c.stage === 'CLOSED' ? (
                                                                    <span className="font-bold text-emerald-700">Promoted to {c.toGrade}</span>
                                                                ) : (
                                                                    <>
                                                                        <span className="font-bold">{emp.jobGrade || '—'}</span>
                                                                        <ArrowRight className="w-3 h-3 shrink-0" />
                                                                        <span className="font-bold text-[#511d29]">{c.toGrade}</span>
                                                                    </>
                                                                )}
                                                                {c.basis && <span className="text-slate-400">· {BASIS_LABELS[c.basis] || c.basis}</span>}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">
                                                                Filed {fmt(c.createdAt)}
                                                                {c.effectiveDate ? ` · Effective ${fmt(c.effectiveDate)}` : ''}
                                                                {c.stage === 'CLOSED' && c.closedAt ? ` · Closed ${fmt(c.closedAt)}` : ''}
                                                                {c.createdByName ? ` · Filed by ${c.createdByName}` : ''}
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/personnel-relations/promotions/${c.id}`)}
                                                                className="text-[#511d29] hover:text-[#3a151d] inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
                                                            >
                                                                View Case <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </TreeBranch>

                                {/* New — this employee's reward case history. Gated on manage_rewards,
                                    same pattern as the Promotion Record above. */}
                                <TreeBranch
                                    isOpen={expandedNodes.has('rewards')} onToggle={() => toggleNode('rewards')}
                                    icon={Award} title="Rewards Record" color="bg-emerald-50 text-emerald-700"
                                    count={canSeeRewardsRecord ? detailRewardCases.length : undefined}
                                    restricted={!canSeeRewardsRecord ? 'Restricted to Personnel Relations' : undefined}
                                >
                                    {detailRewardCases.length === 0 ? (
                                        <div className="text-sm font-bold text-slate-300">No reward records yet.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {[...detailRewardCases]
                                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                                .map((c: RewardCase) => {
                                                    const statusStyle = c.completedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
                                                    const detailParts: string[] = [];
                                                    if (c.period) detailParts.push(c.period);
                                                    if (c.milestoneYears) detailParts.push(`${c.milestoneYears}-year milestone`);
                                                    if (c.finalScoreSnapshot != null) detailParts.push(`Score ${c.finalScoreSnapshot.toFixed(2)}%`);
                                                    if (c.bonusPercent != null) detailParts.push(`${c.bonusPercent}% bonus — Pending Payroll Integration`);
                                                    return (
                                                        <div key={c.id} className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-xs font-black text-slate-700 truncate">{c.caseNumber} · {REWARD_TYPE_LABELS[c.type]}</p>
                                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded shrink-0 ${statusStyle}`}>{c.completedAt ? 'Completed' : 'Draft'}</span>
                                                            </div>
                                                            {detailParts.length > 0 && (
                                                                <p className="text-[11px] text-slate-500">{detailParts.join(' · ')}</p>
                                                            )}
                                                            <p className="text-[10px] text-slate-400">
                                                                Filed {fmt(c.createdAt)}
                                                                {c.completedAt ? ` · Completed ${fmt(c.completedAt)}` : ''}
                                                                {c.physicalRewardFulfilledAt ? ' · Gift Fulfilled' : ''}
                                                                {c.createdByName ? ` · Filed by ${c.createdByName}` : ''}
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/personnel-relations/rewards/${c.id}`)}
                                                                className="text-[#511d29] hover:text-[#3a151d] inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
                                                            >
                                                                View Case <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </TreeBranch>

                                <TreeBranch isOpen={expandedNodes.has('attendance')} onToggle={() => toggleNode('attendance')} icon={CalendarDays} title="Attendance & Leave" color="bg-amber-50 text-amber-600">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                            <Row label="Paid Leave Balance" value={paidRemaining} />
                                            <Row label="Unpaid Leave Balance" value={14 - unpaidTaken} />
                                            <Row label="Emergency Leave Balance" value={3 - emergTaken} />
                                        </div>

                                        {/* New — monthly attendance aggregates (TimeRecord). Ungated beyond
                                            authentication, same exposure level as the Leave Balances above. */}
                                        <TreeBranch isOpen={expandedNodes.has('attendance.timerecords')} onToggle={() => toggleNode('attendance.timerecords')} level={1} icon={Clock} title="Monthly Time Records" color="bg-amber-50 text-amber-600" count={detailTimeRecords.length}>
                                            {detailTimeRecords.length === 0 ? (
                                                <div className="text-sm font-bold text-slate-300">No attendance records yet.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {[...detailTimeRecords].sort((a: any, b: any) => b.month.localeCompare(a.month)).map((tr: any) => (
                                                        <div key={tr.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
                                                            <p className="text-xs font-black text-slate-700 shrink-0">{format(parseISO(`${tr.month}-01`), 'MMM yyyy')}</p>
                                                            <p className="text-[11px] text-slate-500 text-right">
                                                                Worked {tr.workedHours}h · Assigned {tr.assignedHours}h · OT {tr.overtimeHours}h
                                                                {tr.absences ? ` · ${tr.absences} absence(s)` : ''}
                                                                {tr.lateMinutes ? ` · ${tr.lateMinutes}m late` : ''}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TreeBranch>

                                        {/* New — individual leave requests (reuses the same endpoint the Staff Hub
                                            uses), beyond the balance numbers above. Ungated beyond authentication. */}
                                        <TreeBranch isOpen={expandedNodes.has('attendance.leaverequests')} onToggle={() => toggleNode('attendance.leaverequests')} level={1} icon={CalendarDays} title="Leave Requests" color="bg-amber-50 text-amber-600" count={detailLeaveRequests.length}>
                                            {detailLeaveRequests.length === 0 ? (
                                                <div className="text-sm font-bold text-slate-300">No leave requests yet.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {detailLeaveRequests.map((lr: any) => {
                                                        const approvalSummary = (lr.approvalSteps || []).length
                                                            ? (lr.approvalSteps as any[]).map(s => `${String(s.stage).replace(/_/g, ' ')}: ${s.status}${s.approver?.fullName ? ` (${s.approver.fullName})` : ''}`).join(' · ')
                                                            : '';
                                                        return (
                                                            <div key={lr.id} className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <p className="text-xs font-black text-slate-700">{String(lr.type).replace(/_/g, ' ')}</p>
                                                                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-slate-200 text-slate-600 shrink-0">{lr.status}</span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500">{fmt(lr.startDate)}{lr.endDate ? ` → ${fmt(lr.endDate)}` : ''}{lr.reason ? ` · ${lr.reason}` : ''}</p>
                                                                {approvalSummary && <p className="text-[10px] text-slate-400">{approvalSummary}</p>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </TreeBranch>
                                    </div>
                                </TreeBranch>

                                {/* New — confirmed disciplinary record, permanently part of the employee's file
                                    once a case actually completes the Disciplinary Action stage against them. */}
                                <TreeBranch
                                    isOpen={expandedNodes.has('disciplinary')} onToggle={() => toggleNode('disciplinary')}
                                    icon={AlertOctagon}
                                    title="Disciplinary Record"
                                    color="bg-red-50 text-red-700"
                                    count={canSeeDisciplinaryRecord ? detailDisciplinaryRecord.length : undefined}
                                    restricted={!canSeeDisciplinaryRecord ? 'Restricted to Personnel Relations' : undefined}
                                >
                                    {detailDisciplinaryRecord.length === 0 ? (
                                        <div className="text-sm font-bold text-slate-300">No confirmed disciplinary actions on record.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {[...detailDisciplinaryRecord].sort((a, b) => new Date(b.actionCompletedAt || 0).getTime() - new Date(a.actionCompletedAt || 0).getTime()).map(dc => (
                                                <div key={dc.id} className="px-4 py-3 rounded-2xl bg-red-50/50 border border-red-100 space-y-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-xs font-black text-slate-700">
                                                            {dc.violationId ? VIOLATIONS_BY_ID[dc.violationId]?.description || dc.violationId : 'Violation not specified'}
                                                        </p>
                                                        <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-red-100 text-red-700 shrink-0">
                                                            {dc.category ? DISCIPLINARY_CATEGORY_LABELS[dc.category as DisciplinaryCategory] : ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500">
                                                        {dc.actionType ? DISCIPLINARY_ACTION_LABELS[dc.actionType] : '—'}
                                                        {dc.offenseNumber ? ` · Offense #${dc.offenseNumber}` : ''}
                                                        {dc.actionEffectiveDate ? ` · Effective ${fmt(dc.actionEffectiveDate)}` : ''}
                                                    </p>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-[10px] text-slate-400">{dc.caseNumber}</p>
                                                        <button
                                                            onClick={() => navigate(`/personnel-relations/disciplinary/${dc.id}`)}
                                                            className="text-[#511d29] hover:text-[#3a151d] inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
                                                        >
                                                            View case <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TreeBranch>

                                <TreeBranch isOpen={expandedNodes.has('factors')} onToggle={() => toggleNode('factors')} icon={TrendingUp} title="System & Scoring Factors" color="bg-slate-100 text-slate-600">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                        <Field emp={emp} label="Position Factor" k="positionFactor" />
                                        <Field emp={emp} label="Site Factor" k="siteFactor" />
                                        <Field emp={emp} label="Skill Factor" k="skillFactor" />
                                        <Field emp={emp} label="Language Factor" k="languageFactor" />
                                        <Field emp={emp} label="Salary Structure Type" k="salaryStructureType" />
                                        <Field emp={emp} label="BioTime ID" k="bioId" />
                                    </div>
                                </TreeBranch>

                                {showField('bankName') && (
                                    <TreeBranch isOpen={expandedNodes.has('bank')} onToggle={() => toggleNode('bank')} icon={Landmark} title="Bank Details" color="bg-slate-100 text-slate-600">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                            <Field emp={emp} label="Bank Name" k="bankName" />
                                            <Field emp={emp} label="Bank Name (Arabic)" k="bankNameArabic" dir="rtl" />
                                            <Field emp={emp} label="Bank Branch" k="bankBranchName" />
                                            <Field emp={emp} label="Bank Branch (Arabic)" k="bankBranchNameArabic" dir="rtl" />
                                            <Field emp={emp} label="Account Number" k="bankAccountNumber" />
                                        </div>
                                    </TreeBranch>
                                )}
                            </div>
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

export default PersonnelRelations;
