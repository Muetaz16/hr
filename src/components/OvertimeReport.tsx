import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Timer, RefreshCw, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Check, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
    attendanceService,
    type OvertimeReportGroup, type OvertimeReportRow, type OvertimeApprovalRow,
} from '../services/attendanceService';
import { departmentService, divisionService } from '../services/departmentService';
import { unitService } from '../services/unitService';
import { formatMinutesAsHM } from '../utils/attendanceFormat';
import { buildOvertimeWorkbook, overtimeSheetFilename } from '../utils/overtimeReportSheet';
import { saveBlob } from '../utils/download';

// Recorded overtime for a period, grouped for whoever approves it — and the grid the officer types
// the returned hours into.
//
// The process this serves: the officer exports a group, sends it to that head, the head replies with
// the hours they approve, and the officer enters them here. Only approved overtime is ever paid; the
// recorded figure is what the terminal saw, and payroll ignores it entirely.
//
// Two things the screen must never let happen, both measured against the live service:
//   · An approval period spanning two financial months is counted IN FULL by both payroll runs —
//     8 hours approved once became 480 minutes in September and 480 in October. The range is
//     refused before it can be saved, and the server refuses it again.
//   · Approvals STACK and cannot be deleted. A second, differently-dated approval adds to the
//     first rather than replacing it, so an overlap is warned about per row before saving.

type Scope = 'all' | 'division' | 'department' | 'unit' | 'employee';

/** The financial month a date falls in: on or after the 25th it belongs to the next month. */
const periodOf = (day: string): string => {
    const d = new Date(`${day}T00:00:00`);
    const anchor = new Date(d.getFullYear(), d.getMonth() + (d.getDate() >= 25 ? 1 : 0), 1);
    return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
};

/** The current financial month as a from→to pair — the window payroll will read. */
const currentPeriodRange = (today = new Date()): { start: string; end: string } => {
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const shift = today.getDate() >= 25 ? 1 : 0;
    return {
        start: iso(new Date(today.getFullYear(), today.getMonth() - 1 + shift, 25)),
        end: iso(new Date(today.getFullYear(), today.getMonth() + shift, 24)),
    };
};

interface Props {
    /** False for a read-only holder: they may read the report but not record an approval. */
    canApprove?: boolean;
}

const OvertimeReport: React.FC<Props> = ({ canApprove = false }) => {
    const { t } = useTranslation();
    const initial = useMemo(() => currentPeriodRange(), []);
    const [start, setStart] = useState(initial.start);
    const [end, setEnd] = useState(initial.end);
    const [scope, setScope] = useState<Scope>('all');
    const [scopeId, setScopeId] = useState('');
    const [empCode, setEmpCode] = useState('');
    const [collapsed, setCollapsed] = useState(false);

    // Entry state, keyed by empCode so it survives regrouping and filtering.
    const [entering, setEntering] = useState(false);
    const [entered, setEntered] = useState<Record<string, { hours: string; minutes: string }>>({});
    const [reason, setReason] = useState('');
    const [headName, setHeadName] = useState('');
    const [saving, setSaving] = useState(false);
    const [busyExport, setBusyExport] = useState('');

    const crossesBoundary = !!start && !!end && periodOf(start) !== periodOf(end);

    const { data, isLoading, isError, isFetching, refetch } = useQuery({
        queryKey: ['overtime-report', start, end, scope, scopeId, empCode],
        queryFn: () => attendanceService.getOvertimeReport({
            start, end, scope,
            scopeId: scopeId || undefined,
            empCode: scope === 'employee' ? (empCode || undefined) : undefined,
        }),
        enabled: !!start && !!end && start <= end,
        retry: false,
    });

    // Only fetched when a scope that needs them is chosen — three list calls on a tab nobody may
    // open is three calls wasted.
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'], queryFn: departmentService.getAllDepartments, enabled: scope === 'department',
    });
    const { data: divisions = [] } = useQuery({
        queryKey: ['divisions'], queryFn: divisionService.getAllDivisions, enabled: scope === 'division',
    });
    const { data: units = [] } = useQuery({
        queryKey: ['units'], queryFn: unitService.getAllUnits, enabled: scope === 'unit',
    });

    const groups = data?.groups || [];

    /** Approvals already on record that overlap this range — a second one would ADD to them. */
    const overlapFor = (row: OvertimeReportRow) => row.approvals.filter(a => a.status === 'APPLIED');

    const save = async () => {
        const rows: OvertimeApprovalRow[] = Object.entries(entered)
            .map(([code, v]) => ({ empCode: code, hours: Number(v.hours) || 0, minutes: Number(v.minutes) || 0 }))
            .filter(r => r.hours > 0 || r.minutes > 0);
        if (!rows.length) { toast.error(t('ot_nothing_entered', { defaultValue: 'No hours have been entered yet.' })); return; }
        if (reason.trim().length < 3) { toast.error(t('ot_reason_required', { defaultValue: 'Write who authorised these hours.' })); return; }

        setSaving(true);
        try {
            const result = await attendanceService.approveOvertime({
                startDate: start, endDate: end, reason: reason.trim(),
                headName: headName.trim() || undefined, rows,
            });
            if (result.failures.length) {
                toast.error(t('ot_partly_failed', {
                    defaultValue: 'Some approvals did not go through: {{detail}}', detail: result.failures.join(' · '),
                }));
            } else {
                toast.success(t('ot_approved_n', {
                    defaultValue: 'Approved overtime for {{n}} employees.', count: result.applied, n: result.applied,
                }));
            }
            setEntered({});
            setEntering(false);
            refetch();
        } catch (e: any) {
            toast.error(e?.response?.data?.error || t('failed_to_save', { defaultValue: 'Failed to save.' }));
        } finally {
            setSaving(false);
        }
    };

    const exportSheet = async (group: OvertimeReportGroup) => {
        setBusyExport(group.key);
        try {
            saveBlob(await buildOvertimeWorkbook(group, start, end), overtimeSheetFilename(group, start, end));
        } catch {
            toast.error(t('failed_to_export', { defaultValue: 'Failed to build the file.' }));
        } finally {
            setBusyExport('');
        }
    };

    const exportDoc = async (group: OvertimeReportGroup) => {
        setBusyExport(`${group.key}-doc`);
        try {
            const blob = await attendanceService.getOvertimeReportDoc({
                start, end, scope, scopeId: group.key.startsWith('__') ? undefined : group.key,
            });
            saveBlob(blob, overtimeSheetFilename(group, start, end).replace(/\.xlsx$/, '.docx'));
        } catch {
            toast.error(t('failed_to_export', { defaultValue: 'Failed to build the file.' }));
        } finally {
            setBusyExport('');
        }
    };

    const SCOPE_OPTIONS: { key: Scope; label: string }[] = [
        { key: 'all', label: t('ot_scope_all', { defaultValue: 'Everyone' }) },
        { key: 'division', label: t('division', { defaultValue: 'Division' }) },
        { key: 'department', label: t('department', { defaultValue: 'Department' }) },
        { key: 'unit', label: t('unit', { defaultValue: 'Unit' }) },
        { key: 'employee', label: t('ot_scope_employee', { defaultValue: 'One employee' }) },
    ];
    const nodes = scope === 'department' ? departments : scope === 'division' ? divisions : scope === 'unit' ? units : [];

    return (
        <div className="bg-white border border-[#511d29]/10 rounded-xl overflow-hidden shadow-sm">
            <div className={`p-4 bg-slate-50/50 space-y-3 ${collapsed ? '' : 'border-b border-[#511d29]/10'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-black text-[#511d29] uppercase tracking-wider inline-flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        {t('overtime_report', { defaultValue: 'Overtime' })}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={start} onChange={e => setStart(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold" />
                        <span className="text-xs font-bold text-slate-400">{t('to', { defaultValue: 'to' })}</span>
                        <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold" />
                        <button
                            onClick={() => { const r = currentPeriodRange(); setStart(r.start); setEnd(r.end); }}
                            className="text-[10px] font-black text-[#511d29] uppercase tracking-wider underline"
                        >
                            {t('ot_this_period', { defaultValue: 'This payroll month' })}
                        </button>
                        <select value={scope} onChange={e => { setScope(e.target.value as Scope); setScopeId(''); }}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold">
                            {SCOPE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                        {nodes.length > 0 && (
                            <select value={scopeId} onChange={e => setScopeId(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold">
                                <option value="">{t('ot_all_of_them', { defaultValue: 'All of them' })}</option>
                                {nodes.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
                            </select>
                        )}
                        {scope === 'employee' && (
                            <input type="text" value={empCode} onChange={e => setEmpCode(e.target.value)}
                                placeholder={t('staff_code', { defaultValue: 'Staff Code' })}
                                className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg text-xs font-bold w-32" />
                        )}
                        <button onClick={() => setCollapsed(c => !c)}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg font-black text-[10px] uppercase tracking-widest text-[#511d29] hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5">
                            {collapsed ? <><ChevronDown className="w-3 h-3" />{t('show_list', { defaultValue: 'Show list' })}</>
                                : <><ChevronUp className="w-3 h-3" />{t('hide_list', { defaultValue: 'Hide list' })}</>}
                        </button>
                        <button onClick={() => refetch()} disabled={isFetching}
                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 rounded-lg font-black text-[10px] uppercase tracking-widest text-[#511d29] hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50">
                            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
                            {t('refresh', { defaultValue: 'Refresh' })}
                        </button>
                    </div>
                </div>

                <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    {t('overtime_report_sub', {
                        defaultValue: 'Overtime the terminal recorded. None of it is paid until it is approved — payroll pays only approved hours, at the ordinary rate. Send a group to its head, then enter the hours they return.',
                    })}
                </p>

                {!isLoading && !isError && data && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-bold text-slate-600">
                        <span dir="ltr" className="text-slate-400">{data.start} → {data.end}{data.period ? ` · ${data.period}` : ''}</span>
                        <span>{t('ot_n_employees', { defaultValue: '{{n}} employees', count: data.totals.employees, n: data.totals.employees })}</span>
                        <span>{t('ot_recorded_total', { defaultValue: 'recorded {{time}}', time: formatMinutesAsHM(data.totals.recordedMins) })}</span>
                        <span className={data.totals.approvedMins > 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {t('ot_approved_total', { defaultValue: 'approved {{time}}', time: formatMinutesAsHM(data.totals.approvedMins) })}
                        </span>
                    </div>
                )}

                {/* The range may be reported on, but not approved as one period. */}
                {crossesBoundary && (
                    <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {t('ot_crosses_boundary', {
                            defaultValue: 'This range spans two payroll months ({{a}} and {{b}}). It can be reported on, but not approved as one period — the attendance system would count the hours in full in BOTH payroll runs and pay them twice. Approve one month at a time.',
                            a: periodOf(start), b: periodOf(end),
                        })}
                    </div>
                )}

                {/* Placement gaps decide whether this report can be routed at all, so they are stated
                    up front rather than left to be noticed at the bottom of a table. */}
                {!!data && (data.totals.unplaced > 0 || data.totals.notLinked > 0) && (
                    <div className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
                        {t('ot_routing_gap', {
                            defaultValue: '{{unplaced}} of these employees have no org placement and {{notLinked}} have no HR record, so they belong to no head. They are listed at the bottom and are NOT in any department\'s file.',
                            unplaced: data.totals.unplaced, notLinked: data.totals.notLinked,
                        })}
                    </div>
                )}

                {canApprove && !crossesBoundary && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {!entering ? (
                            <button onClick={() => setEntering(true)}
                                className="px-4 py-2 bg-[#511d29] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-colors">
                                {t('ot_enter_approvals', { defaultValue: 'Enter approved hours' })}
                            </button>
                        ) : (
                            <>
                                <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                                    placeholder={t('ot_reason_placeholder', { defaultValue: 'Who authorised these hours' })}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold flex-1 min-w-[220px]" />
                                <input type="text" value={headName} onChange={e => setHeadName(e.target.value)}
                                    placeholder={t('ot_head_name', { defaultValue: 'Head\'s name (optional)' })}
                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold w-48" />
                                <button onClick={save} disabled={saving}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
                                    <Check className="w-3.5 h-3.5" />
                                    {saving ? t('saving', { defaultValue: 'Saving…' }) : t('ot_save_approvals', { defaultValue: 'Save approvals' })}
                                </button>
                                <button onClick={() => { setEntering(false); setEntered({}); }}
                                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">
                                    {t('cancel', { defaultValue: 'Cancel' })}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isError && (
                <div className="p-10 text-center">
                    <p className="text-sm font-bold text-rose-600">
                        {t('could_not_reach_the_attendance_system', { defaultValue: 'Could not reach the attendance system.' })}
                    </p>
                </div>
            )}

            {!isError && !collapsed && (
                <div className="divide-y divide-slate-100">
                    {isLoading && (
                        <p className="p-10 text-center text-slate-400 font-bold animate-pulse">{t('loading', { defaultValue: 'Loading…' })}</p>
                    )}
                    {!isLoading && groups.length === 0 && (
                        <p className="p-10 text-center text-slate-400 font-bold">
                            {t('ot_none_recorded', { defaultValue: 'No overtime was recorded in this range.' })}
                        </p>
                    )}

                    {groups.map(group => {
                        const exceptional = group.kind === 'unassigned' || group.kind === 'notLinked';
                        return (
                            <div key={group.key}>
                                <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${exceptional ? 'bg-slate-100' : 'bg-[#511d29]/5'}`}>
                                    <div>
                                        <span className={`text-xs font-black uppercase tracking-wider ${exceptional ? 'text-slate-600' : 'text-[#511d29]'}`}>
                                            {group.label}
                                        </span>
                                        <span className="ms-3 text-[11px] font-bold text-slate-500">
                                            {t('ot_group_totals', {
                                                defaultValue: '{{n}} employees · recorded {{recorded}} · approved {{approved}}',
                                                n: group.rows.length,
                                                recorded: formatMinutesAsHM(group.recordedMins),
                                                approved: formatMinutesAsHM(group.approvedMins),
                                            })}
                                        </span>
                                    </div>
                                    {/* One file per group, never one file with a tab each — a forgotten
                                        tab is how one head ends up reading another's staff. */}
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => exportSheet(group)} disabled={busyExport === group.key}
                                            className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50">
                                            <FileSpreadsheet className="w-3.5 h-3.5" /> {t('excel', { defaultValue: 'Excel' })}
                                        </button>
                                        <button onClick={() => exportDoc(group)} disabled={busyExport === `${group.key}-doc`}
                                            className="px-3 py-1.5 bg-white border border-[#511d29]/20 text-[#511d29] rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50">
                                            <FileText className="w-3.5 h-3.5" /> {t('word', { defaultValue: 'Word' })}
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-start border-collapse text-xs md:text-sm">
                                        <thead>
                                            <tr className="text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-100">
                                                <th className="p-3 text-start">{t('employee', { defaultValue: 'Employee' })}</th>
                                                <th className="p-3 text-start">{t('ot_placement', { defaultValue: 'Belongs to' })}</th>
                                                <th className="p-3 text-start">{t('ot_recorded', { defaultValue: 'Recorded' })}</th>
                                                <th className="p-3 text-start">{t('ot_already_approved', { defaultValue: 'Already approved' })}</th>
                                                {entering && <th className="p-3 text-start">{t('ot_approve_now', { defaultValue: 'Approve now' })}</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                                            {group.rows.map(row => {
                                                const overlaps = overlapFor(row);
                                                const draft = entered[row.empCode] || { hours: '', minutes: '' };
                                                return (
                                                    <tr key={row.empCode} className="hover:bg-slate-50/50 align-top">
                                                        <td className="p-3">
                                                            <span className="font-bold block">{row.name}</span>
                                                            <span className="font-mono text-[10px] text-slate-400">{row.empCode}</span>
                                                        </td>
                                                        <td className="p-3 text-[11px] text-slate-500">
                                                            {row.placement.unit || row.placement.department || row.placement.division || row.placement.directorate
                                                                || <span className="text-slate-400">{t('ot_nowhere', { defaultValue: '—' })}</span>}
                                                        </td>
                                                        <td className="p-3 font-bold whitespace-nowrap">{formatMinutesAsHM(row.recordedMins)}</td>
                                                        <td className="p-3 whitespace-nowrap">
                                                            <span className={`font-bold ${row.approvedMins > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                {formatMinutesAsHM(row.approvedMins)}
                                                            </span>
                                                            {/* An approval already on record: a second one ADDS to it. */}
                                                            {overlaps.map((a, i) => (
                                                                <span key={i} dir="ltr" className="block text-[10px] text-slate-400 font-mono">
                                                                    {a.startDate}..{a.endDate} = {a.minutes}m
                                                                </span>
                                                            ))}
                                                        </td>
                                                        {entering && (
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-1">
                                                                    <input type="number" min={0} value={draft.hours} placeholder="0"
                                                                        onChange={e => setEntered(s => ({ ...s, [row.empCode]: { ...draft, hours: e.target.value } }))}
                                                                        className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold" />
                                                                    <span className="text-[10px] font-bold text-slate-400">h</span>
                                                                    <input type="number" min={0} max={59} value={draft.minutes} placeholder="0"
                                                                        onChange={e => setEntered(s => ({ ...s, [row.empCode]: { ...draft, minutes: e.target.value } }))}
                                                                        className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold" />
                                                                    <span className="text-[10px] font-bold text-slate-400">m</span>
                                                                </div>
                                                                {overlaps.length > 0 && (
                                                                    <span className="block mt-1 text-[10px] font-bold text-amber-700 inline-flex items-start gap-1">
                                                                        <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                                                                        {t('ot_overlap_warning', {
                                                                            defaultValue: 'Adds to an approval already recorded — it cannot be removed.',
                                                                        })}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}

                    {/* The individual view: where the hours came from, day by day. */}
                    {!!data?.detail?.length && (
                        <div className="p-4 bg-slate-50/50">
                            <p className="text-xs font-black text-[#511d29] uppercase tracking-wider mb-2">
                                {t('ot_day_by_day', { defaultValue: 'Day by day' })}
                            </p>
                            <table className="w-full text-start border-collapse text-xs">
                                <tbody className="divide-y divide-slate-100">
                                    {data.detail.map(d => (
                                        <tr key={d.date}>
                                            <td className="p-2 font-bold whitespace-nowrap">
                                                <bdi>{format(parseISO(d.date), 'dd MMM yyyy')}</bdi>
                                            </td>
                                            <td className="p-2">
                                                {/* Why the hours exist: work on the rest day or a public
                                                    holiday is booked entirely as overtime. */}
                                                {d.dayKind === 'restDay' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        {t('weekly_rest_day', { defaultValue: 'Weekly rest day' })}
                                                    </span>
                                                )}
                                                {d.dayKind === 'holiday' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                                        {d.holidayName || t('public_holiday', { defaultValue: 'Public holiday' })}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2" dir="ltr">
                                                <span className="font-mono text-[11px] text-slate-500">{d.punches.join('  ·  ')}</span>
                                            </td>
                                            <td className="p-2 font-bold whitespace-nowrap text-end">{formatMinutesAsHM(d.otMins)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OvertimeReport;
