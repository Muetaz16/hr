import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';

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

const valueRun = (value: string): string =>
    `<w:r><w:rPr><w:rFonts w:ascii="Montserrat" w:hAnsi="Montserrat" w:cs="Arial"/>` +
    `<w:color w:val="000000"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

// Keep signatures small so they sit inside the existing signature box.
const SIG_MAX_W_EMU = Math.round(1.3 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.4 * EMU_PER_INCH);

const cellText = (cell: string): string =>
    [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('')
        // De-escape so labels match their printed form — notably "Signature & Date", whose "&"
        // is stored as "&amp;" in the XML.
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim();

// Force a paragraph's properties to be horizontally centered: drop any existing justification and
// leading indent (so text truly centers), then insert a centered jc in a schema-valid position
// (jc must precede the trailing rPr).
const centerPPr = (pPr: string): string => {
    const cleaned = pPr.replace(/<w:jc\b[^>]*\/>/g, '').replace(/<w:ind\b[^>]*\/>/g, '');
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
const injectRun = (cell: string, run: string): string => {
    const m = cell.match(/^([\s\S]*)(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>\s*<\/w:tc>)$/);
    if (m) {
        const [, before, pOpen, inner, tail] = m;
        const centered = /<w:pPr>[\s\S]*?<\/w:pPr>/.test(inner)
            ? inner.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, (pp) => centerPPr(pp))
            : `<w:pPr><w:jc w:val="center"/></w:pPr>${inner}`;
        return `${before}${pOpen}${centered}${run}${tail}`;
    }
    return cell.replace(/<\/w:tc>$/, `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run}</w:p></w:tc>`);
};

export interface LeaveFormApprover {
    name: string;
    signature?: string | null; // PNG data URL
    date?: string;             // decision date (YYYY-MM-DD)
    decided: boolean;          // has this approver acted?
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
    fillAfter('Replacement Employee name', data.replacementName || '');

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
        replacements[cellIndex] = injectRun(replacements[cellIndex] ?? cells[cellIndex], drawingRun(rId, cx, cy, docPrSeq++, name));
    };

    // Employee's own signature (Leave Details -> "Signature and Date" value cell).
    {
        const li = findLabel('Signature and Date');
        if (li >= 0) {
            placeSignature(data.employeeSignature, li + 1, 'Employee Signature');
            if (data.employeeSignatureDate) fillIdx(li + 1, ` ${data.employeeSignatureDate}`);
        }
    }

    // Replacement (cover) employee's signature — filled only once they accept (value cell of the
    // "Replacement Signature and Date" row).
    {
        const li = findLabel('Replacement Signature');
        if (li >= 0) {
            placeSignature(data.replacementSignature, li + 1, 'Replacement Signature');
            if (data.replacementSignatureDate) fillIdx(li + 1, ` ${data.replacementSignatureDate}`);
        }
    }

    // Approver rows whose signature lives in the "Signature & Date" row that FOLLOWS the labelled
    // row. We anchor the search from the approver's own row so each finds its own signature row.
    const signApproverWithFollowingRow = (approverLabel: string, ap?: LeaveFormApprover | null) => {
        if (!ap || !ap.decided) return;
        const li = findLabel(approverLabel);
        if (li < 0) return;
        const sigLi = findLabel('Signature & Date', li + 1);
        if (sigLi < 0) return;
        placeSignature(ap.signature, sigLi + 1, `${approverLabel} Signature`);
        if (ap.date) fillIdx(sigLi + 1, `  ${ap.date}`);
    };
    signApproverWithFollowingRow('Head of Attendance and Payroll Unit', data.headAttendance);
    signApproverWithFollowingRow('Direct supervisor', data.directSupervisor);
    signApproverWithFollowingRow('Head of Department / Division', data.headDeptDivision);
    signApproverWithFollowingRow('Head of Human Resources', data.headHR);

    // Endorsement rows (Administrative Director / General Manager) sign in the value cell on their
    // own row (offset 1).
    const signApproverInline = (approverLabel: string, ap?: LeaveFormApprover | null) => {
        if (!ap || !ap.decided) return;
        const li = findLabel(approverLabel);
        if (li < 0) return;
        placeSignature(ap.signature, li + 1, `${approverLabel} Signature`);
        if (ap.date) fillIdx(li + 1, `  ${ap.date}`);
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
