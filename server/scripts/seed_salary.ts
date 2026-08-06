import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const dataPath = path.join(__dirname, '../../scratch/salary_data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    console.log(`Seeding ${data.length} salary structures...`);

    // Clear existing
    await prisma.salaryStructure.deleteMany();

    for (const item of data) {
        await prisma.salaryStructure.create({
            data: {
                jobCategory: item.category,
                jobGrade: item.grade,
                structureLevel: item.structure,
                hourlyRate: item.hourlyRate,
                monthlyRate: item.monthlyRate
            }
        });
    }
    
    console.log('Seeding complete!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
