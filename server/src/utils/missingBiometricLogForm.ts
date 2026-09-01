import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

// Fills the official "Missing Biometric Log Form" (نموذج سجل البصمة المفقود) that ships in the public
// folder, used for the Missing Punch request (a forgotten check-in / check-out). Read-only template:
// we drop values into the correct cells (located by their printed labels), tick the relevant Word
// content-control checkboxes, embed each approver's signature, and hand back a fresh .docx. Pending
// approvers are left blank so the same call yields a live copy and, once complete, the final record.
const TEMPLATE_NAME = 'Missing Biometric Log Form.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) if (fs.existsSync(p)) return p;
    throw new Error(`Missing Biometric Log form template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const valueRun = (value: string): string =>
    `<w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

const SIG_MAX_W_EMU = Math.round(1.4 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.45 * EMU_PER_INCH);

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim();

const centerPPr = (pPr: string): string => {
    const cleaned = pPr.replace(/<w:jc\b[^>]*\/>/g, '').replace(/<w:ind\b[^>]*\/>/g, '');
    if (/<w:rPr>/.test(cleaned)) return cleaned.replace(/<w:rPr>/, '<w:jc w:val="center"/><w:rPr>');
    return cleaned.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
};

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

export type MissingPunchType = 'CHECK_IN' | 'CHECK_OUT' | 'BOTH';
export type MissingPunchReason = 'FORGOT' | 'DEVICE_ISSUE' | 'POWER_OUTAGE' | 'OTHERS';

export interface MissingPunchApprover {
    signature?: string | null;
    decided: boolean;
}

export interface MissingBiometricLogData {
    employeeId: string;
    employeeName: string;
    positionTitle: string;
    division: string;
    department: string;
    workingSchedule: string;         // resolved via resolveScheduledWorkHours — "HH:mm - HH:mm"
    // The employee's Job Description work locations ('OFFICE' / 'SITE'), same source as the Work
    // Authorization form — drives the Office / Site checkbox; not a per-request choice.
    jdWorkLocations?: string[];
    date: string;                    // the date of the missing record
    recordType: MissingPunchType;
    reason: MissingPunchReason;
    headOfDeptDivision?: MissingPunchApprover | null;   // "Head of Department/ Division" approval
    headOfAttendance?: MissingPunchApprover | null;     // HR — "Head of Attendance and Payroll Unit"
}

export const generateMissingBiometricLogDocx = (data: MissingBiometricLogData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed missing-biometric template: word/document.xml missing.');

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
    // Tick the Word content-control checkbox that sits in the cell immediately AFTER a label:
    // flip its checked state and swap the displayed ☐ glyph (U+2610) for ☒ (U+2612).
    const tickAfter = (label: string, offset = 1) => {
        const li = findLabel(label);
        if (li < 0) return;
        const ci = li + offset;
        if (ci < 0 || ci >= cells.length) return;
        let cell = replacements[ci] ?? cells[ci];
        // Tick with a CHECK mark (☑, U+2611) rather than the ☒ cross: flip the content-control state,
        // switch its checkedState glyph to the checked box, and swap the displayed ☐ for ☑.
        cell = cell.replace(/<w14:checked w14:val="0"\/>/, '<w14:checked w14:val="1"/>');
        cell = cell.replace(/<w14:checkedState w14:val="2612"/, '<w14:checkedState w14:val="2611"');
        cell = cell.replace(/☐/g, '☑');
        replacements[ci] = cell;
    };

    // --- Employee information ---
    fillAfter('Employee ID', data.employeeId);
    fillAfter('Employee Name', data.employeeName);
    fillAfter('Position Title', data.positionTitle);
    fillAfter('Division', data.division);
    fillAfter('Department', data.department);
    fillAfter('Working Schedule', data.workingSchedule);
    // Work location comes from the employee's Job Description (OFFICE / SITE), not the request.
    const locs = (data.jdWorkLocations || []).map(l => String(l).toUpperCase());
    if (locs.includes('OFFICE')) tickAfter('Office');
    if (locs.includes('SITE')) tickAfter('Site');

    // --- Missing Biometric Log details ---
    fillAfter('Date', data.date);
    if (data.recordType === 'CHECK_IN') tickAfter('Check in');
    else if (data.recordType === 'CHECK_OUT') tickAfter('Check out');
    else if (data.recordType === 'BOTH') tickAfter('Both');

    if (data.reason === 'FORGOT') tickAfter('Forgot to Log');
    else if (data.reason === 'DEVICE_ISSUE') tickAfter('Device/System Issue');
    else if (data.reason === 'POWER_OUTAGE') tickAfter('Power Outage');
    else if (data.reason === 'OTHERS') tickAfter('Others');

    // --- Signatures ---
    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    let rIdSeq = 990, mediaSeq = 190, docPrSeq = 990;
    const placeSignature = (dataUrl: string | null | undefined, cellIndex: number, name: string) => {
        const png = dataUrlToPng(dataUrl);
        if (!png || cellIndex < 0 || cellIndex >= cells.length) return;
        const dims = pngSize(png) || { width: 480, height: 200 };
        const { cx, cy } = fitEmu(dims.width, dims.height, SIG_MAX_W_EMU, SIG_MAX_H_EMU);
        const rId = `rId${rIdSeq++}`;
        const mediaFile = `mblsig${mediaSeq++}.png`;
        zip.file(`word/media/${mediaFile}`, png);
        relsXml = relsXml.replace('</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFile}"/></Relationships>`);
        replacements[cellIndex] = injectRun(replacements[cellIndex] ?? cells[cellIndex], drawingRun(rId, cx, cy, docPrSeq++, name));
    };

    // Head of Department/Division — tick Approved (or Rejected) and drop the signature in the
    // "Name and Signature" value cell.
    if (data.headOfDeptDivision?.decided) {
        tickAfter('Approved');
        const li = findLabel('Name and Signature');
        if (li >= 0) {
            placeSignature(data.headOfDeptDivision.signature, li + 1, 'Head of Department/Division Signature');
        }
    }

    // HR — Head of Attendance and Payroll Unit: signature in the value cell next to the label.
    if (data.headOfAttendance?.decided) {
        const li = findLabel('Head of Attendance and Payroll');
        if (li >= 0) {
            placeSignature(data.headOfAttendance.signature, li + 1, 'Head of Attendance Signature');
        }
    }

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return centerAllParagraphs(replacements[idx] ?? cell); });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
