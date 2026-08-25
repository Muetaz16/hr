import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// The blank bilingual "Personnel Action Form" (internal transfer) lives in the app's public folder.
// We fill the Employee Information (current placement) and Transfer Details (target placement, driven
// by the chosen Job Description) by locating each printed label and rewriting the cell after it. The
// approval/acknowledgement signature cells are left blank for physical signing.
// Internal transfers use "Personnel Action Form.docx"; inter-company transfers use the richer
// "Personnel Action Form to company.docx" (extra approval rows for both companies). Both share the
// same Employee Information + Transfer Details label layout, so the same fill logic serves both.
const TEMPLATE_NAME = 'Personnel Action Form.docx';
export const INTER_COMPANY_TEMPLATE_NAME = 'Personnel Action Form to company.docx';

const resolveTemplate = (templateName: string): string => {
    const candidates = [
        path.join(__dirname, '../../../public', templateName),
        path.join(process.cwd(), 'public', templateName),
        path.join(process.cwd(), '../public', templateName),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
    throw new Error(`Personnel action form template (public/${templateName}) was not found.`);
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

export interface PersonnelActionData {
    // Employee Information (current)
    employeeId: string;
    employeeName: string;
    currentDivision: string;
    currentDepartment: string;
    currentUnit: string;
    currentPosition: string;
    currentJobCategory: string;
    currentJobGrade: string;
    currentReportsTo: string;
    currentWorkLocation: string;
    // Transfer Details (new)
    newDivision: string;
    newDepartment: string;
    newUnit: string;
    newPositionTitle: string;
    newJobCategory: string;
    newJobGrade: string;
    newReportsTo: string;
    newPlaceOfWork: string;
    englishFactor: string;
    positionFactor: string;
    locationFactor: string;
    skillFactor: string;
    typeOfTransfer: string;
    effectivityDate: string;
}

export const generatePersonnelActionDocx = (data: PersonnelActionData, templateName: string = TEMPLATE_NAME): Buffer => {
    const zip = new PizZip(fs.readFileSync(resolveTemplate(templateName)));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed personnel action template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    // Each label sits in its own cell; the value cell is the one immediately after it.
    const findLabel = (label: string): number => {
        for (let i = 0; i < texts.length; i++) if (texts[i] === label) return i;
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

    // Employee Information (current)
    fillAfter('Employee ID:', data.employeeId);
    fillAfter('Employee name:', data.employeeName);
    fillAfter('Current Division:', data.currentDivision);
    fillAfter('Current Department:', data.currentDepartment);
    fillAfter('Current Unit:', data.currentUnit);
    fillAfter('Current Position Title', data.currentPosition);
    fillAfter('Job Category', data.currentJobCategory);
    fillAfter('Job Grade:', data.currentJobGrade);
    fillAfter('Reports to', data.currentReportsTo);       // current (no colon)
    fillAfter('Work Location', data.currentWorkLocation);

    // Transfer Details (new)
    fillAfter('New Division:', data.newDivision);
    fillAfter('New Department:', data.newDepartment);
    fillAfter('New Unit:', data.newUnit);
    fillAfter('New Position title:', data.newPositionTitle);
    fillAfter('New Job category:', data.newJobCategory);
    fillAfter('New Job grade:', data.newJobGrade);
    fillAfter('Reports to:', data.newReportsTo);           // new (with colon)
    fillAfter('Place of work:', data.newPlaceOfWork);
    fillAfter('English Factor:', data.englishFactor);
    fillAfter('Factor for Position:', data.positionFactor);
    fillAfter('Factor for Location/Frontline:', data.locationFactor);
    fillAfter('Skill Factor:', data.skillFactor);
    fillAfter('Type of transfer:', data.typeOfTransfer);
    fillAfter('Effectivity Date:', data.effectivityDate);

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return replacements[idx] ?? cell; });

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
