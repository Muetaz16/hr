// The payroll calculation. This is the ONLY place the formula lives.
//
// Pure: no Prisma, no fetch, no clock. Everything is a function of its arguments, so the whole
// formula is table-testable and cannot silently drift from what the payslip prints.
//
// The output mirrors `public/PAYSLIP.docx` line for line. Note the template has NO "Full Salary"
// row: it itemises each factor's contribution as its own allowance. That is arithmetically the
// same thing —
//     Basic + Basic*(pos-1) + Basic*(site-1) + Basic*(lang-1) + Basic*(skill-1)  ==  Basic * F
// — but the engine has to emit the pieces, because the pieces are what gets printed.
//
// Two rules that are easy to get wrong and expensive to get wrong:
//   1. Position and Skill are MUTUALLY EXCLUSIVE. employeeController enforces this on write
//      (skillFactor is forced back to 1.0 whenever both exceed 1.0), so in practice one of those
//      two allowance lines is always zero. `composeFactor` takes max() rather than summing both,
//      matching the existing preview at src/pages/admin/EmployeeForm.tsx.
//   2. Round each component, THEN total the rounded components. Round-then-sum is not the same as
//      sum-then-round, and the payslip has to add up as printed.

/** 2-decimal round. The EPSILON term matters: plain Math.round(1.005*100)/100 gives 1 in binary FP. */
export const round2 = (n: number): number => {
    if (!isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON * Math.sign(n || 1)) * 100) / 100;
};

/** Minutes → hours, rounded to 2dp (the payslip prints hours to 2dp). */
export const minsToHours = (mins: number): number => round2((Number(mins) || 0) / 60);

const factorOrOne = (f: number | null | undefined): number => {
    const n = Number(f);
    return isFinite(n) && n > 0 ? n : 1;
};

/**
 * F = 1 + (max(position, skill) - 1) + (site - 1) + (language - 1).
 * Sum of increments, not a product: the user's own worked example is 1.3 and 1.2 giving 1.5.
 *
 * Rounded to 4dp because summing binary floats leaves visible noise — 603 of the 2197 combinations
 * of the real factor values produce things like 1.4499999999999997, and F is a stored, displayed
 * number. No money depends on this rounding: each allowance is derived from its own factor and
 * rounded to 2dp separately, so F is only ever used for display and reconciliation.
 */
export const composeFactor = (
    positionFactor: number, skillFactor: number, siteFactor: number, languageFactor: number,
): number => {
    const pos = factorOrOne(positionFactor);
    const skill = factorOrOne(skillFactor);
    const site = factorOrOne(siteFactor);
    const lang = factorOrOne(languageFactor);
    const f = 1 + (Math.max(pos, skill) - 1) + (site - 1) + (lang - 1);
    return Math.round(f * 10000) / 10000;
};

export interface PayrollEngineInput {
    hourlyRate: number;
    /** Regular worked minutes. Already NET of leave — never subtract unpaid leave from it. */
    workMins: number;
    /** Approved overtime minutes only (`totalApprovedOTMins`), paid at the plain hourly rate. */
    approvedOtMins: number;
    /** Paid-leave minutes (annual + emergency combined). Paid at the rate WITHOUT the factors. */
    paidLeaveMins: number;

    positionFactor: number;
    siteFactor: number;
    skillFactor: number;
    languageFactor: number;

    /** Completed reward-case percentages for this period, e.g. [10, 5]. Applied to BASIC. */
    bonusPercents?: number[];
    /** Extra earning amounts already resolved to currency (e.g. a previous-underpayment fix). */
    extraEarnings?: number[];
    /** Deduction amounts already resolved to currency. Excludes the informational advance balance. */
    deductions?: number[];

    /** Provider cut as a whole number (15 means 15%), or null for a directly-hired employee. */
    serviceProviderPercentage?: number | null;
}

export interface PayrollEngineOutput {
    basicHours: number;
    overtimeHours: number;
    totalWorkingHours: number;
    paidAbsenceHours: number;

    basicSalary: number;

    /** One per factor, exactly as the payslip's Earnings box prints them. */
    positionAllowance: number;
    siteAllowance: number;
    languageAllowance: number;
    skillAllowance: number;

    paidAbsenceAmount: number;
    bonusPercent: number;
    bonusAmount: number;
    extraEarningsTotal: number;
    totalEarnings: number;

    deductionsTotal: number;
    netSalary: number;

    /** Company-side cost. Never appears on the payslip. */
    serviceProviderFee: number;
    employerTotalCost: number;

    /** Derived, for display and reconciliation only — equals Basic x F. */
    factorF: number;
    fullSalary: number;
}

const sum = (xs?: number[]): number =>
    (xs || []).reduce((a, b) => a + (isFinite(Number(b)) ? Number(b) : 0), 0);

export const computePayrollLine = (input: PayrollEngineInput): PayrollEngineOutput => {
    const rate = isFinite(Number(input.hourlyRate)) ? Number(input.hourlyRate) : 0;

    const basicHours = minsToHours(input.workMins);
    const overtimeHours = minsToHours(input.approvedOtMins);
    const totalWorkingHours = round2(basicHours + overtimeHours);
    const paidAbsenceHours = minsToHours(input.paidLeaveMins);

    // Overtime is paid at the plain hourly rate and folded into Basic, per the SOP: "Since overtime
    // hours are compensated at the employee's regular hourly rate, they are directly included."
    const basicSalary = round2(totalWorkingHours * rate);

    const pos = factorOrOne(input.positionFactor);
    const skill = factorOrOne(input.skillFactor);
    const site = factorOrOne(input.siteFactor);
    const lang = factorOrOne(input.languageFactor);

    // The exclusivity rule surfaces here: whichever of position/skill is lower contributes nothing,
    // so exactly one of these two lines is non-zero (or both are zero at the 1.0 default).
    const winner = Math.max(pos, skill);
    const positionAllowance = round2(basicSalary * ((pos >= skill ? winner : 1) - 1));
    const skillAllowance = round2(basicSalary * ((skill > pos ? winner : 1) - 1));
    const siteAllowance = round2(basicSalary * (site - 1));
    const languageAllowance = round2(basicSalary * (lang - 1));

    // Paid leave is paid at the bare hourly rate — the factors are deliberately NOT applied.
    const paidAbsenceAmount = round2(paidAbsenceHours * rate);

    // Bonuses are a percentage of BASIC (the pre-factor figure), added at the Net level.
    const bonusPercent = round2(sum(input.bonusPercents));
    const bonusAmount = round2(basicSalary * bonusPercent / 100);

    const extraEarningsTotal = round2(sum(input.extraEarnings));

    const totalEarnings = round2(
        basicSalary + positionAllowance + siteAllowance + languageAllowance + skillAllowance
        + paidAbsenceAmount + bonusAmount + extraEarningsTotal,
    );

    const deductionsTotal = round2(sum(input.deductions));
    const netSalary = round2(totalEarnings - deductionsTotal);

    // The provider's cut is charged to IPH ON TOP of what the employee receives, computed on NET.
    // The percentage is a whole number: 15 means 15%.
    const pct = Number(input.serviceProviderPercentage);
    const validPct = isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 0;
    const serviceProviderFee = round2(netSalary * validPct / 100);

    const factorF = composeFactor(pos, skill, site, lang);

    return {
        basicHours, overtimeHours, totalWorkingHours, paidAbsenceHours,
        basicSalary,
        positionAllowance, siteAllowance, languageAllowance, skillAllowance,
        paidAbsenceAmount, bonusPercent, bonusAmount, extraEarningsTotal, totalEarnings,
        deductionsTotal, netSalary,
        serviceProviderFee,
        employerTotalCost: round2(netSalary + serviceProviderFee),
        factorF,
        fullSalary: round2(basicSalary * factorF),
    };
};
