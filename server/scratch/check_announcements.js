const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const announcements = await prisma.announcement.findMany();
    console.log(JSON.stringify(announcements, null, 2));
    await prisma.$disconnect();
}

check();
