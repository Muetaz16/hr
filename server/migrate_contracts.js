const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration...');
  
  const resdantUpdate = await prisma.employee.updateMany({
    where: {
      contractType: {
        in: ['Limited', 'Unlimited', null]
      }
    },
    data: {
      contractType: 'RESDANT'
    }
  });
  console.log(`Updated ${resdantUpdate.count} employees to RESDANT`);

  const directUpdate = await prisma.employee.updateMany({
    where: {
      contractType: {
        in: ['DIRECT RESDANT', 'DIRCTOT']
      }
    },
    data: {
      contractType: 'DIRCT NONE RESDANT'
    }
  });
  console.log(`Updated ${directUpdate.count} employees to DIRCT NONE RESDANT`);

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
