// One-off import for "BioApp employee list.txt" — the biometric device's own
// roster export. See C:\Users\khalil.amhimmid\.claude\plans\abstract-wandering-gadget.md
// for the full column-mapping derivation and the decisions this script encodes.
//
// Usage:
//   npx ts-node scripts/import_bioapp_employees.ts            (dry run, default — writes nothing)
//   npx ts-node scripts/import_bioapp_employees.ts --commit   (actually writes)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { presetForRole } from '../src/utils/rolePresets';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

const TSV_PATH = path.join(__dirname, 'data', 'bioapp_employees.tsv');

// Column index (0-based) -> Employee field name. Columns not listed are either
// discarded (source id/userId — regenerated) or best-effort tail fields handled
// separately below. See the plan file for how this was derived/verified.
const COLUMN_FIELD: Record<number, string> = {
    1: 'fullName',
    2: 'email',
    3: 'role',
    4: 'departmentId',
    5: 'groupId',
    6: 'baseSalary',
    7: 'joinDate',
    8: 'staffId',
    9: 'contractEndDate',
    10: 'contractStartDate',
    11: 'contractStatus',
    // 12: always blank in every sample row — skipped
    13: 'holidaysUsed',
    14: 'bonusHolidays',
    // 15: source userId — discarded, regenerated
    16: 'unitId',
    17: 'contractType',
    18: 'contractNumber',
    19: 'emergencyHolidaysUsed',
    20: 'fullNameArabic',
    21: 'jobCategory',
    22: 'jobGrade',
    23: 'nationality',
    24: 'passportNumber',
    25: 'unpaidHolidaysUsed',
    26: 'accruedHolidays',
    27: 'bonusEmergencyHolidays',
    28: 'earnedHolidays',
    29: 'remainingHolidays',
    30: 'positionFactor',
    31: 'roleCategory',
    32: 'siteFactor',
    33: 'skillFactor',
    34: 'languageFactor',
    35: 'divisionId',
    36: 'directorateId',
    37: 'evaluationPoints',
    38: 'promotionNotified',
    39: 'salaryStructureType',
    40: 'jobDescriptionId',
    41: 'placeOfWork',
    42: 'dateOfBirth',
    43: 'placeOfBirth',
    44: 'nationalId',
    45: 'academicQualification',
    46: 'gender',
    47: 'bloodType',
    48: 'idCardNumber',
    49: 'idPlaceOfIssue',
    50: 'idIssueDate',
    51: 'passportPlaceOfIssue',
    52: 'passportExpiryDate',
    53: 'drivingLicenseType',
    54: 'drivingLicenseNumber',
    55: 'drivingLicenseExpiry',
    56: 'drivingLicensePlaceOfIssue',
    57: 'personalPhone',
    58: 'personalEmail',
    59: 'emergencyContactNumber',
    60: 'residentialAddress',
    61: 'workedBefore',
    62: 'hasRelativesInCompany',
    63: 'relativesNames',
    64: 'bankName',
    65: 'bankBranchName',
    66: 'bankAccountNumber',
    67: 'arrivalDate',
    // 68-76: cvUrl..healthCertUrl — all blank in every sample row, skipped
    77: 'placeOfBirthArabic',
    78: 'nationalityArabic',
    79: 'academicQualificationArabic',
    80: 'idPlaceOfIssueArabic',
    81: 'passportPlaceOfIssueArabic',
    // 82-92: low-confidence tail (driving license Arabic, bank Arabic, service
    // provider, travel/start dates, ticket/residency/interview URLs) — not
    // reliably positioned; left unmapped rather than risk misassigning PII.
    94: 'bioId',
    95: 'enrollmentStatus',
};

const DATE_FIELDS = new Set([
    'joinDate', 'contractEndDate', 'contractStartDate', 'dateOfBirth', 'idIssueDate',
    'passportExpiryDate', 'drivingLicenseExpiry', 'arrivalDate',
]);
const FLOAT_FIELDS = new Set([
    'baseSalary', 'holidaysUsed', 'bonusHolidays', 'emergencyHolidaysUsed', 'unpaidHolidaysUsed',
    'accruedHolidays', 'bonusEmergencyHolidays', 'earnedHolidays', 'remainingHolidays',
    'positionFactor', 'siteFactor', 'skillFactor', 'languageFactor', 'evaluationPoints',
]);
const INT_FIELDS = new Set(['bioId']);
const BOOL_FIELDS = new Set(['promotionNotified']);
const FK_FIELDS = ['departmentId', 'groupId', 'divisionId', 'directorateId', 'jobDescriptionId', 'unitId'];

function unquote(raw: string): string | null {
    const v = raw.trim();
    if (v === '') return null;
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
    return v;
}

function parseRow(line: string): Record<string, any> {
    const cols = line.split('\t').map(unquote);
    const rec: Record<string, any> = {};
    for (const [idxStr, field] of Object.entries(COLUMN_FIELD)) {
        const idx = Number(idxStr);
        let val: any = cols[idx];
        if (val == null) { rec[field] = null; continue; }
        if (DATE_FIELDS.has(field)) {
            const d = new Date(val.replace(' ', 'T'));
            rec[field] = isNaN(d.getTime()) ? null : d;
        } else if (INT_FIELDS.has(field)) {
            const n = parseInt(val, 10);
            rec[field] = isNaN(n) ? null : n;
        } else if (FLOAT_FIELDS.has(field)) {
            const n = parseFloat(val);
            rec[field] = isNaN(n) ? null : n;
        } else if (BOOL_FIELDS.has(field)) {
            rec[field] = String(val).toLowerCase() === 'true';
        } else {
            rec[field] = val;
        }
    }
    return rec;
}

function generateEmail(fullName: string, taken: Set<string>): string {
    const tokens = fullName.trim().split(/\s+/);
    const first = (tokens[0] || 'x')[0].toLowerCase();
    // Prefer a substantial last token (skip a lone single-letter middle initial).
    let last = tokens[tokens.length - 1];
    if (last && last.replace(/[^a-zA-Z]/g, '').length <= 1 && tokens.length > 2) {
        last = tokens[tokens.length - 2];
    }
    const lastClean = (last || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    let base = `${first}.${lastClean}`;
    let candidate = `${base}@iph.com`;
    let n = 2;
    while (taken.has(candidate)) {
        candidate = `${base}${n}@iph.com`;
        n++;
    }
    taken.add(candidate);
    return candidate;
}

async function main() {
    console.log(COMMIT ? '*** COMMIT MODE — will write to the database ***' : 'Dry run (default) — no writes will be made. Pass --commit to apply.');

    const raw = fs.readFileSync(TSV_PATH, 'utf-8');
    const lines = raw.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
    const rows = lines.map(parseRow);

    // Pre-flight: validate every referenced FK actually exists.
    const idsByField: Record<string, Set<string>> = {};
    for (const f of FK_FIELDS) idsByField[f] = new Set();
    for (const r of rows) {
        for (const f of FK_FIELDS) {
            if (r[f] && r[f] !== 'default-group-id') idsByField[f].add(r[f]);
        }
    }
    const validSets: Record<string, Set<string>> = {};
    const [depts, groups, divs, dirs, jds, units] = await Promise.all([
        prisma.department.findMany({ where: { id: { in: [...idsByField.departmentId] } }, select: { id: true } }),
        prisma.group.findMany({ where: { id: { in: [...idsByField.groupId] } }, select: { id: true } }),
        prisma.division.findMany({ where: { id: { in: [...idsByField.divisionId] } }, select: { id: true } }),
        prisma.directorate.findMany({ where: { id: { in: [...idsByField.directorateId] } }, select: { id: true } }),
        prisma.jobDescription.findMany({ where: { id: { in: [...idsByField.jobDescriptionId] } }, select: { id: true } }),
        prisma.unit.findMany({ where: { id: { in: [...idsByField.unitId] } }, select: { id: true } }),
    ]);
    validSets.departmentId = new Set(depts.map(d => d.id));
    validSets.groupId = new Set([...groups.map(d => d.id), 'default-group-id']);
    validSets.divisionId = new Set(divs.map(d => d.id));
    validSets.directorateId = new Set(dirs.map(d => d.id));
    validSets.jobDescriptionId = new Set(jds.map(d => d.id));
    validSets.unitId = new Set(units.map(d => d.id));

    const warnings: string[] = [];
    for (const r of rows) {
        for (const f of FK_FIELDS) {
            if (r[f] && !validSets[f].has(r[f])) {
                warnings.push(`${r.fullName}: ${f} "${r[f]}" does not exist — left blank`);
                r[f] = null;
            }
        }
    }

    // Existing employees + users, for staffId matching and email dedupe. Full records
    // (not a narrow select) so the merge step below can tell "already has a value" from
    // "genuinely blank" for every field, not just email.
    const existingEmployees = await prisma.employee.findMany();
    const existingByStaffId = new Map(existingEmployees.filter(e => e.staffId).map(e => [e.staffId as string, e]));
    const existingUsers = await prisma.user.findMany({ select: { email: true } });
    const takenEmails = new Set([
        ...existingUsers.map(u => u.email.toLowerCase()),
        ...existingEmployees.filter(e => e.email).map(e => (e.email as string).toLowerCase()),
    ]);
    for (const r of rows) if (r.email) takenEmails.add(String(r.email).toLowerCase());

    let creates = 0, updates = 0, accountsCreated = 0;
    const plannedRecords: Array<{ row: Record<string, any>; existing: typeof existingEmployees[number] | undefined; email: string | null; accountEmail: string }> = [];

    for (const r of rows) {
        const existing = r.staffId ? existingByStaffId.get(r.staffId) : undefined;
        const fileEmail = r.email ? String(r.email).trim().toLowerCase() : null;
        const needsAccount = !existing || !existing.userId;
        // Employee.email: only touch it if the file actually provides one, OR this is a
        // brand-new employee with no email at all (needs *something*). Never overwrite an
        // existing real Employee.email with a generated placeholder.
        let email: string | null;
        if (fileEmail) email = fileEmail;
        else if (existing?.email) email = null; // leave untouched — don't overwrite with a placeholder
        else email = generateEmail(r.fullName, takenEmails);
        // accountEmail: the address actually used to create a login, only relevant when needsAccount.
        const accountEmail = fileEmail || existing?.email || email || generateEmail(r.fullName, takenEmails);
        plannedRecords.push({ row: r, existing, email, accountEmail });
        if (existing) updates++; else creates++;
        if (needsAccount) accountsCreated++;
    }

    // Show one fully-mapped sample row for review (the most complete record).
    const sample = plannedRecords.find(p => p.row.staffId === 'IPH-0126-066') || plannedRecords[0];
    console.log('\n=== Sample mapped row (' + sample.row.fullName + ') ===');
    console.log(JSON.stringify({ ...sample.row, resolvedEmployeeEmail: sample.email, accountEmail: sample.accountEmail, willCreateAccount: !sample.existing || !sample.existing.userId, matchedExisting: sample.existing ? sample.existing.id : null }, null, 2));

    console.log('\n=== Summary ===');
    console.log(`Rows parsed: ${rows.length}`);
    console.log(`New Employee rows to create: ${creates}`);
    console.log(`Existing Employee rows to update (matched by staffId): ${updates}`);
    console.log(`User accounts to create: ${accountsCreated} (password 123456 for all)`);
    console.log(`FK fallback warnings: ${warnings.length}`);
    if (warnings.length) warnings.forEach(w => console.log('  - ' + w));

    if (!COMMIT) {
        console.log('\nDry run complete. Re-run with --commit to apply.');
        return;
    }

    console.log('\nApplying changes...');
    let done = 0;
    for (const { row: r, existing, email, accountEmail } of plannedRecords) {
        const permissions = presetForRole(r.role);
        await prisma.$transaction(async (tx) => {
            let userId: string | null | undefined = existing?.userId;
            if (!userId) {
                const hashedPassword = await bcrypt.hash('123456', 10);
                const user = await tx.user.create({
                    data: {
                        email: accountEmail,
                        password: hashedPassword,
                        fullName: r.fullName,
                        role: r.role || 'EMPLOYEE',
                        departmentId: r.departmentId || undefined,
                        groupId: r.groupId || undefined,
                        unitId: r.unitId || undefined,
                        permissions,
                    },
                });
                userId = user.id;
            }

            // Employee.email: only include it in the write if we actually have a value to
            // set (either the file gave one, or this is a brand-new employee that needed a
            // generated placeholder) — `email` is deliberately null when we should leave an
            // existing Employee.email untouched.
            const data: Record<string, any> = { ...r, enrollmentStatus: 'ACTIVE', userId };
            delete data.email;
            if (email) data.email = email;

            if (existing) {
                // Merge: an already-existing employee (matched by staffId) may be further
                // along than this file's snapshot (this is verified true for at least one
                // row — "mo"). So only fill genuinely-blank DB fields; never let the file's
                // value replace something the DB already has, even a non-null "0"/default.
                const merged: Record<string, any> = {};
                for (const [k, v] of Object.entries(data)) {
                    if (v === null || v === undefined) continue;
                    if (k === 'enrollmentStatus' || k === 'userId') continue; // handled below, always applied
                    const currentVal = (existing as Record<string, any>)[k];
                    if (currentVal !== null && currentVal !== undefined) continue; // DB already has a value — keep it
                    merged[k] = v;
                }
                merged.enrollmentStatus = 'ACTIVE';
                merged.userId = userId;
                await tx.employee.update({ where: { id: existing.id }, data: merged });
            } else {
                await tx.employee.create({
                    data: {
                        ...data,
                        role: data.role || 'EMPLOYEE',
                        joinDate: data.joinDate || new Date(),
                        baseSalary: data.baseSalary ?? 0,
                    } as any,
                });
            }
        });
        done++;
        if (done % 10 === 0) console.log(`  ...${done}/${plannedRecords.length}`);
    }

    console.log(`\nDone. Processed ${done} rows.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
