// Backend mirror of src/constants/offboardingExitInterview.ts — kept in sync manually since the
// frontend and backend are separate packages.

export const REASON_FOR_LEAVING_VALUES = [
    'FAMILY_CIRCUMSTANCES',
    'BETTER_CAREER_OPPORTUNITY',
    'SUPERVISOR_BEHAVIOUR',
    'LACK_OF_CAREER_DEVELOPMENT',
    'JOB_DISSATISFACTION',
    'NOT_COMPETITIVE_SALARY',
    'OTHERS',
] as const;

export const RATING_VALUES = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'] as const;

export const RATING_FIELD_KEYS = [
    'management', 'companyCulture', 'policies', 'workingConditions',
    'careerDevelopment', 'salary', 'benefits', 'training',
] as const;
