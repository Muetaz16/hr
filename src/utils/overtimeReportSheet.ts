import * as XLSX from 'xlsx-js-style';
import type { OvertimeReportGroup } from '../services/attendanceService';
import { xlsxBlobWithLogo } from './xlsxLogo';
import { safeFilePart } from './download';

// The workbook an attendance officer sends to a head, and the head sends back filled in.
//
// ONE WORKBOOK PER GROUP, never one workbook with a sheet per department. This is the same rule
// payrollProviderReport.ts states for provider reports — "a forgotten tab is how one provider ends
// up reading another's salaries" — and it applies exactly as well to a head reading another
// department's staff.
//
// The point of the file is the LAST column: "Approved hours", left empty for the head to fill in.
// Everything left of it is the evidence they need to decide, and the recorded figure is stated in
// both hours-and-minutes and decimal hours so nobody has to convert 6h 12m in their head.

const BRAND = '511D29';
const HEADER_ROW = 2;   // row 1 carries the letterhead
const FIRST_COL = 1;    // column A is a margin, matching the payroll workbooks

const HEADERS = [
    'Employee', 'Name in Arabic', 'Staff Code', 'Belongs to',
    'Recorded overtime', 'Recorded (hours)', 'Already approved', 'Approved hours', 'Head\'s note',
];
const COL_WIDTHS = [3, 30, 26, 16, 30, 18, 18, 18, 16, 34];

const titleStyle = {
    font: { name: 'Montserrat', sz: 14, bold: true, color: { rgb: BRAND } },
    alignment: { vertical: 'center' as const },
};
const headerStyle = {
    font: { name: 'Montserrat', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: BRAND } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: { bottom: { style: 'thin' as const, color: { rgb: 'FFFFFF' } } },
};
const cellStyle = (striped: boolean, opts: { arabic?: boolean; numeric?: boolean; entry?: boolean } = {}) => ({
    font: { name: opts.arabic ? 'Readex Pro Light' : 'Segoe UI', sz: 10 },
    fill: { fgColor: { rgb: opts.entry ? 'FFF7E6' : striped ? 'F7F5F6' : 'FFFFFF' } },
    alignment: {
        // The Arabic name is right-aligned; the sheet itself has no RTL flag, matching every other
        // export here. xlsx-js-style cannot set a worksheet reading order.
        horizontal: (opts.arabic ? 'right' : opts.numeric ? 'center' : 'left') as 'right' | 'center' | 'left',
        vertical: 'center' as const,
    },
    border: { bottom: { style: 'hair' as const, color: { rgb: 'E5E1E3' } } },
});
const totalStyle = {
    font: { name: 'Montserrat', sz: 10, bold: true, color: { rgb: BRAND } },
    fill: { fgColor: { rgb: 'F5EBD9' } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
};
const noteStyle = {
    font: { name: 'Segoe UI', sz: 9, italic: true, color: { rgb: '8A8A8A' } },
    alignment: { wrapText: true, vertical: 'top' as const },
};

const hm = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const buildOvertimeWorkbook = async (
    group: OvertimeReportGroup, start: string, end: string,
): Promise<Blob> => {
    const ws: XLSX.WorkSheet = {};
    const set = (r: number, c: number, cell: XLSX.CellObject) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; };

    set(0, 2, { t: 's', v: `Overtime for approval — ${group.label} — ${start} to ${end}`, s: titleStyle });
    HEADERS.forEach((h, i) => set(HEADER_ROW, FIRST_COL + i, { t: 's', v: h, s: headerStyle }));

    group.rows.forEach((row, ri) => {
        const striped = ri % 2 === 1;
        const place = row.placement.unit || row.placement.department || row.placement.division || row.placement.directorate || '';
        const values: (string | number)[] = [
            row.name,
            row.nameArabic || '',
            row.empCode,
            place,
            hm(row.recordedMins),
            Math.round((row.recordedMins / 60) * 100) / 100,
            row.approvedMins > 0 ? hm(row.approvedMins) : '',
            '', // left empty on purpose — this is the column the head fills in
            '',
        ];
        values.forEach((v, i) => {
            const numeric = i === 5;
            set(HEADER_ROW + 1 + ri, FIRST_COL + i, {
                t: numeric ? 'n' : 's',
                v: v as any,
                s: cellStyle(striped, { arabic: i === 1, numeric, entry: i >= 7 }),
            });
        });
    });

    const totalRow = HEADER_ROW + 1 + group.rows.length;
    const totals: (string | number)[] = [
        'TOTAL', '', '', '',
        hm(group.recordedMins),
        Math.round((group.recordedMins / 60) * 100) / 100,
        group.approvedMins > 0 ? hm(group.approvedMins) : '',
        '', '',
    ];
    totals.forEach((v, i) => set(totalRow, FIRST_COL + i, {
        t: i === 5 ? 'n' : 's', v: v as any, s: totalStyle,
    }));

    // Said in the file itself, because the file outlives the screen it was exported from and the
    // head reading it has no other way to know either fact.
    const noteRow = totalRow + 2;
    set(noteRow, FIRST_COL, {
        t: 's',
        v: 'Recorded overtime is what the terminal registered. It is NOT paid until it is approved — payroll pays '
            + 'only approved hours, at the ordinary hourly rate with no premium. Enter the hours you approve in the '
            + '"Approved hours" column and return this file.',
        s: noteStyle,
    });
    if (group.kind === 'unassigned' || group.kind === 'notLinked') {
        set(noteRow + 1, FIRST_COL, {
            t: 's',
            v: group.kind === 'notLinked'
                ? 'These employees exist in the attendance system but have no HR record, so they belong to no department and cannot be paid until that is fixed.'
                : 'These employees have no unit, department or division set on their HR record, so there is no head they route to.',
            s: noteStyle,
        });
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: noteRow + 1, c: FIRST_COL + HEADERS.length - 1 } });
    ws['!cols'] = COL_WIDTHS.map(wch => ({ wch }));
    ws['!rows'] = [{ hpt: 128 }, { hpt: 8 }, { hpt: 30 }]; // row 1 is the letterhead's height
    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
            s: { r: HEADER_ROW, c: FIRST_COL },
            e: { r: Math.max(HEADER_ROW, totalRow - 1), c: FIRST_COL + HEADERS.length - 1 },
        }),
    };

    const wb = XLSX.utils.book_new();
    // Sheet names cannot hold : \ / ? * [ ] and are capped at 31 characters.
    XLSX.utils.book_append_sheet(wb, ws, group.label.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Overtime');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    // xlsx-js-style silently drops images, so the letterhead is injected into the finished package.
    return xlsxBlobWithLogo(buffer);
};

export const overtimeSheetFilename = (group: OvertimeReportGroup, start: string, end: string): string =>
    `Overtime_${safeFilePart(group.label)}_${start}_to_${end}.xlsx`;
