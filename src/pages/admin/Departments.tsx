import React, { useEffect, useState } from 'react';
import { departmentService, groupService } from '../../services/departmentService';
import type { Department, Group } from '../../types';
import Modal from '../../components/Modal';
import { Plus, Edit, Trash2 } from 'lucide-react';

const DepartmentsPage: React.FC = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [formData, setFormData] = useState({ name: '', groupId: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [deptsData, groupsData] = await Promise.all([
                departmentService.getAllDepartments(),
                groupService.getAllGroups()
            ]);
            setDepartments(deptsData);
            setGroups(groupsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getGroupName = (groupId: string) => {
        return groups.find(g => g.id === groupId)?.name || 'Unknown Group';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingDept) {
                await departmentService.updateDepartment(editingDept.id, formData);
            } else {
                await departmentService.createDepartment(formData);
            }
            setIsModalOpen(false);
            setEditingDept(null);
            setFormData({ name: '', groupId: '' });
            fetchData(); // Refresh list
        } catch (error) {
            console.error("Error saving department:", error);
        }
    };

    const handleEdit = (dept: Department) => {
        setEditingDept(dept);
        setFormData({ name: dept.name, groupId: dept.groupId });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this department?')) {
            try {
                await departmentService.deleteDepartment(id);
                fetchData();
            } catch (error) {
                console.error("Error deleting department:", error);
            }
        }
    };

    const openNewModal = () => {
        setEditingDept(null);
        setFormData({ name: '', groupId: groups.length > 0 ? groups[0].id : '' });
        setIsModalOpen(true);
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Departments Management</h1>
                <button
                    onClick={openNewModal}
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Plus size={18} className="mr-2" />
                    Add Department
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {departments.map((dept) => (
                            <tr key={dept.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getGroupName(dept.groupId)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleEdit(dept)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(dept.id)} className="text-red-600 hover:text-red-900">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {departments.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">No departments found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDept ? 'Edit Department' : 'Add New Department'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Department Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Group</label>
                        <select
                            required
                            value={formData.groupId}
                            onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select a Group</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            {editingDept ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DepartmentsPage;
