// Exceptional Performance / Exceptional Contribution Award — nomination form. Unlike every other
// form in this app (earlyDepartureForm.ts, workAuthorizationForm.ts, leaveRequestForm.ts,
// rewardForms.ts), there is no pre-existing Word template shipped in public/ to fill — this one is
// built from a blank document with the `docx` package instead of PizZip raw-XML cell surgery, since
// there's no template layout to preserve. Mirrors the same signature-embedding idea as
// docxImage.ts's dataUrlToPng (used by the PizZip-based forms) rather than duplicating it.
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun, HeadingLevel, VerticalAlign } from 'docx';
import { dataUrlToPng, pngSize } from './docxImage';

export interface ExceptionalPerformanceApprover {
    name: string;
    signature?: string | null;
    date: string;
    decided: boolean;
}

export interface ExceptionalPerformanceNominationData {
    caseNumber: string;
    date: string;
    employeeId: string;
    employeeName: string;
    department: string;
    nominatedByName: string;
    justification: string;
    proposedBonusPercent: number | null;
    hrManager: ExceptionalPerformanceApprover | null;
    generalManager: ExceptionalPerformanceApprover | null;
}

const LABEL_CELL_WIDTH = 30;

const labelCell = (text: string) => new TableCell({
    width: { size: LABEL_CELL_WIDTH, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
});
const valueCell = (text: string) => new TableCell({
    width: { size: 100 - LABEL_CELL_WIDTH, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text })] })],
});
const infoRow = (label: string, value: string) => new TableRow({ children: [labelCell(label), valueCell(value)] });

const NO_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const tableBorders = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };

// Approver block: name + signature image (if decided) or "Pending" + decision date.
function approverCell(label: string, approver: ExceptionalPerformanceApprover | null): TableCell {
    const children: Paragraph[] = [
        new Paragraph({ children: [new TextRun({ text: label, bold: true })], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: '' }),
    ];
    if (approver?.decided) {
        const png = dataUrlToPng(approver.signature);
        if (png) {
            const dims = pngSize(png) || { width: 480, height: 200 };
            const maxW = 200, maxH = 80;
            const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
            children.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ type: 'png', data: png, transformation: { width: Math.round(dims.width * scale), height: Math.round(dims.height * scale) } })],
            }));
        }
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: approver.name || '' })] }));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: approver.date ? `Approved: ${approver.date}` : '', italics: true, size: 18 })] }));
    } else {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Pending', italics: true, color: '999999' })] }));
    }
    return new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children, borders: tableBorders });
}

export async function generateExceptionalPerformanceNominationDocx(data: ExceptionalPerformanceNominationData): Promise<Buffer> {
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun('Exceptional Performance / Exceptional Contribution Award')] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nomination Form', italics: true })] }),
                new Paragraph({ text: '' }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: tableBorders,
                    rows: [
                        infoRow('Reference No.', data.caseNumber),
                        infoRow('Date', data.date),
                        infoRow('Employee', `${data.employeeName} (${data.employeeId})`),
                        infoRow('Department', data.department),
                        infoRow('Nominated By', data.nominatedByName),
                        infoRow('Proposed Bonus', data.proposedBonusPercent != null ? `${data.proposedBonusPercent}% of monthly basic salary` : 'N/A'),
                    ],
                }),
                new Paragraph({ text: '' }),
                new Paragraph({ children: [new TextRun({ text: 'Justification', bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: data.justification || '—' })] }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [new TableRow({ children: [approverCell('HR Manager', data.hrManager), approverCell('General Manager', data.generalManager)] })],
                }),
            ],
        }],
    });
    return Packer.toBuffer(doc);
}
