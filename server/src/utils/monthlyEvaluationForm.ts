import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// Fills the bilingual "IPH monthly evaluations form.docx" (the official Monthly / Efficiency
// Evaluation form) for a single employee + month. The template lives in the app's public folder.
//
// The header is a run of Word MERGEFIELDs («Employee_ID» … «Next_Authority») whose cached display
// text we string-replace. The body is one big table whose score cells are empty in the template;
// we fill them positionally. The table's true column layout (18 grid columns) is:
//
//   c0  Category            c1  Element            c3  Measurement unit
//   c5  Direct-Mgr name     c6  Direct-Mgr degree  <-- FILL
//   c8  Next-Auth name      c9  Next-Auth degree   <-- FILL
//   c11 Final Evaluation    <-- FILL
//   c12 Classification %    c15 Item balance %      c17 Item max points   (all pre-printed)
//
// Row indices below are 0-based into the first table's <w:tr> list and are specific to this
// template (same positional philosophy as personnelActionForm.ts / the payroll Excel export).
const TEMPLATE_NAME = 'IPH monthly evaluations form.docx';

const resolveTemplate = (): string => {
    const candidates = [
        path.join(__dirname, '../../../public', TEMPLATE_NAME),
        path.join(process.cwd(), 'public', TEMPLATE_NAME),
        path.join(process.cwd(), '../public', TEMPLATE_NAME),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
    throw new Error(`Monthly evaluation template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RPR = `<w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>`;
const textRuns = (value: string): string =>
    value.split(/\r?\n/).map((line, i) =>
        `<w:r>${RPR}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`
    ).join('');

// Rebuild a <w:tc> with a single centered paragraph holding the given runs, preserving the
// cell's own <w:tcPr> (so gridSpan / vMerge / borders survive).
const setCell = (cell: string, runs: string): string => {
    const open = (cell.match(/^<w:tc\b[^>]*>/) || ['<w:tc>'])[0];
    const tcPr = (cell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
    let pPr = (cell.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
    if (pPr) {
        pPr = pPr.replace(/<w:jc\b[^>]*\/>/, '').replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
    } else {
        pPr = '<w:pPr><w:jc w:val="center"/></w:pPr>';
    }
    return `${open}${tcPr}<w:p>${pPr}${runs}</w:p></w:tc>`;
};

const gridSpanOf = (cell: string): number => {
    const m = cell.match(/<w:gridSpan\b[^>]*w:val="(\d+)"/);
    return m ? parseInt(m[1], 10) : 1;
};

// A single cell to fill: { row, col } are the 0-based table row index and the true grid-column
// start; value is the text to write.
interface Fill { row: number; col: number; value: string; }

const num = (v: number | null | undefined): string => {
    if (v === null || v === undefined || isNaN(v as number)) return '';
    const r = Math.round((v as number) * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

export interface MonthlyEvaluationData {
    employeeId: string;      // staff ID (display)
    employeeName: string;
    department: string;
    position: string;
    directSupervisor: string;
    nextAuthority: string;
    monthLabel: string;

    // Compiled per-criterion FINAL (averaged) scores — the values shown on the report table.
    final: Record<string, number | null | undefined>;
    // Presence points (already computed to the form's per-item maxima); null when no HR record exists.
    presence: {
        absence: number | null; delay: number | null; emergency: number | null;
        unpaid: number | null; annual: number | null;
    };
    // Raw per-evaluator degrees for the metric categories (may be null when a level didn't evaluate).
    directEval: Record<string, number | null | undefined> | null;
    nextEval: Record<string, number | null | undefined> | null;
    // Exceptional performance raw inputs (Personnel).
    exceptional: { warnings: number; discipline: number; appreciation: number; assignments: number } | null;
    // Training completion flags (Personnel), Yes(1)/No(0).
    training: { specialized: boolean; supporting: boolean; language: boolean; software: boolean } | null;
    // Totals.
    totalPercent: number | null | undefined;
    totalWithoutPresence: number | null | undefined;
    employeeResult: number | null | undefined;
}

// Metric criteria in the exact row order they appear in each category block of the form.
const ADMIN_KEYS = ['relColleagues', 'teamwork', 'workOrg', 'commSkills', 'regCompliance'];
const EXEC_KEYS = ['taskQuality', 'timeCommit', 'orgCompliance', 'probSolving', 'pressureHandling', 'contDev'];
const CARE_KEYS = ['regAdherence', 'safetyAdherence', 'appearance', 'resPreservation', 'dataPrivacy'];

// Grid column starts for the three score columns.
const COL_DIRECT = 6;
const COL_NEXT = 9;
const COL_FINAL = 11;

const buildFills = (d: MonthlyEvaluationData): Fill[] => {
    const fills: Fill[] = [];

    // Evaluation month (row 1, value cell starts at col 1).
    if (d.monthLabel) fills.push({ row: 1, col: 1, value: d.monthLabel });

    // Presence (rows 5-9): scored by HR/attendance → put points under the direct (HR) degree
    // column and the final column.
    const presenceRows: Array<[number, number | null]> = [
        [5, d.presence.absence],
        [6, d.presence.delay],
        [7, d.presence.emergency],
        [8, d.presence.unpaid],
        [9, d.presence.annual],
    ];
    for (const [row, val] of presenceRows) {
        fills.push({ row, col: COL_DIRECT, value: num(val) });
        fills.push({ row, col: COL_FINAL, value: num(val) });
    }

    // Metric categories: Admin (rows 11-15), Exec (17-22), Care (24-28).
    const metricBlocks: Array<[number, string[]]> = [
        [11, ADMIN_KEYS],
        [17, EXEC_KEYS],
        [24, CARE_KEYS],
    ];
    for (const [startRow, keys] of metricBlocks) {
        keys.forEach((key, i) => {
            const row = startRow + i;
            const dv = d.directEval ? d.directEval[key] : undefined;
            const nv = d.nextEval ? d.nextEval[key] : undefined;
            if (dv !== null && dv !== undefined) fills.push({ row, col: COL_DIRECT, value: num(dv) });
            if (nv !== null && nv !== undefined) fills.push({ row, col: COL_NEXT, value: num(nv) });
            fills.push({ row, col: COL_FINAL, value: num(d.final[key]) });
        });
    }

    // Exceptional performance (rows 30-33): raw counts from Personnel.
    if (d.exceptional) {
        const exRows: Array<[number, number]> = [
            [30, d.exceptional.warnings],
            [31, d.exceptional.discipline],
            [32, d.exceptional.appreciation],
            [33, d.exceptional.assignments],
        ];
        for (const [row, val] of exRows) {
            fills.push({ row, col: COL_DIRECT, value: num(val) });
            fills.push({ row, col: COL_FINAL, value: num(val) });
        }
    }

    // Training & education (rows 35-38): Yes(1)/No(0).
    if (d.training) {
        const trRows: Array<[number, boolean]> = [
            [35, d.training.specialized],
            [36, d.training.supporting],
            [37, d.training.language],
            [38, d.training.software],
        ];
        for (const [row, val] of trRows) {
            fills.push({ row, col: COL_DIRECT, value: val ? '1' : '0' });
            fills.push({ row, col: COL_FINAL, value: val ? '1' : '0' });
        }
    }

    // Totals (row 41): Total %, Total without presence, Employee result.
    fills.push({ row: 41, col: 10, value: num(d.totalPercent) });
    fills.push({ row: 41, col: 14, value: num(d.totalWithoutPresence) });
    fills.push({ row: 41, col: 16, value: num(d.employeeResult) });

    return fills;
};

export const generateMonthlyEvaluationDocx = (d: MonthlyEvaluationData): Buffer => {
    const zip = new PizZip(fs.readFileSync(resolveTemplate()));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed monthly evaluation template: word/document.xml missing.');

    // 1. Header merge-field display text (each token is contiguous and unique in the XML).
    const headerMap: Record<string, string> = {
        '«Employee_ID»': d.employeeId,
        '«Employee_Name»': d.employeeName,
        '«Department»': d.department,
        '«Position»': d.position,
        '«Direct_Supervisor»': d.directSupervisor,
        '«Next_Authority»': d.nextAuthority,
    };
    for (const [token, value] of Object.entries(headerMap)) {
        xml = xml.split(token).join(escapeXml(value || ''));
    }

    // 2. Positional score fills into the first table.
    const tblMatch = xml.match(/<w:tbl>[\s\S]*<\/w:tbl>/);
    if (tblMatch) {
        const fills = buildFills(d);
        const byRow = new Map<number, Fill[]>();
        for (const f of fills) {
            if (!byRow.has(f.row)) byRow.set(f.row, []);
            byRow.get(f.row)!.push(f);
        }

        let rowIdx = -1;
        const newTbl = tblMatch[0].replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
            rowIdx++;
            const rowFills = byRow.get(rowIdx);
            if (!rowFills || rowFills.length === 0) return row;

            let col = 0;
            return row.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
                const start = col;
                col += gridSpanOf(cell);
                const fill = rowFills.find(f => f.col === start);
                if (fill && fill.value !== '') return setCell(cell, textRuns(fill.value));
                return cell;
            });
        });
        xml = xml.replace(tblMatch[0], newTbl);
    }

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
