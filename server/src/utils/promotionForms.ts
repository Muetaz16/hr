import { fillTemplate, FieldFill, transformDocument, relabelCell, capRowHeight } from './docxFormHelpers';

// The 2 official Promotion templates live in the app's public folder. Field mappings below were
// confirmed by directly inspecting each template's actual cell grid (label text + width + gridSpan
// per row), not assumed. Both templates repeat "Employee Name:" twice (Employee Information section
// + Acknowledgment section) — the second uses `occurrence: 2`. Signature/date-of-signing cells are
// always left blank for physical signing.

export interface PromotionReportData {
    employeeId: string;
    employeeName: string;
    division: string;
    department: string;
    jobTitle: string;
    jobCategory: string;
    jobGrade: string;
    newJobTitle?: string;
    newJobCategory?: string;
    newJobGrade: string;
    effectivityDate: string;
    reasonForPromotion?: string;
    // Oldest-first, up to 3 entries — `label` is the real month name (e.g. "April 2026") that
    // overwrites the template's static "March"/"April"/"May" text, `value` is that month's score.
    performanceMonths?: { label: string; value: string }[];
    overallPerformanceRating?: string;
    headOfDivision?: string;
    performanceManagementSpecialist?: string;
    headOfHumanResourcesDivision?: string;
}

// Every identity/promotion-detail field's value cell is split into 2 hidden-border sub-cells in the
// raw template (confirmed by walking the actual <w:tr> rows) — mergeSpan: 1 folds them into the one
// visual box the row was designed as, same convention as disciplinary's "IR No" field.
// This template's own labels print at 7.5pt (sz=15) with very little row-height slack (row heights
// default to OOXML's "atLeast" rule) — matching that exactly, rather than the generic 8pt default,
// is what keeps the filled-in document on the one page it was designed for.
const PROMOTION_REPORT_BASE_SIZE = 15;
const field = (label: string, value: string | undefined | null, occurrence = 1): FieldFill => ({ label, value, mergeSpan: 1, occurrence, baseSizeHalfPoints: PROMOTION_REPORT_BASE_SIZE });

// "Performance Evaluation Result Summary" mini table always prints the literal static labels
// "March"/"April"/"May" — filled by position (most recent of the last 3 calendar months first), then
// each static label is overwritten with the real month it actually represents.
const MONTH_ROW_LABELS = ['March', 'April', 'May'];

// Every row in "Employee Information", "Promotion Details", and the 3 evaluation-month rows capped
// to 0.18in (259 twips) — the concrete fix for the 2-page overflow once the base-size match alone
// wasn't enough. Uses the FIRST row matching each label, which is exactly the Employee Information
// one for "Employee Name:" (its second appearance, in the Acknowledgment section, is intentionally
// left at its own height). Applied by the ORIGINAL static "March"/"April"/"May" text, before those
// labels are overwritten with the real month names below.
const COMPACT_ROW_HEIGHT_TWIPS = Math.round(0.18 * 1440);
const COMPACT_ROW_LABELS = [
    'Employee ID:', 'Employee Name:', 'Division:', 'Department:', 'Job Title:', 'Job Category:', 'Job Grade:',
    'New Job Title:', 'New Job Category:', 'New Job Grade:', 'Effectivity Date:', 'Reason for Promotion:',
    'March', 'April', 'May',
];

export const generatePromotionReportDocx = (data: PromotionReportData): Buffer => {
    const months = data.performanceMonths || [];
    let buffer = fillTemplate('Promotion Report.docx', [
        field('Employee ID:', data.employeeId),
        field('Employee Name:', data.employeeName),
        field('Division:', data.division),
        field('Department:', data.department),
        field('Job Title:', data.jobTitle),
        field('Job Category:', data.jobCategory),
        field('Job Grade:', data.jobGrade),
        field('New Job Title:', data.newJobTitle),
        field('New Job Category:', data.newJobCategory),
        field('New Job Grade:', data.newJobGrade),
        field('Effectivity Date:', data.effectivityDate),
        field('Reason for Promotion:', data.reasonForPromotion),
        { label: MONTH_ROW_LABELS[0], value: months[0]?.value, baseSizeHalfPoints: PROMOTION_REPORT_BASE_SIZE },
        { label: MONTH_ROW_LABELS[1], value: months[1]?.value, baseSizeHalfPoints: PROMOTION_REPORT_BASE_SIZE },
        { label: MONTH_ROW_LABELS[2], value: months[2]?.value, baseSizeHalfPoints: PROMOTION_REPORT_BASE_SIZE },
        field('Overall performance rating:', data.overallPerformanceRating),
        field('Head of Division:', data.headOfDivision),
        field('Employee Name:', data.employeeName, 2),
        field('Performance Management Specialist:', data.performanceManagementSpecialist),
        field('Head of Human Resources Division:', data.headOfHumanResourcesDivision),
    ]);
    buffer = transformDocument(buffer, xml => COMPACT_ROW_LABELS.reduce((acc, label) => capRowHeight(acc, label, COMPACT_ROW_HEIGHT_TWIPS), xml));
    months.forEach((m, i) => {
        if (m?.label) buffer = transformDocument(buffer, xml => relabelCell(xml, MONTH_ROW_LABELS[i], m.label, PROMOTION_REPORT_BASE_SIZE));
    });
    return buffer;
};

export interface NoticeOfPromotionData {
    employeeId: string;
    employeeName: string;
    division: string;
    department: string;
    jobTitle: string;
    jobCategory: string;
    jobGrade: string;
    newJobTitle?: string;
    newJobCategory?: string;
    newJobGrade: string;
    effectivityDate: string;
    reasonForPromotion?: string;
    headOfHumanResources?: string;
}

// Same fields as the Promotion Report, but every value cell spans 3 hidden-border sub-cells here
// (mergeSpan: 2) — confirmed by walking this template's own (wider) row layout. This template also
// has a static "Document Reference No: IPH-HRD-EMU-F-003-R00" line — left untouched, no field
// targets it.
const wideField = (label: string, value: string | undefined | null, occurrence = 1): FieldFill => ({ label, value, mergeSpan: 2, occurrence });

export const generateNoticeOfPromotionDocx = (data: NoticeOfPromotionData): Buffer =>
    fillTemplate('NOTICE OF PROMOTION.docx', [
        wideField('Employee Name:', data.employeeName),
        wideField('Employee ID:', data.employeeId),
        wideField('Division:', data.division),
        wideField('Department:', data.department),
        wideField('Job Title:', data.jobTitle),
        wideField('Job Category:', data.jobCategory),
        wideField('Job Grade:', data.jobGrade),
        wideField('New Job Title:', data.newJobTitle),
        wideField('New Job Category:', data.newJobCategory),
        wideField('New Job Grade:', data.newJobGrade),
        wideField('Effectivity Date:', data.effectivityDate),
        wideField('Reason for Promotion:', data.reasonForPromotion),
        wideField('Head of Human Resources:', data.headOfHumanResources),
        wideField('Employee Name:', data.employeeName, 2),
    ]);
