import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.department.findMany().then(d => {
  d.forEach(dept => {
    if (dept.positionFactor === null || dept.positionFactor === 1) {
        console.log(`MISSING FACTOR: "${dept.name}"`);
    } else {
        console.log(`HAS FACTOR: "${dept.name}" -> ${dept.positionFactor}`);
    }
  });
  process.exit(0);
});
