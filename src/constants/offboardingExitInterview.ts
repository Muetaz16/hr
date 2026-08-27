// Field definitions for the real Exit Interview / Resignation Request Google Forms, replicated
// in-system. Kept in sync manually with server/src/utils/offboardingExitInterview.ts.

export const REASON_FOR_LEAVING_OPTIONS = [
    { value: 'FAMILY_CIRCUMSTANCES', label: "Family circumstances" },
    { value: 'BETTER_CAREER_OPPORTUNITY', label: 'Better career opportunity' },
    { value: 'SUPERVISOR_BEHAVIOUR', label: "Direct Supervisor's behaviour" },
    { value: 'LACK_OF_CAREER_DEVELOPMENT', label: 'Lack of career development' },
    { value: 'JOB_DISSATISFACTION', label: 'Job dissatisfaction' },
    { value: 'NOT_COMPETITIVE_SALARY', label: 'Not competitive salary' },
    { value: 'OTHERS', label: 'Others' },
] as const;

export type ReasonForLeaving = typeof REASON_FOR_LEAVING_OPTIONS[number]['value'];

export const RATING_OPTIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'] as const;
export type RatingOption = typeof RATING_OPTIONS[number];

export const RATING_CATEGORIES = [
    { key: 'management', label: 'Management / Supervision' },
    { key: 'companyCulture', label: 'Company Culture' },
    { key: 'policies', label: 'Policies and Procedures' },
    { key: 'workingConditions', label: 'Working Conditions' },
    { key: 'careerDevelopment', label: 'Career Development' },
    { key: 'salary', label: 'Salary' },
    { key: 'benefits', label: 'Benefits' },
    { key: 'training', label: 'Training and Development' },
] as const;

export type RatingCategoryKey = typeof RATING_CATEGORIES[number]['key'];
