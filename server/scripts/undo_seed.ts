import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const divisionsToDelete = [
    'Compliance & Monitoring Division',
    'Financial Affairs Division',
    'Administrative Affairs Division'
];

const departmentsToDelete = [
    'Recruitment Department',
    'Corporate Compliance Department',
    'Business Projects Compliance Department',
    'Special Reviews & Investigations Department',
    'Accounting & Bookkeeping Department',
    'Treasury & Cash Management Department',
    'Asset Control Department',
    'Preparation & Review Department',
    'Financial Reporting & Analysis Department',
    'Document Control Department',
    'Facility & Logistic Services Department',
    'Asset Management Department',
    'IT Support Services Department',
    'Procurement and Warehousing Department'
];

async function main() {
    console.log('Undoing seeded data...');

    for (const name of departmentsToDelete) {
        const result = await prisma.department.deleteMany({
            where: { name }
        });
        if (result.count > 0) {
            console.log(`Deleted Department: ${name}`);
        }
    }

    for (const name of divisionsToDelete) {
        const result = await prisma.division.deleteMany({
            where: { name }
        });
        if (result.count > 0) {
            console.log(`Deleted Division: ${name}`);
        }
    }

    console.log('Undo complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
