import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { jobDescriptionService } from '../../services/jobDescriptionService';
import { departmentService, divisionService } from '../../services/departmentService';
import { directorateService } from '../../services/directorateService';
import { unitService } from '../../services/unitService';
import type { JobDescription, Department, Division, Directorate, Unit, JobDescriptionDetails } from '../../types';
import { JOB_CATEGORIES } from '../../types';
import { ArrowLeft, Save, Building2, MapPin } from 'lucide-react';

type ScopeLevel = 'DIRECTORATE' | 'DIVISION' | 'DEPARTMENT' | 'UNIT';
type SectionKey = Exclude<keyof JobDescriptionDetails, 'reportsTo'>;

const JD_SECTIONS: { key: SectionKey; labelEn: string; labelAr: string }[] = [
    { key: 'jobPurpose', labelEn: 'Job Purpose', labelAr: 'الغرض من الوظيفة' },
    { key: 'keyResponsibilities', labelEn: 'Key Responsibilities', labelAr: 'المهام والمسؤوليات الرئيسية' },
    { key: 'kpi', labelEn: 'Key Performance Indicators', labelAr: 'مؤشرات الأداء الرئيسية' },
    { key: 'education', labelEn: 'Education Background', labelAr: 'المؤهلات العلمية' },
    { key: 'experience', labelEn: 'Experience Required', labelAr: 'الخبرة المطلوبة' },
    { key: 'skills', labelEn: 'Skills & Competencies Required', labelAr: 'المهارات والكفاءات المطلوبة' },
    { key: 'trainingLicenses', labelEn: 'Training & Licenses', labelAr: 'التدريب والرخص' },
    { key: 'workingConditions', labelEn: 'Working Conditions & Risk Exposure', labelAr: 'ظروف العمل والتعرض للمخاطر' },
];

const WORK_LOCATIONS: { value: string; labelEn: string; labelAr: string; icon: any }[] = [
    { value: 'OFFICE', labelEn: 'Office Work', labelAr: 'عمل مكتبي', icon: Building2 },
    { value: 'SITE', labelEn: 'Site Work', labelAr: 'عمل ميداني', icon: MapPin },
];

const emptyDetails = (): JobDescriptionDetails => ({
    jobPurpose: { en: '', ar: '' },
    keyResponsibilities: { en: '', ar: '' },
    kpi: { en: '', ar: '' },
    education: { en: '', ar: '' },
    experience: { en: '', ar: '' },
    skills: { en: '', ar: '' },
    trainingLicenses: { en: '', ar: '' },
    workingConditions: { en: '', ar: '' },
    reportsTo: '',
});

const emptyForm = {
    title: '',
    description: '',
    isHead: false,
    plannedCount: 1,
    scopeLevel: 'DEPARTMENT' as ScopeLevel,
    scopeId: '',
    jobCategories: [] as string[],
    workLocations: [] as string[],
    details: emptyDetails(),
};

const JobDescriptionForm: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = Boolean(id);

    const [departments, setDepartments] = useState<Department[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [directorates, setDirectorates] = useState<Directorate[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [depts, divs, dirs, uns, jds] = await Promise.all([
                    departmentService.getAllDepartments(),
                    divisionService.getAllDivisions().catch(() => []),
                    directorateService.getAllDirectorates().catch(() => []),
                    unitService.getAllUnits().catch(() => []),
                    isEditMode ? jobDescriptionService.getAllJobDescriptions() : Promise.resolve([] as JobDescription[]),
                ]);
                setDepartments(depts);
                setDivisions(divs);
                setDirectorates(dirs);
                setUnits(uns);

                if (isEditMode && id) {
                    const jd = jds.find(j => j.id === id);
                    if (!jd) {
                        toast.error(t('jd_not_found', { defaultValue: 'Job Description not found.' }));
                        navigate('/job-descriptions');
                        return;
                    }
                    setEditingId(jd.id);
                    let scopeLevel: ScopeLevel = 'DEPARTMENT';
                    let scopeId = '';
                    if (jd.unitId) { scopeLevel = 'UNIT'; scopeId = jd.unitId; }
                    else if (jd.departmentId) { scopeLevel = 'DEPARTMENT'; scopeId = jd.departmentId; }
                    else if (jd.divisionId) { scopeLevel = 'DIVISION'; scopeId = jd.divisionId; }
                    else if (jd.directorateId) { scopeLevel = 'DIRECTORATE'; scopeId = jd.directorateId; }
                    setFormData({
                        title: jd.title,
                        description: jd.description || '',
                        isHead: jd.isHead,
                        plannedCount: jd.plannedCount,
                        scopeLevel,
                        scopeId,
                        jobCategories: jd.jobCategories || [],
                        workLocations: jd.workLocations || [],
                        details: { ...emptyDetails(), ...(jd.details || {}) },
                    });
                }
            } catch (error) {
                console.error('Error loading job description form:', error);
                toast.error(t('error_loading_data', { defaultValue: 'Failed to load data.' }));
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isEditMode]);

    const entitiesForLevel = (level: ScopeLevel) => {
        switch (level) {
            case 'DIRECTORATE': return directorates;
            case 'DIVISION': return divisions;
            case 'DEPARTMENT': return departments;
            case 'UNIT': return units;
        }
    };

    const buildScopePayload = () => {
        const payload: any = { directorateId: null, divisionId: null, departmentId: null, unitId: null };
        if (formData.scopeLevel === 'DIRECTORATE') payload.directorateId = formData.scopeId;
        if (formData.scopeLevel === 'DIVISION') payload.divisionId = formData.scopeId;
        if (formData.scopeLevel === 'DEPARTMENT') payload.departmentId = formData.scopeId;
        if (formData.scopeLevel === 'UNIT') payload.unitId = formData.scopeId;
        return payload;
    };

    const toggleJobCategory = (category: string) => {
        setFormData(prev => ({
            ...prev,
            jobCategories: prev.jobCategories.includes(category)
                ? prev.jobCategories.filter(c => c !== category)
                : [...prev.jobCategories, category],
        }));
    };

    const toggleWorkLocation = (loc: string) => {
        setFormData(prev => ({
            ...prev,
            workLocations: prev.workLocations.includes(loc)
                ? prev.workLocations.filter(l => l !== loc)
                : [...prev.workLocations, loc],
        }));
    };

    const setSectionField = (key: SectionKey, lang: 'en' | 'ar', value: string) => {
        setFormData(prev => ({
            ...prev,
            details: { ...prev.details, [key]: { ...prev.details[key], [lang]: value } },
        }));
    };

    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (!formData.scopeId) {
            toast.error(t('scope_required', { defaultValue: 'Please select an organizational unit for this Job Description.' }));
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                isHead: formData.isHead,
                plannedCount: formData.plannedCount,
                jobCategories: formData.jobCategories,
                workLocations: formData.workLocations,
                details: formData.details,
                ...buildScopePayload(),
            };
            if (isEditMode && editingId) {
                await jobDescriptionService.updateJobDescription(editingId, payload);
                toast.success(t('jd_updated', { defaultValue: 'Job Description updated.' }));
            } else {
                await jobDescriptionService.createJobDescription(payload);
                toast.success(t('jd_created', { defaultValue: 'Job Description created.' }));
            }
            navigate('/job-descriptions');
        } catch (error: any) {
            console.error('Error saving job description:', error);
            toast.error(error.response?.data?.error || t('error_saving_jd', { defaultValue: 'Failed to save Job Description.' }));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-500">{t('loading')}</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 pb-36">
            <div className="flex items-center gap-4">
                <button type="button" onClick={() => navigate('/job-descriptions')} className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? t('edit_job_description', { defaultValue: 'Edit Job Description' }) : t('add_job_description', { defaultValue: 'Add Job Description' })}</h1>
                    <p className="text-sm text-gray-500">{t('job_descriptions_subtitle', { defaultValue: 'Define staffing plan positions per Directorate, Division, Department, or Unit' })}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basics */}
                <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('basics', { defaultValue: 'Basics' })}</h4>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('position_title', { defaultValue: 'Position Title' })}</label>
                        <input
                            type="text" required value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. Accountant, Head of Finance"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('job_description_summary', { defaultValue: 'Summary / Overview' })}</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder={t('job_description_text_placeholder', { defaultValue: 'Short overview of this position. Assigned employees will be able to read this.' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('reports_to', { defaultValue: 'Reports To' })} <span className="text-gray-400 font-normal" dir="rtl">/ يقدم تقاريره إلى</span></label>
                        <input
                            type="text" value={formData.details.reportsTo || ''}
                            onChange={(e) => setFormData({ ...formData, details: { ...formData.details, reportsTo: e.target.value } })}
                            placeholder="e.g. Head of Finance"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        />
                    </div>

                    {/* Work Location */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">{t('work_location', { defaultValue: 'Work Location' })}</label>
                        <div className="flex flex-wrap gap-3">
                            {WORK_LOCATIONS.map(loc => {
                                const Icon = loc.icon;
                                const active = formData.workLocations.includes(loc.value);
                                return (
                                    <button
                                        type="button"
                                        key={loc.value}
                                        onClick={() => toggleWorkLocation(loc.value)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
                                    >
                                        <Icon size={16} />
                                        {loc.labelEn} <span className="text-xs opacity-60" dir="rtl">/ {loc.labelAr}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{t('work_location_hint', { defaultValue: 'Select one or both. Where this position is performed.' })}</p>
                    </div>
                </div>

                {/* Bilingual JD Document Sections */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('jd_document', { defaultValue: 'Job Description Document (English / العربية)' })}</h4>
                    {JD_SECTIONS.map(section => (
                        <div key={section.key} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-bold text-slate-800">{section.labelEn}</h5>
                                <h5 className="text-sm font-bold text-slate-600" dir="rtl">{section.labelAr}</h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">English</label>
                                    <textarea
                                        value={formData.details[section.key]?.en || ''}
                                        onChange={(e) => setSectionField(section.key, 'en', e.target.value)}
                                        rows={4}
                                        placeholder={section.labelEn}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 text-right">العربية</label>
                                    <textarea
                                        value={formData.details[section.key]?.ar || ''}
                                        onChange={(e) => setSectionField(section.key, 'ar', e.target.value)}
                                        rows={4}
                                        dir="rtl"
                                        placeholder={section.labelAr}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y text-sm text-right"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Placement & Plan */}
                <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('placement_and_plan', { defaultValue: 'Placement & Staffing Plan' })}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('organizational_level', { defaultValue: 'Organizational Level' })}</label>
                            <select
                                value={formData.scopeLevel}
                                onChange={(e) => setFormData({ ...formData, scopeLevel: e.target.value as ScopeLevel, scopeId: '' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="DIRECTORATE">Directorate</option>
                                <option value="DIVISION">Division</option>
                                <option value="DEPARTMENT">Department / Office</option>
                                <option value="UNIT">Unit</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{t('select_entity', { defaultValue: 'Select' })}</label>
                            <select
                                required value={formData.scopeId}
                                onChange={(e) => setFormData({ ...formData, scopeId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="">-- {t('select', { defaultValue: 'Select' })} --</option>
                                {entitiesForLevel(formData.scopeLevel).map((entity: any) => (
                                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('planned_headcount', { defaultValue: 'Planned Headcount' })}</label>
                        <input
                            type="number" min="1" required
                            value={formData.isHead ? 1 : formData.plannedCount}
                            disabled={formData.isHead}
                            onChange={(e) => setFormData({ ...formData, plannedCount: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed bg-white"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                            {formData.isHead
                                ? t('planned_headcount_head_hint', { defaultValue: 'A Head position can only have one holder (fixed at 1).' })
                                : t('planned_headcount_hint', { defaultValue: 'Maximum number of employees allowed under this Job Description.' })}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">{t('applicable_job_categories', { defaultValue: 'Applicable Job Categories' })}</label>
                        <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-gray-200">
                            {JOB_CATEGORIES.map(cat => (
                                <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={formData.jobCategories.includes(cat)}
                                        onChange={() => toggleJobCategory(cat)}
                                        className="app-check"
                                    />
                                    {cat}
                                </label>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{t('job_categories_hint', { defaultValue: 'Leave all unchecked to allow any job category for this position.' })}</p>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer p-3 bg-white rounded-lg border border-gray-200">
                        <input
                            type="checkbox" checked={formData.isHead}
                            onChange={(e) => setFormData({ ...formData, isHead: e.target.checked, plannedCount: e.target.checked ? 1 : formData.plannedCount })}
                            className="app-check"
                        />
                        <span className="text-sm font-bold text-gray-800">{t('is_head_position', { defaultValue: 'This is a Head position (only one holder allowed)' })}</span>
                    </label>
                </div>
            </form>

            {/* Sticky action bar */}
            <div className="fixed bottom-0 right-0 z-30 px-6 lg:px-10 pb-6 pt-2 pointer-events-none transition-[left] duration-500" style={{ left: 'var(--sidebar-width, 0px)' }}>
                <div className="max-w-5xl mx-auto flex gap-4 p-4 bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-2xl shadow-slate-300/40 pointer-events-auto">
                    <button type="button" onClick={() => navigate('/job-descriptions')} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
                        {t('cancel')}
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 px-6 py-4 rounded-xl bg-indigo-600 text-white font-bold shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2">
                        <Save size={18} />
                        {saving ? t('saving', { defaultValue: 'Saving…' }) : isEditMode ? t('update') : t('create')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobDescriptionForm;
