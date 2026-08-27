// Static reference catalog of the company's official Code of Conduct violations and their
// progressive-offense penalty ladders (IPH Code of Conduct, Annex I, effective 2026-01-01).
//
// Modeled as a plain exported array — not a DB table — matching the exact pattern already used
// for PERMISSIONS/POSITIONS/SYSTEM_HATS in accessCatalog.ts: this is a fixed, versioned policy
// document, changed only via a new company policy release, referenced by string id (FK-by-
// convention, not a real DB foreign key).
//
// Ladders are NOT uniform even within a category (e.g. most Serious-category rows end in
// TERMINATION on the 4th offense, but "Negligent use of company tools" ends in a 4th
// SUSPENSION_10_DAYS instead; several Major rows are TERMINATION-only on the 1st offense) — so
// each row carries its own ladder rather than deriving it from `category` at read time.

export type DisciplinaryActionType =
    | 'VERBAL_WARNING'
    | 'WRITTEN_WARNING'
    | 'SUSPENSION_3_DAYS'
    | 'SUSPENSION_5_DAYS'
    | 'SUSPENSION_7_DAYS'
    | 'SUSPENSION_10_DAYS'
    | 'TERMINATION';

export const DISCIPLINARY_ACTION_LABELS: Record<DisciplinaryActionType, string> = {
    VERBAL_WARNING: 'Verbal Warning',
    WRITTEN_WARNING: 'Written Warning',
    SUSPENSION_3_DAYS: 'Suspension without pay (3 days)',
    SUSPENSION_5_DAYS: 'Suspension without pay (5 days)',
    SUSPENSION_7_DAYS: 'Suspension without pay (7 days)',
    SUSPENSION_10_DAYS: 'Suspension without pay (10 days)',
    TERMINATION: 'Termination',
};

// Day count for each Suspension-type action — used to compute the BioTime suspension's date range
// (effective date -> effective date + days - 1) when a Disciplinary Action closes. Omits the
// non-suspension types entirely rather than defaulting to 0.
export const SUSPENSION_DAYS: Partial<Record<DisciplinaryActionType, number>> = {
    SUSPENSION_3_DAYS: 3,
    SUSPENSION_5_DAYS: 5,
    SUSPENSION_7_DAYS: 7,
    SUSPENSION_10_DAYS: 10,
};

export type DisciplinaryCategory = 'MINOR' | 'SERIOUS' | 'MAJOR';

export const DISCIPLINARY_CATEGORY_LABELS: Record<DisciplinaryCategory, string> = {
    MINOR: 'Minor Violation',
    SERIOUS: 'Serious Violation',
    MAJOR: 'Major Violation',
};

export interface DisciplinaryViolation {
    id: string;
    description: string;
    category: DisciplinaryCategory;
    /** index 0 = 1st offense. Once an employee's offense count exceeds this array's length, the
     * penalty stays clamped at the last tier — it does not auto-escalate. */
    ladder: DisciplinaryActionType[];
}

const MINOR_LADDER: DisciplinaryActionType[] = ['VERBAL_WARNING', 'WRITTEN_WARNING', 'SUSPENSION_3_DAYS', 'SUSPENSION_5_DAYS'];
const SERIOUS_LADDER: DisciplinaryActionType[] = ['WRITTEN_WARNING', 'SUSPENSION_5_DAYS', 'SUSPENSION_7_DAYS', 'TERMINATION'];
const SERIOUS_LADDER_10DAY: DisciplinaryActionType[] = ['WRITTEN_WARNING', 'SUSPENSION_5_DAYS', 'SUSPENSION_7_DAYS', 'SUSPENSION_10_DAYS'];
const MAJOR_LADDER_7DAY: DisciplinaryActionType[] = ['SUSPENSION_7_DAYS', 'TERMINATION'];
const MAJOR_LADDER_10DAY: DisciplinaryActionType[] = ['SUSPENSION_10_DAYS', 'TERMINATION'];
const MAJOR_TERMINATION_ONLY: DisciplinaryActionType[] = ['TERMINATION'];

export const DISCIPLINARY_VIOLATIONS: DisciplinaryViolation[] = [
    // --- Category I: Minor Offenses (uniform ladder) ---
    { id: 'MIN-01', category: 'MINOR', ladder: MINOR_LADDER, description: 'Engaging in workplace gossip, rumors, or inciting conflict' },
    { id: 'MIN-02', category: 'MINOR', ladder: MINOR_LADDER, description: 'Incurrence of tardiness for five times within a month' },
    { id: 'MIN-03', category: 'MINOR', ladder: MINOR_LADDER, description: 'Refusal of an employee to appear and/or testify when summoned to appear as a witness in an investigation.' },
    { id: 'MIN-04', category: 'MINOR', ladder: MINOR_LADDER, description: 'Loitering, wandering around, spending time away from the job, or leaving the workplace and/or assignment during working hours without a valid reason and permission.' },
    { id: 'MIN-05', category: 'MINOR', ladder: MINOR_LADDER, description: 'Violation of any established administrative, safety, and housekeeping procedures or instructions.' },
    { id: 'MIN-06', category: 'MINOR', ladder: MINOR_LADDER, description: 'Improper use of company facilities, equipment, and materials.' },
    { id: 'MIN-07', category: 'MINOR', ladder: MINOR_LADDER, description: 'Deliberately concealing work-related tasks from colleagues' },
    { id: 'MIN-08', category: 'MINOR', ladder: MINOR_LADDER, description: 'Refusal or willful disobedience to carry out tasks' },
    { id: 'MIN-09', category: 'MINOR', ladder: MINOR_LADDER, description: 'Creating or contributing to unsanitary conditions' },
    { id: 'MIN-10', category: 'MINOR', ladder: MINOR_LADDER, description: 'Refusal or willful disobedience to attend mandatory safety training sessions and drills, as well as HSE audit and inspections.' },
    { id: 'MIN-11', category: 'MINOR', ladder: MINOR_LADDER, description: 'Refusal to undergo or take part in any form of health-related testing initiated by the Company.' },
    { id: 'MIN-12', category: 'MINOR', ladder: MINOR_LADDER, description: 'Failure to comply with uniform and grooming standards' },
    { id: 'MIN-13', category: 'MINOR', ladder: MINOR_LADDER, description: 'Minor discourtesy or inattentiveness' },
    { id: 'MIN-14', category: 'MINOR', ladder: MINOR_LADDER, description: 'Late processing of bookings and quotations' },

    // --- Category II: Serious Offenses ---
    { id: 'SER-01', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Verbal abuse, shouting, or threats toward a colleague' },
    { id: 'SER-02', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Public humiliation or mocking of another employee' },
    { id: 'SER-03', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Disruptive or inappropriate behavior in shared accommodation or company transportation' },
    { id: 'SER-04', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Deliberate refusal to submit required reports or documentation' },
    { id: 'SER-05', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Making false accusations or filing false reports' },
    { id: 'SER-06', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Failure to disclose a known conflict of interest' },
    { id: 'SER-07', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Deliberate non-compliance with Company policies or ethical obligations' },
    { id: 'SER-08', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Leaving the workplace without authorization' },
    { id: 'SER-09', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Unauthorized absence for one full working day' },
    { id: 'SER-10', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Negligence of Duty' },
    { id: 'SER-11', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Laziness, inattention, or sleeping during work hours' },
    { id: 'SER-12', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Entering the construction site without proper PPE' },
    { id: 'SER-13', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Smoking in the prohibited or hazardous areas' },
    { id: 'SER-14', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Failure to promptly report an incident or injury immediately' },
    { id: 'SER-15', category: 'SERIOUS', ladder: SERIOUS_LADDER_10DAY, description: 'Negligent use of company tools or equipment' },
    { id: 'SER-16', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Loss of company property due to negligence' },
    { id: 'SER-17', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Using company property for personal or commercial use' },
    { id: 'SER-18', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Taking work-related materials out of the company without permission' },
    { id: 'SER-19', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Entering unauthorized warehouses or restricted areas' },
    { id: 'SER-20', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Using company vehicles for personal purposes without prior permission' },
    { id: 'SER-21', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Failure to properly close or secure a storage facility' },
    { id: 'SER-22', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Refusal to follow a legitimate order from a supervisor' },
    { id: 'SER-23', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Unauthorized access to internal systems, digital platforms, and business accounts' },
    { id: 'SER-24', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Use of company email or systems for offensive, political, or unrelated content' },
    { id: 'SER-25', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Misuse of social media in a manner that harms the Company’s image or discloses internal content' },
    { id: 'SER-26', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Creating or spreading inappropriate jokes, bullying, and using profane language' },
    { id: 'SER-27', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Disrespectful public opposition to managerial authority' },
    { id: 'SER-28', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Use of disrespectful language or tone in emails or official messages' },
    { id: 'SER-29', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Non-compliance with the established, documented, and approved internal policies and procedures' },
    { id: 'SER-30', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Rude, discriminatory, or negligent treatment of guests' },
    { id: 'SER-31', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Unauthorized access to the guest’s personal information' },
    { id: 'SER-32', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Violation of food hygiene and sanitation standards' },
    { id: 'SER-33', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Allowing unauthorized access to guest rooms' },
    { id: 'SER-34', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Unauthorized use of farm machinery' },
    { id: 'SER-35', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Late processing of claims or endorsements' },
    { id: 'SER-36', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Negligent handling of bookings causing client loss' },
    { id: 'SER-37', category: 'SERIOUS', ladder: SERIOUS_LADDER, description: 'Improper cancellation, refund, or rebooking approvals' },

    // --- Category III: Major Offenses ---
    { id: 'MAJ-01', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Discriminatory behaviour based on race, gender, religion, or nationality' },
    { id: 'MAJ-02', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Threatening another employee with physical or professional harm' },
    { id: 'MAJ-03', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Deliberately disrupting or stopping work with the intent to obstruct operations.' },
    { id: 'MAJ-04', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Misuse of personal data or records' },
    { id: 'MAJ-05', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Negligence leading to serious harm or damage' },
    { id: 'MAJ-06', category: 'MAJOR', ladder: MAJOR_LADDER_10DAY, description: 'Unauthorized disclosure of confidential disciplinary records' },
    { id: 'MAJ-07', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Absence for more than three consecutive days without notice' },
    { id: 'MAJ-08', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Operating equipment without authorization or training' },
    { id: 'MAJ-09', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Tampering with fire extinguishers or safety equipment' },
    { id: 'MAJ-10', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Unauthorized escorting of persons into restricted company premises' },
    { id: 'MAJ-11', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Reporting for work under the influence of alcohol, drugs, or any form of prohibited substance' },
    { id: 'MAJ-12', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Driving a vehicle without authorization' },
    { id: 'MAJ-13', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Fighting or instigating a fight within the company premises' },
    { id: 'MAJ-14', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Unauthorized carrying of firearms or any deadly weapon within the company premises.' },
    { id: 'MAJ-15', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Clocking in and leaving the workplace without authorization.' },
    { id: 'MAJ-16', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Clocking in and returning only to clock out at the end of the shift.' },
    { id: 'MAJ-17', category: 'MAJOR', ladder: MAJOR_LADDER_7DAY, description: 'Manipulating or attempting to manipulate the fingerprint timekeeping system.' },
    { id: 'MAJ-18', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Hiding a severe, contagious disease that may endanger other employees and customers.' },
    { id: 'MAJ-19', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Sabotage' },
    { id: 'MAJ-20', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Disclosing, leaking out, or revealing confidential or classified information, or providing access to unauthorized information or persons.' },
    { id: 'MAJ-21', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Falsification of actual clock-in and clock-out, overtime, and other related documents.' },
    { id: 'MAJ-22', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Sexual harassment in any form' },
    { id: 'MAJ-23', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Intentional falsification of documents or reports' },
    { id: 'MAJ-24', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Accepting or offering a bribe or kickback' },
    { id: 'MAJ-25', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Providing false information during a disciplinary investigation' },
    { id: 'MAJ-26', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Attempting to conceal or destroy evidence of misconduct' },
    { id: 'MAJ-27', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Intentional damage to company property' },
    { id: 'MAJ-28', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Theft of company property' },
    { id: 'MAJ-29', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Theft of another employee/person’s property or belongings committed on company premises.' },
    { id: 'MAJ-30', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Forgery or unauthorized use of others’ signatures and initials for any purposes.' },
    { id: 'MAJ-31', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Use of one’s position, work, access to internal information, and/or contract with staff, customers, or suppliers to make favorable conditions or for personal gain' },
    { id: 'MAJ-32', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Falsification of information in the employment application.' },
    { id: 'MAJ-33', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Pretending illness to obtain company benefits.' },
    { id: 'MAJ-34', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Major food contamination incidents' },
    { id: 'MAJ-35', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Intentional destruction of hotel property' },
    { id: 'MAJ-36', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Endangering workers through unsafe practices' },
    { id: 'MAJ-37', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Deliberate destruction of farm assets' },
    { id: 'MAJ-38', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Unauthorized access to member medical records' },
    { id: 'MAJ-39', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Negligent handling of claims or approvals' },
    { id: 'MAJ-40', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Breach of confidentiality and data privacy' },
    { id: 'MAJ-41', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Manipulation of fares, tickets, or rebooking charges' },
    { id: 'MAJ-42', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Falsification of booking or payment records' },
    { id: 'MAJ-43', category: 'MAJOR', ladder: MAJOR_TERMINATION_ONLY, description: 'Fraudulent bookings or ghost ticket issuance' },
];

export const VIOLATIONS_BY_ID: Record<string, DisciplinaryViolation> = Object.fromEntries(
    DISCIPLINARY_VIOLATIONS.map((v) => [v.id, v])
);

// The 3 violations objectively provable from attendance data alone (no human investigation
// needed) — detected pull-side by the "Attendance Candidates" screen
// (disciplinaryController.getAttendanceCandidates), never auto-executed.
export const TARDINESS_VIOLATION_ID = 'MIN-02';
export const UNAUTHORIZED_ABSENCE_VIOLATION_ID = 'SER-09';
export const CONSECUTIVE_ABSENCE_VIOLATION_ID = 'MAJ-07';

/** The action type for a given violation + 1-based offense number, clamped at the ladder's last tier. */
export function resolveActionType(violationId: string, offenseNumber: number): DisciplinaryActionType | null {
    const violation = VIOLATIONS_BY_ID[violationId];
    if (!violation) return null;
    const index = Math.min(offenseNumber, violation.ladder.length) - 1;
    return violation.ladder[Math.max(index, 0)];
}
