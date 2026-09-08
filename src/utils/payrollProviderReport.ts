// The per-service-provider payroll report, on the company's own `public/payroll.xlsm` layout.
//
// Read off that file rather than invented: title in C1 carrying the period range, 45 headers in
// B2..AT2, data from B3, column A left empty as the sheet's own left margin. It is the shorter
// sibling of the 62-column MASTER DATA sheet Finance reviews — no factor amounts, no evaluation
// scores, no leave balances — which is exactly why it is the one that goes out to providers.
//
// One workbook per provider, never one workbook with a sheet each. This file leaves the company,
// and a forgotten tab is how one provider ends up reading another's salaries.
//
// Employees whose line could not be paid are NOT dropped. They are named under the table, because a
// provider spotting one of their staff missing from a payment is worse than being told plainly.
import * as XLSX from 'xlsx-js-style';
import type { PayrollLine, PayrollRun } from '../services/payrollRunService';
import { xlsxBlobWithLogo, TEMPLATE_LOGO_ANCHOR } from './xlsxLogo';

/** Exactly the strings in row 2 of public/payroll.xlsm, in its order. */
const HEADERS = [
    'Employee ID',
    'Employee Action ( if there is)',
    'Employee Name in Arabic',
    'Employee Name',
    'Passport Number',
    'Email Address',
    'Nationality',
    'Service Provider Fee',
    'Division',
    'Department',
    'Job Position',
    'Skill Factor',
    'Position Factor',
    'Job Category',
    'Job Grade',
    'Hourly Rate',
    'Currency',
    'Work Location',
    'Site Factor',
    'Working Hours',
    'Overtime hours worked',
    'Total Number of hours worked',
    'Paid Annual Hours',
    'Paid Emergency Leave Hours',
    'Unpaid leave hours',
    'Total Paid Absence in Hours',
    'Total Paid Absences Amount',
    'Bonus - General',
    'Percentage for Performance Bonus',
    'Previous miscalculation for underpayment addition',
    'Reason for compensation',
    'Total Additional compensations',
    'Salary Advance Deduction (Cash)',
    'Remaining Advanced Deduction',
    'Ticket cost deduction',
    'Penalty deduction',
    'Health insurance cost overruns',
    'Previous miscalculation for overpayment - deduction',
    'Reason For Overpayment Miscalculation',
    'Total Deductions',
    'Remaining Advance Salary Deduction',
    'Net Salary',
    'Full Salary',
    'Fee for SP',
    'Total to be paid to SP',
];

/** Column A is the sheet's own empty left margin; the table starts at B. */
const FIRST_COL = 1;
const HEADER_ROW = 1;   // row 2, 0-based
const FIRST_DATA_ROW = 2;

const ACCOUNTING = '_-* #,##0.00_-;\\-* #,##0.00_-;_-* "-"??_-;_-@_-';
const MONEY = '#,##0.00';
const HOURS = '0.0';
const PCT = '0%';
const DEC2 = '0.00';

/**
 * Number formats taken from the template's own row 3, so the file a provider opens is formatted the
 * way the company's workbook already formats it. Indexed against HEADERS.
 */
const FORMATS: Record<number, string> = {
    7: PCT,                                     // Service Provider Fee
    15: MONEY,                                  // Hourly Rate
    19: HOURS, 20: HOURS, 21: HOURS,            // Working / Overtime / Total hours
    22: HOURS, 23: HOURS, 24: HOURS, 25: HOURS, // leave hours
    26: MONEY,                                  // Total Paid Absences Amount
    27: MONEY,                                  // Bonus - General
    28: PCT,                                    // Percentage for Performance Bonus
    29: DEC2, 31: DEC2,                         // underpayment / total additional
    32: MONEY, 33: MONEY, 34: MONEY, 35: MONEY, 36: MONEY, 37: DEC2,
    39: ACCOUNTING, 40: ACCOUNTING, 41: ACCOUNTING, 42: ACCOUNTING, 43: ACCOUNTING, 44: ACCOUNTING,
};

/** Header colours carried over from the MASTER DATA sheet, so the same meaning reads the same. */
const TEAL = '035547';
const DKRED = '8B0101';
const GREY = '808080';
const RED = 'CD2605';

const HEADER_COLOUR: string[] = HEADERS.map((_, i) => {
    if (i >= 4 && i <= 6) return DKRED;   // passport, e-mail, nationality
    if (i >= 27 && i <= 31) return GREY;  // bonuses and additional compensation
    if (i >= 32 && i <= 40) return RED;   // deductions
    if (i >= 43) return DKRED;            // service-provider payables
    return TEAL;
});

/** Column widths from the template, keyed by its own letters. Index 0 is column A. */
const COL_WIDTHS = [
    13, 22, 21, 45, 63, 27, 46, 25, 21, 43, 48, 55, 26, 32, 32, 32, 24, 20, 24, 21, 26, 23, 25,
    22, 22, 22, 22, 22, 23, 24, 28, 28, 32, 23, 42, 51, 23, 24, 22, 22, 25, 28, 31, 34, 39, 25,
];

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The template's own title phrasing: "IPH Payroll Master Data (25th of July - 24th of August 2026)".
 * The 25th and the 24th are fixed — that is what a financial month is here.
 */
const titleFor = (period: string, providerName: string): string => {
    const [y, m] = period.split('-').map(Number);
    const startMonth = MONTHS[(m + 10) % 12];
    const endMonth = MONTHS[m - 1];
    return `IPH Payroll Master Data (25th of ${startMonth} - 24th of ${endMonth} ${y}) — ${providerName}`;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const sumItems = (line: PayrollLine, kind: 'EARNING' | 'DEDUCTION', category: string): number =>
    (line.items || []).filter(i => i.kind === kind && i.category === category).reduce((s, i) => s + i.amount, 0);

const reasonText = (line: PayrollLine, category: string): string =>
    (line.items || []).filter(i => i.category === category).map(i => i.correctionNote || i.label).filter(Boolean).join('; ');

export interface ProviderGroup {
    providerId: string;
    providerName: string;
    currency: string;
    percentage: number | null;
    payable: PayrollLine[];
    /** Lines that exist but carry no money — named in the file rather than dropped from it. */
    notPayable: PayrollLine[];
    netTotal: number;
    feeTotal: number;
    payableTotal: number;
}

/**
 * Splits a run's lines into one group per provider.
 *
 * Keyed on serviceProviderId so a provider renamed mid-period does not split in two, and per
 * currency as well — the report totals one sum and there is no exchange rate in this system.
 */
export const groupLinesByProvider = (lines: PayrollLine[]): ProviderGroup[] => {
    const groups = new Map<string, ProviderGroup>();

    for (const l of lines) {
        if (!l.serviceProviderId) continue;
        if (l.status === 'EXCLUDED') continue; // a decision not to pay; not the provider's business
        const key = `${l.serviceProviderId}|${l.currency}`;
        let g = groups.get(key);
        if (!g) {
            g = {
                providerId: l.serviceProviderId,
                providerName: l.serviceProviderName || '—',
                currency: l.currency,
                percentage: l.serviceProviderPercentage,
                payable: [], notPayable: [],
                netTotal: 0, feeTotal: 0, payableTotal: 0,
            };
            groups.set(key, g);
        }
        if (l.status === 'OK') {
            g.payable.push(l);
            g.netTotal += l.netSalary;
            g.feeTotal += l.serviceProviderFee;
            g.payableTotal += l.employerTotalCost;
        } else {
            g.notPayable.push(l);
        }
    }

    return [...groups.values()]
        .map(g => ({ ...g, netTotal: round2(g.netTotal), feeTotal: round2(g.feeTotal), payableTotal: round2(g.payableTotal) }))
        .sort((a, b) => a.providerName.localeCompare(b.providerName));
};

/**
 * One employee's row, in the template's column order.
 *
 * Blank, not zero, wherever the system genuinely does not hold the figure. An explicit 0 asserts a
 * measurement nobody took — and on a document a provider invoices against, that matters.
 */
const buildRow = (l: PayrollLine): (string | number)[] => {
    // Position and skill are mutually exclusive — only the larger is paid. The loser is exported as
    // 0 so the sheet's own "amount = basic x factor" still holds if checked by hand.
    const pos = l.positionFactor ?? 1;
    const skill = l.skillFactor ?? 1;
    const underpayment = sumItems(l, 'EARNING', 'PREVIOUS_UNDERPAYMENT');

    return [
        l.staffId || '',
        l.blockReasons.includes('JOINED_MID_PERIOD') ? 'New hire this period'
            : l.blockReasons.includes('FINAL_SETTLEMENT_PENDING') ? 'Leaving this period' : '',
        l.fullNameArabic || '',
        l.fullName || '',
        l.passportNumber || '',
        l.email || '',
        l.nationality || '',
        (l.serviceProviderPercentage ?? 0) / 100,
        l.divisionName || '',
        l.departmentName || '',
        l.positionTitle || '',
        skill > pos ? round4(skill - 1) : 0,
        pos >= skill ? round4(pos - 1) : 0,
        l.jobCategory || '',
        l.jobGrade || '',
        l.hourlyRate,
        l.currency,
        l.workLocation || '',
        round4((l.siteFactor ?? 1) - 1),
        l.basicHours,
        l.overtimeHours,
        l.totalWorkingHours,
        '', // Paid Annual Hours — the attendance service returns one combined paid-leave figure
        '', // Paid Emergency Leave Hours — and the two split fields it does return are swapped
        l.unpaidHours,
        l.paidAbsenceHours,
        l.paidAbsenceAmount,
        '', // Bonus - General — every bonus here originates from a completed reward case
        (l.bonusPercent ?? 0) / 100,
        underpayment,
        reasonText(l, 'PREVIOUS_UNDERPAYMENT'),
        round2(l.bonusAmount + underpayment),
        sumItems(l, 'DEDUCTION', 'CASH_ADVANCE'),
        l.remainingAdvanceBalance,
        sumItems(l, 'DEDUCTION', 'TICKET_COST'),
        sumItems(l, 'DEDUCTION', 'PENALTY'),
        sumItems(l, 'DEDUCTION', 'HEALTH_INSURANCE_OVERRUN'),
        sumItems(l, 'DEDUCTION', 'PREVIOUS_OVERPAYMENT'),
        reasonText(l, 'PREVIOUS_OVERPAYMENT'),
        // Deliberately excludes the two "Remaining Advance" columns either side of it: those are the
        // outstanding balance shown for information. Summing one in deducts the same money twice,
        // which is the defect the original workbook had.
        l.deductionsTotal,
        l.remainingAdvanceBalance,
        l.netSalary,
        l.totalEarnings,
        l.serviceProviderFee,
        l.employerTotalCost,
    ];
};

// --- styles ---------------------------------------------------------------------------------
const border = (rgb: string) => ({
    top: { style: 'thin', color: { rgb } }, bottom: { style: 'thin', color: { rgb } },
    left: { style: 'thin', color: { rgb } }, right: { style: 'thin', color: { rgb } },
});

const titleStyle: any = {
    font: { name: 'Montserrat', sz: 16, bold: true, color: { rgb: '1F2937' } },
    alignment: { horizontal: 'left', vertical: 'center' },
};
const headerStyle = (rgb: string): any => ({
    font: { name: 'Montserrat', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: border('FFFFFF'),
});
const cellStyle = (zebra: boolean, format?: string): any => ({
    font: { name: 'Segoe UI', sz: 9, color: { rgb: '1F2937' } },
    fill: { fgColor: { rgb: zebra ? 'F6F7F9' : 'FFFFFF' } },
    alignment: { horizontal: format ? 'right' : 'left', vertical: 'center' },
    border: border('E5E7EB'),
    ...(format ? { numFmt: format } : {}),
});
const totalStyle = (format?: string): any => ({
    font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '511D29' } },
    fill: { fgColor: { rgb: 'F1ECE6' } },
    alignment: { horizontal: format ? 'right' : 'left', vertical: 'center' },
    border: border('D6CFC7'),
    ...(format ? { numFmt: format } : {}),
});
const noteStyle: any = {
    font: { name: 'Segoe UI', sz: 9, color: { rgb: '8B0101' } },
    alignment: { vertical: 'center', wrapText: true },
};

/** Columns that get a summed total under the table. Text and per-employee rates do not. */
const TOTALLED = new Set([19, 20, 21, 24, 25, 26, 29, 31, 32, 33, 34, 35, 36, 37, 39, 40, 41, 42, 43, 44]);

// Async because the letterhead is fetched once and then injected into the finished package —
// xlsx-js-style cannot write images, so it is added afterwards. See utils/xlsxLogo.ts.
export const buildProviderReportWorkbook = async (run: PayrollRun, group: ProviderGroup): Promise<Blob> => {
    const nCols = HEADERS.length;
    const set = (r: number, c: number, cell: XLSX.CellObject) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; };
    const ws: XLSX.WorkSheet = {};

    // Title in C1 and the logo in B1, exactly where the template keeps them. Row 1 is left tall
    // enough for the mark; the title cell carries no fill so the letterhead reads as a header,
    // not as a coloured band with a picture dropped on it.
    set(0, 2, { t: 's', v: titleFor(run.period, group.providerName), s: titleStyle });

    HEADERS.forEach((h, i) => {
        set(HEADER_ROW, FIRST_COL + i, { t: 's', v: h, s: headerStyle(HEADER_COLOUR[i]) });
    });

    group.payable.forEach((line, ri) => {
        buildRow(line).forEach((v, i) => {
            const fmt = FORMATS[i];
            const numeric = typeof v === 'number';
            set(FIRST_DATA_ROW + ri, FIRST_COL + i, {
                t: numeric ? 'n' : 's',
                v: v as any,
                s: cellStyle(ri % 2 === 1, numeric ? fmt : undefined),
            });
        });
    });

    const totalRow = FIRST_DATA_ROW + group.payable.length;
    const rows = group.payable.map(buildRow);
    for (let i = 0; i < nCols; i++) {
        const isTotal = TOTALLED.has(i);
        const value = isTotal
            ? round2(rows.reduce((s, r) => s + (typeof r[i] === 'number' ? (r[i] as number) : 0), 0))
            : (i === 3 ? 'TOTAL' : '');
        set(totalRow, FIRST_COL + i, {
            t: isTotal ? 'n' : 's',
            v: value as any,
            s: totalStyle(isTotal ? FORMATS[i] : undefined),
        });
    }

    let lastRow = totalRow;
    if (group.notPayable.length > 0) {
        lastRow = totalRow + 2;
        set(lastRow, FIRST_COL, {
            t: 's',
            v: `Not included this period (${group.notPayable.length}): `
                + group.notPayable.map(l => `${l.fullName || '—'} (${l.staffId || 'no ID'})`).join(', ')
                + '. Their records are still under review and will be settled in a later period.',
            s: noteStyle,
        });
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: FIRST_COL + nCols - 1 } });
    ws['!cols'] = COL_WIDTHS.map(wch => ({ wch }));
    // Row 1 holds the letterhead: 128pt is the logo's height plus its inset.
    ws['!rows'] = [{ hpt: 128 }, { hpt: 42 }];
    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
            s: { r: HEADER_ROW, c: FIRST_COL },
            e: { r: totalRow - 1, c: FIRST_COL + nCols - 1 },
        }),
    };

    const wb = XLSX.utils.book_new();
    // The template's own sheet name, kept so the file is recognisable to whoever receives it.
    XLSX.utils.book_append_sheet(wb, ws, 'MASTER DATA');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return xlsxBlobWithLogo(buffer, TEMPLATE_LOGO_ANCHOR);
};

export const providerReportFilename = (run: PayrollRun, group: ProviderGroup): string => {
    const safe = group.providerName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `Payroll_${safe}_${group.currency}_${run.period}.xlsx`;
};

/** Kept for the run detail card, which shows the covered dates next to each provider. */
export const providerReportPeriodLabel = (run: PayrollRun) =>
    `${fmtDate(run.periodStart)} - ${fmtDate(run.periodEnd)}`;
