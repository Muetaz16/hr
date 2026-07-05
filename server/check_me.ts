import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: { contains: 'motaz', mode: 'insensitive' } },
        include: { employee: true }
    });
    console.log('--- USER DATA ---');
    console.log('USER_ID: ' + user?.id);
    console.log('USER_EMAIL: ' + user?.email);
    console.log('HAS_EMPLOYEE_RECORD: ' + (user?.employee ? 'YES' : 'NO'));
}

main();
