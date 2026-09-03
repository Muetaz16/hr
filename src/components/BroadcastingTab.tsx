import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { staffHubService } from '../services/staffHubService';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import { SERVER_URL } from '../services/apiClient';
import { useConfirm } from './ConfirmDialog';
import { toast } from 'sonner';
import { Megaphone, Edit, Trash2, Clock, Paperclip, Download } from 'lucide-react';

// Broadcasting — post/edit/delete announcements to everyone, a department, or an individual.
// Moved out of the Manager Control Room into "My Approvals".
const BroadcastingTab: React.FC = () => {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [newAnnounce, setNewAnnounce] = useState({
        title: '', content: '', targetType: 'GLOBAL', targetId: '', expiryDate: '',
    });

    useEffect(() => {
        loadAnnouncements();
        (async () => {
            try {
                const [emps, depts] = await Promise.all([
                    employeeService.getAllEmployees().catch(() => [] as any[]),
                    departmentService.getAllDepartments().catch(() => [] as any[]),
                ]);
                setEmployees(emps);
                setDepartments(depts);
            } catch { /* non-fatal */ }
        })();
    }, []);

    const loadAnnouncements = async () => {
        try {
            setAnnouncements(await staffHubService.getAllAnnouncements());
        } catch (error) {
            console.error('Failed to load announcements', error);
        }
    };

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('title', newAnnounce.title);
            formData.append('content', newAnnounce.content);
            formData.append('targetType', newAnnounce.targetType);
            if (newAnnounce.targetId) formData.append('targetId', newAnnounce.targetId);
            if (newAnnounce.expiryDate) formData.append('expiryDate', newAnnounce.expiryDate);
            if (attachmentFile) formData.append('attachment', attachmentFile);

            if (editingAnnouncement) {
                await staffHubService.updateAnnouncement(editingAnnouncement.id, formData);
                toast.success(t('announcement_updated', { defaultValue: 'Announcement updated.' }));
            } else {
                await staffHubService.createAnnouncement(formData);
                toast.success(t('announcement_posted', { defaultValue: 'Announcement posted.' }));
            }
            setNewAnnounce({ title: '', content: '', targetType: 'GLOBAL', targetId: '', expiryDate: '' });
            setAttachmentFile(null);
            setEditingAnnouncement(null);
            loadAnnouncements();
        } catch {
            toast.error(editingAnnouncement ? t('failed_to_update_announcement', { defaultValue: 'Failed to update.' }) : t('failed_to_post_announcement', { defaultValue: 'Failed to post.' }));
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (await confirm({ message: t('confirm_delete_announcement', { defaultValue: 'Delete this announcement?' }), danger: true })) {
            try {
                await staffHubService.deleteAnnouncement(id);
                toast.success(t('announcement_deleted', { defaultValue: 'Announcement deleted.' }));
                loadAnnouncements();
            } catch {
                toast.error(t('failed_to_delete_announcement', { defaultValue: 'Failed to delete.' }));
            }
        }
    };

    const handleEditClick = (ann: any) => {
        setEditingAnnouncement(ann);
        setNewAnnounce({
            title: ann.title,
            content: ann.content,
            targetType: ann.targetType,
            targetId: ann.targetId || '',
            expiryDate: ann.expiryDate ? new Date(ann.expiryDate).toISOString().split('T')[0] : '',
        });
        setAttachmentFile(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="glass-card p-10 rounded-[2.5rem] shadow-xl">
                <form onSubmit={handleCreateAnnouncement} className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ms-1">{t('broadcast_title', { defaultValue: 'Title' })}</label>
                        <input
                            type="text"
                            placeholder={t('important_office_policy', { defaultValue: 'Important office policy' })}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-indigo-500/20"
                            value={newAnnounce.title}
                            onChange={e => setNewAnnounce({ ...newAnnounce, title: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ms-1">{t('target_audience', { defaultValue: 'Target Audience' })}</label>
                            <select
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold"
                                value={newAnnounce.targetType}
                                onChange={e => setNewAnnounce({ ...newAnnounce, targetType: e.target.value, targetId: '' })}
                            >
                                <option value="GLOBAL">{t('global_everyone', { defaultValue: 'Global (Everyone)' })}</option>
                                <option value="DEPARTMENT">{t('specific_department', { defaultValue: 'Specific Department' })}</option>
                                <option value="INDIVIDUAL">{t('private_individual', { defaultValue: 'Private (Individual)' })}</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ms-1">{t('select_target', { defaultValue: 'Select Target' })}</label>
                            <select
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold"
                                value={newAnnounce.targetId}
                                onChange={e => setNewAnnounce({ ...newAnnounce, targetId: e.target.value })}
                                disabled={newAnnounce.targetType === 'GLOBAL'}
                            >
                                <option value="">{t('choose_target', { defaultValue: 'Choose target' })}</option>
                                {newAnnounce.targetType === 'DEPARTMENT'
                                    ? departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                    : employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)
                                }
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ms-1">{t('expiry_date_optional', { defaultValue: 'Expiry Date (optional)' })}</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-600"
                                value={newAnnounce.expiryDate}
                                onChange={e => setNewAnnounce({ ...newAnnounce, expiryDate: e.target.value })}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ms-1">{t('attach_document', { defaultValue: 'Attach Document' })}</label>
                            <input
                                type="file"
                                className="w-full bg-slate-50 border-none rounded-2xl p-3 font-bold file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 text-sm text-slate-500"
                                onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                            />
                            {editingAnnouncement && editingAnnouncement.attachmentName && !attachmentFile && (
                                <div className="text-xs font-medium text-slate-500 ms-2">{t('current_colon', { defaultValue: 'Current:' })} {editingAnnouncement.attachmentName}</div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ms-1">{t('broadcast_message', { defaultValue: 'Message' })}</label>
                        <textarea
                            placeholder={t('type_announcement_here', { defaultValue: 'Type your announcement here…' })}
                            className="w-full bg-slate-50 border-none rounded-2xl p-6 min-h-[200px] font-medium leading-relaxed"
                            value={newAnnounce.content}
                            onChange={e => setNewAnnounce({ ...newAnnounce, content: e.target.value })}
                            required
                        />
                    </div>

                    <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                        {editingAnnouncement ? <Edit className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
                        {editingAnnouncement ? t('edit_announcement', { defaultValue: 'Edit Announcement' }) : t('broadcast_announcement', { defaultValue: 'Broadcast Announcement' })}
                    </button>
                    {editingAnnouncement && (
                        <button type="button" onClick={() => { setEditingAnnouncement(null); setNewAnnounce({ title: '', content: '', targetType: 'GLOBAL', targetId: '', expiryDate: '' }); setAttachmentFile(null); }} className="w-full bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all mt-4">
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                    )}
                </form>
            </div>

            <div className="mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-slate-800 px-2">{t('posted_announcements', { defaultValue: 'Posted Announcements' })}</h2>
                {announcements.length === 0 ? (
                    <div className="text-center p-12 glass-card rounded-3xl text-slate-500 font-medium">
                        {t('no_announcements_posted', { defaultValue: 'No announcements posted yet.' })}
                    </div>
                ) : (
                    announcements.map(ann => (
                        <div key={ann.id} className="glass-card p-6 rounded-3xl space-y-4 hover:shadow-xl transition-all border border-slate-100">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-2 flex-1">
                                    <h3 className="text-lg font-bold text-slate-800">{ann.title}</h3>
                                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                                        <span className={`px-2 py-1 rounded-md ${ann.targetType === 'GLOBAL' ? 'bg-blue-100 text-blue-700' : ann.targetType === 'DEPARTMENT' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700'}`}>
                                            {ann.targetType === 'GLOBAL' ? t('target_global', { defaultValue: 'Global' }) : ann.targetType === 'DEPARTMENT' ? t('target_dept', { defaultValue: 'Department' }) : t('target_individual', { defaultValue: 'Individual' })}
                                        </span>
                                        {ann.expiryDate && (
                                            <span className="bg-red-50 text-red-600 px-2 py-1 rounded-md flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {t('exp_colon', { defaultValue: 'Exp:' })} {new Date(ann.expiryDate).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => handleEditClick(ann)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-all" title={t('edit', { defaultValue: 'Edit' })}>
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteAnnouncement(ann.id)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all" title={t('delete', { defaultValue: 'Delete' })}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">{ann.content}</p>

                            {ann.attachmentUrl && (
                                <div className="pt-4 border-t border-slate-100">
                                    <a href={`${SERVER_URL}${ann.attachmentUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all">
                                        <Paperclip className="w-4 h-4" />
                                        <span className="truncate max-w-[200px]">{ann.attachmentName || t('download_attachment', { defaultValue: 'Download attachment' })}</span>
                                        <Download className="w-4 h-4 ms-1 opacity-50" />
                                    </a>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default BroadcastingTab;
