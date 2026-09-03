import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { userService } from '../../services/userService';
import { departmentService, divisionService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { employeeService } from '../../services/employeeService';
import type { User, UserRole, Department, Unit, Employee, Division, FunctionalHat, AccessCatalog } from '../../types';
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
    Layers,
    Lock,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// The permission catalog + each position's default bundle are now served by the
// backend (/access-catalog) so there is ONE source of truth. This screen groups
// them for display and layers three additive sources into an effective set:
//   position defaults  ∪  functional hats  ∪  individual grants   (add-only)
// ---------------------------------------------------------------------------
type PermItem = { id: string; label: string };
type PermGroup = { key: string; title: string; perms: PermItem[] };

// Build display groups (preserving catalog order) from the fetched catalog.
const buildGroups = (catalog: AccessCatalog | null): PermGroup[] => {
    if (!catalog) return [];
    const order: string[] = [];
    const map = new Map<string, PermItem[]>();
    for (const p of catalog.permissions) {
        if (!map.has(p.group)) { map.set(p.group, []); order.push(p.group); }
        map.get(p.group)!.push({ id: p.id, label: p.label });
    }
    return order.map(g => ({ key: g, title: g, perms: map.get(g)! }));
};

// Organizational positions (a user holds exactly one). HR Manager / Personnel are deliberately NOT
// offered here anymore — the correct pattern is a real position (e.g. Head of Department) plus the
// matching Functional Hat layered on top, which already carries the full HR Manager / Personnel
// permission bundle (see accessCatalog.ts). Any pre-existing account still carrying one of those two
// role strings keeps working exactly as before; it's just no longer an assignable choice going forward.
const POSITION_OPTIONS: { value: UserRole; labelDefault: string }[] = [
    { value: 'EMPLOYEE', labelDefault: 'Employee' },
    { value: 'HEAD_UNIT', labelDefault: 'Head of Unit' },
    { value: 'HEAD_DEPARTMENT', labelDefault: 'Head of Department' },
    { value: 'HEAD_OFFICE', labelDefault: 'Head of Office' },
    { value: 'HEAD_DIVISION', labelDefault: 'Head of Division' },
    { value: 'HEAD_DIRECTOR', labelDefault: 'Head of Directorate' },
    { value: 'GENERAL_MANAGER', labelDefault: 'General Manager' },
    { value: 'CHAIRMAN', labelDefault: 'Chairman' },
];

const PermissionCheckbox: React.FC<{
    id: string; label: string; checked: boolean; locked?: boolean; sources?: string[];
    onChange: (id: string, checked: boolean) => void;
}> = ({ id, label, checked, locked = false, sources = [], onChange }) => {
    const { t } = useTranslation();
    return (
    <label
        title={locked ? t('granted_by', { defaultValue: 'Granted by: {{sources}}', sources: sources.join(', ') }) : undefined}
        className={`flex items-center gap-3 p-2 rounded-xl transition-all border ${locked
            ? 'bg-emerald-50/60 border-emerald-100 cursor-default'
            : checked ? 'bg-white border-indigo-200 shadow-sm cursor-pointer' : 'border-transparent hover:bg-white hover:border-slate-100 cursor-pointer'}`}
    >
        <input
            type="checkbox"
            className="app-check"
            checked={checked}
            disabled={locked}
            onChange={(e) => onChange(id, e.target.checked)}
        />
        <span className={`flex-1 text-[11px] font-bold transition-colors uppercase tracking-tight ${locked ? 'text-emerald-700' : checked ? 'text-indigo-700' : 'text-slate-600'}`}>{label}</span>
        {locked && <Lock className="w-3 h-3 text-emerald-500 shrink-0" />}
    </label>
    );
};

const inputClass = 'w-full ps-10 pe-4 py-3 bg-slate-50 border border-transparent rounded-xl focus:ring-2 focus:ring-indigo-100 focus:bg-white focus:border-indigo-200 transition-all font-bold text-slate-800';
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
    const [hats, setHats] = useState<FunctionalHat[]>([]);
    const [catalog, setCatalog] = useState<AccessCatalog | null>(null);
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
        permissions: [] as string[], // individual GRANTS (extras beyond position + hats)
        functionalHatIds: [] as string[],
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [deptsData, unitsData, empsData, divsData, hatsData, catalogData, usersData] = await Promise.all([
                    departmentService.getAllDepartments(),
                    unitService.getAllUnits(),
                    employeeService.getAllEmployees(),
                    divisionService.getAllDivisions().catch(() => []),
                    userService.getFunctionalHats().catch(() => [] as FunctionalHat[]),
                    userService.getAccessCatalog().catch(() => null),
                    isEditMode ? userService.getAllUsers() : Promise.resolve([] as User[]),
                ]);
                setDepartments(deptsData);
                setUnits(unitsData);
                setEmployees(empsData);
                setDivisions(divsData);
                setHats(hatsData);
                setCatalog(catalogData);

                if (isEditMode && id) {
                    const user = usersData.find(u => u.id === id);
                    if (!user) {
                        toast.error(t('user_not_found', { defaultValue: 'User not found.' }));
                        navigate('/users');
                        return;
                    }
                    setEditingUserId(user.id);
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
                        permissions: user.permissions || [], // raw individual grants
                        functionalHatIds: user.functionalHatIds || [],
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

    // Display groups + catalog-derived ids.
    const groups = buildGroups(catalog);
    const allPermIds = catalog ? catalog.permissions.map(p => p.id) : [];

    // Inherited permissions come from the position's default bundle and every
    // selected hat. Map each inherited permission id → the sources granting it
    // (so we can show a badge and lock the toggle — add-only, can't be removed).
    const inheritedSources = new Map<string, string[]>();
    const addSource = (perm: string, src: string) => {
        const cur = inheritedSources.get(perm) || [];
        if (!cur.includes(src)) cur.push(src);
        inheritedSources.set(perm, cur);
    };
    if (formData.role === 'SUPER_ADMIN') {
        allPermIds.forEach(p => addSource(p, t('role_super_admin', { defaultValue: 'Super Admin' })));
    } else {
        (catalog?.positionDefaults[formData.role] || []).forEach(p => addSource(p, t('position', { defaultValue: 'Position' })));
        hats.filter(h => formData.functionalHatIds.includes(h.id))
            .forEach(h => h.permissions.forEach(p => addSource(p, h.name)));
    }
    const isInherited = (permId: string) => inheritedSources.has(permId);
    // Effective = inherited ∪ grants.
    const effectiveSet = new Set<string>([...inheritedSources.keys(), ...formData.permissions]);

    const togglePermission = (permId: string, checked: boolean) => {
        if (isInherited(permId)) return; // locked — comes from position/hat
        setFormData(prev => ({
            ...prev,
            permissions: checked ? [...prev.permissions, permId] : prev.permissions.filter(p => p !== permId),
        }));
    };

    // Toggle every non-inherited permission in a group on/off (grants only).
    const setGroupPermissions = (group: PermGroup, on: boolean) => {
        const ids = group.perms.map(p => p.id).filter(pid => !isInherited(pid));
        setFormData(prev => {
            const without = prev.permissions.filter(p => !ids.includes(p));
            return { ...prev, permissions: on ? [...without, ...ids] : without };
        });
    };

    const toggleHat = (hatId: string) => {
        setFormData(prev => ({
            ...prev,
            functionalHatIds: prev.functionalHatIds.includes(hatId)
                ? prev.functionalHatIds.filter(h => h !== hatId)
                : [...prev.functionalHatIds, hatId],
        }));
    };

    // Linking an employee record is OPTIONAL — a system user does not have to be an employee.
    // Offer any employee not already linked to another account (plus the current one in edit mode).
    const linkableEmployees = employees.filter(emp => !emp.userId || emp.userId === editingUserId);

    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Persist ONLY the extra grants (strip anything already covered by the
            // position or a hat) so grants stay meaningful and don't shadow hats.
            const grantsOnly = formData.permissions.filter(p => !inheritedSources.has(p));
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
                permissions: grantsOnly,
                functionalHatIds: formData.functionalHatIds,
            };

            if (isEditMode && editingUserId) {
                if (formData.password) payload.password = formData.password;
                const updated: any = await userService.updateUser(editingUserId, payload);
                toast.success(t('user_updated_success'));
                if (updated?.employeeSyncError) toast.error(updated.employeeSyncError);
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
                                <UserIcon className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className={inputClass} placeholder={t('enter_full_name')} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('corporate_email', { defaultValue: 'Login Email' })}</label>
                            <div className="relative">
                                <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} placeholder={t('email_placeholder')} />
                            </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                {isEditMode ? t('new_password_optional', { defaultValue: 'New Password (Optional)' }) : t('password')}
                            </label>
                            <div className="relative">
                                <Key className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('organizational_position', { defaultValue: 'Organizational Position' })}</h2>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('position_in_hierarchy', { defaultValue: 'Position in the hierarchy' })}</label>
                        <div className="relative">
                            <Shield className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                                className={`${selectClass} ps-10`}
                            >
                                {POSITION_OPTIONS.map(r => (
                                    <option key={r.value} value={r.value}>{t(`role_${r.value.toLowerCase()}`, { defaultValue: r.labelDefault })}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">{t('position_grants_defaults', { defaultValue: 'Position grants its default access automatically' })}</p>
                                <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                                    {t('position_note', { defaultValue: 'Each position comes with a default set of permissions (shown locked below). Add Functional Hats and Individual Grants on top — access only ever stacks, never shrinks. For someone who needs HR Manager / Personnel access, keep their real position and add the matching Functional Hat below.' })}
                                </p>
                            </div>
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

                {/* 2b. Functional Hats — stackable duty bundles on top of the position */}
                <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/60">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('functional_hats', { defaultValue: 'Functional Hats' })}</h2>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t('functional_hats_sub', { defaultValue: 'Extra duties this person can hold at the same time as their position. Each adds its permissions.' })}</p>
                            </div>
                        </div>
                        {formData.functionalHatIds.length > 0 && (
                            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest">
                                {formData.functionalHatIds.length} {t('active', { defaultValue: 'Active' })}
                            </span>
                        )}
                    </div>
                    {hats.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">{t('no_hats_yet', { defaultValue: 'No functional hats defined yet. Create them from Access Management → Functional Hats.' })}</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {hats.map(hat => {
                                const on = formData.functionalHatIds.includes(hat.id);
                                return (
                                    <button
                                        type="button"
                                        key={hat.id}
                                        onClick={() => toggleHat(hat.id)}
                                        className={`text-start p-4 rounded-2xl border transition-all ${on ? 'bg-amber-50/70 border-amber-300 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm font-black ${on ? 'text-amber-800' : 'text-slate-700'}`}>{hat.name}</span>
                                            <span className={`w-5 h-5 rounded-md flex items-center justify-center border ${on ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 text-transparent'}`}>✓</span>
                                        </div>
                                        {hat.description && <p className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">{hat.description}</p>}
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-2">{hat.permissions.length} {t('permissions', { defaultValue: 'permissions' })}</p>
                                    </button>
                                );
                            })}
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
                            <Briefcase className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                                className={`${selectClass} ps-10`}
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

                {/* 4. Individual permission grants (extras on top of position + hats) */}
                <section className="glass-card rounded-[32px] p-8 shadow-sm border border-slate-100 bg-white/60">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-sm">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('individual_grants', { defaultValue: 'Individual Grants' })}</h2>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t('individual_grants_sub', { defaultValue: 'Give this specific person extra access beyond their position and hats.' })}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                                {effectiveSet.size}/{allPermIds.length} {t('effective', { defaultValue: 'Effective' })}
                            </span>
                            <button type="button" onClick={() => setFormData({ ...formData, permissions: [] })} className="px-3 py-1.5 bg-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-red-50 transition-all">
                                {t('clear_grants', { defaultValue: 'Clear Grants' })}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mb-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3 text-emerald-500" /> {t('from_position_hats', { defaultValue: 'From position / hats (locked)' })}</span>
                        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" /> {t('individual_grant', { defaultValue: 'Individual grant' })}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.map(group => {
                            const effActive = group.perms.filter(p => effectiveSet.has(p.id)).length;
                            const grantable = group.perms.filter(p => !isInherited(p.id)).map(p => p.id);
                            const allGranted = grantable.length > 0 && grantable.every(pid => formData.permissions.includes(pid));
                            return (
                                <div key={group.key} className={`space-y-3 p-4 rounded-2xl border transition-all ${effActive > 0 ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                            {group.title}
                                            {effActive > 0 && <span className="ms-1.5 text-slate-400">({effActive}/{group.perms.length})</span>}
                                        </h5>
                                        {grantable.length > 0 && (
                                            <button type="button" onClick={() => setGroupPermissions(group, !allGranted)} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider">
                                                {allGranted ? t('clear', { defaultValue: 'Clear' }) : t('all', { defaultValue: 'All' })}
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        {group.perms.map(perm => (
                                            <PermissionCheckbox
                                                key={perm.id}
                                                id={perm.id}
                                                label={perm.label}
                                                checked={effectiveSet.has(perm.id)}
                                                locked={isInherited(perm.id)}
                                                sources={inheritedSources.get(perm.id) || []}
                                                onChange={togglePermission}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start">
                    <AlertTriangle className="w-5 h-5 text-amber-500 me-3 mt-0.5 flex-shrink-0" />
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
                className="fixed bottom-0 end-0 z-30 px-6 lg:px-10 pb-6 pt-2 pointer-events-none transition-[left] duration-500"
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
