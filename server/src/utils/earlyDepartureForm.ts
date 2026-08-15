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
const SIG_MAX_H_EMU = Math.round(0.45 * EMU_PER_INCH);

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

export interface EarlyDepartureApprover {
    signature?: string | null;
    date?: string;
    decided: boolean;
}

export interface EarlyDepartureData {
    employeeId: string;
    employeeName: string;
    positionTitle: string;
    division: string;
    department: string;
    requestType: 'LATE_COMING' | 'EARLY_LEAVING' | 'HOURS_LEAVE';
    date: string;              // request date
    timeWindow: string;        // "HH:MM - HH:MM"
    totalHours: string;
    employeeSignature?: string | null;
    employeeSignatureDate?: string;
    directSupervisor?: EarlyDepartureApprover | null;
    headOfDepartment?: EarlyDepartureApprover | null;
    headOfAttendance?: EarlyDepartureApprover | null;
}

export const generateEarlyDepartureDocx = (data: EarlyDepartureData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed early departure template: word/document.xml missing.');

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
    const fillAfter = (label: string, value: string, offset = 1) => {
        const li = findLabel(label);
        if (li >= 0) fillIdx(li + offset, value);
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
    fillAfter('Employee ID:', data.employeeId);
    fillAfter('Employee Name:', data.employeeName);
    fillAfter('Position Title:', data.positionTitle);
    fillAfter('Division', data.division);
    fillAfter('Department', data.department);

    // --- Request type checkbox ---
    if (data.requestType === 'LATE_COMING') tickBefore('Late Arrival /');
    else tickBefore('Early Departure /');

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

    // Employee signature — the "Signature and Date:" value cell.
    {
        const li = findLabel('Signature and Date');
        if (li >= 0) {
            placeSignature(data.employeeSignature, li + 1, 'Employee Signature');
            if (data.employeeSignatureDate) fillIdx(li + 1, ` ${data.employeeSignatureDate}`);
        }
    }

    // Approver rows: tick "Approved" and drop the signature in the following "Name and Signature" cell.
    const signApprover = (approverLabel: string, ap?: EarlyDepartureApprover | null) => {
        if (!ap || !ap.decided) return;
        const li = findLabel(approverLabel);
        if (li < 0) return;
        // Tick the first "Approved" checkbox after this approver's label.
        const appLi = findLabel('Approved', li);
        if (appLi > 0) {
            const ci = appLi - 1;
            const cell = replacements[ci] ?? cells[ci];
            if (cell.includes('☐')) replacements[ci] = cell.replace('☐', '☑');
        }
        // Place the signature in the next "Name and Signature" cell.
        const sigLi = findLabel('Name and Signature', li);
        if (sigLi >= 0) {
            placeSignature(ap.signature, sigLi, `${approverLabel} Signature`);
            if (ap.date) fillIdx(sigLi, `  ${ap.date}`);
        }
    };
    signApprover('Direct Supervisor', data.directSupervisor);
    signApprover('Head of Department', data.headOfDepartment);
    signApprover('Head of Attendance', data.headOfAttendance);

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return centerAllParagraphs(replacements[idx] ?? cell); });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
