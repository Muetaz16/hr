// Days whose punches did not come out as a working day, and what would repair them.
//
// The attendance terminal records a punch's TYPE as well as its time, and the type is wrong often
// enough to matter: measured over 1003 employee-days, 39 days carried punches yet scored
// totalWorkMins = 0. Those are paid hours — payrollEngine multiplies workMins by the hourly rate and
// every factor allowance is a percentage of the result — so a mistyped tap silently costs somebody
// a day's wage.
//
// It is worse than lost pay. A punch made on the way OUT but recorded as a check-in becomes the
// day's FIRST punch, so the day also reads as a very late arrival: one real day showed a single
// 15:16 punch scored as 376 minutes late. That feeds totalDeduction -> the presence score, and the
// tardiness signal that opens disciplinary cases. One tap, three wrong answers.
//
// Only three punch states occur in the live data — "Check In", "Check Out", "Overtime Out" — but
// nothing here assumes that list is closed; an unknown state falls through to the zero-work safety
// net rather than being ignored.
//
// This file is PURE: no I/O, no Prisma, no fetch. It is called once at the proxy boundary
// (attendanceIntegrationController) so the verdict travels with the payload and every reader — the
// HR screen, the employee's own page, the correction queue — sees the same answer. That is
// deliberate: server/ and src/ cannot share code, and disciplinaryAttendance.ts is already a
// hand-port of attendanceDayStatus.ts that has drifted. A third copy would drift too.

// The one recognized weekly rest day — JS Date#getDay(): 0=Sun..6=Sat. Mirrors the same constant
// in disciplinaryAttendance.ts, presenceScoring.ts and the client's attendanceDayStatus.ts.
export const WEEKLY_OFF_DAYS = [5]; // Friday

export const PUNCH_IN = 'Check In';
export const PUNCH_OUT = 'Check Out';

/** One raw punch, as the attendance service reports it on reportData[].punches. */
export interface PunchRef {
    id: number;
    date: string;
    punchTime: string;      // "HH:mm"
    punchState: string;     // "Check In" | "Check Out" | "Overtime Out" | ...
    isManual: boolean;      // device punches: the state may be corrected, the time may not
}

export type PunchAnomalyKind =
    | 'UNPAIRED_PUNCH'          // one side of the day was never recorded
    | 'SAME_STATE_ONLY'         // every punch is the same type, so nothing can pair
    | 'DOUBLE_TAP'              // two punches in the same minute with opposite types
    | 'OVERTIME_OUT_UNCLOSED'   // left on the Overtime Out key; no check-out closed the session
    | 'ZERO_WORK_WITH_PUNCHES'  // catch-all: punches exist, the day still paid nothing
    | 'SUSPICIOUSLY_SHORT';     // advisory only

/**
 * A single repair.
 *
 * RETYPE changes an existing punch's type — permitted on device punches, whose TIME stays
 * protected. ADD creates a new manual punch. Deletion is deliberately never suggested: device
 * punches cannot be deleted at all, and every case measured so far is repairable by retyping.
 */
export interface PunchRepairStep {
    action: 'RETYPE' | 'ADD';
    punchId?: number;                                   // RETYPE only
    atTime?: string;                                    // ADD only, "HH:mm"
    toState: typeof PUNCH_IN | typeof PUNCH_OUT;
    why: string;
}

/**
 * The raw facts behind a verdict, so the reader's own language can be used to state it.
 *
 * `detail` below is English prose and is NOT for display — sending a finished sentence from the
 * server means it arrives in one language and lands in a page written in another. That already
 * happened once here in the opposite direction, with the attendance service's Arabic overnight
 * note printed inside an English table. The UI composes its own sentence from these fields.
 */
export interface PunchAnomalyFacts {
    /** How many punches the day actually holds. */
    count: number;
    /** Their times, in order — "09:35, 21:35". */
    times: string;
    /** The single state involved, when the anomaly is about one state (e.g. all Check In). */
    state?: string;
    /** A single significant time, e.g. the lone punch or the duplicated minute. */
    at?: string;
    /** The check-in time, where the shape has one. */
    inAt?: string;
    /** Minutes credited, and the scheduled length, for the short-day advisory. */
    workedMins?: number;
    scheduledMins?: number;
}

export interface DayPunchAnomaly {
    kind: PunchAnomalyKind;
    /** blocking = a worked day paid nothing. advisory = worth a look, not obviously wrong. */
    severity: 'blocking' | 'advisory';
    /** English prose, for logs and debugging. The UI builds its own from `facts`. */
    detail: string;
    facts: PunchAnomalyFacts;
    /** Lateness this anomaly is inventing — often the larger harm, through the presence score. */
    phantomLateMins: number;
    suggested: PunchRepairStep[];
}

const toMins = (hhmm: string): number => {
    const m = /^(\d{2}):(\d{2})/.exec(hhmm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const dayKey = (iso: string): string => (iso || '').slice(0, 10);

export interface AnomalyContext {
    /** Today as yyyy-MM-dd. A day still in progress is never an anomaly. */
    todayKey: string;
    /** This employee's scheduled hours for THIS date — shift > multiplier > default. Never a literal 9-to-5. */
    workStart?: string;   // "HH:mm"
    workEnd?: string;     // "HH:mm"
    /** True when a leave record covers the day. The caller owns that lookup. */
    onLeave?: boolean;
    /** Employment window, so days outside it are never flagged. */
    joinKey?: string | null;
    separationKey?: string | null;
}

/** The day shape this detector needs. Deliberately loose — it is fed raw reportData rows. */
export interface AnomalyDayInput {
    date: string;
    punches?: PunchRef[] | null;
    totalWorkMins?: number;
    lateMins?: number;
    otMins?: number;
    isHoliday?: boolean;
    isOutWork?: boolean;
    isSuspended?: boolean;
    isOvernightStitched?: boolean;
}

/**
 * The verdict for one day, or null when there is nothing to answer for.
 *
 * Suppressions come first and are not negotiable: a queue that cries wolf stops being read, and
 * every one of these is a day where the punch columns are meaningless by design.
 */
export function detectDayAnomaly(day: AnomalyDayInput, ctx: AnomalyContext): DayPunchAnomaly | null {
    const key = dayKey(day.date);

    if (day.isSuspended || day.isHoliday || day.isOutWork || ctx.onLeave) return null;
    // An overnight shift legitimately looks broken — its check-out belongs to the next date, and the
    // attendance service has already reconciled it.
    if (day.isOvernightStitched) return null;
    // The day IN PROGRESS is exempt: an employee who has checked in and not yet out is not a
    // broken day, they are still at work. Only that one day — a punch dated in the FUTURE is
    // itself bad data (a terminal clock adrift, or a hand-entered mistake) and must surface
    // rather than be silently dropped, which is what `>=` used to do.
    if (key === ctx.todayKey) return null;
    if (ctx.joinKey && key < ctx.joinKey) return null;
    if (ctx.separationKey && key > ctx.separationKey) return null;

    // Only the punches belonging to this date, earliest first. A stitched day carries the NEXT
    // day's check-out in punches, and counting it here would misread the shape.
    const punches = (day.punches || [])
        .filter(p => dayKey(p.date) === key)
        .slice()
        .sort((a, b) => toMins(a.punchTime) - toMins(b.punchTime));
    // No punches at all is absence — a different problem with a different owner.
    if (punches.length === 0) return null;

    // The weekly rest day has no scheduled start, so nothing about it can be early or late — the
    // service charges it against the ordinary work-start anyway. Local midnight, never a bare date
    // string: that parses as UTC and can resolve to the previous day.
    const isWeeklyOff = WEEKLY_OFF_DAYS.includes(new Date(`${key}T00:00:00`).getDay());

    // Minutes CREDITED, from either bucket. The attendance service now books work done on a rest
    // day or a public holiday entirely as overtime — a real holiday came back totalWorkMins=0 with
    // otMins=301 — so testing totalWorkMins alone would call a fully-paid overtime day "punches
    // exist but nothing was credited" and fill the queue with days that are perfectly fine.
    const worked = (day.totalWorkMins ?? 0) + (day.otMins ?? 0);
    // Lateness only counts as phantom when the day paid nothing; on a paid day it is probably real.
    // On the rest day it is never real, but it is also not this rule's business to report — the
    // presence and disciplinary paths net it out at their own source, and repeating it here would
    // have the queue offer to "fix" a number that no longer counts anywhere.
    const phantomLateMins = (worked === 0 && !isWeeklyOff) ? (day.lateMins ?? 0) : 0;
    const ins = punches.filter(p => p.punchState === PUNCH_IN);
    const outs = punches.filter(p => p.punchState === PUNCH_OUT);
    const times = punches.map(p => p.punchTime).join(', ');

    const baseFacts: PunchAnomalyFacts = { count: punches.length, times };
    const blocking = (
        kind: PunchAnomalyKind, detail: string, suggested: PunchRepairStep[],
        facts: Partial<PunchAnomalyFacts> = {},
    ): DayPunchAnomaly => ({
        kind, severity: 'blocking', detail, phantomLateMins, suggested,
        facts: { ...baseFacts, ...facts },
    });

    // Every punch the same type — nothing can pair with anything.
    //
    // Checked BEFORE the zero-work gate, and that placement was earned: a probe day holding two
    // Check In punches came back credited with 120 minutes, not zero, so the gate would have let it
    // through — and 120 was also exactly 25% of the scheduled day, landing on the wrong side of the
    // short-day advisory's strict `<`. Two punches of one type cannot pair, whatever minutes the
    // service decided to credit; that is a structural fact about the day, not a judgement about its
    // total. Note this makes phantomLateMins zero for such a day, which is correct — lateness on a
    // day that did credit minutes is not obviously invented.
    if (punches.length > 1 && new Set(punches.map(p => p.punchState)).size === 1) {
        const all = punches[0].punchState;
        const fix: PunchRepairStep = all === PUNCH_IN
            ? { action: 'RETYPE', punchId: punches[punches.length - 1].id, toState: PUNCH_OUT, why: 'the last punch of the day is the departure' }
            : { action: 'RETYPE', punchId: punches[0].id, toState: PUNCH_IN, why: 'the first punch of the day is the arrival' };
        return blocking(
            'SAME_STATE_ONLY',
            punches.length + ' punches (' + times + '), all recorded as "' + all + '" — nothing could pair',
            [fix],
            { state: all },
        );
    }

    if (worked === 0) {
        // Left on the Overtime Out key. That state never closes a session, so a full day pays zero.
        const others = punches.filter(p => p.punchState !== PUNCH_IN && p.punchState !== PUNCH_OUT);
        if (ins.length > 0 && outs.length === 0 && others.length > 0) {
            const last = others[others.length - 1];
            return blocking(
                'OVERTIME_OUT_UNCLOSED',
                'checked in ' + ins[0].punchTime + ', then "' + last.punchState + '" at ' + last.punchTime
                    + ' — no check-out, so nothing paired',
                [{ action: 'RETYPE', punchId: last.id, toState: PUNCH_OUT, why: 'close the day with a real check-out' }],
                { state: last.punchState, at: last.punchTime, inAt: ins[0].punchTime },
            );
        }

        // One physical press registering twice in the same minute, as both an in and an out. The
        // zero-length pair consumes the real check-out's partner and the whole day collapses.
        const twin = punches.find((p, i) => {
            const next = punches[i + 1];
            return !!next && p.punchTime === next.punchTime && p.punchState !== next.punchState;
        });
        if (twin && punches.length > 2) {
            const duplicateOut = punches.find(p => p.punchTime === twin.punchTime && p.punchState === PUNCH_OUT);
            if (duplicateOut) {
                return blocking(
                    'DOUBLE_TAP',
                    'two punches at ' + twin.punchTime + ', one in and one out — a double tap that swallowed the real pairing',
                    [{
                        action: 'RETYPE', punchId: duplicateOut.id, toState: PUNCH_IN,
                        why: 'make the duplicate harmless so the real check-out pairs with the arrival',
                    }],
                    { at: twin.punchTime },
                );
            }
        }

        // A single punch: the other half of the day was never recorded at all.
        if (punches.length === 1) {
            const only = punches[0];
            const isIn = only.punchState === PUNCH_IN;
            const at = isIn ? ctx.workEnd : ctx.workStart;
            const step: PunchRepairStep = at
                ? { action: 'ADD', atTime: at, toState: isIn ? PUNCH_OUT : PUNCH_IN, why: isIn ? 'add the missing departure' : 'add the missing arrival' }
                : { action: 'RETYPE', punchId: only.id, toState: isIn ? PUNCH_OUT : PUNCH_IN, why: 'no scheduled hours known, so no time to place a new punch at' };
            return blocking(
                'UNPAIRED_PUNCH', 'one punch only — ' + only.punchTime + ' "' + only.punchState + '"',
                [step], { state: only.punchState, at: only.punchTime },
            );
        }

        // A shape we have not seen before. It still paid nothing, so it still belongs in the queue.
        return blocking(
            'ZERO_WORK_WITH_PUNCHES',
            punches.length + ' punches (' + times + ') but no working hours were credited',
            [],
        );
    }

    // Paid something, but far less than the day is scheduled for. Advisory, because a short day is
    // often legitimate — and this is the only rule that can catch a mistyped punch which DID pair
    // and produced hours that are wrong but not zero.
    //
    // Never on the rest day: an hour of voluntary Friday overtime is not a short day, it is an
    // hour of overtime, and measuring it against a weekday schedule it never had would flag every
    // one of them.
    if (ctx.workStart && ctx.workEnd && !isWeeklyOff) {
        const scheduled = toMins(ctx.workEnd) - toMins(ctx.workStart);
        if (scheduled > 0 && worked < scheduled * 0.25) {
            return {
                kind: 'SUSPICIOUSLY_SHORT',
                severity: 'advisory',
                phantomLateMins: 0,
                detail: 'only ' + worked + ' minutes credited against a ' + scheduled + '-minute day (' + times + ')',
                suggested: [],
                facts: { count: punches.length, times, workedMins: worked, scheduledMins: scheduled },
            };
        }
    }

    return null;
}

/** A leave row as the monthly report carries it, in `empLeaves`. */
interface ReportLeave { startDate?: string; endDate?: string | null }

/**
 * Annotate every day of a monthly report in place and hand it back.
 *
 * Called at the proxy boundary so the verdict travels with the payload — the HR screen, the
 * employee's own page and the correction queue all read the same `day.anomaly` instead of each
 * deriving its own.
 *
 * `workStart`/`workEnd` are resolved ONCE for the whole report rather than per day. Resolving them
 * per day is three HTTP calls per date (shift -> multiplier -> system default), which for a 30-day
 * report is ninety calls against a service documented as failing under concurrency. The two places
 * the schedule is used here tolerate that: it only sets the suggested time for an ADD, and the
 * threshold for the advisory short-day rule. The correction screen resolves the exact schedule for
 * the single date it is about to act on, where precision actually matters.
 */
export function annotateReportDays<T extends { reportData?: AnomalyDayInput[] | null; empLeaves?: ReportLeave[] | null }>(
    report: T,
    ctx: Omit<AnomalyContext, 'onLeave'> & {
        /**
         * Optional per-day schedule, overriding `workStart`/`workEnd` for that date only.
         *
         * A single schedule for a whole report is wrong the moment the range crosses a date-ranged
         * multiplier factor — Ramadan hours are 10:00-16:00 while the rest of the month is
         * 09:00-17:00, so a suggested check-out would be an hour past the end of the working day.
         * The cross-employee scan passes this because it holds every tier in memory already and a
         * per-day lookup there costs nothing; the two report controllers do not, because for them
         * it would mean three HTTP calls per date.
         */
        scheduleFor?: (dayKey: string) => { workStart?: string; workEnd?: string };
    },
): T {
    const days = report?.reportData;
    if (!Array.isArray(days)) return report;

    const leaves = report.empLeaves || [];
    const coveredByLeave = (key: string): boolean => leaves.some(l => {
        const from = dayKey(String(l.startDate || ''));
        const to = dayKey(String(l.endDate || l.startDate || ''));
        return !!from && key >= from && key <= (to || from);
    });

    for (const day of days) {
        const key = dayKey(day.date);
        const perDay = ctx.scheduleFor?.(key);
        const anomaly = detectDayAnomaly(day, {
            ...ctx,
            ...(perDay ? { workStart: perDay.workStart, workEnd: perDay.workEnd } : {}),
            onLeave: coveredByLeave(key),
        });
        // Written even when null, so a consumer can tell "checked, nothing wrong" from "never checked".
        (day as AnomalyDayInput & { anomaly: DayPunchAnomaly | null }).anomaly = anomaly;
    }
    return report;
}
