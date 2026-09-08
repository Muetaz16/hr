// Payroll — the list of monthly runs, plus the pre-flight check that tells you whether a period is
// ready to be computed before you open it.
//
// The financial month runs from the 25th of one month to the 24th of the next and is labelled by
// the month it ENDS in, so "September 2026" covers 2026-08-25 to 2026-09-24.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wallet, Plus, AlertTriangle, CheckCircle2, Loader2, CalendarRange } from 'lucide-react';
import { payrollRunService } from '../services/payrollRunService';
import type { PayrollRun, PayrollRunStatus } from '../services/payrollRunService';
import { canAccess } from '../utils/access';
import { useAuth } from '../context/AuthContext';
import PayrollTabs from '../components/payroll/PayrollTabs';

const STATUS_STYLES: Record<PayrollRunStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    IN_REVIEW: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    PAID: 'bg-blue-50 text-blue-700',
    CANCELLED: 'bg-rose-50 text-rose-600',
};

// Pre-flight issue codes -> what the person reading them should actually do about it.
const ISSUE_HINTS: Record<string, { label: string; hint: string }> = {
    NO_STRUCTURE_LEVEL: {
        label: 'No salary structure set',
        hint: 'Set the salary structure on the employee record — without it there is no hourly rate.',
    },
    NO_JOB_CATEGORY: {
        label: 'No job category set',
        hint: 'Set it on the employee record — the hourly rate is looked up by category, grade and structure.',
    },
    NO_JOB_GRADE: {
        label: 'No job grade set',
        hint: 'Set it on the employee record — the hourly rate is looked up by category, grade and structure.',
    },
    NO_RATE_FOR_COMBINATION: {
        label: 'Rate card has no row for this combination',
        hint: 'Add the missing category / grade / structure row under Salary Structures.',
    },
    NO_RESIDENCY: {
        label: 'Residency (contract type) not set',
        hint: 'Needed to place the employee in the right block of the General Manager report.',
    },
    PROVIDER_RESIDENCY_MISMATCH: {
        label: 'Service provider set on a non-provider employee',
        hint: 'The provider report and the General Manager report would disagree about this person.',
    },
    FINAL_SETTLEMENT_PENDING: {
        label: 'Leaving during this period',
        hint: 'Included, but the final settlement is handled outside payroll — check before paying.',
    },
};

// The last 12 periods, newest first. Anything older is opened by typing the period directly.
const recentPeriods = (): string[] => {
    const now = new Date();
    // On or after the 25th we are already working on next month's payroll.
    const anchor = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 25 ? 1 : 0), 1);
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
};

const fmtMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const PayrollPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_payroll']);

    const periods = useMemo(recentPeriods, []);
    const [period, setPeriod] = useState(periods[0]);
    const [creating, setCreating] = useState(false);

    const { data: runs = [], isLoading } = useQuery({
        queryKey: ['payroll', 'runs'],
        queryFn: payrollRunService.list,
    });

    // Only run the pre-flight for people who could act on it, and only for the selected period.
    const { data: preflight, isFetching: preflightLoading } = useQuery({
        queryKey: ['payroll', 'preflight', period],
        queryFn: () => payrollRunService.preflight(period),
        enabled: canManage && !!period,
    });

    const handleCreate = async () => {
        if (creating) return;
        setCreating(true);
        try {
            const run = await payrollRunService.create(period);
            toast.success(t('payroll_run_created', { defaultValue: 'Payroll run created' }));
            queryClient.invalidateQueries({ queryKey: ['payroll'] });
            navigate(`/payroll/runs/${run.id}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payroll_run_create_failed', { defaultValue: 'Could not create the payroll run.' }));
        } finally {
            setCreating(false);
        }
    };

    const issueTotal = preflight?.issues.reduce((sum, i) => sum + i.employees.length, 0) ?? 0;

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* The tab strip is what makes this read as one screen out of several, rather than as
                the whole Payroll section. */}
            <PayrollTabs
                subtitle={t('payroll_subtitle_runs', {
                    defaultValue: 'The monthly payroll run. Each period covers the 25th of one month to the 24th of the next and is named after the month it ends in. Pick a period to check it is ready, open it, then compute it.',
                })}
            />

            {canManage && (
                <div className="bg-white border border-[#511d29]/10 rounded-2xl p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {t('payroll_period', { defaultValue: 'Payroll period' })}
                            </label>
                            <select
                                value={period}
                                onChange={e => setPeriod(e.target.value)}
                                className="w-full sm:w-64 px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-700"
                            >
                                {periods.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={handleCreate}
                            disabled={creating || !!preflight?.existingRun}
                            className="flex items-center justify-center gap-2 bg-[#511d29] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#3f1620] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {t('payroll_open_period', { defaultValue: 'Open this period' })}
                        </button>
                    </div>

                    {preflightLoading && (
                        <p className="text-sm text-slate-400 font-medium flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            {t('payroll_preflight_running', { defaultValue: 'Checking whether this period is ready…' })}
                        </p>
                    )}

                    {preflight && !preflightLoading && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                <span className="flex items-center gap-2 text-slate-600 font-medium">
                                    <CalendarRange size={15} className="text-slate-400" />
                                    {preflight.attendanceWindow.start} → {preflight.attendanceWindow.end}
                                </span>
                                <span className="text-slate-600 font-medium">
                                    {t('payroll_eligible_employees', { defaultValue: 'Employees in scope' })}:{' '}
                                    <b className="text-slate-800">{preflight.eligibleCount}</b>
                                </span>
                            </div>

                            {preflight.existingRun && (
                                <p className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                    {t('payroll_period_already_open', { defaultValue: 'This period is already open as' })}{' '}
                                    <Link to={`/payroll/runs/${preflight.existingRun.id}`} className="underline">
                                        {preflight.existingRun.runNumber}
                                    </Link>{' '}
                                    ({preflight.existingRun.status}).
                                </p>
                            )}

                            {issueTotal === 0 ? (
                                <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                                    <CheckCircle2 size={15} />
                                    {t('payroll_preflight_clean', { defaultValue: 'Every employee in scope can be paid.' })}
                                </p>
                            ) : (
                                <div className="border border-amber-100 bg-amber-50/60 rounded-xl p-4 space-y-2">
                                    <p className="text-sm font-black text-amber-800 flex items-center gap-2">
                                        <AlertTriangle size={15} />
                                        {t('payroll_preflight_issues', { defaultValue: 'Data to fix before this period can be submitted' })}
                                    </p>
                                    {/* These are not fatal — a run can still be computed. They are the work list. */}
                                    <ul className="space-y-1.5">
                                        {preflight.issues.map(issue => {
                                            const meta = ISSUE_HINTS[issue.code];
                                            return (
                                                <li key={issue.code} className="text-xs text-amber-900/90">
                                                    <b>{issue.employees.length}</b> — {meta?.label || issue.code}
                                                    {meta && <span className="block text-amber-800/60 ms-4">{meta.hint}</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isLoading ? (
                <p className="text-slate-400 font-medium">{t('loading', 'Loading...')}</p>
            ) : runs.length === 0 ? (
                <div className="bg-white border border-[#511d29]/10 rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#511d29]/5 text-[#511d29] flex items-center justify-center">
                        <Wallet className="w-7 h-7" />
                    </div>
                    <p className="text-base font-black text-slate-700">{t('payroll_no_runs', { defaultValue: 'No payroll runs yet' })}</p>
                    <p className="text-sm text-slate-400 font-medium max-w-md">
                        {t('payroll_no_runs_desc', { defaultValue: 'Pick a period above and open it to get started.' })}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {runs.map(run => <RunCard key={run.id} run={run} t={t} />)}
                </div>
            )}
        </div>
    );
};

const RunCard: React.FC<{ run: PayrollRun; t: (k: string, o?: any) => string }> = ({ run, t }) => {
    // One card per currency: totals are never combined across currencies, because there is no
    // exchange rate in this system and a merged figure could not be reconciled by Finance.
    const totals = (run.totals || []).filter(x => x.residencyType === 'ALL');
    return (
        <Link
            to={`/payroll/runs/${run.id}`}
            className="block bg-white border border-[#511d29]/10 rounded-2xl p-5 hover:border-[#511d29]/30 transition-colors"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-slate-800">{run.period}</h3>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[run.status]}`}>
                            {run.status.replace('_', ' ')}
                        </span>
                        {run.revision > 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                rev {run.revision}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                        {run.runNumber} · {fmtDate(run.periodStart)} → {fmtDate(run.periodEnd)}
                        {run._count ? ` · ${run._count.lines} ${t('payroll_lines', { defaultValue: 'lines' })}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap gap-4">
                    {totals.length === 0 ? (
                        <span className="text-xs text-slate-300 font-semibold">
                            {t('payroll_not_computed', { defaultValue: 'Not computed yet' })}
                        </span>
                    ) : totals.map(tot => (
                        <div key={tot.id} className="text-end">
                            <div className="text-sm font-black text-slate-800">{fmtMoney(tot.netTotal)} {tot.currency}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {tot.employeeCount} {t('payroll_employees', { defaultValue: 'employees' })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Link>
    );
};

export default PayrollPage;
