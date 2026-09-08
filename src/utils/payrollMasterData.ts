// The MASTER DATA review workbook — one row per employee per period, 62 columns, in the exact
// order and wording of the spreadsheet Internal Audit and the Finance Division already review.
//
// Why the sheet is reproduced verbatim rather than improved: it is the document two other
// departments sign off against. A column renamed or moved for elegance costs them a re-learn and
// costs us their trust in the numbers. Where the original sheet is arithmetically wrong, the fix is
// recorded on the Legend sheet instead of silently changing a column's meaning.
//
// Built on the client because that is where the xlsx dependency lives; the server has none.
import * as XLSX from 'xlsx-js-style';
import type { PayrollLine, PayrollRun } from '../services/payrollRunService';
import { xlsxBlobWithLogo, TEMPLATE_LOGO_ANCHOR } from './xlsxLogo';

// --- header groups, straight from the source workbook's own header colours ------------------
const TEAL = '035547';   // core payroll / general
const DKRED = '8B0101';  // identity & contract documents / service-provider payables
const PURPLE = '7030A0'; // Eid leave
const GREY = '808080';   // bonuses & additional compensation
const RED = 'CD2605';    // deductions
const SLATE = '334155';  // the two diagnostic columns this system adds

/** [firstIndex, lastIndex] inclusive, 0-based, matching the original A..BJ lettering. */
const GROUPS: [number, number, string][] = [
    [0, 3, TEAL],     // A–D   Employee ID .. Employee Name
    [4, 7, DKRED],    // E–H   Passport .. Contract End Date
    [8, 30, TEAL],    // I–AE  Contract .. Site Factor Amount
    [31, 32, PURPLE], // AF–AG Eid leave
    [33, 42, TEAL],   // AH–AQ Paid absences and remaining balances
    [43, 48, GREY],   // AR–AW Bonuses
    [49, 57, RED],    // AX–BF Deductions
    [58, 59, TEAL],   // BG–BH Net / Full salary
    [60, 61, DKRED],  // BI–BJ Service-provider payables
    [62, 63, SLATE],  // BK–BL added here: why a row is worth zero
];

export const MASTER_DATA_HEADERS = [
    'Employee ID',
    'Employee Action ( if there is)',
    'Employee Name in Arabic',
    'Employee Name',
    'Passport Number',
    'Email Address',
    'Nationality',
    'Contract End Date',
    'Contract',
    'Service Provider Fee',
    'Division',
    'Department',
    'Job Position',
    'Language Factor',
    'Skill Factor',
    'Position Factor',
    'Job Category',
    'Job Grade',
    'Hourly Rate',
    'Currency',
    'Salary Structure',
    'Work Location',
    'Site Factor',
    'Working Hours',
    'Overtime hours worked',
    'Total Number of hours worked',
    'Basic Salary',
    'Position Factor Amount',
    'Skill Factor Amount',
    'Language Factor Amount',
    'Site Factor Amount',
    'Eid Leave Hours',
    'Eid Leave Amount',
    'Paid Annual Hours',
    'PA Amount',
    'Paid Emergency Leave Hours',
    'PE Amount',
    'Unpaid leave hours',
    'Total Paid Absence in Hours',
    'Total Paid Absences Amount',
    'Remaining Annual Paid Leave',
    'Remaining Annual Unpaid Leave',
    'Remaining Emergency Paid Leave',
    'Bonus - General',
    'Percentage for Performance Bonus',
    'Exceptional performance bonus',
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
    'Line Status',
    'Blocking Reasons',
];

const MONEY = '#,##0.00';
const HOURS = '0.0';
const FACTOR = '0.00';
const PCT = '0%';

/** Per-column number format; anything absent is left as text/general. */
const FORMATS: Record<number, string> = {
    9: PCT, 13: FACTOR, 14: FACTOR, 15: FACTOR, 18: MONEY, 22: FACTOR,
    23: HOURS, 24: HOURS, 25: HOURS,
    26: MONEY, 27: MONEY, 28: MONEY, 29: MONEY, 30: MONEY,
    31: HOURS, 32: MONEY, 33: HOURS, 34: MONEY, 35: HOURS, 36: MONEY,
    37: HOURS, 38: HOURS, 39: MONEY,
    40: HOURS, 41: HOURS, 42: HOURS,
    43: MONEY, 44: PCT, 45: MONEY, 46: MONEY, 48: MONEY,
    49: MONEY, 50: MONEY, 51: MONEY, 52: MONEY, 53: MONEY, 54: MONEY, 56: MONEY, 57: MONEY,
    58: MONEY, 59: MONEY, 60: MONEY, 61: MONEY,
};

/** Columns the original sheet leaves for a human to type; wider than the numeric ones. */
const WIDE = new Set([1, 2, 3, 5, 8, 10, 11, 12, 47, 55, 63]);

const RESIDENCY_CONTRACT: Record<string, string> = {
    RESDANT: 'Direct Contract - Resident',
    'DIRCT NONE RESDANT': 'Direct Contract - Non Resident',
};

const BLOCK_TEXT: Record<string, string> = {
    NO_STRUCTURE_LEVEL: 'No salary structure on the employee record',
    NO_JOB_CATEGORY: 'No job category on the employee record',
    NO_JOB_GRADE: 'No job grade on the employee record',
    NO_RATE_FOR_COMBINATION: 'No rate card row for this category / grade / structure',
    NO_ATTENDANCE: 'No attendance record returned for this period',
    NO_RESIDENCY: 'Contract type (residency) not set',
    NEGATIVE_NET: 'Deductions exceed earnings',
    BONUS_CAP_EXCEEDED: 'Bonus percentage over 100%',
    GRADE_CHANGED_MID_PERIOD: 'Job grade changed mid-period',
    FINAL_SETTLEMENT_PENDING: 'Leaving during this period — final settlement outside payroll',
    JOINED_MID_PERIOD: 'Joined during this period',
};

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** Sums every line item of one category; absent categories total to 0. */
const sumItems = (line: PayrollLine, kind: 'EARNING' | 'DEDUCTION', category: string): number =>
    (line.items || []).filter(i => i.kind === kind && i.category === category).reduce((s, i) => s + i.amount, 0);

const reasonText = (line: PayrollLine, category: string): string =>
    (line.items || [])
        .filter(i => i.category === category)
        .map(i => i.correctionNote || i.label)
        .filter(Boolean)
        .join('; ');

/**
 * One employee's row, in column order.
 *
 * Blank (not zero) is used wherever this system genuinely does not hold the figure — an explicit
 * 0 would assert a measurement that was never taken. The Legend sheet lists every such column.
 */
export const masterDataRow = (line: PayrollLine): (string | number)[] => {
    // Position and skill factors are mutually exclusive: only the larger of the two is paid. The
    // loser is exported as 0 rather than as its stored value so that the sheet's own
    // `Amount = Basic x Factor` still holds for a reviewer checking it by hand.
    const pos = line.positionFactor ?? 1;
    const skill = line.skillFactor ?? 1;
    const posEff = pos >= skill ? round4(pos - 1) : 0;
    const skillEff = skill > pos ? round4(skill - 1) : 0;

    const underpayment = sumItems(line, 'EARNING', 'PREVIOUS_UNDERPAYMENT');
    const action = line.blockReasons.includes('JOINED_MID_PERIOD')
        ? 'New hire this period'
        : line.blockReasons.includes('FINAL_SETTLEMENT_PENDING')
            ? 'Leaving this period'
            : '';

    return [
        line.staffId || '',
        action,
        line.fullNameArabic || '',
        line.fullName || '',
        line.passportNumber || '',
        line.email || '',
        line.nationality || '',
        fmtDate(line.contractEndDate),
        line.residencyType === 'NONE RESDANT'
            ? (line.serviceProviderName || 'Service Provider')
            : (RESIDENCY_CONTRACT[line.residencyType || ''] || line.residencyType || ''),
        (line.serviceProviderPercentage ?? 0) / 100,
        line.divisionName || '',
        line.departmentName || '',
        line.positionTitle || '',
        round4((line.languageFactor ?? 1) - 1),
        skillEff,
        posEff,
        line.jobCategory || '',
        line.jobGrade || '',
        line.hourlyRate,
        line.currency,
        line.structureLevel || '',
        line.workLocation || '',
        round4((line.siteFactor ?? 1) - 1),
        line.basicHours,
        line.overtimeHours,
        line.totalWorkingHours,
        line.basicSalary,
        line.positionAllowance,
        line.skillAllowance,
        line.languageAllowance,
        line.siteAllowance,
        '', // Eid Leave Hours — not tracked separately by the attendance service
        '', // Eid Leave Amount
        '', // Paid Annual Hours — the source returns one combined paid-leave figure, see Legend
        '', // PA Amount
        '', // Paid Emergency Leave Hours
        '', // PE Amount
        line.unpaidHours,
        line.paidAbsenceHours,
        line.paidAbsenceAmount,
        line.paidLeaveBalance ?? '',
        line.unpaidLeaveBalance ?? '',
        line.emergencyLeaveBalance ?? '',
        '', // Bonus - General — every bonus in this system comes from a completed reward case
        (line.bonusPercent ?? 0) / 100,
        line.bonusAmount,
        underpayment,
        reasonText(line, 'PREVIOUS_UNDERPAYMENT'),
        line.bonusAmount + underpayment,
        sumItems(line, 'DEDUCTION', 'CASH_ADVANCE'),
        line.remainingAdvanceBalance,
        sumItems(line, 'DEDUCTION', 'TICKET_COST'),
        sumItems(line, 'DEDUCTION', 'PENALTY'),
        sumItems(line, 'DEDUCTION', 'HEALTH_INSURANCE_OVERRUN'),
        sumItems(line, 'DEDUCTION', 'PREVIOUS_OVERPAYMENT'),
        reasonText(line, 'PREVIOUS_OVERPAYMENT'),
        line.deductionsTotal,
        line.remainingAdvanceBalance,
        line.netSalary,
        line.totalEarnings,
        line.serviceProviderFee,
        line.employerTotalCost,
        line.status,
        line.blockReasons.map(r => BLOCK_TEXT[r] || r).join('; '),
    ];
};

// --- styles ---------------------------------------------------------------------------------
const border = (rgb: string) => ({
    top: { style: 'thin', color: { rgb } }, bottom: { style: 'thin', color: { rgb } },
    left: { style: 'thin', color: { rgb } }, right: { style: 'thin', color: { rgb } },
});

const headerStyle = (rgb: string): any => ({
    font: { name: 'Montserrat', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: border('FFFFFF'),
});

const cellStyle = (zebra: boolean, format?: string, blocked = false): any => ({
    font: { name: 'Segoe UI', sz: 9, color: { rgb: blocked ? '8B0101' : '1F2937' } },
    fill: { fgColor: { rgb: blocked ? 'FDECEC' : zebra ? 'F6F7F9' : 'FFFFFF' } },
    alignment: { horizontal: format ? 'right' : 'left', vertical: 'center' },
    border: border('E5E7EB'),
    ...(format ? { numFmt: format } : {}),
});

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** The company workbook's own title phrasing. The 25th and 24th are what a financial month is. */
const titleFor = (period: string): string => {
    const [y, m] = period.split('-').map(Number);
    return `IPH Payroll Master Data (25th of ${MONTHS[(m + 10) % 12]} - 24th of ${MONTHS[m - 1]} ${y})`;
};

const reportTitleStyle: any = {
    font: { name: 'Montserrat', sz: 16, bold: true, color: { rgb: '1F2937' } },
    alignment: { horizontal: 'left', vertical: 'center' },
};

const groupColor = (col: number): string => GROUPS.find(([a, b]) => col >= a && col <= b)?.[2] ?? TEAL;

// --- the Legend sheet -----------------------------------------------------------------------
//
// Every deliberate difference between this export and the original spreadsheet, written down.
// A reviewer who spots a blank column and cannot find out why will assume a bug, and they would be
// right to — so the answer travels with the file.
const LEGEND_ROWS: [string, string][] = [
    ['Paid Annual Hours / PA Amount / Paid Emergency Leave Hours / PE Amount',
        'Left blank. The attendance service returns one combined paid-leave figure with no annual/emergency split, and the two split fields it does return are provably swapped. The combined figure is in "Total Paid Absence in Hours" and "Total Paid Absences Amount".'],
    ['Eid Leave Hours / Eid Leave Amount',
        'Left blank. Eid leave is not recorded as its own leave type; it arrives inside the combined paid-leave figure.'],
    ['Bonus - General',
        'Left blank. Every bonus in this system originates from a completed reward case and is therefore a percentage of Basic Salary, reported in "Percentage for Performance Bonus" and "Exceptional performance bonus".'],
    ['Position Factor / Skill Factor',
        'The two are mutually exclusive — only the larger is paid. The other is exported as 0 so that Amount = Basic Salary x Factor still holds when checked by hand.'],
    ['Factor columns',
        'Exported as the increment (0.10 = +10%), matching the original sheet. The system stores them as multipliers (1.10).'],
    ['Total Deductions',
        'Excludes "Remaining Advanced Deduction" and "Remaining Advance Salary Deduction". Those two are the outstanding advance balance shown for information; the original sheet summed one of them into the total, which deducted the same money twice.'],
    ['Fee for SP',
        'Calculated on Net Salary, not on Full Salary. This is a deliberate policy decision and differs from the original sheet.'],
    ['Full Salary',
        'Total earnings before deductions: Basic + the four factor allowances + paid absences + bonuses + any underpayment correction.'],
    ['Line Status / Blocking Reasons',
        'Added by this system. A blocked line has all its amounts forced to zero because a required input is missing — it is never quietly paid as zero. The period cannot be closed while any line is blocked.'],
    ['Salary Structure',
        'Exported as the system code (SS-01-LYD .. SS-05-EUR). The original sheet used descriptive labels ("1 - Resident (LYD)").'],
];

const buildLegendSheet = (run: PayrollRun): XLSX.WorkSheet => {
    const aoa: (string | number)[][] = [
        ['MASTER DATA — review sheet'],
        [],
        ['Period', run.period],
        ['Run number', run.runNumber],
        ['Covers', `${fmtDate(run.periodStart)} - ${fmtDate(run.periodEnd)}`],
        ['Status', run.status],
        ['Revision', run.revision],
        ['Computed at', run.attendanceFetchedAt ? new Date(run.attendanceFetchedAt).toLocaleString('en-GB') : 'not computed'],
        ['Attendance rows returned', run.attendanceRowCount],
        ['Exported at', new Date().toLocaleString('en-GB')],
        [],
        ['Differences from the original spreadsheet'],
        ['Column', 'Why'],
        ...LEGEND_ROWS,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const titleStyle: any = { font: { name: 'Montserrat', sz: 14, bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '511D29' } }, alignment: { vertical: 'center' } };
    const labelStyle: any = { font: { name: 'Segoe UI', sz: 9, bold: true, color: { rgb: '511D29' } }, alignment: { vertical: 'center' } };
    const valueStyle: any = { font: { name: 'Segoe UI', sz: 9, color: { rgb: '1F2937' } }, alignment: { vertical: 'top', wrapText: true } };

    ws['A1'].s = titleStyle;
    ws['A13'] = { t: 's', v: 'Column', s: { ...labelStyle, fill: { fgColor: { rgb: 'F1ECE6' } } } };
    ws['B13'] = { t: 's', v: 'Why', s: { ...labelStyle, fill: { fgColor: { rgb: 'F1ECE6' } } } };
    if (ws['A12']) ws['A12'].s = { ...labelStyle, font: { ...labelStyle.font, sz: 11 } };
    for (let r = 3; r <= 10; r++) {
        if (ws[`A${r}`]) ws[`A${r}`].s = labelStyle;
        if (ws[`B${r}`]) ws[`B${r}`].s = valueStyle;
    }
    for (let r = 14; r < 14 + LEGEND_ROWS.length; r++) {
        if (ws[`A${r}`]) ws[`A${r}`].s = { ...valueStyle, font: { ...valueStyle.font, bold: true } };
        if (ws[`B${r}`]) ws[`B${r}`].s = valueStyle;
    }
    ws['!cols'] = [{ wch: 46 }, { wch: 110 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    ws['!rows'] = [{ hpt: 28 }];
    return ws;
};

// --- the workbook ---------------------------------------------------------------------------
// Async because the letterhead is fetched once and injected into the finished package —
// xlsx-js-style cannot write images, so the logo is added afterwards. See utils/xlsxLogo.ts.
export const buildMasterDataWorkbook = async (run: PayrollRun, lines: PayrollLine[]): Promise<Blob> => {
    const rows = lines.map(masterDataRow);
    // Row 1 is the letterhead (logo in B, title in C, matching the company workbook), row 2 the
    // headers, data from row 3. Everything below is therefore offset by one.
    const aoa: (string | number)[][] = [
        ['', '', titleFor(run.period)],
        MASTER_DATA_HEADERS,
        ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const nCols = MASTER_DATA_HEADERS.length;
    const HEADER_ROW = 1;
    const FIRST_DATA_ROW = 2;

    if (ws.C1) ws.C1.s = reportTitleStyle;

    for (let c = 0; c < nCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: HEADER_ROW, c });
        if (ws[addr]) ws[addr].s = headerStyle(groupColor(c));
    }

    for (let r = 0; r < rows.length; r++) {
        const blocked = lines[r].status === 'BLOCKED';
        for (let c = 0; c < nCols; c++) {
            const addr = XLSX.utils.encode_cell({ r: FIRST_DATA_ROW + r, c });
            if (!ws[addr]) ws[addr] = { t: 's', v: '' };
            ws[addr].s = cellStyle(r % 2 === 1, FORMATS[c], blocked);
        }
    }

    ws['!cols'] = MASTER_DATA_HEADERS.map((h, c) => ({ wch: WIDE.has(c) ? Math.max(22, Math.min(40, h.length + 4)) : Math.max(11, Math.min(20, h.length + 2)) }));
    // 128pt is the logo's height plus its inset; without it the mark is clipped by the header row.
    ws['!rows'] = [{ hpt: 128 }, { hpt: 46 }];
    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
            s: { r: HEADER_ROW, c: 0 },
            e: { r: HEADER_ROW + rows.length, c: nCols - 1 },
        }),
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MASTER DATA');
    XLSX.utils.book_append_sheet(wb, buildLegendSheet(run), 'Legend');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    // Column A is narrow here, so the logo is anchored one column in — same as the company workbook.
    return xlsxBlobWithLogo(buffer, TEMPLATE_LOGO_ANCHOR);
};
