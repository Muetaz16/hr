import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

// The blank "Interview Evaluation Form" lives in the app's public folder. We treat it as a
// read-only template, drop the values we know into the correct table cells (located by their
// printed labels, not fragile absolute indexes), embed the approver signatures as images, and
// hand back a fresh .docx. The original file is never modified.
const TEMPLATE_NAME = 'INTERVIEW EVALUATION FORM - نموذج تقييم المقابلة.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`Evaluation template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const valueRun = (value: string): string =>
    `<w:r><w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

// ---- image (signature) helpers -----------------------------------------------------------

// Keep signatures small so they sit inside the existing signature box without enlarging it.
const SIG_MAX_W_EMU = Math.round(1.2 * EMU_PER_INCH); // ~1.2" wide
const SIG_MAX_H_EMU = Math.round(0.4 * EMU_PER_INCH); // ~0.4" tall

// ---- cell helpers ------------------------------------------------------------------------

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').replace(/\s+/g, ' ').trim();

// Inject an arbitrary run into a (usually empty) cell, just before it closes.
const injectRun = (cell: string, run: string): string => {
    if (/<\/w:p>\s*<\/w:tc>$/.test(cell)) {
        return cell.replace(/<\/w:p>\s*<\/w:tc>$/, `${run}</w:p></w:tc>`);
    }
    // Cell without a trailing paragraph — wrap the run in one.
    return cell.replace(/<\/w:tc>$/, `<w:p>${run}</w:p></w:tc>`);
};

export interface EvaluationData {
    candidateName: string;
    specialty: string;
    nationality: string;
    recruitingSource: string;
    jobCategory: string;
    workExperience: string;
    jobGrade: string;
    interviewDept: string;
    interviewedBy: string;
    interviewDate: string;
    salaryExpectations: string;
    startDate: string;
    hrEnglish: string;
    hrMotivation: string;
    hrCulturalFit: string;
    hrCommunication: string;
    hrProfessionalism: string;
    techKnowledge: string;
    techProblemSolving: string;
    techRelevantExp: string;
    techSoftware: string;
    techLearning: string;
    hrComment: string;
    techComment: string;
    decision: 'ACCEPTED' | 'REJECTED' | '';
    decisionDept: string;
    decisionUnit: string;
    decisionPosition: string;
    rejectionReason: string;
    recommendedOther: string;
    // Signatures (PNG data URLs). Any missing signature leaves its box blank.
    hrInterviewerSignature?: string | null;   // HR Interviewer signature + Head of HR
    techInterviewerSignature?: string | null; // Technical Interviewer signature + Head of nominated department
}

/**
 * Fills the blank interview-evaluation template with the supplied values and embeds the
 * approver signatures, returning the resulting .docx as a Buffer.
 */
export const generateEvaluationDocx = (data: EvaluationData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed evaluation template: word/document.xml missing.');

    // 1) Enumerate cells in document order so we can locate targets by their printed label.
    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    // Find the first cell whose (trimmed) text contains `label`, optionally after `from`.
    const findLabel = (label: string, from = 0): number => {
        for (let i = from; i < texts.length; i++) {
            if (texts[i].includes(label)) return i;
        }
        return -1;
    };

    // Fill the cell that sits `offset` positions after the labelled cell.
    const fillAfter = (label: string, value: string, offset = 1) => {
        if (!value) return;
        const li = findLabel(label);
        if (li < 0) return;
        const ti = li + offset;
        if (ti >= cells.length) return;
        replacements[ti] = injectRun(replacements[ti] ?? cells[ti], valueRun(value));
    };

    // --- Candidate information (label | value | arabic-label) ---
    fillAfter('Candidate name:', data.candidateName);
    fillAfter('Candidate specialty:', data.specialty);
    fillAfter('Candidate nationality:', data.nationality);
    fillAfter('Recruiting source:', data.recruitingSource);
    fillAfter('Job category', data.jobCategory);
    fillAfter('Work experience in the profession', data.workExperience);
    fillAfter('Job grade according to work experience', data.jobGrade);

    // --- Interview details ---
    fillAfter('Interview for the department:', data.interviewDept);
    fillAfter('Interviewed by:', data.interviewedBy);
    fillAfter('Salary expectations:', data.salaryExpectations);

    // --- Evaluation grades (criterion | score) ---
    fillAfter('English Proficiency', data.hrEnglish);
    fillAfter('Motivation for Role', data.hrMotivation);
    fillAfter('Cultural Fit', data.hrCulturalFit);
    fillAfter('Communication Skills', data.hrCommunication);
    fillAfter('Professionalism', data.hrProfessionalism);
    fillAfter('Technical Knowledge', data.techKnowledge);
    fillAfter('Problem-Solving Skills', data.techProblemSolving);
    fillAfter('Relevant Experience', data.techRelevantExp);
    fillAfter('Software/Tool Proficiency', data.techSoftware);
    fillAfter('Learning Adaptability', data.techLearning);

    // --- Additional comments (two labels in one row, two value cells in the next row) ---
    // Anchor on the Technical Interviewer comment label; the next two cells are the value boxes.
    {
        const li = findLabel('Technical Interviewer /'); // comment label (no "signature")
        if (li >= 0) {
            if (data.hrComment) replacements[li + 1] = injectRun(replacements[li + 1] ?? cells[li + 1], valueRun(data.hrComment));
            if (data.techComment) replacements[li + 2] = injectRun(replacements[li + 2] ?? cells[li + 2], valueRun(data.techComment));
        }
    }

    // --- Final decision detail rows ---
    fillAfter('Department:', data.decisionDept);
    fillAfter('Unit', data.decisionUnit);
    fillAfter('Position:', data.decisionPosition);
    fillAfter('Rejection reason:', data.rejectionReason);
    fillAfter('Recommended for another role:', data.recommendedOther);

    // --- Interview date / start date (replace the pre-printed 20__/__/__ placeholder) ---
    const setDate = (label: string, value: string) => {
        if (!value) return;
        const li = findLabel(label);
        if (li < 0) return;
        const ti = li + 1;
        const cell = replacements[ti] ?? cells[ti];
        const replaced = cell.replace(/(<w:t(?: [^>]*)?>)\s*20[_\s]*\/[_\s]*\/[_\s]*(<\/w:t>)/, `$1${escapeXml(value)}$2`);
        replacements[ti] = replaced !== cell ? replaced : injectRun(cell, valueRun(value));
    };
    setDate('Interview date:', data.interviewDate);
    setDate('Approximate start date:', data.startDate);

    // --- Final-decision checkboxes (☐ → ☑) ---
    const tick = (label: string) => {
        const li = findLabel(label);
        if (li < 0) return;
        const ti = li + 1;
        const cell = replacements[ti] ?? cells[ti];
        replacements[ti] = cell.replace('☐', '☑');
    };
    if (data.decision === 'ACCEPTED') tick('ACCEPTED');
    if (data.decision === 'REJECTED') tick('REJECTED');

    // 2) Signatures — collect the images to embed, then wire up media + relationships.
    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    let rIdSeq = 900;
    let mediaSeq = 100;
    let docPrSeq = 900;

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
        const run = drawingRun(rId, cx, cy, docPrSeq++, name);
        replacements[cellIndex] = injectRun(replacements[cellIndex] ?? cells[cellIndex], run);
    };

    // Interviewer signatures: labels in one row, the two value cells in the next row.
    // The "Approval Signatures" section (Head of HR / Head of nominated department) is left
    // blank on purpose — those are signed by hand.
    const sigLabel = findLabel('Technical Interviewer signature');
    if (sigLabel >= 0) {
        placeSignature(data.hrInterviewerSignature, sigLabel + 1, 'HR Interviewer Signature');
        placeSignature(data.techInterviewerSignature, sigLabel + 2, 'Technical Interviewer Signature');
    }

    // 3) Rebuild document.xml by swapping in the modified cells in document order.
    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        idx++;
        return replacements[idx] ?? cell;
    });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
