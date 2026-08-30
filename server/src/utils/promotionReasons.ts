// "Reason for Promotion" on the real Promotion Report / Notice of Promotion Google Form is a
// fixed-choice field (Performance-Based / Job Grade-Based / Others), not free text — kept in sync
// manually with src/constants/promotionReasons.ts.
export const PROMOTION_REASONS = [
    { value: 'PERFORMANCE_BASED', en: 'Performance-Based', ar: 'استنادًا على الأداء' },
    { value: 'JOB_GRADE_BASED', en: 'Job Grade-Based', ar: 'استنادًا إلى الدرجة الوظيفية' },
    { value: 'OTHERS', en: 'Others', ar: 'اخرى' },
] as const;

export type PromotionReason = typeof PROMOTION_REASONS[number]['value'];
export const PROMOTION_REASON_VALUES = PROMOTION_REASONS.map(r => r.value);

// Printed single-language (English) — matches every other value on this form (Division, Department,
// Job Title, dates, etc.), none of which are bilingual either.
export function promotionReasonPrintLabel(value: string | null | undefined): string | undefined {
    const found = PROMOTION_REASONS.find(r => r.value === value);
    return found?.en;
}
