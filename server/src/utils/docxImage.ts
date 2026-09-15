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

// --- Ticked checkbox -------------------------------------------------------------------------
//
// Some templates draw their checkboxes as a tiny embedded IMAGE rather than a "☐" character (the
// Leave Request Form does; the Missing Biometric Log Form uses the character). A character can be
// ticked with a string replace; an image cannot, so we generate a matching ticked box and re-point
// that one cell's <a:blip r:embed> at it. Size and position are untouched, so the ticked box lands
// exactly where the empty one sat.
//
// Drawn from scratch rather than composited onto the template's own image: there is no image
// library in this project, and a hand-drawn square is a faithful stand-in at 0.1 inch.

const crc32 = (buf: Buffer): number => {
    // Node's zlib.crc32 exists from v20.15/22; fall back to a table for older runtimes, because a
    // PNG with wrong CRCs is rejected outright by Word rather than degraded.
    const z = require('zlib');
    if (typeof z.crc32 === 'function') return z.crc32(buf) >>> 0;
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
};

/** Encode an 8-bit greyscale pixel buffer (row-major, `size` x `size`) as a PNG. */
const greyPng = (size: number, px: Uint8Array): Buffer => {
    const zlib = require('zlib');
    const raw = Buffer.alloc((size + 1) * size);
    for (let y = 0; y < size; y++) {
        raw[y * (size + 1)] = 0; // filter: none
        for (let x = 0; x < size; x++) raw[y * (size + 1) + 1 + x] = px[y * size + x];
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 0;  // colour type: greyscale
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
};

/**
 * A square checkbox with a tick in it, as a greyscale PNG.
 *
 * Rendered at 160px and scaled down by Word to roughly a tenth of an inch, which is what keeps the
 * strokes from looking ragged at print size.
 */
export const tickedCheckboxPng = (): Buffer => {
    const S = 160, WHITE = 255, BLACK = 0;
    const px = new Uint8Array(S * S).fill(WHITE);
    const set = (x: number, y: number) => {
        if (x >= 0 && x < S && y >= 0 && y < S) px[y * S + x] = BLACK;
    };
    // Border.
    const b = 12;
    for (let i = 0; i < S; i++) {
        for (let t = 0; t < b; t++) { set(i, t); set(i, S - 1 - t); set(t, i); set(S - 1 - t, i); }
    }
    // Tick: two strokes, drawn thick so they survive the downscale.
    const stroke = (x0: number, y0: number, x1: number, y1: number, w: number) => {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
        for (let s = 0; s <= steps; s++) {
            const x = Math.round(x0 + ((x1 - x0) * s) / steps);
            const y = Math.round(y0 + ((y1 - y0) * s) / steps);
            for (let dx = -w; dx <= w; dx++) for (let dy = -w; dy <= w; dy++) set(x + dx, y + dy);
        }
    };
    stroke(38, 82, 68, 116, 9);
    stroke(68, 116, 124, 44, 9);
    return greyPng(S, px);
};
