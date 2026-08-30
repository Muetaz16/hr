import { fillTemplate, bilingual, setCell, capRowHeight, widenStaticCell, transformDocument, cellText } from './docxFormHelpers';

// The 4 official bilingual Disciplinary Action templates live in the app's public folder. Uses the
// shared PizZip cell-rewrite technique in docxFormHelpers.ts. Signature lines are always left blank
// for physical signing — this only fills the data fields, never the "Signature and Date" cells.

export interface IncidentReportData {
    caseNumber: string;
    dateReported: string;
    subjectEmployee: string;
    subjectEmployeeAr?: string;
    positionTitle: string;
    positionTitleAr?: string;
    divisionDepartment: string;
    divisionDepartmentAr?: string;
    dateHappened: string;
    placeOfIncident: string;
    placeOfIncidentAr?: string;
    description: string;
    descriptionAr?: string;
    preparedBy: string;
    preparedByAr?: string;
}

export const generateIncidentReportDocx = (data: IncidentReportData): Buffer => {
    const buffer = fillTemplate('INCIDENT REPORT FORM.docx', [
        { label: 'IR No', value: data.caseNumber, mergeSpan: 1 },
        { label: 'Date Reported', value: data.dateReported, mergeSpan: 1 },
        ...bilingual('Subject Employee/s', data.subjectEmployee, data.subjectEmployeeAr),
        ...bilingual('Position Title', data.positionTitle, data.positionTitleAr),
        ...bilingual('Division/Department', data.divisionDepartment, data.divisionDepartmentAr),
        { label: 'Date Happened', value: data.dateHappened, mergeSpan: 1 },
        ...bilingual('Place of Incident', data.placeOfIncident, data.placeOfIncidentAr),
        ...bilingual('Description of the Incident', data.description, data.descriptionAr),
        ...bilingual('Prepared by', data.preparedBy, data.preparedByAr),
    ]);
    // Same oversized writing-box fix as Notice to Explain's Description field, applied here for
    // consistency across all 4 forms — this row was even taller in the raw template (6427).
    return transformDocument(buffer, xml => capRowHeight(xml, 'Description of the Incident', 4000));
};

export interface NoticeToExplainData {
    employeeId: string;
    employeeName: string;
    employeeNameAr?: string;
    dateHappened: string;
    placeOfIncident: string;
    placeOfIncidentAr?: string;
    description: string;
    descriptionAr?: string;
}

export const generateNoticeToExplainDocx = (data: NoticeToExplainData): Buffer => {
    const buffer = fillTemplate('Notice to Explain.docx', [
        { label: 'Employee ID:', value: data.employeeId, mergeSpan: 1 },
        ...bilingual('Employee Name:', data.employeeName, data.employeeNameAr),
        { label: 'Date happened:', value: data.dateHappened, mergeSpan: 1 },
        ...bilingual('Place of the incident:', data.placeOfIncident, data.placeOfIncidentAr),
        ...bilingual('Description of the incident:', data.description, data.descriptionAr),
    ]);
    // The template's own height for this row (plus the notice text above the table) pushes the
    // whole document past one page, spilling the page-anchored logo images after the table onto a
    // near-empty page 2. Trimmed to about half — still a clearly larger-than-one-line writing box,
    // just no longer the full original height.
    return transformDocument(buffer, xml => capRowHeight(xml, 'Description of the incident:', 4000));
};

export interface InvestigationResultData {
    caseNumber: string;
    date: string;
    subjectEmployee: string;
    positionTitle: string;
    divisionDepartment: string;
    placeOfIncident: string;
    dateHappened: string;
    outcome: 'NON_VIOLATION' | 'MINOR' | 'SERIOUS' | 'MAJOR';
    result: string;
    resultAr?: string;
    recommendation: string;
    recommendationAr?: string;
    actionTaken: string;
    actionTakenAr?: string;
    attachmentNote?: string;
    preparedBy: string;
}

const OUTCOME_LABELS: Record<InvestigationResultData['outcome'], string> = {
    NON_VIOLATION: 'Non Violation',
    MINOR: 'Minor Violation',
    SERIOUS: 'Serious Violation',
    MAJOR: 'Major Violation',
};

export const generateInvestigationResultDocx = (data: InvestigationResultData): Buffer => {
    // English only throughout the identification header (Subject Employees/Position/Department/
    // Place of Incident/Prepared by) — this internal investigation document doesn't need the
    // bilingual treatment the employee-facing forms (Incident Report, Notice to Explain) get.
    const buffer = fillTemplate('Investigation Result.docx', [
        { label: 'IR No', value: data.caseNumber, mergeSpan: 1 },
        { label: 'Date', value: data.date, mergeSpan: 1 },
        { label: 'Subject Employees', value: data.subjectEmployee, mergeSpan: 1 },
        { label: 'Position Title', value: data.positionTitle, mergeSpan: 1 },
        { label: 'Division/Department', value: data.divisionDepartment, mergeSpan: 1 },
        { label: 'Place of Incident', value: data.placeOfIncident, mergeSpan: 1 },
        { label: 'Date Happened', value: data.dateHappened, mergeSpan: 1 },
        { label: 'Prepared by :', value: data.preparedBy, mergeSpan: 1 },
        // Result/Recommendation/Action Taken/Attachment put their English+Arabic labels on one row
        // (label, AR-label, spacer) with the values entirely on the NEXT row — English at label+3,
        // Arabic at label+4 (verified by walking actual <w:tr> boundaries). These stay bilingual —
        // only the identification header above was asked to go English-only.
        ...bilingual('Result of Investigation', data.result, data.resultAr, 3, 1),
        ...bilingual('Recommendation', data.recommendation, data.recommendationAr, 3, 1),
        ...bilingual('Action Taken', data.actionTaken, data.actionTakenAr, 3, 1),
        { label: 'Attachment', value: data.attachmentNote, offset: 3 },
    ]);
    return markOutcomeSelected(buffer, OUTCOME_LABELS[data.outcome]);
};

// The 4 violation-status options print a checkbox square immediately below their label — in the
// raw template a small drawn vector shape (a grouped <w:drawing>), one row below the option-label
// row, at the same column position (flat cell index label+5 — verified against the template layout).
// We REPLACE all four box cells with uniform Unicode ballot-box text glyphs so they read as one
// consistent, professional set (matching the Work Authorization form): the selected option gets a
// ballot box WITH a check (☑), the other three an empty ballot box (☐) — instead of a lone
// heavy "ballot box with X" (☒) sitting next to differently-drawn vector squares.
const CHECK_MARK_RPR = `<w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol"/><w:color w:val="000000"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>`;
const ALL_OUTCOME_LABELS = ['Non Violation', 'Minor Violation', 'Serious Violation', 'Major Violation'];
function markOutcomeSelected(buffer: Buffer, optionLabel: string): Buffer {
    return transformDocument(buffer, xml => {
        const cells = xml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
        const texts = cells.map(cellText);
        // Map each option's box cell (label + 5) to the glyph it should carry — checked box for the
        // selected outcome, empty box for the rest — so all four render identically.
        const boxGlyph: Record<number, string> = {};
        for (const label of ALL_OUTCOME_LABELS) {
            const li = texts.findIndex(t => t === label);
            if (li < 0) continue;
            const boxIndex = li + 5;
            if (boxIndex >= cells.length) continue;
            boxGlyph[boxIndex] = label === optionLabel ? '☑' : '☐';
        }
        if (Object.keys(boxGlyph).length === 0) return xml;
        let idx = -1;
        return xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
            idx++;
            const glyph = boxGlyph[idx];
            return glyph ? setCell(cell, `<w:r>${CHECK_MARK_RPR}<w:t>${glyph}</w:t></w:r>`) : cell;
        });
    });
}

export interface DisciplinaryActionData {
    employeeId: string;
    employeeName: string;
    actionTypeLabel: string;
    categoryLabel: string;
    offenseNumber: string;
    violationDescription: string;
    effectiveStartDate: string;
    additionalInfo?: string;
}

export const generateDisciplinaryActionDocx = (data: DisciplinaryActionData): Buffer => {
    const buffer = fillTemplate('Notice of Disciplinary Action.docx', [
        { label: 'Employee ID', value: data.employeeId, mergeSpan: 2 },
        { label: 'Employee Name', value: data.employeeName, mergeSpan: 2 },
        { label: 'Type of disciplinary action', value: data.actionTypeLabel, mergeSpan: 2 },
        { label: 'Offense category', value: data.categoryLabel, mergeSpan: 2 },
        { label: 'Number of offence for the same reason', value: data.offenseNumber, mergeSpan: 2 },
        { label: 'Violation description', value: data.violationDescription, mergeSpan: 2 },
        { label: 'Effective start date', value: data.effectiveStartDate, mergeSpan: 2 },
        { label: 'Additional info', value: data.additionalInfo, mergeSpan: 2 },
    ]);
    // The title banner's Arabic translation and the "Subject:" block's Arabic line are both static
    // text confined to a narrow column next to an empty cell — widen each into that wasted space so
    // they don't wrap past 2 lines.
    return transformDocument(buffer, xml => {
        xml = widenStaticCell(xml, 'إشعار باتخاذ إجراء تأديبي', 'right');
        xml = widenStaticCell(xml, 'إشعار بالإجراء التأديبي', 'left');
        return xml;
    });
};
