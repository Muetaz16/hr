import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    take: 5,
    select: { fullName: true, email: true }
  });
  console.log('--- EMPLOYEES IN DATABASE ---');
  console.table(employees);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
