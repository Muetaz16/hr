import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const tasks = await prisma.staffTask.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            authorId: true,
            assigneeId: true,
            departmentId: true,
            createdAt: true
        }
    });
    console.log('Recent Tasks:');
    console.log(JSON.stringify(tasks, null, 2));

    const users = await prisma.user.findMany({
        where: { fullName: { contains: 'muetaz', mode: 'insensitive' } },
        select: { id: true, fullName: true, departmentId: true }
    });
    console.log('\nMuetaz Users:');
    console.log(JSON.stringify(users, null, 2));
}

main();
