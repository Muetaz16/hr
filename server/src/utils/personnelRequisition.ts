import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';
import { textRuns, cellText, setCell } from './docxFormHelpers';

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

const SIG_MAX_W_EMU = Math.round(1.2 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.4 * EMU_PER_INCH);

// Only used for the Date Requested placeholder's narrow in-place regex substitution below (which
// preserves that run's own existing formatting rather than rebuilding the cell via textRuns/setCell).
const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PrfData {
    dateRequested: string;
    positionTitle: string;
    positionTitleAr?: string;
    positions: string;
    division: string;
    divisionAr?: string;
    department: string;
    departmentAr?: string;
    reportsTo: string;
    reportsToAr?: string;
    placeOfWork: string;
    placeOfWorkAr?: string;
    employmentType: string;
    employmentTypeAr?: string;
    typeOfRequest: string;
    typeOfRequestAr?: string;
    education: string;
    educationAr?: string;
    experience: string;
    experienceAr?: string;
    languageEn: string;
    languageAr: string;
    skills: string;
    skillsAr?: string;
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
    // 7pt (14 half-points) — matches the template's own row-label font size.
    const VALUE_SIZE_HALF_POINTS = 14;
    const fillAt = (index: number, value: string) => {
        if (!value || index < 0 || index >= cells.length) return;
        replacements[index] = setCell(replacements[index] ?? cells[index], textRuns(value, VALUE_SIZE_HALF_POINTS));
    };
    const fillAfter = (label: string, value: string, offset = 1) => {
        const li = findLabel(label);
        if (li >= 0) fillAt(li + offset, value);
    };
    // Each field row now carries two value cells between its English and Arabic labels
    // (the template was updated to hold both languages side by side) — fill both.
    const fillPair = (label: string, en: string, ar?: string) => {
        const li = findLabel(label);
        if (li < 0) return;
        fillAt(li + 1, en);
        fillAt(li + 2, ar || '');
    };

    fillPair('Position Title:', data.positionTitle, data.positionTitleAr);
    fillAfter('No. of Positions Required:', data.positions);
    fillPair('Division', data.division, data.divisionAr);
    fillPair('Department', data.department, data.departmentAr);
    fillPair('Reports To:', data.reportsTo, data.reportsToAr);
    fillPair('Place of Work:', data.placeOfWork, data.placeOfWorkAr);
    fillPair('Employment Type:', data.employmentType, data.employmentTypeAr);
    fillPair('Type of Request:', data.typeOfRequest, data.typeOfRequestAr);
    fillPair('Educational Background', data.education, data.educationAr);
    fillPair('Experience Required', data.experience, data.experienceAr);
    fillAfter('English Language', data.languageEn, 4); // value sits one row below the label
    fillAfter('Arabic Language', data.languageAr, 4);
    fillPair('Skills and Competencies Required', data.skills, data.skillsAr);
    fillAfter('Prepared by:', data.preparedBy);

    // Date Requested — replace the pre-printed 20__/__/__ placeholder.
    if (data.dateRequested) {
        const li = findLabel('Date Requested:');
        if (li >= 0) {
            const ti = li + 1;
            const cell = replacements[ti] ?? cells[ti];
            const replaced = cell.replace(/(<w:t(?: [^>]*)?>)\s*20[_\s]*\/[_\s]*\/[_\s]*(<\/w:t>)/, `$1${escapeXml(data.dateRequested)}$2`);
            replacements[ti] = replaced !== cell ? replaced : setCell(cell, textRuns(data.dateRequested, VALUE_SIZE_HALF_POINTS));
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
