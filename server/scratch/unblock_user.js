const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allPerms = [
    'view_directory', 'view_employees', 'register_employees', 'edit_employees', 'delete_employees',
    'view_contracts', 'manage_contract_management', 'view_lifecycle', 'manage_lifecycle_control',
    'view_payroll', 'manage_payroll', 'view_time_tracking', 'manage_time_tracking',
    'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals',
    'view_evaluations', 'view_hr_evaluations', 'manage_evaluation_control',
    'manage_groups', 'manage_departments', 'manage_units', 'manage_users'
  ];

  const user = await prisma.user.update({
    where: { email: 'motaz1@iph.com' },
    data: {
      permissions: allPerms
    }
  });
  console.log('User motaz1@iph.com updated with all permissions.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
