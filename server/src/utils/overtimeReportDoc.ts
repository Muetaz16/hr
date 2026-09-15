// The printable overtime report, built from scratch.
//
// Every other generator in this folder FILLS a company template through docxFormHelpers. There is
// no overtime template in public/, so this one writes its own document.xml. If HR later supplies an
// official form, this file should be replaced by a fillTemplate call rather than extended — a
// hand-built layout will never match a controlled document.
//
// What it is for: the head signs it. The Excel export is what they fill in and return; this is the
// paper record of what was sent and what was authorised, which is why it ends in a signature block
// and carries an empty "Approved" column ruled for handwriting.
import PizZip from 'pizzip';

/** Arabic needs a different font and an explicit RTL run — same split docxFormHelpers uses. */
const ARABIC_RE = /[؀-ۿ]/;

const esc = (v: string): string =>
    (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A run, with the font and direction chosen by the script of the text itself. */
const run = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): string => {
    const sz = opts.size ?? 18; // half-points, so 18 = 9pt
    const arabic = ARABIC_RE.test(text);
    const fonts = arabic
        ? '<w:rFonts w:ascii="Readex Pro Light" w:hAnsi="Readex Pro Light" w:cs="Readex Pro Light"/>'
        : '<w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Readex Pro Light"/>';
    const props = `<w:rPr>${fonts}${opts.bold ? '<w:b/>' : ''}`
        + `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`
        + (opts.color ? `<w:color w:val="${opts.color}"/>` : '')
        + (arabic ? '<w:rtl/>' : '') + '</w:rPr>';
    return `<w:r>${props}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
};

const para = (content: string, opts: { align?: string; spaceAfter?: number } = {}): string =>
    `<w:p><w:pPr>${opts.align ? `<w:jc w:val="${opts.align}"/>` : ''}`
    + `<w:spacing w:after="${opts.spaceAfter ?? 60}"/></w:pPr>${content}</w:p>`;

const cell = (content: string, widthDxa: number, opts: { shade?: string } = {}): string =>
    `<w:tc><w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/>`
    + (opts.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>` : '')
    + '<w:vAlign w:val="center"/></w:tcPr>' + content + '</w:tc>';

const BRAND = '511D29';
// Column widths in twentieths of a point. They sum to 9360 — the printable width of A4 portrait
// with the 1-inch margins set below; anything wider silently overflows the page.
const COLS = [2600, 1500, 2000, 1300, 1200, 760];

export interface OvertimeDocRow {
    name: string;
    empCode: string;
    placement: string;
    recordedMins: number;
    approvedMins: number;
}

export interface OvertimeDocInput {
    groupLabel: string;
    start: string;
    end: string;
    rows: OvertimeDocRow[];
    recordedMins: number;
    approvedMins: number;
}

const hm = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const generateOvertimeReportDocx = (input: OvertimeDocInput): Buffer => {
    const headers = ['Employee', 'Staff Code', 'Belongs to', 'Recorded', 'Approved', 'Sign'];
    const headerRow = '<w:tr><w:trPr><w:tblHeader/></w:trPr>'
        + headers.map((h, i) => cell(para(run(h, { bold: true, size: 17, color: 'FFFFFF' }), { align: 'center' }), COLS[i], { shade: BRAND })).join('')
        + '</w:tr>';

    const bodyRows = input.rows.map((r, ri) => {
        const shade = ri % 2 === 1 ? 'F7F5F6' : undefined;
        const cells = [
            para(run(r.name)),
            para(run(r.empCode), { align: 'center' }),
            para(run(r.placement || '—')),
            para(run(hm(r.recordedMins), { bold: true }), { align: 'center' }),
            // Deliberately blank: this column is ruled for the head to write in by hand.
            para(run(r.approvedMins > 0 ? hm(r.approvedMins) : ' '), { align: 'center' }),
            para(run(' ')),
        ];
        return `<w:tr>${cells.map((c, i) => cell(c, COLS[i], { shade })).join('')}</w:tr>`;
    }).join('');

    const totalRow = '<w:tr>'
        + cell(para(run('TOTAL', { bold: true })), COLS[0], { shade: 'F5EBD9' })
        + cell(para(run(' ')), COLS[1], { shade: 'F5EBD9' })
        + cell(para(run(' ')), COLS[2], { shade: 'F5EBD9' })
        + cell(para(run(hm(input.recordedMins), { bold: true }), { align: 'center' }), COLS[3], { shade: 'F5EBD9' })
        + cell(para(run(input.approvedMins > 0 ? hm(input.approvedMins) : ' '), { align: 'center' }), COLS[4], { shade: 'F5EBD9' })
        + cell(para(run(' ')), COLS[5], { shade: 'F5EBD9' })
        + '</w:tr>';

    const table = '<w:tbl><w:tblPr>'
        + '<w:tblW w:w="9360" w:type="dxa"/>'
        + '<w:tblBorders>'
        + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
            .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="D9D3D6"/>`).join('')
        + '</w:tblBorders>'
        + '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
        + '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>'
        + '</w:tblPr>'
        + `<w:tblGrid>${COLS.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
        + headerRow + bodyRows + totalRow
        + '</w:tbl>';

    const body = [
        para(run('OVERTIME FOR APPROVAL', { bold: true, size: 28, color: BRAND })),
        para(run(input.groupLabel, { bold: true, size: 22 })),
        para(run(`${input.start} to ${input.end}`, { size: 18, color: '7A7A7A' }), { spaceAfter: 240 }),
        table,
        para(run(' '), { spaceAfter: 120 }),
        // The one thing the document must say for itself, because it outlives the screen it came from.
        para(run(
            'Recorded overtime is what the attendance terminal registered. It is not paid until it is approved: '
            + 'payroll pays only approved hours, at the ordinary hourly rate with no premium.',
            { size: 16, color: '7A7A7A' },
        ), { spaceAfter: 360 }),
        para(run('Head of Department: ______________________     Signature: ______________________     Date: ____________', { size: 18 })),
    ].join('');

    const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + `<w:body>${body}`
        + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
        + '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
        + '</w:sectPr></w:body></w:document>';

    const zip = new PizZip();
    zip.file('[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '</Types>');
    zip.file('_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '</Relationships>');
    zip.file('word/document.xml', documentXml);
    // An empty rels part for the document: Word repairs the file without one.
    zip.file('word/_rels/document.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');

    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
