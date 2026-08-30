import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

// Fills the official "WORK AUTHORIZATION FORM" (نموذج التكليف) that ships in the public folder,
// used for the self-service Work Authorization request (an out-of-office / field-work assignment
// that is written to BioTime's `outworks` table once approved). Read-only template: we drop values
// into the correct cells (located by their printed labels), tick the relevant ☐ checkboxes, embed
// each approver's signature, and hand back a fresh .docx. Pending approvers are left blank so the
// same call yields a live in-progress copy and the final signed record.
//
// Mirrors earlyDepartureForm.ts exactly in mechanism (PizZip + raw XML cell manipulation).
const TEMPLATE_NAME = 'IPH Work Authorization Form.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) if (fs.existsSync(p)) return p;
    throw new Error(`Work authorization form template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const valueRun = (value: string): string =>
    `<w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

const SIG_MAX_W_EMU = Math.round(1.6 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.5 * EMU_PER_INCH);

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

export interface WorkAuthApprover {
    signature?: string | null;
    date?: string;
    decided: boolean;
}

// The Type-of-Work-Order option keys, mapped to the printed checkbox labels on the form.
export type WorkOrderType =
    | 'CHANGE_OF_SCHEDULE' | 'SITE_MISSION' | 'OFFICIAL_BUSINESS'
    | 'NIGHT_SHIFT' | 'OTHERS' | 'OUT_OF_OFFICE';

const WORK_ORDER_LABELS: Record<WorkOrderType, string> = {
    CHANGE_OF_SCHEDULE: 'Change of schedule/',
    SITE_MISSION: 'Site Mission /',
    OFFICIAL_BUSINESS: 'Official Business (Travel)/',
    NIGHT_SHIFT: 'Night shift /',
    OTHERS: 'Others /',
    OUT_OF_OFFICE: 'Out of Office /خارج مقر العمل',
};

export interface WorkAuthorizationData {
    date: string;                 // form/request date
    employeeId: string;
    employeeName: string;
    positionTitle: string;
    division: string;
    department: string;
    // The employee's Job Description work locations ('OFFICE' / 'SITE'); drives the Work Location
    // checkbox on the form (OFFICE → "Office", SITE → "Out of Office").
    jdWorkLocations?: string[];
    workOrderType?: WorkOrderType | null;
    purpose: string;
    placeOfAssignment: string;
    dateFrom: string;             // Date Covered — From
    dateTo: string;               // Date Covered — To
    scheduleFrom?: string;        // Details (for changing schedule) — From time
    scheduleTo?: string;          // Details (for changing schedule) — To time
    // Approvals. The self-service request uses the short 3-stage chain (Direct Supervisor ->
    // Head of Department -> Head of Attendance & Payroll), so only the two rows that chain fills
    // are populated; Head of Division / Head of HR / General Manager are left blank on the form.
    headOfDepartment?: WorkAuthApprover | null;
    headOfDivision?: WorkAuthApprover | null;
    headOfAttendance?: WorkAuthApprover | null;
    headOfHR?: WorkAuthApprover | null;
    generalManager?: WorkAuthApprover | null;
}

export const generateWorkAuthorizationDocx = (data: WorkAuthorizationData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed work authorization template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    const findLabel = (label: string, from = 0): number => {
        for (let i = from; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };
    const fillIdx = (ti: number, value: string) => {
        if (!value || ti < 0 || ti >= cells.length) return;
        replacements[ti] = injectRun(replacements[ti] ?? cells[ti], valueRun(value));
    };
    // Fill the value cell that follows a label (default: the immediately-next cell).
    const fillAfter = (label: string, value: string, offset = 1) => {
        const li = findLabel(label);
        if (li >= 0) fillIdx(li + offset, value);
    };
    // Fill the value cell that follows the first `label` occurring AFTER an anchor — used for the
    // two "From:"/"To:" pairs (Date Covered vs schedule Details), which share the same label text.
    const fillAfterAnchored = (anchor: string, label: string, value: string) => {
        const ai = findLabel(anchor);
        if (ai < 0) return;
        const li = findLabel(label, ai + 1);
        if (li >= 0) fillIdx(li + 1, value);
    };
    // Tick the ☐ that sits in the cell immediately BEFORE a given option label.
    const tickBefore = (label: string) => {
        const li = findLabel(label);
        if (li <= 0) return;
        const ci = li - 1;
        const cell = replacements[ci] ?? cells[ci];
        if (cell.includes('☐')) replacements[ci] = cell.replace('☐', '☑');
    };

    // --- Employee information ---
    fillAfter('Date:', data.date);
    fillAfter('Employee ID:', data.employeeId);
    fillAfter('Employee Name:', data.employeeName);
    fillAfter('Position Title:', data.positionTitle);
    fillAfter('Division:', data.division);
    fillAfter('Department:', data.department);

    // --- Work location: taken from the employee's Job Description (OFFICE / SITE), not the request.
    //     An employee whose JD is site-based ticks "Out of Office"; office-based ticks "Office". ---
    const locs = (data.jdWorkLocations || []).map(l => String(l).toUpperCase());
    if (locs.includes('OFFICE')) tickBefore('مكتب - Office');
    if (locs.includes('SITE')) tickBefore('Out of Office - خارج المكتب');

    // --- Type of work order ---
    if (data.workOrderType && WORK_ORDER_LABELS[data.workOrderType]) {
        tickBefore(WORK_ORDER_LABELS[data.workOrderType]);
    }

    // --- Purpose & place ---
    fillAfter('Purpose:', data.purpose);
    fillAfter('Place of Assignment:', data.placeOfAssignment);

    // --- Date covered (first From:/To: pair, anchored on "Date Covered") ---
    fillAfterAnchored('Date Covered', 'From:', data.dateFrom);
    fillAfterAnchored('Date Covered', 'To:', data.dateTo);

    // --- Schedule details (second From:/To: pair, anchored on the Details row) ---
    if (data.scheduleFrom) fillAfterAnchored('Details (for changing schedule', 'From:', data.scheduleFrom);
    if (data.scheduleTo) fillAfterAnchored('Details (for changing schedule', 'To:', data.scheduleTo);

    // --- Signatures ---
    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    let rIdSeq = 980, mediaSeq = 180, docPrSeq = 980;
    const placeSignature = (dataUrl: string | null | undefined, cellIndex: number, name: string) => {
        const png = dataUrlToPng(dataUrl);
        if (!png || cellIndex < 0 || cellIndex >= cells.length) return;
        const dims = pngSize(png) || { width: 480, height: 200 };
        const { cx, cy } = fitEmu(dims.width, dims.height, SIG_MAX_W_EMU, SIG_MAX_H_EMU);
        const rId = `rId${rIdSeq++}`;
        const mediaFile = `wasig${mediaSeq++}.png`;
        zip.file(`word/media/${mediaFile}`, png);
        relsXml = relsXml.replace('</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFile}"/></Relationships>`);
        replacements[cellIndex] = injectRun(replacements[cellIndex] ?? cells[cellIndex], drawingRun(rId, cx, cy, docPrSeq++, name));
    };

    // Each approver row is: [English label] [signature cell] [Arabic label]; the signature cell is
    // the one immediately after the label. Only approvers that have actually decided are stamped.
    const signApprover = (label: string, ap: WorkAuthApprover | null | undefined) => {
        if (!ap || !ap.decided) return;
        const li = findLabel(label);
        if (li < 0) return;
        placeSignature(ap.signature, li + 1, `${label} Signature`);
        if (ap.date) fillIdx(li + 1, `  ${ap.date}`);
    };
    signApprover('Head of Department', data.headOfDepartment);
    signApprover('Head of Division', data.headOfDivision);
    signApprover('Head of Attendance and Payroll Unit', data.headOfAttendance);
    signApprover('Head of Human Resources', data.headOfHR);
    // The General Manager signs the "Signature & Date:" cell under the authentication row.
    signApprover('Signature & Date:', data.generalManager);

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return replacements[idx] ?? cell; });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
