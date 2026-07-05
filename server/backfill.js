const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    const employees = await prisma.employee.findMany({
        include: {
            department: {
                include: {
                    division: true
                }
            }
        }
    });

    for (const emp of employees) {
        if (emp.department) {
            const updates = {};
            if (emp.department.divisionId && !emp.divisionId) {
                updates.divisionId = emp.department.divisionId;
            }
            if (emp.department.division && emp.department.division.directorateId && !emp.directorateId) {
                updates.directorateId = emp.department.division.directorateId;
            }
            
            if (Object.keys(updates).length > 0) {
                console.log(`Updating employee ${emp.fullName} with ${JSON.stringify(updates)}`);
                await prisma.employee.update({
                    where: { id: emp.id },
                    data: updates
                });
            }
        }
    }
    console.log("Backfill complete");
}

backfill().catch(console.error).finally(() => prisma.$disconnect());
