import React from 'react';
import type { JobDescription } from '../types';
import { Building2, MapPin, Crown } from 'lucide-react';

const SECTIONS: { key: keyof NonNullable<JobDescription['details']>; labelEn: string; labelAr: string }[] = [
    { key: 'jobPurpose', labelEn: 'Job Purpose', labelAr: 'الغرض من الوظيفة' },
    { key: 'keyResponsibilities', labelEn: 'Key Responsibilities', labelAr: 'المهام والمسؤوليات الرئيسية' },
    { key: 'kpi', labelEn: 'Key Performance Indicators', labelAr: 'مؤشرات الأداء الرئيسية' },
    { key: 'education', labelEn: 'Education Background', labelAr: 'المؤهلات العلمية' },
    { key: 'experience', labelEn: 'Experience Required', labelAr: 'الخبرة المطلوبة' },
    { key: 'skills', labelEn: 'Skills & Competencies Required', labelAr: 'المهارات والكفاءات المطلوبة' },
    { key: 'trainingLicenses', labelEn: 'Training & Licenses', labelAr: 'التدريب والرخص' },
    { key: 'workingConditions', labelEn: 'Working Conditions & Risk Exposure', labelAr: 'ظروف العمل والتعرض للمخاطر' },
];

const WORK_LABELS: Record<string, { en: string; ar: string; icon: any }> = {
    OFFICE: { en: 'Office Work', ar: 'عمل مكتبي', icon: Building2 },
    SITE: { en: 'Site Work', ar: 'عمل ميداني', icon: MapPin },
};

interface Props {
    jd: JobDescription;
    accent?: string; // tailwind text color class for headings, default indigo
}

const JobDescriptionView: React.FC<Props> = ({ jd, accent = 'text-indigo-600' }) => {
    const details = jd.details || {};
    const hasAnySection = SECTIONS.some(s => (details as any)[s.key]?.en || (details as any)[s.key]?.ar);

    return (
        <div className="space-y-5">
            {/* Header line: title + head badge + work locations */}
            <div className="flex flex-wrap items-center gap-2">
                <span className={`text-base font-black ${accent}`}>{jd.title}</span>
                {jd.isHead && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                        <Crown className="w-3 h-3" /> Head
                    </span>
                )}
                {(jd.workLocations || []).map(loc => {
                    const w = WORK_LABELS[loc];
                    if (!w) return null;
                    const Icon = w.icon;
                    return (
                        <span key={loc} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200">
                            <Icon className="w-3 h-3" /> {w.en}
                        </span>
                    );
                })}
            </div>

            {/* Summary */}
            {jd.description && (
                <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{jd.description}</p>
            )}

            {/* Bilingual sections */}
            {hasAnySection && (
                <div className="space-y-4">
                    {SECTIONS.map(section => {
                        const val = (details as any)[section.key] || {};
                        if (!val.en && !val.ar) return null;
                        return (
                            <div key={section.key} className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{section.labelEn}</span>
                                    <span className="text-xs font-black text-slate-500" dir="rtl">{section.labelAr}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                    <div className="p-4">
                                        {val.en
                                            ? <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{val.en}</p>
                                            : <p className="text-xs text-slate-300 italic">—</p>}
                                    </div>
                                    <div className="p-4" dir="rtl">
                                        {val.ar
                                            ? <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap text-right">{val.ar}</p>
                                            : <p className="text-xs text-slate-300 italic text-right">—</p>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!jd.description && !hasAnySection && (
                <p className="text-sm font-medium text-slate-400 italic">No detailed job description has been written for this position yet.</p>
            )}
        </div>
    );
};

export default JobDescriptionView;
