const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const emps = await prisma.employee.findMany();
    console.log(`Found ${emps.length} employees`);
    console.log(emps);
}

main().catch(console.error).finally(() => prisma.$disconnect());
