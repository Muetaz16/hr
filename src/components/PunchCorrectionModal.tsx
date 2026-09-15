import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Lock, Plus, Trash2, Wand2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Modal from './Modal';
import {
    attendanceService,
    type PunchAnomalyRow, type PunchCorrectionStep, type PunchCorrectionResult, type PunchRef,
} from '../services/attendanceService';
import { punchAnomalyText } from '../utils/punchAnomalyText';
import { formatMinutesAsHM } from '../utils/attendanceFormat';

// Repairing one day's punches.
//
// What this screen may offer is not a style choice — it is the capability matrix of the attendance
// service, measured against it on a throwaway employee rather than read off its documentation:
//
//   | operation                  | terminal punch          | manual punch        |
//   |----------------------------|-------------------------|---------------------|
//   | change the TYPE            | yes                     | yes                 |
//   | change the TIME            | NO — protected          | yes                 |
//   | delete                     | NO — refused with 404   | yes                 |
//
// So a terminal punch shows a locked time and no delete, and the reason is written on the row in
// plain words rather than left as a greyed-out control the officer wonders about. The type
// dropdown holds exactly two entries: the service accepts Break and Overtime codes silently, with
// a 200, and a wrong pick there would zero somebody's day. That whitelist is enforced server-side
// too — this dropdown is the courtesy, not the control.

const STATES: ('Check In' | 'Check Out')[] = ['Check In', 'Check Out'];

/** Must match the server's own fingerprint exactly, or every save would 409. */
const fingerprintOf = (punches: PunchRef[]): string =>
    punches
        .map(p => `${p.id}:${String(p.punchTime).slice(0, 5)}:${p.punchState}:${p.isManual ? 'M' : 'D'}`)
        .sort()
        .join('|');

/** A row's pending edit. `state === null` means "leave it alone". */
interface Draft {
    state: 'Check In' | 'Check Out' | null;
    time: string | null;
    remove: boolean;
}

interface Props {
    row: PunchAnomalyRow | null;
    onClose: () => void;
    onSaved: () => void;
}

const PunchCorrectionModal: React.FC<Props> = ({ row, onClose, onSaved }) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [drafts, setDrafts] = useState<Record<number, Draft>>({});
    const [additions, setAdditions] = useState<{ key: number; time: string; state: 'Check In' | 'Check Out' }[]>([]);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    // What the correction set off. Held on screen rather than announced in a toast: a locked run
    // means somebody must go and raise a recovery line, and a message that disappears after four
    // seconds is not a handover.
    const [aftermath, setAftermath] = useState<PunchCorrectionResult | null>(null);

    // Keyed on the day so reopening a different row never inherits the last one's edits.
    const dayKey = row ? `${row.empCode}|${row.date}` : '';
    const [loadedFor, setLoadedFor] = useState('');
    if (row && loadedFor !== dayKey) {
        setLoadedFor(dayKey);
        setDrafts({});
        setAdditions([]);
        setReason('');
        setAftermath(null);
    }

    const punches = row?.punches || [];
    const BLANK: Draft = { state: null, time: null, remove: false };
    const setDraft = (id: number, patch: Partial<Draft>) =>
        setDrafts(d => ({ ...d, [id]: { ...BLANK, ...d[id], ...patch } }));

    const steps: PunchCorrectionStep[] = useMemo(() => {
        const out: PunchCorrectionStep[] = [];
        for (const p of punches) {
            const d = drafts[p.id];
            if (!d) continue;
            if (d.remove) { out.push({ action: 'DELETE', punchId: p.id }); continue; }
            const movedTo = d.time && d.time !== String(p.punchTime).slice(0, 5) ? d.time : undefined;
            const retypedTo = d.state && d.state !== p.punchState ? d.state : undefined;
            // A move is expressed as a RETYPE carrying a time, because the service has no separate
            // "move" call — it needs the state on every update either way.
            if (retypedTo || movedTo) {
                out.push({
                    action: 'RETYPE',
                    punchId: p.id,
                    toState: (retypedTo || (p.punchState === 'Check In' ? 'Check In' : 'Check Out')) as 'Check In' | 'Check Out',
                    ...(movedTo ? { atTime: movedTo } : {}),
                });
            }
        }
        for (const a of additions) {
            if (a.time) out.push({ action: 'ADD', atTime: a.time, toState: a.state });
        }
        return out;
    }, [punches, drafts, additions]);

    /** Applies the detector's own suggestion, which is derived from the day's real schedule. */
    const applySuggestion = () => {
        if (!row) return;
        for (const s of row.anomaly.suggested) {
            if (s.action === 'RETYPE' && s.punchId != null) {
                setDraft(s.punchId, { state: s.toState as 'Check In' | 'Check Out' });
            } else if (s.action === 'ADD' && s.atTime) {
                setAdditions(a => [...a, { key: Date.now() + a.length, time: s.atTime as string, state: s.toState as 'Check In' | 'Check Out' }]);
            }
        }
    };

    const save = async () => {
        if (!row) return;
        if (!steps.length) {
            toast.error(t('nothing_to_change', { defaultValue: 'Nothing has been changed yet.' }));
            return;
        }
        if (reason.trim().length < 5) {
            toast.error(t('reason_required_5', { defaultValue: 'Write why this is being corrected (at least 5 characters).' }));
            return;
        }
        setSaving(true);
        try {
            const result = await attendanceService.correctPunches({
                empCode: row.empCode,
                workDate: row.date,
                reason: reason.trim(),
                anomalyKind: row.anomaly.kind,
                fingerprint: fingerprintOf(punches),
                steps,
            });
            // The service answers "success" even when it changed nothing, so the server re-reads
            // the day and reports what it actually found. Never dress a failure up as a save.
            if (result.failures.length) {
                toast.error(t('correction_partly_failed', {
                    defaultValue: 'Some changes did not go through: {{detail}}',
                    detail: result.failures.join(' · '),
                }));
            } else {
                toast.success(t('correction_applied_mins', {
                    defaultValue: 'Corrected. Worked time went from {{before}} to {{after}}.',
                    before: formatMinutesAsHM(result.workedBefore),
                    after: formatMinutesAsHM(result.workedAfter ?? result.workedBefore),
                }));
            }
            // The archive is a sibling card, not a child — it has to be told. A FAILED correction
            // is refreshed in too, deliberately: it belongs on the record just as much.
            queryClient.invalidateQueries({ queryKey: ['punch-corrections'] });
            // The employee's own daily breakdown was showing this day as broken.
            queryClient.invalidateQueries({ queryKey: ['attendance-monthly-report'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-manual-tx'] });
            // A signed run, a finalised evaluation or an open disciplinary case all need a human
            // to do something next. Keep the modal open and say what, instead of closing on a
            // toast that is gone before it has been read.
            onSaved();
            if (result.payrollWasLocked || result.evaluationWasFinalized || result.relatedCases.length || result.failures.length) {
                setAftermath(result);
            } else {
                onClose();
            }
        } catch (e: any) {
            toast.error(e?.response?.data?.error || t('failed_to_save', { defaultValue: 'Failed to save.' }));
        } finally {
            setSaving(false);
        }
    };

    if (!row) return null;

    const SOURCE_LABEL: Record<string, string> = {
        shift: t('schedule_from_shift', { defaultValue: 'from this employee\'s own shift' }),
        multiplier: t('schedule_from_multiplier', { defaultValue: 'from a date-ranged override (e.g. Ramadan hours)' }),
        default: t('schedule_from_default', { defaultValue: 'the company default' }),
    };

    return (
        <Modal
            isOpen={!!row}
            onClose={onClose}
            maxWidth="max-w-2xl"
            title={aftermath
                ? t('what_happens_next', { defaultValue: 'What happens next' })
                : t('correct_punches', { defaultValue: 'Correct punches' })}
        >
            {aftermath ? (
                <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-emerald-800">
                            {t('correction_applied_mins', {
                                defaultValue: 'Corrected. Worked time went from {{before}} to {{after}}.',
                                before: formatMinutesAsHM(aftermath.workedBefore),
                                after: formatMinutesAsHM(aftermath.workedAfter ?? aftermath.workedBefore),
                            })}
                        </p>
                    </div>

                    {!!aftermath.failures.length && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                            <p className="text-xs font-black text-rose-800 uppercase tracking-wider mb-1">
                                {t('did_not_go_through', { defaultValue: 'Did not go through' })}
                            </p>
                            <p dir="auto" className="text-[11px] font-bold text-rose-700">{aftermath.failures.join(' · ')}</p>
                        </div>
                    )}

                    {/* A signed run cannot absorb this. Say what the remedy is and price it — but
                        never create it here: that line needs a typed note and an explicit link to
                        the month it corrects, and those are decisions, not defaults. */}
                    {aftermath.payrollWasLocked && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-black text-amber-900 uppercase tracking-wider inline-flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                {t('payroll_already_closed', { defaultValue: 'Payroll for this month is already closed' })}
                            </p>
                            <p className="text-[11px] font-medium text-amber-900/80 leading-relaxed">
                                {t('payroll_closed_explain', {
                                    defaultValue: 'The run is {{status}}, so this correction can never enter it. The approved run stands as signed — the money is recovered by adding an underpayment correction to the next run.',
                                    status: aftermath.payrollRunStatus,
                                })}
                            </p>
                            {aftermath.suggestedRecovery && (
                                <p className="text-[11px] font-bold text-amber-900 bg-white/70 border border-amber-200 rounded-lg px-3 py-2">
                                    {t('suggested_recovery', {
                                        defaultValue: 'Roughly {{amount}} {{currency}} owed ({{mins}} minutes at this employee\'s own rate, from {{run}}). Check it before entering it — this is an estimate, not an instruction.',
                                        amount: aftermath.suggestedRecovery.amount,
                                        currency: aftermath.suggestedRecovery.currency,
                                        mins: aftermath.suggestedRecovery.minutes,
                                        run: aftermath.suggestedRecovery.runNumber,
                                    })}
                                </p>
                            )}
                        </div>
                    )}

                    {aftermath.evaluationWasFinalized && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-1">
                            <p className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                                {t('evaluation_already_finalized', { defaultValue: 'This month\'s evaluation is already finalized' })}
                            </p>
                            <p className="text-[11px] font-medium text-indigo-900/80 leading-relaxed">
                                {t('evaluation_finalized_explain', {
                                    defaultValue: 'The presence score was calculated from the old figures. Recompute presence scores on the Evaluations screen if it should reflect this.',
                                })}
                            </p>
                        </div>
                    )}

                    {/* The one consequence that does not self-heal: a formal record already issued
                        in the employee's name, possibly off the very lateness this just erased. */}
                    {!!aftermath.relatedCases.length && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-black text-rose-900 uppercase tracking-wider inline-flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {t('disciplinary_case_this_cycle', { defaultValue: 'An attendance disciplinary case was opened this cycle' })}
                            </p>
                            <ul className="space-y-1">
                                {aftermath.relatedCases.map(c => (
                                    <li key={c.id} className="text-[11px] font-bold text-rose-800 font-mono">
                                        {c.caseNumber} <span className="font-sans font-medium text-rose-600">· {c.stage}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[11px] font-medium text-rose-900/80 leading-relaxed">
                                {t('disciplinary_case_explain', {
                                    defaultValue: 'It may rest on the lateness this correction has just removed. Nothing has been changed on it — reviewing or withdrawing a disciplinary record is a decision for Personnel Relations, not something this screen should do.',
                                })}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full px-5 py-2.5 bg-[#511d29] text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#3a151d] transition-colors"
                    >
                        {t('done', { defaultValue: 'Done' })}
                    </button>
                </div>
            ) : (
            <div className="space-y-5">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-bold text-sm text-slate-800">
                                {row.employeeName} <span className="font-mono text-xs text-slate-500">{row.empCode}</span>
                            </p>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                <bdi>{format(parseISO(row.date), 'dd MMM yyyy')}</bdi>
                                {' · '}
                                {t('worked', { defaultValue: 'Worked' })}: {formatMinutesAsHM(row.totalWorkMins)}
                            </p>
                            <p dir="auto" className="text-[11px] font-bold text-amber-800 mt-1.5">
                                {punchAnomalyText(row.anomaly, t)}
                            </p>
                        </div>
                    </div>
                    {/* The scheduled day, and where it came from. A Ramadan day is not a 9-to-5, and
                        an officer approving a suggested time is entitled to see which it is. */}
                    <p className="text-[11px] font-medium text-amber-900/70 border-t border-amber-200 pt-2">
                        {t('scheduled_hours_are', { defaultValue: 'Scheduled that day' })}:{' '}
                        <span dir="ltr" className="font-mono font-bold">{row.scheduled.workStart}–{row.scheduled.workEnd}</span>
                        {' — '}{SOURCE_LABEL[row.scheduled.source]}
                    </p>
                </div>

                {!!row.anomaly.suggested.length && (
                    <button
                        onClick={applySuggestion}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-50 transition-colors"
                    >
                        <Wand2 className="w-3.5 h-3.5" />
                        {t('apply_suggested_fix', { defaultValue: 'Fill in the suggested fix' })}
                    </button>
                )}

                <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {t('punches', { defaultValue: 'Punches' })}
                    </p>
                    {punches.map(p => {
                        const d = drafts[p.id] || { state: null, time: null, remove: false };
                        const current = String(p.punchTime).slice(0, 5);
                        return (
                            <div
                                key={p.id}
                                className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border ${d.remove ? 'bg-rose-50 border-rose-200 opacity-70' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <input
                                    type="time"
                                    dir="ltr"
                                    value={d.time ?? current}
                                    disabled={!p.isManual || d.remove}
                                    onChange={e => setDraft(p.id, { time: e.target.value })}
                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                <select
                                    value={d.state ?? (p.punchState === 'Check In' ? 'Check In' : p.punchState === 'Check Out' ? 'Check Out' : '')}
                                    disabled={d.remove}
                                    onChange={e => setDraft(p.id, { state: e.target.value as 'Check In' | 'Check Out' })}
                                    className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                >
                                    {/* A punch sitting in a state we cannot write back (e.g. Overtime
                                        Out) shows it as an unselectable current value, so the row is
                                        honest about what is there rather than silently mislabelling it. */}
                                    {!STATES.includes(p.punchState as any) && (
                                        <option value="" disabled>{p.punchState}</option>
                                    )}
                                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>

                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${p.isManual ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {p.isManual
                                        ? t('manual', { defaultValue: 'manual' })
                                        : t('from_the_terminal', { defaultValue: 'from the terminal' })}
                                </span>

                                {p.isManual ? (
                                    <button
                                        onClick={() => setDraft(p.id, { remove: !d.remove })}
                                        className={`ms-auto p-1.5 rounded-lg transition-colors ${d.remove ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50'}`}
                                        title={t('delete', { defaultValue: 'Delete' })}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                ) : (
                                    <span className="ms-auto inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                        <Lock className="w-3 h-3" />
                                        {t('terminal_punch_locked', { defaultValue: 'Its time cannot be changed and it cannot be deleted — only its type.' })}
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {additions.map((a, i) => (
                        <div key={a.key} className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                            <input
                                type="time"
                                dir="ltr"
                                value={a.time}
                                onChange={e => setAdditions(list => list.map((x, j) => j === i ? { ...x, time: e.target.value } : x))}
                                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                            />
                            <select
                                value={a.state}
                                onChange={e => setAdditions(list => list.map((x, j) => j === i ? { ...x, state: e.target.value as 'Check In' | 'Check Out' } : x))}
                                className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                            >
                                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-700">
                                {t('new_punch', { defaultValue: 'new' })}
                            </span>
                            <button
                                onClick={() => setAdditions(list => list.filter((_, j) => j !== i))}
                                className="ms-auto p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={() => setAdditions(a => [...a, {
                            key: Date.now() + a.length,
                            // Prefilled from the day's real schedule, not a literal 9-to-5.
                            time: punches.some(p => p.punchState === 'Check In') ? row.scheduled.workEnd : row.scheduled.workStart,
                            state: punches.some(p => p.punchState === 'Check In') ? 'Check Out' : 'Check In',
                        }])}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-slate-300 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t('add_a_punch', { defaultValue: 'Add a punch' })}
                    </button>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                        {t('why_this_correction', { defaultValue: 'Why this correction' })} *
                    </label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={2}
                        placeholder={t('why_this_correction_hint', { defaultValue: 'e.g. Employee tapped check-in on the way out; confirmed with their manager.' })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#aa7a51]/20"
                    />
                    <p className="text-[10px] font-medium text-slate-400">
                        {t('correction_is_permanent_note', {
                            defaultValue: 'This is written to a permanent log with your name and cannot be edited or deleted — a mistake is fixed by recording another correction.',
                        })}
                    </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] font-bold text-slate-500">
                        {t('n_changes_pending', { defaultValue: '{{n}} changes', count: steps.length, n: steps.length })}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
                        >
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                        <button
                            onClick={save}
                            disabled={saving || !steps.length}
                            className="px-5 py-2.5 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? t('saving', { defaultValue: 'Saving…' }) : t('apply_correction', { defaultValue: 'Apply correction' })}
                        </button>
                    </div>
                </div>
            </div>
            )}
        </Modal>
    );
};

export default PunchCorrectionModal;
