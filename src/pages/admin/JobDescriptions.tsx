import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { jobDescriptionService } from '../../services/jobDescriptionService';
import type { JobDescription } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { Plus, Edit, Trash2, Crown, Users, BarChart3, FileText, FileUser } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const JobDescriptionsPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const jds = await jobDescriptionService.getAllJobDescriptions();
            setJobDescriptions(jds);
        } catch (error) {
            console.error('Error fetching job descriptions:', error);
            toast.error(t('error_loading_data', { defaultValue: 'Failed to load data.' }));
        } finally {
            setLoading(false);
        }
    };

    const getScopeLabel = (jd: JobDescription): { level: string; name: string } => {
        if (jd.unit) return { level: 'Unit', name: jd.unit.name };
        if (jd.department) return { level: 'Department', name: jd.department.name };
        if (jd.division) return { level: 'Division', name: jd.division.name };
        if (jd.directorate) return { level: 'Directorate', name: jd.directorate.name };
        return { level: '-', name: 'Unassigned' };
    };

    const [docBusy, setDocBusy] = useState<string | null>(null);
    const downloadDocument = async (jd: JobDescription, variant: 'general' | 'emp') => {
        setDocBusy(`${jd.id}:${variant}`);
        try {
            const blob = await jobDescriptionService.generateDocument(jd.id, variant);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const suffix = variant === 'emp' ? 'Employee' : 'General';
            a.download = `Job_Description_${suffix}_${(jd.title || 'jd').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('jd_doc_generated', { defaultValue: 'Job description document generated.' }));
        } catch (error: any) {
            console.error('Error generating JD document:', error);
            let msg = t('err_generate_jd_doc', { defaultValue: 'Failed to generate the document.' });
            const data = error.response?.data;
            if (data instanceof Blob) { try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep */ } }
            else if (data?.error) { msg = data.error; }
            toast.error(msg);
        } finally {
            setDocBusy(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirm({ message: t('confirm_delete_jd', { defaultValue: 'Are you sure you want to delete this Job Description?' }), danger: true })) {
            try {
                await jobDescriptionService.deleteJobDescription(id);
                fetchData();
            } catch (error: any) {
                console.error('Error deleting job description:', error);
                toast.error(error.response?.data?.error || t('error_deleting_jd', { defaultValue: 'Failed to delete Job Description.' }));
            }
        }
    };

    const chartData = jobDescriptions.map(jd => {
        const scope = getScopeLabel(jd);
        return {
            name: `${jd.title} (${scope.name})`,
            Planned: jd.plannedCount,
            Filled: jd._count?.employees || 0
        };
    });

    const totalPlanned = jobDescriptions.reduce((sum, jd) => sum + jd.plannedCount, 0);
    const totalFilled = jobDescriptions.reduce((sum, jd) => sum + (jd._count?.employees || 0), 0);

    if (loading) return <div className="p-12 text-center text-slate-500">{t('loading')}</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('job_descriptions', { defaultValue: 'Job Descriptions' })}</h1>
                    <p className="text-sm text-gray-500">{t('job_descriptions_subtitle', { defaultValue: 'Define staffing plan positions per Directorate, Division, Department, or Unit' })}</p>
                </div>
                <button onClick={() => navigate('/job-descriptions/new')} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm">
                    <Plus size={18} className="mr-2" />
                    {t('add_job_description', { defaultValue: 'Add Job Description' })}
                </button>
            </div>

            {/* Staff Plan Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        {t('staff_plan', { defaultValue: 'Staff Plan' })}
                    </h2>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('planned', { defaultValue: 'Planned' })}</p>
                            <p className="text-xl font-black text-indigo-600">{totalPlanned}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('filled', { defaultValue: 'Filled' })}</p>
                            <p className="text-xl font-black text-emerald-600">{totalFilled}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('open_slots', { defaultValue: 'Open Slots' })}</p>
                            <p className="text-xl font-black text-amber-600">{Math.max(0, totalPlanned - totalFilled)}</p>
                        </div>
                    </div>
                </div>
                {jobDescriptions.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        {t('no_job_descriptions', { defaultValue: 'No Job Descriptions defined yet.' })}
                    </div>
                ) : (
                    <div className="h-[380px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-30} textAnchor="end" interval={0} height={80} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Planned" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="Filled" fill="#10b981" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* JD Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('title', { defaultValue: 'Title' })}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('scope', { defaultValue: 'Scope' })}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('type', { defaultValue: 'Type' })}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('job_categories', { defaultValue: 'Job Categories' })}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{t('headcount', { defaultValue: 'Filled / Planned' })}</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {jobDescriptions.map(jd => {
                            const scope = getScopeLabel(jd);
                            const filled = jd._count?.employees || 0;
                            const isFull = filled >= jd.plannedCount;
                            return (
                                <tr key={jd.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{jd.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="text-gray-400">{scope.level}:</span> {scope.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {jd.isHead ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                                                <Crown className="w-3 h-3" /> {t('head', { defaultValue: 'Head' })}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-100">
                                                <Users className="w-3 h-3" /> {t('staff', { defaultValue: 'Staff' })}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="flex flex-wrap gap-1">
                                            {(jd.jobCategories || []).length > 0 ? jd.jobCategories!.map(cat => (
                                                <span key={cat} className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">{cat}</span>
                                            )) : <span className="text-xs text-gray-300 italic">{t('any_category', { defaultValue: 'Any' })}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`font-bold ${isFull ? 'text-red-600' : 'text-slate-700'}`}>{filled}</span>
                                        <span className="text-slate-400 mx-1">/</span>
                                        <span className="text-slate-500">{jd.plannedCount}</span>
                                        {isFull && <span className="ml-2 text-[10px] font-black text-red-500 uppercase">{t('full', { defaultValue: 'Full' })}</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => downloadDocument(jd, 'general')} disabled={docBusy === `${jd.id}:general`}
                                            title={t('jd_doc_general', { defaultValue: 'Download Job Description (General)' })}
                                            className="text-slate-600 hover:text-slate-900 mr-2 p-1 rounded hover:bg-slate-100 disabled:opacity-50">
                                            <FileText size={16} />
                                        </button>
                                        <button onClick={() => downloadDocument(jd, 'emp')} disabled={docBusy === `${jd.id}:emp`}
                                            title={t('jd_doc_emp', { defaultValue: 'Download Job Description (Employee copy)' })}
                                            className="text-emerald-600 hover:text-emerald-800 mr-4 p-1 rounded hover:bg-emerald-50 disabled:opacity-50">
                                            <FileUser size={16} />
                                        </button>
                                        <button onClick={() => navigate(`/job-descriptions/${jd.id}/edit`)} className="text-indigo-600 hover:text-indigo-900 mr-4 p-1 rounded hover:bg-indigo-50">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(jd.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {jobDescriptions.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">{t('no_job_descriptions', { defaultValue: 'No Job Descriptions defined.' })}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default JobDescriptionsPage;
