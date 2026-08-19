import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// The blank bilingual "Contract Renewal Form" lives in the app's public folder. We auto-fill the
// Employee Information section (current contract), the Evaluation Month/Score grid, and the
// Renewal Contract Details (the proposed new contract dates) — each located by its printed labels
// — so HR can print the form and collect the physical approval signatures. The renewal decision
// and the signature cells are intentionally left blank for the reviewers to complete.
const TEMPLATE_NAME = 'CONTRACT RENEWAL FORM.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) if (fs.existsSync(p)) return p;
    throw new Error(`Contract renewal template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RPR = `<w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>`;
const textRuns = (value: string): string =>
    value.split(/\r?\n/).map((line, i) =>
        `<w:r>${RPR}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`
    ).join('');

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

export interface ContractRenewalData {
    employeeName: string;
    idNo: string;
    division: string;
    department: string;
    position: string;
    category: string;
    jobGrade: string;
    contractStartDate: string;
    contractEndDate: string;
    // The proposed renewal period (Renewal Contract Details section). Left blank if not provided.
    newContractStartDate?: string;
    newContractEndDate?: string;
    // One entry per month of the evaluation period (the last 6 finalized months).
    // `score` is either the formatted evaluation score or a "not evaluated" note for that month.
    evaluations?: { month: string; score: string }[];
}

export const generateContractRenewalDocx = (data: ContractRenewalData): Buffer => {
    const zip = new PizZip(fs.readFileSync(resolveTemplate()));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed contract renewal template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    // Labels in the Employee Information section each sit in their own cell; the value cell is the
    // one immediately after (a wider, empty cell spanning the rest of the row).
    const findLabel = (label: string): number => {
        for (let i = 0; i < texts.length; i++) if (texts[i] === label) return i;
        // fall back to a contains-match if the exact label wasn't found
        for (let i = 0; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };
    const fillAfter = (label: string, value: string, offset = 1) => {
        if (!value) return;
        const li = findLabel(label);
        if (li < 0) return;
        const index = li + offset;
        if (index < 0 || index >= cells.length) return;
        replacements[index] = setCell(cells[index], textRuns(value));
    };

    fillAfter('Employee Name', data.employeeName);
    fillAfter('ID No.', data.idNo);
    fillAfter('Division', data.division);
    fillAfter('Department', data.department);
    fillAfter('Position', data.position);
    fillAfter('Category', data.category);
    fillAfter('Current Job grade', data.jobGrade);
    fillAfter('Contract Start Date', data.contractStartDate);
    fillAfter('Contract End Date', data.contractEndDate);

    // Renewal Contract Details — the proposed new contract period.
    fillAfter('New Contract Start Date:', data.newContractStartDate || '');
    fillAfter('New Contract End Date:', data.newContractEndDate || '');

    // Evaluation grid: two header cells ("Evaluation Month" | "Evaluation Score") followed by six
    // month/score rows (two cells each). Fill each row from the evaluation period, left cell = the
    // month, right cell = the score (or the "not evaluated" note).
    const evaluations = data.evaluations || [];
    if (evaluations.length > 0) {
        const scoreHeader = findLabel('Evaluation Score');
        if (scoreHeader >= 0) {
            const gridStart = scoreHeader + 1;
            const MAX_ROWS = 6;
            evaluations.slice(0, MAX_ROWS).forEach((row, i) => {
                const monthCell = gridStart + i * 2;
                const scoreCell = monthCell + 1;
                if (scoreCell < cells.length) {
                    replacements[monthCell] = setCell(cells[monthCell], textRuns(row.month));
                    replacements[scoreCell] = setCell(cells[scoreCell], textRuns(row.score));
                }
            });
        }
    }

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return replacements[idx] ?? cell; });

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
