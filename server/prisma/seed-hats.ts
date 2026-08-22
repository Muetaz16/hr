import { PrismaClient } from '@prisma/client';
import { SYSTEM_HATS } from '../src/utils/accessCatalog';

const prisma = new PrismaClient();

// Idempotently upsert the seeded system functional hats (matched by `key`).
// Re-running keeps their name/description/permissions in sync with the catalog
// without touching any custom hats the admin created.
async function main() {
    for (const hat of SYSTEM_HATS) {
        await prisma.functionalHat.upsert({
            where: { key: hat.key },
            update: { name: hat.name, description: hat.description, permissions: hat.permissions, isSystem: true },
            create: { key: hat.key, name: hat.name, description: hat.description, permissions: hat.permissions, isSystem: true },
        });
        console.log(`Seeded hat: ${hat.name} (${hat.permissions.length} perms)`);
    }
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
