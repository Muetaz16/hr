import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { isEvaluationEnabled } from '../services/evaluationPeriodService';
import type { Employee } from '../types';
import {
    type EvalLevel, LEVEL_LABEL, type OrgPlacement,
    getRequiredLevels, levelForRole, canEvaluate
} from '../utils/evaluationHierarchy';
import Modal from '../components/Modal';
import PersonnelEvaluationModal from '../components/PersonnelEvaluationModal';
import { canAccess } from '../utils/access';
import { format } from 'date-fns';
import {
    Search, User, Clock, Calendar, ArrowUpRight, TrendingUp, Filter,
    FileText, FileSpreadsheet as ExcelIcon, CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { roleThemes } from '../config/roleThemes';
import type { UserRole } from '../types';

// Metric-based levels store the 16 competency scores (max total = 80).
const METRIC_LEVELS: EvalLevel[] = ['UNIT', 'DEPARTMENT', 'DIVISION', 'DIRECTOR'];
const MAX_METRIC_TOTAL = 80;

type EvalRecord = { totalScore?: number; finalScore?: number; submittedById?: string };
type LevelMaps = Record<EvalLevel, Record<string, EvalRecord>>;
const emptyMaps = (): LevelMaps => ({ UNIT: {}, DEPARTMENT: {}, DIVISION: {}, DIRECTOR: {}, GM: {}, CHAIRMAN: {} });

const EvaluationsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [searchTerm, setSearchTerm] = useState('');
    const [isPeriodEnabled, setIsPeriodEnabled] = useState(true);

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    // The evaluation records, indexed by level then employeeId.
    const [maps, setMaps] = useState<LevelMaps>(emptyMaps());
    const [persEvals, setPersEvals] = useState<Record<string, any>>({});

    // The logged-in manager's org placement (used to decide what they can evaluate).
    const [me, setMe] = useState<OrgPlacement | null>(null);
    const myLevel = levelForRole(currentUser?.role);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [modalLevel, setModalLevel] = useState<EvalLevel>('UNIT');
    // The "HR evaluation" (Exceptional Performance + Training) popup is a
    // separate, shared component — see PersonnelEvaluationModal.
    const [personnelEmp, setPersonnelEmp] = useState<Employee | null>(null);

    const initialMetrics = {
        relationshipWithColleagues: 0, teamworkParticipation: 0, workOrganization: 0, communicationSkills: 0, regulatoryCompliance: 0,
        taskQuality: 0, timeCommitment: 0, organizationalCompliance: 0, problemSolving: 0, pressureHandling: 0, continuousDevelopment: 0,
        regulationsAdherence: 0, safetyAdherence: 0, appearanceCommitment: 0, resourcePreservation: 0, dataPrivacy: 0,
        comments: ''
    };
    const [metricForm, setMetricForm] = useState(initialMetrics);
    const [scoreForm, setScoreForm] = useState({ finalScore: 0, comments: '' });

    useEffect(() => { fetchData(); }, [selectedMonth, currentUser]);

    const fetchData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Resolve the manager's full placement (directorate/division live on the employee record).
            let myRecord: Employee | null = null;
            try { myRecord = await employeeService.getMyEmployeeRecord(); } catch { /* no linked record */ }
            const placement: OrgPlacement = {
                role: currentUser.role,
                unitId: currentUser.unitId ?? myRecord?.unitId ?? null,
                departmentId: currentUser.departmentId ?? myRecord?.departmentId ?? null,
                divisionId: currentUser.divisionId ?? myRecord?.divisionId ?? null,
                directorateId: myRecord?.directorateId ?? null,
            };
            setMe(placement);

            // Everyone works from the full roster; visibility is decided by the skip-level rule.
            // Only ACTIVE staff are evaluated — transferred (inter-company) and pending-enrollment
            // employees are excluded (mirrors the backend evaluatee pool: enrollmentStatus ACTIVE).
            const allEmployees = (await employeeService.getAllEmployees())
                .filter((e: any) => e.enrollmentStatus !== 'TRANSFERRED' && e.enrollmentStatus !== 'PENDING_ENROLLMENT');

            const isAdminLike = canAccess(currentUser, ['HR_MANAGER', 'PERSONNEL'], ['view_hr_evaluations']);
            const visible = isAdminLike
                ? allEmployees
                : allEmployees.filter(emp => myLevel && canEvaluate(placement, emp as OrgPlacement, myLevel));
            setEmployees(visible);

            // Bulk-load every level for the month, then index by employeeId.
            const [unit, dept, division, director, gm, chairman, personnel] = await Promise.all([
                evaluationService.getUnitEvaluationsByMonth(selectedMonth),
                evaluationService.getDeptEvaluationsByMonth(selectedMonth),
                evaluationService.getDivisionEvaluationsByMonth(selectedMonth),
                evaluationService.getDirectorEvaluationsByMonth(selectedMonth),
                evaluationService.getGMEvaluationsByMonth(selectedMonth),
                evaluationService.getChairmanEvaluationsByMonth(selectedMonth),
                evaluationService.getPersonnelEvaluationsByMonth(selectedMonth),
            ]);

            const index = (rows: any[]) => rows.reduce((acc, r) => { acc[r.employeeId] = r; return acc; }, {} as Record<string, EvalRecord>);
            setMaps({
                UNIT: index(unit), DEPARTMENT: index(dept), DIVISION: index(division),
                DIRECTOR: index(director), GM: index(gm), CHAIRMAN: index(chairman),
            });
            setPersEvals(personnel.reduce((acc: any, r: any) => { acc[r.employeeId] = r; return acc; }, {}));

            const enabled = await isEvaluationEnabled(selectedMonth, currentUser.departmentId || undefined);
            setIsPeriodEnabled(enabled || currentUser.role === 'SUPER_ADMIN');
        } catch (error) {
            console.error('Error fetching evaluations:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Score helpers -------------------------------------------------------
    // Normalise every evaluation to a 0-100 percentage so the two can be averaged.
    const levelScore = (level: EvalLevel, empId: string): number | null => {
        const rec = maps[level][empId];
        if (!rec) return null;
        if (level === 'GM' || level === 'CHAIRMAN') return rec.finalScore ?? null;
        return rec.totalScore != null ? (rec.totalScore / MAX_METRIC_TOTAL) * 100 : null;
    };

    // Per-employee summary: the two required evaluators, how many are done, and the average.
    const summaryFor = (emp: Employee) => {
        const levels = getRequiredLevels(emp as OrgPlacement);
        const scores = levels.map(l => levelScore(l, emp.id));
        const present = scores.filter((s): s is number => s != null);
        const final = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
        return { levels, scores, done: present.length, total: levels.length, final };
    };

    // Single-record getters return field names in the frontend shape (mapped),
    // unlike the bulk byMonth data which is raw DB shape.
    const getMappedEval: Record<EvalLevel, (id: string, m: string) => Promise<any>> = {
        UNIT: evaluationService.getUnitEvaluation,
        DEPARTMENT: evaluationService.getDeptEvaluation,
        DIVISION: evaluationService.getDivisionEvaluation,
        DIRECTOR: evaluationService.getDirectorEvaluation,
        GM: evaluationService.getGMEvaluation,
        CHAIRMAN: evaluationService.getChairmanEvaluation,
    };

    const openModal = async (emp: Employee, level: EvalLevel) => {
        setSelectedEmp(emp);
        setModalLevel(level);
        if (level === 'GM' || level === 'CHAIRMAN') {
            const rec = await getMappedEval[level](emp.id, selectedMonth);
            setScoreForm({ finalScore: rec?.finalScore || 0, comments: rec?.comments || '' });
        } else {
            const rec = await getMappedEval[level](emp.id, selectedMonth);
            setMetricForm(rec ? { ...initialMetrics, ...rec, comments: rec.comments || '' } : initialMetrics);
        }
        setIsModalOpen(true);
    };

    const saveByLevel: Record<EvalLevel, (d: any) => Promise<any>> = {
        UNIT: evaluationService.saveUnitEvaluation,
        DEPARTMENT: evaluationService.saveDeptEvaluation,
        DIVISION: evaluationService.saveDivisionEvaluation,
        DIRECTOR: evaluationService.saveDirectorEvaluation,
        GM: evaluationService.saveGMEvaluation,
        CHAIRMAN: evaluationService.saveChairmanEvaluation,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp || !currentUser) return;
        const base = { employeeId: selectedEmp.id, month: selectedMonth, submittedBy: currentUser.id };
        try {
            if (modalLevel === 'GM' || modalLevel === 'CHAIRMAN') {
                await saveByLevel[modalLevel]({ ...base, ...scoreForm });
            } else {
                await saveByLevel[modalLevel]({ ...base, ...metricForm, submittedAt: new Date().toISOString() });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error saving evaluation:', error);
            alert(error instanceof Error ? error.message : 'Failed to save');
        }
    };

    const renderMetricInput = (label: string, description: string, field: keyof typeof initialMetrics, maxScore: number) => {
        const currentVal = metricForm[field];
        const displayValue = typeof currentVal === 'number' && maxScore > 0 ? Math.round((currentVal / maxScore) * 100) : 0;
        const handleChange = (inputVal: number) => {
            const val100 = Math.min(100, Math.max(0, inputVal));
            const scaledVal = (val100 / 100) * maxScore;
            setMetricForm(prev => ({ ...prev, [field]: scaledVal }));
        };
        return (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-5 border-b border-slate-100 last:border-0">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-slate-700">{label}</label>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded shrink-0">Weight {maxScore}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">{description}</p>
                </div>
                <div className="relative w-full sm:w-40 shrink-0">
                    <input
                        type="number" min="0" max="100" step="1" required value={displayValue}
                        onChange={(e) => handleChange(Number(e.target.value))}
                        className="w-full pl-4 pr-9 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-300 transition-all font-bold text-slate-800 text-base text-center"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                </div>
            </div>
        );
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (currentUser?.role === 'SUPER_ADMIN' || emp.userId !== currentUser?.id)
    );

    const completedCount = filteredEmployees.filter(emp => { const s = summaryFor(emp); return s.total > 0 && s.done >= s.total; }).length;
    const completionRate = filteredEmployees.length > 0 ? Math.round((completedCount / filteredEmployees.length) * 100) : 0;

    const handleExportExcel = () => {
        try {
            const titleStyle = { font: { name: 'Segoe UI', sz: 16, bold: true, color: { rgb: 'E3C4A2' } }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: '541C2C' } } };
            const metaStyle = { font: { name: 'Segoe UI', sz: 10, italic: true, color: { rgb: 'AA7A51' } }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'FAF7F5' } } };
            const headStyle = { font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: '541C2C' } } };
            const baseStyle = { font: { name: 'Segoe UI', sz: 10, color: { rgb: '300A15' } }, alignment: { horizontal: 'center', vertical: 'center' } };
            const leftStyle = { ...baseStyle, alignment: { horizontal: 'left', vertical: 'center' } };

            const header = ['Staff ID', 'Employee', 'Role', 'Evaluator 1', 'Score 1', 'Evaluator 2', 'Score 2', 'Progress', 'Final (avg)'];
            const cols = header.length;
            const row1 = [{ v: 'IPH HR SYSTEM - MONTHLY EVALUATION SUMMARY', s: titleStyle }, ...Array(cols - 1).fill({ v: '', s: titleStyle })];
            const row2 = [{ v: `Month: ${selectedMonth} | Exported: ${format(new Date(), 'dd MMM yyyy HH:mm')} | Staff: ${filteredEmployees.length}`, s: metaStyle }, ...Array(cols - 1).fill({ v: '', s: metaStyle })];
            const row3 = header.map(h => ({ v: h, s: headStyle }));

            const fmt = (n: number | null) => n == null ? 'Pending' : `${n.toFixed(1)}%`;
            const dataRows = filteredEmployees.map(emp => {
                const s = summaryFor(emp);
                return [
                    { v: emp.staffId || '---', s: baseStyle },
                    { v: emp.fullName, s: leftStyle },
                    { v: emp.role, s: leftStyle },
                    { v: s.levels[0] ? LEVEL_LABEL[s.levels[0]] : '—', s: baseStyle },
                    { v: fmt(s.scores[0] ?? null), s: baseStyle },
                    { v: s.levels[1] ? LEVEL_LABEL[s.levels[1]] : '—', s: baseStyle },
                    { v: fmt(s.scores[1] ?? null), s: baseStyle },
                    { v: `${s.done}/${s.total}`, s: baseStyle },
                    { v: fmt(s.final), s: baseStyle },
                ];
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([row1, row2, row3, ...dataRows]);
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } }];
            ws['!cols'] = header.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...dataRows.map(r => String(r[i].v).length)) + 4, 40) }));
            XLSX.utils.book_append_sheet(wb, ws, 'Evaluations');
            XLSX.writeFile(wb, `IPH_Evaluations_${selectedMonth}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        } catch (error) {
            console.error('Error exporting Excel:', error);
            alert('Failed to export report: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    // Which evaluation buttons should this manager see for this employee?
    const actionsFor = (emp: Employee): (EvalLevel | 'PERSONNEL')[] => {
        if (!me) return [];
        const required = getRequiredLevels(emp as OrgPlacement);
        const actions: (EvalLevel | 'PERSONNEL')[] = [];
        if (currentUser?.role === 'SUPER_ADMIN') {
            actions.push(...required); // admin may fill either required level
        } else if (canAccess(currentUser, ['HR_MANAGER', 'PERSONNEL'], ['view_hr_evaluations'])) {
            // Stand in only for levels nobody has evaluated yet, or to fix their own
            // prior stand-in entry — never to overwrite a real manager's submission.
            actions.push(...required.filter(l => {
                const rec = maps[l]?.[emp.id];
                return !rec || rec.submittedById === currentUser.id;
            }));
        } else if (myLevel && canEvaluate(me, emp as OrgPlacement, myLevel)) {
            actions.push(myLevel);
        }
        if (currentUser?.role === 'PERSONNEL' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.permissions?.includes('view_hr_evaluations')) actions.push('PERSONNEL');
        return actions;
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-[slideIn_0.5s_ease-out_forwards]">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/20">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('evaluations_title')}</h1>
                    <p className="text-slate-500 mt-1">{t('evaluations_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleExportExcel} className="px-5 py-2 bg-gradient-to-r from-[#aa7a51] to-[#e3c4a2] text-slate-900 rounded-2xl font-black text-xs hover:opacity-90 transition-all flex items-center gap-2 shadow-lg active:scale-95 border border-[#e3c4a2]/20 cursor-pointer">
                        <ExcelIcon className="w-4 h-4 text-slate-900" />
                        {t('export_excel', { defaultValue: 'EXPORT EVALUATIONS' })}
                    </button>
                    <div className="glass-card flex items-center px-4 py-2 rounded-2xl shadow-sm border border-white/40 bg-white/40 sticky top-0 backdrop-blur-md">
                        <Calendar className="w-4 h-4 text-slate-500 mr-2" />
                        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent border-none text-slate-800 font-bold focus:ring-0 text-sm p-0 cursor-pointer" />
                    </div>
                </div>
            </div>

            {!isPeriodEnabled && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-black text-amber-800 uppercase tracking-wide">Evaluation Period Closed</p>
                        <p className="text-xs text-amber-600 font-medium mt-0.5">Submissions are disabled for {selectedMonth}. Contact HR to open the window.</p>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-3xl border-l-4 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300" style={{ borderLeftColor: theme.primary }}>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-slate-50/50 rounded-2xl"><User className="w-5 h-5 text-slate-600" /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">{t('total_employees')}</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">{filteredEmployees.length}</p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">{t('assigned_employees')}</p>
                </div>
                <div className="glass-card p-6 rounded-3xl border-l-4 border-yellow-400 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-yellow-50/50 rounded-2xl text-yellow-600"><Clock className="w-5 h-5" /></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">{t('pending')}</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">{filteredEmployees.length - completedCount}</p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">{t('requires_approval')}</p>
                </div>
                <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-500 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-emerald-50/50 rounded-2xl text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
                        <div className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md"><ArrowUpRight className="w-3 h-3 mr-1" /> {t('finish')}</div>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">{completionRate}%</p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">{t('completion_progress')}</p>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white/40">
                <div className="p-6 border-b border-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/30 backdrop-blur-md">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input type="text" placeholder={t('filter_by_name')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 pr-4 py-2.5 bg-white/50 border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-80 shadow-sm" />
                    </div>
                    <button className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/40 px-3 py-2 rounded-xl border border-white/40"><Filter className="w-4 h-4 mr-2" /> {t('show_all')}</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-left">
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('employee')}</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Required Evaluators</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Final (avg)</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{t('action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => {
                                const s = summaryFor(emp);
                                const actions = actionsFor(emp);
                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#541c2c] to-[#aa7a51] flex items-center justify-center text-[#e3c4a2] font-black text-sm mr-4 shadow-md shadow-[#300a15]/50">{(emp.fullName || 'U').charAt(0)}</div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{emp.fullName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{t('id')}: {emp.staffId || emp.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            {s.levels.length === 0 ? (
                                                <span className="text-slate-400 text-xs italic">Top of hierarchy</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {s.levels.map((lvl, i) => (
                                                        <span key={lvl} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${s.scores[i] != null ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                                            {s.scores[i] != null && <CheckCircle2 className="w-3 h-3" />}
                                                            {LEVEL_LABEL[lvl]}{s.scores[i] != null ? ` · ${s.scores[i]!.toFixed(0)}%` : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold ${s.total > 0 && s.done >= s.total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'}`}>
                                                {s.done}/{s.total} {t('done', { defaultValue: 'done' })}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4">
                                            {s.final != null ? (
                                                <div className="font-bold text-slate-700 bg-slate-100/50 inline-block px-2 py-1 rounded-lg">{s.final.toFixed(1)}%</div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic px-2">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {actions.length === 0 && <span className="text-[10px] text-slate-300 italic">—</span>}
                                                {actions.map(a => {
                                                    const done = a !== 'PERSONNEL' && maps[a]?.[emp.id];
                                                    const persDone = a === 'PERSONNEL' && persEvals[emp.id];
                                                    const disabled = a !== 'PERSONNEL' && !isPeriodEnabled && currentUser?.role !== 'SUPER_ADMIN';
                                                    const label = a === 'PERSONNEL' ? t('personnel_evaluation') : `${LEVEL_LABEL[a]} evaluation`;
                                                    return (
                                                        <button
                                                            key={a}
                                                            onClick={() => a === 'PERSONNEL' ? setPersonnelEmp(emp) : openModal(emp, a)}
                                                            disabled={disabled}
                                                            title={label}
                                                            className={`p-2 rounded-xl border transition-all shadow-sm hover:shadow-md ${disabled ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : (done || persDone) ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white'}`}
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="max-w-xs mx-auto flex flex-col items-center">
                                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200"><Search className="w-8 h-8" /></div>
                                            <p className="font-bold text-slate-800">{t('no_results')}</p>
                                            <p className="text-slate-500 text-sm mt-1">{t('no_results_desc')}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`${LEVEL_LABEL[modalLevel]} — ${selectedEmp?.fullName || ''}`}
                fullScreen
                fullScreenWidth="max-w-5xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4 sticky top-0 z-10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#541c2c] to-[#aa7a51] flex items-center justify-center mr-4 text-[#e3c4a2] font-black shadow-md shadow-[#300a15]/50">{(selectedEmp?.fullName || 'U').charAt(0)}</div>
                        <div>
                            <p className="font-bold text-slate-800 leading-none mb-1">{selectedEmp?.fullName}</p>
                            <p className="text-xs text-slate-500">{selectedMonth} • {t('assessment_period')}</p>
                        </div>
                    </div>

                    {/* Metric-based levels */}
                    {METRIC_LEVELS.includes(modalLevel) && (
                        <>
                            <div className="bg-white/60 rounded-2xl border border-slate-100 p-6">
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-3 mb-1 flex justify-between">{t('administrative_behavior')} <span className="text-indigo-600">25%</span></h4>
                                {renderMetricInput(t('relationship_with_colleagues'), t('relationship_with_colleagues_desc'), 'relationshipWithColleagues', 5)}
                                {renderMetricInput(t('teamwork_participation'), t('teamwork_participation_desc'), 'teamworkParticipation', 5)}
                                {renderMetricInput(t('work_organization'), t('work_organization_desc'), 'workOrganization', 5)}
                                {renderMetricInput(t('written_communication'), t('written_communication_desc'), 'communicationSkills', 5)}
                                {renderMetricInput(t('regulatory_compliance'), t('regulatory_compliance_desc'), 'regulatoryCompliance', 5)}
                            </div>
                            <div className="bg-white/60 rounded-2xl border border-slate-100 p-6">
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-3 mb-1 flex justify-between">{t('executive_performance')} <span className="text-indigo-600">40%</span></h4>
                                {renderMetricInput(t('quality_completion'), t('quality_completion_desc'), 'taskQuality', 7)}
                                {renderMetricInput(t('time_commitment'), t('time_commitment_desc'), 'timeCommitment', 7)}
                                {renderMetricInput(t('organizational_compliance'), t('organizational_compliance_desc'), 'organizationalCompliance', 7)}
                                {renderMetricInput(t('problem_solving'), t('problem_solving_desc'), 'problemSolving', 6)}
                                {renderMetricInput(t('performance_pressure'), t('performance_pressure_desc'), 'pressureHandling', 7)}
                                {renderMetricInput(t('continuous_development'), t('continuous_development_desc'), 'continuousDevelopment', 6)}
                            </div>
                            <div className="bg-white/60 rounded-2xl border border-slate-100 p-6">
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-3 mb-1 flex justify-between">{t('care_and_discipline')} <span className="text-indigo-600">15%</span></h4>
                                {renderMetricInput(t('regulations_adherence'), t('regulations_adherence_desc'), 'regulationsAdherence', 3)}
                                {renderMetricInput(t('safety_adherence'), t('safety_adherence_desc'), 'safetyAdherence', 3)}
                                {renderMetricInput(t('workplace_appearance'), t('workplace_appearance_desc'), 'appearanceCommitment', 3)}
                                {renderMetricInput(t('resource_preservation'), t('resource_preservation_desc'), 'resourcePreservation', 3)}
                                {renderMetricInput(t('data_privacy'), t('data_privacy_desc'), 'dataPrivacy', 3)}
                            </div>
                            <div className="bg-white/60 rounded-2xl border border-slate-100 p-6 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('observer_comments')}</label>
                                <textarea value={metricForm.comments} onChange={(e) => setMetricForm({ ...metricForm, comments: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all text-slate-700 min-h-[100px]" placeholder={t('add_feedback')} />
                            </div>
                        </>
                    )}

                    {/* Score-only levels (GM / Chairman) */}
                    {(modalLevel === 'GM' || modalLevel === 'CHAIRMAN') && (
                        <div className="space-y-6">
                            <div className="bg-white/60 rounded-2xl border border-slate-100 p-6">
                                <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-3 mb-1">{t('overall_performance')}</h4>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
                                    <div className="flex-1">
                                        <label className="text-sm font-bold text-slate-700">Final Score (0–100)</label>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">{t('final_score_desc')}</p>
                                    </div>
                                    <div className="w-full sm:w-40 shrink-0">
                                        <input type="number" min="0" max="100" step="0.1" required value={scoreForm.finalScore} onChange={(e) => setScoreForm({ ...scoreForm, finalScore: Math.min(100, Math.max(0, Number(e.target.value))) })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-300 transition-all font-bold text-slate-800 text-base text-center" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/60 rounded-2xl border border-slate-100 p-6 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{t('observer_comments')}</label>
                                <textarea value={scoreForm.comments} onChange={(e) => setScoreForm({ ...scoreForm, comments: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl text-slate-700 min-h-[100px]" placeholder={t('add_feedback')} />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t sticky bottom-0 bg-white pb-2 flex gap-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">{t('cancel')}</button>
                        <button type="submit" className={`flex-1 px-6 py-4 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${theme.gradient}`}>{t('submit_assessment')}</button>
                    </div>
                </form>
            </Modal>

            <PersonnelEvaluationModal
                employee={personnelEmp}
                month={selectedMonth}
                isOpen={!!personnelEmp}
                onClose={() => setPersonnelEmp(null)}
                onSaved={fetchData}
            />
        </div>
    );
};

export default EvaluationsPage;
