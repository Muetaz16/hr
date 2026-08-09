import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { departmentService, groupService, divisionService } from '../../services/departmentService';
import { directorateService } from '../../services/directorateService';
import type { Department, Group, Division } from '../../types';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';
import { Plus, Edit, Trash2, LayoutGrid, Building2, Building } from 'lucide-react';

const DepartmentsPage: React.FC = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState<'DIRECTORATES' | 'DIVISIONS' | 'DEPARTMENTS'>('DIRECTORATES');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [directorates, setDirectorates] = useState<any[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Department Modal
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [deptFormData, setDeptFormData] = useState({ name: '', groupId: '', divisionId: '', isOffice: false, positionFactor: 1.0 });

    // Division Modal
    const [isDivModalOpen, setIsDivModalOpen] = useState(false);
    const [editingDiv, setEditingDiv] = useState<Division | null>(null);
    const [divFormData, setDivFormData] = useState({ name: '', directorateId: '', positionFactor: 1.0 });

    // Directorate Modal
    const [isDirModalOpen, setIsDirModalOpen] = useState(false);
    const [editingDir, setEditingDir] = useState<any | null>(null);
    const [dirFormData, setDirFormData] = useState({ name: '', positionFactor: 1.0 });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [deptsData, groupsData, divsData, dirsData] = await Promise.all([
                departmentService.getAllDepartments(),
                groupService.getAllGroups(),
                divisionService.getAllDivisions().catch(() => []), // Fallback if API not ready
                directorateService.getAllDirectorates().catch(() => [])
            ]);
            setDepartments(deptsData);
            setGroups(groupsData);
            setDivisions(divsData);
            setDirectorates(dirsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getGroupName = (groupId: string) => groups.find(g => g.id === groupId)?.name || 'Unknown Group';
    const getDivisionName = (divId?: string) => divisions.find(d => d.id === divId)?.name || 'None';

    // --- Department Actions ---
    const handleDeptSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...deptFormData,
                divisionId: deptFormData.divisionId || undefined,
            };
            if (editingDept) {
                await departmentService.updateDepartment(editingDept.id, payload);
            } else {
                await departmentService.createDepartment(payload);
            }
            setIsDeptModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving department:", error);
        }
    };

    const handleEditDept = (dept: Department) => {
        setEditingDept(dept);
        setDeptFormData({ 
            name: dept.name, 
            groupId: dept.groupId, 
            divisionId: dept.divisionId || '', 
            isOffice: dept.isOffice || false,
            positionFactor: (dept as any).positionFactor || 1.0
        });
        setIsDeptModalOpen(true);
    };

    const handleDeleteDept = async (id: string) => {
        if (await confirm({ message: t('confirm_delete_dept'), danger: true })) {
            try {
                await departmentService.deleteDepartment(id);
                fetchData();
            } catch (error) {
                console.error("Error deleting department:", error);
            }
        }
    };

    const openNewDeptModal = () => {
        setEditingDept(null);
        setDeptFormData({ name: '', groupId: groups.length > 0 ? groups[0].id : '', divisionId: '', isOffice: false, positionFactor: 1.0 });
        setIsDeptModalOpen(true);
    };

    // --- Division Actions ---
    const handleDivSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingDiv) {
                await divisionService.updateDivision(editingDiv.id, divFormData);
            } else {
                await divisionService.createDivision(divFormData);
            }
            setIsDivModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving division:", error);
        }
    };

    const handleEditDiv = (div: Division) => {
        setEditingDiv(div);
        setDivFormData({ name: div.name, directorateId: div.directorateId || '', positionFactor: (div as any).positionFactor || 1.0 });
        setIsDivModalOpen(true);
    };

    const handleDeleteDiv = async (id: string) => {
        if (await confirm({ message: "Are you sure you want to delete this division?", danger: true })) {
            try {
                await divisionService.deleteDivision(id);
                fetchData();
            } catch (error) {
                console.error("Error deleting division:", error);
            }
        }
    };

    const openNewDivModal = () => {
        setEditingDiv(null);
        setDivFormData({ name: '', directorateId: '', positionFactor: 1.0 });
        setIsDivModalOpen(true);
    };

    // --- Directorate Actions ---
    const handleDirSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingDir) {
                await directorateService.updateDirectorate(editingDir.id, dirFormData);
            } else {
                await directorateService.createDirectorate(dirFormData);
            }
            setIsDirModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving directorate:", error);
        }
    };

    const handleEditDir = (dir: any) => {
        setEditingDir(dir);
        setDirFormData({ name: dir.name, positionFactor: (dir as any).positionFactor || 1.0 });
        setIsDirModalOpen(true);
    };

    const handleDeleteDir = async (id: string) => {
        if (await confirm({ message: "Are you sure you want to delete this directorate?", danger: true })) {
            try {
                await directorateService.deleteDirectorate(id);
                fetchData();
            } catch (error) {
                console.error("Error deleting directorate:", error);
            }
        }
    };

    const openNewDirModal = () => {
        setEditingDir(null);
        setDirFormData({ name: '', positionFactor: 1.0 });
        setIsDirModalOpen(true);
    };

    if (loading) return <div className="p-12 text-center text-slate-500">{t('loading')}</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Organization Structure</h1>
                    <p className="text-sm text-gray-500">Manage Divisions, Departments, and Offices</p>
                </div>
                
                <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button 
                        onClick={() => setActiveTab('DIRECTORATES')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'DIRECTORATES' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Directorates
                    </button>
                    <button 
                        onClick={() => setActiveTab('DIVISIONS')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'DIVISIONS' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Divisions
                    </button>
                    <button 
                        onClick={() => setActiveTab('DEPARTMENTS')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'DEPARTMENTS' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Departments & Offices
                    </button>
                </div>
            </div>

            {/* TAB: DIRECTORATES */}
            {activeTab === 'DIRECTORATES' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-indigo-500" />
                            Directorates
                        </h2>
                        <button onClick={openNewDirModal} className="flex items-center bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
                            <Plus size={16} className="mr-1" />
                            Add Directorate
                        </button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Directorate Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Divisions Count</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {directorates.map((dir) => (
                                <tr key={dir.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{dir.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dir.divisions?.length || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleEditDir(dir)} className="text-indigo-600 hover:text-indigo-900 mr-4 p-1 rounded hover:bg-indigo-50">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteDir(dir.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {directorates.length === 0 && (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">No directorates defined.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB: DIVISIONS */}
            {activeTab === 'DIVISIONS' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-indigo-500" />
                            Divisions
                        </h2>
                        <button onClick={openNewDivModal} className="flex items-center bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
                            <Plus size={16} className="mr-1" />
                            Add Division
                        </button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Division Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Departments Count</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {divisions.map((div) => (
                                <tr key={div.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{div.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{div._count?.departments || 0}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleEditDiv(div)} className="text-indigo-600 hover:text-indigo-900 mr-4 p-1 rounded hover:bg-indigo-50">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteDiv(div.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {divisions.length === 0 && (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400 text-sm">No divisions defined.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB: DEPARTMENTS & OFFICES */}
            {activeTab === 'DEPARTMENTS' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-indigo-500" />
                            Departments & Offices
                        </h2>
                        <button onClick={openNewDeptModal} className="flex items-center bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
                            <Plus size={16} className="mr-1" />
                            Add Department / Office
                        </button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Division</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('group')}</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {departments.map((dept) => (
                                <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {dept.isOffice ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                <Building className="w-3 h-3" /> Office
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                <Building2 className="w-3 h-3" /> Dept
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                        <Link to={`/employees?deptId=${dept.id}`} className="hover:text-indigo-600 hover:underline">
                                            {dept.name}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {dept.isOffice ? <span className="text-gray-300 italic">Direct to GM</span> : getDivisionName(dept.divisionId)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getGroupName(dept.groupId)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleEditDept(dept)} className="text-indigo-600 hover:text-indigo-900 mr-4 p-1 rounded hover:bg-indigo-50">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteDept(dept.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {departments.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">No departments or offices defined.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Directorate Modal */}
            <Modal isOpen={isDirModalOpen} onClose={() => setIsDirModalOpen(false)} title={editingDir ? "Edit Directorate" : "Add New Directorate"}>
                <form onSubmit={handleDirSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Directorate Name</label>
                        <input
                            type="text" required value={dirFormData.name}
                            onChange={(e) => setDirFormData({ ...dirFormData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Position Factor (Multiplier)</label>
                        <input
                            type="number" step="0.05" min="1.0" required value={dirFormData.positionFactor}
                            onChange={(e) => setDirFormData({ ...dirFormData, positionFactor: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsDirModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{editingDir ? 'Update' : 'Create'}</button>
                    </div>
                </form>
            </Modal>

            {/* Division Modal */}
            <Modal isOpen={isDivModalOpen} onClose={() => setIsDivModalOpen(false)} title={editingDiv ? "Edit Division" : "Add New Division"}>
                <form onSubmit={handleDivSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Division Name</label>
                        <input
                            type="text" required value={divFormData.name}
                            onChange={(e) => setDivFormData({ ...divFormData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Parent Directorate (Optional)</label>
                        <select
                            value={divFormData.directorateId}
                            onChange={(e) => setDivFormData({ ...divFormData, directorateId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">None (Reports direct to GM)</option>
                            {directorates.map(dir => (
                                <option key={dir.id} value={dir.id}>{dir.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Position Factor (Multiplier)</label>
                        <input
                            type="number" step="0.05" min="1.0" required value={divFormData.positionFactor}
                            onChange={(e) => setDivFormData({ ...divFormData, positionFactor: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsDivModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{editingDiv ? 'Update' : 'Create'}</button>
                    </div>
                </form>
            </Modal>

            {/* Department / Office Modal */}
            <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title={editingDept ? "Edit Department / Office" : "Add New Department / Office"}>
                <form onSubmit={handleDeptSubmit} className="space-y-4">
                    
                    <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                checked={!deptFormData.isOffice} 
                                onChange={() => setDeptFormData({ ...deptFormData, isOffice: false })}
                                className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-gray-800">Standard Department</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                checked={deptFormData.isOffice} 
                                onChange={() => setDeptFormData({ ...deptFormData, isOffice: true })}
                                className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-bold text-gray-800">Office (Direct to GM)</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{deptFormData.isOffice ? 'Office Name' : 'Department Name'}</label>
                        <input
                            type="text" required value={deptFormData.name}
                            onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {!deptFormData.isOffice && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Parent Division</label>
                            <select
                                value={deptFormData.divisionId}
                                onChange={(e) => setDeptFormData({ ...deptFormData, divisionId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="">No Division (Top Level)</option>
                                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('group')}</label>
                        <select
                            required value={deptFormData.groupId}
                            onChange={(e) => setDeptFormData({ ...deptFormData, groupId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">{t('select_group')}</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Position Factor (Multiplier)</label>
                        <input
                            type="number" step="0.05" min="1.0" required value={deptFormData.positionFactor}
                            onChange={(e) => setDeptFormData({ ...deptFormData, positionFactor: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsDeptModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">{t('cancel')}</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{editingDept ? t('update') : t('create')}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DepartmentsPage;
