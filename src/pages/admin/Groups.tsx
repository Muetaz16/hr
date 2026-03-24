import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupService } from '../../services/departmentService';
import type { Group } from '../../types';
import Modal from '../../components/Modal';
import { Plus, Edit, Trash2 } from 'lucide-react';

const GroupsPage: React.FC = () => {
    const { t } = useTranslation();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [formData, setFormData] = useState({ name: '' });

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const data = await groupService.getAllGroups();
            setGroups(data);
        } catch (error) {
            console.error("Error fetching groups:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingGroup) {
                await groupService.updateGroup(editingGroup.id, formData);
            } else {
                await groupService.createGroup(formData);
            }
            setIsModalOpen(false);
            setEditingGroup(null);
            setFormData({ name: '' });
            fetchGroups();
        } catch (error) {
            console.error("Error saving group:", error);
        }
    };

    const handleEdit = (group: Group) => {
        setEditingGroup(group);
        setFormData({ name: group.name });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm(t('confirm_delete_group'))) {
            try {
                await groupService.deleteGroup(id);
                fetchGroups();
            } catch (error) {
                console.error("Error deleting group:", error);
            }
        }
    };

    const openNewModal = () => {
        setEditingGroup(null);
        setFormData({ name: '' });
        setIsModalOpen(true);
    };

    if (loading) return <div>{t('loading')}</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('groups_management')}</h1>
                <button
                    onClick={openNewModal}
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Plus size={18} className="mr-2" />
                    {t('add_group')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('group_name')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {groups.map((group) => (
                            <tr key={group.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{group.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleEdit(group)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(group.id)} className="text-red-600 hover:text-red-900">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {groups.length === 0 && (
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-center text-gray-500">{t('no_groups')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingGroup ? t('edit_group') : t('add_new_group')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('group_name')}</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            {editingGroup ? t('update') : t('create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default GroupsPage;
