const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const emps = await prisma.employee.findMany();
    console.log("Employees count:", emps.length);
    if(emps.length > 0) {
        console.log("Sample emp:", JSON.stringify(emps[0], null, 2));
    }
}
check().catch(console.error).finally(() => prisma.$disconnect());
