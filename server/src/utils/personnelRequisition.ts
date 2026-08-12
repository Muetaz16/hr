import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

// The blank bilingual "Personnel Requisition Form" (PRF) lives in the app's public folder.
// We fill the requisition's details into the correct table cells (located by label) and embed
// the approval signatures captured through the hire approval workflow.
const TEMPLATE_NAME = 'PERSONNEL REQUISITION FORM -  نموذج طلب توظيف.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) if (fs.existsSync(p)) return p;
    throw new Error(`Personnel requisition template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RPR = `<w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>`;
const textRuns = (value: string): string =>
    value.split(/\r?\n/).map((line, i) =>
        `<w:r>${RPR}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`
    ).join('');

const SIG_MAX_W_EMU = Math.round(1.2 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.4 * EMU_PER_INCH);

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').replace(/\s+/g, ' ').trim();

// Rebuild a cell with a single centered paragraph holding the given runs.
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

export interface PrfData {
    dateRequested: string;
    positionTitle: string;
    positions: string;
    division: string;
    department: string;
    reportsTo: string;
    placeOfWork: string;
    employmentType: string;
    typeOfRequest: string;
    education: string;
    experience: string;
    languageEn: string;
    languageAr: string;
    skills: string;
    preparedBy: string;
    signatures?: {
        deptHead?: string | null;
        divHead?: string | null;
        hiringUnit?: string | null;
        hrHead?: string | null;
        gm?: string | null;
    };
}

export const generatePersonnelRequisitionDocx = (data: PrfData): Buffer => {
    const zip = new PizZip(fs.readFileSync(resolveTemplate()));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed PRF template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    const findLabel = (label: string): number => {
        for (let i = 0; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };
    const fillAt = (index: number, value: string) => {
        if (!value || index < 0 || index >= cells.length) return;
        replacements[index] = setCell(replacements[index] ?? cells[index], textRuns(value));
    };
    const fillAfter = (label: string, value: string, offset = 1) => {
        const li = findLabel(label);
        if (li >= 0) fillAt(li + offset, value);
    };

    fillAfter('Position Title:', data.positionTitle);
    fillAfter('No. of Positions Required:', data.positions);
    fillAfter('Division', data.division);
    fillAfter('Department', data.department);
    fillAfter('Reports To:', data.reportsTo);
    fillAfter('Place of Work:', data.placeOfWork);
    fillAfter('Employment Type:', data.employmentType);
    fillAfter('Type of Request:', data.typeOfRequest);
    fillAfter('Educational Background', data.education);
    fillAfter('Experience Required', data.experience);
    fillAfter('English Language', data.languageEn, 4); // value sits one row below the label
    fillAfter('Arabic Language', data.languageAr, 4);
    fillAfter('Skills and Competencies Required', data.skills);
    fillAfter('Prepared by:', data.preparedBy);

    // Date Requested — replace the pre-printed 20__/__/__ placeholder.
    if (data.dateRequested) {
        const li = findLabel('Date Requested:');
        if (li >= 0) {
            const ti = li + 1;
            const cell = replacements[ti] ?? cells[ti];
            const replaced = cell.replace(/(<w:t(?: [^>]*)?>)\s*20[_\s]*\/[_\s]*\/[_\s]*(<\/w:t>)/, `$1${escapeXml(data.dateRequested)}$2`);
            replacements[ti] = replaced !== cell ? replaced : setCell(cell, textRuns(data.dateRequested));
        }
    }

    // Signatures.
    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    let rIdSeq = 900, mediaSeq = 100, docPrSeq = 900;
    const placeSignature = (dataUrl: string | null | undefined, cellIndex: number, name: string) => {
        const png = dataUrlToPng(dataUrl);
        if (!png || cellIndex < 0 || cellIndex >= cells.length) return;
        const dims = pngSize(png) || { width: 480, height: 200 };
        const { cx, cy } = fitEmu(dims.width, dims.height, SIG_MAX_W_EMU, SIG_MAX_H_EMU);
        const rId = `rId${rIdSeq++}`;
        const mediaFile = `image${mediaSeq++}.png`;
        zip.file(`word/media/${mediaFile}`, png);
        relsXml = relsXml.replace('</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFile}"/></Relationships>`);
        const open = (cells[cellIndex].match(/^<w:tc\b[^>]*>/) || ['<w:tc>'])[0];
        const tcPr = (cells[cellIndex].match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
        replacements[cellIndex] = `${open}${tcPr}<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${drawingRun(rId, cx, cy, docPrSeq++, name)}</w:p></w:tc>`;
    };
    const sig = data.signatures || {};
    const dept = findLabel('Head Of Department'); if (dept >= 0) placeSignature(sig.deptHead, dept + 1, 'Head of Department');
    const div = findLabel('Head of Division/Office'); if (div >= 0) placeSignature(sig.divHead, div + 1, 'Head of Division');
    const hu = findLabel('Head of Hiring Unit'); if (hu >= 0) placeSignature(sig.hiringUnit, hu + 1, 'Head of Hiring Unit');
    const hr = findLabel('Head of Human Resource'); if (hr >= 0) placeSignature(sig.hrHead, hr + 1, 'Head of HR');
    const gm = findLabel('General Manager Authentication'); if (gm >= 0) placeSignature(sig.gm, gm + 3, 'General Manager');

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return replacements[idx] ?? cell; });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
