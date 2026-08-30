// Single source of truth for "this person is no longer an active employee".
//
// Two enrollment statuses mean the employee has left the company but their record is retained:
//   - SEPARATED  → offboarding (resignation/termination)
//   - TRANSFERRED → inter-company transfer (moved to another company outside this system)
//
// Both must be excluded from the active roster, headcount/staffing counts, payroll, evaluations,
// people-pickers and login — and both remain visible only on the historical management pages
// (Employee Directory, Lifecycle Control, Personnel Relations) that pass ?includeSeparated=true.
//
// Keeping the list here means a future "gone" status is added in ONE place instead of being
// grep-hunted across every controller.
// Note: mutable `string[]` (no `as const`) — Prisma's `notIn` filter requires a mutable string[].
export const INACTIVE_ENROLLMENT_STATUSES: string[] = ['SEPARATED', 'TRANSFERRED'];

// Prisma `where` fragment selecting only active employees. Use anywhere a query previously said
// `enrollmentStatus: { not: 'SEPARATED' }`.
export const ACTIVE_ENROLLMENT_FILTER = { notIn: INACTIVE_ENROLLMENT_STATUSES };

// True when the given enrollment status means the employee has left (separated OR transferred).
export const isInactiveEnrollmentStatus = (status?: string | null): boolean =>
    !!status && INACTIVE_ENROLLMENT_STATUSES.includes(status);
