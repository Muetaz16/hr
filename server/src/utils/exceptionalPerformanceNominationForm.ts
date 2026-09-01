// Exceptional Performance / Exceptional Contribution Award — nomination form. Fills the real
// "EXCEPTIONAL CONTRIBUTION REWARD.docx" template shipped in public/ (replacing the earlier
// from-scratch `docx`-package build made before this template existed). Text fields go through
// docxFormHelpers.ts's fillTemplate (its setCell REPLACES a cell's content — needed here since the
// Nature/Justification/Percentage cells hold real instructional placeholder text in the template,
// not blank cells); the 4 approver signatures are embedded afterwards the same way every other
// PizZip-based form in this app does it (missingBiometricLogForm.ts, workAuthorizationForm.ts).
import PizZip from 'pizzip';
import { EMU_PER_INCH, pngSize, fitEmu, dataUrlToPng, drawingRun } from './docxImage';
import { fillTemplate, cellText, type FieldFill } from './docxFormHelpers';

const TEMPLATE_NAME = 'EXCEPTIONAL CONTRIBUTION REWARD.docx';

export interface ExceptionalContributionApprover {
    signature?: string | null;
    decided: boolean;
}

export interface ExceptionalContributionRewardData {
    employeeId: string;
    employeeName: string;
    positionTitle: string;
    department: string;
    division: string;
    payrollCoverageMonth: string;
    natureOfContribution: string;
    justification: string;
    percentageBonus: number | null;
    deptHead?: ExceptionalContributionApprover | null;
    divisionHead?: ExceptionalContributionApprover | null;
    hrManager?: ExceptionalContributionApprover | null;
    generalManager?: ExceptionalContributionApprover | null;
}

const SIG_MAX_W_EMU = Math.round(1.4 * EMU_PER_INCH);
const SIG_MAX_H_EMU = Math.round(0.45 * EMU_PER_INCH);

// Append a run to the cell's LAST paragraph, forcing it centered — mirrors missingBiometricLogForm's
// injectRun exactly (signature slots start truly empty, so appending is correct here, unlike the
// text fields above which need setCell's full-replace).
const injectRun = (cell: string, run: string): string => {
    const m = cell.match(/^([\s\S]*)(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>\s*<\/w:tc>)$/);
    if (m) {
        const [, before, pOpen, inner, tail] = m;
        const centered = /<w:pPr>[\s\S]*?<\/w:pPr>/.test(inner)
            ? inner.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, (pp) => pp.replace(/<w:jc\b[^>]*\/>/g, '').replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>'))
            : `<w:pPr><w:jc w:val="center"/></w:pPr>${inner}`;
        return `${before}${pOpen}${centered}${run}${tail}`;
    }
    return cell.replace(/<\/w:tc>$/, `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run}</w:p></w:tc>`);
};

export const generateExceptionalContributionRewardDocx = (data: ExceptionalContributionRewardData): Buffer => {
    const fields: FieldFill[] = [
        { label: 'Employee ID:', value: data.employeeId, mergeSpan: 1 },
        { label: 'Employee Name:', value: data.employeeName, mergeSpan: 1 },
        { label: 'Position Title:', value: data.positionTitle, mergeSpan: 1 },
        { label: 'Department:', value: data.department, mergeSpan: 1 },
        { label: 'Division:', value: data.division, mergeSpan: 1 },
        { label: 'Payroll Coverage:', value: data.payrollCoverageMonth },
        { label: 'Nature of Exceptional Contribution:', value: data.natureOfContribution },
        // The template's own "Justiﬁcation" uses the "fi" ligature glyph (U+FB01), which
        // loadNormalizedTemplate's NFKC pass decomposes to plain "fi" before labels are matched —
        // and its "Percentage Bonus" cell prints "(%)" out of the order this label string implies.
        // Partial (non-exact) matches on a distinctive substring sidestep both.
        { label: 'Justification for Exceptional Recognition', value: data.justification },
        { label: 'Percentage Bonus', value: data.percentageBonus != null ? `${data.percentageBonus}%` : null },
    ];
    const buf = fillTemplate(TEMPLATE_NAME, fields);

    // --- Signatures: re-open the filled buffer and embed each decided approver's signature image
    // into the cell right after their label. No date is printed next to any of them — the template
    // has no date cell in its Approvals box at all.
    const zip = new PizZip(buf);
    const docPath = 'word/document.xml';
    let xml = zip.file(docPath)!.asText();
    const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const texts = cells.map(cellText);
    const findLabel = (label: string): number => texts.findIndex(t => t === label);

    let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    let rIdSeq = 990, mediaSeq = 190, docPrSeq = 990;
    const replacements: Record<number, string> = {};
    const placeSignature = (approver: ExceptionalContributionApprover | null | undefined, label: string, name: string) => {
        if (!approver?.decided) return;
        const li = findLabel(label);
        if (li < 0) return;
        const cellIndex = li + 1;
        const png = dataUrlToPng(approver.signature);
        if (!png || cellIndex < 0 || cellIndex >= cells.length) return;
        const dims = pngSize(png) || { width: 480, height: 200 };
        const { cx, cy } = fitEmu(dims.width, dims.height, SIG_MAX_W_EMU, SIG_MAX_H_EMU);
        const rId = `rId${rIdSeq++}`;
        const mediaFile = `ecrsig${mediaSeq++}.png`;
        zip.file(`word/media/${mediaFile}`, png);
        relsXml = relsXml.replace('</Relationships>',
            `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFile}"/></Relationships>`);
        replacements[cellIndex] = injectRun(replacements[cellIndex] ?? cells[cellIndex], drawingRun(rId, cx, cy, docPrSeq++, name));
    };

    placeSignature(data.deptHead, 'Head of Department', 'Head of Department Signature');
    placeSignature(data.divisionHead, 'Head of Division', 'Head of Division Signature');
    placeSignature(data.hrManager, 'Head of HR', 'Head of HR Signature');
    placeSignature(data.generalManager, 'General Manager', 'General Manager Signature');

    let idx = -1;
    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => { idx++; return replacements[idx] ?? cell; });

    zip.file(docPath, xml);
    zip.file('word/_rels/document.xml.rels', relsXml);
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
