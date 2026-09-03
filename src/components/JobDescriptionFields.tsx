import React from 'react';
import { useTranslation } from 'react-i18next';
import { JOB_CATEGORIES, jobCategoryKey } from '../types';
import type { JobDescriptionDetails } from '../types';
import { Building2, MapPin } from 'lucide-react';

// The bilingual document sections only — excludes scalar fields like reportsTo.
export type SectionKey = Exclude<keyof JobDescriptionDetails, 'reportsTo'>;

export const JD_SECTIONS: { key: SectionKey; labelEn: string; labelAr: string }[] = [
    { key: 'jobPurpose', labelEn: 'Job Purpose', labelAr: 'الغرض من الوظيفة' },
    { key: 'keyResponsibilities', labelEn: 'Key Responsibilities', labelAr: 'المهام والمسؤوليات الرئيسية' },
    { key: 'kpi', labelEn: 'Key Performance Indicators', labelAr: 'مؤشرات الأداء الرئيسية' },
    { key: 'education', labelEn: 'Education Background', labelAr: 'المؤهلات العلمية' },
    { key: 'experience', labelEn: 'Experience Required', labelAr: 'الخبرة المطلوبة' },
    { key: 'skills', labelEn: 'Skills & Competencies Required', labelAr: 'المهارات والكفاءات المطلوبة' },
    { key: 'trainingLicenses', labelEn: 'Training & Licenses', labelAr: 'التدريب والرخص' },
    { key: 'workingConditions', labelEn: 'Working Conditions & Risk Exposure', labelAr: 'ظروف العمل والتعرض للمخاطر' },
];

export const WORK_LOCATIONS: { value: string; labelEn: string; labelAr: string; icon: any }[] = [
    { value: 'OFFICE', labelEn: 'Office Work', labelAr: 'عمل مكتبي', icon: Building2 },
    { value: 'SITE', labelEn: 'Site Work', labelAr: 'عمل ميداني', icon: MapPin },
];

export const emptyJDDetails = (): JobDescriptionDetails => ({
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

export interface JDFormValue {
    title: string;
    description: string;
    isHead: boolean;
    plannedCount: number;
    jobCategories: string[];
    workLocations: string[];
    details: JobDescriptionDetails;
}

interface Props {
    value: JDFormValue;
    onChange: (next: JDFormValue) => void;
    hideTitle?: boolean; // when the caller renders the title elsewhere
}

const JobDescriptionFields: React.FC<Props> = ({ value, onChange, hideTitle }) => {
    const { t } = useTranslation();
    const set = (patch: Partial<JDFormValue>) => onChange({ ...value, ...patch });

    const toggleWorkLocation = (loc: string) => set({
        workLocations: value.workLocations.includes(loc)
            ? value.workLocations.filter(l => l !== loc)
            : [...value.workLocations, loc]
    });

    const toggleCategory = (cat: string) => set({
        jobCategories: value.jobCategories.includes(cat)
            ? value.jobCategories.filter(c => c !== cat)
            : [...value.jobCategories, cat]
    });

    const setSection = (key: SectionKey, lang: 'en' | 'ar', v: string) => set({
        details: { ...value.details, [key]: { ...value.details[key], [lang]: v } }
    });

    return (
        <div className="space-y-4">
            {!hideTitle && (
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('position_title', { defaultValue: 'Position Title' })}</label>
                    <input
                        type="text" required value={value.title}
                        onChange={(e) => set({ title: e.target.value })}
                        placeholder={t('e_g_accountant_head_of_finance', { defaultValue: 'e.g. Accountant, Head of Finance' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                </div>
            )}

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('summary_overview', { defaultValue: 'Summary / Overview' })}</label>
                <textarea
                    value={value.description} rows={3}
                    onChange={(e) => set({ description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y bg-white"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('planned_headcount', { defaultValue: 'Planned Headcount' })}</label>
                    <input
                        type="number" min="1" required
                        value={value.isHead ? 1 : value.plannedCount}
                        disabled={value.isHead}
                        onChange={(e) => set({ plannedCount: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 bg-white"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">{value.isHead ? t('a_head_position_is_fixed_at_1', { defaultValue: 'A Head position is fixed at 1.' }) : t('maximum_number_of_employees_for_this_position', { defaultValue: 'Maximum number of employees for this position.' })}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">{t('work_location', { defaultValue: 'Work Location' })}</label>
                    <div className="flex flex-wrap gap-2">
                        {WORK_LOCATIONS.map(loc => {
                            const Icon = loc.icon;
                            const active = value.workLocations.includes(loc.value);
                            return (
                                <button type="button" key={loc.value} onClick={() => toggleWorkLocation(loc.value)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                                    <Icon size={14} /> {loc.labelEn}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('applicable_job_categories', { defaultValue: 'Applicable Job Categories' })}</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-gray-200">
                    {JOB_CATEGORIES.map(cat => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                            <input type="checkbox" checked={value.jobCategories.includes(cat)} onChange={() => toggleCategory(cat)} className="text-indigo-600 focus:ring-indigo-500 rounded" />
                            {t(jobCategoryKey(cat), { defaultValue: cat })}
                        </label>
                    ))}
                </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 bg-white rounded-lg border border-gray-200">
                <input type="checkbox" checked={value.isHead}
                    onChange={(e) => set({ isHead: e.target.checked, plannedCount: e.target.checked ? 1 : value.plannedCount })}
                    className="text-indigo-600 focus:ring-indigo-500 rounded" />
                <span className="text-sm font-bold text-gray-800">{t('this_is_a_head_position_only_one_holder', { defaultValue: 'This is a Head position (only one holder allowed)' })}</span>
            </label>

            <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('job_description_document_english', { defaultValue: 'Job Description Document (English / العربية)' })}</h4>
                {JD_SECTIONS.map(section => (
                    <div key={section.key} className="p-4 bg-white rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-bold text-slate-800">{section.labelEn}</h5>
                            <h5 className="text-sm font-bold text-slate-600" dir="rtl">{section.labelAr}</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <textarea
                                value={value.details[section.key]?.en || ''} rows={3}
                                onChange={(e) => setSection(section.key, 'en', e.target.value)}
                                placeholder={t('english', { defaultValue: 'English' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y text-sm"
                            />
                            <textarea
                                value={value.details[section.key]?.ar || ''} rows={3} dir="rtl"
                                onChange={(e) => setSection(section.key, 'ar', e.target.value)}
                                placeholder="العربية"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y text-sm text-right"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default JobDescriptionFields;
