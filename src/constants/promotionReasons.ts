// Field definition for the real Promotion Report / Notice of Promotion Google Form's "Reason for
// Promotion" question — a fixed set of choices, not free text. Kept in sync manually with
// server/src/utils/promotionReasons.ts.
export const PROMOTION_REASON_OPTIONS = [
    { value: 'PERFORMANCE_BASED', label: 'Performance-Based / استنادًا على الأداء' },
    { value: 'JOB_GRADE_BASED', label: 'Job Grade-Based / استنادًا إلى الدرجة الوظيفية' },
    { value: 'OTHERS', label: 'Others / اخرى' },
] as const;

export type PromotionReason = typeof PROMOTION_REASON_OPTIONS[number]['value'];
