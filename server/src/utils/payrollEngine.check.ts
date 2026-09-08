// Assertions for the payroll calculation. Run with `npm run check:payroll` from server/.
//
// The repo has no test framework and adding one was out of scope, but this module decides what
// people get paid, so it gets a runnable check rather than none. It uses only the toolchain that
// already exists (ts-node, the same way prisma/seed-hats.ts runs) and exits non-zero on failure,
// so it can be wired into CI later without change.
import { computePayrollLine, composeFactor, round2 } from './payrollEngine';
import {
    financialMonthRange, toApiDate, cutoffFor, periodForDate, previousPeriod, periodLabel,
} from './payrollPeriod';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
    if (!ok) console.log(`       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`);
};

// --- The financial month: 25th of N-1 -> 24th of N, labelled by the END month ----------------
const sep = financialMonthRange('2026-09');
eq('2026-09 covers 08-25 -> 09-24', [toApiDate(sep.start), toApiDate(sep.end)], ['2026-08-25', '2026-09-24']);
const jan = financialMonthRange('2026-01');
eq('January rolls back into the previous year', [toApiDate(jan.start), toApiDate(jan.end)], ['2025-12-25', '2026-01-24']);
const mar = financialMonthRange('2026-03');
eq('March starts in short February', [toApiDate(mar.start), toApiDate(mar.end)], ['2026-02-25', '2026-03-24']);
eq('cut-off is the 27th at 17:00', `${toApiDate(cutoffFor('2026-09'))} ${cutoffFor('2026-09').getHours()}`, '2026-09-27 17');
eq('the 24th still belongs to this period', periodForDate(new Date(2026, 8, 24)), '2026-09');
eq('the 25th rolls into the next period', periodForDate(new Date(2026, 8, 25)), '2026-10');
eq('25 December rolls into next January', periodForDate(new Date(2026, 11, 25)), '2027-01');
eq('previousPeriod crosses the year', previousPeriod('2026-01'), '2025-12');
eq('periodLabel', periodLabel('2026-09'), 'September 2026');

// --- Rounding: the EPSILON term, without which 1.005 rounds down in binary FP -----------------
eq('round2(1.005)', round2(1.005), 1.01);
eq('round2(2.675)', round2(2.675), 2.68);
eq('round2(-1.005)', round2(-1.005), -1.01);

// --- Factor composition: sum of increments, position and skill mutually exclusive -------------
eq('all defaults give F = 1.0', composeFactor(1, 1, 1, 1), 1);
eq("the user's example: 1.3 and 1.2 give 1.5", composeFactor(1.3, 1, 1.2, 1), 1.5);
eq('position beats skill (max, never both)', composeFactor(1.4, 1.3, 1, 1), 1.4);
eq('skill wins when it is the higher one', composeFactor(1.1, 1.5, 1, 1), 1.5);
eq('all four factors, position winning', composeFactor(1.4, 1.2, 1.1, 1.1), 1.6);
eq('binary-float noise is cleaned off F', composeFactor(1.15, 1, 1.15, 1.15), 1.45);

// --- A fully worked payslip -------------------------------------------------------------------
// 160 regular hours + 10 approved OT at 10.00/hr; position 1.30, site 1.10, language 1.10;
// 8 paid-leave hours; a single 10% bonus; 250 of deductions; provider at 15%.
const line = computePayrollLine({
    hourlyRate: 10,
    workMins: 160 * 60, approvedOtMins: 10 * 60, paidLeaveMins: 8 * 60,
    positionFactor: 1.3, siteFactor: 1.1, skillFactor: 1.0, languageFactor: 1.1,
    bonusPercents: [10], deductions: [250], serviceProviderPercentage: 15,
});
eq('basic hours', line.basicHours, 160);
eq('overtime hours', line.overtimeHours, 10);
eq('total working hours = basic + approved OT', line.totalWorkingHours, 170);
eq('Basic Salary = 170 x 10', line.basicSalary, 1700);
eq('Position Factor Allowance = 1700 x 0.30', line.positionAllowance, 510);
eq('Skill Factor Allowance is 0 because position won', line.skillAllowance, 0);
eq('Site Factor Allowance = 1700 x 0.10', line.siteAllowance, 170);
eq('English Language Allowance = 1700 x 0.10', line.languageAllowance, 170);
eq('Paid Absences = 8 x 10, no factors applied', line.paidAbsenceAmount, 80);
eq('Bonus is a percentage of BASIC, not of Full', line.bonusAmount, 170);
eq('Total Earnings', line.totalEarnings, 1700 + 510 + 170 + 170 + 80 + 170);
eq('Net = Total Earnings - Total Deduction', line.netSalary, 2800 - 250);
eq('Service-provider fee is 15% of NET', line.serviceProviderFee, 382.5);
eq('Employer total cost = net + fee', line.employerTotalCost, 2932.5);

// The identity the payslip depends on: itemised allowances must reconstruct Basic x F exactly.
eq(
    'Basic + the four allowances == Basic x F',
    round2(line.basicSalary + line.positionAllowance + line.siteAllowance + line.languageAllowance + line.skillAllowance),
    line.fullSalary,
);

// --- Edge cases -------------------------------------------------------------------------------
const base = {
    workMins: 6000, approvedOtMins: 0, paidLeaveMins: 0,
    positionFactor: 1, siteFactor: 1, skillFactor: 1, languageFactor: 1,
};
const noRate = computePayrollLine({ ...base, hourlyRate: 0, positionFactor: 1.4 });
eq('an unresolved rate produces zeroes, never a partial figure', [noRate.basicSalary, noRate.totalEarnings, noRate.netSalary], [0, 0, 0]);
const negative = computePayrollLine({ ...base, hourlyRate: 10, workMins: 60, deductions: [500] });
eq('a negative net is computed, not clamped (it must be flagged, not hidden)', negative.netSalary, -490);
eq('no provider means no fee', computePayrollLine({ ...base, hourlyRate: 10, serviceProviderPercentage: null }).serviceProviderFee, 0);
eq('an out-of-range percentage is ignored rather than applied', computePayrollLine({ ...base, hourlyRate: 10, serviceProviderPercentage: 150 }).serviceProviderFee, 0);
eq('multiple bonuses accumulate', computePayrollLine({ ...base, hourlyRate: 10, bonusPercents: [10, 5] }).bonusAmount, 150);

console.log(failures === 0 ? '\nAll payroll engine checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
