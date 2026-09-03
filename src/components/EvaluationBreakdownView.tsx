import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Employee } from '../types';
import {
    ADMIN_CRITERIA, CARE_CRITERIA, EXEC_CRITERIA, METRIC_LEVELS, type EvaluationBreakdown,
} from '../utils/evaluationScoring';

interface Props {
    employee: Employee;
    breakdown: EvaluationBreakdown;
}

const Card: React.FC<{ title: string; weight?: string; children: React.ReactNode }> = ({ title, weight, children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title}</h3>
            {weight && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{weight}</span>}
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const CriteriaTable: React.FC<{
    criteria: { key: string; labelKey: string; weight: number }[];
    metricA: any | null;
    metricB: any | null;
    labelA: string;
    labelB: string;
}> = ({ criteria, metricA, metricB, labelA, labelB }) => {
    const { t } = useTranslation();
    return (
        <table className="w-full text-start">
            <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-100">
                    <th className="py-2 pe-2 text-start">{t('criterion', { defaultValue: 'Criterion' })}</th>
                    <th className="py-2 px-2 text-center">{labelA}</th>
                    <th className="py-2 px-2 text-center">{labelB}</th>
                    <th className="py-2 ps-2 text-end">{t('average', { defaultValue: 'Average' })}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {criteria.map(c => {
                    const aVal = metricA ? Number(metricA[c.key] || 0) : null;
                    const bVal = metricB ? Number(metricB[c.key] || 0) : null;
                    const avg = aVal != null && bVal != null ? (aVal + bVal) / 2 : (aVal ?? bVal ?? 0);
                    return (
                        <tr key={c.key}>
                            <td className="py-2 pe-2 text-sm text-slate-600">{t(c.labelKey)} <span className="text-[10px] text-slate-400">/{c.weight}</span></td>
                            <td className="py-2 px-2 text-center text-sm font-bold text-slate-700">{aVal != null ? aVal.toFixed(1) : '—'}</td>
                            <td className="py-2 px-2 text-center text-sm font-bold text-slate-700">{bVal != null ? bVal.toFixed(1) : '—'}</td>
                            <td className="py-2 ps-2 text-end text-sm font-black text-indigo-600">{avg.toFixed(1)}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

const ScoreBadge: React.FC<{ label: string; value: number; suffix?: string; positiveOnly?: boolean }> = ({ label, value, suffix = '%', positiveOnly }) => {
    const negative = !positiveOnly && value < 0;
    return (
        <div className={`flex items-center justify-between p-3 rounded-xl ${negative ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <span className="text-sm text-slate-600">{label}</span>
            <span className={`font-black ${negative ? 'text-red-600' : 'text-emerald-600'}`}>{value >= 0 ? '+' : ''}{value.toFixed(1)}{suffix}</span>
        </div>
    );
};

const EvaluationBreakdownView: React.FC<Props> = ({ employee, breakdown }) => {
    const { t } = useTranslation();
    const b = breakdown;

    // A metric level "applies" if it's one of the employee's two required
    // levels, whether or not that evaluator has actually submitted anything
    // yet — so the Admin/Exec/Care cards still show (as "Not evaluated yet")
    // instead of silently disappearing until someone fills them in.
    const anyMetricLevelApplies = b.requiredLevels.some(l => METRIC_LEVELS.includes(l));
    const scoreOnlyEvaluators = [b.evaluatorA, b.evaluatorB].filter(
        (e): e is NonNullable<typeof e> => !!e && !METRIC_LEVELS.includes(e.level)
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-lg">
                        {(employee.fullName || 'U').charAt(0)}
                    </div>
                    <div>
                        <p className="font-black text-lg text-slate-800">{employee.fullName}</p>
                        <p className="text-xs text-slate-500">{employee.staffId ? `ID: ${employee.staffId} · ` : ''}{b.month}</p>
                    </div>
                </div>
                <div className="text-center bg-indigo-600 text-white rounded-2xl px-8 py-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{t('total_100')}</p>
                    <p className="text-3xl font-black">{b.finalScore.toFixed(1)}%</p>
                </div>
            </div>

            {/* Presence */}
            <Card title={t('presence_20', { defaultValue: 'Presence' })} weight="20%">
                {b.hrEval ? (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {[
                            { label: t('absence_score', { defaultValue: 'Absence' }), val: (b.hrEval as any).absenceWithoutPermission, unit: 'd' },
                            { label: t('delay_score', { defaultValue: 'Delay' }), val: (b.hrEval as any).delayAndEarlyDeparture, unit: 'm' },
                            { label: t('emergency_score', { defaultValue: 'Emergency' }), val: (b.hrEval as any).emergencyLeaves, unit: 'd' },
                            { label: t('unpaid_score', { defaultValue: 'Unpaid' }), val: (b.hrEval as any).unpaidLeave, unit: 'd' },
                            { label: t('annual_paid_leave', { defaultValue: 'Annual Paid' }), val: (b.hrEval as any).annualPaidLeave, unit: 'd' },
                        ].map((f, i) => (
                            <div key={i} className="text-center bg-slate-50 rounded-xl p-3">
                                <p className="text-[10px] uppercase text-slate-400 font-bold">{f.label}</p>
                                <p className="text-lg font-black text-slate-700">{f.val ?? 0}{f.unit}</p>
                            </div>
                        ))}
                        <div className="col-span-2 sm:col-span-5 flex items-center justify-between bg-indigo-50 rounded-xl p-3 mt-2">
                            <span className="text-sm font-bold text-slate-600">{t('total', { defaultValue: 'Score' })}</span>
                            <span className="font-black text-indigo-600">{b.hrScore.toFixed(1)} / 20</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">{t('not_evaluated_yet', { defaultValue: 'Not evaluated yet' })}</p>
                )}
            </Card>

            {/* Admin / Executive / Care */}
            {anyMetricLevelApplies ? (
                <>
                    <Card title={t('administrative_behavior')} weight="25%">
                        {b.metricA || b.metricB ? (
                            <>
                                <CriteriaTable criteria={ADMIN_CRITERIA} metricA={b.metricA} metricB={b.metricB} labelA={b.evaluatorA?.label || '—'} labelB={b.evaluatorB?.label || '—'} />
                                <div className="flex justify-end mt-3"><span className="font-black text-indigo-600">{b.adminScore.toFixed(1)} / 25</span></div>
                            </>
                        ) : <p className="text-sm text-slate-400 italic">{t('not_evaluated_yet')}</p>}
                    </Card>
                    <Card title={t('executive_performance')} weight="40%">
                        {b.metricA || b.metricB ? (
                            <>
                                <CriteriaTable criteria={EXEC_CRITERIA} metricA={b.metricA} metricB={b.metricB} labelA={b.evaluatorA?.label || '—'} labelB={b.evaluatorB?.label || '—'} />
                                <div className="flex justify-end mt-3"><span className="font-black text-indigo-600">{b.executiveScore.toFixed(1)} / 40</span></div>
                            </>
                        ) : <p className="text-sm text-slate-400 italic">{t('not_evaluated_yet')}</p>}
                    </Card>
                    <Card title={t('care_and_discipline')} weight="15%">
                        {b.metricA || b.metricB ? (
                            <>
                                <CriteriaTable criteria={CARE_CRITERIA} metricA={b.metricA} metricB={b.metricB} labelA={b.evaluatorA?.label || '—'} labelB={b.evaluatorB?.label || '—'} />
                                <div className="flex justify-end mt-3"><span className="font-black text-indigo-600">{b.careScore.toFixed(1)} / 15</span></div>
                            </>
                        ) : <p className="text-sm text-slate-400 italic">{t('not_evaluated_yet')}</p>}
                    </Card>
                    {(b.metricA?.comments || b.metricB?.comments) && (
                        <Card title={t('observer_comments')}>
                            <div className="space-y-3">
                                {b.metricA?.comments && <p className="text-sm text-slate-600"><span className="font-bold">{b.evaluatorA?.label}:</span> {b.metricA.comments}</p>}
                                {b.metricB?.comments && <p className="text-sm text-slate-600"><span className="font-bold">{b.evaluatorB?.label}:</span> {b.metricB.comments}</p>}
                            </div>
                        </Card>
                    )}
                </>
            ) : b.requiredLevels.length === 0 ? (
                <div className="text-center text-sm text-slate-400 italic py-4">{t('top_of_hierarchy')}</div>
            ) : null}

            {/* Score-only evaluators (GM / Chairman) */}
            {scoreOnlyEvaluators.map(ev => (
                <Card key={ev.level} title={`${ev.label} — ${t('overall_performance')}`}>
                    {ev.record ? (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-600 max-w-xl">{ev.record.comments || '—'}</p>
                            <span className="font-black text-2xl text-indigo-600">{Number(ev.record.finalScore || 0).toFixed(1)}</span>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic">{t('not_evaluated_yet', { defaultValue: 'Not evaluated yet' })}</p>
                    )}
                </Card>
            ))}

            {/* Exceptional Performance */}
            <Card title={t('exceptional')} weight="±20%">
                {b.persEval ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ScoreBadge label={t('appreciation_msg')} value={5 * Math.min(1, ((b.persEval as any).appreciationMessages || 0) / 3)} />
                        <ScoreBadge label={t('exceptional_days')} value={5 * Math.min(1, ((b.persEval as any).exceptionalAssignments || 0) / 30)} />
                        <ScoreBadge label={t('warning_messages')} value={-5 * Math.min(1, ((b.persEval as any).warningMessages || 0) / 3)} />
                        <ScoreBadge label={t('disciplinary_days')} value={-5 * Math.min(1, ((b.persEval as any).disciplinaryDeduction || 0) / 14)} />
                        <div className="col-span-1 sm:col-span-2 flex items-center justify-between bg-indigo-50 rounded-xl p-3 mt-1">
                            <span className="text-sm font-bold text-slate-600">{t('total', { defaultValue: 'Total' })}</span>
                            <span className="font-black text-indigo-600">{b.exceptionalScore >= 0 ? '+' : ''}{b.exceptionalScore.toFixed(1)}%</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">{t('not_evaluated_yet', { defaultValue: 'Not evaluated yet' })}</p>
                )}
            </Card>

            {/* Training */}
            <Card title={t('training')} weight="+10%">
                {b.persEval ? (
                    <div className="space-y-2">
                        {[
                            { label: t('specialized_training'), done: (b.persEval as any).specializedTraining, pts: 3 },
                            { label: t('supporting_training'), done: (b.persEval as any).supportingTraining, pts: 3 },
                            { label: t('language_courses'), done: (b.persEval as any).languageTraining, pts: 2 },
                            { label: t('software_electronic'), done: (b.persEval as any).softwareTraining, pts: 2 },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5">
                                <span className="flex items-center gap-2 text-sm text-slate-600">
                                    {item.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                                    {item.label}
                                </span>
                                <span className={`text-xs font-bold ${item.done ? 'text-emerald-600' : 'text-slate-300'}`}>{item.done ? `+${item.pts}%` : '—'}</span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between bg-indigo-50 rounded-xl p-3 mt-2">
                            <span className="text-sm font-bold text-slate-600">{t('total', { defaultValue: 'Total' })}</span>
                            <span className="font-black text-indigo-600">+{b.trainingScore.toFixed(1)}%</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">{t('not_evaluated_yet', { defaultValue: 'Not evaluated yet' })}</p>
                )}
            </Card>
        </div>
    );
};

export default EvaluationBreakdownView;
