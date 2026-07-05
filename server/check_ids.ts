import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const task = await prisma.staffTask.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { title: true, assigneeId: true }
    });
    
    const user = await prisma.user.findFirst({
        where: { fullName: { contains: 'muetaz', mode: 'insensitive' } },
        select: { id: true, fullName: true }
    });

    console.log('--- DIAGNOSTIC RESULT ---');
    console.log('LAST_TASK_TITLE: ' + task?.title);
    console.log('LAST_TASK_ASSIGNEE_ID: ' + task?.assigneeId);
    console.log('USER_MUETAZ_ID: ' + user?.id);
    console.log('MATCH: ' + (task?.assigneeId === user?.id ? 'YES' : 'NO'));
}

main();
