// Backend mirror of src/types/index.ts's JOB_GRADES — kept in sync manually since the frontend and
// backend are separate packages. Note the last entry is lowercase "consultant", a pre-existing typo
// preserved exactly since real employee records already use this literal string.
export const JOB_GRADES = [
    'Trainee',
    'Intern',
    'Junior',
    'Lead',
    'Senior',
    'Associate Consultant',
    'Lead Consultant',
    'Senior consultant',
] as const;

export type JobGrade = typeof JOB_GRADES[number];

export const TOP_GRADE: JobGrade = 'Senior consultant';

export const EVALUATION_INDEX_THRESHOLD = 18;

// Only the first two rungs promote on tenure — every other transition needs the Evaluation Index.
const TENURE_MONTHS: Partial<Record<JobGrade, number>> = {
    Trainee: 6, // Trainee -> Intern
    Intern: 3,  // Intern -> Junior
};

export type PromotionRule =
    | { type: 'TENURE'; months: number; nextGrade: JobGrade }
    | { type: 'EVALUATION'; threshold: number; nextGrade: JobGrade };

export function getNextGrade(grade: string | null | undefined): JobGrade | null {
    const idx = JOB_GRADES.indexOf(grade as JobGrade);
    if (idx < 0 || idx === JOB_GRADES.length - 1) return null;
    return JOB_GRADES[idx + 1];
}

export function getPromotionRule(grade: string | null | undefined): PromotionRule | null {
    const nextGrade = getNextGrade(grade);
    if (!nextGrade) return null;
    const months = TENURE_MONTHS[grade as JobGrade];
    return months !== undefined
        ? { type: 'TENURE', months, nextGrade }
        : { type: 'EVALUATION', threshold: EVALUATION_INDEX_THRESHOLD, nextGrade };
}

// Calendar-month diff (ignores day-of-month) — same precision as the tenure check this replaces.
export function monthsSince(date: Date | string | null | undefined): number {
    if (!date) return -Infinity;
    const start = new Date(date);
    const now = new Date();
    return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}
