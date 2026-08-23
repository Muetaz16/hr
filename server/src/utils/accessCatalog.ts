// ---------------------------------------------------------------------------
// Access catalog — the single server-side source of truth for authorization.
//
// The model has THREE additive layers that are merged (union) into a user's
// effective permission set:
//   1. Position  (exactly one org role)      → POSITION_DEFAULTS[position]
//   2. Functional hats (zero or many)        → each hat's `permissions`
//   3. Individual grants (zero or many keys) → User.permissions
//
// effective = POSITION_DEFAULTS[position] ∪ (⋃ hat.permissions) ∪ grants
//
// Nothing is ever subtracted (add-only), so a user can never lose access that
// their position or a hat grants. SUPER_ADMIN implicitly gets everything.
// ---------------------------------------------------------------------------

export type PermissionDef = { id: string; group: string; label: string };

// Full permission catalog (reconciled — includes keys that were previously only
// referenced in routes: approve_attendance, approve_hr_recruitment,
// manage_divisions, manage_directorates).
export const PERMISSIONS: PermissionDef[] = [
    // Employees & Directory
    { id: 'view_directory', group: 'Employees & Directory', label: 'View Directory' },
    { id: 'view_employees', group: 'Employees & Directory', label: 'View Full Emp Data' },
    { id: 'manage_employees', group: 'Employees & Directory', label: 'Manage Emp Records' },
    { id: 'register_employees', group: 'Employees & Directory', label: 'Register New Emp' },
    { id: 'edit_employees', group: 'Employees & Directory', label: 'Edit Emp Data' },
    { id: 'delete_employees', group: 'Employees & Directory', label: 'Delete Emp' },
    // Recruitment
    { id: 'view_recruitment', group: 'Recruitment', label: 'View Recruitment' },
    { id: 'manage_recruitment', group: 'Recruitment', label: 'Manage Requests & Hiring' },
    { id: 'recruitment_approvals', group: 'Recruitment', label: 'Approve Recruitment' },
    { id: 'approve_hr_manager', group: 'Recruitment', label: 'Approve as Head of HR' },
    { id: 'approve_hr_recruitment', group: 'Recruitment', label: 'Approve as Head of Recruitment' },
    // Contracts & Lifecycle
    { id: 'view_contracts', group: 'Contracts & Lifecycle', label: 'View Contracts' },
    { id: 'manage_contract_management', group: 'Contracts & Lifecycle', label: 'Manage Contracts' },
    { id: 'view_lifecycle', group: 'Contracts & Lifecycle', label: 'View Lifecycle' },
    { id: 'manage_lifecycle_control', group: 'Contracts & Lifecycle', label: 'Manage Lifecycle' },
    // Personnel Relations
    { id: 'view_personnel_relations', group: 'Personnel Relations', label: 'View Personnel Relations' },
    { id: 'manage_personnel_actions', group: 'Personnel Relations', label: 'Manage Personnel Action Forms' },
    { id: 'manage_rewards', group: 'Personnel Relations', label: 'Manage Rewards & Recognition' },
    { id: 'manage_disciplinary', group: 'Personnel Relations', label: 'Manage Disciplinary Actions' },
    { id: 'manage_offboarding', group: 'Personnel Relations', label: 'Manage Offboarding' },
    // Payroll & Time
    { id: 'view_payroll', group: 'Payroll & Time', label: 'View Payroll' },
    { id: 'manage_payroll', group: 'Payroll & Time', label: 'Manage Payroll' },
    { id: 'view_time_tracking', group: 'Payroll & Time', label: 'View Time Logs' },
    { id: 'manage_time_tracking', group: 'Payroll & Time', label: 'Manage Time Logs' },
    // Operations & Approvals
    { id: 'manage_leaves', group: 'Operations & Approvals', label: 'Approve Leaves' },
    { id: 'approve_attendance', group: 'Operations & Approvals', label: 'Head of Attendance Approval' },
    { id: 'manage_tasks', group: 'Operations & Approvals', label: 'Manage Tasks' },
    { id: 'manage_announcements', group: 'Operations & Approvals', label: 'Post Announcements' },
    { id: 'manager_approvals', group: 'Operations & Approvals', label: 'Full Mgr Approvals' },
    // Evaluations
    { id: 'view_evaluations', group: 'Evaluations', label: 'View All Evaluations' },
    { id: 'submit_evaluations', group: 'Evaluations', label: 'Submit Evaluations' },
    { id: 'view_hr_evaluations', group: 'Evaluations', label: 'Manage HR Evals' },
    { id: 'manage_evaluation_control', group: 'Evaluations', label: 'Evaluation Control' },
    // IT & Operational Services
    { id: 'manage_onboarding', group: 'IT & Operational Services', label: 'Manage Onboarding (Assets)' },
    { id: 'manage_it_issues', group: 'IT & Operational Services', label: 'Manage IT Support Tickets' },
    // Administration
    { id: 'manage_groups', group: 'Administration', label: 'Manage Groups' },
    { id: 'manage_departments', group: 'Administration', label: 'Manage Depts' },
    { id: 'manage_divisions', group: 'Administration', label: 'Manage Divisions' },
    { id: 'manage_directorates', group: 'Administration', label: 'Manage Directorates' },
    { id: 'manage_units', group: 'Administration', label: 'Manage Units' },
    { id: 'manage_job_descriptions', group: 'Administration', label: 'Manage Job Descriptions' },
    { id: 'manage_users', group: 'Administration', label: 'Manage System Users' },
];

export const ALL_PERMISSION_IDS: string[] = PERMISSIONS.map(p => p.id);

// Organizational positions — a user holds exactly ONE. These drive the hierarchy
// / approval routing AND carry a default permission bundle.
export const POSITIONS = [
    'EMPLOYEE',
    'HEAD_UNIT',
    'HEAD_DEPARTMENT',
    'HEAD_OFFICE',
    'HEAD_DIVISION',
    'HEAD_DIRECTOR',
    'GENERAL_MANAGER',
    'CHAIRMAN',
    'SUPER_ADMIN',
] as const;
export type Position = typeof POSITIONS[number];

// Default permissions granted purely by the org position.
// NOTE: heads intentionally do NOT get `view_employees` (company-wide "View Full Emp Data") by
// default — they see only the employees within their own org branch (their unit/department/
// division/directorate). Granting `view_employees` individually (or via a hat) lets a head see the
// full company roster. Scope enforcement lives server-side in employeeController.resolveEmployeeScope.
export const POSITION_DEFAULTS: Record<string, string[]> = {
    EMPLOYEE: [],
    HEAD_UNIT: ['view_directory', 'manage_leaves', 'manage_tasks', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_personnel_relations', 'view_recruitment'],
    HEAD_DEPARTMENT: ['view_directory', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_personnel_relations', 'view_recruitment', 'manage_recruitment'],
    HEAD_OFFICE: ['view_directory', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_personnel_relations', 'view_recruitment', 'manage_recruitment'],
    HEAD_DIVISION: ['view_directory', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_personnel_relations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals'],
    HEAD_DIRECTOR: ['view_directory', 'view_contracts', 'manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_personnel_relations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals'],
    GENERAL_MANAGER: ['view_directory', 'view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'submit_evaluations', 'view_personnel_relations', 'manage_announcements', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
    CHAIRMAN: ['view_directory', 'view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'submit_evaluations', 'view_personnel_relations', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
    SUPER_ADMIN: ALL_PERMISSION_IDS,
};

// System functional hats seeded on first run. Admins may add/rename/edit hats
// afterwards; these are marked `isSystem` so the seed can upsert them idempotently.
export type HatSeed = { key: string; name: string; description: string; permissions: string[] };
export const SYSTEM_HATS: HatSeed[] = [
    {
        key: 'HR_MANAGER',
        name: 'HR Manager',
        description: 'Full HR operations: employees, contracts, lifecycle, payroll, evaluations.',
        permissions: [
            'view_directory', 'view_employees', 'manage_employees', 'register_employees', 'edit_employees',
            'view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'approve_hr_manager',
            'view_contracts', 'manage_contract_management', 'view_lifecycle', 'manage_lifecycle_control',
            'view_personnel_relations', 'manage_personnel_actions', 'manage_rewards', 'manage_disciplinary', 'manage_offboarding',
            'view_payroll', 'manage_payroll', 'view_time_tracking', 'manage_time_tracking',
            'manage_leaves', 'manage_announcements', 'view_evaluations', 'submit_evaluations', 'view_hr_evaluations',
            'manage_evaluation_control', 'manage_onboarding', 'manage_job_descriptions',
        ],
    },
    {
        key: 'HEAD_ATTENDANCE',
        name: 'Head of Attendance',
        description: 'Owns attendance & time tracking, approves attendance exceptions.',
        permissions: ['view_time_tracking', 'manage_time_tracking', 'approve_attendance', 'manage_leaves'],
    },
    {
        key: 'HEAD_RECRUITMENT',
        name: 'Head of Recruitment & Hiring',
        description: 'Owns the recruitment pipeline and hiring approvals.',
        permissions: ['view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'approve_hr_recruitment'],
    },
    {
        key: 'HEAD_PAYROLL',
        name: 'Head of Payroll',
        description: 'Owns payroll processing and review.',
        permissions: ['view_payroll', 'manage_payroll'],
    },
    {
        key: 'PERSONNEL',
        name: 'Personnel',
        description: 'HR data-entry: register/edit employees, onboarding, IT issues, personnel actions.',
        permissions: ['view_directory', 'view_employees', 'register_employees', 'edit_employees', 'view_evaluations', 'submit_evaluations', 'view_lifecycle', 'view_personnel_relations', 'manage_personnel_actions', 'manage_onboarding', 'manage_it_issues'],
    },
];

export const positionDefaults = (position?: string | null): string[] =>
    position === 'SUPER_ADMIN' ? [...ALL_PERMISSION_IDS] : [...(POSITION_DEFAULTS[position || 'EMPLOYEE'] || [])];

/**
 * Merge the three layers into a deduped effective permission set.
 * @param position  the user's org position (User.role)
 * @param hatPermissionLists  the `permissions` array of each hat the user holds
 * @param grants    individual permission grants (User.permissions)
 */
export function computeEffectivePermissions(
    position: string | null | undefined,
    hatPermissionLists: string[][],
    grants: string[] | null | undefined,
): string[] {
    if (position === 'SUPER_ADMIN') return [...ALL_PERMISSION_IDS];
    const set = new Set<string>(positionDefaults(position));
    for (const list of hatPermissionLists) for (const p of list) set.add(p);
    for (const p of grants || []) set.add(p);
    return Array.from(set);
}
