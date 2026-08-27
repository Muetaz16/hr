import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

// Generic PizZip cell-rewrite technique for filling the company's official bilingual .docx form
// templates (public/*.docx): locate each printed label's cell and rewrite the cell some fixed
// offset after it (the value slot), then re-zip. Signature lines are always left blank for
// physical signing — this only fills data fields, never "Signature and Date" cells. Shared between
// disciplinaryForms.ts and offboardingForms.ts (and any future form module) — genuinely
// template-agnostic, not specific to either domain.
export const resolveTemplate = (name: string): string => {
    const candidates = [
        path.join(__dirname, '../../../public', name),
        path.join(process.cwd(), 'public', name),
        path.join(process.cwd(), '../public', name),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
    throw new Error(`Form template (public/${name}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Values may mix English and Arabic (bilingual fields print both languages, one per line) — each
// line gets the font matching its own script rather than a single font for the whole cell.
const ARABIC_RE = /[؀-ۿ]/;
// 8pt (w:sz is in half-points) — matches the templates' own label font size, so filled-in values
// don't blow up row heights the way an inherited larger default size did. `sizeHalfPoints` lets
// fillTemplate shrink long values that would otherwise wrap past 2 lines in an already-maxed-width
// cell (see fittingFontSize below).
export const textRuns = (value: string, sizeHalfPoints: number = 16): string => {
    const sizeTag = `<w:sz w:val="${sizeHalfPoints}"/><w:szCs w:val="${sizeHalfPoints}"/>`;
    const rprEn = `<w:rPr><w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Readex Pro Light"/><w:color w:val="000000"/>${sizeTag}</w:rPr>`;
    const rprAr = `<w:rPr><w:rFonts w:ascii="Readex Pro Light" w:hAnsi="Readex Pro Light" w:cs="Readex Pro Light"/><w:color w:val="000000"/>${sizeTag}<w:rtl/></w:rPr>`;
    return value.split(/\r?\n/).map((line, i) => {
        const rpr = ARABIC_RE.test(line) ? rprAr : rprEn;
        return `<w:r>${rpr}${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`;
    }).join('');
};

// A long value in a narrow (or even fully-merged) cell can still wrap past 2 lines, blowing out
// the row height. Rather than widen cells beyond their already-merged width, step the font size
// down just enough to fit within 2 lines.
export const fittingFontSize = (value: string, widthDxa: number): number => {
    if (!widthDxa) return 16;
    const AVG_CHAR_WIDTH_DXA = 100; // empirical for Montserrat/Readex Pro Light at 8pt
    const charsPerLine = Math.max(10, Math.floor(widthDxa / AVG_CHAR_WIDTH_DXA));
    const linesAt8pt = Math.ceil(value.length / charsPerLine);
    if (linesAt8pt <= 2) return 16; // 8pt
    if (linesAt8pt <= 3) return 14; // 7pt
    if (linesAt8pt <= 4) return 12; // 6pt
    return 10; // 5pt floor — stays legible rather than shrinking indefinitely
};

// The templates' own static text (titles, column labels, the "Document Reference No" line above
// the table) each carry their own explicit <w:rFonts> — usually "Monstserrat" (a typo baked into
// the original templates) with no complex-script font set at all, so Arabic in those runs falls
// back to whatever Word's default complex-script font is, never actually Readex Pro Light. This
// rewrites every <w:rFonts> in the document (labels included, not just the values we fill in) to
// the same Montserrat/Readex Pro Light pairing, matching Word's own "Latin text / Complex scripts"
// font dialog — Word then renders each run in the correct font per character script automatically.
export const normalizeTemplateFonts = (xml: string): string =>
    xml.replace(/<w:rFonts\b[^>]*\/>/g, '<w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Readex Pro Light"/>');

// A couple of the official templates (RESIGNATION REQUEST FORM, EMPLOYEE CLEARANCE FORM) were
// authored via a PDF-to-docx conversion that baked their Arabic labels in as Unicode "Arabic
// Presentation Forms" glyphs (e.g. "رﺋيﺲ" — isolated/medial/final-form codepoints straight out of
// the PDF's font) instead of standard Arabic letters ("رئيس"). Any font without those exact
// compatibility glyphs mapped renders them broken/disconnected. NFKC normalization decomposes each
// presentation-form glyph back to its base letter, so the renderer's own Arabic shaping engine can
// join them correctly again — a no-op for the other templates, which already use standard Arabic.
// The templates' bold white-on-maroon section-header bars (form title, "Notes", "Employee's
// Acknowledgment...") stretch every Arabic character to 130-143% width (<w:w>, a per-run horizontal
// scale, unrelated to font size) — tuned by whoever built the template for that header run's
// original font. Readex Pro Light's own glyphs are a different width, so the same stretch factor
// now overflows the header bar and wraps to 2-3 lines instead of the one it was designed for.
// Resets only the aggressive (>=130%) stretches; leaves the many mild ones (~85-120%) used
// elsewhere for ordinary kerning/justification alone, since those aren't implicated in this.
export const normalizeExcessiveCharacterStretch = (xml: string): string =>
    xml.replace(/<w:w w:val="(\d+)"\/>/g, (match, val) => (parseInt(val, 10) >= 130 ? '<w:w w:val="100"/>' : match));

export const normalizeArabicPresentationForms = (xml: string): string =>
    xml.replace(/(<w:t(?: [^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (_m, open, text, close) => `${open}${text.normalize('NFKC')}${close}`);

// Roughly half of every template's runs carry NO <w:rFonts> of their own at all (confirmed by
// counting) — they render via the document's THEME font instead, which normalizeTemplateFonts can't
// reach since it only rewrites existing <w:rFonts> tags. The theme's own "minor font" (the one most
// body text actually uses) defaults to Calibri (Latin) / Arial (Arabic, via the "Arab" script
// override) — never Montserrat/Readex Pro Light. Patching word/theme/theme1.xml's major+minor fonts
// closes that gap so literally everything in the document — templated runs AND theme-inherited ones
// alike — renders in the one required font pairing.
// The templates' NAMED styles (TableParagraph, Normal, BodyText — what virtually every table cell's
// <w:pStyle> actually points to) each carry their own hardcoded <w:rFonts> (seen across the real
// templates: Tahoma, Courier New, Arial, Calibri, one per template). A style's own rFonts outranks
// the theme in Word's cascade, so this is what most "no rFonts at the run level" text actually
// renders in — normalizeThemeFonts alone never reaches it. This is the missing piece for the form as
// a whole, not just the values textRuns() inserts.
export const normalizeStyleFonts = (xml: string): string =>
    xml.replace(
        /(<w:style\b[\s\S]*?<\/w:style>)/g,
        (styleBlock) => styleBlock.replace(/<w:rFonts\b[^>]*\/>/g, '<w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:eastAsia="Montserrat" w:cs="Readex Pro Light"/>')
    );

export const normalizeThemeFonts = (xml: string): string =>
    xml
        .replace(/(<a:latin\s+typeface=")[^"]*(")/g, '$1Montserrat$2')
        .replace(/(<a:cs\s+typeface=")[^"]*(")/g, '$1Readex Pro Light$2')
        .replace(/(<a:font\s+script="Arab"\s+typeface=")[^"]*(")/g, '$1Readex Pro Light$2');

// Reduces (never removes) a specific row's fixed height — used for oversized "Description"-style
// writing boxes whose template-designed height is generous enough that the whole document spills
// a near-empty extra page. Targets ONLY the given row by label, so every other field keeps its
// original template proportions exactly as designed.
export const capRowHeight = (xml: string, label: string, newHeight: number): string => {
    const rows = xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    const row = rows.find(r => (r.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || []).some(c => cellText(c) === label));
    if (!row) return xml;
    const newRow = row.replace(/<w:trHeight\b[^>]*\/>/, `<w:trHeight w:val="${newHeight}"/>`);
    return xml.replace(row, newRow);
};

export const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('').replace(/\s+/g, ' ').trim();

export const getTcW = (cell: string): number => {
    const m = cell.match(/<w:tcW w:w="(\d+)"/);
    return m ? parseInt(m[1], 10) : 0;
};

const setTcW = (tcPr: string, width: number): string => {
    if (/<w:tcW\b[^>]*\/>/.test(tcPr)) {
        return tcPr.replace(/<w:tcW\b[^>]*\/>/, `<w:tcW w:w="${width}" w:type="dxa"/>`);
    }
    return tcPr ? tcPr.replace('<w:tcPr>', `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>`) : `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>`;
};

export const getRightBorder = (cell: string): string => {
    const m = cell.match(/<w:right\b[^>]*\/>/);
    return m ? m[0] : '';
};

export const getGridSpan = (cell: string): number => {
    const m = cell.match(/<w:gridSpan w:val="(\d+)"/);
    return m ? parseInt(m[1], 10) : 1;
};

// Some templates have a STATIC (baked-in, not dynamically filled) cell confined to a narrow column
// with an empty cell wasting space right next to it — e.g. a title banner's Arabic translation, or
// a multi-line "Subject:" block. Widens the named cell by absorbing that neighbor's width entirely
// (removing the neighbor from the row), keeping the named cell's own content untouched.
export const widenStaticCell = (xml: string, textIncludes: string, direction: 'left' | 'right'): string => {
    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const li = texts.findIndex(t => t.includes(textIncludes));
    const neighborIdx = direction === 'right' ? li + 1 : li - 1;
    if (li < 0 || neighborIdx < 0 || neighborIdx >= cells.length) return xml;

    const target = cells[li];
    const neighbor = cells[neighborIdx];
    const width = getTcW(target) + getTcW(neighbor);
    const gridSpan = getGridSpan(target) + getGridSpan(neighbor);
    const rightBorder = direction === 'right' ? (getRightBorder(neighbor) || getRightBorder(target)) : getRightBorder(target);

    let tcPr = (target.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
    tcPr = setTcW(tcPr, width);
    tcPr = /<w:gridSpan\b[^>]*\/>/.test(tcPr)
        ? tcPr.replace(/<w:gridSpan\b[^>]*\/>/, `<w:gridSpan w:val="${gridSpan}"/>`)
        : tcPr.replace('<w:tcPr>', `<w:tcPr><w:gridSpan w:val="${gridSpan}"/>`);
    if (rightBorder) {
        tcPr = /<w:right\b[^>]*\/>/.test(tcPr) ? tcPr.replace(/<w:right\b[^>]*\/>/, rightBorder) : tcPr;
    }
    const body = target.replace(/^<w:tc\b[^>]*>/, '').replace(/<w:tcPr>[\s\S]*?<\/w:tcPr>/, '').replace(/<\/w:tc>$/, '');
    const widened = `<w:tc>${tcPr}${body}</w:tc>`;

    let idx = -1;
    return xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        idx++;
        if (idx === li) return widened;
        if (idx === neighborIdx) return '';
        return cell;
    });
};

export const setCell = (cell: string, runs: string, opts?: { width?: number; gridSpan?: number; rightBorder?: string }): string => {
    const open = (cell.match(/^<w:tc\b[^>]*>/) || ['<w:tc>'])[0];
    let tcPr = (cell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
    // Center the value both horizontally (paragraph jc) and vertically (cell vAlign) — otherwise a
    // multi-line bilingual value sits pinned to the top of its (now taller) cell.
    if (tcPr) {
        tcPr = tcPr.replace(/<w:vAlign\b[^>]*\/>/, '').replace('</w:tcPr>', '<w:vAlign w:val="center"/></w:tcPr>');
    } else {
        tcPr = '<w:tcPr><w:vAlign w:val="center"/></w:tcPr>';
    }
    if (opts?.width !== undefined) tcPr = setTcW(tcPr, opts.width);
    if (opts?.gridSpan !== undefined) {
        tcPr = /<w:gridSpan\b[^>]*\/>/.test(tcPr)
            ? tcPr.replace(/<w:gridSpan\b[^>]*\/>/, `<w:gridSpan w:val="${opts.gridSpan}"/>`)
            : tcPr.replace('<w:tcPr>', `<w:tcPr><w:gridSpan w:val="${opts.gridSpan}"/>`);
    }
    if (opts?.rightBorder) {
        tcPr = /<w:right\b[^>]*\/>/.test(tcPr) ? tcPr.replace(/<w:right\b[^>]*\/>/, opts.rightBorder) : tcPr;
    }
    let pPr = (cell.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
    if (pPr) {
        // Some template cells fake centering with a fixed left/right <w:ind> tuned for one specific
        // static label instead of a real <w:jc> — left in place, it skews OUR centering off to one
        // side (the indent still narrows the paragraph before w:jc=center divides up what's left).
        pPr = pPr.replace(/<w:ind\b[^>]*\/>/, '').replace(/<w:jc\b[^>]*\/>/, '').replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
    } else {
        pPr = '<w:pPr><w:jc w:val="center"/></w:pPr>';
    }
    // Cells that already center correctly all carry <w:bidi w:val="0"/> from the template; cells
    // that never had it don't center Arabic runs symmetrically even with w:jc=center. Normalize
    // every filled cell to the working pattern.
    if (!/<w:bidi\b/.test(pPr)) {
        pPr = pPr.replace('<w:pPr>', '<w:pPr><w:bidi w:val="0"/>');
    }
    return `${open}${tcPr}<w:p>${pPr}${runs}</w:p></w:tc>`;
};

// Fills every {label: value} pair by locating each label's cell and rewriting the cell `offset`
// positions after it (default 1 — the value slot immediately following the label). `mergeSpan`
// is for fields with no separate Arabic translation (dates, IDs, case numbers): the template
// visually presents that value cell plus the next `mergeSpan` cell(s) as one continuous box (hidden
// border between them), so a real `w:gridSpan` merge is applied — the trailing cell(s) are removed
// from the row entirely and their width folded into the value cell — otherwise the value only
// centers within the first (narrower) sub-cell instead of the whole visual box.
export type FieldFill = { label: string; value: string | undefined | null; offset?: number; mergeSpan?: number };

// Shared load step for every generator below: open the template, run every document-wide
// normalization (fonts at the run/style/theme level, Arabic presentation-form glyphs, excessive
// character stretch) once, and hand back the working pieces — `xml` for text-level edits,
// `zip`/`docPath` to write it back and produce the final buffer. Two call shapes build on this:
// the label+offset cell-fill loop (fillTemplate, for label/value-cell templates) and direct
// fillInlineBlank/appendToCellEnd calls (for sentence-with-embedded-blanks templates like the
// Certificate of Employment) — both need the exact same normalized starting point.
export const loadNormalizedTemplate = (templateName: string): { zip: PizZip; docPath: string; xml: string } => {
    const zip = new PizZip(fs.readFileSync(resolveTemplate(templateName)));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error(`Malformed template: ${templateName} is missing word/document.xml.`);
    xml = normalizeTemplateFonts(xml);
    xml = normalizeArabicPresentationForms(xml);
    xml = normalizeExcessiveCharacterStretch(xml);
    xml = centerAllCellsVertically(xml);

    const themePath = 'word/theme/theme1.xml';
    const themeFile = zip.file(themePath);
    if (themeFile) zip.file(themePath, normalizeThemeFonts(themeFile.asText()));

    const stylesPath = 'word/styles.xml';
    const stylesFile = zip.file(stylesPath);
    if (stylesFile) zip.file(stylesPath, normalizeStyleFonts(stylesFile.asText()));

    return { zip, docPath, xml };
};

// Finishes a normalized template: writes the (possibly-edited) xml back into the zip and produces
// the final .docx buffer. Shared by fillTemplate and any generator using loadNormalizedTemplate
// directly (e.g. one built entirely from fillInlineBlank/appendToCellEnd calls).
export const finishTemplate = (zip: PizZip, docPath: string, xml: string): Buffer => {
    zip.file(docPath, xml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

export const fillTemplate = (templateName: string, fields: FieldFill[]): Buffer => {
    // eslint-disable-next-line prefer-const
    let { zip, docPath, xml } = loadNormalizedTemplate(templateName);

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    const findLabel = (label: string): number => {
        for (let i = 0; i < texts.length; i++) if (texts[i] === label) return i;
        for (let i = 0; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };

    for (const { label, value, offset = 1, mergeSpan = 0 } of fields) {
        const li = findLabel(label);
        if (li < 0) continue;
        const index = li + offset;
        if (index < 0 || index >= cells.length) continue;

        if (mergeSpan > 0 && index + mergeSpan < cells.length) {
            // Merge regardless of whether there's a value — an optional field left blank should
            // still present as the one wide box the row was designed as, not fall back to the raw
            // template's un-merged sub-cells (which visually reads as several separate fields).
            let width = getTcW(cells[index]);
            let gridSpan = getGridSpan(cells[index]);
            let rightBorder = '';
            for (let k = 1; k <= mergeSpan; k++) {
                width += getTcW(cells[index + k]);
                gridSpan += getGridSpan(cells[index + k]);
                rightBorder = getRightBorder(cells[index + k]) || rightBorder;
                replacements[index + k] = ''; // remove the absorbed cell from the row entirely
            }
            const runs = value ? textRuns(value, fittingFontSize(value, width)) : '';
            replacements[index] = setCell(cells[index], runs, { width, gridSpan, rightBorder });
        } else if (value) {
            replacements[index] = setCell(cells[index], textRuns(value, fittingFontSize(value, getTcW(cells[index]))));
        }
    }

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return replacements[idx] ?? cell; });

    return finishTemplate(zip, docPath, xml);
};

// For every bilingual field, the template has TWO separate, dedicated value cells — confirmed by
// inspecting each template's actual cell grid (widths/borders/rows), not assumed.
// `baseOffset` defaults to 1 (English at label+1, Arabic at label+2 — label and both values share
// one row). Some forms instead put the English+Arabic labels on their own row (label, AR-label,
// spacer) with the values entirely on the NEXT row — verified per-template by walking actual
// <w:tr> row boundaries, not just flat cell offsets.
// `arMergeSpan` merges the Arabic value cell with the trailing spacer cell(s) that follow it in the
// same row — needed when that spacer isn't absorbed into the Arabic cell's own width, which otherwise
// centers the Arabic text within the narrower sub-cell instead of the full visual box next to it.
export const bilingual = (label: string, en: string | undefined | null, ar: string | undefined | null | undefined, baseOffset = 1, arMergeSpan = 0): FieldFill[] => [
    { label, value: en, offset: baseOffset },
    { label, value: ar, offset: baseOffset + 1, mergeSpan: arMergeSpan },
];

// Some templates (Certificate of Employment) write each field as a full static sentence with the
// fillable value embedded inline as a run of underscores (e.g. "in the position of ____") instead
// of a separate label+value cell — a fundamentally different shape from every field above. Finds
// the cell containing `cellContains` (unique surrounding text, since the underscore count alone
// repeats all over the document) and swaps the first underscore-only run's text for the real value,
// preserving that run's own formatting (font/size/rtl) exactly as the template already has it.
export const fillInlineBlank = (xml: string, cellContains: string, value: string | undefined | null): string => {
    if (!value) return xml;
    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const idx = cells.findIndex(c => cellText(c).includes(cellContains));
    if (idx < 0) return xml;
    // The underscores are sometimes their own dedicated run ("____"), sometimes trailing the label
    // text WITHIN the same run ("مع القسم ___") — the label part (if any) is kept, only the
    // underscore run itself is swapped for the value.
    const updated = cells[idx].replace(
        /(<w:t[^>]*>)([^<]*?)(_{3,})([^<]*?)(<\/w:t>)/,
        (_m, open, pre, _underscores, post, close) => `${open}${pre}${escapeXml(value)}${post}${close}`
    );
    if (updated === cells[idx]) return xml;
    let i = -1;
    return xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { i++; return i === idx ? updated : cell; });
};

// For a sentence with no blank at all (e.g. "This is to certify that" — no "____" for the
// employee's name to go after) — appends a new run to the end of the cell's last paragraph,
// cloning the formatting of whatever run is already last there, so the appended value matches the
// surrounding sentence exactly instead of falling back to some unrelated default style.
export const appendToCellEnd = (xml: string, cellContains: string, value: string | undefined | null, separator = ' '): string => {
    if (!value) return xml;
    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const idx = cells.findIndex(c => cellText(c).includes(cellContains));
    if (idx < 0) return xml;
    const cell = cells[idx];
    const runs = cell.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
    const lastRun = runs[runs.length - 1];
    if (!lastRun) return xml;
    const rPr = (lastRun.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
    const newRun = `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(separator + value)}</w:t></w:r>`;
    const updated = cell.replace(lastRun, lastRun + newRun);
    let i = -1;
    return xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (c) => { i++; return i === idx ? updated : c; });
};

// Vertically centers every cell's content (Word's Table Properties -> Cell -> Vertical alignment ->
// Center) — overrides any existing <w:vAlign> and adds one to cells that don't have any at all.
// Applied whole-document, not per-field, since a template-wide look is what's being asked for
// rather than any one specific cell.
export const centerAllCellsVertically = (xml: string): string =>
    xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        const tcPrMatch = cell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
        if (!tcPrMatch) return cell.replace(/^(<w:tc\b[^>]*>)/, '$1<w:tcPr><w:vAlign w:val="center"/></w:tcPr>');
        const tcPr = tcPrMatch[0];
        const newTcPr = /<w:vAlign\b[^>]*\/>/.test(tcPr)
            ? tcPr.replace(/<w:vAlign\b[^>]*\/>/, '<w:vAlign w:val="center"/>')
            : tcPr.replace('</w:tcPr>', '<w:vAlign w:val="center"/></w:tcPr>');
        return cell.replace(tcPr, newTcPr);
    });

// Re-opens a just-generated buffer to transform its document.xml — for post-processing that isn't
// expressible as a simple label->value fill (e.g. marking a checkbox, capping a row height).
export function transformDocument(buffer: Buffer, transform: (xml: string) => string): Buffer {
    const zip = new PizZip(buffer);
    const docPath = 'word/document.xml';
    const xml = zip.file(docPath)?.asText() || '';
    zip.file(docPath, transform(xml));
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
