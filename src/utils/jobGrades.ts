import { JOB_GRADES, type JobGrade } from '../types';

// Frontend mirror of server/src/utils/jobGrades.ts's transition rules — kept in sync manually.
export const TOP_GRADE: JobGrade = 'Senior consultant';
export const EVALUATION_INDEX_THRESHOLD = 18;
const TENURE_MONTHS: Partial<Record<JobGrade, number>> = { Trainee: 6, Intern: 3 };

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

export function monthsSince(date: Date | string | null | undefined): number {
    if (!date) return -Infinity;
    const start = new Date(date);
    const now = new Date();
    return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}
