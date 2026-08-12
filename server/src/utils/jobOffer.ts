import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

// The blank bilingual "Job Offer" form lives in the app's public folder. We treat it as a
// read-only template: we open it, drop the values we know into the correct table cells (located
// by their printed labels, not fragile absolute indexes), embed the preparer signature, and
// hand back a fresh .docx. The original file is never modified.
const TEMPLATE_NAME = 'Job Offer - عرض عمل.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`Job offer template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const valueRun = (value: string): string =>
    `<w:r><w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

// Preparer signature kept small so it sits inside the signature cell without enlarging it.
const SIG_MAX_W_EMU = Math.round(1.2 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.4 * EMU_PER_INCH);

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').replace(/\s+/g, ' ').trim();

const injectRun = (cell: string, run: string): string => {
    if (/<\/w:p>\s*<\/w:tc>$/.test(cell)) {
        return cell.replace(/<\/w:p>\s*<\/w:tc>$/, `${run}</w:p></w:tc>`);
    }
    return cell.replace(/<\/w:tc>$/, `<w:p>${run}</w:p></w:tc>`);
};

export interface OfferData {
    company: string;
    employeeName: string;
    nationality: string;
    jobCategory: string;
    jobGrade: string;
    hourlyRate: string;
    currency: string;
    division: string;
    department: string;
    jobTitle: string;
    reportsTo: string;
    positionFactor: string;
    placeOfWork: string;
    locationFactor: string;
    basicSalary: string;
    grossSalary: string;
    workingDays: string;
    requiredShift: string;
    contractMonths: number; // 3 or 6
    dateSent: string;
    // Approval signatures section
    preparerName: string;              // "Name of Job Offer Preparer"
    technicalInterviewer: string;      // "Technical Interviewer" (name)
    preparerSignature?: string | null; // "Job Offer Preparer Signature" (PNG data URL)
    // Head of HR, Administrative Director and Candidate signatures are signed by hand.
}

/**
 * Fills the blank job-offer template with the supplied values, embeds the preparer signature,
 * and returns the resulting .docx as a Buffer. Salary cells the system can't confirm are left
 * blank for finance; the Head of HR / Administrative Director / Candidate signatures are left
 * blank for hand-signing.
 */
export const generateJobOfferDocx = (data: OfferData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed job offer template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    const findLabel = (label: string, from = 0): number => {
        for (let i = from; i < texts.length; i++) {
            if (texts[i].includes(label)) return i;
        }
        return -1;
    };

    const fillAt = (index: number, value: string) => {
        if (!value || index < 0 || index >= cells.length) return;
        replacements[index] = injectRun(replacements[index] ?? cells[index], valueRun(value));
    };

    const fillAfter = (label: string, value: string, offset = 1) => {
        if (!value) return;
        const li = findLabel(label);
        if (li >= 0) fillAt(li + offset, value);
    };

    // --- Employee details ---
    fillAfter('Company:', data.company);
    fillAfter('Employee name:', data.employeeName);
    fillAfter('Nationality:', data.nationality);

    // --- Basic salary (two label/value pairs per row) ---
    fillAfter('Job category:', data.jobCategory);
    fillAfter('Job grade:', data.jobGrade);
    fillAfter('Hourly rate:', data.hourlyRate);
    fillAfter('Currency:', data.currency);
    fillAfter('Division:', data.division);
    fillAfter('Department:', data.department);
    fillAfter('Job title:', data.jobTitle);
    fillAfter('Reports to:', data.reportsTo);

    // --- Additional factors ---
    fillAfter('Position Factor:', data.positionFactor);
    fillAfter('Place of work:', data.placeOfWork);
    fillAfter('Location Factor', data.locationFactor);
    // Skill Factor: no confirmed value — left blank.

    // --- Salary calculation values (one anchor, fixed offsets across the value row) ---
    // Value row order: Basic | Position | Frontline | Skill | English | Gross.
    {
        const anchor = findLabel('Basic salary + Factors'); // last formula cell before the value row
        if (anchor >= 0) {
            fillAt(anchor + 1, data.basicSalary);      // Basic salary
            fillAt(anchor + 2, data.positionFactor);   // Position Factor
            fillAt(anchor + 3, data.locationFactor);   // Front line Factor
            // anchor + 4 (Skill) and anchor + 5 (English) left blank.
            fillAt(anchor + 6, data.grossSalary);      // Gross salary
        }
    }

    // --- Contract details ---
    fillAfter('Working days:', data.workingDays);
    fillAfter('Required shift:', data.requiredShift);

    // Contract duration: swap the pre-printed "Six Months / ستة أشهر" if a 3-month offer.
    if (data.contractMonths === 3) {
        const li = findLabel('Contract duration:');
        if (li >= 0) {
            const ti = li + 1;
            const cell = replacements[ti] ?? cells[ti];
            replacements[ti] = cell
                .replace('Six Months', 'Three Months')
                .replace('ستة أشهر', 'ثلاثة أشهر');
        }
    }

    // Date of offer sent: replace the pre-printed 20__/__/__ placeholder.
    if (data.dateSent) {
        const li = findLabel('Date of offer sent:');
        if (li >= 0) {
            const ti = li + 1;
            const cell = replacements[ti] ?? cells[ti];
            const replaced = cell.replace(/(<w:t(?: [^>]*)?>)\s*20[_\s]*\/[_\s]*\/[_\s]*(<\/w:t>)/, `$1${escapeXml(data.dateSent)}$2`);
            replacements[ti] = replaced !== cell ? replaced : injectRun(cell, valueRun(data.dateSent));
        }
    }

    // --- Approval signatures (text fields) ---
    fillAfter('Name of Job Offer Preparer:', data.preparerName);
    fillAfter('Technical Interviewer:', data.technicalInterviewer);

    // --- Preparer signature (image). Head of HR / Admin Director / Candidate are hand-signed. ---
    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    const png = dataUrlToPng(data.preparerSignature);
    const prepLabel = findLabel('Job Offer Preparer Signature:');
    if (png && prepLabel >= 0) {
        const ti = prepLabel + 1;
        const dims = pngSize(png) || { width: 480, height: 200 };
        const { cx, cy } = fitEmu(dims.width, dims.height, SIG_MAX_W_EMU, SIG_MAX_H_EMU);
        const rId = 'rId900';
        zip.file('word/media/image100.png', png);
        relsXml = relsXml.replace(
            '</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image100.png"/></Relationships>`
        );
        replacements[ti] = injectRun(replacements[ti] ?? cells[ti], drawingRun(rId, cx, cy, 900, 'Preparer Signature'));
    }

    // Rebuild document.xml with the modified cells in document order.
    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        idx++;
        return replacements[idx] ?? cell;
    });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
