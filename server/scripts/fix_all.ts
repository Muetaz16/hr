import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const raw = fs.readFileSync(path.join(__dirname, '../../scratch/pdf_output.txt'), 'utf8');
    const lines = raw.split('\n');
    
    const results: any[] = [];
    const structures = ['SS-01-LYD', 'SS-02-USD', 'SS-03-USD', 'SS-04-EUR', 'SS-05-EUR'];
    const categories = ['Engineer', 'Financial Officer', 'Operation Officer', 'Administrative Officer', 'Supervisor', 'Technician', 'Support Officer'];
    
    lines.forEach((line, i) => {
        line = line.trim();
        
        // Is the line a number-only line? (happens for multi-line titles)
        let namePart = '';
        let numbersPart = '';
        
        let singleLineMatch = line.match(/^([a-zA-Z\s]+?)\s*(\d{1,2},\d\d+.*)$/);
        if (singleLineMatch) {
            namePart = singleLineMatch[1].trim();
            numbersPart = singleLineMatch[2].trim();
        } else if (line.match(/^(\d{1,2},\d\d+.*)$/) && i > 0) {
            namePart = lines[i - 1].trim();
            numbersPart = line.trim();
        }
        
        if (namePart && numbersPart) {
            let category = '';
            let grade = '';
            
            for (const cat of categories) {
                if (namePart.endsWith(cat)) {
                    category = cat;
                    grade = namePart.substring(0, namePart.length - cat.length).trim();
                    break;
                }
            }
            
            if (category) {
                let s = numbersPart;
                let rowResults: any[] = [];
                let failed = false;
                
                for (let idx = 0; idx < 5; idx++) {
                    let match = s.match(/^(\d{1,2},\d)/);
                    if (!match) {
                        failed = true;
                        break;
                    }
                    
                    let hourlyStr = match[1];
                    let hourly = parseFloat(hourlyStr.replace(',', '.'));
                    let monthly = Math.round(hourly * 208);
                    
                    let expectedPrefix = hourlyStr + monthly;
                    if (s.startsWith(expectedPrefix)) {
                        rowResults.push({
                            category,
                            grade,
                            structure: structures[idx],
                            hourlyRate: hourly,
                            monthlyRate: monthly
                        });
                        s = s.substring(expectedPrefix.length);
                    } else {
                        failed = true;
                        break;
                    }
                }
                
                if (!failed && rowResults.length === 5) {
                    results.push(...rowResults);
                } else {
                    console.log(`Failed to parse line for ${grade} ${category}. Remaining string: ${s}. Original numbers: ${numbersPart}`);
                }
            } else {
                console.log(`Category not found for: ${namePart}`);
            }
        }
    });

    console.log(`Parsed ${results.length} perfectly matching entries from PDF output.`);
    
    // Wipe all existing salary structures to clear any corrupted data
    console.log("Wiping corrupted salary data...");
    await prisma.salaryStructure.deleteMany({});
    
    // Insert fresh data
    console.log("Inserting pristine salary data...");
    let inserted = 0;
    for (const item of results) {
        await prisma.salaryStructure.create({
            data: {
                jobCategory: item.category,
                jobGrade: item.grade,
                structureLevel: item.structure,
                hourlyRate: item.hourlyRate,
                monthlyRate: item.monthlyRate
            }
        });
        inserted++;
    }
    console.log(`Successfully seeded ${inserted} valid salary structures!`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
