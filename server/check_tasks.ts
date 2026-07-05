import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const tasks = await prisma.staffTask.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            author: { select: { fullName: true, role: true } },
            assignee: { select: { fullName: true, role: true } }
        }
    });
    console.log(JSON.stringify(tasks, null, 2));
}

main();
