// The Cash Advance Request form sent to a service provider for its consent.
//
// The template (public/Cash-Advance.docx) ships a fixed skeleton of TEN numbered employee rows.
// A provider can have more than ten requesters and usually has fewer, so the data row is cloned
// or dropped to match the real list rather than printing blanks or silently truncating at ten —
// truncating a money document would be the worst possible failure here.
//
// Row layout, read off the actual template rather than assumed:
//   3  Date | ____ | To | ____              <- "To" is the provider
//   4  Reference No. | ____ | CC | N/A
//   6  Subject | Cash Advance for Employees
//   7  # | Employee ID | Name | Passport Number | Amount   <- header
//   8..17  one blank numbered row each                     <- the repeatable row
//   18 TOTAL | ____
//   20 HR Division block | Approved by Name / Signature / Date
import fs from 'fs';
import PizZip from 'pizzip';

import { resolveTemplate, textRuns, setCell, cellText } from './docxFormHelpers';

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TEMPLATE_NAME = 'Cash-Advance.docx';

/** Index of the first and last pre-drawn employee row in the template's row list. */
const FIRST_DATA_ROW = 8;
const LAST_DATA_ROW = 17;

export interface CashAdvanceLine {
    staffId: string;
    fullName: string;
    passportNumber: string;
    amount: number;
}

export interface CashAdvanceFormData {
    date: string;
    /** Printed in the "To" box — the provider being asked to consent. */
    providerName: string;
    referenceNo: string;
    currency: string;
    /**
     * Printed over "Head of HR Division" in the signature block. Left as the template's own
     * `(Name of HR Division)` placeholder when it cannot be resolved to exactly one person —
     * printing the wrong name on a document that leaves the company is worse than a blank.
     */
    hrManagerName?: string | null;
    lines: CashAdvanceLine[];
}

const money = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Rewrites a row's cells in order; a null filler leaves that cell untouched. */
const fillRow = (rowXml: string, values: (string | null)[]): string => {
    let i = -1;
    return rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        i++;
        const v = values[i];
        return v === null || v === undefined ? cell : setCell(cell, textRuns(v, 18));
    });
};

/** Writes `value` into the cell immediately after the one whose text is exactly `label`. */
const fillAfterLabel = (xml: string, label: string, value: string): string => {
    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const at = cells.findIndex(c => cellText(c) === label);
    if (at < 0 || at + 1 >= cells.length) return xml;
    const target = cells[at + 1];
    const replacement = setCell(target, textRuns(value, 18));
    let i = -1;
    return xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        i++;
        return i === at + 1 ? replacement : cell;
    });
};

export const generateCashAdvanceDocx = (data: CashAdvanceFormData): Buffer => {
    if (data.lines.length === 0) throw new Error('Cash advance form: there are no employees to print.');

    const zip = new PizZip(fs.readFileSync(resolveTemplate(TEMPLATE_NAME)));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error(`Malformed template: ${TEMPLATE_NAME} is missing word/document.xml.`);

    const rows = xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    if (rows.length <= LAST_DATA_ROW) {
        throw new Error(`Cash advance template: expected at least ${LAST_DATA_ROW + 1} rows, found ${rows.length}.`);
    }

    // The row whose borders, shading and widths every employee line inherits.
    const rowTemplate = rows[FIRST_DATA_ROW];

    const body = data.lines
        .map((l, i) => fillRow(rowTemplate, [
            String(i + 1),
            l.staffId || '—',
            l.fullName || '—',
            l.passportNumber || '—',
            money(l.amount),
        ]))
        .join('');

    // Replace the ten-row block in one pass: the first pre-drawn row becomes the whole list, and
    // rows 9..17 are removed. Done by index rather than by content because the rows are identical.
    let seen = -1;
    xml = xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
        seen++;
        if (seen === FIRST_DATA_ROW) return body;
        if (seen > FIRST_DATA_ROW && seen <= LAST_DATA_ROW) return '';
        return row;
    });

    const total = data.lines.reduce((sum, l) => sum + l.amount, 0);

    xml = fillAfterLabel(xml, 'Date', data.date);
    xml = fillAfterLabel(xml, 'To', data.providerName);
    xml = fillAfterLabel(xml, 'Reference No.', data.referenceNo);
    // The currency travels with the total rather than in a column header: the form has no currency
    // field, and a bare number on a payment authorisation is an invitation to a mistake.
    xml = fillAfterLabel(xml, 'TOTAL', `${money(total)} ${data.currency}`);

    // The placeholder sits alone in its own run, so a literal swap is exact and keeps the
    // paragraph's font, size and alignment untouched.
    if (data.hrManagerName) {
        xml = xml.replace('<w:t>(Name of HR Division)</w:t>', `<w:t>${escapeXml(data.hrManagerName)}</w:t>`);
    }

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
