import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

const SIG_MAX_W_EMU = Math.round(1.2 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.4 * EMU_PER_INCH);

// Two bilingual Job Description templates live in the app's public folder:
//   - "general": carries the approval-signatures section (Head of Department, Head of
//     Division/Office, Head of HR, Administrative Director) — signed by hand.
//   - "emp": the employee copy, which ends with an Employee Acknowledgment (name/signature/date)
//     instead of approvals — also signed by hand.
// Both share the same content cells, so one filler serves both. The original files are never
// modified — we fill a copy and return it.
export type JobDescriptionVariant = 'general' | 'emp';

const TEMPLATE_FILES: Record<JobDescriptionVariant, string> = {
    general: 'JOB DESCRIPTION - الوصف الوضيفي - .docx',
    emp: 'JOB DESCRIPTION - الوصف الوضيفيemp.docx',
};

const resolveTemplate = (variant: JobDescriptionVariant): string => {
    const name = TEMPLATE_FILES[variant];
    const candidates = [
        path.join(__dirname, '../../../public', name),
        path.join(process.cwd(), 'public', name),
        path.join(process.cwd(), '../public', name),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`Job description template (public/${name}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RPR = `<w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>`;

// Build runs for a (possibly multi-line) value, preserving line breaks with <w:br/>.
const textRuns = (value: string): string =>
    value.split(/\r?\n/).map((line, i) =>
        `<w:r>${RPR}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`
    ).join('');

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').replace(/\s+/g, ' ').trim();

// Replace a cell's content with a clean, centered paragraph holding the value runs, keeping the
// cell's properties (width/borders).
const setCellValue = (cell: string, runs: string): string => {
    const open = (cell.match(/^<w:tc\b[^>]*>/) || ['<w:tc>'])[0];
    const tcPr = (cell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
    let pPr = (cell.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
    // Force centered alignment for the value.
    if (pPr) {
        pPr = pPr.replace(/<w:jc\b[^>]*\/>/, '');
        pPr = pPr.replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
    } else {
        pPr = '<w:pPr><w:jc w:val="center"/></w:pPr>';
    }
    return `${open}${tcPr}<w:p>${pPr}${runs}</w:p></w:tc>`;
};

export interface JobDescriptionDocData {
    title: string;
    positions: string;
    division: string;
    department: string;
    reportsTo: string;
    placeOfWork: string;
    // Content sections (each already combined bilingual text, may contain line breaks).
    jobPurpose: string;
    keyResponsibilities: string;
    kpi: string;
    education: string;
    experience: string;
    skills: string;
    trainingLicenses: string;
    workingConditions: string;
    // Approval signatures (PNG data URLs) — only used for the "general" variant. Any missing
    // signature leaves its box blank. The employee copy is always signed by hand.
    signatures?: {
        headDept?: string | null;
        headDiv?: string | null;
        headHr?: string | null;
        adminDir?: string | null;
    };
}

export const generateJobDescriptionDocx = (variant: JobDescriptionVariant, data: JobDescriptionDocData): Buffer => {
    const templatePath = resolveTemplate(variant);
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed job description template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    const findLabel = (label: string): number => {
        for (let i = 0; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };
    // Exact (trimmed) match — needed to tell "Administrative Director" apart from the
    // "Administrative Director Authentication" section header above it.
    const findLabelExact = (label: string): number => {
        for (let i = 0; i < texts.length; i++) if (texts[i] === label) return i;
        return -1;
    };
    const fillAfter = (label: string, value: string, offset = 1) => {
        if (!value) return;
        const li = findLabel(label);
        if (li < 0) return;
        const ti = li + offset;
        if (ti >= cells.length) return;
        replacements[ti] = setCellValue(replacements[ti] ?? cells[ti], textRuns(value));
    };

    // Header details
    fillAfter('Position Title:', data.title);
    fillAfter('No. of Positions Required:', data.positions);
    fillAfter('Division', data.division);
    fillAfter('Department', data.department);
    fillAfter('Reports To:', data.reportsTo);
    fillAfter('Place of Work:', data.placeOfWork);
    // Responsibilities
    fillAfter('Job Purpose', data.jobPurpose);
    fillAfter('Key Responsibilities', data.keyResponsibilities);
    fillAfter('Key Performance Indicator', data.kpi);
    // Requirements & qualifications
    fillAfter('Educational Background', data.education);
    fillAfter('Experience Required', data.experience);
    fillAfter('Skills and Competencies', data.skills);
    fillAfter('Required Trainings and Licenses', data.trainingLicenses);
    fillAfter('Working Conditions and Risk Exposure', data.workingConditions);
    // Approval signatures (general variant only). The employee copy has no approval boxes — its
    // acknowledgment signature is always left blank for hand-signing.
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
        relsXml = relsXml.replace(
            '</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFile}"/></Relationships>`
        );
        const open = (cells[cellIndex].match(/^<w:tc\b[^>]*>/) || ['<w:tc>'])[0];
        const tcPr = (cells[cellIndex].match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
        replacements[cellIndex] = `${open}${tcPr}<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${drawingRun(rId, cx, cy, docPrSeq++, name)}</w:p></w:tc>`;
    };
    const sig = data.signatures;
    if (variant === 'general' && sig) {
        const dept = findLabel('Head Of Department');
        if (dept >= 0) placeSignature(sig.headDept, dept + 1, 'Head of Department Signature');
        const div = findLabel('Head of Division/Office');
        if (div >= 0) placeSignature(sig.headDiv, div + 1, 'Head of Division Signature');
        const hr = findLabel('Head of Human Resource');
        if (hr >= 0) placeSignature(sig.headHr, hr + 1, 'Head of HR Signature');
        const admin = findLabelExact('Administrative Director');
        if (admin >= 0) placeSignature(sig.adminDir, admin + 1, 'Administrative Director Signature');
    }

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        idx++;
        return replacements[idx] ?? cell;
    });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
