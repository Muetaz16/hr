import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting restoration seed...');

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Create a Base Group
    const group = await prisma.group.upsert({
        where: { id: 'default-group-id' },
        update: {},
        create: {
            id: 'default-group-id',
            name: 'IPH Holding'
        }
    });
    console.log('Group created/verified: IPH Holding');

    // 2. Create a Base Department
    const dept = await prisma.department.upsert({
        where: { id: 'default-dept-id' },
        update: {},
        create: {
            id: 'default-dept-id',
            name: 'HR Department',
            groupId: group.id
        }
    });
    console.log('Department created/verified: HR Department');

    // 3. Super Admin
    await prisma.user.upsert({
        where: { email: 'admin@iph.com' },
        update: { password: hashedPassword },
        create: {
            email: 'admin@iph.com',
            password: hashedPassword,
            fullName: 'System Admin',
            role: 'SUPER_ADMIN'
        }
    });
    console.log('User created/updated: admin@iph.com (Super Admin)');

    // 4. Head of Department
    await prisma.user.upsert({
        where: { email: 'dept.head@iph.com' },
        update: { password: hashedPassword },
        create: {
            email: 'dept.head@iph.com',
            password: hashedPassword,
            fullName: 'Department Head',
            role: 'HEAD_DEPARTMENT',
            departmentId: dept.id,
            groupId: group.id
        }
    });
    console.log('User created/updated: dept.head@iph.com (Head of Department)');

    // 5. Head of Director
    await prisma.user.upsert({
        where: { email: 'director.head@iph.com' },
        update: { password: hashedPassword },
        create: {
            email: 'director.head@iph.com',
            password: hashedPassword,
            fullName: 'Director Head',
            role: 'HEAD_DIRECTOR',
            groupId: group.id
        }
    });
    console.log('User created/updated: director.head@iph.com (Head of Director)');

    console.log('\nRestoration complete!');
    console.log('All passwords are set to: admin123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
