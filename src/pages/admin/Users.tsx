import React, { useEffect, useState } from 'react';
import { userService } from '../../services/userService';
import { groupService, departmentService } from '../../services/departmentService';
import type { User, UserRole, Group, Department } from '../../types';
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
    UserPlus
} from 'lucide-react';
import { roleThemes } from '../../config/roleThemes';

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
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
        departmentId: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersData, groupsData, deptsData] = await Promise.all([
                userService.getAllUsers(),
                groupService.getAllGroups(),
                departmentService.getAllDepartments()
            ]);
            setUsers(usersData);
            setGroups(groupsData);
            setDepartments(deptsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getGroupName = (groupId?: string) => groups.find(g => g.id === groupId)?.name || 'N/A';
    const getDeptName = (deptId?: string) => departments.find(d => d.id === deptId)?.name || 'N/A';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await userService.updateUser(editingUser.id, {
                    fullName: formData.fullName,
                    role: formData.role,
                    groupId: formData.groupId,
                    departmentId: formData.departmentId
                });
            } else {
                alert("Creation mode enabled for Firestore records. In production, this uses Firebase Admin SDK.");
                const fakeUid = 'user_' + Date.now();
                await userService.syncUser(fakeUid, {
                    id: fakeUid,
                    email: formData.email,
                    fullName: formData.fullName,
                    role: formData.role,
                    groupId: formData.groupId,
                    departmentId: formData.departmentId
                });
            }
            setIsModalOpen(false);
            setEditingUser(null);
            setFormData(initialFormState);
            fetchData();
        } catch (error) {
            console.error("Error saving user:", error);
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
            departmentId: user.departmentId || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Remove access for this user?')) {
            await userService.deleteUser(id);
            fetchData();
        }
    };

    const filteredUsers = users.filter(user =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#7c3aed' }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">Access Management</h1>
                    <p className="text-slate-500 mt-1">Configure system permissions and account security</p>
                </div>

                <button
                    onClick={() => {
                        setEditingUser(null);
                        setFormData(initialFormState);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all group shadow-slate-200"
                >
                    <UserPlus size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
                    Register System User
                </button>
            </div>

            {/* Users List Area */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Query by identity or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-80"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identity & Authority</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Privileges</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scope</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Settings</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => {
                                const userTheme = roleThemes[user.role] || roleThemes.EMPLOYEE;
                                return (
                                    <tr key={user.id} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center">
                                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${userTheme.gradient} flex items-center justify-center text-white font-black text-sm mr-4 shadow-md group-hover:scale-110 transition-transform`}>
                                                    {user.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{user.fullName}</p>
                                                    <div className="flex items-center text-xs text-slate-400 mt-0.5">
                                                        <Mail className="w-3 h-3 mr-1" /> {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${userTheme.badge} ring-1 ring-current ring-opacity-10`}>
                                                <Shield className="w-3 h-3 mr-1" /> {user.role.replace('_', ' ')}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
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
                title={editingUser ? 'Policy Modification' : 'Authority Enrollment'}
            >
                <form onSubmit={handleSubmit} className="space-y-8">
                    <section className="space-y-4">
                        <div className="flex items-center p-4 bg-slate-100 rounded-2xl mb-4">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mr-3 text-slate-400">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest italic">User Credentials Setup</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Full Legal Name</label>
                                <input
                                    type="text" required
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Corporate Email</label>
                                <input
                                    type="email" required disabled={!!editingUser}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 disabled:opacity-50"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Permission Tier</h4>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 block">System Access Role</label>
                            <select
                                required
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none shadow-sm"
                            >
                                <option value="EMPLOYEE">Employee</option>
                                <option value="HR_MANAGER">HR Manager</option>
                                <option value="HEAD_DEPARTMENT">Head of Department</option>
                                <option value="HEAD_DIRECTOR">Head Director</option>
                                <option value="SUPER_ADMIN">Super Admin</option>
                            </select>
                        </div>
                    </section>

                    {(formData.role === 'HEAD_DIRECTOR' || formData.role === 'HEAD_DEPARTMENT') && (
                        <section className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Authority Scope</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 block">Assigned Group</label>
                                    <select
                                        value={formData.groupId}
                                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 shadow-sm"
                                    >
                                        <option value="">Select Group</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {formData.role === 'HEAD_DEPARTMENT' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 block">Primary Department</label>
                                        <select
                                            value={formData.departmentId}
                                            onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border-transparent rounded-2xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 shadow-sm"
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-8 py-5 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Dismiss
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-8 py-5 rounded-2xl bg-slate-900 text-white font-bold shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            {editingUser ? 'Save Policy' : 'Enroll Identity'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default UsersPage;
