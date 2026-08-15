import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { userService } from '../../services/userService';
import { departmentService, divisionService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { employeeService } from '../../services/employeeService';
import type { User, UserRole, Department, Unit, Employee, Division } from '../../types';
import {
    ArrowLeft,
    Mail,
    User as UserIcon,
    Shield,
    ShieldCheck,
    Briefcase,
    Save,
    AlertTriangle,
    Key,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Permission catalog — the single source of truth for every toggle shown on the
// Authority Enrollment page. Grouped so we can render cards and offer per-group
// "select all / clear" controls. Every id here must line up with the permission
// strings checked in MainLayout / ProtectedRoute for the toggle to actually gate
// something.
// ---------------------------------------------------------------------------
type PermItem = { id: string; labelKey: string; labelDefault: string };
type PermGroup = { key: string; titleKey: string; titleDefault: string; perms: PermItem[] };

export const PERMISSION_GROUPS: PermGroup[] = [
    {
        key: 'employees', titleKey: 'perm_cat_employees', titleDefault: 'Employees & Directory', perms: [
            { id: 'view_directory', labelKey: 'perm_view_directory', labelDefault: 'View Directory' },
            { id: 'view_employees', labelKey: 'perm_view_employees', labelDefault: 'View Full Emp Data' },
            { id: 'manage_employees', labelKey: 'perm_manage_employees', labelDefault: 'Manage Emp Records' },
            { id: 'register_employees', labelKey: 'perm_register_employees', labelDefault: 'Register New Emp' },
            { id: 'edit_employees', labelKey: 'perm_edit_employees', labelDefault: 'Edit Emp Data' },
            { id: 'delete_employees', labelKey: 'perm_delete_employees', labelDefault: 'Delete Emp' },
        ]
    },
    {
        key: 'recruitment', titleKey: 'perm_cat_recruitment', titleDefault: 'Recruitment', perms: [
            { id: 'view_recruitment', labelKey: 'perm_view_recruitment', labelDefault: 'View Recruitment' },
            { id: 'manage_recruitment', labelKey: 'perm_manage_recruitment', labelDefault: 'Manage Requests & Hiring' },
            { id: 'recruitment_approvals', labelKey: 'perm_recruitment_approvals', labelDefault: 'Approve Recruitment' },
            { id: 'approve_hr_manager', labelKey: 'perm_approve_hr_manager', labelDefault: 'Approve as Head of HR' },
            { id: 'approve_hr_recruitment', labelKey: 'perm_approve_hr_recruitment', labelDefault: 'Approve as Head of Recruitment' },
        ]
    },
    {
        key: 'contracts', titleKey: 'perm_cat_contracts', titleDefault: 'Contracts & Lifecycle', perms: [
            { id: 'view_contracts', labelKey: 'perm_view_contracts', labelDefault: 'View Contracts' },
            { id: 'manage_contract_management', labelKey: 'perm_manage_contracts', labelDefault: 'Manage Contracts' },
            { id: 'view_lifecycle', labelKey: 'perm_view_lifecycle', labelDefault: 'View Lifecycle' },
            { id: 'manage_lifecycle_control', labelKey: 'perm_manage_lifecycle', labelDefault: 'Manage Lifecycle' },
        ]
    },
    {
        key: 'payroll', titleKey: 'perm_cat_payroll', titleDefault: 'Payroll & Time', perms: [
            { id: 'view_payroll', labelKey: 'perm_view_payroll', labelDefault: 'View Payroll' },
            { id: 'manage_payroll', labelKey: 'perm_manage_payroll', labelDefault: 'Manage Payroll' },
            { id: 'view_time_tracking', labelKey: 'perm_view_time_tracking', labelDefault: 'View Time Logs' },
            { id: 'manage_time_tracking', labelKey: 'perm_manage_time_tracking', labelDefault: 'Manage Time Logs' },
        ]
    },
    {
        key: 'ops', titleKey: 'perm_cat_ops', titleDefault: 'Operations & Approvals', perms: [
            { id: 'manage_leaves', labelKey: 'perm_manage_leaves', labelDefault: 'Approve Leaves' },
            { id: 'approve_attendance', labelKey: 'perm_approve_attendance', labelDefault: 'Head of Attendance Approval' },
            { id: 'manage_tasks', labelKey: 'perm_manage_tasks', labelDefault: 'Manage Tasks' },
            { id: 'manage_announcements', labelKey: 'perm_manage_announcements', labelDefault: 'Post Announcements' },
            { id: 'manager_approvals', labelKey: 'perm_manager_approvals', labelDefault: 'Full Mgr Approvals' },
        ]
    },
    {
        key: 'evaluations', titleKey: 'perm_cat_evaluations', titleDefault: 'Evaluations', perms: [
            { id: 'view_evaluations', labelKey: 'perm_view_evaluations', labelDefault: 'View All Evaluations' },
            { id: 'view_hr_evaluations', labelKey: 'perm_view_hr_evaluations', labelDefault: 'Manage HR Evals' },
            { id: 'manage_evaluation_control', labelKey: 'perm_manage_eval_control', labelDefault: 'Evaluation Control' },
        ]
    },
    {
        key: 'operational', titleKey: 'perm_cat_operational', titleDefault: 'IT & Operational Services', perms: [
            { id: 'manage_onboarding', labelKey: 'perm_manage_onboarding', labelDefault: 'Manage Onboarding (Assets)' },
            { id: 'manage_it_issues', labelKey: 'perm_manage_it_issues', labelDefault: 'Manage IT Support Tickets' },
        ]
    },
    {
        key: 'admin', titleKey: 'perm_cat_admin', titleDefault: 'Administration', perms: [
            { id: 'manage_groups', labelKey: 'perm_manage_groups', labelDefault: 'Manage Groups' },
            { id: 'manage_departments', labelKey: 'perm_manage_departments', labelDefault: 'Manage Depts' },
            { id: 'manage_units', labelKey: 'perm_manage_units', labelDefault: 'Manage Units' },
            { id: 'manage_job_descriptions', labelKey: 'perm_manage_job_descriptions', labelDefault: 'Manage Job Descriptions' },
            { id: 'manage_users', labelKey: 'perm_manage_users', labelDefault: 'Manage System Users' },
        ]
    },
];

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.id));

// Recommended permission preset per role. Picking a role auto-applies these
// (still fully editable afterwards). SUPER_ADMIN implicitly gets everything.
export const ROLE_PRESETS: Record<string, string[]> = {
    EMPLOYEE: [],
    HEAD_UNIT: ['view_directory', 'manage_leaves', 'manage_tasks', 'manager_approvals', 'view_evaluations', 'view_recruitment'],
    HEAD_DEPARTMENT: ['view_directory', 'view_employees', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment'],
    HEAD_OFFICE: ['view_directory', 'view_employees', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment'],
    HEAD_DIVISION: ['view_directory', 'view_employees', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals'],
    HEAD_DIRECTOR: ['view_directory', 'view_employees', 'view_contracts', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals'],
    GENERAL_MANAGER: ['view_directory', 'view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'manage_announcements', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
    CHAIRMAN: ['view_directory', 'view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
    HR_MANAGER: ['view_directory', 'view_employees', 'manage_employees', 'register_employees', 'edit_employees', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'approve_hr_manager', 'view_contracts', 'manage_contract_management', 'view_lifecycle', 'manage_lifecycle_control', 'view_payroll', 'manage_payroll', 'view_time_tracking', 'manage_time_tracking', 'manage_leaves', 'manage_announcements', 'view_evaluations', 'view_hr_evaluations', 'manage_evaluation_control', 'manage_onboarding', 'manage_job_descriptions'],
    PERSONNEL: ['view_directory', 'view_employees', 'register_employees', 'edit_employees', 'view_evaluations', 'view_lifecycle', 'manage_onboarding', 'manage_it_issues'],
    SUPER_ADMIN: ALL_PERMISSION_IDS,
};

export const presetForRole = (role: string): string[] =>
    role === 'SUPER_ADMIN' ? [...ALL_PERMISSION_IDS] : [...(ROLE_PRESETS[role] || [])];

const ROLE_OPTIONS: { value: UserRole; labelKey: string; labelDefault: string }[] = [
    { value: 'EMPLOYEE', labelKey: 'role_employee', labelDefault: 'Employee' },
    { value: 'HEAD_UNIT', labelKey: 'role_head_unit', labelDefault: 'Head of Unit' },
    { value: 'HEAD_DEPARTMENT', labelKey: 'role_head_department', labelDefault: 'Head of Department' },
    { value: 'HEAD_OFFICE', labelKey: 'role_head_office', labelDefault: 'Head of Office' },
    { value: 'HEAD_DIVISION', labelKey: 'role_head_division', labelDefault: 'Head of Division' },
    { value: 'HEAD_DIRECTOR', labelKey: 'role_head_director', labelDefault: 'Head of Directorate' },
    { value: 'HR_MANAGER', labelKey: 'role_hr_manager', labelDefault: 'HR Manager' },
    { value: 'GENERAL_MANAGER', labelKey: 'role_general_manager', labelDefault: 'General Manager' },
    { value: 'CHAIRMAN', labelKey: 'role_chairman', labelDefault: 'Chairman' },
    { value: 'PERSONNEL', labelKey: 'role_personnel', labelDefault: 'Personnel' },
];

const PermissionCheckbox: React.FC<{ id: string; label: string; checked: boolean; onChange: (id: string, checked: boolean) => void }> = ({ id, label, checked, onChange }) => (
    <label className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group border ${checked ? 'bg-white border-indigo-200 shadow-sm' : 'border-transparent hover:bg-white hover:border-slate-100'}`}>
        <input
            type="checkbox"
            className="app-check"
            checked={checked}
            onChange={(e) => onChange(id, e.target.checked)}
        />
        <span className={`text-[11px] font-bold transition-colors uppercase tracking-tight ${checked ? 'text-indigo-700' : 'text-slate-600 group-hover:text-slate-900'}`}>{label}</span>
    </label>
);

const inputClass = 'w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:ring-2 focus:ring-indigo-100 focus:bg-white focus:border-indigo-200 transition-all font-bold text-slate-800';
const selectClass = 'w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:ring-2 focus:ring-indigo-100 focus:bg-white focus:border-indigo-200 transition-all font-bold text-slate-800 appearance-none';

const UserForm: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);

    const [departments, setDepartments] = useState<Department[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    const initialFormState = {
        email: '',
        password: '',
        fullName: '',
        role: 'EMPLOYEE' as UserRole,
        groupId: '',
        divisionId: '',
        departmentId: '',
        unitId: '',
        departmentIds: [] as string[],
        employeeId: '',
        permissions: [] as string[],
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [deptsData, unitsData, empsData, divsData, usersData] = await Promise.all([
                    departmentService.getAllDepartments(),
                    unitService.getAllUnits(),
                    employeeService.getAllEmployees(),
                    divisionService.getAllDivisions().catch(() => []),
                    isEditMode ? userService.getAllUsers() : Promise.resolve([] as User[]),
                ]);
                setDepartments(deptsData);
                setUnits(unitsData);
                setEmployees(empsData);
                setDivisions(divsData);

                if (isEditMode && id) {
                    const user = usersData.find(u => u.id === id);
                    if (!user) {
                        toast.error(t('user_not_found', { defaultValue: 'User not found.' }));
                        navigate('/users');
                        return;
                    }
                    setEditingUserId(user.id);
                    // If the account has no permissions stored yet (e.g. it was auto-created from
                    // Personnel & Workforce before defaults were seeded), fall back to the role's
                    // recommended preset so the admin sees the expected access pre-selected and can
                    // simply toggle off what they don't want.
                    const existingPerms = user.permissions && user.permissions.length
                        ? user.permissions
                        : presetForRole(user.role);
                    setFormData({
                        email: user.email,
                        password: '',
                        fullName: user.fullName || '',
                        role: user.role,
                        groupId: user.groupId || '',
                        divisionId: user.divisionId || '',
                        departmentId: user.departmentId || '',
                        unitId: user.unitId || '',
                        departmentIds: user.departmentIds || [],
                        employeeId: user.employeeId || '',
                        permissions: existingPerms,
                    });
                }
            } catch (error) {
                console.error('Error loading user form data:', error);
                toast.error(t('error_loading_data', { defaultValue: 'Failed to load data.' }));
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isEditMode]);

    const togglePermission = (permId: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            permissions: checked ? [...prev.permissions, permId] : prev.permissions.filter(p => p !== permId),
        }));
    };

    const setGroupPermissions = (group: PermGroup, on: boolean) => {
        const ids = group.perms.map(p => p.id);
        setFormData(prev => {
            const without = prev.permissions.filter(p => !ids.includes(p));
            return { ...prev, permissions: on ? [...without, ...ids] : without };
        });
    };

    const applyRolePreset = (role: string) => {
        setFormData(prev => ({ ...prev, permissions: presetForRole(role) }));
    };

    // Linking an employee record is OPTIONAL — a system user does not have to be an employee.
    // Offer any employee not already linked to another account (plus the current one in edit mode).
    const linkableEmployees = employees.filter(emp => !emp.userId || emp.userId === editingUserId);

    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: any = {
                email: formData.email,
                fullName: formData.fullName,
                role: formData.role,
                groupId: formData.groupId || undefined,
                divisionId: formData.divisionId || undefined,
                departmentId: formData.departmentId || undefined,
                unitId: formData.unitId || undefined,
                departmentIds: formData.departmentIds,
                employeeId: formData.employeeId || undefined,
                permissions: formData.permissions,
            };

            if (isEditMode && editingUserId) {
                if (formData.password) payload.password = formData.password;
                await userService.updateUser(editingUserId, payload);
                toast.success(t('user_updated_success'));
            } else {
                await userService.createUser({ ...payload, password: formData.password || '123456' });
                toast.success(t('user_created_success'));
            }
            navigate('/users');
        } catch (error: any) {
            console.error('Error saving user:', error);
            toast.error(error.response?.data?.error || t('error_saving_user'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#7c3aed' }}></div>
        </div>
    );

    const showScope = ['HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT'].includes(formData.role);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-36">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/users')}
                        className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-outfit font-bold text-slate-800 tracking-tight">
                            {isEditMode ? t('policy_modification', { defaultValue: 'Modify Access Policy' }) : t('authority_enrollment', { defaultValue: 'Authority Enrollment' })}
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm">{t('authority_enrollment_subtitle', { defaultValue: 'Provision a system account and grant precisely the access it needs.' })}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* 1. Identity & Credentials */}
                <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/60">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                            <UserIcon size={20} />
                        </div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('user_credentials_setup', { defaultValue: 'Identity & Credentials' })}</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('full_name')}</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className={inputClass} placeholder={t('enter_full_name')} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('corporate_email', { defaultValue: 'Login Email' })}</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder={t('email_placeholder')} />
                            </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                {isEditMode ? t('new_password_optional', { defaultValue: 'New Password (Optional)' }) : t('password')}
                            </label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="password"
                                    required={!isEditMode}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={inputClass}
                                    placeholder={isEditMode ? t('leave_blank_to_keep', { defaultValue: 'Leave blank to keep current' }) : t('enter_password')}
                                />
                            </div>
                            {!isEditMode && (
                                <p className="text-[10px] text-slate-400 italic">{t('default_password_hint', { defaultValue: 'If left blank, a default password of "123456" is set.' })}</p>
                            )}
                        </div>
                    </div>
                </section>

                {/* 2. Role */}
                <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/60">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                            <Shield size={20} />
                        </div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('permission_tier', { defaultValue: 'Access Role' })}</h2>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('system_access_role', { defaultValue: 'System Access Role' })}</label>
                        <div className="relative">
                            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={formData.role}
                                onChange={(e) => {
                                    const newRole = e.target.value as UserRole;
                                    setFormData(prev => ({ ...prev, role: newRole, permissions: presetForRole(newRole) }));
                                }}
                                className={`${selectClass} pl-10`}
                            >
                                {ROLE_OPTIONS.map(r => (
                                    <option key={r.value} value={r.value}>{t(r.labelKey, { defaultValue: r.labelDefault })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">{t('role_preset_notice', { defaultValue: 'Recommended Permissions Applied' })}</p>
                                <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                                    {t('role_preset_note', { defaultValue: 'A recommended set of permissions for this role has been pre-selected below. This is a standalone system account — an employee record is optional. Fine-tune the toggles for exactly what this user should access.' })}
                                </p>
                            </div>
                            <button type="button" onClick={() => applyRolePreset(formData.role)} className="shrink-0 px-3 py-1.5 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-200 hover:bg-indigo-100 transition-all">
                                {t('reset_to_recommended', { defaultValue: 'Reset to Recommended' })}
                            </button>
                        </div>
                    </div>

                    {/* Scope selectors for head roles */}
                    {showScope && (
                        <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{t('authority_scope', { defaultValue: 'Authority Scope' })}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {formData.role === 'HEAD_DIVISION' && (
                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('assigned_division', { defaultValue: 'Assigned Division' })}</label>
                                        <p className="text-[11px] text-slate-400 -mt-1">{t('assigned_division_hint', { defaultValue: 'This head approves for every department in the chosen division — leave requests from those employees route through them automatically.' })}</p>
                                        <select value={formData.divisionId} onChange={(e) => setFormData({ ...formData, divisionId: e.target.value })} className={selectClass}>
                                            <option value="">{t('select_division', { defaultValue: 'Select Division' })}</option>
                                            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {formData.role === 'HEAD_OFFICE' && (
                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('assigned_office', { defaultValue: 'Assigned Office' })}</label>
                                        <select value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })} className={selectClass}>
                                            <option value="">{t('select_office', { defaultValue: 'Select Office' })}</option>
                                            {departments.filter(d => d.isOffice).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {formData.role === 'HEAD_DIRECTOR' && (
                                    <div className="space-y-3 sm:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('assigned_departments')}</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            {departments.map(d => (
                                                <label key={d.id} className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.departmentIds.includes(d.id)}
                                                        onChange={(e) => {
                                                            const newIds = e.target.checked ? [...formData.departmentIds, d.id] : formData.departmentIds.filter(x => x !== d.id);
                                                            setFormData({ ...formData, departmentIds: newIds });
                                                        }}
                                                        className="app-check"
                                                    />
                                                    <span className="text-sm font-bold text-slate-700">{d.name}</span>
                                                </label>
                                            ))}
                                            {departments.length === 0 && (
                                                <p className="text-xs text-slate-400 italic col-span-2">{t('no_departments_available', { defaultValue: 'No departments available' })}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {(formData.role === 'HEAD_DEPARTMENT' || formData.role === 'HEAD_UNIT') && (
                                    <>
                                        <div className="space-y-2 sm:col-span-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('primary_department')}</label>
                                            <select value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value, unitId: '' })} className={selectClass}>
                                                <option value="">{t('select_department')}</option>
                                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        {formData.role === 'HEAD_UNIT' && (
                                            <div className="space-y-2 sm:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('unit', { defaultValue: 'Unit' })}</label>
                                                <select value={formData.unitId} onChange={(e) => setFormData({ ...formData, unitId: e.target.value })} className={selectClass}>
                                                    <option value="">{t('select_unit', { defaultValue: 'Select Unit' })}</option>
                                                    {units.filter(u => !formData.departmentId || u.departmentId === formData.departmentId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* 3. Optional personnel link */}
                <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/60">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                            <Briefcase size={20} />
                        </div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            {t('associate_with_personnel', { defaultValue: 'Personnel Record' })}
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[8px] font-black tracking-widest">{t('optional', { defaultValue: 'OPTIONAL' })}</span>
                        </h2>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('select_employee', { defaultValue: 'Select Employee (Optional)' })}</label>
                        <div className="relative">
                            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={formData.employeeId}
                                onChange={(e) => {
                                    const emp = employees.find(x => x.id === e.target.value);
                                    setFormData({
                                        ...formData,
                                        employeeId: e.target.value,
                                        fullName: (!formData.fullName && emp) ? emp.fullName : formData.fullName,
                                        email: (!formData.email && emp?.email) ? emp.email : formData.email,
                                        groupId: emp?.groupId || formData.groupId,
                                        departmentId: emp?.departmentId || formData.departmentId,
                                        unitId: emp?.unitId || formData.unitId,
                                    });
                                }}
                                className={`${selectClass} pl-10`}
                            >
                                <option value="">{t('not_associated', { defaultValue: 'Standalone user — not linked to any employee' })}</option>
                                {linkableEmployees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.position || emp.role})</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                            {t('link_notice', { defaultValue: 'Linking an account allows the user to see their own HR data (contracts, holidays) when logged in.' })}
                        </p>
                    </div>
                </section>

                {/* 4. Permissions */}
                <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/60">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-sm">
                                <ShieldCheck size={20} />
                            </div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('permissions_and_access', { defaultValue: 'Permissions & Access' })}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                                {formData.permissions.length}/{ALL_PERMISSION_IDS.length} {t('selected', { defaultValue: 'Selected' })}
                            </span>
                            <button type="button" onClick={() => setFormData({ ...formData, permissions: [...ALL_PERMISSION_IDS] })} className="px-3 py-1.5 bg-white text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all">
                                {t('select_all', { defaultValue: 'Select All' })}
                            </button>
                            <button type="button" onClick={() => setFormData({ ...formData, permissions: [] })} className="px-3 py-1.5 bg-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-red-50 transition-all">
                                {t('clear_all', { defaultValue: 'Clear All' })}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {PERMISSION_GROUPS.map(group => {
                            const groupIds = group.perms.map(p => p.id);
                            const activeCount = groupIds.filter(gid => formData.permissions.includes(gid)).length;
                            const allOn = activeCount === groupIds.length;
                            return (
                                <div key={group.key} className={`space-y-3 p-4 rounded-2xl border transition-all ${activeCount > 0 ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                            {t(group.titleKey, { defaultValue: group.titleDefault })}
                                            {activeCount > 0 && <span className="ml-1.5 text-slate-400">({activeCount})</span>}
                                        </h5>
                                        <button type="button" onClick={() => setGroupPermissions(group, !allOn)} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider">
                                            {allOn ? t('clear', { defaultValue: 'Clear' }) : t('all', { defaultValue: 'All' })}
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {group.perms.map(perm => (
                                            <PermissionCheckbox key={perm.id} id={perm.id} label={t(perm.labelKey, { defaultValue: perm.labelDefault })} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">{t('active_environment_warning')}</p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                            {t('creation_mode_alert', { defaultValue: 'Security notice: All configuration changes are recorded and applied to the production environment.' })}
                        </p>
                    </div>
                </div>

            </form>

            {/* Fixed action bar — pinned to the bottom of the content column (right of the
                sidebar) so Cancel / Save stay visible while scrolling the long form. */}
            <div
                className="fixed bottom-0 right-0 z-30 px-6 lg:px-10 pb-6 pt-2 pointer-events-none transition-[left] duration-500"
                style={{ left: 'var(--sidebar-width, 0px)' }}
            >
                <div className="max-w-6xl mx-auto flex gap-4 p-4 bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-2xl shadow-slate-300/40 pointer-events-auto">
                    <button type="button" onClick={() => navigate('/users')} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                        {t('cancel')}
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 px-6 py-4 rounded-xl bg-slate-900 text-white font-bold shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2">
                        <Save size={18} />
                        {saving ? t('saving', { defaultValue: 'Saving…' }) : isEditMode ? t('save_policy', { defaultValue: 'Save Policy' }) : t('enroll_identity', { defaultValue: 'Enroll Identity' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserForm;
