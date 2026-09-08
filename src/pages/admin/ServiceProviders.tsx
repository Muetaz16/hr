// Administration -> System -> Service Providers.
// The staffing companies that supply IPH's non-resident hires. Registering them here is what turns
// the provider pickers on the careers portal, the onboarding form, the candidate form and the
// employee form into live data instead of hardcoded name lists.
// `percentage` is the provider's cut charged to IPH ON TOP of the employee's salary — it is not
// deducted from the employee and never appears on a payslip.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Building2, Users, Percent } from 'lucide-react';
import { serviceProviderService } from '../../services/serviceProviderService';
import type { ServiceProvider } from '../../types';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';

const EMPTY_FORM = {
    name: '', nameArabic: '', percentage: 0, contactPerson: '', phone: '', email: '',
    address: '', contractStart: '', contractEnd: '', notes: '', isActive: true,
};
type FormState = typeof EMPTY_FORM;

const isoDate = (v?: string | null) => (v ? String(v).split('T')[0] : '');

const ServiceProvidersPage: React.FC = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [providers, setProviders] = useState<ServiceProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<ServiceProvider | null>(null);
    const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

    const fetchData = async () => {
        try {
            setProviders(await serviceProviderService.getAll());
        } catch {
            toast.error(t('sp_load_failed', { defaultValue: 'Could not load service providers.' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const set = (patch: Partial<FormState>) => setFormData(prev => ({ ...prev, ...patch }));

    const activeCount = useMemo(() => providers.filter(p => p.isActive).length, [providers]);
    const linkedCount = useMemo(
        () => providers.reduce((sum, p) => sum + (p._count?.employees || 0), 0),
        [providers],
    );

    const openNewModal = () => { setEditing(null); setFormData(EMPTY_FORM); setIsModalOpen(true); };

    const openEditModal = (p: ServiceProvider) => {
        setEditing(p);
        setFormData({
            name: p.name, nameArabic: p.nameArabic || '', percentage: p.percentage ?? 0,
            contactPerson: p.contactPerson || '', phone: p.phone || '', email: p.email || '',
            address: p.address || '', contractStart: isoDate(p.contractStart),
            contractEnd: isoDate(p.contractEnd), notes: p.notes || '', isActive: p.isActive,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            const payload = {
                ...formData,
                contractStart: formData.contractStart || null,
                contractEnd: formData.contractEnd || null,
            };
            if (editing) await serviceProviderService.update(editing.id, payload as any);
            else await serviceProviderService.create(payload as any);
            toast.success(t('saved', { defaultValue: 'Saved' }));
            setIsModalOpen(false);
            setEditing(null);
            await fetchData();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (p: ServiceProvider) => {
        const ok = await confirm({
            message: t('sp_confirm_delete', { defaultValue: 'Delete this service provider?' }),
            danger: true,
        });
        if (!ok) return;
        try {
            await serviceProviderService.remove(p.id);
            toast.success(t('deleted', { defaultValue: 'Deleted' }));
            await fetchData();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('delete_failed', { defaultValue: 'Delete failed.' }));
        }
    };

    if (loading) return <div className="p-6">{t('loading', 'Loading...')}</div>;

    const stats = [
        { icon: Building2, label: t('sp_total', { defaultValue: 'Providers' }), value: providers.length },
        { icon: Percent, label: t('sp_active', { defaultValue: 'Active' }), value: activeCount },
        { icon: Users, label: t('sp_linked_employees', { defaultValue: 'Linked Employees' }), value: linkedCount },
    ];

    return (
        <div className="p-6">
            <div className="flex justify-between items-start gap-6 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('service_providers', { defaultValue: 'Service Providers' })}</h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        {t('sp_page_hint', { defaultValue: 'Staffing companies supplying non-resident employees. The percentage is charged to the company on top of the employee salary — it is not deducted from the employee.' })}
                    </p>
                </div>
                <button
                    onClick={openNewModal}
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shrink-0"
                >
                    <Plus size={18} className="me-2" />
                    {t('sp_add', { defaultValue: 'Add Provider' })}
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                {stats.map((s, i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
                        <s.icon size={20} className="text-blue-500 shrink-0" />
                        <div>
                            <div className="text-xl font-bold text-slate-800">{s.value}</div>
                            <div className="text-xs text-slate-400">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sp_name', { defaultValue: 'Provider' })}</th>
                            <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sp_percentage', { defaultValue: 'Percentage' })}</th>
                            <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sp_contact', { defaultValue: 'Contact' })}</th>
                            <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sp_contract', { defaultValue: 'Contract' })}</th>
                            <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('sp_usage', { defaultValue: 'Employees / Candidates' })}</th>
                            <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t('status', { defaultValue: 'Status' })}</th>
                            <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions', 'Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {providers.map((p) => (
                            <tr key={p.id} className={p.isActive ? '' : 'bg-slate-50/70'}>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    {p.name}
                                    {p.nameArabic && <span className="block text-xs font-normal text-gray-400" dir="rtl">{p.nameArabic}</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className="font-bold text-slate-700">{p.percentage}%</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {p.contactPerson || '—'}
                                    {(p.phone || p.email) && (
                                        <span className="block text-xs text-gray-400">{[p.phone, p.email].filter(Boolean).join(' · ')}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                    {p.contractStart || p.contractEnd
                                        ? `${isoDate(p.contractStart) || '…'} → ${isoDate(p.contractEnd) || '…'}`
                                        : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="font-bold text-slate-700">{p._count?.employees ?? 0}</span>
                                    <span className="text-slate-300 mx-1">/</span>
                                    <span>{p._count?.candidates ?? 0}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${p.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {p.isActive ? t('active', { defaultValue: 'Active' }) : t('inactive', { defaultValue: 'Inactive' })}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                                    <button onClick={() => openEditModal(p)} className="text-indigo-600 hover:text-indigo-900 me-4"><Edit size={18} /></button>
                                    <button onClick={() => handleDelete(p)} className="text-red-600 hover:text-red-900"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        ))}
                        {providers.length === 0 && (
                            <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">{t('sp_none', { defaultValue: 'No service providers registered yet.' })}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editing ? t('sp_edit', { defaultValue: 'Edit Service Provider' }) : t('sp_add', { defaultValue: 'Add Provider' })}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('sp_name_english', { defaultValue: 'Provider Name (English)' })} *</label>
                            <input type="text" required value={formData.name} onChange={e => set({ name: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">اسم المزود (عربي)</label>
                            <input type="text" dir="rtl" value={formData.nameArabic} onChange={e => set({ nameArabic: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('sp_percentage', { defaultValue: 'Percentage' })} (%) *</label>
                        <input type="number" required min="0" max="100" step="0.01" value={formData.percentage}
                            onChange={e => set({ percentage: parseFloat(e.target.value) })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                        <p className="text-[10px] text-gray-400 mt-1">
                            {t('sp_percentage_hint', { defaultValue: 'Charged to the company on top of the employee total salary. Not deducted from the employee and never shown on a payslip.' })}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('sp_contact_person', { defaultValue: 'Contact Person' })}</label>
                            <input type="text" value={formData.contactPerson} onChange={e => set({ contactPerson: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('phone', { defaultValue: 'Phone' })}</label>
                            <input type="text" value={formData.phone} onChange={e => set({ phone: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('email', { defaultValue: 'Email' })}</label>
                            <input type="email" value={formData.email} onChange={e => set({ email: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('address', { defaultValue: 'Address' })}</label>
                            <input type="text" value={formData.address} onChange={e => set({ address: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('sp_contract_start', { defaultValue: 'Contract Start' })}</label>
                            <input type="date" value={formData.contractStart} onChange={e => set({ contractStart: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('sp_contract_end', { defaultValue: 'Contract End' })}</label>
                            <input type="date" value={formData.contractEnd} onChange={e => set({ contractEnd: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('notes', { defaultValue: 'Notes' })}</label>
                        <textarea rows={2} value={formData.notes} onChange={e => set({ notes: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={formData.isActive} onChange={e => set({ isActive: e.target.checked })} />
                        {t('sp_is_active', { defaultValue: 'Active — appears in the provider dropdowns' })}
                    </label>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">{t('cancel', 'Cancel')}</button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                            {editing ? t('update', 'Update') : t('create', 'Create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ServiceProvidersPage;
