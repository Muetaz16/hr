import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const data = JSON.parse(fs.readFileSync('../scratch/salary_data.json', 'utf8'));

    console.log(`Updating ${data.length} salary structures...`);
    
    let updatedCount = 0;
    
    for (const item of data) {
        // UPSERT the salary structure based on unique constraint
        await prisma.salaryStructure.upsert({
            where: {
                jobCategory_jobGrade_structureLevel: {
                    jobCategory: item.category,
                    jobGrade: item.grade,
                    structureLevel: item.structure
                }
            },
            update: {
                hourlyRate: item.hourlyRate,
                monthlyRate: item.monthlyRate
            },
            create: {
                jobCategory: item.category,
                jobGrade: item.grade,
                structureLevel: item.structure,
                hourlyRate: item.hourlyRate,
                monthlyRate: item.monthlyRate
            }
        });
        updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} entries!`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
