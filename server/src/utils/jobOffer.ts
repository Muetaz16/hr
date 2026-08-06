import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// The blank bilingual "Job Offer" form lives in the app's public folder. We treat it as a
// read-only template: we open it, drop the values we know into the correct table cells, and
// hand back a fresh .docx. The original file is never modified.
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public/jop offer.docx'),
    path.join(process.cwd(), 'public/jop offer.docx'),
    path.join(process.cwd(), '../public/jop offer.docx'),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error('Job offer template (public/jop offer.docx) was not found.');
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A single run styled to match the template's font (not bold), to drop into a value cell.
const valueRun = (value: string): string =>
    `<w:r><w:rPr><w:rFonts w:cs="Montserrat"/><w:color w:val="000000"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

// The table cells in the template are stable in order. These indexes point at the empty
// value cell that sits between each English label and its Arabic counterpart. Verified against
// the shipped template (public/jop offer.docx).
const CELL_VALUES: Record<number, keyof OfferData> = {
    8: 'company',
    11: 'employeeName',
    14: 'nationality',
    19: 'jobCategory',
    22: 'jobGrade',
    25: 'hourlyRate',
    28: 'currency',
    31: 'division',
    34: 'department',
    37: 'jobTitle',
    40: 'reportsTo',
    45: 'positionFactor',  // ADDITIONAL FACTORS — filled for head roles
    48: 'placeOfWork',
    51: 'locationFactor',  // ADDITIONAL FACTORS — frontline factor, filled for on-site work
    71: 'basicSalary',     // SALARY CALCULATION row — "Basic salary"
    72: 'positionFactor',  // SALARY CALCULATION row — "Position Factor x Basic salary" (shows the factor, e.g. 1.4)
    73: 'locationFactor',  // SALARY CALCULATION row — "Front line Factor x Basic salary" (shows the factor, e.g. 1.1)
    76: 'grossSalary',     // SALARY CALCULATION row — "Gross salary" (Basic salary + factors)
    86: 'workingDays',     // CONTRACT DETAILS — "Working days"
    89: 'requiredShift',   // CONTRACT DETAILS — "Required shift"
};

// The "Contract duration" cell (index 80) ships pre-printed with "Six Months / ستة أشهر".
// We swap those runs to reflect the chosen length rather than filling an empty cell.
const CONTRACT_CELL_INDEX = 80;

// The "Date offer sent" cell already carries a blank placeholder ("20____/____/____"),
// so it is handled separately: we replace the paragraph body rather than fill an empty cell.
const DATE_CELL_INDEX = 92;

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
}

/**
 * Fills the blank job-offer template with the supplied values and returns the resulting
 * .docx as a Buffer. Salary / grade / factor cells are intentionally left blank for HR to
 * complete — the candidate record does not yet carry confirmed compensation figures.
 */
export const generateJobOfferDocx = (data: OfferData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed job offer template: word/document.xml missing.');

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

        // Swap the pre-printed "Six Months / ستة أشهر" for the chosen contract length.
        if (cellIndex === CONTRACT_CELL_INDEX && data.contractMonths === 3) {
            return cell
                .replace('<w:t>Six Months</w:t>', '<w:t>Three Months</w:t>')
                .replace('<w:t>ستة أشهر</w:t>', '<w:t>ثلاثة أشهر</w:t>');
        }

        // Replace the pre-printed date placeholder with the actual date, keeping paragraph props.
        if (cellIndex === DATE_CELL_INDEX && data.dateSent) {
            return cell.replace(
                /(<w:pPr>[\s\S]*?<\/w:pPr>)[\s\S]*?(<\/w:p>\s*<\/w:tc>)$/,
                (_m, pPr, tail) => `${pPr}${valueRun(data.dateSent)}${tail}`
            );
        }

        return cell;
    });

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
