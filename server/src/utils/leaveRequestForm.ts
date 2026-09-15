import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun, tickedCheckboxPng } from './docxImage';

// Fills the official bilingual "Leave Request Form" (IPH-HRD-APU-F-001-R00) that ships in the
// app's public folder. We treat it as a read-only template, drop the request's details into the
// correct table cells (located by their printed labels, not fragile indexes), embed each
// approver's saved signature + decision date as an image, and hand back a fresh .docx. Pending
// approvers are simply left blank, so the same generator produces a live in-progress copy and the
// final fully-signed record. The original template is never modified.
const TEMPLATE_NAME = 'Leave Request Form.docx';
const TEMPLATE_CANDIDATES = [
    path.join(__dirname, '../../../public', TEMPLATE_NAME),
    path.join(process.cwd(), 'public', TEMPLATE_NAME),
    path.join(process.cwd(), '../public', TEMPLATE_NAME),
];

const resolveTemplate = (): string => {
    for (const p of TEMPLATE_CANDIDATES) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`Leave request form template (public/${TEMPLATE_NAME}) was not found.`);
};

const escapeXml = (v: string): string =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 12 half-points = 6pt, which is exactly the size the template's own printed labels use
// (every <w:sz> in the table reads 12). Filled values used to come back at 8pt and stood taller
// than the label beside them, which pushed the shorter rows past their set height.
const VALUE_SZ = '12';

const valueRun = (value: string): string =>
    `<w:r><w:rPr><w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Arial"/>` +
    `<w:color w:val="000000"/><w:sz w:val="${VALUE_SZ}"/><w:szCs w:val="${VALUE_SZ}"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

// Keep signatures inside the signature box instead of stretching it.
//
// The signature rows are 385–403 twips tall (0.267"–0.280") and carry NO w:hRule, which means
// "auto" — Word treats the stored height as a minimum and grows the row to fit its contents. So an
// image taller than the row does not get cropped, it silently pushes the whole form down a page.
// 0.22" leaves room for the line's leading and still clears the shortest of those rows.
const SIG_MAX_W_EMU = Math.round(1.3 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.22 * EMU_PER_INCH);

// Printed wherever the requester answered "no replacement needed". A blank box says "nobody has
// filled this in yet" and sends a reader chasing a signature that is never coming; "N/A" says the
// question was asked and answered.
const NOT_APPLICABLE = 'N/A';

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('')
        // De-escape so labels match their printed form — notably "Signature & Date", whose "&"
        // is stored as "&amp;" in the XML.
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim();

// Force a paragraph's properties to be horizontally centered: drop any existing justification and
// leading indent (so text truly centers), then insert a centered jc in a schema-valid position
// (jc must precede the trailing rPr).
const centerPPr = (pPr: string, tight = false): string => {
    let cleaned = pPr.replace(/<w:jc\b[^>]*\/>/g, '').replace(/<w:ind\b[^>]*\/>/g, '');
    // `tight` is for the paragraph that holds a signature image: the TableParagraph style adds
    // 46 twips of space-before, and on a 385-twip row that is height the picture cannot have.
    if (tight) {
        cleaned = cleaned.replace(/<w:spacing\b[^>]*\/>/g, '');
        cleaned = /<w:rPr>/.test(cleaned)
            ? cleaned.replace(/<w:rPr>/, '<w:spacing w:before="0" w:after="0"/><w:rPr>')
            : cleaned.replace(/<\/w:pPr>/, '<w:spacing w:before="0" w:after="0"/></w:pPr>');
    }
    if (/<w:rPr>/.test(cleaned)) return cleaned.replace(/<w:rPr>/, '<w:jc w:val="center"/><w:rPr>');
    return cleaned.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
};

// Center every paragraph inside a table cell — used as a final pass so the fixed template labels
// (Employee Name, ID No, …) are centered too, matching the filled values.
const centerAllParagraphs = (cell: string): string =>
    cell.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) =>
        /<w:pPr>[\s\S]*?<\/w:pPr>/.test(para)
            ? para.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, (pp) => centerPPr(pp))
            : para.replace(/^(<w:p\b[^>]*>)/, '$1<w:pPr><w:jc w:val="center"/></w:pPr>')
    );

// Append a run to the cell's LAST paragraph, forcing that paragraph centered so every injected
// value / signature sits centered in its cell.
const injectRun = (cell: string, run: string, tight = false): string => {
    const m = cell.match(/^([\s\S]*)(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>\s*<\/w:tc>)$/);
    if (m) {
        const [, before, pOpen, inner, tail] = m;
        const centered = /<w:pPr>[\s\S]*?<\/w:pPr>/.test(inner)
            ? inner.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, (pp) => centerPPr(pp, tight))
            : `<w:pPr>${tight ? '<w:spacing w:before="0" w:after="0"/>' : ''}<w:jc w:val="center"/></w:pPr>${inner}`;
        return `${before}${pOpen}${centered}${run}${tail}`;
    }
    return cell.replace(/<\/w:tc>$/, `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run}</w:p></w:tc>`);
};

export interface LeaveFormApprover {
    name: string;
    signature?: string | null; // PNG data URL
    date?: string;             // decision date (YYYY-MM-DD)
    decided: boolean;          // has this approver acted (approved OR rejected)?
    // Which way they went — drives the Approved / Not approved checkbox on their row. Optional so
    // an older caller that only sets `decided` keeps its previous behaviour and ticks nothing.
    decision?: 'APPROVED' | 'REJECTED';
}

export interface LeaveFormData {
    // Employee information
    employeeName: string;
    idNo: string;
    division: string;
    department: string;
    position: string;
    contractStartDate: string;
    contractEndDate: string;
    employeeContract: string;
    residencyStatus: string;
    // Leave details
    typeOfLeave: string;
    from: string;
    to: string;
    totalDays: string;
    startWorkingDate: string;
    employeeSignature?: string | null; // requester's signature
    employeeSignatureDate?: string;
    replacementName?: string;
    replacementSignature?: string | null; // replacement (cover) employee's signature, once they accept
    replacementSignatureDate?: string;
    // The requester explicitly chose to work without a cover ("N/A" in the request screen). This is
    // an ANSWER, not a missing value, so the form prints it — see NOT_APPLICABLE below.
    replacementNotApplicable?: boolean;
    // Who bears the travel-ticket cost. Undefined/null leaves BOTH boxes empty, which is a real
    // answer on this form — the row applies to non-resident employees only.
    ticketProvidedBy?: 'EMPLOYEE' | 'COMPANY' | null;
    // Balance table (entitlement / deducted / remaining)
    annualEntitlement: string; annualDeducted: string; annualRemaining: string;
    unpaidEntitlement: string; unpaidDeducted: string; unpaidRemaining: string;
    emergencyEntitlement: string; emergencyDeducted: string; emergencyRemaining: string;
    // Approvals (any missing/undecided approver is left blank)
    headAttendance?: LeaveFormApprover | null;
    directSupervisor?: LeaveFormApprover | null;
    headDeptDivision?: LeaveFormApprover | null;
    headHR?: LeaveFormApprover | null;
    adminDirector?: LeaveFormApprover | null;
    generalManager?: LeaveFormApprover | null;
}

export const generateLeaveRequestFormDocx = (data: LeaveFormData): Buffer => {
    const templatePath = resolveTemplate();
    const zip = new PizZip(fs.readFileSync(templatePath));
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Malformed leave request form template: word/document.xml missing.');

    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const replacements: Record<number, string> = {};

    // Which cells belong to which row. The document holds a single, un-nested table, so walking the
    // rows yields cells in exactly the same order as the flat match above — that is what lets a
    // label index be turned back into "the rest of its own row" instead of blindly trusting +1/+2.
    const rowOfCell: number[] = [];
    const cellsOfRow: number[][] = [];
    {
        let ci = 0;
        for (const row of xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || []) {
            const idxs = (row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || []).map(() => ci++);
            idxs.forEach(i => { rowOfCell[i] = cellsOfRow.length; });
            cellsOfRow.push(idxs);
        }
    }
    /** The empty cells that follow a label in its own row — i.e. the cells meant to be filled. */
    const valueCellsAfter = (labelIdx: number): number[] => {
        const row = cellsOfRow[rowOfCell[labelIdx]] || [];
        const at = row.indexOf(labelIdx);
        if (at < 0) return [];
        return row.slice(at + 1).filter(i => !texts[i]);
    };

    const findLabel = (label: string, from = 0): number => {
        for (let i = from; i < texts.length; i++) if (texts[i].includes(label)) return i;
        return -1;
    };
    // Exact-match variant for very short labels ("From", "To") that would otherwise match
    // substrings of longer cells ("Total number of day...", etc.).
    const findExact = (label: string, from = 0): number => {
        for (let i = from; i < texts.length; i++) if (texts[i] === label) return i;
        return -1;
    };
    const fillIdx = (ti: number, value: string) => {
        if (!value || ti < 0 || ti >= cells.length) return;
        replacements[ti] = injectRun(replacements[ti] ?? cells[ti], valueRun(value));
    };
    const fillAfter = (label: string, value: string, offset = 1) => {
        const li = findLabel(label);
        if (li < 0) return;
        fillIdx(li + offset, value);
    };

    // --- Employee information (label | value | arabic-label) ---
    fillAfter('Employee Name', data.employeeName);
    fillAfter('ID No', data.idNo);
    fillAfter('Division', data.division);
    fillAfter('Department', data.department);
    fillAfter('Position', data.position);
    fillAfter('Contract Start Date', data.contractStartDate);
    fillAfter('Contract End Date', data.contractEndDate);
    fillAfter('Employee Contract', data.employeeContract);
    fillAfter('Residency Status', data.residencyStatus);

    // --- Leave details ---
    fillAfter('Type of Leave', data.typeOfLeave);
    { const li = findExact('From'); if (li >= 0) fillIdx(li + 1, data.from); }
    { const li = findExact('To'); if (li >= 0) fillIdx(li + 1, data.to); }
    fillAfter('Total number of day', data.totalDays);
    fillAfter('Start Working Date', data.startWorkingDate);
    fillAfter('Replacement Employee name', data.replacementNotApplicable ? NOT_APPLICABLE : (data.replacementName || ''));

    // --- Balance table: each leave-type row has 3 value cells (entitlement | deducted | remaining) ---
    const fillBalanceRow = (label: string, entitlement: string, deducted: string, remaining: string) => {
        const li = findLabel(label);
        if (li < 0) return;
        fillIdx(li + 1, entitlement);
        fillIdx(li + 2, deducted);
        fillIdx(li + 3, remaining);
    };
    fillBalanceRow('Annual (paid) leave', data.annualEntitlement, data.annualDeducted, data.annualRemaining);
    fillBalanceRow('Unpaid Leave', data.unpaidEntitlement, data.unpaidDeducted, data.unpaidRemaining);
    fillBalanceRow('Emergency Leave', data.emergencyEntitlement, data.emergencyDeducted, data.emergencyRemaining);

    // --- Signatures: wire up media + relationships as we go ---
    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    let rIdSeq = 950;
    let mediaSeq = 150;
    let docPrSeq = 950;

    // --- Approved / Not approved checkboxes.
    //
    // This template draws each box as a tiny embedded IMAGE, not a "☐" character, so it cannot be
    // ticked by replacing a glyph the way the Missing Biometric Log Form is. Instead the ticked box
    // is generated once, added to the package once, and the target cell's <a:blip r:embed> is
    // re-pointed at it — the drawing's size and position are left exactly as the template had them,
    // so the ticked box sits precisely where the empty one did.
    let tickRelId: string | null = null;
    const ensureTickImage = (): string => {
        if (tickRelId) return tickRelId;
        tickRelId = `rId${rIdSeq++}`;
        zip.file('word/media/tickbox.png', tickedCheckboxPng());
        relsXml = relsXml.replace(
            '</Relationships>',
            `<Relationship Id="${tickRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/tickbox.png"/></Relationships>`
        );
        return tickRelId;
    };
    /**
     * Tick the box belonging to `boxLabel` ("Approved" / "Not approved") inside the approver row
     * that starts at `labelIdx`. The box always sits in the cell immediately BEFORE its caption.
     *
     * Matching is case-sensitive on purpose: the captions read "Approved" and "Not approved", so a
     * case-insensitive test would let "Not approved" satisfy a search for "Approved" and tick the
     * wrong box — on this form that is the difference between an approval and a refusal.
     */
    const tickBoxByCaption = (labelIdx: number, matches: (caption: string) => boolean) => {
        const row = cellsOfRow[rowOfCell[labelIdx]] || [];
        const captionIdx = row.find(i => matches(texts[i]));
        if (captionIdx === undefined) return;
        const boxIdx = row[row.indexOf(captionIdx) - 1];
        if (boxIdx === undefined) return;
        const cell = replacements[boxIdx] ?? cells[boxIdx];
        if (!/<a:blip r:embed="[^"]+"/.test(cell)) return;
        replacements[boxIdx] = cell.replace(/<a:blip r:embed="[^"]+"/, `<a:blip r:embed="${ensureTickImage()}"`);
    };
    /** Tick whichever of the two boxes this approver's decision calls for. */
    const tickDecision = (labelIdx: number, ap: LeaveFormApprover) => {
        if (ap.decision === 'APPROVED') tickBoxByCaption(labelIdx, t => t.startsWith('Approved'));
        else if (ap.decision === 'REJECTED') tickBoxByCaption(labelIdx, t => t.startsWith('Not approved'));
    };

    // "Ticket provided by" (تحمل تكلفة تذاكر السفر): Employee / Company, or neither. The row has
    // the same box-then-caption shape as the approval rows, so the same ticker serves it. When the
    // requester left it unanswered both boxes stay empty — the row is headed "For Non-resident
    // Employees only", so no answer is itself a valid answer and must not be invented here.
    if (data.ticketProvidedBy === 'EMPLOYEE' || data.ticketProvidedBy === 'COMPANY') {
        const ticketLi = findLabel('Ticket provided by');
        if (ticketLi >= 0) {
            const caption = data.ticketProvidedBy === 'EMPLOYEE' ? 'Employee' : 'Company';
            tickBoxByCaption(ticketLi, t => t.startsWith(caption));
        }
    }

    const placeSignature = (dataUrl: string | null | undefined, cellIndex: number, name: string) => {
        const png = dataUrlToPng(dataUrl);
        if (!png || cellIndex < 0 || cellIndex >= cells.length) return;
        const dims = pngSize(png) || { width: 480, height: 200 };
        const { cx, cy } = fitEmu(dims.width, dims.height, SIG_MAX_W_EMU, SIG_MAX_H_EMU);
        const rId = `rId${rIdSeq++}`;
        const mediaFile = `sig${mediaSeq++}.png`;
        zip.file(`word/media/${mediaFile}`, png);
        relsXml = relsXml.replace(
            '</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFile}"/></Relationships>`
        );
        replacements[cellIndex] = injectRun(replacements[cellIndex] ?? cells[cellIndex], drawingRun(rId, cx, cy, docPrSeq++, name), true);
    };

    // A "Signature & Date" row carries TWO value cells, so the two things it asks for get a box
    // each: the DATE on the left, the SIGNATURE on the right. The table is plain left-to-right
    // (there is no w:bidiVisual on tblPr), so the first value cell is the left-hand one.
    //
    // If the template is ever reverted to a single merged value cell, both fall back into it —
    // which is what the form did before, so nothing breaks.
    const placeSignatureAndDate = (
        labelIdx: number,
        signature: string | null | undefined,
        date: string | undefined,
        name: string
    ) => {
        const slots = valueCellsAfter(labelIdx);
        if (!slots.length) return;
        const dateIdx = slots[0];
        const signIdx = slots.length > 1 ? slots[slots.length - 1] : slots[0];
        placeSignature(signature, signIdx, name);
        if (date) fillIdx(dateIdx, date);
    };

    // Employee's own signature (Leave Details -> "Signature and Date" row).
    {
        const li = findLabel('Signature and Date');
        if (li >= 0) placeSignatureAndDate(li, data.employeeSignature, data.employeeSignatureDate, 'Employee Signature');
    }

    // Replacement (cover) employee's signature — filled only once they accept.
    {
        const li = findLabel('Replacement Signature');
        if (li >= 0) {
            if (data.replacementNotApplicable) {
                // Both boxes on the row — there is no signature to give AND no date on which it
                // could have been given. Marking only one would leave the other looking unanswered.
                for (const idx of valueCellsAfter(li)) fillIdx(idx, NOT_APPLICABLE);
            } else {
                placeSignatureAndDate(li, data.replacementSignature, data.replacementSignatureDate, 'Replacement Signature');
            }
        }
    }

    // Approver rows whose signature lives in the "Signature & Date" row that FOLLOWS the labelled
    // row. We anchor the search from the approver's own row so each finds its own signature row.
    // Several labels are accepted per approver because the printed template gets re-worded: the
    // attendance approver's row is titled "Head of Personal Relations Department:" in the current
    // revision and "Head of Attendance and Payroll Unit" in older ones. A label that matches
    // nothing silently drops that person's signature from the form, so both are listed.
    const signApproverWithFollowingRow = (approverLabels: string[], ap?: LeaveFormApprover | null) => {
        if (!ap || !ap.decided) return;
        const li = approverLabels.map(l => findLabel(l)).find(i => i >= 0) ?? -1;
        if (li < 0) return;
        // The Approved / Not approved boxes live on the approver's OWN row; the signature goes in
        // the "Signature & Date" row underneath it.
        tickDecision(li, ap);
        const sigLi = findLabel('Signature & Date', li + 1);
        if (sigLi < 0) return;
        placeSignatureAndDate(sigLi, ap.signature, ap.date, `${approverLabels[0]} Signature`);
    };
    signApproverWithFollowingRow(['Head of Personal Relations', 'Head of Attendance and Payroll Unit'], data.headAttendance);
    signApproverWithFollowingRow(['Direct supervisor'], data.directSupervisor);
    signApproverWithFollowingRow(['Head of Department / Division'], data.headDeptDivision);
    signApproverWithFollowingRow(['Head of Human Resources'], data.headHR);

    // Endorsement rows (Administrative Director / General Manager) sign on their own row, which
    // has the same two-cell shape: date left, signature right.
    const signApproverInline = (approverLabel: string, ap?: LeaveFormApprover | null) => {
        if (!ap || !ap.decided) return;
        const li = findLabel(approverLabel);
        if (li < 0) return;
        placeSignatureAndDate(li, ap.signature, ap.date, `${approverLabel} Signature`);
    };
    signApproverInline('Administrative Director', data.adminDirector);
    signApproverInline('General Manager', data.generalManager);
    // The final "Date" row (under GM) gets the last endorsement date.
    {
        const gmLi = findLabel('General Manager');
        if (gmLi >= 0 && data.generalManager?.date) {
            const dateLi = findLabel('Date', gmLi + 1);
            if (dateLi >= 0) fillIdx(dateLi + 1, data.generalManager.date);
        }
    }

    // Rebuild document.xml with the modified cells, in document order — and center every cell's
    // paragraphs (labels included) so the whole form reads uniformly centered.
    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        idx++;
        return centerAllParagraphs(replacements[idx] ?? cell);
    });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
