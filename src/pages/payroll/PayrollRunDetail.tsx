// One payroll run: what it totals per currency, and every employee line in it.
//
// The rule this screen exists to enforce: BLOCKED lines sort to the top and the run cannot be
// submitted while any remain. A line with no resolvable hourly rate is worth zero, and a zero that
// looks like a real salary is the single most dangerous thing this module could produce.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ArrowLeft, RefreshCw, Loader2, AlertTriangle, Ban, Search, CalendarRange, Info, ChevronRight,
    ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import { payrollRunService } from '../../services/payrollRunService';
import type { PayrollLine, PayrollLineStatus, PayrollRunStatus } from '../../services/payrollRunService';
import { canAccess } from '../../utils/access';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../../components/Pagination';
import PayrollPeriodClose, { ExportButtons } from '../../components/payroll/PayrollPeriodClose';
import ProviderPayrollReports from '../../components/payroll/ProviderPayrollReports';
import { BLOCK_LABELS, RESIDENCY_LABELS } from '../../utils/payrollLabels';

const STATUS_STYLES: Record<PayrollRunStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    IN_REVIEW: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    PAID: 'bg-blue-50 text-blue-700',
    CANCELLED: 'bg-rose-50 text-rose-600',
};

const RUN_STATUS_LABELS: Record<PayrollRunStatus, string> = {
    DRAFT: 'Draft',
    IN_REVIEW: 'In review',
    APPROVED: 'Approved',
    PAID: 'Paid',
    CANCELLED: 'Cancelled',
};

const WARNING_LABELS: Record<string, string> = {
    UNMATCHED_ATTENDANCE_ROWS: '{{n}} attendance row(s) did not match any payable employee',
};

const fmtMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const PayrollRunDetail: React.FC = () => {
    const { t } = useTranslation();
    const { runId = '' } = useParams();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_payroll']);

    const [computing, setComputing] = useState(false);
    const [exportBusy, setExportBusy] = useState<null | 'excel' | 'form' | 'upload' | 'close' | 'payslips'>(null);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<PayrollLineStatus | ''>('');
    const [search, setSearch] = useState('');

    const { data: run, isLoading } = useQuery({
        queryKey: ['payroll', 'run', runId],
        queryFn: () => payrollRunService.get(runId),
        enabled: !!runId,
    });

    const { data: linePage, isFetching: linesLoading } = useQuery({
        queryKey: ['payroll', 'run', runId, 'lines', { page, status, search }],
        queryFn: () => payrollRunService.lines(runId, { page, limit: 25, status, search }),
        enabled: !!runId,
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['payroll'] });

    const handleCompute = async () => {
        if (computing) return;
        setComputing(true);
        try {
            const result = await payrollRunService.compute(runId);
            toast.success(
                t('payroll_computed', {
                    defaultValue: 'Computed {{lines}} lines ({{blocked}} blocked)',
                    lines: result.lineCount, blocked: result.blockedCount,
                }),
            );
            result.warnings.forEach(w => toast.warning(
                w.code === 'RAW'
                    ? w.detail
                    : t(`payroll_warn_${w.code}`, { defaultValue: WARNING_LABELS[w.code] || w.code, count: w.count ?? 0, n: w.count ?? 0 }),
            ));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payroll_compute_failed', { defaultValue: 'Could not compute the payroll run.' }));
        } finally {
            setComputing(false);
        }
    };

    if (isLoading) return <div className="p-8 text-slate-400 font-medium">{t('loading', 'Loading...')}</div>;
    if (!run) return <div className="p-8 text-slate-400 font-medium">{t('payroll_run_not_found', { defaultValue: 'Payroll run not found.' })}</div>;

    const totals = (run.totals || []).filter(x => x.residencyType === 'ALL');
    const byResidency = (run.totals || []).filter(x => x.residencyType !== 'ALL');
    const blocked = run.blockedCount ?? 0;
    const editable = run.status === 'DRAFT' && !run.lockedAt && !run.approvedAt;

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <Link to="/payroll" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#511d29]">
                <ArrowLeft size={16} /> {t('payroll', { defaultValue: 'Payroll' })}
            </Link>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b-2 border-[#511d29]/10 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-outfit font-black text-[#511d29]">{run.period}</h1>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[run.status]}`}>
                            {t(`payroll_status_${run.status}`, { defaultValue: RUN_STATUS_LABELS[run.status] })}
                        </span>
                        {run.revision > 1 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">rev {run.revision}</span>}
                    </div>
                    <p className="text-sm text-slate-400 font-medium mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{run.runNumber}</span>
                        {/* dir="ltr" or RTL reordering flips the range so it reads end -> start. */}
                        <span className="flex items-center gap-1.5">
                            <CalendarRange size={13} />
                            <span dir="ltr">{fmtDate(run.periodStart)} → {fmtDate(run.periodEnd)}</span>
                        </span>
                        <span>{run._count?.lines ?? 0} {t('payroll_lines', { defaultValue: 'lines' })}</span>
                    </p>
                </div>
                <div className="shrink-0 flex flex-wrap items-center gap-2">
                    {/* Available to anyone who can view the run: the review sheet and the approval
                        memo are what Internal Audit and Finance are handed, and neither of them
                        manages payroll. */}
                    <ExportButtons run={run} busy={exportBusy} setBusy={setExportBusy} tone="neutral" />
                    {canManage && editable && (
                        <button
                            onClick={handleCompute}
                            disabled={computing}
                            className="flex items-center gap-2 bg-[#511d29] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#3f1620] disabled:opacity-40"
                        >
                            {computing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            {run.attendanceFetchedAt
                                ? t('payroll_recompute', { defaultValue: 'Recompute' })
                                : t('payroll_compute', { defaultValue: 'Compute' })}
                        </button>
                    )}
                </div>
            </div>

            {/* Recompute is a full rebuild; saying so removes the fear of pressing it twice. */}
            {canManage && editable && run.attendanceFetchedAt && (
                <p className="text-xs text-slate-400 font-medium flex items-start gap-2">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {t('payroll_recompute_hint', { defaultValue: 'Recomputing rebuilds every line from scratch. Exclusions and review notes are kept.' })}
                </p>
            )}

            {/* A correction is stored on the run's override, outside the compute rebuild — which is
                what lets it survive a recompute, but also means it sits in no amount until one
                happens. Without saying so, a specialist sees their correction vanish. */}
            {(run.pendingCorrections ?? 0) > 0 && (
                <div className="border border-blue-200 bg-blue-50 rounded-2xl px-5 py-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-black text-blue-900">
                                {t('payroll_pending_corrections', {
                                    defaultValue: '{{n}} correction(s) saved but not yet in the figures',
                                    n: run.pendingCorrections,
                                })}
                            </p>
                            <p className="text-xs text-blue-900/70 font-medium mt-0.5">
                                {t('payroll_pending_corrections_desc', {
                                    defaultValue: 'Amounts only change when the period is recomputed. Recompute now to apply them.',
                                })}
                            </p>
                        </div>
                    </div>
                    {canManage && editable && (
                        <button
                            onClick={handleCompute}
                            disabled={computing}
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 shrink-0"
                        >
                            {computing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                            {t('payroll_recompute', { defaultValue: 'Recompute' })}
                        </button>
                    )}
                </div>
            )}

            {blocked > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-black text-amber-800">
                            {t('payroll_blocked_banner', { defaultValue: '{{n}} line(s) cannot be paid', n: blocked })}
                        </p>
                        <p className="text-xs text-amber-800/70 font-medium mt-0.5">
                            {t('payroll_blocked_banner_desc', { defaultValue: 'Their amounts are all zero because an input is missing. Fix the data or exclude them explicitly — if the period is closed as it stands, they are paid nothing.' })}
                        </p>
                    </div>
                </div>
            )}

            {/* One card per currency. There is deliberately no combined total: no exchange rate
                exists in this system, so a merged figure would be unreconcilable. */}
            {totals.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {totals.map(tot => {
                        const blocks = byResidency.filter(r => r.currency === tot.currency);
                        return (
                            <div key={tot.id} className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tot.currency}</span>
                                    <span className="text-xs font-bold text-slate-400">{tot.employeeCount} {t('payroll_employees', { defaultValue: 'employees' })}</span>
                                </div>
                                <div className="text-2xl font-black text-slate-800 mt-1">{fmtMoney(tot.netTotal)}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('payroll_net_total', { defaultValue: 'Net total' })}</div>
                                <dl className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
                                    <Row label={t('payroll_basic_total', { defaultValue: 'Basic' })} value={fmtMoney(tot.basicTotal)} />
                                    <Row label={t('payroll_allowance_total', { defaultValue: 'Allowances' })} value={fmtMoney(tot.allowanceTotal)} />
                                    <Row label={t('payroll_paid_leave_total', { defaultValue: 'Paid leave' })} value={fmtMoney(tot.paidLeaveTotal)} />
                                    <Row label={t('payroll_bonus_total', { defaultValue: 'Bonuses' })} value={fmtMoney(tot.bonusTotal)} />
                                    <Row label={t('payroll_deduction_total', { defaultValue: 'Deductions' })} value={`- ${fmtMoney(tot.deductionTotal)}`} />
                                    {tot.serviceProviderFeeTotal > 0 && (
                                        <Row
                                            label={t('payroll_sp_fee_total', { defaultValue: 'Provider fees (company cost)' })}
                                            value={fmtMoney(tot.serviceProviderFeeTotal)}
                                            muted
                                        />
                                    )}
                                </dl>
                                {blocks.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                                        {blocks.map(b => (
                                            <div key={b.id} className="flex justify-between text-[11px]">
                                                <span className="text-slate-400 font-semibold">{t(`residency_${b.residencyType}`, { defaultValue: RESIDENCY_LABELS[b.residencyType] || b.residencyType })}</span>
                                                <span className="text-slate-600 font-bold">{fmtMoney(b.netTotal)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {run.attendanceWarnings && run.attendanceWarnings.length > 0 && (
                <div className="border border-slate-200 bg-slate-50 rounded-2xl px-5 py-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                        {t('payroll_attendance_notes', { defaultValue: 'Attendance notes' })}
                    </p>
                    <ul className="space-y-1">
                        {run.attendanceWarnings.map((w, i) => (
                            <li key={i} className="text-xs text-slate-500 font-medium">
                                · {w.code === 'RAW'
                                    ? w.detail
                                    : t(`payroll_warn_${w.code}`, {
                                        defaultValue: WARNING_LABELS[w.code] || w.code,
                                        count: w.count ?? 0,
                                        n: w.count ?? 0,
                                    })}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="bg-white border border-[#511d29]/10 rounded-2xl overflow-hidden">
                <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
                    <div className="flex gap-1.5">
                        {([
                            ['', 'payroll_filter_all', 'All'],
                            ['BLOCKED', 'payroll_filter_blocked', 'Blocked'],
                            ['OK', 'payroll_filter_payable', 'Payable'],
                            ['EXCLUDED', 'payroll_filter_excluded', 'Excluded'],
                        ] as const).map(([value, key, label]) => (
                            <button
                                key={value}
                                onClick={() => { setStatus(value as PayrollLineStatus | ''); setPage(1); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${status === value ? 'bg-[#511d29] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {t(key, { defaultValue: label })}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder={t('payroll_search_lines', { defaultValue: 'Search by name or staff ID…' })}
                            className="w-full ps-9 pe-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
                        />
                    </div>
                </div>

                {/* The single most-missed thing on this screen: corrections and exclusions are not
                    here, they are on each employee's own payslip page. */}
                <p className="px-4 pb-3 -mt-1 text-xs text-slate-400 font-medium flex items-start gap-2 border-b border-slate-100">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {t('payroll_open_line_hint', {
                        defaultValue: "Click an employee's name to open their payslip — that is where a previous-miscalculation correction is added and where someone is excluded from the run.",
                    })}
                </p>

                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <Th>{t('employee', { defaultValue: 'Employee' })}</Th>
                            <Th>{t('payroll_hours', { defaultValue: 'Hours' })}</Th>
                            <Th>{t('payroll_rate', { defaultValue: 'Rate' })}</Th>
                            <Th>{t('payroll_basic', { defaultValue: 'Basic' })}</Th>
                            <Th>{t('payroll_factors', { defaultValue: 'Factors' })}</Th>
                            <Th>{t('payroll_earnings', { defaultValue: 'Earnings' })}</Th>
                            <Th>{t('payroll_net', { defaultValue: 'Net' })}</Th>
                            <Th>{t('status', { defaultValue: 'Status' })}</Th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {linesLoading && (
                            <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400 text-sm">{t('loading', 'Loading...')}</td></tr>
                        )}
                        {!linesLoading && (linePage?.lines.length ?? 0) === 0 && (
                            <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400 text-sm">
                                {run.attendanceFetchedAt
                                    ? t('payroll_no_lines_match', { defaultValue: 'No lines match this filter.' })
                                    : t('payroll_not_computed_yet', { defaultValue: 'This run has not been computed yet.' })}
                            </td></tr>
                        )}
                        {!linesLoading && linePage?.lines.map(line => <LineRow key={line.id} line={line} runId={runId} />)}
                    </tbody>
                </table>

                {(linePage?.pages ?? 1) > 1 && (
                    <Pagination
                        page={page}
                        totalPages={linePage!.pages}
                        onPageChange={setPage}
                        totalItems={linePage!.total}
                        pageSize={linePage!.limit}
                        itemLabel={t('payroll_lines', { defaultValue: 'lines' })}
                    />
                )}
            </div>

            {/* Above the close card: these are sent out during review, before anything is frozen. */}
            <ProviderPayrollReports run={run} />

            <PayrollPeriodClose run={run} blockedCount={blocked} canManage={canManage} />
        </div>
    );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <th className="px-5 py-3 text-start text-[10px] font-black text-slate-400 uppercase tracking-widest">{children}</th>
);

// The composed factor, plus which factors actually produced it. Showing only F would leave the most
// common payroll question — "why is this person's allowance that much?" — unanswerable from the
// list. Position and skill are mutually exclusive by design, so at most three chips ever appear.
const FactorCell: React.FC<{ line: PayrollLine }> = ({ line }) => {
    const { t } = useTranslation();
    const parts = [
        { key: 'payroll_factor_position', fallback: 'Position', value: line.positionFactor },
        { key: 'payroll_factor_skill', fallback: 'Skill', value: line.skillFactor },
        { key: 'payroll_factor_site', fallback: 'Site', value: line.siteFactor },
        { key: 'payroll_factor_language', fallback: 'Language', value: line.languageFactor },
    ].filter(p => (p.value ?? 1) > 1);

    if (parts.length === 0) {
        return <span className="text-xs font-bold text-slate-300" title={t('payroll_factor_none', { defaultValue: 'No factors — paid at the base rate' }) as string}>×1.00</span>;
    }

    return (
        <div className="leading-tight">
            <span className="text-sm font-black text-slate-700">×{line.factorF.toFixed(2)}</span>
            <div className="flex flex-wrap gap-1 mt-1">
                {parts.map(p => (
                    <span key={p.key} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        {t(p.key, { defaultValue: p.fallback })} {p.value.toFixed(2)}
                    </span>
                ))}
            </div>
        </div>
    );
};

const Row: React.FC<{ label: string; value: string; muted?: boolean }> = ({ label, value, muted }) => (
    <div className="flex justify-between">
        <dt className={muted ? 'text-slate-300 font-semibold' : 'text-slate-400 font-semibold'}>{label}</dt>
        <dd className={muted ? 'text-slate-400 font-bold' : 'text-slate-700 font-bold'}>{value}</dd>
    </div>
);

// A "previous miscalculation" already recorded on this payslip. Added and removed on the line's
// own page; shown here so it is visible without opening it.
const CorrectionChips: React.FC<{ line: PayrollLine }> = ({ line }) => {
    const { t } = useTranslation();
    const corrections = (line.items || []).filter(
        i => i.category === 'PREVIOUS_UNDERPAYMENT' || i.category === 'PREVIOUS_OVERPAYMENT',
    );
    if (corrections.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {corrections.map(i => {
                const up = i.kind === 'EARNING';
                return (
                    <span
                        key={i.id}
                        title={i.correctionNote || undefined}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                    >
                        {up ? <ArrowUpCircle size={9} /> : <ArrowDownCircle size={9} />}
                        {t('payroll_correction_chip', { defaultValue: 'correction' })} {up ? '+' : '−'}{fmtMoney(i.amount)}
                    </span>
                );
            })}
        </div>
    );
};

const LineRow: React.FC<{ line: PayrollLine; runId: string }> = ({ line, runId }) => {
    const { t } = useTranslation();
    return (
    <tr className={line.status === 'BLOCKED' ? 'bg-amber-50/40' : line.status === 'EXCLUDED' ? 'bg-slate-50/70 opacity-60' : ''}>
        <td className="px-5 py-3">
            {/* Linked by EMPLOYEE id, not line id: a recompute deletes and re-creates every line,
                so a line-id URL dies as soon as someone presses Recompute. */}
            <Link
                to={`/payroll/runs/${runId}/lines/${line.employeeId || line.id}`}
                className="group inline-flex items-center gap-1 text-sm font-bold text-slate-800 hover:text-[#511d29] hover:underline"
            >
                {line.fullName || '—'}
                <ChevronRight size={13} className="text-slate-300 group-hover:text-[#511d29] rtl:rotate-180" />
            </Link>
            <div className="text-[11px] text-slate-400 font-medium">{line.staffId || '—'} · {line.departmentName || '—'}</div>
        </td>
        <td className="px-5 py-3 text-sm text-slate-600 font-medium whitespace-nowrap">
            {line.basicHours}{line.overtimeHours > 0 && <span className="text-emerald-600"> +{line.overtimeHours}</span>}
        </td>
        <td className="px-5 py-3 text-sm text-slate-600 font-medium whitespace-nowrap">
            {line.hourlyRate ? `${line.hourlyRate} ${line.currency}` : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-5 py-3 text-sm text-slate-600 font-medium">{fmtMoney(line.basicSalary)}</td>
        <td className="px-5 py-3 whitespace-nowrap"><FactorCell line={line} /></td>
        <td className="px-5 py-3 text-sm text-slate-600 font-medium">{fmtMoney(line.totalEarnings)}</td>
        <td className="px-5 py-3 whitespace-nowrap">
            <div className="text-sm font-black text-slate-800">
                {fmtMoney(line.netSalary)} <span className="text-[10px] text-slate-400">{line.currency}</span>
            </div>
            {/* Manual corrections are invisible in a net figure, and a specialist checking whether
                last month's fix was actually applied should not have to open every payslip. */}
            <CorrectionChips line={line} />
        </td>
        <td className="px-5 py-3">
            {line.status === 'OK' && <span className="px-2 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600">{t('payroll_filter_payable', { defaultValue: 'Payable' })}</span>}
            {line.status === 'EXCLUDED' && (
                <span className="px-2 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 inline-flex items-center gap-1">
                    <Ban size={10} /> {t('payroll_filter_excluded', { defaultValue: 'Excluded' })}
                </span>
            )}
            {line.status === 'BLOCKED' && (
                <div className="flex flex-wrap gap-1">
                    {line.blockReasons.map(r => (
                        <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            {t(`payroll_block_${r}`, { defaultValue: BLOCK_LABELS[r] || r })}
                        </span>
                    ))}
                </div>
            )}
        </td>
    </tr>
    );
};

export default PayrollRunDetail;
