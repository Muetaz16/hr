// One-off fix for HEAD_DIVISION (and any other) Employee rows that have a divisionId
// but no directorateId — these never went through the department->division->directorate
// derivation in createEmployee/updateEmployee, since Division Heads have no department at
// all. See C:\Users\khalil.amhimmid\.claude\plans\abstract-wandering-gadget.md.
//
// Usage:
//   npx ts-node scripts/backfill_division_directorate_ids.ts            (dry run, default)
//   npx ts-node scripts/backfill_division_directorate_ids.ts --commit   (actually writes)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

async function main() {
    console.log(COMMIT ? '*** COMMIT MODE — will write to the database ***' : 'Dry run (default) — no writes will be made. Pass --commit to apply.');

    const affected = await prisma.employee.findMany({
        where: { divisionId: { not: null }, directorateId: null },
        select: { id: true, fullName: true, staffId: true, role: true, divisionId: true },
    });

    if (affected.length === 0) {
        console.log('No affected employees found — nothing to do.');
        return;
    }

    console.log(`Found ${affected.length} employee(s) with divisionId set but directorateId missing:`);
    for (const emp of affected) {
        console.log(`  - ${emp.fullName} (${emp.staffId || emp.id}, role ${emp.role})`);
    }

    const divisionIds = [...new Set(affected.map(e => e.divisionId as string))];
    const divisions = await prisma.division.findMany({ where: { id: { in: divisionIds } } });
    const directorateByDivision = new Map(divisions.map(d => [d.id, d.directorateId]));

    let fixed = 0, noDirectorate = 0;
    for (const emp of affected) {
        const directorateId = directorateByDivision.get(emp.divisionId as string);
        if (!directorateId) {
            console.log(`  ! ${emp.fullName}: division ${emp.divisionId} itself has no directorateId — skipping (org-structure gap, not fixable by this script).`);
            noDirectorate++;
            continue;
        }
        console.log(`  -> ${emp.fullName}: directorateId = ${directorateId}`);
        if (COMMIT) {
            await prisma.employee.update({ where: { id: emp.id }, data: { directorateId } });
        }
        fixed++;
    }

    console.log(`\n${COMMIT ? 'Updated' : 'Would update'} ${fixed} employee(s). ${noDirectorate} skipped (division itself has no directorate).`);
    if (!COMMIT) console.log('Re-run with --commit to apply.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
