import type { User } from '../types';

/**
 * Central access check for nav items and protected routes.
 *
 * Rules:
 *  - SUPER_ADMIN can always access everything.
 *  - When a resource lists `allowedPermissions` AND the user has an explicit
 *    permission set, permissions are AUTHORITATIVE: the user must hold one of the
 *    listed permissions. This means unchecking a permission on a user genuinely
 *    hides the module for them, even if their role would otherwise grant it.
 *  - Legacy users with NO permissions stored fall back to role-based access so
 *    they are never unexpectedly locked out until their account is re-saved.
 *  - Resources with only `allowedRoles` (no permission list) are gated by role.
 */
export function canAccess(
    user: Pick<User, 'role' | 'permissions'> | null | undefined,
    allowedRoles?: readonly string[],
    allowedPermissions?: readonly string[]
): boolean {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    const perms = user.permissions || [];
    const hasExplicitPerms = perms.length > 0;

    const roleOk = !!(allowedRoles && user.role && allowedRoles.includes(user.role));
    const permOk = !!(allowedPermissions && allowedPermissions.some(p => perms.includes(p)));

    // Permission-gated resource: explicit permissions win over role.
    if (allowedPermissions && allowedPermissions.length) {
        return hasExplicitPerms ? permOk : roleOk;
    }

    // Role-only resource.
    if (allowedRoles && allowedRoles.length) return roleOk;

    // No restrictions — any authenticated user may access.
    return true;
}
