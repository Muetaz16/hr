// The employee payslip, filled from public/PAYSLIP.docx.
//
// The template is a bilingual 12-table form; every value cell sits at label+1, with the Arabic label
// at label+2. Verified by walking its 174 cells rather than assumed, so the labels below are the
// template's own strings — change one in Word and the fill for that row simply stops matching,
// which is the failure mode we want (a blank box) rather than a number in the wrong row.
//
// Three things the template settles that the code must respect:
//
//   1. There is NO "Full Salary" row. The form itemises each factor's contribution instead. That is
//      arithmetically the same thing (Basic + Σ Basic×(fᵢ−1) ≡ Basic × F) but it means the engine
//      has to emit each allowance separately, which it does.
//   2. "Remaining Advance Deduction" sits inside the DEDUCTIONS box but is NOT part of Total
//      Deduction — it is the outstanding balance, shown for the employee's information. Adding it in
//      would deduct the same money twice.
//   3. UNPAID HOURS has its own box and no amount beside it. Unpaid leave is not deducted; the
//      hours are already excluded from the hours worked.
//
// The QR code and the letterhead are static parts of the template. Nothing is generated for them.
import PizZip from 'pizzip';

import { fillTemplate, FieldFill } from './docxFormHelpers';
import { periodLabel, periodMonthNameArabic } from './payrollPeriod';

const TEMPLATE = 'PAYSLIP.docx';

/**
 * Value font size, in HALF-points — OOXML's own unit, so 14 is 7pt.
 *
 * The helper's default is 16 (8pt). Seven keeps every value a step below the labels it sits beside,
 * which matters here more than on other forms: this template packs twelve tables onto one page, and
 * row heights use OOXML's "atLeast" rule, so a value rendered larger than its label grows the row
 * and pushes the payslip onto a second page.
 *
 * fittingFontSize treats this as the MAXIMUM and steps down further for a long value in a narrow
 * cell, so a long name still fits rather than wrapping past two lines.
 */
const VALUE_SIZE_HALF_POINTS = 14;

/** Guards the Arabic month append against running twice on the same document. */
const ARABIC_MONTH_MARKER = 'قسيمة الراتب لشهر ';

/** A payroll line, as much of it as the payslip prints. */
export interface PayslipLine {
    staffId: string | null;
    fullName: string | null;
    divisionName: string | null;
    departmentName: string | null;
    positionTitle: string | null;
    jobCategory: string | null;
    jobGrade: string | null;
    workLocation: string | null;
    contractEndDate: Date | string | null;

    currency: string;
    hourlyRate: number;
    positionFactor: number;
    siteFactor: number;
    skillFactor: number;
    languageFactor: number;

    basicHours: number;
    overtimeHours: number;
    totalWorkingHours: number;
    paidAbsenceHours: number;
    paidAbsenceAmount: number;
    unpaidHours: number;

    basicSalary: number;
    positionAllowance: number;
    siteAllowance: number;
    languageAllowance: number;
    skillAllowance: number;
    bonusAmount: number;
    totalEarnings: number;
    deductionsTotal: number;
    netSalary: number;
    remainingAdvanceBalance: number;

    presenceScore: number | null;
    execScore: number | null;
    adminScore: number | null;
    careScore: number | null;
    trainingScore: number | null;
    evaluationTotal: number | null;
    promotionEligibilityIndex: number | null;

    paidLeaveBalance: number | null;
    unpaidLeaveBalance: number | null;
    emergencyLeaveBalance: number | null;

    items: { kind: string; category: string; amount: number }[];
}

const money = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const hours = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Scores print as percentages with one decimal; a missing evaluation prints as a dash, not 0.0%. */
const percent = (n: number | null | undefined) =>
    n === null || n === undefined ? '—' : `${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const factor = (n: number) => n.toFixed(2);

const date = (d: Date | string | null) => {
    if (!d) return '—';
    const v = new Date(d);
    return isNaN(v.getTime()) ? '—' : v.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sumItems = (line: PayslipLine, kind: string, category: string) =>
    line.items.filter(i => i.kind === kind && i.category === category).reduce((s, i) => s + i.amount, 0);

/**
 * Fills the title paragraph's inline blank: "PAYSLIP FOR THE MONTH OF ______ , 2026".
 *
 * It lives in a body paragraph rather than a table cell, so fillInlineBlank (which is cell-scoped)
 * cannot reach it. The run holding the underscores is swapped directly, keeping its formatting, and
 * the hard-coded year is corrected only when it is actually wrong.
 */
const fillTitle = (xml: string, period: string): string => {
    const label = periodLabel(period);            // "September 2026"
    const [monthName, year] = label.split(' ');

    // Scoped to the title paragraph, and it has to be: the blank is split across TWO runs in this
    // template — thirteen underscores in one, then "_ ," in the next. Replacing only the longest run
    // leaves a stray underscore and the payslip reads "September_ , 2026".
    const paraMatch = xml.match(/<w:p\b[\s\S]*?PAYSLIP FOR THE MONTH OF[\s\S]*?<\/w:p>/);
    if (!paraMatch) return xml;

    let para = paraMatch[0];
    let filled = false;
    para = para.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_m, attrs: string, text: string) => {
        if (!text.includes('_')) return `<w:t${attrs}>${text}</w:t>`;
        // The first underscore run becomes the month; any further underscores are just cleared,
        // keeping whatever punctuation shared the run with them.
        const stripped = text.replace(/_+/g, filled ? '' : monthName);
        filled = true;
        return `<w:t${attrs}>${stripped}</w:t>`;
    });

    // The year is typed into the template. Correct it only when it is actually wrong, so a 2026
    // payslip comes out byte-identical to the form people already know.
    if (year && year !== '2026') para = para.replace(/2026/g, year);

    // The Arabic half of the title stops at "قسيمة الراتب لشهر" with no month after it. Appended
    // inside that same run so it inherits the run's own bold maroon RTL formatting rather than
    // arriving as a new run in whatever the paragraph's default happens to be.
    //
    // The month NAME only, no year: the year is already printed a few words earlier in the English
    // half of the same line, and repeating it just reads as a mistake.
    //
    // xml:space="preserve" is forced on: without it Word strips the leading space and the month
    // runs into the word before it.
    if (!para.includes(ARABIC_MONTH_MARKER)) {
        para = para.replace(
            /<w:t([^>]*)>(قسيمة الراتب لشهر)<\/w:t>/,
            (_m, attrs: string, text: string) => {
                const withSpace = / xml:space="preserve"/.test(attrs) ? attrs : `${attrs} xml:space="preserve"`;
                return `<w:t${withSpace}>${text} ${periodMonthNameArabic(period)}</w:t>`;
            },
        );
    }

    return xml.replace(paraMatch[0], para);
};

export const generatePayslipDocx = (line: PayslipLine, period: string): Buffer => {
    const cur = line.currency;
    const withCur = (n: number) => `${money(n)} ${cur}`;

    // Position and skill are mutually exclusive — the engine already zeroes the loser's allowance,
    // so printing both straight from the line is correct and one of the two always reads 0.00.
    const fields: FieldFill[] = [
        // --- EMPLOYEE INFORMATION -------------------------------------------------------------
        { label: 'Employee Name', value: line.fullName || '—' },
        { label: 'Employee ID', value: line.staffId || '—' },
        { label: 'Division', value: line.divisionName || '—' },
        { label: 'Department', value: line.departmentName || '—' },
        { label: 'Job Position', value: line.positionTitle || '—' },
        { label: 'Job Category', value: line.jobCategory || '—' },
        { label: 'Job Grade', value: line.jobGrade || '—' },
        { label: 'Work Location', value: line.workLocation || '—' },

        // --- SALARY INFORMATION ----------------------------------------------------------------
        { label: 'Basic Hours', value: hours(line.basicHours) },
        { label: 'Overtime Hours', value: hours(line.overtimeHours) },
        { label: 'Total Working Hours', value: hours(line.totalWorkingHours) },
        { label: 'Total Paid Absences Hours', value: hours(line.paidAbsenceHours) },
        { label: 'Total Paid Absences Amount', value: withCur(line.paidAbsenceAmount) },

        // --- Earnings ---------------------------------------------------------------------------
        { label: 'Basic Salary', value: withCur(line.basicSalary) },
        { label: 'Site Factor Allowance', value: withCur(line.siteAllowance) },
        { label: 'Position Factor Allowance', value: withCur(line.positionAllowance) },
        { label: 'English Language Allowance', value: withCur(line.languageAllowance) },
        { label: 'Skill Factor Allowance', value: withCur(line.skillAllowance) },
        { label: 'Paid Absences', value: withCur(line.paidAbsenceAmount) },
        { label: 'Bonus Allowance', value: withCur(line.bonusAmount) },
        { label: 'Previous Miscalculation for Underpayment', value: withCur(sumItems(line, 'EARNING', 'PREVIOUS_UNDERPAYMENT')) },
        { label: 'Total Earnings', value: withCur(line.totalEarnings) },

        // --- PERFORMANCE EVALUATION (display only; never affects an amount) ---------------------
        { label: 'Attendance', value: percent(line.presenceScore) },
        { label: 'Executive Performance', value: percent(line.execScore) },
        { label: 'Administrative Behavior', value: percent(line.adminScore) },
        { label: 'Care and Discipline', value: percent(line.careScore) },
        { label: 'Training and Education', value: percent(line.trainingScore) },
        { label: 'Total', value: percent(line.evaluationTotal) },

        // --- RATES & FACTORS --------------------------------------------------------------------
        { label: 'Hourly Rate', value: withCur(line.hourlyRate) },
        { label: 'Site Factor', value: factor(line.siteFactor) },
        { label: 'Position Factor', value: factor(line.positionFactor) },
        { label: 'English Language Factor', value: factor(line.languageFactor) },
        { label: 'Skill Factor', value: factor(line.skillFactor) },
        { label: 'Contract Expiration Date', value: date(line.contractEndDate) },

        // --- UNPAID HOURS (display only — unpaid leave is not deducted) -------------------------
        { label: 'Total Unpaid Hours', value: hours(line.unpaidHours) },

        // --- DEDUCTIONS -------------------------------------------------------------------------
        { label: 'Cash Advance Deduction', value: withCur(sumItems(line, 'DEDUCTION', 'CASH_ADVANCE')) },
        // The outstanding balance. Inside the box, deliberately outside the total.
        { label: 'Remaining Advance Deduction', value: withCur(line.remainingAdvanceBalance) },
        { label: 'Ticket Cost Deduction', value: withCur(sumItems(line, 'DEDUCTION', 'TICKET_COST')) },
        { label: 'Penalty Deduction', value: withCur(sumItems(line, 'DEDUCTION', 'PENALTY')) },
        { label: 'Health Insurance Cost Overruns', value: withCur(sumItems(line, 'DEDUCTION', 'HEALTH_INSURANCE_OVERRUN')) },
        { label: 'Previous Miscalculation for Overpayment', value: withCur(sumItems(line, 'DEDUCTION', 'PREVIOUS_OVERPAYMENT')) },
        { label: 'Total Deduction', value: withCur(line.deductionsTotal) },

        // --- NET SALARY -------------------------------------------------------------------------
        { label: 'Amount', value: money(line.netSalary) },
        { label: 'Currency', value: cur },

        // --- LEAVE ENTITLEMENT ------------------------------------------------------------------
        { label: 'Paid', value: line.paidLeaveBalance === null ? '—' : hours(line.paidLeaveBalance) },
        { label: 'Unpaid', value: line.unpaidLeaveBalance === null ? '—' : hours(line.unpaidLeaveBalance) },
        { label: 'Emergency', value: line.emergencyLeaveBalance === null ? '—' : hours(line.emergencyLeaveBalance) },
    ];

    // "Promotion Eligibility Index" is a two-cell row (label | value), unlike the three-cell rows
    // above — so its value lands at label+1 all the same, but it is listed separately here to make
    // that difference explicit rather than a coincidence.
    fields.push({ label: 'Promotion Eligibility Index', value: percent(line.promotionEligibilityIndex) });

    // Two passes: fillTemplate handles the label/value cells, then the title's inline blank is
    // swapped in the body paragraph, which a cell-scoped fill cannot reach.
    // Stamped once here rather than repeated on all ~48 fields, so the size cannot drift between
    // rows and there is exactly one place to change it.
    const sized = fields.map(f => ({ baseSizeHalfPoints: VALUE_SIZE_HALF_POINTS, ...f }));

    const zip = new PizZip(fillTemplate(TEMPLATE, sized));
    const docPath = 'word/document.xml';
    const xml = zip.file(docPath)?.asText();
    if (!xml) throw new Error('Payslip: the filled document is missing word/document.xml.');
    zip.file(docPath, fillTitle(xml, period));
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};

// ---------------------------------------------------------------------------------------------
// One printable file holding every employee's payslip.
//
// Built by generating each payslip through the SAME path as a single one, then concatenating their
// bodies with a page break between. Doing it that way rather than writing a second, "bulk" filler
// means the printed booklet cannot drift from the individual documents: if one is right, all are.
//
// Only the body is repeated. Styles, fonts, the letterhead header and the QR image are shared
// parts of the package and stay single copies — the one <w:sectPr> at the end carries the header
// reference, so the letterhead repeats on every page by itself.
// ---------------------------------------------------------------------------------------------

const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/** The content between <w:body> and its closing tag, minus the trailing section properties. */
const bodyOf = (documentXml: string): { inner: string; sectPr: string } => {
    const open = documentXml.indexOf('<w:body>');
    const close = documentXml.lastIndexOf('</w:body>');
    if (open < 0 || close < 0) throw new Error('Payslip: the document has no <w:body>.');
    let inner = documentXml.slice(open + '<w:body>'.length, close);

    // The section properties define the page and the header; they belong once, at the very end.
    const sectAt = inner.lastIndexOf('<w:sectPr');
    let sectPr = '';
    if (sectAt >= 0) {
        sectPr = inner.slice(sectAt);
        inner = inner.slice(0, sectAt);
    }
    return { inner, sectPr };
};

/**
 * w14:paraId / w14:textId identify a paragraph for co-authoring and are meant to be unique in a
 * document. Repeating the same body N times duplicates 259 of them each time, which some builds of
 * Word flag as a repair. They carry no formatting, so they are simply dropped from the copies.
 */
const stripParagraphIds = (xml: string): string =>
    xml.replace(/\s+w14:(?:paraId|textId)="[0-9A-Fa-f]+"/g, '');

export const generatePayslipBookDocx = (lines: PayslipLine[], period: string): Buffer => {
    if (lines.length === 0) throw new Error('There are no payable employees in this period, so there is nothing to print.');

    const first = new PizZip(generatePayslipDocx(lines[0], period));
    const docPath = 'word/document.xml';
    const firstXml = first.file(docPath)?.asText();
    if (!firstXml) throw new Error('Payslip: the generated document is missing word/document.xml.');

    const { inner: firstInner, sectPr } = bodyOf(firstXml);
    const bodies: string[] = [stripParagraphIds(firstInner)];

    for (let i = 1; i < lines.length; i++) {
        const xml = new PizZip(generatePayslipDocx(lines[i], period)).file(docPath)!.asText();
        bodies.push(stripParagraphIds(bodyOf(xml).inner));
    }

    const prefix = firstXml.slice(0, firstXml.indexOf('<w:body>') + '<w:body>'.length);
    const suffix = firstXml.slice(firstXml.lastIndexOf('</w:body>'));

    first.file(docPath, prefix + bodies.join(PAGE_BREAK) + sectPr + suffix);
    return first.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
