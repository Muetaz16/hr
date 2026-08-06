import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// The blank "Interview Evaluation Form" lives in the app's public folder. We treat it as a
// read-only template, drop the values we know into the correct table cells, and hand back a
// fresh .docx. The original file is never modified.
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public/EVALUATION.docx'),
    path.join(process.cwd(), 'public/EVALUATION.docx'),
    path.join(process.cwd(), '../public/EVALUATION.docx'),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error('Evaluation template (public/EVALUATION.docx) was not found.');
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const valueRun = (value: string): string =>
    `<w:r><w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

// Cell indexes are stable in the shipped template (public/EVALUATION.docx), verified by extraction.
const CELL_VALUES: Record<number, keyof EvaluationData> = {
    // Candidate information
    5: 'candidateName',
    8: 'specialty',
    11: 'nationality',
    14: 'recruitingSource',
    17: 'jobCategory',
    20: 'workExperience',
    23: 'jobGrade',
    // Interview details
    28: 'interviewDept',
    31: 'interviewedBy',
    37: 'salaryExpectations',
    40: 'startDate',
    // HR evaluation grades (1-5)
    46: 'hrEnglish',
    48: 'hrMotivation',
    50: 'hrCulturalFit',
    52: 'hrCommunication',
    54: 'hrProfessionalism',
    // Technical evaluation grades (1-5)
    58: 'techKnowledge',
    60: 'techProblemSolving',
    62: 'techRelevantExp',
    64: 'techSoftware',
    66: 'techLearning',
    // Additional comments
    72: 'hrComment',
    74: 'techComment',
    // Final decision detail
    87: 'decisionDept',
    89: 'decisionUnit',
    91: 'decisionPosition',
    97: 'rejectionReason',
    99: 'recommendedOther',
};

const DATE_CELL_INDEX = 34;    // "Interview date" (pre-printed 20__/__/__)
const ACCEPT_CHECKBOX = 84;    // ACCEPTED ☐
const REJECT_CHECKBOX = 94;    // REJECTED ☐

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
}

/**
 * Fills the blank interview-evaluation template with the supplied values and returns the
 * resulting .docx as a Buffer. Signature and approval-date cells are left blank to be signed.
 */
export const generateEvaluationDocx = (data: EvaluationData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed evaluation template: word/document.xml missing.');

    let cellIndex = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        cellIndex++;

        // Fill an empty value cell by inserting a run just before it closes.
        const field = CELL_VALUES[cellIndex];
        if (field) {
            const value = String(data[field] ?? '');
            if (!value) return cell;
            return cell.replace(/<\/w:p>\s*<\/w:tc>$/, `${valueRun(value)}</w:p></w:tc>`);
        }

        // Interview date: replace the pre-printed placeholder, keeping paragraph props.
        if (cellIndex === DATE_CELL_INDEX && data.interviewDate) {
            return cell.replace(/(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/, (_m, open, body, close) => {
                const pPr = (body.match(/^<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
                return `${open}${pPr}${valueRun(data.interviewDate)}${close}`;
            });
        }

        // Tick the correct final-decision checkbox (☐ → ☑).
        if (cellIndex === ACCEPT_CHECKBOX && data.decision === 'ACCEPTED') {
            return cell.replace('☐', '☑');
        }
        if (cellIndex === REJECT_CHECKBOX && data.decision === 'REJECTED') {
            return cell.replace('☐', '☑');
        }

        return cell;
    });

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
