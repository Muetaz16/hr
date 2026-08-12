// Server-side mirror of the role permission presets used by the Access Management
// screen (src/pages/admin/UserForm.tsx). When an employee is enrolled from
// Personnel & Workforce, the auto-created login account is seeded with its role's
// recommended permissions so the person immediately has sensible access and the
// Access Management screen shows those toggles pre-selected (still fully editable).

export const ALL_PERMISSION_IDS: string[] = [
    // Employees & Directory
    'view_directory', 'view_employees', 'manage_employees', 'register_employees', 'edit_employees', 'delete_employees',
    // Recruitment
    'view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'approve_hr_manager', 'approve_hr_recruitment',
    // Contracts & Lifecycle
    'view_contracts', 'manage_contract_management', 'view_lifecycle', 'manage_lifecycle_control',
    // Payroll & Time
    'view_payroll', 'manage_payroll', 'view_time_tracking', 'manage_time_tracking',
    // Operations & Approvals
    'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals',
    // Evaluations
    'view_evaluations', 'view_hr_evaluations', 'manage_evaluation_control',
    // IT & Operational Services
    'manage_onboarding', 'manage_it_issues',
    // Administration
    'manage_groups', 'manage_departments', 'manage_units', 'manage_job_descriptions', 'manage_users',
];

export const ROLE_PRESETS: Record<string, string[]> = {
    EMPLOYEE: [],
    HEAD_UNIT: ['view_directory', 'manage_leaves', 'manage_tasks', 'manager_approvals', 'view_evaluations', 'view_recruitment'],
    HEAD_DEPARTMENT: ['view_directory', 'view_employees', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment'],
    HEAD_OFFICE: ['view_directory', 'view_employees', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment'],
    HEAD_DIVISION: ['view_directory', 'view_employees', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals'],
    HEAD_DIRECTOR: ['view_directory', 'view_employees', 'view_contracts', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals'],
    GENERAL_MANAGER: ['view_directory', 'view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'manage_announcements', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
    CHAIRMAN: ['view_directory', 'view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
    HR_MANAGER: ['view_directory', 'view_employees', 'manage_employees', 'register_employees', 'edit_employees', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'approve_hr_manager', 'view_contracts', 'manage_contract_management', 'view_lifecycle', 'manage_lifecycle_control', 'view_payroll', 'manage_payroll', 'view_time_tracking', 'manage_time_tracking', 'manage_leaves', 'manage_announcements', 'view_evaluations', 'view_hr_evaluations', 'manage_evaluation_control', 'manage_onboarding', 'manage_job_descriptions'],
    PERSONNEL: ['view_directory', 'view_employees', 'register_employees', 'edit_employees', 'view_evaluations', 'view_lifecycle', 'manage_onboarding', 'manage_it_issues'],
    SUPER_ADMIN: ALL_PERMISSION_IDS,
};

export const presetForRole = (role?: string | null): string[] =>
    role === 'SUPER_ADMIN' ? [...ALL_PERMISSION_IDS] : [...(ROLE_PRESETS[role || 'EMPLOYEE'] || [])];
