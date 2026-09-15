import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

// Fills the official "LATE ARRIVAL - EARLY DEPARTURE REQUEST FORM" that ships in the public
// folder, used for the short attendance-permission requests (Late Coming / Early Leaving / Few
// Hours). Read-only template: we drop values into the correct cells (located by their printed
// labels), tick the relevant ☐ checkboxes, embed each approver's signature, and hand back a fresh
// .docx. Pending approvers are left blank so the same call yields a live copy and the final record.
const TEMPLATE_NAME = 'Early Departure Request Form.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) if (fs.existsSync(p)) return p;
    throw new Error(`Early departure form template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const valueRun = (value: string): string =>
    `<w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

const SIG_MAX_W_EMU = Math.round(1.4 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.34 * EMU_PER_INCH);

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim();

// Force a paragraph's properties to horizontal-centered (drop existing jc + leading indent,
// insert a centered jc before the trailing rPr).
const centerPPr = (pPr: string): string => {
    const cleaned = pPr.replace(/<w:jc\b[^>]*\/>/g, '').replace(/<w:ind\b[^>]*\/>/g, '');
    if (/<w:rPr>/.test(cleaned)) return cleaned.replace(/<w:rPr>/, '<w:jc w:val="center"/><w:rPr>');
    return cleaned.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
};

// Center every paragraph inside a table cell — final pass so labels + values read uniformly centered.
const centerAllParagraphs = (cell: string): string =>
    cell.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) =>
        /<w:pPr>[\s\S]*?<\/w:pPr>/.test(para)
            ? para.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, (pp) => centerPPr(pp))
            : para.replace(/^(<w:p\b[^>]*>)/, '$1<w:pPr><w:jc w:val="center"/></w:pPr>')
    );

// Append a run to the cell's LAST paragraph, forcing it centered.
const injectRun = (cell: string, run: string): string => {
    const m = cell.match(/^([\s\S]*)(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>\s*<\/w:tc>)$/);
    if (m) {
        const [, before, pOpen, inner, tail] = m;
        const centered = /<w:pPr>[\s\S]*?<\/w:pPr>/.test(inner)
            ? inner.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, (pp) => centerPPr(pp))
            : `<w:pPr><w:jc w:val="center"/></w:pPr>${inner}`;
        return `${before}${pOpen}${centered}${run}${tail}`;
    }
    return cell.replace(/<\/w:tc>$/, `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run}</w:p></w:tc>`);
};

// The form's Reason row is four tick boxes and nothing else — no line to write on — so the employee
// picks one of these. The label is the printed English text the box sits beside.
export type PermissionReason = 'PERSONAL' | 'FAMILY' | 'HEALTH_MEDICAL' | 'OTHERS';
const REASON_LABELS: Record<PermissionReason, string> = {
    PERSONAL: 'Personal',
    FAMILY: 'Family',
    HEALTH_MEDICAL: 'Health / Medical',
    OTHERS: 'Others',
};

// No date: this form dates the employee's own signature only, and each approver's row carries a
// signature alone. The field is left off rather than ignored so a caller cannot pass a date and
// assume it prints.
export interface EarlyDepartureApprover {
    signature?: string | null;
    decided: boolean;
}

export interface EarlyDepartureData {
    employeeId: string;
    employeeName: string;
    positionTitle: string;
    division: string;
    department: string;
    // The employee's Job Description work locations ('OFFICE' / 'SITE'), same source as the Work
    // Authorization and Missing Biometric Log forms — drives the Office / Site checkbox. A property
    // of the post, not a per-request choice, so the employee is never asked for it.
    jdWorkLocations?: string[];
    requestType: 'LATE_COMING' | 'EARLY_LEAVING' | 'HOURS_LEAVE';
    permissionReason?: PermissionReason | null;
    date: string;              // request date
    timeWindow: string;        // "HH:MM - HH:MM"
    totalHours: string;
    employeeSignature?: string | null;
    employeeSignatureDate?: string;
    // The four signature rows the reprinted form carries, in the order it prints them.
    directSupervisor?: EarlyDepartureApprover | null;   // "Direct Supervisor / المشرف المباشر"
    headOfDivision?: EarlyDepartureApprover | null;     // "Head of Division / مدير الإدارة"
    headOfAttendance?: EarlyDepartureApprover | null;   // "Head of Personal Relations / رئيس قسم شؤون الموظفين"
    headOfHR?: EarlyDepartureApprover | null;           // "Head of Human Resources / رئيس الموارد البشرية"
}

// Which flat cell indices sit in which printed row. Everything else in this file locates a cell by
// the label printed inside it, but three things on this form are blank cells that carry no label of
// their own — the employee's signature/date pair, and the two approver signature boxes that sit
// ABOVE their "Signature / التوقيع" caption — so they can only be found by position. Built by
// assigning each <w:tc> to the <w:tr> that opened last, which survives the row restructuring that
// a label-only search does not.
const cellRows = (xml: string): number[][] => {
    const marks: { pos: number; row: boolean }[] = [];
    for (const m of xml.matchAll(/<w:tr\b/g)) marks.push({ pos: m.index ?? 0, row: true });
    for (const m of xml.matchAll(/<w:tc\b/g)) marks.push({ pos: m.index ?? 0, row: false });
    marks.sort((a, b) => a.pos - b.pos);
    const rows: number[][] = [];
    let ci = 0;
    for (const mk of marks) {
        if (mk.row) rows.push([]);
        else if (rows.length) rows[rows.length - 1].push(ci++);
        else ci++;  // a cell outside any row: count it anyway so the indices stay aligned
    }
    return rows;
};

export const generateEarlyDepartureDocx = (data: EarlyDepartureData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed early departure template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const rows = cellRows(xml);
    const rowOf = (ci: number): number[] | undefined => rows.find(r => r.includes(ci));
    const replacements: Record<number, string> = {};

    const findLabel = (label: string, from = 0): number => {
        for (let i = from; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };
    const fillIdx = (ti: number, value: string) => {
        if (!value || ti < 0 || ti >= cells.length) return;
        replacements[ti] = injectRun(replacements[ti] ?? cells[ti], valueRun(value));
    };
    const fillAfter = (label: string, value: string, offset = 1) => {
        const li = findLabel(label);
        if (li >= 0) fillIdx(li + offset, value);
    };
    const tick = (ci: number) => {
        if (ci < 0 || ci >= cells.length) return;
        const cell = replacements[ci] ?? cells[ci];
        if (cell.includes('☐')) replacements[ci] = cell.replace('☐', '☑');
    };
    // Tick the ☐ that sits in the cell immediately BEFORE a given option label.
    const tickBefore = (label: string) => {
        const li = findLabel(label);
        if (li > 0) tick(li - 1);
    };

    // --- Employee information ---
    fillAfter('Employee ID:', data.employeeId);
    fillAfter('Employee Name:', data.employeeName);
    fillAfter('Position Title:', data.positionTitle);
    fillAfter('Division', data.division);
    fillAfter('Department', data.department);

    // --- Work location checkbox ---
    // From the Job Description, never from the request. Both boxes tick when the post covers both.
    const locs = (data.jdWorkLocations || []).map(l => String(l).toUpperCase());
    if (locs.includes('OFFICE')) tickBefore('Office');
    if (locs.includes('SITE')) tickBefore('Site');

    // --- Request type checkbox ---
    // Matched without the " /" that used to follow: the reprinted form puts the Arabic first
    // ("حضور متأخر Late Arrival/"), so the old label no longer occurs anywhere and neither box was
    // being ticked. The uppercase title ("LATE ARRIVAL - EARLY DEPARTURE") does not collide —
    // findLabel is case-sensitive.
    if (data.requestType === 'LATE_COMING') tickBefore('Late Arrival');
    else tickBefore('Early Departure');

    // --- Reason checkbox ---
    // "Personal" also occurs later in "Head of Personal Relations", but findLabel returns the FIRST
    // match and the reason row is printed well above the approvals, so the right box is hit.
    // Requests filed before the employee was asked to pick leave all four boxes empty.
    const reasonLabel = data.permissionReason ? REASON_LABELS[data.permissionReason] : null;
    if (reasonLabel) tickBefore(reasonLabel);

    // --- Details: the date and time inputs are the printed placeholder cells
    //     ("____ / ____/ 20__" and "____:____"), which sit in their own row below the labels. ---
    const replaceCellText = (ci: number, value: string) => {
        if (ci < 0 || ci >= cells.length || !value) return;
        const cur = replacements[ci] ?? cells[ci];
        // Inject centering before the run if it doesn't exist, and replace text
        const centered = cur.includes('<w:jc w:val="center"/>') ? cur : cur.replace(/<w:p( [^>]*)?>/, '<w:p$1><w:pPr><w:jc w:val="center"/></w:pPr>');
        replacements[ci] = centered.replace(/(<w:t(?: [^>]*)?>)[^<]*(<\/w:t>)/, `$1${escapeXml(value)}$2`);
    };
    const dateCi = texts.findIndex(t => /\/\s*20__/.test(t) || /20__/.test(t));
    replaceCellText(dateCi, data.date);
    const timeCi = texts.findIndex(t => /_{2,}\s*:\s*_{2,}/.test(t.replace(/\s/g, '')));
    replaceCellText(timeCi, data.timeWindow);
    // Total hours — the empty cell to the right of the time placeholder, else after its label.
    if (data.totalHours) {
        if (timeCi >= 0 && timeCi + 1 < cells.length) fillIdx(timeCi + 1, data.totalHours);
        else fillAfter('Total number of hours requested:', data.totalHours);
    }

    // --- Signatures ---
    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    let rIdSeq = 970, mediaSeq = 170, docPrSeq = 970;
    const placeSignature = (dataUrl: string | null | undefined, cellIndex: number, name: string) => {
        const png = dataUrlToPng(dataUrl);
        if (!png || cellIndex < 0 || cellIndex >= cells.length) return;
        const dims = pngSize(png) || { width: 480, height: 200 };
        const { cx, cy } = fitEmu(dims.width, dims.height, SIG_MAX_W_EMU, SIG_MAX_H_EMU);
        const rId = `rId${rIdSeq++}`;
        const mediaFile = `edsig${mediaSeq++}.png`;
        zip.file(`word/media/${mediaFile}`, png);
        relsXml = relsXml.replace('</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFile}"/></Relationships>`);
        replacements[cellIndex] = injectRun(replacements[cellIndex] ?? cells[cellIndex], drawingRun(rId, cx, cy, docPrSeq++, name));
    };

    // Employee signature — the "Signature and Date:" row, which the reprinted form splits into two
    // blanks: date on the LEFT, signature on the RIGHT (the table is left-to-right, so the first of
    // the two blanks is the left one). This is the ONLY row that carries a date; the approvers sign
    // without one. Older copies of the template had a single combined blank, so the date falls back
    // into the signature cell when there is no second blank to take it.
    {
        const li = findLabel('Signature and Date');
        const row = li >= 0 ? rowOf(li) : undefined;
        if (row) {
            const at = row.indexOf(li);
            const first = row[at + 1] ?? -1;
            const second = row[at + 2] ?? -1;
            const split = second >= 0 && texts[second] === '';
            placeSignature(data.employeeSignature, split ? second : first, 'Employee Signature');
            if (data.employeeSignatureDate) fillIdx(first, data.employeeSignatureDate);
        }
    }

    // --- The two APPROVALS columns: Direct Supervisor (left) and Head of Division (right) ---
    //
    // Their rows read: titles -> ☐ Approved ☐ Not approved (both columns on ONE row) -> a blank
    // signature box -> the "Signature / التوقيع" caption. Addressed by COLUMN, because the boxes
    // are unlabelled and the two columns share a checkbox row: searching for the first "Approved"
    // after each title, as this did before, aimed both approvers' ticks at the supervisor's box —
    // the second one then either overwrote the first or was silently dropped.
    const tickRow = rows.find(r => r.some(ci => texts[ci] === 'Approved'));
    const captionRow = rows.findIndex(r => r.some(ci => /^(Signature|Name and Signature)\s*\//.test(texts[ci])));
    const signColumn = (column: number, ap: EarlyDepartureApprover | null | undefined, who: string) => {
        if (!ap || !ap.decided) return;
        if (tickRow) {
            const approvedAt = tickRow.map((ci, i) => (texts[ci] === 'Approved' ? i : -1)).filter(i => i >= 0);
            const boxAt = approvedAt[column];
            if (boxAt !== undefined && boxAt > 0) tick(tickRow[boxAt - 1]);
        }
        const boxRow = captionRow > 0 ? rows[captionRow - 1] : undefined;
        const ci = boxRow?.[column] ?? -1;
        placeSignature(ap.signature, ci, `${who} Signature`);
    };
    signColumn(0, data.directSupervisor, 'Direct Supervisor');
    signColumn(1, data.headOfDivision, 'Head of Division');

    // --- The HUMAN RESOURCES rows, one approver per row: title | blank | Arabic title ---
    const signLabelledRow = (labels: string[], ap: EarlyDepartureApprover | null | undefined, who: string) => {
        if (!ap || !ap.decided) return;
        const li = labels.map(l => findLabel(l)).find(i => i >= 0);
        if (li === undefined) return;
        const row = rowOf(li);
        const ci = row?.[row.indexOf(li) + 1] ?? -1;
        placeSignature(ap.signature, ci, `${who} Signature`);
    };
    // Several spellings, because the printed templates are being re-worded one at a time and a
    // label that matches nothing drops that approver's signature from the form silently.
    signLabelledRow(['Head of Personal Relations', 'Head of Attendance'], data.headOfAttendance, 'Head of Personnel Affairs');
    signLabelledRow(['Head of Human Resources'], data.headOfHR, 'Head of HR');

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return centerAllParagraphs(replacements[idx] ?? cell); });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
