import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.employee.updateMany({
        where: {
            role: { in: ['GENERAL_MANAGER', 'CHAIRMAN'] }
        },
        data: {
            positionFactor: 1.70
        }
    });

    console.log(`✅ Updated ${result.count} employee(s) to positionFactor = 1.70`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
