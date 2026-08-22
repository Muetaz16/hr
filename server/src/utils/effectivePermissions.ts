import { PrismaClient } from '@prisma/client';
import { computeEffectivePermissions } from './accessCatalog';

/**
 * Resolve a user's effective permission set = position defaults ∪ every held
 * hat's permissions ∪ individual grants. SUPER_ADMIN short-circuits to all.
 * One extra query loads the hats (skipped when the user holds none).
 */
export async function resolveEffectivePermissions(
    prisma: PrismaClient,
    user: { role?: string | null; functionalHatIds?: string[] | null; permissions?: string[] | null },
): Promise<string[]> {
    if (user.role === 'SUPER_ADMIN') return computeEffectivePermissions('SUPER_ADMIN', [], []);

    const hatIds = user.functionalHatIds || [];
    let hatLists: string[][] = [];
    if (hatIds.length) {
        const hats = await prisma.functionalHat.findMany({
            where: { id: { in: hatIds } },
            select: { permissions: true },
        });
        hatLists = hats.map(h => h.permissions || []);
    }
    return computeEffectivePermissions(user.role, hatLists, user.permissions);
}
