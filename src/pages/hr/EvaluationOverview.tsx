import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { departmentService, divisionService } from '../../services/departmentService';
import { directorateService } from '../../services/directorateService';
import { unitService } from '../../services/unitService';
import { employeeService } from '../../services/employeeService';
import { evaluationService } from '../../services/evaluationService';
import { getHREvaluationsByMonth } from '../../services/hrEvaluationService';
import type { Employee, Department, Division, Directorate, Unit } from '../../types';
import { type EvalLevel, type OrgPlacement, getRequiredLevels } from '../../utils/evaluationHierarchy';
import { buildEvaluationBreakdown, mapRawHREval, mapRawOrgEval, METRIC_LEVELS, type EvaluationBreakdown } from '../../utils/evaluationScoring';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Search, Building2, FileSearch, Pencil, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../../components/Modal';
import EvaluationBreakdownView from '../../components/EvaluationBreakdownView';
import PersonnelEvaluationModal from '../../components/PersonnelEvaluationModal';

type LevelMaps = Record<EvalLevel, Record<string, any>>;
const emptyMaps = (): LevelMaps => ({ UNIT: {}, DEPARTMENT: {}, DIVISION: {}, DIRECTOR: {}, GM: {}, CHAIRMAN: {} });

interface Props {
    month: string;
}

const ScoreBadge: React.FC<{ label?: string; value: string; done: boolean }> = ({ label, value, done }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${done ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-500 ring-1 ring-red-100'}`}>
        {done ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        {label ? `${label} · ` : ''}{value}
    </span>
);

// HR-facing roster: every active employee, grouped by department, with the
// final-score formula broken into exactly the columns HR asked for — the two
// line-manager evaluators (each shown pre-halved so they sum to the real
// averaged contribution), Presence, Exceptional Performance and Training
// (HR's own part — entered via the shared per-employee popup, not a grid),
// and the aggregated Final Score. Reuses buildEvaluationBreakdown against
// data already bulk-fetched here, so there's no extra per-employee network cost.
const EvaluationOverview: React.FC<Props> = ({ month }) => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [directorates, setDirectorates] = useState<Directorate[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [maps, setMaps] = useState<LevelMaps>(emptyMaps());
    const [hrMap, setHrMap] = useState<Record<string, any>>({});
    const [persMap, setPersMap] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
    const [personnelEmp, setPersonnelEmp] = useState<Employee | null>(null);
    const [finalizedMap, setFinalizedMap] = useState<Record<string, { finalizedAt: string; isAuto: boolean }>>({});
    const [finalizing, setFinalizing] = useState<string | null>(null); // 'all' | groupName | employeeId | null

    useEffect(() => { fetchAll(); }, [month]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [emps, depts, divs, dirs, unitList, unitEvals, deptEvals, divEvals, dirEvals, gmEvals, chairmanEvals, persEvals, hrEvals, finalizations] = await Promise.all([
                employeeService.getAllEmployees(),
                departmentService.getAllDepartments(),
                divisionService.getAllDivisions(),
                directorateService.getAllDirectorates(),
                unitService.getAllUnits(),
                evaluationService.getUnitEvaluationsByMonth(month),
                evaluationService.getDeptEvaluationsByMonth(month),
                evaluationService.getDivisionEvaluationsByMonth(month),
                evaluationService.getDirectorEvaluationsByMonth(month),
                evaluationService.getGMEvaluationsByMonth(month),
                evaluationService.getChairmanEvaluationsByMonth(month),
                evaluationService.getPersonnelEvaluationsByMonth(month),
                getHREvaluationsByMonth(month),
                evaluationService.getFinalizationsByMonth(month),
            ]);
            setEmployees(emps.filter((e: any) => (e.enrollmentStatus || 'ACTIVE') === 'ACTIVE'));
            setDepartments(depts);
            setDivisions(divs);
            setDirectorates(dirs);
            setUnits(unitList);

            // Bulk endpoints return raw DB-shaped records; map them to the same
            // frontend field names the single-record endpoints use, so they're
            // interchangeable with buildEvaluationBreakdown's expectations.
            const mappedOrgIndex = (arr: any[]) => arr.reduce((acc, r) => { acc[r.employeeId] = mapRawOrgEval(r); return acc; }, {} as Record<string, any>);
            const index = (arr: any[]) => arr.reduce((acc, r) => { acc[r.employeeId] = r; return acc; }, {} as Record<string, any>);
            setMaps({
                UNIT: mappedOrgIndex(unitEvals), DEPARTMENT: mappedOrgIndex(deptEvals), DIVISION: mappedOrgIndex(divEvals),
                DIRECTOR: mappedOrgIndex(dirEvals), GM: index(gmEvals), CHAIRMAN: index(chairmanEvals),
            });
            setPersMap(index(persEvals));
            setHrMap(Object.fromEntries(Object.entries(index(hrEvals)).map(([id, r]) => [id, mapRawHREval(r)])));
            setFinalizedMap(Object.fromEntries(finalizations.map((f: any) => [f.employeeId, f])));
        } catch (error) {
            console.error('Error loading evaluation overview:', error);
        } finally {
            setLoading(false);
        }
    };

    const unitDeptMap = useMemo(() => Object.fromEntries(units.map(u => [u.id, u.departmentId])), [units]);
    const deptNameById = useMemo(() => Object.fromEntries(departments.map(d => [d.id, d.name])), [departments]);
    const divNameById = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d.name])), [divisions]);
    const dirNameById = useMemo(() => Object.fromEntries(directorates.map(d => [d.id, d.name])), [directorates]);

    // Bucket employees by their actual department, falling back to their
    // unit's parent department, then division/directorate for staff placed
    // directly at those levels (division/directorate heads, the GM).
    const groupNameFor = (emp: Employee): string => {
        const deptId = emp.departmentId || (emp.unitId ? unitDeptMap[emp.unitId] : undefined);
        if (deptId && deptNameById[deptId]) return deptNameById[deptId];
        if (emp.divisionId && divNameById[emp.divisionId]) return `${divNameById[emp.divisionId]} — Division`;
        if (emp.directorateId && dirNameById[emp.directorateId]) return `${dirNameById[emp.directorateId]} — Directorate`;
        return 'Unassigned';
    };

    const breakdownFor = (emp: Employee): EvaluationBreakdown => {
        const requiredLevels = getRequiredLevels(emp as unknown as OrgPlacement);
        const [lvlA, lvlB] = requiredLevels;
        return buildEvaluationBreakdown({
            employeeId: emp.id,
            month,
            requiredLevels,
            levelARecord: lvlA ? (maps[lvlA][emp.id] ?? null) : null,
            levelBRecord: lvlB ? (maps[lvlB][emp.id] ?? null) : null,
            hrEval: hrMap[emp.id] ?? null,
            persEval: persMap[emp.id] ?? null,
        });
    };

    // Each line-manager column is pre-halved so the two sum to exactly the
    // already-verified averaged Admin+Exec+Care contribution; if only one
    // evaluator exists, they count at full weight (matches the formula).
    // null = not evaluated yet; the caller distinguishes "not applicable"
    // (score-only GM/Chairman slot) separately via `isMetric`.
    const managerColumnValue = (mine: any | null, other: any | null): number | null => {
        if (!mine) return null;
        return other ? mine.totalScore / 2 : mine.totalScore;
    };

    // Mirrors the server-side day-25 guard (Presence isn't final before then) — a
    // client-side convenience so the button doesn't invite a doomed request; the
    // server is the real enforcement point. Past months are always finalizable.
    const canFinalizeMonth = useMemo(() => {
        if (currentUser?.role === 'SUPER_ADMIN') return true;
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (month < currentMonth) return true;
        if (month > currentMonth) return false;
        return now.getDate() >= 25;
    }, [month, currentUser]);

    const finalizeOne = async (employeeId: string) => {
        setFinalizing(employeeId);
        try {
            await evaluationService.finalizeEvaluations(month, { employeeId });
            toast.success(t('evaluation_finalized', { defaultValue: 'Evaluation finalized.' }));
            await fetchAll();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('failed_to_finalize_evaluation', { defaultValue: 'Failed to finalize evaluation.' }));
        } finally {
            setFinalizing(null);
        }
    };

    const finalizeGroup = async (groupName: string, groupEmployees: Employee[]) => {
        setFinalizing(groupName);
        try {
            const targets = groupEmployees.filter(e => !finalizedMap[e.id]);
            for (const emp of targets) {
                await evaluationService.finalizeEvaluations(month, { employeeId: emp.id });
            }
            toast.success(t('finalized_employees_in_group', { defaultValue: 'Finalized {{count}} employee(s) in {{groupName}}.', count: targets.length, groupName }));
            await fetchAll();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('failed_to_finalize_group', { defaultValue: 'Failed to finalize group.' }));
        } finally {
            setFinalizing(null);
        }
    };

    const finalizeAll = async () => {
        setFinalizing('all');
        try {
            const result = await evaluationService.finalizeEvaluations(month);
            toast.success(t('finalized_employees_already_done', { defaultValue: 'Finalized {{finalized}} employee(s), {{skipped}} already done.', finalized: result.finalized, skipped: result.skipped }));
            await fetchAll();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('failed_to_finalize_all_evaluations', { defaultValue: 'Failed to finalize all evaluations.' }));
        } finally {
            setFinalizing(null);
        }
    };

    const groups = useMemo(() => {
        const filtered = employees.filter(e => e.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
        const map = new Map<string, Employee[]>();
        for (const emp of filtered) {
            const key = groupNameFor(emp);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(emp);
        }
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [employees, searchTerm, unitDeptMap, deptNameById, divNameById, dirNameById]);

    const toggleGroup = (key: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // "Fully evaluated" = every required org-level evaluator has submitted.
    const isFullyEvaluated = (emp: Employee) => {
        const levels = getRequiredLevels(emp as unknown as OrgPlacement);
        if (levels.length === 0) return true;
        return levels.every(l => !!maps[l][emp.id]);
    };

    const totalEmployees = employees.length;
    const fullyEvaluated = employees.filter(isFullyEvaluated).length;

    if (loading) return <div className="p-12 text-center text-slate-400">{t('loading_evaluation_overview', { defaultValue: 'Loading evaluation overview...' })}</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-500" />
                        {t('evaluation_status_by_department', { defaultValue: 'Evaluation Status by Department' })}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {t('all_employees_for_month_fully_evaluated', { defaultValue: 'All employees for {{month}} — {{done}}/{{total}} fully evaluated.', month, done: fullyEvaluated, total: totalEmployees })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text" placeholder={t('search_employee', { defaultValue: 'Search employee...' })} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="ps-9 pe-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-64 outline-none"
                        />
                    </div>
                    <button
                        onClick={finalizeAll}
                        disabled={!canFinalizeMonth || finalizing !== null}
                        title={!canFinalizeMonth ? t('presence_data_is_not_final_until_day_25', { defaultValue: 'Presence data is not final until day 25 of the month' }) : t('save_finalize_every_employee_s_evaluation_for_this', { defaultValue: "Save/finalize every employee's evaluation for this month" })}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {finalizing === 'all' ? t('finalizing', { defaultValue: 'Finalizing…' }) : t('finalize_all', { defaultValue: 'Finalize All' })}
                    </button>
                </div>
            </div>

            <div className="divide-y divide-slate-100">
                {groups.length === 0 && (
                    <div className="p-12 text-center text-slate-400 text-sm">{t('no_employees_found', { defaultValue: 'No employees found.' })}</div>
                )}
                {groups.map(([groupName, groupEmployees]) => {
                    const isCollapsed = collapsed.has(groupName);
                    const groupDone = groupEmployees.filter(isFullyEvaluated).length;
                    return (
                        <div key={groupName}>
                            <div className="w-full px-6 py-4 flex items-center justify-between gap-4 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                                <button onClick={() => toggleGroup(groupName)} className="flex items-center gap-2 text-start flex-1">
                                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    <span className="font-bold text-slate-700">{groupName}</span>
                                    <span className="text-xs text-slate-400">({groupEmployees.length})</span>
                                </button>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${groupDone >= groupEmployees.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'}`}>
                                    {groupDone}/{groupEmployees.length} {t('evaluated', { defaultValue: 'evaluated' })}
                                </span>
                                {groupEmployees.some(e => !finalizedMap[e.id]) && (
                                    <button
                                        onClick={() => finalizeGroup(groupName, groupEmployees)}
                                        disabled={!canFinalizeMonth || finalizing !== null}
                                        title={!canFinalizeMonth ? t('presence_data_is_not_final_until_day_25', { defaultValue: 'Presence data is not final until day 25 of the month' }) : t('finalize_every_employee_in_group', { defaultValue: 'Finalize every employee in {{groupName}}', groupName })}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        {finalizing === groupName ? t('finalizing', { defaultValue: 'Finalizing…' }) : t('finalize_group', { defaultValue: 'Finalize Group' })}
                                    </button>
                                )}
                            </div>

                            {!isCollapsed && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-start">
                                        <thead className="bg-white text-slate-400 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('employee', { defaultValue: 'Employee' })}</th>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('direct_manager_40', { defaultValue: 'Direct Manager /40' })}</th>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('skip_level_manager_40', { defaultValue: 'Skip-Level Manager /40' })}</th>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('presence_20', { defaultValue: 'Presence /20' })}</th>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('exceptional_20', { defaultValue: 'Exceptional ±20' })}</th>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('training_10', { defaultValue: 'Training +10' })}</th>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('final_score', { defaultValue: 'Final Score' })}</th>
                                                <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-end">{t('details', { defaultValue: 'Details' })}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {groupEmployees.map(emp => {
                                                const b = breakdownFor(emp);
                                                const hrDone = !!hrMap[emp.id];
                                                const persDone = !!persMap[emp.id];
                                                const aIsMetric = !!b.evaluatorA && METRIC_LEVELS.includes(b.evaluatorA.level);
                                                const bIsMetric = !!b.evaluatorB && METRIC_LEVELS.includes(b.evaluatorB.level);
                                                const col1 = aIsMetric ? managerColumnValue(b.metricA, b.metricB) : null;
                                                const col2 = bIsMetric ? managerColumnValue(b.metricB, b.metricA) : null;
                                                const finalized = finalizedMap[emp.id];
                                                return (
                                                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="font-bold text-slate-700 text-sm">{emp.fullName}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{emp.staffId || emp.id.slice(0, 8)}</p>
                                                            {finalized && (
                                                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-900 text-white" title={t('finalized_on_date', { defaultValue: 'Finalized {{date}}{{auto}}', date: new Date(finalized.finalizedAt).toLocaleDateString(), auto: finalized.isAuto ? ' (auto)' : '' })}>
                                                                    <Lock className="w-2.5 h-2.5" /> {t('finalized', { defaultValue: 'Finalized' })}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {!b.evaluatorA ? (
                                                                <span className="text-slate-300 text-xs">—</span>
                                                            ) : !aIsMetric ? (
                                                                <span className="text-slate-300 text-xs italic" title={t('score_only_evaluator_see_details', { defaultValue: 'Score-only evaluator — see Details' })}>—</span>
                                                            ) : (
                                                                <ScoreBadge label={b.evaluatorA.label} value={col1 != null ? `${col1.toFixed(1)}/40` : t('not_evaluated', { defaultValue: 'Not Evaluated' })} done={col1 != null} />
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {!b.evaluatorB ? (
                                                                <span className="text-slate-300 text-xs">—</span>
                                                            ) : !bIsMetric ? (
                                                                <span className="text-slate-300 text-xs italic" title={t('score_only_evaluator_see_details', { defaultValue: 'Score-only evaluator — see Details' })}>—</span>
                                                            ) : (
                                                                <ScoreBadge label={b.evaluatorB.label} value={col2 != null ? `${col2.toFixed(1)}/40` : t('not_evaluated', { defaultValue: 'Not Evaluated' })} done={col2 != null} />
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <ScoreBadge value={hrDone ? `${b.hrScore.toFixed(1)}/20` : t('not_evaluated', { defaultValue: 'Not Evaluated' })} done={hrDone} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <ScoreBadge value={persDone ? `${b.exceptionalScore >= 0 ? '+' : ''}${b.exceptionalScore.toFixed(1)}%` : t('not_evaluated', { defaultValue: 'Not Evaluated' })} done={persDone} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <ScoreBadge value={persDone ? `+${b.trainingScore.toFixed(1)}%` : t('not_evaluated', { defaultValue: 'Not Evaluated' })} done={persDone} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-slate-700 bg-slate-100/50 inline-block px-2 py-1 rounded-lg">{b.finalScore.toFixed(1)}%</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-end">
                                                            <div className="flex justify-end gap-2">
                                                                {!finalized && (
                                                                    <button
                                                                        onClick={() => finalizeOne(emp.id)}
                                                                        disabled={!canFinalizeMonth || finalizing !== null}
                                                                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        title={!canFinalizeMonth ? t('presence_data_is_not_final_until_day_25', { defaultValue: 'Presence data is not final until day 25 of the month' }) : t('finalize_this_employee_s_evaluation', { defaultValue: "Finalize this employee's evaluation" })}
                                                                    >
                                                                        <ShieldCheck className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setPersonnelEmp(emp)}
                                                                    disabled={!!finalized && currentUser?.role !== 'SUPER_ADMIN'}
                                                                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    title={finalized && currentUser?.role !== 'SUPER_ADMIN' ? t('finalized_no_longer_editable', { defaultValue: 'Finalized — no longer editable' }) : t('edit_exceptional_training', { defaultValue: 'Edit Exceptional / Training' })}
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDetailEmp(emp)}
                                                                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
                                                                    title={t('details', { defaultValue: 'Details' })}
                                                                >
                                                                    <FileSearch className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal
                isOpen={!!detailEmp}
                onClose={() => setDetailEmp(null)}
                title={detailEmp ? `${detailEmp.fullName} — ${month}` : ''}
                fullScreen
                fullScreenWidth="max-w-4xl"
            >
                {detailEmp && <EvaluationBreakdownView employee={detailEmp} breakdown={breakdownFor(detailEmp)} />}
            </Modal>

            <PersonnelEvaluationModal
                employee={personnelEmp}
                month={month}
                isOpen={!!personnelEmp}
                onClose={() => setPersonnelEmp(null)}
                onSaved={fetchAll}
            />
        </div>
    );
};

export default EvaluationOverview;
