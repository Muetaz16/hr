import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { jobDescriptionService } from '../services/jobDescriptionService';
import { departmentService, divisionService } from '../services/departmentService';
import JobDescriptionView from '../components/JobDescriptionView';
import type { JobDescription, Department, Division } from '../types';
import { FileText, ChevronDown, Building2, Users, Crown, Search } from 'lucide-react';

// A read-only browse view of Job Descriptions.
// HR / Super Admin (and org-wide roles) see every JD and can filter by department & division.
// Heads only ever see the JDs that belong to their own scope.
const PRIVILEGED = ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'GENERAL_MANAGER', 'CHAIRMAN', 'HEAD_DIRECTOR'];

const JobDescriptionsBrowse: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();

    const [jds, setJds] = useState<JobDescription[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [loading, setLoading] = useState(true);

    const [deptFilter, setDeptFilter] = useState('');
    const [divFilter, setDivFilter] = useState('');
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);

    const canSeeAll = PRIVILEGED.includes(currentUser?.role || '');

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [j, d, v] = await Promise.all([
                    jobDescriptionService.getAllJobDescriptions().catch(() => []),
                    departmentService.getAllDepartments().catch(() => []),
                    divisionService.getAllDivisions().catch(() => []),
                ]);
                setJds(j);
                setDepartments(d);
                setDivisions(v);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // A head only owns JDs whose scope matches their own department / division / unit.
    const ownsJd = (jd: JobDescription) => {
        const depIds = [currentUser?.departmentId, ...((currentUser as any)?.departmentIds || [])].filter(Boolean);
        return (
            (jd.departmentId && depIds.includes(jd.departmentId)) ||
            (jd.divisionId && jd.divisionId === currentUser?.divisionId) ||
            (jd.unitId && jd.unitId === currentUser?.unitId) ||
            (jd.department?.id && depIds.includes(jd.department.id))
        );
    };

    const visibleJds = useMemo(() => {
        let list = canSeeAll ? jds : jds.filter(ownsJd);
        if (deptFilter) list = list.filter(jd => jd.departmentId === deptFilter);
        if (divFilter) list = list.filter(jd => jd.divisionId === divFilter || jd.department && departments.find(d => d.id === jd.departmentId)?.divisionId === divFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(jd => jd.title.toLowerCase().includes(q));
        }
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jds, canSeeAll, deptFilter, divFilter, search, departments, currentUser]);

    const scopeLabel = (jd: JobDescription) =>
        jd.unit?.name || jd.department?.name || jd.division?.name || jd.directorate?.name || '—';

    if (loading) return <div className="p-12 text-center animate-pulse text-slate-400">{t('loading', { defaultValue: 'Loading…' })}</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-4xl font-outfit font-black text-slate-800 tracking-tight">{t('nav_job_descriptions', { defaultValue: 'Job Descriptions' })}</h1>
                <p className="text-slate-500 font-medium mt-1">
                    {canSeeAll
                        ? t('jd_browse_sub_all', { defaultValue: 'Browse every job description. Filter by department or division.' })
                        : t('jd_browse_sub_head', { defaultValue: 'The job descriptions that belong to your area.' })}
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('search_job_title', { defaultValue: 'Search by job title…' })}
                        className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-2xl font-medium text-slate-700 bg-white"
                    />
                </div>
                {canSeeAll && (
                    <>
                        <select value={divFilter} onChange={e => setDivFilter(e.target.value)} className="px-4 py-3 border border-slate-200 rounded-2xl bg-white font-bold text-slate-700 min-w-[180px]">
                            <option value="">{t('all_divisions', { defaultValue: 'All Divisions' })}</option>
                            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="px-4 py-3 border border-slate-200 rounded-2xl bg-white font-bold text-slate-700 min-w-[180px]">
                            <option value="">{t('all_departments', { defaultValue: 'All Departments' })}</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </>
                )}
            </div>

            {/* List */}
            {visibleJds.length === 0 ? (
                <div className="py-20 text-center space-y-4 bg-white/40 rounded-[2.5rem] border border-slate-100">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><FileText className="w-10 h-10 text-slate-200" /></div>
                    <p className="text-slate-400 font-medium">{t('no_job_descriptions', { defaultValue: 'No job descriptions to show.' })}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {visibleJds.map(jd => {
                        const open = openId === jd.id;
                        const filled = jd._count?.employees || 0;
                        return (
                            <div key={jd.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setOpenId(open ? null : jd.id)}
                                    className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-slate-50/60 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-black text-slate-800 truncate">{jd.title}</h3>
                                            {jd.isHead && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100"><Crown className="w-3 h-3" /> {t('head', { defaultValue: 'Head' })}</span>}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
                                            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{scopeLabel(jd)}</span>
                                            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{filled}/{jd.plannedCount} {t('filled_lc', { defaultValue: 'filled' })}</span>
                                            {(jd.jobCategories || []).length > 0 && <span>{(jd.jobCategories || []).join(' · ')}</span>}
                                        </div>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && (
                                    <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                                        <JobDescriptionView jd={jd} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default JobDescriptionsBrowse;
