// One employee's pay for one period.
//
// This is the screen someone opens when an employee disputes their salary, so it has to show WHY,
// not just what. It is laid out in the same order as the printed payslip — inputs, then earnings,
// then deductions, then net — and every row shows its own rounded value, so the arithmetic on
// screen is visibly the same arithmetic that was printed.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, Ban, RotateCcw, AlertTriangle, Receipt, Loader2 } from 'lucide-react';
import { payrollRunService } from '../../services/payrollRunService';
import { canAccess } from '../../utils/access';
import { useAuth } from '../../context/AuthContext';
import PayrollCorrections from '../../components/payroll/PayrollCorrections';
import { payslipService } from '../../services/payslipService';

const BLOCK_LABELS: Record<string, string> = {
    NO_STRUCTURE_LEVEL: 'No salary structure set on the employee record',
    NO_RATE_FOR_COMBINATION: 'No rate exists for this job category / grade / structure',
    NO_ATTENDANCE: 'No attendance record matched this staff ID',
    NO_RESIDENCY: 'Residency (contract type) is not set',
    NEGATIVE_NET: 'Deductions exceed earnings',
    BONUS_CAP_EXCEEDED: 'Bonus percentages add up to more than 100%',
    GRADE_CHANGED_MID_PERIOD: 'Job grade changed during this period',
    FINAL_SETTLEMENT_PENDING: 'Employee is leaving during this period',
    JOINED_MID_PERIOD: 'Employee joined during this period',
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const PayrollLineDetail: React.FC = () => {
    const { t } = useTranslation();
    const { runId = '', lineId = '' } = useParams();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_payroll']);

    const [showRaw, setShowRaw] = useState(false);
    const [payslipBusy, setPayslipBusy] = useState(false);

    // Linked by employee id where possible: a recompute changes every line id, and the button
    // should not stop working because the period was recomputed while this page was open.
    const downloadPayslip = async () => {
        setPayslipBusy(true);
        try {
            const blob = await payslipService.forLine(runId, line!.employeeId || lineId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Payslip_${(line!.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_')}_${line!.run?.period ?? ''}.docx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('payslip_download_failed', { defaultValue: 'Could not produce the payslip.' }));
        } finally {
            setPayslipBusy(false);
        }
    };
    const [busy, setBusy] = useState(false);
    const [excludeReason, setExcludeReason] = useState('');

    const { data: line, isLoading } = useQuery({
        queryKey: ['payroll', 'run', runId, 'line', lineId],
        queryFn: () => payrollRunService.line(runId, lineId),
        enabled: !!runId && !!lineId,
    });

    const act = async (fn: () => Promise<unknown>) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            queryClient.invalidateQueries({ queryKey: ['payroll'] });
            toast.success(t('saved', { defaultValue: 'Saved' }));
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        } finally {
            setBusy(false);
        }
    };

    if (isLoading) return <div className="p-8 text-slate-400 font-medium">{t('loading', 'Loading...')}</div>;
    if (!line) return <div className="p-8 text-slate-400 font-medium">{t('payroll_line_not_found', { defaultValue: 'Payroll line not found.' })}</div>;

    const editable = line.run?.status === 'DRAFT' && !line.run?.lockedAt && !line.run?.approvedAt;
    const cur = line.currency;
    const earnings = (line.items || []).filter(i => i.kind === 'EARNING');
    const deductions = (line.items || []).filter(i => i.kind === 'DEDUCTION');

    return (
        <div className="max-w-[1100px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to={`/payroll/runs/${runId}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#511d29]">
                <ArrowLeft size={16} /> {line.run?.period || t('payroll', { defaultValue: 'Payroll' })}
            </Link>
                {/* A blocked line is refused by the server: its amounts are all zero, and a
                    payslip stating the employee earned nothing is worse than no payslip. */}
                <button
                    onClick={downloadPayslip}
                    disabled={payslipBusy || line.status !== 'OK'}
                    title={line.status !== 'OK'
                        ? (t('payslip_not_payable', { defaultValue: 'This line is not payable, so its payslip would print zeros.' }) as string)
                        : undefined}
                    className="inline-flex items-center gap-2 bg-[#511d29] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#3f1620] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {payslipBusy ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
                    {t('payslip_download', { defaultValue: 'Download the payslip' })}
                </button>
            </div>

            <div className="border-b-2 border-[#511d29]/10 pb-6">
                <h1 className="text-3xl font-outfit font-black text-[#511d29]">{line.fullName || '—'}</h1>
                <p className="text-sm text-slate-400 font-medium mt-1">
                    {line.staffId || '—'} · {line.positionTitle || '—'} · {line.departmentName || '—'}
                    {line.residencyType && ` · ${line.residencyType}`}
                </p>
            </div>

            {line.status === 'BLOCKED' && (
                <div className="border border-amber-200 bg-amber-50 rounded-2xl px-5 py-4">
                    <p className="text-sm font-black text-amber-800 flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} /> {t('payroll_line_blocked', { defaultValue: 'This line cannot be paid' })}
                    </p>
                    <ul className="space-y-1">
                        {line.blockReasons.map(r => (
                            <li key={r} className="text-xs text-amber-800/80 font-medium">· {BLOCK_LABELS[r] || r}</li>
                        ))}
                    </ul>
                </div>
            )}

            {line.status === 'EXCLUDED' && (
                <div className="border border-slate-200 bg-slate-50 rounded-2xl px-5 py-4">
                    <p className="text-sm font-black text-slate-600 flex items-center gap-2">
                        <Ban size={16} /> {t('payroll_line_excluded', { defaultValue: 'Excluded from this run' })}
                    </p>
                    {line.excludeReason && <p className="text-xs text-slate-500 font-medium mt-1">{line.excludeReason}</p>}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title={t('payroll_inputs', { defaultValue: 'How this was calculated' })}>
                    <Kv label={t('payroll_hourly_rate', { defaultValue: 'Hourly rate' })} value={line.hourlyRate ? `${line.hourlyRate} ${cur}` : '—'} />
                    <Kv label={t('payroll_rate_source', { defaultValue: 'From' })} value={[line.jobCategory, line.jobGrade, line.structureLevel].filter(Boolean).join(' · ') || '—'} small />
                    <Divider />
                    <Kv label={t('payroll_basic_hours', { defaultValue: 'Basic hours' })} value={String(line.basicHours)} />
                    <Kv label={t('payroll_overtime_hours', { defaultValue: 'Approved overtime hours' })} value={String(line.overtimeHours)} />
                    <Kv label={t('payroll_total_hours', { defaultValue: 'Total working hours' })} value={String(line.totalWorkingHours)} bold />
                    <Kv label={t('payroll_paid_absence_hours', { defaultValue: 'Paid absence hours' })} value={String(line.paidAbsenceHours)} />
                    {/* Shown for context only. The attendance system already excludes unpaid leave
                        from worked minutes, so deducting it here would take the same absence twice. */}
                    <Kv
                        label={t('payroll_unpaid_hours', { defaultValue: 'Unpaid hours (not deducted)' })}
                        value={String(line.unpaidHours)}
                        small
                    />
                    <Divider />
                    <Kv label={t('payroll_factors', { defaultValue: 'Factors' })} value={`F = ${line.factorF}`} bold />
                    <FactorRow label="Position" value={line.positionFactor} winner={line.positionFactor >= line.skillFactor && line.positionFactor > 1} />
                    <FactorRow label="Skill" value={line.skillFactor} winner={line.skillFactor > line.positionFactor} />
                    <FactorRow label="Site" value={line.siteFactor} />
                    <FactorRow label="Language" value={line.languageFactor} />
                    {/* Position and Skill are mutually exclusive in this system — only the higher of
                        the two is ever paid, which is why one allowance line is always zero. */}
                    <p className="text-[10px] text-slate-400 font-medium pt-1">
                        {t('payroll_factor_exclusive_note', { defaultValue: 'Only the higher of Position and Skill is applied; the other is never paid.' })}
                    </p>
                </Card>

                <Card title={t('payroll_earnings_box', { defaultValue: 'Earnings' })}>
                    <Money label={t('payroll_basic_salary', { defaultValue: 'Basic Salary' })} value={line.basicSalary} cur={cur} />
                    <Money label={t('payroll_position_allowance', { defaultValue: 'Position Factor Allowance' })} value={line.positionAllowance} cur={cur} />
                    <Money label={t('payroll_site_allowance', { defaultValue: 'Site Factor Allowance' })} value={line.siteAllowance} cur={cur} />
                    <Money label={t('payroll_language_allowance', { defaultValue: 'English Language Allowance' })} value={line.languageAllowance} cur={cur} />
                    <Money label={t('payroll_skill_allowance', { defaultValue: 'Skill Factor Allowance' })} value={line.skillAllowance} cur={cur} />
                    <Money label={t('payroll_paid_absences', { defaultValue: 'Paid Absences' })} value={line.paidAbsenceAmount} cur={cur} />
                    <Money
                        label={`${t('payroll_bonus_allowance', { defaultValue: 'Bonus Allowance' })}${line.bonusPercent ? ` (${line.bonusPercent}%)` : ''}`}
                        value={line.bonusAmount}
                        cur={cur}
                    />
                    {earnings.filter(i => i.category !== 'REWARD_BONUS').map(i => (
                        <Money key={i.id} label={i.label} value={i.amount} cur={i.currency} />
                    ))}
                    <Divider />
                    <Money label={t('payroll_total_earnings', { defaultValue: 'Total Earnings' })} value={line.totalEarnings} cur={cur} bold />
                </Card>

                <Card title={t('payroll_deductions_box', { defaultValue: 'Deductions' })}>
                    {deductions.length === 0 && (
                        <p className="text-xs text-slate-400 font-medium">{t('payroll_no_deductions', { defaultValue: 'No deductions this period.' })}</p>
                    )}
                    {deductions.map(i => <Money key={i.id} label={i.label} value={i.amount} cur={i.currency} negative />)}
                    <Divider />
                    <Money label={t('payroll_total_deduction', { defaultValue: 'Total Deduction' })} value={line.deductionsTotal} cur={cur} bold negative />
                    {/* Printed on the payslip inside the deductions box, but deliberately NOT part of
                        the total — it is what is still owed, not what is being taken this month. */}
                    <div className="pt-2 mt-1 border-t border-dashed border-slate-200">
                        <Kv
                            label={t('payroll_remaining_advance', { defaultValue: 'Remaining advance (not deducted)' })}
                            value={`${fmt(line.remainingAdvanceBalance)} ${cur}`}
                            small
                        />
                    </div>
                </Card>

                <Card title={t('payroll_net_box', { defaultValue: 'Net Salary' })}>
                    <div className="py-2">
                        <div className="text-3xl font-black text-slate-800">{fmt(line.netSalary)}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">{cur}</div>
                    </div>
                    {line.serviceProviderName && (
                        <>
                            <Divider />
                            {/* A company cost, never part of the employee's pay and never on the payslip. */}
                            <Kv label={t('payroll_service_provider', { defaultValue: 'Service provider' })} value={line.serviceProviderName} />
                            <Kv
                                label={t('payroll_sp_fee', { defaultValue: 'Provider fee (company cost)' })}
                                value={`${fmt(line.serviceProviderFee)} ${cur} · ${line.serviceProviderPercentage}% of net`}
                                small
                            />
                            <Kv label={t('payroll_employer_cost', { defaultValue: 'Total cost to the company' })} value={`${fmt(line.employerTotalCost)} ${cur}`} bold />
                        </>
                    )}
                    <Divider />
                    <Kv label={t('payroll_contract_end', { defaultValue: 'Contract expiry' })} value={fmtDate(line.contractEndDate)} small />
                    <Kv label={t('payroll_leave_balances', { defaultValue: 'Leave balance (paid / unpaid / emergency)' })}
                        value={`${line.paidLeaveBalance ?? '—'} / ${line.unpaidLeaveBalance ?? '—'} / ${line.emergencyLeaveBalance ?? '—'}`} small />
                </Card>
            </div>

            <Card title={t('payroll_attendance_box', { defaultValue: 'Attendance' })}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Stat label={t('payroll_worked_mins', { defaultValue: 'Worked minutes' })} value={line.workMins} />
                    <Stat label={t('payroll_approved_ot_mins', { defaultValue: 'Approved OT minutes' })} value={line.approvedOtMins} />
                    <Stat label={t('payroll_paid_leave_mins', { defaultValue: 'Paid leave minutes' })} value={line.paidLeaveMins} />
                    <Stat label={t('payroll_absence_days', { defaultValue: 'Absence days' })} value={line.absenceDays} />
                </div>
                {line.otMins > line.approvedOtMins && (
                    <p className="text-[11px] text-slate-400 font-medium mt-3">
                        {t('payroll_ot_note', {
                            defaultValue: '{{logged}} overtime minutes were logged but only {{approved}} are approved. Only approved overtime is paid.',
                            logged: line.otMins, approved: line.approvedOtMins,
                        })}
                    </p>
                )}
                <button
                    onClick={() => setShowRaw(v => !v)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#511d29]"
                >
                    <ChevronDown size={14} className={showRaw ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    {t('payroll_show_raw', { defaultValue: 'As returned by the attendance system' })}
                </button>
                {showRaw && (
                    <pre dir="ltr" className="mt-3 p-4 bg-slate-900 text-slate-200 rounded-xl text-[11px] overflow-x-auto">
                        {JSON.stringify(line.attendanceRaw ?? { note: 'No attendance row matched this employee.' }, null, 2)}
                    </pre>
                )}
            </Card>

            {/* Corrections sit above Review because they change the money, and Review only
                decides whether this person is in the run at all. */}
            <PayrollCorrections
                runId={runId}
                lineId={lineId}
                currency={line.currency}
                editable={editable}
                canManage={canManage}
                appliedCount={(line.items || []).filter(
                    i => i.category === 'PREVIOUS_UNDERPAYMENT' || i.category === 'PREVIOUS_OVERPAYMENT',
                ).length}
            />

            {canManage && editable && (
                <Card title={t('payroll_review', { defaultValue: 'Review' })}>
                    {line.status === 'EXCLUDED' ? (
                        <button
                            onClick={() => act(() => payrollRunService.updateLine(runId, lineId, { excluded: false, excludeReason: null }))}
                            disabled={busy}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                            <RotateCcw size={15} /> {t('payroll_include_again', { defaultValue: 'Put back in this run' })}
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-400 font-medium">
                                {t('payroll_exclude_hint', { defaultValue: 'Excluding someone leaves them unpaid for this period. The reason is kept with the run and survives a recompute.' })}
                            </p>
                            <input
                                value={excludeReason}
                                onChange={e => setExcludeReason(e.target.value)}
                                placeholder={t('payroll_exclude_reason', { defaultValue: 'Reason for excluding this employee' })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium"
                            />
                            <button
                                onClick={() => act(() => payrollRunService.updateLine(runId, lineId, { excluded: true, excludeReason }))}
                                disabled={busy || !excludeReason.trim()}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold text-sm hover:bg-rose-100 disabled:opacity-40"
                            >
                                <Ban size={15} /> {t('payroll_exclude', { defaultValue: 'Exclude from this run' })}
                            </button>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white border border-[#511d29]/10 rounded-2xl p-5">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{title}</h2>
        <div className="space-y-1.5">{children}</div>
    </div>
);

const Divider = () => <div className="border-t border-slate-100 my-2" />;

const Kv: React.FC<{ label: string; value: string; bold?: boolean; small?: boolean }> = ({ label, value, bold, small }) => (
    <div className="flex justify-between gap-4">
        <span className={`${small ? 'text-[11px] text-slate-400' : 'text-xs text-slate-500'} font-semibold`}>{label}</span>
        <span className={`${small ? 'text-[11px]' : 'text-xs'} ${bold ? 'font-black text-slate-800' : 'font-bold text-slate-700'} text-end`}>{value}</span>
    </div>
);

const Money: React.FC<{ label: string; value: number; cur: string; bold?: boolean; negative?: boolean }> = ({ label, value, cur, bold, negative }) => (
    <div className="flex justify-between gap-4">
        <span className={`text-xs font-semibold ${value === 0 && !bold ? 'text-slate-300' : 'text-slate-500'}`}>{label}</span>
        <span className={`text-xs tabular-nums ${bold ? 'font-black text-slate-800' : value === 0 ? 'font-bold text-slate-300' : 'font-bold text-slate-700'}`}>
            {negative && value > 0 ? '- ' : ''}{fmt(value)} <span className="text-[10px] text-slate-400">{cur}</span>
        </span>
    </div>
);

const FactorRow: React.FC<{ label: string; value: number; winner?: boolean }> = ({ label, value, winner }) => (
    <div className="flex justify-between gap-4">
        <span className={`text-[11px] font-semibold ${value > 1 ? 'text-slate-500' : 'text-slate-300'}`}>
            {label}{winner && <span className="ms-1.5 text-[9px] font-black text-emerald-600 uppercase">applied</span>}
        </span>
        <span className={`text-[11px] font-bold ${value > 1 ? 'text-slate-700' : 'text-slate-300'}`}>{value}</span>
    </div>
);

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div>
        <div className="text-lg font-black text-slate-800 tabular-nums">{value}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
    </div>
);

export default PayrollLineDetail;
