import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const structures = await prisma.salaryStructure.findMany();
    console.log(structures.filter(s => s.monthlyRate > 100000));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
