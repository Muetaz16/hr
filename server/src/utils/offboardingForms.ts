import { fillTemplate, bilingual, loadNormalizedTemplate, fillInlineBlank, appendToCellEnd, finishTemplate } from './docxFormHelpers';

// The 4 official Offboarding templates live in the app's public folder. Uses the shared PizZip
// cell-rewrite technique in docxFormHelpers.ts. Every field mapping below was confirmed by directly
// inspecting each template's actual cell grid (label text + width + gridSpan), not assumed —
// signature/date-of-signing cells are always left blank for physical signing.

export interface ResignationRequestData {
    dateFiled: string;
    employeeId: string;
    employeeName: string;
    division: string;
    department: string;
    position: string;
    // The real intake form asks "Head of Department" — the printed template's own field is labelled
    // "Head of Division:", the closest match in the physical document. No canonical org data source
    // for this person's name either way, so it's captured as free text at intake.
    headOfDivision?: string;
    reason: string;
    reasonAr?: string; // HR-provided translation — see OffboardingCase.resignationReasonAr
    effectiveDate: string;
    letterText?: string; // the employee's own written resignation letter content
    letterTextAr?: string; // HR-provided translation — see OffboardingCase.resignationLetterTextAr
    finalWorkingDate?: string; // set once HR confirms it, later in the approval chain
}

export const generateResignationRequestDocx = (data: ResignationRequestData): Buffer =>
    fillTemplate('Resignation request form.docx', [
        { label: 'Date Filed:', value: data.dateFiled },
        { label: 'ID No:', value: data.employeeId },
        { label: 'Employee Name:', value: data.employeeName },
        { label: 'Division:', value: data.division },
        { label: 'Department:', value: data.department },
        { label: 'Position:', value: data.position },
        { label: 'Head of Division:', value: data.headOfDivision },
        // "Reason for Resignation" and "Resignation letter:" each have TWO separate un-merged value
        // cells in the raw template (label, EN value, AR value, AR label) — a genuine bilingual
        // layout, same shape as disciplinary's bilingual() fields, not a single shared box.
        ...bilingual('Reason for Resignation', data.reason, data.reasonAr),
        { label: 'Effective date:', value: data.effectiveDate },
        ...bilingual('Resignation letter:', data.letterText, data.letterTextAr),
        { label: 'Final Working Date:', value: data.finalWorkingDate },
    ]);

export interface EmployeeClearanceData {
    employeeId: string;
    employeeName: string;
    division: string;
    department: string;
    position: string;
    reportsTo?: string;
    startDate: string;
    dateOfSeparation: string;
    reason: string;
}

// The 6-way sign-off table (Head of Unit, Head of Department, IT, Assets, Finance & Treasury, Head
// of Human Resources) is left entirely blank for physical signing — one document, one physical-
// signature round, one upload, same convention as every other multi-approver disciplinary stage.
export const generateEmployeeClearanceDocx = (data: EmployeeClearanceData): Buffer =>
    fillTemplate('Clearance Form.docx', [
        { label: 'Employee ID:', value: data.employeeId },
        { label: 'Employee name:', value: data.employeeName },
        { label: 'Division:', value: data.division },
        { label: 'Department:', value: data.department },
        { label: 'Position:', value: data.position },
        { label: 'Reports to:', value: data.reportsTo },
        { label: 'Start Date:', value: data.startDate },
        { label: 'Date of Separation:', value: data.dateOfSeparation },
        { label: 'Reason for Registration:', value: data.reason },
    ]);

export interface SeparationLetterData {
    date: string;
    employeeId: string;
    employeeName: string;
    nationality?: string;
    contractType?: string;
    department: string;
    unit?: string;
    jobPosition: string;
    reportsTo?: string;
    jobCategory?: string;
    jobGrade?: string;
    contractStartDate?: string;
    contractEndDate?: string;
    dateOfSeparation: string;
    reason: string;
}

export const generateSeparationLetterDocx = (data: SeparationLetterData): Buffer =>
    fillTemplate('Separation letter.docx', [
        { label: 'Date:', value: data.date },
        // The "Employee Information" block's value cells are each already a single pre-merged cell
        // in this template (no mergeSpan needed) — confirmed by walking the actual <w:tr> rows, not
        // assumed from the older template's now-superseded layout. This template also has no
        // per-letter "Reference No." field at all (only the static top "Document Reference No:").
        { label: 'Employee ID:', value: data.employeeId },
        { label: 'Employee Name:', value: data.employeeName },
        { label: 'Nationality:', value: data.nationality },
        { label: 'Contract Type:', value: data.contractType },
        { label: 'Department:', value: data.department },
        { label: 'Unit:', value: data.unit },
        { label: 'Job Position:', value: data.jobPosition },
        { label: 'Reports to:', value: data.reportsTo },
        { label: 'Job Category:', value: data.jobCategory },
        { label: 'Job Grade:', value: data.jobGrade },
        { label: 'Contract Start Date:', value: data.contractStartDate },
        { label: 'Contract End Date:', value: data.contractEndDate },
        { label: 'Date of Separation:', value: data.dateOfSeparation },
        { label: 'Reason:', value: data.reason },
    ]);

export interface CertificateOfEmploymentData {
    employeeName: string;
    employeeNameAr?: string; // falls back to employeeName if the employee has no Arabic name on file
    position: string;
    // Whichever org level actually applies to this employee — Unit, Department (+ "(Office)" when
    // isOffice), or Division — same fallback chain PersonnelRelations.tsx's orgUnitName() already
    // uses; not every employee sits under an actual "Department".
    orgUnit: string;
    startDate: string; // the employee's FIRST contract's start date (their real "Join Date")
    untilDate: string;
    lastWorkingDay: string;
    issuedOnDate: string;
}

// This template writes each field as a full bilingual sentence with the fillable value embedded
// inline — either as a run of underscores (e.g. "in the position of ____") or, for the employee's
// name, no blank at all ("This is to certify that" — the name is appended straight onto the end).
// A fundamentally different shape from every other template here (which use discrete label+value
// cells), confirmed by walking the actual <w:tr> rows, not assumed — see fillInlineBlank/
// appendToCellEnd in docxFormHelpers.ts for how each kind is filled.
export const generateCertificateOfEmploymentDocx = (data: CertificateOfEmploymentData): Buffer => {
    let { zip, docPath, xml } = loadNormalizedTemplate('Certificate of Employement.docx');

    xml = appendToCellEnd(xml, 'This is to certify that', data.employeeName);
    xml = appendToCellEnd(xml, 'السيد/ة', data.employeeNameAr || data.employeeName);

    xml = fillInlineBlank(xml, 'in the position of', data.position);
    xml = fillInlineBlank(xml, 'في وظيفة', data.position);

    xml = fillInlineBlank(xml, 'within the', data.orgUnit);
    xml = fillInlineBlank(xml, 'مع القسم', data.orgUnit);

    xml = fillInlineBlank(xml, 'employed from', data.startDate);
    xml = fillInlineBlank(xml, 'من تاريخ', data.startDate);

    xml = fillInlineBlank(xml, 'Until', data.untilDate);
    xml = fillInlineBlank(xml, 'حتى', data.untilDate);

    xml = fillInlineBlank(xml, 'last working day being', data.lastWorkingDay);
    xml = fillInlineBlank(xml, 'آخر يوم عمل', data.lastWorkingDay);

    xml = fillInlineBlank(xml, 'Issued on', data.issuedOnDate);
    xml = fillInlineBlank(xml, 'تم إصدارها', data.issuedOnDate);

    return finishTemplate(zip, docPath, xml);
};
