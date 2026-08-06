import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const factorMap = {
    // Offices & Departments
    "General Management Office": 1.25,
    "Legal Affairs Office": 1.55,
    "Investment Office": 1.60,
    "Public Relations Office": 1.45,
    "Internal Audit Office": 1.45,
    "Quality Office": 1.45,
    "Policies & SOP Standards Department": 1.40,
    "Process Analysis & Optimization Department": 1.40,
    "Digital Transformation Department": 1.40,
    "Enterprise Planning Department": 1.40,
    "Accounting & Recordkeeping Department": 1.40,
    "Accounting & Bookkeeping Department": 1.40,
    "Treasury & Cash Management Department": 1.40,
    "Asset Control Department": 1.40,
    "Preparation & Review Department": 1.40,
    "Financial Reporting & Analysis Department": 1.40,
    "Financial Reporting & Ananlysis Department": 1.40,
    "Document Control Department": 1.30,
    "Facility & Logistics Services Department": 1.25,
    "Facility & Logistic Services Department": 1.25,
    "Asset Management Department": 1.40,
    "IT Support Services Department": 1.30,
    "Procurement and Warehousing Department": 1.40,
    "Recruitment Department": 1.40,
    "Recrutiment Department": 1.40,
    "Personnel Relations Department": 1.30,
    "Payroll & Compensations Department": 1.30,
    "HR Corporate Compliance Department": 1.40,
    "Network & Cybersecurity Department": 1.40,
    "Corporate Compliance Department": 1.40,
    "Business Projects Compliance Department": 1.40,
    "Business Projects Complience Department": 1.40,
    "Special reviews & Investigations Department": 1.40,
    "Special Reviews & Investigations Department": 1.40,
    
    // Divisions
    "Enterprise Development Division": 1.50,
    "Financial Affairs Division": 1.50,
    "Administrative Affairs Division": 1.50,
    "Human Resources Division": 1.50,
    "Operations Support Division": 1.50,
    "Compliance & Monitoring Division": 1.50,
    
    // Directorates / Governance (assuming these map to Directorate names)
    "Governance & Executive Function": 1.60 // Used for Admin Director and CEO
};

async function main() {
    console.log("Starting Position Factor Update...");
    
    // Update Departments
    const depts = await prisma.department.findMany();
    for (const dept of depts) {
        if (factorMap[dept.name as keyof typeof factorMap]) {
            await prisma.department.update({
                where: { id: dept.id },
                data: { positionFactor: factorMap[dept.name as keyof typeof factorMap] }
            });
            console.log(`✅ Updated Department: ${dept.name} -> ${factorMap[dept.name as keyof typeof factorMap]}`);
        }
    }

    // Update Divisions
    const divs = await prisma.division.findMany();
    for (const div of divs) {
        if (factorMap[div.name as keyof typeof factorMap]) {
            await prisma.division.update({
                where: { id: div.id },
                data: { positionFactor: factorMap[div.name as keyof typeof factorMap] }
            });
            console.log(`✅ Updated Division: ${div.name} -> ${factorMap[div.name as keyof typeof factorMap]}`);
        }
    }

    // Update Directorates
    const dirs = await prisma.directorate.findMany();
    for (const dir of dirs) {
        if (factorMap[dir.name as keyof typeof factorMap]) {
            await prisma.directorate.update({
                where: { id: dir.id },
                data: { positionFactor: factorMap[dir.name as keyof typeof factorMap] }
            });
            console.log(`✅ Updated Directorate: ${dir.name} -> ${factorMap[dir.name as keyof typeof factorMap]}`);
        }
    }

    console.log("Update Complete!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
