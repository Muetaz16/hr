import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recruitmentService } from '../services/recruitmentService';
import { SERVER_URL } from '../services/apiClient';
import { departmentService } from '../services/departmentService';
import { unitService } from '../services/unitService';
import { jobDescriptionService } from '../services/jobDescriptionService';
import { employeeService } from '../services/employeeService';
import type { RecruitmentRequest, Department, Unit, JobDescription } from '../types';
import {
    UserPlus, Clock, CheckCircle2, XCircle, Plus, Building2, Briefcase,
    Trash2, Search, User as UserIcon, FileText, LayoutList, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../components/ConfirmDialog';
import JobDescriptionFields, { emptyJDDetails, JD_SECTIONS, type JDFormValue } from '../components/JobDescriptionFields';
import { canAccess } from '../utils/access';

const emptyJDForm = (): JDFormValue => ({
    title: '', description: '', isHead: false, plannedCount: 1,
    jobCategories: [], workLocations: [], details: emptyJDDetails()
});

// Small labelled cell used in the requisition review grid.
const InfoCell: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="p-3 bg-white border border-slate-100 rounded-2xl">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-700 mt-0.5 break-words">{value ?? '—'}</p>
    </div>
);

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pending',
    DEPT_APPROVED: 'Dept Approved',
    DIV_APPROVED: 'Division Approved',
    HRMGR_APPROVED: 'HR Manager Approved',
    HRREC_APPROVED: 'Recruitment Approved',
    HR_APPROVED: 'Awaiting Directorate',
    FULLY_APPROVED: 'Fully Approved',
    REJECTED: 'Rejected',
};

const Recruitment: React.FC<{ mode?: 'requests' | 'positions' | 'approvals' | 'create' }> = ({ mode = 'requests' }) => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const [requests, setRequests] = useState<RecruitmentRequest[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
    const [myRecord, setMyRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [selectedRequest, setSelectedRequest] = useState<RecruitmentRequest | null>(null);
    const [approvalNote, setApprovalNote] = useState('');

    // Create-form state — scope is a department (within the requester's own org) and an optional unit
    const [reqType, setReqType] = useState<'HIRE' | 'JD_CHANGE'>('HIRE');
    const [formDeptId, setFormDeptId] = useState('');
    const [formUnitId, setFormUnitId] = useState('');
    const [reason, setReason] = useState('');
    const [selectedJdId, setSelectedJdId] = useState('');       // HIRE target JD, or JD_CHANGE edit target
    const [hireQuantity, setHireQuantity] = useState(1);        // HIRE: how many people to request
    // HIRE / PRF extra fields
    const [employmentType, setEmploymentType] = useState('');
    const [typeOfRequest, setTypeOfRequest] = useState('');
    const [languageEn, setLanguageEn] = useState('');
    const [languageAr, setLanguageAr] = useState('');
    const [reportsTo, setReportsTo] = useState('');
    const [gmDoc, setGmDoc] = useState<File | null>(null); // GM's signed document at final approval
    const [jdMode, setJdMode] = useState<'edit' | 'new'>('new'); // JD_CHANGE mode
    const [jdForm, setJdForm] = useState<JDFormValue>(emptyJDForm());

    const isHR = canAccess(currentUser, ['HR_MANAGER'], ['manage_recruitment']);
    // The Head of Directorate acts as the GM for final approval.
    // JD changes are finalised by the Head of Directorate (not the GM).
    const isDirector = canAccess(currentUser, ['HEAD_DIRECTOR'], ['recruitment_approvals']);
    const isDivisionHead = canAccess(currentUser, ['HEAD_DIVISION'], ['recruitment_approvals']);
    const canRequest = canAccess(currentUser, ['HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_DIVISION'], ['manage_recruitment']);

    useEffect(() => { fetchData(); }, []);

    // On the dedicated create page, seed the form defaults once data has loaded.
    useEffect(() => {
        if (mode === 'create' && !loading) resetForm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, loading]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [reqs, depts, unts, jds, me] = await Promise.all([
                recruitmentService.getAllRequests(),
                departmentService.getAllDepartments(),
                unitService.getAllUnits(),
                jobDescriptionService.getAllJobDescriptions().catch(() => []),
                employeeService.getMyEmployeeRecord().catch(() => null)
            ]);
            setRequests(reqs);
            setDepartments(depts);
            setUnits(unts);
            setJobDescriptions(jds);
            setMyRecord(me);
        } catch (error) {
            toast.error(t('err_load_recruitment', { defaultValue: 'Failed to load requisitions.' }));
        } finally {
            setLoading(false);
        }
    };

    // Departments the requester is allowed to raise requisitions for.
    // - Division head: all departments in their division.
    // - Department/Office head: only their own department.
    // - Super admin: any department.
    const myDepartmentId = myRecord?.departmentId || currentUser?.departmentId || null;
    const myDivisionId = myRecord?.divisionId || departments.find(d => d.id === myDepartmentId)?.divisionId || null;

    const allowedDepartments = (() => {
        if (currentUser?.role === 'SUPER_ADMIN') return departments;
        if (currentUser?.role === 'HEAD_DIVISION') {
            return departments.filter(d => d.divisionId && d.divisionId === myDivisionId);
        }
        // Department / Office head
        return departments.filter(d => d.id === myDepartmentId);
    })();

    const unitsForDept = units.filter(u => u.departmentId === formDeptId);

    // Effective scope = unit (if chosen) else department
    const scopeJDs = jobDescriptions.filter(jd => formUnitId ? jd.unitId === formUnitId : jd.departmentId === formDeptId);
    const openScopeJDs = scopeJDs.filter(jd => (jd._count?.employees || 0) < jd.plannedCount);

    const resetForm = () => {
        setReqType('HIRE');
        // Default to the requester's own department when there is exactly one.
        const defaultDept = (currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'HEAD_DIVISION')
            ? (myDepartmentId || '')
            : '';
        setFormDeptId(defaultDept);
        setFormUnitId('');
        setReason(''); setSelectedJdId(''); setHireQuantity(1); setJdMode('new'); setJdForm(emptyJDForm());
        setEmploymentType(''); setTypeOfRequest(''); setLanguageEn(''); setLanguageAr(''); setReportsTo('');
    };

    // When choosing an existing JD to edit in JD_CHANGE mode, prefill the JD form
    const loadJdForEdit = (jdId: string) => {
        setSelectedJdId(jdId);
        const jd = jobDescriptions.find(j => j.id === jdId);
        if (jd) {
            setJdForm({
                title: jd.title,
                description: jd.description || '',
                isHead: jd.isHead,
                plannedCount: jd.plannedCount,
                jobCategories: jd.jobCategories || [],
                workLocations: jd.workLocations || [],
                details: { ...emptyJDDetails(), ...(jd.details || {}) }
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formDeptId) { toast.error(t('scope_required', { defaultValue: 'Please select the department.' })); return; }

        try {
            const scopeIds: any = { departmentId: formDeptId, divisionId: null, unitId: formUnitId || null };

            if (reqType === 'HIRE') {
                if (!selectedJdId) { toast.error(t('select_jd_required', { defaultValue: 'Select a position (Job Description) with an open slot.' })); return; }
                await recruitmentService.createRequest({ type: 'HIRE', jobDescriptionId: selectedJdId, quantity: hireQuantity, reason, reportsTo, employmentType, typeOfRequest, languageEn, languageAr, ...scopeIds } as any);
            } else {
                if (!jdForm.title) { toast.error(t('jd_title_required', { defaultValue: 'A position title is required.' })); return; }
                const payload = {
                    ...jdForm,
                    mode: jdMode,
                    ...scopeIds,
                };
                await recruitmentService.createRequest({
                    type: 'JD_CHANGE',
                    jobDescriptionId: jdMode === 'edit' ? selectedJdId : undefined,
                    reason,
                    jdPayload: payload,
                    ...scopeIds
                });
            }
            toast.success(t('req_submitted_success', { defaultValue: 'Requisition submitted.' }));
            resetForm();
            navigate('/recruitment/requests');
        } catch (error: any) {
            toast.error(error.response?.data?.error || t('err_submit_req', { defaultValue: 'Failed to submit requisition.' }));
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm({ message: t('confirm_delete_req', { defaultValue: 'Delete this requisition?' }), danger: true }))) return;
        try {
            await recruitmentService.deleteRequest(id);
            toast.success(t('req_deleted_success', { defaultValue: 'Requisition deleted.' }));
            fetchData();
        } catch (error) {
            toast.error(t('err_delete_req', { defaultValue: 'Failed to delete.' }));
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedRequest) return;
        try {
            await recruitmentService.updateStatus(selectedRequest.id, status, approvalNote);
            toast.success(t('req_status_updated', { defaultValue: 'Decision recorded.' }));
            setSelectedRequest(null);
            setApprovalNote('');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || t('err_update_status', { defaultValue: 'Failed to update.' }));
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'FULLY_APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'HR_APPROVED': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'DEPT_APPROVED': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'REJECTED': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };
    const statusLabel = (s: string) => ({
        PENDING: 'Pending', DEPT_APPROVED: 'Division Approved', HR_APPROVED: 'HR Approved',
        FULLY_APPROVED: 'Fully Approved', REJECTED: 'Rejected'
    } as any)[s] || s;

    const scopeName = (r: RecruitmentRequest) =>
        r.department?.name || r.division?.name || r.unit?.name || '—';

    const handleMarkFilled = async (id: string) => {
        try {
            await recruitmentService.markFilled(id);
            toast.success(t('req_filled', { defaultValue: 'Requisition marked as filled.' }));
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || t('err_update_status', { defaultValue: 'Failed to update.' }));
        }
    };

    // The division a requisition belongs to (its own division, or its department's division).
    const reqDivisionId = (r: RecruitmentRequest) => r.divisionId || departments.find(d => d.id === r.departmentId)?.divisionId || null;

    // ---- HIRE requisition: staged Personnel Requisition Form (PRF) approval flow ----
    const PRF_STAGES = ['deptHead', 'divHead', 'hrManager', 'hrRecruitment', 'gm'] as const;
    const PRF_STAGE_LABEL: Record<string, string> = {
        deptHead: 'Head of Department', divHead: 'Head of Division/Office', hrManager: 'Head of HR',
        hrRecruitment: 'Head of Hiring Unit', gm: 'General Manager',
    };
    const prfNextStage = (r: RecruitmentRequest): string | null => {
        const a: any = (r as any).prfApprovals || {};
        return PRF_STAGES.find(s => !a[s]) || null;
    };
    const canActPrfStage = (stage: string): boolean => {
        const role = currentUser?.role;
        const perms = currentUser?.permissions || [];
        if (role === 'SUPER_ADMIN') return true;
        switch (stage) {
            case 'deptHead': return role === 'HEAD_DEPARTMENT' || role === 'HEAD_OFFICE';
            case 'divHead': return role === 'HEAD_DIVISION' || role === 'HEAD_OFFICE';
            case 'hrManager': return role === 'HR_MANAGER' || perms.includes('approve_hr_manager');
            case 'hrRecruitment': return perms.includes('approve_hr_recruitment');
            case 'gm': return role === 'GENERAL_MANAGER';
            default: return false;
        }
    };

    // Can the current user act on this requisition right now?
    const canActOn = (r: RecruitmentRequest) => {
        if (r.status === 'REJECTED' || r.status === 'FULLY_APPROVED') return false;
        if (r.type === 'HIRE') {
            const stage = prfNextStage(r);
            return stage ? canActPrfStage(stage) : false;
        }
        // JD_CHANGE: Division head → HR → Directorate.
        if (r.status === 'PENDING') return currentUser?.role === 'SUPER_ADMIN' || (isDivisionHead && reqDivisionId(r) === myDivisionId);
        if (r.status === 'DEPT_APPROVED') return isHR;
        if (r.status === 'HR_APPROVED') return isDirector;
        return false;
    };

    const handlePrfDecision = async (decision: 'approve' | 'reject') => {
        if (!selectedRequest) return;
        const stage = prfNextStage(selectedRequest);
        // The GM must upload the signed document to grant final approval.
        if (decision === 'approve' && stage === 'gm' && !gmDoc) {
            toast.error(t('gm_doc_required', { defaultValue: 'Upload the signed requisition document to approve as GM.' }));
            return;
        }
        try {
            const file = decision === 'approve' && stage === 'gm' ? gmDoc : undefined;
            await recruitmentService.prfApprove(selectedRequest.id, decision, approvalNote, file);
            toast.success(decision === 'approve' ? t('approval_recorded', { defaultValue: 'Approval recorded.' }) : t('req_rejected', { defaultValue: 'Requisition rejected.' }));
            setSelectedRequest(null);
            setApprovalNote('');
            setGmDoc(null);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || t('err_update_status', { defaultValue: 'Failed to update.' }));
        }
    };

    const [prfBusy, setPrfBusy] = useState<string | null>(null);
    const downloadPrf = async (r: RecruitmentRequest) => {
        setPrfBusy(r.id);
        try {
            const blob = await recruitmentService.generatePrf(r.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Personnel_Requisition_${(r.jobTitle || 'requisition').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('prf_generated', { defaultValue: 'Personnel Requisition Form generated.' }));
        } catch (error: any) {
            let msg = t('err_generate_prf', { defaultValue: 'Failed to generate the form.' });
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setPrfBusy(null);
        }
    };

    // Mode-specific list
    const visibleRequests = mode === 'approvals'
        ? requests.filter(canActOn)
        : mode === 'positions'
            ? requests.filter(r => r.type === 'HIRE' && r.status === 'FULLY_APPROVED')
                .sort((a, b) => Number(a.filled) - Number(b.filled))
            : requests;

    const headerFor = {
        requests: { title: t('nav_req_hiring_jd', { defaultValue: 'Request Hiring & JD' }), sub: t('prf_subtitle', { defaultValue: 'Request a hire against your staffing plan, or request a change to a Job Description' }) },
        positions: { title: t('nav_positions_to_fill', { defaultValue: 'Positions to Fill' }), sub: t('positions_sub', { defaultValue: 'Approved hire requisitions. Source candidates from the Applicant List, or mark a position filled once staffed.' }) },
        approvals: { title: t('nav_recruitment_approvals', { defaultValue: 'Recruitment Approvals' }), sub: t('approvals_sub', { defaultValue: 'Requisitions awaiting your decision as Head of Division, HR, or Directorate' }) },
        create: { title: t('new_requisition', { defaultValue: 'New Requisition' }), sub: t('prf_subtitle', { defaultValue: 'Request a hire against your staffing plan, or request a change to a Job Description' }) },
    }[mode];

    if (loading) return <div className="p-12 text-center animate-pulse text-slate-400">{t('loading_recruitment', { defaultValue: 'Loading requisitions...' })}</div>;

    // Full-page requisition details / approval view (opened from any list via "View Details").
    if (selectedRequest) {
        return (
            <div className="w-full max-w-none mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-16">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => { setSelectedRequest(null); setApprovalNote(''); }}
                        className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-2xl font-outfit font-bold text-slate-800 tracking-tight">{t('req_details', { defaultValue: 'Recruitment Request Details' })}</h1>
                </div>

                <div className="space-y-8">
                    <div className="flex gap-6 items-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                            {selectedRequest.type === 'JD_CHANGE' ? <FileText className="w-8 h-8 text-purple-500" /> : <Briefcase className="w-8 h-8 text-indigo-500" />}
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">{selectedRequest.type === 'JD_CHANGE' ? 'JD Change Request' : 'Hire Requisition'}</p>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{selectedRequest.jobTitle}</h3>
                            <div className="flex gap-4 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Building2 className="w-3 h-3" />{scopeName(selectedRequest)}</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><UserIcon className="w-3 h-3" />{selectedRequest.requester?.fullName}</span>
                            </div>
                        </div>
                    </div>

                    {/* Request overview — everything needed to review at a glance */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Request Overview</p>
                        <div className="grid grid-cols-2 gap-3">
                            <InfoCell label="Request Type" value={selectedRequest.type === 'JD_CHANGE' ? 'Job Description Change' : 'Hire Requisition'} />
                            <InfoCell label="Current Status" value={STATUS_LABELS[selectedRequest.status] || selectedRequest.status} />
                            <InfoCell label="Requested By" value={selectedRequest.requester ? `${selectedRequest.requester.fullName} (${String(selectedRequest.requester.role || '').replace(/_/g, ' ')})` : '—'} />
                            <InfoCell label="Scope" value={scopeName(selectedRequest)} />
                            {selectedRequest.type === 'HIRE'
                                ? <InfoCell label="Positions Requested" value={selectedRequest.quantity ?? 1} />
                                : <InfoCell label="Change Mode" value={selectedRequest.jdPayload?.mode === 'edit' ? 'Edit existing JD' : 'New position'} />}
                            <InfoCell label="Submitted" value={new Date(selectedRequest.createdAt).toLocaleDateString()} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Justification</p>
                        <div className="p-5 bg-white border border-slate-100 rounded-2xl text-slate-600 font-medium italic">"{selectedRequest.reason || 'No reason provided'}"</div>
                    </div>

                    {/* HIRE — the target job description being filled */}
                    {selectedRequest.type === 'HIRE' && selectedRequest.jobDescription && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Job Description</p>
                            <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-2 text-sm">
                                <p><span className="font-black text-slate-700">Title:</span> {selectedRequest.jobDescription.title}</p>
                                <p><span className="font-black text-slate-700">Staffing:</span> {(selectedRequest.jobDescription._count?.employees ?? 0)} / {selectedRequest.jobDescription.plannedCount} filled</p>
                                {(selectedRequest.jobDescription.workLocations || []).length > 0 && <p><span className="font-black text-slate-700">Work:</span> {(selectedRequest.jobDescription.workLocations || []).join(', ')}</p>}
                            </div>
                        </div>
                    )}

                    {/* JD_CHANGE — full proposed job description */}
                    {selectedRequest.type === 'JD_CHANGE' && selectedRequest.jdPayload && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proposed Job Description ({selectedRequest.jdPayload.mode === 'edit' ? 'Edit existing' : 'New position'})</p>
                            <div className="p-5 bg-purple-50/40 border border-purple-100 rounded-2xl space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <p><span className="font-black text-slate-700">Title:</span> {selectedRequest.jdPayload.title || '—'}</p>
                                    <p><span className="font-black text-slate-700">Planned Headcount:</span> {selectedRequest.jdPayload.isHead ? '1 (Head)' : (selectedRequest.jdPayload.plannedCount ?? '—')}</p>
                                    {(selectedRequest.jdPayload.jobCategories || []).length > 0 && <p><span className="font-black text-slate-700">Categories:</span> {(selectedRequest.jdPayload.jobCategories || []).join(', ')}</p>}
                                    {(selectedRequest.jdPayload.workLocations || []).length > 0 && <p><span className="font-black text-slate-700">Work:</span> {(selectedRequest.jdPayload.workLocations || []).join(', ')}</p>}
                                </div>
                                {selectedRequest.jdPayload.description && (
                                    <div className="pt-2 border-t border-purple-100/60">
                                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Summary</p>
                                        <p className="text-slate-600 whitespace-pre-wrap mt-1">{selectedRequest.jdPayload.description}</p>
                                    </div>
                                )}
                                {JD_SECTIONS.map(section => {
                                    const v = selectedRequest.jdPayload?.details?.[section.key];
                                    const en = v?.en?.trim();
                                    const ar = v?.ar?.trim();
                                    if (!en && !ar) return null;
                                    return (
                                        <div key={section.key} className="pt-2 border-t border-purple-100/60">
                                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">{section.labelEn}</p>
                                            {en && <p className="text-slate-600 whitespace-pre-wrap mt-1">{en}</p>}
                                            {ar && <p className="text-slate-500 whitespace-pre-wrap mt-1 text-right" dir="rtl">{ar}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Approval timeline */}
                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            {selectedRequest.type === 'JD_CHANGE' ? 'Approval Workflow — Division → HR → Directorate' : 'Approval Workflow — Dept → Division → HR → Recruitment → GM'}
                        </p>
                        <div className="p-5 bg-white border border-slate-100 rounded-3xl">
                            {(selectedRequest.type === 'HIRE'
                                ? (() => {
                                    const a: any = (selectedRequest as any).prfApprovals || {};
                                    const mk = (key: string, label: string, color: string) => ({ label, person: a[key]?.byName ? { fullName: a[key].byName } : null, note: a[key]?.note, date: a[key]?.at, done: !!a[key], color, document: a[key]?.document || null });
                                    return [
                                        mk('deptHead', 'Head of Department', 'bg-amber-500'),
                                        mk('divHead', 'Head of Division/Office', 'bg-amber-500'),
                                        mk('hrManager', 'Head of HR', 'bg-blue-500'),
                                        mk('hrRecruitment', 'Head of Hiring Unit', 'bg-blue-500'),
                                        mk('gm', 'General Manager', 'bg-emerald-500'),
                                    ];
                                })()
                                : [
                                    { label: 'Head of Division', person: selectedRequest.deptApprovedBy, note: selectedRequest.deptNote, date: selectedRequest.deptApprovedAt, done: !!selectedRequest.deptApprovedById, color: 'bg-amber-500' },
                                    { label: 'HR Review', person: selectedRequest.hrApprovedBy, note: selectedRequest.hrNote, date: selectedRequest.hrApprovedAt, done: !!selectedRequest.hrApprovedById, color: 'bg-blue-500' },
                                    { label: 'Head of Directorate', person: selectedRequest.gmApprovedBy, note: selectedRequest.gmNote, date: selectedRequest.gmApprovedAt, done: selectedRequest.status === 'FULLY_APPROVED', color: 'bg-emerald-500' },
                                ]
                            ).map((stage: any, i: number, arr: any[]) => (
                                <div key={i} className={`relative pl-8 ${i < arr.length - 1 ? 'pb-8 border-l-2 border-dashed border-slate-100' : ''}`}>
                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${stage.done ? stage.color : 'bg-slate-200'}`} />
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{stage.label}</p>
                                    {stage.person ? (
                                        <div className="mt-2 space-y-1">
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${selectedRequest.status === 'REJECTED' ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                {selectedRequest.status === 'REJECTED' ? t('decision_by', { defaultValue: 'Decision by' }) : `✓ ${t('accepted_by', { defaultValue: 'Accepted by' })}`}
                                            </p>
                                            <p className="text-xs font-bold text-indigo-600">{stage.person.fullName}{stage.date ? <span className="text-slate-400 font-medium"> · {new Date(stage.date).toLocaleString()}</span> : null}</p>
                                            {stage.note && <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">"{stage.note}"</p>}
                                            {(stage as any).document && (
                                                <a href={`${SERVER_URL}${(stage as any).document}`} target="_blank" rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 mt-1">
                                                    <FileText className="w-3.5 h-3.5" />{t('view_uploaded_document', { defaultValue: 'View uploaded document' })}
                                                </a>
                                            )}
                                        </div>
                                    ) : <p className="text-[10px] text-slate-400 italic mt-1">Awaiting</p>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Decision box */}
                    {canActOn(selectedRequest) && (
                        <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 space-y-4">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Provide Decision</p>
                            <textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder="Add a comment (optional)"
                                className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl outline-none font-medium text-slate-600 text-sm" />
                            {selectedRequest.type === 'HIRE' ? (
                                <>
                                    {prfNextStage(selectedRequest) === 'gm' && (
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t('upload_signed_document', { defaultValue: 'Upload signed document (required)' })}</label>
                                            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setGmDoc(e.target.files?.[0] || null)}
                                                className="w-full text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-bold" />
                                        </div>
                                    )}
                                    <div className="flex gap-3">
                                        <button onClick={() => handlePrfDecision('reject')} className="flex-1 py-3.5 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 border border-rose-100">Reject</button>
                                        <button onClick={() => handlePrfDecision('approve')} className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700">
                                            {(() => { const s = prfNextStage(selectedRequest); return s ? `Approve (${PRF_STAGE_LABEL[s]})` : 'Approve'; })()}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex gap-3">
                                    <button onClick={() => handleUpdateStatus('REJECTED')} className="flex-1 py-3.5 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 border border-rose-100">Reject</button>
                                    <button onClick={() => {
                                        if (selectedRequest.status === 'PENDING') handleUpdateStatus('DEPT_APPROVED');
                                        else if (selectedRequest.status === 'DEPT_APPROVED') handleUpdateStatus('HR_APPROVED');
                                        else handleUpdateStatus('FULLY_APPROVED');
                                    }} className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700">
                                        {selectedRequest.status === 'PENDING' ? 'Approve (Head of Division)' : selectedRequest.status === 'DEPT_APPROVED' ? 'Approve (HR)' : 'Grant Final Approval (Directorate)'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedRequest.type === 'HIRE' && (
                        <button onClick={() => downloadPrf(selectedRequest)} disabled={prfBusy === selectedRequest.id}
                            className="w-full py-3.5 bg-white border-2 border-indigo-200 text-indigo-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:border-indigo-400 hover:bg-indigo-50 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60">
                            <FileText className="w-4 h-4" />{prfBusy === selectedRequest.id ? t('generating', { defaultValue: 'Generating…' }) : t('download_prf', { defaultValue: 'Personnel Requisition Form' })}
                        </button>
                    )}

                    <button onClick={() => { setSelectedRequest(null); setApprovalNote(''); }} className="w-full py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                        {t('back_to_list', { defaultValue: 'Back to List' })}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-outfit font-black text-slate-800 tracking-tight">{headerFor.title}</h1>
                    <p className="text-slate-500 font-medium mt-1">{headerFor.sub}</p>
                </div>
                {mode === 'requests' && canRequest && (
                    <button onClick={() => navigate('/recruitment/new')} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95">
                        <Plus className="w-5 h-5" /> {t('new_requisition', { defaultValue: 'New Requisition' })}
                    </button>
                )}
            </div>

            {mode === 'requests' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {[
                        { icon: Clock, iconWrap: 'bg-amber-50', iconColor: 'text-amber-500', label: 'Pending', val: requests.filter(r => r.status === 'PENDING').length },
                        { icon: UserPlus, iconWrap: 'bg-blue-50', iconColor: 'text-blue-500', label: 'In Review', val: requests.filter(r => r.status === 'DEPT_APPROVED' || r.status === 'HR_APPROVED').length },
                        { icon: CheckCircle2, iconWrap: 'bg-emerald-50', iconColor: 'text-emerald-500', label: 'Approved', val: requests.filter(r => r.status === 'FULLY_APPROVED').length },
                        { icon: XCircle, iconWrap: 'bg-rose-50', iconColor: 'text-rose-500', label: 'Rejected', val: requests.filter(r => r.status === 'REJECTED').length },
                    ].map((s, i) => (
                        <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl ${s.iconWrap} flex items-center justify-center`}>
                                <s.icon className={`w-6 h-6 ${s.iconColor}`} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                                <p className="text-2xl font-black text-slate-800">{s.val}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {mode !== 'create' && (
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-100 shadow-premium p-8">
                <div className="flex items-center gap-3 mb-8">
                    <Search className="w-5 h-5 text-slate-300" />
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">
                        {mode === 'positions' ? t('open_positions', { defaultValue: 'Positions to Fill' }) : mode === 'approvals' ? t('awaiting_you', { defaultValue: 'Awaiting Your Decision' }) : t('active_requests', { defaultValue: 'Requisitions' })}
                        <span className="ml-2 text-sm font-bold text-slate-400">({visibleRequests.length})</span>
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleRequests.map((request) => (
                        <div key={request.id} className="group bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(request.status)}`}>
                                            {statusLabel(request.status)}
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${request.type === 'JD_CHANGE' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                            {request.type === 'JD_CHANGE' ? 'JD Change' : 'Hire'}
                                        </div>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{t('job_position', { defaultValue: 'Position' })}</p>
                                    <h4 className="text-lg font-black text-slate-800 tracking-tight leading-tight uppercase">{request.jobTitle}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(currentUser?.role === 'SUPER_ADMIN' || request.requesterId === currentUser?.id) && (
                                        <button onClick={() => handleDelete(request.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                        {request.type === 'JD_CHANGE' ? <FileText className="w-5 h-5 text-purple-500" /> : <Briefcase className="w-5 h-5 text-indigo-500" />}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-3">
                                    <Building2 className="w-4 h-4 text-slate-400" />
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">{t('scope', { defaultValue: 'Scope' })}</p>
                                        <p className="text-xs font-bold text-slate-700 truncate">{scopeName(request)}{request.unit ? ` / ${request.unit.name}` : ''}</p>
                                    </div>
                                </div>
                                {request.type === 'HIRE' && request.jobDescription && (
                                    <div className="flex items-center gap-3">
                                        <LayoutList className="w-4 h-4 text-slate-400" />
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Staffing Plan</p>
                                            <p className="text-xs font-bold text-slate-700">{(request.jobDescription._count?.employees ?? 0)} / {request.jobDescription.plannedCount} filled</p>
                                        </div>
                                    </div>
                                )}
                                {request.type === 'HIRE' && (
                                    <div className="flex items-center gap-3">
                                        <UserPlus className="w-4 h-4 text-slate-400" />
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-0.5">{t('this_requisition', { defaultValue: 'This Requisition' })}</p>
                                            <p className="text-xs font-bold text-slate-700">{(request.hiredCount ?? 0)} / {request.quantity ?? 1} {t('hired_lc', { defaultValue: 'hired' })}</p>
                                        </div>
                                    </div>
                                )}
                                {mode === 'positions' ? (
                                    <div className="pt-2 space-y-2">
                                        {request.filled ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Filled</span>
                                            </div>
                                        ) : isHR ? (
                                            <button onClick={() => handleMarkFilled(request.id)} className="w-full py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all">
                                                Mark as Filled
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                                                <Clock className="w-4 h-4 text-amber-600" />
                                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Open — awaiting hire</span>
                                            </div>
                                        )}
                                        <button onClick={() => setSelectedRequest(request)} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600">View Details</button>
                                    </div>
                                ) : (
                                    <div className="pt-2 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold text-slate-400 truncate">By <span className="text-slate-600">{request.requester?.fullName}</span></p>
                                            {(() => {
                                                const approver = request.gmApprovedBy || request.hrApprovedBy || request.deptApprovedBy;
                                                if (!approver) return null;
                                                return request.status === 'REJECTED'
                                                    ? <p className="text-[9px] font-black text-rose-500 uppercase tracking-wider truncate">{t('rejected_by', { defaultValue: 'Rejected by' })} {approver.fullName}</p>
                                                    : <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider truncate">✓ {t('accepted_by', { defaultValue: 'Accepted by' })} {approver.fullName}</p>;
                                            })()}
                                        </div>
                                        <button onClick={() => setSelectedRequest(request)} className="shrink-0 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                                            {mode === 'approvals' ? 'Review & Decide' : 'Details'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {visibleRequests.length === 0 && (
                        <div className="col-span-full py-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><Search className="w-10 h-10 text-slate-200" /></div>
                            <p className="text-slate-400 font-medium">
                                {mode === 'positions' ? t('no_open_positions', { defaultValue: 'No approved positions to fill.' })
                                    : mode === 'approvals' ? t('nothing_awaiting', { defaultValue: 'Nothing is awaiting your decision.' })
                                    : t('no_recruitment_reqs', { defaultValue: 'No requisitions yet.' })}
                            </p>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Create form — dedicated full page */}
            {mode === 'create' && (
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-100 shadow-premium p-6 md:p-10">
                <form onSubmit={handleSubmit} className="space-y-6 py-2">
                    {/* Request type toggle */}
                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setReqType('HIRE')} className={`p-4 rounded-2xl border-2 text-left transition-all ${reqType === 'HIRE' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                            <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 text-indigo-600" /><span className="font-black text-sm text-slate-800">Hire</span></div>
                            <p className="text-[11px] text-slate-500 font-medium">Fill an open slot in an existing position.</p>
                        </button>
                        <button type="button" onClick={() => setReqType('JD_CHANGE')} className={`p-4 rounded-2xl border-2 text-left transition-all ${reqType === 'JD_CHANGE' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                            <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-purple-600" /><span className="font-black text-sm text-slate-800">JD Change</span></div>
                            <p className="text-[11px] text-slate-500 font-medium">Expand a full position or add a new one (needs GM approval).</p>
                        </button>
                    </div>

                    {/* Scope — limited to the requester's own department(s) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Department</label>
                            <select value={formDeptId} onChange={(e) => { setFormDeptId(e.target.value); setFormUnitId(''); setSelectedJdId(''); setJdForm(emptyJDForm()); }} required
                                disabled={allowedDepartments.length <= 1 && !!formDeptId}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 disabled:bg-slate-100">
                                <option value="">-- Select Department --</option>
                                {allowedDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            {allowedDepartments.length === 0 && (
                                <p className="text-[11px] font-bold text-amber-600 mt-1">No departments found in your scope.</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit (optional)</label>
                            <select value={formUnitId} onChange={(e) => { setFormUnitId(e.target.value); setSelectedJdId(''); setJdForm(emptyJDForm()); }}
                                disabled={!formDeptId}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 disabled:bg-slate-100">
                                <option value="">Whole department</option>
                                {unitsForDept.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Justification / Reason</label>
                        <textarea required value={reason} onChange={(e) => setReason(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-600 min-h-[80px]"
                            placeholder="Why is this needed?" />
                    </div>

                    {reqType === 'HIRE' ? (
                        (() => {
                            const selJd = openScopeJDs.find(jd => jd.id === selectedJdId);
                            const openSlots = selJd ? selJd.plannedCount - (selJd._count?.employees || 0) : 0;
                            return (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Position (open slots only)</label>
                                <select value={selectedJdId} onChange={(e) => { setSelectedJdId(e.target.value); setHireQuantity(1); }}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700">
                                    <option value="">-- Select Position --</option>
                                    {openScopeJDs.map(jd => (
                                        <option key={jd.id} value={jd.id}>{jd.title} — {(jd._count?.employees || 0)}/{jd.plannedCount}</option>
                                    ))}
                                </select>
                                {formDeptId && openScopeJDs.length === 0 && (
                                    <p className="text-[11px] font-bold text-amber-600 mt-2">
                                        No positions with open slots here. Switch to <b>JD Change</b> to expand a full position or add a new one.
                                    </p>
                                )}
                            </div>
                            {selJd && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                                        {t('how_many_to_hire', { defaultValue: 'How many to hire' })}
                                        <span className="ml-2 text-slate-400 normal-case font-bold">({openSlots} {t('open_slots_available', { defaultValue: 'open slot(s) available' })})</span>
                                    </label>
                                    <input
                                        type="number" min={1} max={openSlots} value={hireQuantity}
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value, 10) || 1;
                                            setHireQuantity(Math.min(openSlots, Math.max(1, v)));
                                        }}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"
                                    />
                                    <p className="text-[11px] font-medium text-slate-400 mt-1">{t('quantity_hint', { defaultValue: 'Request only the number you need — you don\'t have to fill all open slots at once.' })}</p>
                                </div>
                            )}

                            {/* Personnel Requisition Form details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('reports_to', { defaultValue: 'Reports To' })} <span className="text-slate-400" dir="rtl">/ يقدم تقاريره إلى</span></label>
                                    <input type="text" value={reportsTo} onChange={(e) => setReportsTo(e.target.value)} placeholder="e.g. Head of Finance"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('employment_type', { defaultValue: 'Employment Type' })}</label>
                                    <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700">
                                        <option value="">{t('select', { defaultValue: 'Select...' })}</option>
                                        <option value="Full-time">Full-time / دوام كامل</option>
                                        <option value="Part-time">Part-time / دوام جزئي</option>
                                        <option value="Contract">Contract / عقد</option>
                                        <option value="Temporary">Temporary / مؤقت</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('type_of_request', { defaultValue: 'Type of Request' })}</label>
                                    <select value={typeOfRequest} onChange={(e) => setTypeOfRequest(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700">
                                        <option value="">{t('select', { defaultValue: 'Select...' })}</option>
                                        <option value="New Position">New Position / وظيفة جديدة</option>
                                        <option value="Replacement">Replacement / إحلال</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('english_language', { defaultValue: 'English Language' })}</label>
                                    <input type="text" value={languageEn} onChange={(e) => setLanguageEn(e.target.value)} placeholder="e.g. Fluent / Good / Basic"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{t('arabic_language', { defaultValue: 'Arabic Language' })}</label>
                                    <input type="text" value={languageAr} onChange={(e) => setLanguageAr(e.target.value)} placeholder="e.g. Native / Fluent"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700" />
                                </div>
                            </div>
                        </div>
                            );
                        })()
                    ) : (
                        <div className="space-y-4">
                            {/* JD change mode */}
                            <div className="flex gap-3">
                                <button type="button" onClick={() => { setJdMode('new'); setSelectedJdId(''); setJdForm(emptyJDForm()); }}
                                    className={`flex-1 p-3 rounded-xl border-2 text-sm font-bold transition-all ${jdMode === 'new' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500'}`}>
                                    Add New Position
                                </button>
                                <button type="button" onClick={() => setJdMode('edit')}
                                    className={`flex-1 p-3 rounded-xl border-2 text-sm font-bold transition-all ${jdMode === 'edit' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500'}`}>
                                    Edit Existing Position
                                </button>
                            </div>

                            {jdMode === 'edit' && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Position to Edit</label>
                                    <select value={selectedJdId} onChange={(e) => loadJdForEdit(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700">
                                        <option value="">-- Select Position --</option>
                                        {scopeJDs.map(jd => <option key={jd.id} value={jd.id}>{jd.title} — {(jd._count?.employees || 0)}/{jd.plannedCount}</option>)}
                                    </select>
                                </div>
                            )}

                            {(jdMode === 'new' || (jdMode === 'edit' && selectedJdId)) && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <JobDescriptionFields value={jdForm} onChange={setJdForm} />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => { resetForm(); navigate('/recruitment/requests'); }}
                            className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
                        <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Submit Requisition</button>
                    </div>
                </form>
            </div>
            )}

        </div>
    );
};

export default Recruitment;
