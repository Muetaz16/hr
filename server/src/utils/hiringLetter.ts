import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// The blank bilingual "Hiring Letter" lives in the app's public folder. We treat it as a
// read-only template, drop the enrolled employee's details into the correct table cells
// (located by their printed labels), and hand back a fresh .docx. The approval signature
// boxes are left blank — they are signed by hand.
const TEMPLATE_NAME = 'Hiring Letter - رسالة توظيف.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`Hiring letter template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Values are styled: Montserrat for Latin text, Arial (a non-Kufi face) for Arabic/complex
// script, size 9pt (w:sz is in half-points, so 18).
const valueRun = (value: string): string =>
    `<w:r><w:rPr><w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Arial"/>` +
    `<w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').replace(/\s+/g, ' ').trim();

// Replace a cell's contents with a single clean paragraph holding `value`, preserving the
// cell properties (width/borders) and the first paragraph's properties (alignment). This also
// cleanly clears the pre-printed date placeholders (ـــ/ـ ـــ) in the date cells.
const setCellValue = (cell: string, value: string): string => {
    const open = (cell.match(/^<w:tc\b[^>]*>/) || ['<w:tc>'])[0];
    const tcPr = (cell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
    const pPr = (cell.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
    return `${open}${tcPr}<w:p>${pPr}${valueRun(value)}</w:p></w:tc>`;
};

export interface HiringLetterData {
    letterDate: string;
    employeeId: string;      // staff ID entered at enrolment
    employeeName: string;
    nationality: string;
    contractType: string;
    gender: string;
    dateOfBirth: string;
    birthplace: string;
    bloodType: string;
    email: string;
    contactNumber: string;
    degree: string;
    nationalId: string;
    passportNumber: string;
    department: string;
    unit: string;
    jobPosition: string;
    reportsTo: string;
    jobCategory: string;
    jobGrade: string;
    contractStartDate: string;
    contractEndDate: string;
    placeOfWork: string;
    positionFactor: string;
    locationFactor: string;
    skillFactor: string;
    englishFactor: string;
}

export const generateHiringLetterDocx = (data: HiringLetterData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed hiring letter template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    const findLabel = (label: string): number => {
        for (let i = 0; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };
    const fillAfter = (label: string, value: string, offset = 1) => {
        if (!value) return;
        const li = findLabel(label);
        if (li < 0) return;
        const ti = li + offset;
        if (ti >= cells.length) return;
        replacements[ti] = setCellValue(replacements[ti] ?? cells[ti], value);
    };

    fillAfter('Date:', data.letterDate);
    fillAfter('Employee ID:', data.employeeId);
    fillAfter('Employee Name:', data.employeeName);
    fillAfter('Nationality:', data.nationality);
    fillAfter('Contract Type:', data.contractType);
    fillAfter('Gender:', data.gender);
    fillAfter('Date of Birth:', data.dateOfBirth);
    fillAfter('Birthplace:', data.birthplace);
    fillAfter('Blood Type:', data.bloodType);
    fillAfter('Email Address:', data.email);
    fillAfter('Contact Number:', data.contactNumber);
    fillAfter('Degree:', data.degree);
    fillAfter('National ID:', data.nationalId);
    fillAfter('Passport Number:', data.passportNumber);
    fillAfter('Department:', data.department);
    fillAfter('Unit:', data.unit);
    fillAfter('Job Position:', data.jobPosition);
    fillAfter('Reports to:', data.reportsTo);
    fillAfter('Job Category:', data.jobCategory);
    fillAfter('Job Grade:', data.jobGrade);
    fillAfter('Contract Start Date:', data.contractStartDate);
    fillAfter('Contract End Date:', data.contractEndDate);
    fillAfter('Place of work:', data.placeOfWork);
    fillAfter('Factor for Position:', data.positionFactor);
    fillAfter('Factor for Location/Frontline:', data.locationFactor);
    fillAfter('Skill Factor:', data.skillFactor);
    fillAfter('English Factor:', data.englishFactor);

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        idx++;
        return replacements[idx] ?? cell;
    });

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
