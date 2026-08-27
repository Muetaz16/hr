import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the whole server. Previously every controller/util created its
// own `new PrismaClient()`, which opened a separate connection pool each — wasteful and prone to
// exhausting Postgres connections. Import this `prisma` everywhere instead.
//
// In development (nodemon/ts-node hot-reload) the instance is cached on globalThis so repeated
// reloads reuse the same client instead of leaking a new pool on every restart.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
