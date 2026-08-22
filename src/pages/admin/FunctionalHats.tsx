import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '../../services/userService';
import type { FunctionalHat, AccessCatalog } from '../../types';
import { Layers, Plus, Edit, Trash2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';

// Access Management → Functional Hats. A hat is a reusable permission bundle a
// user can wear on top of their org position (see UserForm). Admins create and
// edit hats here; system hats (isSystem) can be re-permissioned but not deleted.
const FunctionalHatsPage: React.FC = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [hats, setHats] = useState<FunctionalHat[]>([]);
    const [catalog, setCatalog] = useState<AccessCatalog | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [editing, setEditing] = useState<FunctionalHat | null>(null);
    const [isModalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState<{ name: string; description: string; permissions: string[] }>({ name: '', description: '', permissions: [] });

    const load = async () => {
        setLoading(true);
        try {
            const [hatsData, catalogData] = await Promise.all([
                userService.getFunctionalHats(),
                userService.getAccessCatalog(),
            ]);
            setHats(hatsData);
            setCatalog(catalogData);
        } catch (e) {
            console.error(e);
            toast.error(t('error_loading_data', { defaultValue: 'Failed to load data.' }));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);

    const groups = useMemo(() => {
        if (!catalog) return [] as { title: string; perms: { id: string; label: string }[] }[];
        const order: string[] = [];
        const map = new Map<string, { id: string; label: string }[]>();
        for (const p of catalog.permissions) {
            if (!map.has(p.group)) { map.set(p.group, []); order.push(p.group); }
            map.get(p.group)!.push({ id: p.id, label: p.label });
        }
        return order.map(g => ({ title: g, perms: map.get(g)! }));
    }, [catalog]);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: '', description: '', permissions: [] });
        setModalOpen(true);
    };
    const openEdit = (hat: FunctionalHat) => {
        setEditing(hat);
        setForm({ name: hat.name, description: hat.description || '', permissions: [...hat.permissions] });
        setModalOpen(true);
    };

    const togglePerm = (id: string) => setForm(prev => ({
        ...prev,
        permissions: prev.permissions.includes(id) ? prev.permissions.filter(p => p !== id) : [...prev.permissions, id],
    }));

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error(t('hat_name_required', { defaultValue: 'A hat name is required.' })); return; }
        setSaving(true);
        try {
            if (editing) {
                await userService.updateHat(editing.id, form);
                toast.success(t('hat_updated', { defaultValue: 'Hat updated.' }));
            } else {
                await userService.createHat(form);
                toast.success(t('hat_created', { defaultValue: 'Hat created.' }));
            }
            setModalOpen(false);
            load();
        } catch (e: any) {
            toast.error(e.response?.data?.error || t('error_saving', { defaultValue: 'Failed to save.' }));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (hat: FunctionalHat) => {
        if (hat.isSystem) return;
        if (await confirm({ message: t('confirm_delete_hat', { defaultValue: `Delete the "${hat.name}" hat? It will be removed from anyone who holds it.` }), danger: true })) {
            try {
                await userService.deleteHat(hat.id);
                toast.success(t('hat_deleted', { defaultValue: 'Hat deleted.' }));
                load();
            } catch (e: any) {
                toast.error(e.response?.data?.error || t('error_deleting', { defaultValue: 'Failed to delete.' }));
            }
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#7c3aed' }}></div>
        </div>
    );

    const labelFor = (id: string) => catalog?.permissions.find(p => p.id === id)?.label || id;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('functional_hats', { defaultValue: 'Functional Hats' })}</h1>
                    <p className="text-slate-500 mt-1">{t('functional_hats_page_sub', { defaultValue: 'Reusable permission bundles a user can hold alongside their position.' })}</p>
                </div>
                <button onClick={openCreate} className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm group">
                    <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform" />
                    {t('new_hat', { defaultValue: 'New Hat' })}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hats.map(hat => (
                    <div key={hat.id} className="glass-card rounded-[28px] p-6 shadow-sm border border-slate-100 bg-white/70 flex flex-col">
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
                                <Layers size={20} />
                            </div>
                            {hat.isSystem && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[8px] font-black uppercase tracking-widest">
                                    <Lock className="w-2.5 h-2.5" /> {t('system', { defaultValue: 'System' })}
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg font-black text-slate-800">{hat.name}</h3>
                        {hat.description && <p className="text-xs text-slate-400 font-medium mt-1 leading-snug flex-1">{hat.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {hat.permissions.slice(0, 6).map(p => (
                                <span key={p} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-tight">{labelFor(p)}</span>
                            ))}
                            {hat.permissions.length > 6 && (
                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-bold">+{hat.permissions.length - 6}</span>
                            )}
                            {hat.permissions.length === 0 && <span className="text-[10px] text-slate-400 italic">{t('no_permissions', { defaultValue: 'No permissions' })}</span>}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{hat.permissions.length} {t('permissions', { defaultValue: 'permissions' })}</span>
                            <div className="flex gap-2">
                                <button onClick={() => openEdit(hat)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                    <Edit size={15} />
                                </button>
                                <button
                                    onClick={() => handleDelete(hat)}
                                    disabled={hat.isSystem}
                                    title={hat.isSystem ? t('system_hat_locked', { defaultValue: 'System hats cannot be deleted' }) : undefined}
                                    className="p-2 rounded-xl bg-white border border-slate-200 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-red-500"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create / Edit modal */}
            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editing ? t('edit_hat', { defaultValue: 'Edit Hat' }) : t('new_hat', { defaultValue: 'New Hat' })} maxWidth="max-w-2xl">
                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{t('hat_name', { defaultValue: 'Hat name' })}</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder={t('hat_name_placeholder', { defaultValue: 'e.g. Head of Payroll' })}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{t('description', { defaultValue: 'Description' })}</label>
                            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder={t('hat_desc_placeholder', { defaultValue: 'What this hat is for (optional)' })}
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                <ShieldCheck className="w-3.5 h-3.5 text-violet-500" /> {t('permissions_this_hat_grants', { defaultValue: 'Permissions this hat grants' })}
                            </label>
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black">{form.permissions.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[45vh] overflow-y-auto pr-1">
                            {groups.map(g => {
                                const ids = g.perms.map(p => p.id);
                                const allOn = ids.every(i => form.permissions.includes(i));
                                return (
                                    <div key={g.title} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{g.title}</h5>
                                            <button type="button" onClick={() => setForm(prev => ({ ...prev, permissions: allOn ? prev.permissions.filter(p => !ids.includes(p)) : Array.from(new Set([...prev.permissions, ...ids])) }))}
                                                className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider">
                                                {allOn ? t('clear', { defaultValue: 'Clear' }) : t('all', { defaultValue: 'All' })}
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            {g.perms.map(p => {
                                                const on = form.permissions.includes(p.id);
                                                return (
                                                    <label key={p.id} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer border transition-all ${on ? 'bg-white border-indigo-200 shadow-sm' : 'border-transparent hover:bg-white hover:border-slate-100'}`}>
                                                        <input type="checkbox" className="app-check" checked={on} onChange={() => togglePerm(p.id)} />
                                                        <span className={`text-[11px] font-bold uppercase tracking-tight ${on ? 'text-indigo-700' : 'text-slate-600'}`}>{p.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => setModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                        <button onClick={handleSave} disabled={saving} className="flex-1 px-6 py-3 rounded-xl bg-slate-900 text-white font-bold shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50">
                            {saving ? t('saving', { defaultValue: 'Saving…' }) : t('save', { defaultValue: 'Save' })}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default FunctionalHatsPage;
