// Shared helpers for embedding a drawn PNG signature into a .docx table cell via raw XML.
// Used by both the interview-evaluation and job-offer generators.

export const EMU_PER_INCH = 914400;

// Read intrinsic pixel dimensions from a PNG buffer (IHDR chunk).
export const pngSize = (buf: Buffer): { width: number; height: number } | null => {
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

// Fit an image inside a box (in EMU) while preserving aspect ratio.
export const fitEmu = (
    width: number,
    height: number,
    maxWEmu: number,
    maxHEmu: number
): { cx: number; cy: number } => {
    if (!width || !height) return { cx: maxWEmu, cy: maxHEmu };
    let cx = maxWEmu;
    let cy = Math.round((maxWEmu * height) / width);
    if (cy > maxHEmu) {
        cy = maxHEmu;
        cx = Math.round((maxHEmu * width) / height);
    }
    return { cx, cy };
};

// Parse a "data:image/png;base64,..." URL into a PNG buffer (or null if unusable).
export const dataUrlToPng = (dataUrl?: string | null): Buffer | null => {
    if (!dataUrl) return null;
    const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim());
    if (!m) return null;
    try {
        return Buffer.from(m[1], 'base64');
    } catch {
        return null;
    }
};

// The inline-image run. `wp` and `r` namespaces come from the document root; `a` and `pic`
// are declared inline (they are not on the root element of these templates).
export const drawingRun = (rId: string, cx: number, cy: number, id: number, name: string): string =>
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="${name}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
