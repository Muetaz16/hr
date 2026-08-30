import { fillTemplate, type FieldFill } from './docxFormHelpers';

// "Appreciacion Letter and Reward.docx" (filename typo preserved — it's the real file's actual name)
// confirmed in public/ and inspected cell-by-cell. The user rebuilt the intro block's table
// structure by hand (2026-08-30) so Date:/Reference No./To: are now plain label/value/Arabic-label
// rows, same shape as the Employee Information section below — a standard fillTemplate field() fill
// for all of them, no special-cased paragraph-append/tab-centering logic needed anymore. Per the
// user: this letter is fully system-generated, nobody fills anything in by hand — the 3-column
// "Personnel Relations / Employee Acknowledgment / Payroll & Compensation" row near the bottom is
// left blank on purpose (no field targets it).
const TEMPLATE = 'Appreciacion Letter and Reward.docx';

export interface AppreciationLetterData {
    employeeId: string;
    employeeName: string;
    referenceNo: string;
    issuedDate: string;
    // Pre-formatted by the caller (e.g. "Employee of the Month (2026-07)", "Loyalty & Service
    // Milestone Award — 10 Years") — this file only places strings into cells, it doesn't know the
    // award-type vocabulary.
    typeOfAppreciation: string;
    // Pre-formatted human-readable summary, e.g. "1 additional day of paid annual leave" or
    // "Engraved watch and a one-time bonus of 5% of salary (pending Payroll integration)".
    reward: string;
    // The literal number of leave days credited, or 'N/A' for awards that credit none (Loyalty).
    annualDaysAdded: string;
}

const field = (label: string, value: string | undefined | null): FieldFill => ({ label, value, offset: 1 });

export const generateAppreciationLetterDocx = (data: AppreciationLetterData): Buffer => {
    return fillTemplate(TEMPLATE, [
        field('Date:', data.issuedDate),
        field('Reference No.', data.referenceNo),
        field('To:', data.employeeName),
        field('Employee ID:', data.employeeId),
        field('Employee Name:', data.employeeName),
        field('Type of appreciacion:', data.typeOfAppreciation),
        field('Reward:', data.reward),
        field('Annual days added to contract master:', data.annualDaysAdded),
    ]);
};
