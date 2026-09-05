import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../services/userService';
import { groupService, departmentService } from '../../services/departmentService';
import { unitService } from '../../services/unitService';
import type { User, UserRole, Group, Department, Unit, FunctionalHat } from '../../types';
import {
    Edit,
    Trash2,
    Shield,
    Briefcase,
    Search,
    MoreVertical,
    ShieldAlert,
    Filter,
    ChevronDown,
    Check,
    Layers
} from 'lucide-react';
import { roleThemes } from '../../config/roleThemes';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ConfirmDialog';

const UsersPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [hats, setHats] = useState<FunctionalHat[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
                        <div className="absolute top-full start-0 end-0 mt-2 p-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 max-h-64 overflow-y-auto animate-in zoom-in-95 duration-200">
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
                                <div className="p-4 text-center text-xs text-slate-400 italic">{t('no_options_available', { defaultValue: 'No options available' })}</div>
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
            const [usersData, groupsData, deptsData, unitsData, hatsData] = await Promise.all([
                userService.getAllUsers(),
                groupService.getAllGroups(),
                departmentService.getAllDepartments(),
                unitService.getAllUnits(),
                userService.getFunctionalHats().catch(() => [] as FunctionalHat[]),
            ]);
            setUsers(usersData);
            setGroups(groupsData);
            setDepartments(deptsData);
            setUnits(unitsData);
            setHats(hatsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (uid: string) => {
        if (await confirm({ message: t('confirm_remove_access'), danger: true })) {
            try {
                await userService.deleteUser(uid);
                toast.success(t('user_deleted_success'));
                fetchData();
            } catch (error: any) {
                console.error("Error deleting user:", error, error.response?.data);
                const data = error.response?.data;
                const msg = data?.error || data?.details || t('error_deleting_user');
                toast.error(msg, { duration: 6000 });
            }
        }
    };

    const filteredUsers = users.filter(user => {
        // Super Admin accounts are system-level and are not managed from this list.
        if (user.role === 'SUPER_ADMIN') return false;

        const matchesSearch = (user.fullName || t('unknown_user')).toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesGroup = selectedGroups.length === 0 || selectedGroups.includes(user.groupId || '');
        const matchesUnit = selectedUnits.length === 0 || selectedUnits.includes(user.unitId || '');
        const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(user.role);

        return matchesSearch && matchesGroup && matchesUnit && matchesRole;
    });

    const hatMap = new Map(hats.map(h => [h.id, h.name]));

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
                        onClick={() => navigate('/users/new')}
                        className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm group"
                    >
                        <ShieldAlert size={18} className="me-2 group-hover:rotate-12 transition-transform" />
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
                                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={t('query_identity_email')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="ps-10 pe-4 py-2 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-80"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    const headRoles = ['HEAD_UNIT', 'HEAD_DEPARTMENT', 'HEAD_DIRECTOR', 'SUPER_ADMIN'];
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
                                { id: 'HEAD_OFFICE', name: t('role_head_office', { defaultValue: 'Head of Office' }) },
                                { id: 'HEAD_DIVISION', name: t('role_head_division', { defaultValue: 'Head of Division' }) },
                                { id: 'HEAD_DIRECTOR', name: t('role_head_director') },
                                { id: 'GENERAL_MANAGER', name: t('role_general_manager', { defaultValue: 'General Manager' }) },
                                { id: 'CHAIRMAN', name: t('role_chairman', { defaultValue: 'Chairman' }) },
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
                    <table className="w-full text-start">
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
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-start">{t('identity_authority')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('privileges')}</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-end">{t('settings')}</th>
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
                                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${userTheme.gradient} flex items-center justify-center text-white font-black text-sm me-4 shadow-md group-hover:scale-110 transition-transform`}>
                                                    {(user.fullName || 'U').charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 group-hover:text-slate-900">{user.fullName || t('unknown_user')}</p>
                                                    <div className="flex items-center text-[10px] text-slate-400 font-bold tracking-tight mt-0.5">
                                                        <span className="me-2 text-indigo-500 uppercase">{user.email}</span>
                                                        {user.employeeId && (
                                                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center">
                                                                <Briefcase size={10} className="me-1" /> {t('linked', { defaultValue: 'Linked' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${userTheme.badge} ring-1 ring-current ring-opacity-10`}>
                                                    <Shield className="w-3 h-3 me-1" /> {(user.role || 'NA').replace(/_/g, ' ')}
                                                </div>
                                                {(user.functionalHatIds || []).length > 0 && (
                                                    <div className="flex flex-wrap justify-center gap-1">
                                                        {(user.functionalHatIds || []).map(hid => (
                                                            <span key={hid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-tight">
                                                                <Layers className="w-2.5 h-2.5" /> {hatMap.get(hid) || t('unknown_hat', { defaultValue: 'Hat' })}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-end">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => navigate(`/users/${user.id}/edit`)} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(user.id)} className="p-2.5 rounded-xl bg-white border border-slate-200 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="group-hover:hidden text-slate-300">
                                                <MoreVertical size={16} className="ms-auto" />
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

export default UsersPage;
