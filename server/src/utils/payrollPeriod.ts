// The IPH financial month, per SOP IPH-HR-PRM-06: it runs from the 25th of one calendar month to
// the 24th of the next, and is LABELLED BY THE MONTH IT ENDS IN. So period '2026-09' covers
// 2026-08-25 → 2026-09-24 and is disbursed on 2026-09-30.
//
// Pure module: no Prisma, no I/O, no ambient clock reads except `today()`. Everything here is
// directly unit-testable.
//
// TIMEZONE, and this is a money bug if you get it wrong: every boundary is built as a LOCAL date
// and formatted locally by `toApiDate`. Never call `toISOString()` on one of these — for any
// timezone east of UTC that shifts the date back a day, so a run would silently query 08-24 → 09-23
// and drop a day of everyone's pay.

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidPeriod = (period: string): boolean => PERIOD_RE.test(period);

const parsePeriod = (period: string): { year: number; month: number } => {
    if (!isValidPeriod(period)) {
        throw new Error(`Invalid payroll period "${period}". Expected YYYY-MM.`);
    }
    const [y, m] = period.split('-');
    return { year: Number(y), month: Number(m) }; // month is 1-based here
};

/** The inclusive date range a period covers: 25th of the previous month → 24th of this one. */
export const financialMonthRange = (period: string): { start: Date; end: Date } => {
    const { year, month } = parsePeriod(period);
    // `new Date(y, monthIndex, d)` with monthIndex = month - 2 is the PREVIOUS month, and JS rolls
    // a negative index back into the prior year on its own (month=1 → index -1 → December of y-1).
    const start = new Date(year, month - 2, 25, 0, 0, 0, 0);
    const end = new Date(year, month - 1, 24, 23, 59, 59, 999);
    return { start, end };
};

/** Hard cut-off: the 27th of the labelling month at 17:00 local. Advisory — a banner, not a lock. */
export const cutoffFor = (period: string): Date => {
    const { year, month } = parsePeriod(period);
    return new Date(year, month - 1, 27, 17, 0, 0, 0);
};

/**
 * `YYYY-MM-DD` from a Date using its LOCAL calendar fields. This is what goes on the wire to the
 * attendance service (whose params are `start` / `end`, not `startDate` / `endDate`).
 */
export const toApiDate = (d: Date): string => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** The period a given date falls in: on/after the 25th it belongs to the NEXT month's payroll. */
export const periodForDate = (d: Date): string => {
    const shift = d.getDate() >= 25 ? 1 : 0;
    const anchor = new Date(d.getFullYear(), d.getMonth() + shift, 1);
    return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
};

export const currentPeriod = (today: Date = new Date()): string => periodForDate(today);

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** "September 2026" — used for the payslip's `PAYSLIP FOR THE MONTH OF ______ , 2026` blank. */
export const periodLabel = (period: string): string => {
    const { year, month } = parsePeriod(period);
    return `${MONTHS_EN[month - 1]} ${year}`;
};

export const periodLabelArabic = (period: string): string => {
    const { year, month } = parsePeriod(period);
    return `${MONTHS_AR[month - 1]} ${year}`;
};

/** Just the month name, for the payslip title blank (the template already prints the year). */
export const periodMonthName = (period: string): string => MONTHS_EN[parsePeriod(period).month - 1];
export const periodMonthNameArabic = (period: string): string => MONTHS_AR[parsePeriod(period).month - 1];

export const periodYear = (period: string): number => parsePeriod(period).year;

/** The period immediately before this one — used to reconcile a run against the prior month. */
export const previousPeriod = (period: string): string => {
    const { year, month } = parsePeriod(period);
    const anchor = new Date(year, month - 2, 1);
    return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
};

/** The period after this one. `2026-12` -> `2027-01`. */
export const nextPeriod = (period: string): string => {
    const { year, month } = parsePeriod(period);
    const d = new Date(year, month, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
