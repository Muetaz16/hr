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

// ---------------------------------------------------------------------------------------------
// The payslip's content, section by section.
//
// One list, two readers: the Word filler below, and the employee's on-screen payslip, which fetches
// it over GET /api/payslips/me/:period/view. That sharing is the point — a second copy of these
// forty-odd labels and their formatting in the frontend would be a second payslip, and it would
// drift from this one the first time somebody changed a label.
//
// The bilingual labels are the TEMPLATE's own strings, read out of PAYSLIP.docx cell by cell rather
// than translated here. The English label doubles as the key fillTemplate matches on, so changing
// one stops that row from being filled — a blank box, which is the failure mode we want — instead
// of putting a number in the wrong row.
// ---------------------------------------------------------------------------------------------

/** One printed row. */
export interface PayslipRow {
    label: string;
    labelAr: string;
    value: string;
}

/** A heading inside a section — SALARY INFORMATION has two: "Paid Hours" and "Earnings". */
export interface PayslipSubheading {
    subheading: string;
    subheadingAr: string;
}

export interface PayslipSection {
    key: string;
    title: string;
    titleAr: string;
    /** The caption the template prints above the value column, where it prints one. */
    valueHeader?: string;
    rows: (PayslipRow | PayslipSubheading)[];
}

export const isSubheading = (r: PayslipRow | PayslipSubheading): r is PayslipSubheading =>
    'subheading' in r;

export const payslipSections = (line: PayslipLine): PayslipSection[] => {
    const cur = line.currency;
    const withCur = (n: number) => `${money(n)} ${cur}`;

    return [
        {
            key: 'employee', title: 'EMPLOYEE INFORMATION', titleAr: 'بيانات الموظف',
            rows: [
                { label: 'Employee Name', labelAr: 'اسم الموظف', value: line.fullName || '—' },
                { label: 'Employee ID', labelAr: 'الرقم الوظيفي', value: line.staffId || '—' },
                { label: 'Division', labelAr: 'الإدارة', value: line.divisionName || '—' },
                { label: 'Department', labelAr: 'القسم', value: line.departmentName || '—' },
                { label: 'Job Position', labelAr: 'الوظيفة', value: line.positionTitle || '—' },
                { label: 'Job Category', labelAr: 'فئة الوظيفة', value: line.jobCategory || '—' },
                { label: 'Job Grade', labelAr: 'درجة الوظيفة', value: line.jobGrade || '—' },
                { label: 'Work Location', labelAr: 'موقع العمل', value: line.workLocation || '—' },
            ],
        },
        {
            key: 'salary', title: 'SALARY INFORMATION', titleAr: 'بيانات الراتب',
            rows: [
                { subheading: 'Paid Hours', subheadingAr: 'الساعات المدفوعة' },
                { label: 'Basic Hours', labelAr: 'ساعات العمل', value: hours(line.basicHours) },
                { label: 'Overtime Hours', labelAr: 'ساعات العمل الإضافية', value: hours(line.overtimeHours) },
                { label: 'Total Working Hours', labelAr: 'إجمالي ساعات العمل', value: hours(line.totalWorkingHours) },
                { label: 'Total Paid Absences Hours', labelAr: 'إجمالي ساعات الغياب المدفوعة', value: hours(line.paidAbsenceHours) },
                { label: 'Total Paid Absences Amount', labelAr: 'إجمالي قيمة ساعات الغياب المدفوعة', value: withCur(line.paidAbsenceAmount) },

                { subheading: 'Earnings', subheadingAr: 'الأرباح' },
                { label: 'Basic Salary', labelAr: 'صافي المرتب', value: withCur(line.basicSalary) },
                { label: 'Site Factor Allowance', labelAr: 'بدل عامل الموقع', value: withCur(line.siteAllowance) },
                // Position and skill are mutually exclusive — the engine already zeroes the loser's
                // allowance, so printing both straight from the line is correct and one always reads 0.00.
                { label: 'Position Factor Allowance', labelAr: 'بدل عامل الوظيفة', value: withCur(line.positionAllowance) },
                { label: 'English Language Allowance', labelAr: 'بدل عامل اللغة الإنجليزية', value: withCur(line.languageAllowance) },
                { label: 'Skill Factor Allowance', labelAr: 'بدل عامل المهارة', value: withCur(line.skillAllowance) },
                { label: 'Paid Absences', labelAr: 'إجازة مدفوعة الأجر', value: withCur(line.paidAbsenceAmount) },
                { label: 'Bonus Allowance', labelAr: 'بدل المكافأة', value: withCur(line.bonusAmount) },
                {
                    label: 'Previous Miscalculation for Underpayment',
                    labelAr: 'احتساب الخاطئ السابق لمبالغ الدفع الناقصة',
                    value: withCur(sumItems(line, 'EARNING', 'PREVIOUS_UNDERPAYMENT')),
                },
                { label: 'Total Earnings', labelAr: 'إجمالي الأرباح', value: withCur(line.totalEarnings) },
            ],
        },
        {
            // Display only. These scores never alter an amount anywhere in the engine.
            key: 'evaluation', title: 'PERFORMANCE EVALUATION', titleAr: 'تقييم الأداء الشهري',
            valueHeader: 'Percentage / النسبة',
            rows: [
                { label: 'Attendance', labelAr: 'التواجـــد', value: percent(line.presenceScore) },
                { label: 'Executive Performance', labelAr: 'الأداء التنفيذي', value: percent(line.execScore) },
                { label: 'Administrative Behavior', labelAr: 'السلوك الإداري', value: percent(line.adminScore) },
                { label: 'Care and Discipline', labelAr: 'الحرص والانضباط', value: percent(line.careScore) },
                { label: 'Training and Education', labelAr: 'التدريب والتعليم', value: percent(line.trainingScore) },
                { label: 'Total', labelAr: 'الإجمــــالي', value: percent(line.evaluationTotal) },
                // KNOWN TEMPLATE DEFECT: this row has only two cells in PAYSLIP.docx — the English
                // label and the Arabic one — where every other row has three. fillTemplate writes the
                // value at label+1, which here is the Arabic cell, so the Word payslip prints the
                // percentage OVER "معدل الاستحقاق للترقية" and loses that label. Fixing it means adding
                // a value cell to that row in the .docx, which is the document owner's call. The
                // on-screen payslip has no such shortage and shows all three.
                {
                    label: 'Promotion Eligibility Index', labelAr: 'معدل الاستحقاق للترقية',
                    value: percent(line.promotionEligibilityIndex),
                },
            ],
        },
        {
            key: 'rates', title: 'RATES & FACTORS', titleAr: 'المعدلات والعوامل',
            rows: [
                { label: 'Hourly Rate', labelAr: 'الأجر بالساعة', value: withCur(line.hourlyRate) },
                { label: 'Site Factor', labelAr: 'عامل الموقع', value: factor(line.siteFactor) },
                { label: 'Position Factor', labelAr: 'عامل الوظيفة', value: factor(line.positionFactor) },
                { label: 'English Language Factor', labelAr: 'عامل اللغة الإنجليزية', value: factor(line.languageFactor) },
                { label: 'Skill Factor', labelAr: 'عامل المهارة', value: factor(line.skillFactor) },
                { label: 'Contract Expiration Date', labelAr: 'تاريخ انتهاء العقد', value: date(line.contractEndDate) },
            ],
        },
        {
            // Its own box with no amount beside it: unpaid leave is not deducted, because those
            // hours were already excluded from the hours worked.
            key: 'unpaid', title: 'UNPAID HOURS', titleAr: 'الساعات غير المدفوعة',
            rows: [
                { label: 'Total Unpaid Hours', labelAr: 'إجمالي الساعات غير المدفوعة', value: hours(line.unpaidHours) },
            ],
        },
        {
            key: 'deductions', title: 'DEDUCTIONS', titleAr: 'الخصومات',
            rows: [
                { label: 'Cash Advance Deduction', labelAr: 'خصم سلفة الراتب', value: withCur(sumItems(line, 'DEDUCTION', 'CASH_ADVANCE')) },
                // The outstanding balance. Inside the box, deliberately outside the total — adding
                // it in would deduct the same money twice.
                { label: 'Remaining Advance Deduction', labelAr: 'باقي سلفة الراتب', value: withCur(line.remainingAdvanceBalance) },
                { label: 'Ticket Cost Deduction', labelAr: 'خصم تكاليف التذاكر', value: withCur(sumItems(line, 'DEDUCTION', 'TICKET_COST')) },
                { label: 'Penalty Deduction', labelAr: 'خصم عقوبة', value: withCur(sumItems(line, 'DEDUCTION', 'PENALTY')) },
                {
                    label: 'Health Insurance Cost Overruns', labelAr: 'تجاوزات تكاليف تأمين الصحة',
                    value: withCur(sumItems(line, 'DEDUCTION', 'HEALTH_INSURANCE_OVERRUN')),
                },
                {
                    label: 'Previous Miscalculation for Overpayment', labelAr: 'خطأ سابق في حساب دفع زائد',
                    value: withCur(sumItems(line, 'DEDUCTION', 'PREVIOUS_OVERPAYMENT')),
                },
                { label: 'Total Deduction', labelAr: 'إجمالي الخصم', value: withCur(line.deductionsTotal) },
            ],
        },
        {
            key: 'net', title: 'NET SALARY', titleAr: 'الراتب الصافي',
            rows: [
                { label: 'Amount', labelAr: 'الكمية', value: money(line.netSalary) },
                { label: 'Currency', labelAr: 'العملة', value: cur },
            ],
        },
        {
            key: 'leave', title: 'LEAVE ENTITLEMENT', titleAr: 'الإجازات المستحقة',
            rows: [
                { label: 'Paid', labelAr: 'مدفوعة', value: line.paidLeaveBalance === null ? '—' : hours(line.paidLeaveBalance) },
                { label: 'Unpaid', labelAr: 'غير مدفوعة', value: line.unpaidLeaveBalance === null ? '—' : hours(line.unpaidLeaveBalance) },
                { label: 'Emergency', labelAr: 'طارئة', value: line.emergencyLeaveBalance === null ? '—' : hours(line.emergencyLeaveBalance) },
            ],
        },
    ];
};

/** Every data row, flattened out of the sections — what the Word filler matches labels against. */
export const payslipRows = (line: PayslipLine): PayslipRow[] =>
    payslipSections(line).flatMap(s => s.rows).filter((r): r is PayslipRow => !isSubheading(r));

export const generatePayslipDocx = (line: PayslipLine, period: string): Buffer => {
    // The size is stamped once here rather than on every row, so it cannot drift between rows and
    // there is exactly one place to change it.
    const fields: FieldFill[] = payslipRows(line).map(r => ({
        label: r.label,
        value: r.value,
        baseSizeHalfPoints: VALUE_SIZE_HALF_POINTS,
    }));

    // Two passes: fillTemplate handles the label/value cells, then the title's inline blank is
    // swapped in the body paragraph, which a cell-scoped fill cannot reach.
    const zip = new PizZip(fillTemplate(TEMPLATE, fields));
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
