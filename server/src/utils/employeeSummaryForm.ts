import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// Fills the branded IPH letterhead ("IPH.docx") to produce a one-page employee handover summary for
// an inter-company transfer. The template ships an EMPTY bordered table whose styling we reuse:
// row 0 = maroon title banner (2 cells), row 1 = grey sub-banner (2 cells), rows 2+ =
// [label | value | arabic] (spans 1|2|1). Rather than fill a fixed 26-row skeleton (which leaves
// ugly empty rows), we clone those row styles and emit EXACTLY the rows we need — sections render as
// grey bands, fields as label/value/arabic rows. The letterhead header/footer are untouched.
const TEMPLATE_NAME = 'IPH.docx';

const resolveTemplate = (): string => {
    const candidates = [
        path.join(__dirname, '../../../public', TEMPLATE_NAME),
        path.join(process.cwd(), 'public', TEMPLATE_NAME),
        path.join(process.cwd(), '../public', TEMPLATE_NAME),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
    throw new Error(`Employee summary template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const runs = (value: string, opts: { bold?: boolean; size?: number; color?: string } = {}): string => {
    const rpr = `<w:rPr><w:rFonts w:cs="Montserrat"/>${opts.color ? `<w:color w:val="${opts.color}"/>` : '<w:color w:val="000000"/>'}${opts.bold ? '<w:b/><w:bCs/>' : ''}${opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : ''}</w:rPr>`;
    return String(value ?? '').split(/\r?\n/).map((line, i) =>
        `<w:r>${rpr}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`
    ).join('');
};

// Replace a cell's body with one paragraph holding the given runs, preserving the cell's own
// properties (shading / borders / width / gridSpan) and vertical centering.
const setCell = (cell: string, runXml: string, align: 'left' | 'center' = 'left'): string => {
    const open = (cell.match(/^<w:tc\b[^>]*>/) || ['<w:tc>'])[0];
    const tcPr = (cell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
    return `${open}${tcPr}<w:p><w:pPr><w:jc w:val="${align}"/></w:pPr>${runXml}</w:p></w:tc>`;
};

// Rebuild a row by mapping each of its cells (in order) through `fillers[i]`. A filler returns the
// new cell XML; missing fillers leave the cell as-is. Preserves the row's <w:trPr>.
const fillRow = (rowXml: string, fillers: Array<(cell: string) => string>): string => {
    let i = -1;
    return rowXml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        i++;
        return fillers[i] ? fillers[i](cell) : cell;
    });
};

export type SummaryItem =
    | { kind: 'section'; label: string; ar?: string }
    | { kind: 'field'; label: string; value: string; ar?: string };
// Back-compat alias.
export type SummaryRow = { label: string; value: string; ar?: string; section?: boolean };

export interface EmployeeSummaryData {
    titleEn: string;
    titleAr: string;
    subtitleLeft: string;
    subtitleRight: string;
    items: SummaryItem[];
}

export const generateEmployeeSummaryDocx = (data: EmployeeSummaryData): Buffer => {
    const zip = new PizZip(fs.readFileSync(resolveTemplate()));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed IPH template: word/document.xml missing.');

    const tblMatch = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
    if (!tblMatch) throw new Error('IPH template: expected a table to fill.');
    const tbl = tblMatch[0];

    const rows = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    if (rows.length < 3) throw new Error('IPH template: table has too few rows to derive styles.');
    const titleRowTpl = rows[0]!;   // maroon banner, 2 cells
    const bandRowTpl = rows[1]!;    // grey banner, 2 cells
    const dataRowTpl = rows[2]!;    // [label | value | arabic]
    const preamble = tbl.slice(0, tbl.indexOf(titleRowTpl)); // <w:tbl> + <w:tblPr> + <w:tblGrid>

    const out: string[] = [];
    // Title banner (white, larger) and sub-banner.
    out.push(fillRow(titleRowTpl, [
        (c) => setCell(c, runs(data.titleEn, { bold: true, size: 26, color: 'FFFFFF' }), 'center'),
        (c) => setCell(c, runs(data.titleAr, { bold: true, size: 26, color: 'FFFFFF' }), 'center'),
    ]));
    out.push(fillRow(bandRowTpl, [
        (c) => setCell(c, runs(data.subtitleLeft, { bold: true, size: 18 }), 'center'),
        (c) => setCell(c, runs(data.subtitleRight, { bold: true, size: 18 }), 'center'),
    ]));

    for (const item of data.items) {
        if (item.kind === 'section') {
            // Grey band spanning the row: section name left, arabic right.
            out.push(fillRow(bandRowTpl, [
                (c) => setCell(c, runs(item.label, { bold: true, size: 20 }), 'left'),
                (c) => setCell(c, runs(item.ar || '', { bold: true, size: 20 }), 'center'),
            ]));
        } else {
            out.push(fillRow(dataRowTpl, [
                (c) => setCell(c, runs(item.label, { bold: true }), 'left'),
                (c) => setCell(c, runs(item.value, {}), 'center'),
                (c) => setCell(c, runs(item.ar || '', { bold: true }), 'center'),
            ]));
        }
    }

    const newTbl = `${preamble}${out.join('')}</w:tbl>`;
    xml = xml.replace(tbl, newTbl);

    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
