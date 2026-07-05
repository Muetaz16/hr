import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '../../services/userService';
import { groupService, departmentService, divisionService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import { employeeService } from '../../services/employeeService';
import type { User, UserRole, Group, Department, Unit, Employee, Division } from '../../types';
import Modal from '../../components/Modal';
import {
    Edit,
    Trash2,
    Mail,
    User as UserIcon,
    Shield,
    Building2,
    Briefcase,
    Search,
    MoreVertical,
    ShieldAlert,
    ShieldCheck,
    AlertTriangle,
    Filter,
    ChevronDown,
    Check
} from 'lucide-react';
import { roleThemes } from '../../config/roleThemes';
import { toast } from 'sonner';

const UsersPage: React.FC = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

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
        permissions: [] as string[]
    };
    const [formData, setFormData] = useState(initialFormState);

    // Advanced Multi-Select Filters
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

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

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersData, groupsData, deptsData, unitsData, empsData, divsData] = await Promise.all([
                userService.getAllUsers(),
                groupService.getAllGroups(),
                departmentService.getAllDepartments(),
                unitService.getAllUnits(),
                employeeService.getAllEmployees(),
                divisionService.getAllDivisions().catch(() => [])
            ]);
            setUsers(usersData);
            setGroups(groupsData);
            setDepartments(deptsData);
            setUnits(unitsData);
            setEmployees(empsData);
            setDivisions(divsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getGroupName = (groupId?: string) => groups.find(g => g.id === groupId)?.name || 'N/A';
    const getDeptName = (deptId?: string) => departments.find(d => d.id === deptId)?.name || 'N/A';

    const togglePermission = (id: string, checked: boolean) => {
        const newPerms = checked
            ? [...formData.permissions, id]
            : formData.permissions.filter(p => p !== id);
        setFormData({ ...formData, permissions: newPerms });
    };

    const PermissionCheckbox = ({ id, label, checked, onChange }: { id: string, label: string, checked: boolean, onChange: (id: string, checked: boolean) => void }) => (
        <label className="flex items-center space-x-3 p-2 hover:bg-white rounded-xl transition-all cursor-pointer group shadow-sm border border-transparent hover:border-slate-100">
            <div className="relative flex items-center justify-center">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(id, e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer appearance-none checked:bg-indigo-600 checked:border-indigo-600 peer"
                />
                <svg className="w-3 h-3 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight">{label}</span>
        </label>
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                email: formData.email,
                fullName: formData.fullName,
                role: formData.role,
                groupId: formData.groupId,
                divisionId: formData.divisionId || undefined,
                departmentId: formData.departmentId,
                unitId: formData.unitId || undefined,
                departmentIds: formData.departmentIds,
                employeeId: formData.employeeId || undefined,
                permissions: formData.permissions
            };

            if (editingUser) {
                // Only send password if it's not empty
                if (formData.password) {
                    payload.password = formData.password;
                }
                await userService.updateUser(editingUser.id, payload);
                toast.success(t('user_updated_success'));
            } else {
                await userService.createUser({
                    ...payload,
                    password: formData.password || 'password123'
                });
                toast.success(t('user_created_success'));
            }
            setIsModalOpen(false);
            setEditingUser(null);
            setFormData(initialFormState);
            fetchData();
        } catch (error: any) {
            console.error("Error saving user:", error);
            const msg = error.response?.data?.error || t('error_saving_user');
            toast.error(msg);
        }
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            password: '',
            fullName: user.fullName,
            role: user.role,
            groupId: user.groupId || '',
            divisionId: user.divisionId || '',
            departmentId: user.departmentId || '',
            unitId: user.unitId || '',
            departmentIds: user.departmentIds || [],
            employeeId: user.employeeId || '',
            permissions: user.permissions || []
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (uid: string) => {
        if (confirm(t('confirm_remove_access'))) {
            try {
                await userService.deleteUser(uid);
                toast.success(t('user_deleted_success'));
                fetchData();
            } catch (error: any) {
                console.error("Error deleting user:", error);
                const msg = error.response?.data?.error || t('error_deleting_user');
                toast.error(msg);
            }
        }
    };

    const openNewModal = () => {
        setEditingUser(null);
        setFormData(initialFormState);
        setIsModalOpen(true);
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.fullName || t('unknown_user')).toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesGroup = selectedGroups.length === 0 || selectedGroups.includes(user.groupId || '');
        const matchesUnit = selectedUnits.length === 0 || selectedUnits.includes(user.unitId || '');
        const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(user.role);

        return matchesSearch && matchesGroup && matchesUnit && matchesRole;
    });

    // Filter employees based on roles and scopes
    const filteredEmployees = employees.filter(emp => {
        // If it's a "HEAD" role, filter by that role
        if (['HEAD_UNIT', 'HEAD_DEPARTMENT', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'CHAIRMAN', 'GENERAL_MANAGER'].includes(formData.role)) {
            if (emp.role !== formData.role) return false;
        } else if (formData.role !== 'SUPER_ADMIN' && formData.role !== 'HR_MANAGER' && formData.role !== 'PERSONNEL') {
            // For other roles, match if possible
            if (emp.role !== formData.role) return false;
        }

        // Scope filters
        if (formData.groupId && emp.groupId !== formData.groupId) return false;
        if (formData.divisionId && emp.divisionId !== formData.divisionId) return false;
        if (formData.departmentId && emp.departmentId !== formData.departmentId) return false;
        if (formData.unitId && emp.unitId !== formData.unitId) return false;

        // NEW: Only show unassigned employees, or the one currently linked to this user
        if (emp.userId && emp.userId !== editingUser?.id) return false;

        return true;
    });

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#7c3aed' }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('access_management')}</h1>
                    <p className="text-slate-500 mt-1">{t('access_subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        onClick={openNewModal}
                        className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm group"
                    >
                        <ShieldAlert size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
                        {t('register_system_user')}
                    </button>
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
                                    placeholder={t('query_identity_email')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-80"
                                />
                            </div>
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
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredUsers.length} {t('results')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-300">
                        {/* Group Filter */}
                        <FilterChecklist
                            label={t('all_groups', { defaultValue: 'Groups' })}
                            options={groups.map(g => ({ id: g.id, name: g.name }))}
                            selected={selectedGroups}
                            onChange={setSelectedGroups}
                        />

                        {/* Unit Filter */}
                        <FilterChecklist
                            label={t('all_units', { defaultValue: 'Units' })}
                            options={units.filter(u => {
                                if (selectedGroups.length === 0) return true;
                                const dept = departments.find(d => d.id === u.departmentId);
                                return dept && selectedGroups.includes(dept.groupId);
                            }).map(u => ({ id: u.id, name: u.name }))}
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

                        {(selectedGroups.length > 0 || selectedUnits.length > 0 || selectedRoles.length > 0) && (
                            <button
                                onClick={() => { setSelectedGroups([]); setSelectedUnits([]); setSelectedRoles([]); }}
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
                                        checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedUserIds(filteredUsers.map(u => u.id));
                                            } else {
                                                setSelectedUserIds([]);
                                            }
                                        }}
                                    />
                                </th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('identity_authority')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('privileges')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('scope')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{t('settings')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => {
                                const userTheme = roleThemes[user.role as UserRole] || roleThemes.EMPLOYEE;
                                const isSelected = selectedUserIds.includes(user.id);
                                return (
                                    <tr key={user.id} className={`group hover:bg-slate-50/50 transition-all ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-6 py-5">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={isSelected}
                                                onChange={() => {
                                                    if (isSelected) {
                                                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                                    } else {
                                                        setSelectedUserIds([...selectedUserIds, user.id]);
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${userTheme.gradient} flex items-center justify-center text-white font-black text-sm mr-4 shadow-md group-hover:scale-110 transition-transform`}>
                                                    {(user.fullName || 'U').charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 group-hover:text-slate-900">{user.fullName || t('unknown_user')}</p>
                                                    <div className="flex items-center text-[10px] text-slate-400 font-bold tracking-tight mt-0.5">
                                                        <span className="mr-2 text-indigo-500 uppercase">{user.email}</span>
                                                        {user.employeeId && (
                                                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center">
                                                                <Briefcase size={10} className="mr-1" /> Linked
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${userTheme.badge} ring-1 ring-current ring-opacity-10`}>
                                                <Shield className="w-3 h-3 mr-1" /> {(user.role || 'NA').replace('_', ' ')}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center text-xs font-bold text-slate-600">
                                                    <Briefcase className="w-3.5 h-3.5 mr-2 text-slate-300" /> {getGroupName(user.groupId)}
                                                </div>
                                                <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                    <Building2 className="w-3 h-3 mr-2" /> {getDeptName(user.departmentId)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => handleEdit(user)} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(user.id)} className="p-2.5 rounded-xl bg-white border border-slate-200 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="group-hover:hidden text-slate-300">
                                                <MoreVertical size={16} className="ml-auto" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingUser ? t('policy_modification') : t('authority_enrollment')}
            >
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 gap-6">

                        {/* Personnel Link Section */}
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('associate_with_personnel', { defaultValue: 'Associate with Personnel Record' })}</h4>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('select_employee', { defaultValue: 'Select Employee' })}</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        value={formData.employeeId}
                                        onChange={(e) => {
                                            const empId = e.target.value;
                                            const emp = employees.find(emp => emp.id === empId);
                                            setFormData({
                                                ...formData,
                                                employeeId: empId,
                                                fullName: (!formData.fullName && emp) ? emp.fullName : formData.fullName,
                                                email: (!formData.email && emp?.email) ? emp.email : formData.email,
                                                groupId: emp?.groupId || formData.groupId,
                                                departmentId: emp?.departmentId || formData.departmentId,
                                                unitId: emp?.unitId || formData.unitId,
                                            });
                                        }}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="">{t('not_associated', { defaultValue: 'Not associated with any employee' })}</option>
                                        {filteredEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.position || emp.role})</option>
                                        ))}
                                        {filteredEmployees.length === 0 && (
                                            <option disabled className="text-red-500">
                                                {t('no_matching_heads_found', { defaultValue: 'No Matching Personnel Record Found' })}
                                            </option>
                                        )}
                                    </select>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 italic">
                                    {t('link_notice', { defaultValue: 'Linking an account allows the user to see their own HR data (contracts, holidays) when logged in.' })}
                                </p>
                            </div>
                        </section>

                        {/* Basic Info Section */}
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('user_credentials_setup')}</h4>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('full_name')}</label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            value={formData.fullName}
                                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                            placeholder={t('enter_full_name')}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('corporate_email')}</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                            placeholder={t('email_placeholder')}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                        {editingUser ? t('new_password_optional', { defaultValue: 'New Password (Optional)' }) : t('password')}
                                    </label>
                                    <div className="relative">
                                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            required={!editingUser}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                            placeholder={editingUser ? t('leave_blank_to_keep', { defaultValue: 'Leave blank to keep current' }) : t('enter_password')}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Role & Permissions Section */}
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('permission_tier')}</h4>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('system_access_role')}</label>
                                <div className="relative">
                                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
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
                                        <option value="SUPER_ADMIN">{t('role_super_admin')}</option>
                                    </select>
                                </div>
                                {formData.role !== 'SUPER_ADMIN' && formData.role !== 'HR_MANAGER' && (
                                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-start gap-3">
                                            <ShieldCheck className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">{t('personnel_sync_notice', { defaultValue: 'Personnel Sync Active' })}</p>
                                                <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                                                    {t('employee_creation_restriction_note', { defaultValue: 'Standard employees should be registered through the Personnel Management section to ensure HR records are synchronized with system access.' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Scope Selection */}
                        {(['HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT'].includes(formData.role)) && (
                            <section className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">{t('authority_scope')}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {formData.role === 'HEAD_DIVISION' && (
                                        <div className="space-y-4 col-span-2">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Assigned Division</label>
                                                <select
                                                    value={formData.divisionId || ''}
                                                    onChange={(e) => setFormData({ ...formData, divisionId: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                                >
                                                    <option value="">Select Division</option>
                                                    {divisions.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {formData.role === 'HEAD_OFFICE' && (
                                        <div className="space-y-4 col-span-2">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Assigned Office</label>
                                                <select
                                                    value={formData.departmentId || ''}
                                                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                                >
                                                    <option value="">Select Office</option>
                                                    {departments.filter(d => d.isOffice).map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {formData.role === 'HEAD_DIRECTOR' && (
                                        <div className="space-y-4 col-span-2">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('assigned_group')}</label>
                                                <select
                                                    value={formData.groupId}
                                                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value, departmentIds: [] })}
                                                    className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                                >
                                                    <option value="">{t('select_group')}</option>
                                                    {groups.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('assigned_departments')}</label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    {departments
                                                        .filter(d => !formData.groupId || d.groupId === formData.groupId)
                                                        .map(d => (
                                                            <label key={d.id} className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.departmentIds.includes(d.id)}
                                                                    onChange={(e) => {
                                                                        const newIds = e.target.checked
                                                                            ? [...formData.departmentIds, d.id]
                                                                            : formData.departmentIds.filter(id => id !== d.id);
                                                                        setFormData({ ...formData, departmentIds: newIds });
                                                                    }}
                                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{d.name}</span>
                                                            </label>
                                                        ))
                                                    }
                                                    {departments.filter(d => !formData.groupId || d.groupId === formData.groupId).length === 0 && (
                                                        <p className="text-xs text-slate-400 italic col-span-2">{t('no_departments_in_group')}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {formData.role === 'HEAD_DEPARTMENT' && (
                                        <div className="space-y-4 col-span-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('assigned_group')}</label>
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
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('primary_department')}</label>
                                                    <select
                                                        value={formData.departmentId}
                                                        onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                                    >
                                                        <option value="">{t('select_department')}</option>
                                                        {departments
                                                            .filter(d => !formData.groupId || d.groupId === formData.groupId)
                                                            .map(d => (
                                                                <option key={d.id} value={d.id}>{d.name}</option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {formData.role === 'HEAD_UNIT' && (
                                        <div className="space-y-4 col-span-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('assigned_group')}</label>
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
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('primary_department')}</label>
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
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('unit', { defaultValue: 'Unit' })}</label>
                                                    <select
                                                        value={formData.unitId || ''}
                                                        onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                                    >
                                                        <option value="">{t('select_unit', { defaultValue: 'Select Unit' })}</option>
                                                        {units
                                                            .filter(u => !formData.departmentId || u.departmentId === formData.departmentId)
                                                            .map(u => (
                                                                <option key={u.id} value={u.id}>{u.name}</option>
                                                            ))
                                                        }
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Permissions & Access Section */}
                    <section className="space-y-4 pt-4 border-t border-slate-100">
                        <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-[0.2em]">{t('permissions_and_access', { defaultValue: 'Permissions & Access' })}</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Directory & Employees */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('perm_cat_employees', { defaultValue: 'Employees & Directory' })}</h5>
                                <div className="space-y-2">
                                    {[
                                        { id: 'view_directory', label: t('perm_view_directory', { defaultValue: 'View Directory' }) },
                                        { id: 'view_employees', label: t('perm_view_employees', { defaultValue: 'View Full Emp Data' }) },
                                        { id: 'register_employees', label: t('perm_register_employees', { defaultValue: 'Register New Emp' }) },
                                        { id: 'edit_employees', label: t('perm_edit_employees', { defaultValue: 'Edit Emp Data' }) },
                                        { id: 'delete_employees', label: t('perm_delete_employees', { defaultValue: 'Delete Emp' }) },
                                    ].map(perm => (
                                        <PermissionCheckbox key={perm.id} id={perm.id} label={perm.label} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                    ))}
                                </div>
                            </div>

                            {/* Contracts & Lifecycle */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('perm_cat_contracts', { defaultValue: 'Contracts & Lifecycle' })}</h5>
                                <div className="space-y-2">
                                    {[
                                        { id: 'view_contracts', label: t('perm_view_contracts', { defaultValue: 'View Contracts' }) },
                                        { id: 'manage_contract_management', label: t('perm_manage_contracts', { defaultValue: 'Manage Contracts' }) },
                                        { id: 'view_lifecycle', label: t('perm_view_lifecycle', { defaultValue: 'View Lifecycle' }) },
                                        { id: 'manage_lifecycle_control', label: t('perm_manage_lifecycle', { defaultValue: 'Manage Lifecycle' }) },
                                    ].map(perm => (
                                        <PermissionCheckbox key={perm.id} id={perm.id} label={perm.label} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                    ))}
                                </div>
                            </div>

                            {/* Payroll & Time */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('perm_cat_payroll', { defaultValue: 'Payroll & Time' })}</h5>
                                <div className="space-y-2">
                                    {[
                                        { id: 'view_payroll', label: t('perm_view_payroll', { defaultValue: 'View Payroll' }) },
                                        { id: 'manage_payroll', label: t('perm_manage_payroll', { defaultValue: 'Manage Payroll' }) },
                                        { id: 'view_time_tracking', label: t('perm_view_time_tracking', { defaultValue: 'View Time Logs' }) },
                                        { id: 'manage_time_tracking', label: t('perm_manage_time_tracking', { defaultValue: 'Manage Time Logs' }) },
                                    ].map(perm => (
                                        <PermissionCheckbox key={perm.id} id={perm.id} label={perm.label} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                    ))}
                                </div>
                            </div>

                            {/* Operations & Approvals */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('perm_cat_ops', { defaultValue: 'Operations & Approvals' })}</h5>
                                <div className="space-y-2">
                                    {[
                                        { id: 'manage_leaves', label: t('perm_manage_leaves', { defaultValue: 'Approve Leaves' }) },
                                        { id: 'manage_tasks', label: t('perm_manage_tasks', { defaultValue: 'Manage Tasks' }) },
                                        { id: 'manage_announcements', label: t('perm_manage_announcements', { defaultValue: 'Post Announcements' }) },
                                        { id: 'manager_approvals', label: t('perm_manager_approvals', { defaultValue: 'Full Mgr Approvals' }) },
                                    ].map(perm => (
                                        <PermissionCheckbox key={perm.id} id={perm.id} label={perm.label} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                    ))}
                                </div>
                            </div>

                            {/* Evaluations */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('perm_cat_evaluations', { defaultValue: 'Evaluations' })}</h5>
                                <div className="space-y-2">
                                    {[
                                        { id: 'view_evaluations', label: t('perm_view_evaluations', { defaultValue: 'View All Evaluations' }) },
                                        { id: 'view_hr_evaluations', label: t('perm_view_hr_evaluations', { defaultValue: 'Manage HR Evals' }) },
                                        { id: 'manage_evaluation_control', label: t('perm_manage_eval_control', { defaultValue: 'Evaluation Control' }) },
                                    ].map(perm => (
                                        <PermissionCheckbox key={perm.id} id={perm.id} label={perm.label} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                    ))}
                                </div>
                            </div>

                            {/* IT & Operational Services */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('perm_cat_operational', { defaultValue: 'IT & Operational Services' })}</h5>
                                <div className="space-y-2">
                                    {[
                                        { id: 'manage_onboarding', label: t('perm_manage_onboarding', { defaultValue: 'Manage Onboarding (Assets)' }) },
                                        { id: 'manage_it_issues', label: t('perm_manage_it_issues', { defaultValue: 'Manage IT Support Tickets' }) },
                                    ].map(perm => (
                                        <PermissionCheckbox key={perm.id} id={perm.id} label={perm.label} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                    ))}
                                </div>
                            </div>

                            {/* Administration */}
                            <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('perm_cat_admin', { defaultValue: 'Administration' })}</h5>
                                <div className="space-y-2">
                                    {[
                                        { id: 'manage_groups', label: t('perm_manage_groups', { defaultValue: 'Manage Groups' }) },
                                        { id: 'manage_departments', label: t('perm_manage_departments', { defaultValue: 'Manage Depts' }) },
                                        { id: 'manage_units', label: t('perm_manage_units', { defaultValue: 'Manage Units' }) },
                                        { id: 'manage_users', label: t('perm_manage_users', { defaultValue: 'Manage System Users' }) },
                                    ].map(perm => (
                                        <PermissionCheckbox key={perm.id} id={perm.id} label={perm.label} checked={formData.permissions.includes(perm.id)} onChange={togglePermission} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">{t('active_environment_warning')}</p>
                            <p className="text-xs text-amber-700 leading-relaxed max-prose">
                                {t('creation_mode_alert', { defaultValue: 'Security notice: All configuration changes are recorded and applied to the production environment.' })}
                            </p>
                        </div>
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
                            {editingUser ? t('save_policy') : t('enroll_identity')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default UsersPage;
