// Loan or salary advance — which of the two is this?
//
// They are two different procedures, and the system has always run them differently. What was
// missing was the name: everything was called an "advance", including the multi-month repayment
// that is plainly a loan.
//
//   RESDANT / DIRCT NONE RESDANT      LOAN     a multiple of basic pay, repaid over several months
//   NONE RESDANT (service provider)   ADVANCE  a typed amount, the provider's written consent,
//                                              recovered in full from one salary month
//
// DERIVED from the contract type, never picked from a dropdown. That is the whole point: a label
// chosen by hand can contradict the procedure that was actually followed, and then the record says
// "loan" while the money was taken back in one month like an advance. There is one rule and it
// lives here, so the request screen, the payroll screen and the provider round cannot disagree.
//
// Anything that is not a service-provider employee follows the loan procedure — including the
// contract types still waiting to be cleaned up (Exception, Limited, Higher-Management, null). So
// the fallback is LOAN, which matches what advanceRequestController already does when it decides
// which request form to show.

/** The one contract type routed through a service provider. */
export const PROVIDER_RESIDENCY = 'NONE RESDANT';

export type AdvanceKind = 'LOAN' | 'SALARY_ADVANCE';

export const isProviderResidency = (residencyType?: string | null): boolean =>
    residencyType === PROVIDER_RESIDENCY;

/** The kind this employee's request is, from their contract type alone. */
export const advanceKindFor = (residencyType?: string | null): AdvanceKind =>
    isProviderResidency(residencyType) ? 'SALARY_ADVANCE' : 'LOAN';

/** For anything the server itself writes out — audit lines, documents, report columns. */
export const ADVANCE_KIND_LABELS: Record<AdvanceKind, { en: string; ar: string }> = {
    LOAN: { en: 'Loan', ar: 'قرض' },
    SALARY_ADVANCE: { en: 'Salary advance', ar: 'سلفة' },
};

export const advanceKindLabel = (kind: string, lang: 'en' | 'ar' = 'en'): string =>
    ADVANCE_KIND_LABELS[kind as AdvanceKind]?.[lang] ?? kind;
