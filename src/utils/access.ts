import type { User } from '../types';

/**
 * Central access check for nav items and protected routes.
 *
 * Mirrors the backend's `authorizeAccess` (server/src/middleware/auth.ts) EXACTLY — a pure OR:
 *  - SUPER_ADMIN can always access everything.
 *  - Otherwise, access is granted if the user's role is in `allowedRoles` OR they hold any
 *    permission in `allowedPermissions` (checked against their effective, hat-inclusive set,
 *    already merged into `user.permissions` server-side). Neither list overrides or suppresses
 *    the other — role alone is always sufficient, same as the API routes this gate predicts.
 *  - No restrictions on either list — any authenticated user may access.
 *
 * This used to diverge from the backend (permissions were "authoritative" once non-empty,
 * silently overriding an otherwise-valid role match) — that let a user's role be explicitly
 * allowed on a screen while the frontend still hid it/redirected to /unauthorized, purely because
 * their specific hat/grant set didn't happen to include that screen's permission list, even though
 * the equivalent backend route would have let their API calls through on role alone.
 */
export function canAccess(
    user: Pick<User, 'role' | 'permissions'> | null | undefined,
    allowedRoles?: readonly string[],
    allowedPermissions?: readonly string[]
): boolean {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    const hasRole = !!(allowedRoles && allowedRoles.length && user.role && allowedRoles.includes(user.role));
    const perms = user.permissions || [];
    const hasPermission = !!(allowedPermissions && allowedPermissions.length && allowedPermissions.some(p => perms.includes(p)));

    if ((allowedRoles && allowedRoles.length) || (allowedPermissions && allowedPermissions.length)) {
        return hasRole || hasPermission;
    }

    // No restrictions — any authenticated user may access.
    return true;
}

/**
 * The access catalog (server/src/utils/accessCatalog.ts) stores permission group names and labels
 * as English strings, since it is also the server's own source of truth. The admin screens that
 * render them (Individual Grants in UserForm.tsx, and the Functional Hats editor) resolve them
 * through locale keys so the Arabic UI isn't left showing raw English:
 *
 *   group "Operations & Approvals" -> t('perm_group_operations_approvals', { defaultValue: group })
 *   permission id "manage_payroll" -> t('perm_manage_payroll',            { defaultValue: label })
 *
 * Any key that is missing simply falls through to the catalog's own English string, so adding a
 * permission to the catalog never breaks the UI — it just shows in English until translated.
 */
export const permGroupKey = (group: string): string =>
    `perm_group_${group.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

export const permLabelKey = (permissionId: string): string => `perm_${permissionId}`;
