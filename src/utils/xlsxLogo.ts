// Puts the IPH letterhead logo into a generated .xlsx.
//
// Why this file exists: xlsx-js-style silently drops images. Setting `ws['!images']` produces a
// workbook with no `xl/media` at all and no error — verified. Images are a SheetJS Pro feature.
//
// So the logo is added afterwards, by editing the workbook's zip the same way the .docx generators
// edit their templates. An .xlsx is an OPC package, and anchoring one picture means five things:
//
//   1. xl/media/<file>                      the image bytes
//   2. xl/drawings/drawingN.xml             where it sits, in EMUs, anchored to a cell
//   3. xl/drawings/_rels/drawingN.xml.rels  drawing -> media
//   4. <drawing r:id=".."/> in the sheet    sheet -> drawing, and it must be the LAST child of
//                                           <worksheet> or Excel rejects the file
//   5. [Content_Types].xml                  a Default for png and an Override for the drawing
//
// The anchor values are copied from public/payroll.xlsm, so the logo lands where the company's own
// workbook already puts it rather than somewhere that merely looks right.
import PizZip from 'pizzip';

/** EMUs (English Metric Units) — 914400 per inch. Excel measures drawings in these. */
const EMU_PER_PX = 9525;

export interface LogoAnchor {
    /** 0-based column the picture is pinned to. 1 = column B, as in payroll.xlsm. */
    col: number;
    /** 0-based row. 0 = row 1. */
    row: number;
    widthPx: number;
    heightPx: number;
    /** Small inset so the logo does not touch the cell border, in pixels. */
    offsetXPx?: number;
    offsetYPx?: number;
}

/** The template's own placement: column B, row 1, about 1.49in x 1.65in. */
export const TEMPLATE_LOGO_ANCHOR: LogoAnchor = {
    col: 1,
    row: 0,
    widthPx: 150,
    heightPx: 166,
    offsetXPx: 1,
    offsetYPx: 11,
};

const drawingXml = (a: LogoAnchor): string => {
    const cx = Math.round(a.widthPx * EMU_PER_PX);
    const cy = Math.round(a.heightPx * EMU_PER_PX);
    const offX = Math.round((a.offsetXPx ?? 0) * EMU_PER_PX);
    const offY = Math.round((a.offsetYPx ?? 0) * EMU_PER_PX);
    // oneCellAnchor keeps the picture's size fixed and pinned to one cell, so a wider column or a
    // taller row cannot stretch the logo out of proportion.
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"`
        + ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
        + `<xdr:oneCellAnchor>`
        + `<xdr:from><xdr:col>${a.col}</xdr:col><xdr:colOff>${offX}</xdr:colOff>`
        + `<xdr:row>${a.row}</xdr:row><xdr:rowOff>${offY}</xdr:rowOff></xdr:from>`
        + `<xdr:ext cx="${cx}" cy="${cy}"/>`
        + `<xdr:pic>`
        + `<xdr:nvPicPr><xdr:cNvPr id="2" name="IPH"/>`
        + `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
        + `<xdr:blipFill>`
        + `<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/>`
        + `<a:stretch><a:fillRect/></a:stretch>`
        + `</xdr:blipFill>`
        + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
        + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>`
        + `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
};

const DRAWING_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1"`
    + ` Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"`
    + ` Target="../media/iph-logo.png"/></Relationships>`;

// Deliberately NOT self-closing: a relationship is added below by replacing the closing tag, and
// `<Relationships/>` has none — the insert would silently do nothing and the logo would vanish.
const EMPTY_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `</Relationships>`;

/** Next free rIdN in a .rels part, so an existing relationship is never overwritten. */
const nextRelId = (relsXml: string): string => {
    const used = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map(m => Number(m[1]));
    return `rId${used.length ? Math.max(...used) + 1 : 1}`;
};

/**
 * Returns a new .xlsx buffer with `logo` anchored on the first worksheet.
 *
 * Throws rather than returning the input unchanged if the package is not shaped as expected: a
 * report that quietly comes out without its letterhead is a defect that would ship unnoticed.
 */
export const withLogo = (xlsx: ArrayBuffer | Uint8Array, logo: ArrayBuffer, anchor: LogoAnchor = TEMPLATE_LOGO_ANCHOR): Uint8Array => {
    const zip = new PizZip(xlsx as any);

    const sheetPath = Object.keys(zip.files).find(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
    if (!sheetPath) throw new Error('Cannot add the logo: the workbook has no worksheet part.');
    const sheetName = sheetPath.replace('xl/worksheets/', '');

    let sheetXml = zip.file(sheetPath)!.asText();
    if (sheetXml.includes('<drawing ')) return new Uint8Array(zip.generate({ type: 'uint8array' }));

    // 1 + 2 + 3 — the image and its placement.
    zip.file('xl/media/iph-logo.png', logo as any, { binary: true });
    zip.file('xl/drawings/drawing1.xml', drawingXml(anchor));
    zip.file('xl/drawings/_rels/drawing1.xml.rels', DRAWING_RELS);

    // 4 — sheet -> drawing. <drawing> must come last inside <worksheet>; the schema is ordered and
    // Excel refuses to open the file otherwise.
    const relsPath = `xl/worksheets/_rels/${sheetName}.rels`;
    const existingRels = zip.file(relsPath)?.asText() ?? EMPTY_RELS;
    // An existing part may itself be self-closing if it holds no relationships yet.
    const relsXml = existingRels.replace(
        /<Relationships([^>]*)\/>/,
        '<Relationships$1></Relationships>',
    );
    const relId = nextRelId(relsXml);
    const withDrawing = relsXml.replace(
        '</Relationships>',
        `<Relationship Id="${relId}"`
        + ` Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing"`
        + ` Target="../drawings/drawing1.xml"/></Relationships>`,
    );
    if (withDrawing === relsXml) throw new Error('Cannot add the logo: the worksheet relationships part is malformed.');
    zip.file(relsPath, withDrawing);

    if (!sheetXml.includes('</worksheet>')) throw new Error('Cannot add the logo: malformed worksheet XML.');
    sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="${relId}"/></worksheet>`);
    // SheetJS omits the relationships namespace when nothing references it; r:id needs it declared.
    if (!/xmlns:r="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships"/.test(sheetXml)) {
        sheetXml = sheetXml.replace(
            /<worksheet([^>]*)>/,
            '<worksheet$1 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
        );
    }
    zip.file(sheetPath, sheetXml);

    // 5 — content types. Without both of these Excel reports the file as corrupt.
    const ctPath = '[Content_Types].xml';
    let ct = zip.file(ctPath)?.asText();
    if (!ct) throw new Error('Cannot add the logo: the package has no [Content_Types].xml.');
    if (!ct.includes('Extension="png"')) {
        ct = ct.replace('<Default', '<Default Extension="png" ContentType="image/png"/><Default');
    }
    if (!ct.includes('/xl/drawings/drawing1.xml')) {
        ct = ct.replace(
            '</Types>',
            '<Override PartName="/xl/drawings/drawing1.xml"'
            + ' ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>',
        );
    }
    zip.file(ctPath, ct);

    return new Uint8Array(zip.generate({ type: 'uint8array' }));
};

let cachedLogo: ArrayBuffer | null = null;

/** Fetches (and remembers) the report letterhead. Extracted from public/payroll.xlsm. */
export const loadReportLogo = async (): Promise<ArrayBuffer | null> => {
    if (cachedLogo) return cachedLogo;
    try {
        const res = await fetch('/report-logo.png');
        if (!res.ok) return null;
        cachedLogo = await res.arrayBuffer();
        return cachedLogo;
    } catch {
        // A missing letterhead must not stop a payroll report going out.
        return null;
    }
};

/** Convenience: build a Blob from a workbook buffer, with the logo if it could be loaded. */
export const xlsxBlobWithLogo = async (buffer: ArrayBuffer, anchor?: LogoAnchor): Promise<Blob> => {
    const logo = await loadReportLogo();
    const bytes = logo ? withLogo(buffer, logo, anchor) : new Uint8Array(buffer);
    // Copied into a plain ArrayBuffer: a Uint8Array over a possibly-shared buffer is not a BlobPart.
    const part = new Uint8Array(bytes.length);
    part.set(bytes);
    return new Blob([part.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
