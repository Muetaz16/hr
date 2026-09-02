import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { unitService } from '../../services/unitService';
import { departmentService } from '../../services/departmentService';
import type { Unit, Department } from '../../types';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';
import { Plus, Edit, Trash2 } from 'lucide-react';

const UnitsPage: React.FC = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [units, setUnits] = useState<Unit[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
    const [formData, setFormData] = useState({ name: '', departmentId: '', headcount: 0 });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [unitsData, deptsData] = await Promise.all([
                unitService.getAllUnits(),
                departmentService.getAllDepartments()
            ]);
            setUnits(unitsData);
            setDepartments(deptsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getDepartmentName = (departmentId: string) => {
        return departments.find(d => d.id === departmentId)?.name || t('unknown_department', 'Unknown Department');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUnit) {
                await unitService.updateUnit(editingUnit.id, formData);
            } else {
                await unitService.createUnit(formData);
            }
            setIsModalOpen(false);
            setEditingUnit(null);
            setFormData({ name: '', departmentId: '', headcount: 0 });
            fetchData(); // Refresh list
        } catch (error) {
            console.error("Error saving unit:", error);
        }
    };

    const handleEdit = (unit: Unit) => {
        setEditingUnit(unit);
        setFormData({ name: unit.name, departmentId: unit.departmentId, headcount: unit.headcount || 0 });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (await confirm({ message: t('confirm_delete_unit', 'Are you sure you want to delete this unit?'), danger: true })) {
            try {
                await unitService.deleteUnit(id);
                fetchData();
            } catch (error) {
                console.error("Error deleting unit:", error);
            }
        }
    };

    const openNewModal = () => {
        setEditingUnit(null);
        setFormData({ 
            name: '', 
            departmentId: departments.length > 0 ? departments[0].id : '',
            headcount: 0
        });
        setIsModalOpen(true);
    };

    if (loading) return <div>{t('loading', 'Loading...')}</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('units_management', 'Units Management')}</h1>
                <button
                    onClick={openNewModal}
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    <Plus size={18} className="mr-2" />
                    {t('add_unit', 'Add Unit')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('unit_name', 'Unit Name')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('department', 'Department')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('headcount', 'Headcount')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions', 'Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {units.map((unit) => (
                            <tr key={unit.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    <Link
                                        to={`/employees?unitId=${unit.id}`}
                                        className="text-indigo-600 hover:text-indigo-900 hover:underline transition-colors"
                                    >
                                        {unit.name}
                                    </Link>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDepartmentName(unit.departmentId)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="font-bold text-slate-700">{unit._count?.employees || 0}</span>
                                    <span className="text-slate-400 mx-1">/</span>
                                    <span className="text-slate-500">{unit.headcount || '∞'}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleEdit(unit)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(unit.id)} className="text-red-600 hover:text-red-900">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {units.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">{t('no_units', 'No units found')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingUnit ? t('edit_unit', 'Edit Unit') : t('add_new_unit', 'Add New Unit')}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('unit_name', 'Unit Name')}</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('department', 'Department')}</label>
                        <select
                            required
                            value={formData.departmentId}
                            onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">{t('select_department', 'Select Department')}</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('headcount', 'Headcount Capacity')}</label>
                        <input
                            type="number"
                            min="0"
                            value={formData.headcount}
                            onChange={(e) => setFormData({ ...formData, headcount: parseInt(e.target.value) || 0 })}
                            placeholder="0 = Unlimited"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">{t('unit_headcount_hint', 'Set the maximum number of employees for this unit.')}</p>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            {t('cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            {editingUnit ? t('update', 'Update') : t('create', 'Create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default UnitsPage;
