import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const directorateName = 'Chief Executive Officer';
const divisionName = 'Compliance & Monitoring Division';
const departmentsToAdd = [
    'Corporate Compliance Department',
    'Business Projects Complience Department',
    'Special Reviews & Investigations Department'
];

async function main() {
    console.log('Seeding specific organization parts...');

    // 1. Find the existing directorate
    const directorate = await prisma.directorate.findFirst({
        where: { name: directorateName }
    });

    if (!directorate) {
        console.error(`Error: The directorate '${directorateName}' was not found. Please ensure it exists first.`);
        return;
    }

    console.log(`Found Directorate: ${directorate.name}`);

    // 2. Create the division under the directorate (or find if it already exists)
    let division = await prisma.division.findFirst({
        where: { name: divisionName }
    });

    if (!division) {
        division = await prisma.division.create({
            data: {
                name: divisionName,
                directorateId: directorate.id
            }
        });
        console.log(`Created Division: ${division.name}`);
    } else {
        console.log(`Division already exists: ${division.name}`);
    }

    // 3. Create the departments under the division
    for (const deptName of departmentsToAdd) {
        let existingDept = await prisma.department.findFirst({
            where: { name: deptName }
        });

        if (!existingDept) {
            existingDept = await prisma.department.create({
                data: {
                    name: deptName,
                    isOffice: false,
                    divisionId: division.id
                }
            });
            console.log(`Created Department: ${deptName}`);
        } else {
            console.log(`Department already exists: ${deptName}`);
        }
    }

    console.log('Done!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
