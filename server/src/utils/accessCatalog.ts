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

// Full permission catalog, grouped by the SIX sections the system actually has:
//   • the four functional departments — Attendance, Payroll, Recruitment, Personnel Relations
//   • two operational groups — Operations & Approvals (cross-cutting approver/manager duties that
//     belong to no single department) and Administration (system configuration).
//
// Group order AND within-group order are meaningful: both the Individual Grants panel
// (src/pages/admin/UserForm.tsx buildGroups) and the Functional Hats editor
// (src/pages/admin/FunctionalHats.tsx) build their section cards by scanning this array in order,
// so this array is the only place the layout of those two screens is defined.
export const PERMISSIONS: PermissionDef[] = [
    // --- Attendance (الحضور والانصراف) ---
    { id: 'view_time_tracking', group: 'Attendance', label: 'View Attendance & Time Logs' },
    { id: 'manage_time_tracking', group: 'Attendance', label: 'Manage Attendance & Time Logs' },
    // Work hours, leave types, holidays, multiplier factors and employee shifts. Previously
    // unreachable by anyone but a literal SUPER_ADMIN, which meant the Head of Attendance hat
    // couldn't open the settings it owns.
    { id: 'manage_attendance_settings', group: 'Attendance', label: 'Manage Attendance Settings' },
    // The Head-of-Attendance stage of the leave-approval chain (leaveApprovalChain.ts).
    { id: 'approve_attendance', group: 'Attendance', label: 'Approve as Head of Attendance' },
    // --- Payroll (الرواتب) ---
    { id: 'view_payroll', group: 'Payroll', label: 'View Payroll' },
    { id: 'manage_payroll', group: 'Payroll', label: 'Manage Payroll' },
    // --- Recruitment (التوظيف) ---
    { id: 'view_recruitment', group: 'Recruitment', label: 'View Recruitment' },
    { id: 'manage_recruitment', group: 'Recruitment', label: 'Raise & Manage Hiring Requests' },
    { id: 'recruitment_approvals', group: 'Recruitment', label: 'Approve Hiring Requests' },
    // NOT just the hrRecruitment PRF stage anymore — this is the recruitment-team permission that
    // opens the whole "Recruitment Department" section (positions, applicants, interviews, offers,
    // onboarding). Deliberately NOT view/manage_recruitment, which every head inherits by position.
    { id: 'approve_hr_recruitment', group: 'Recruitment', label: 'Head of Recruitment (full pipeline)' },
    // --- Personnel Relations (شؤون الموظفين) ---
    { id: 'view_personnel_relations', group: 'Personnel Relations', label: 'View Personnel Relations' },
    { id: 'view_employees', group: 'Personnel Relations', label: 'View Full Employee Data' },
    { id: 'manage_employees', group: 'Personnel Relations', label: 'Manage Employee Records' },
    { id: 'register_employees', group: 'Personnel Relations', label: 'Register New Employees' },
    { id: 'edit_employees', group: 'Personnel Relations', label: 'Edit Employee Data' },
    { id: 'delete_employees', group: 'Personnel Relations', label: 'Delete Employees' },
    { id: 'view_lifecycle', group: 'Personnel Relations', label: 'View Employee Lifecycle' },
    { id: 'manage_lifecycle_control', group: 'Personnel Relations', label: 'Manage Employee Lifecycle' },
    { id: 'view_contracts', group: 'Personnel Relations', label: 'View Contracts' },
    { id: 'manage_contract_management', group: 'Personnel Relations', label: 'Manage Contracts & Renewals' },
    { id: 'manage_personnel_actions', group: 'Personnel Relations', label: 'Manage Personnel Action Forms' },
    { id: 'manage_promotions', group: 'Personnel Relations', label: 'Manage Promotions' },
    { id: 'manage_rewards', group: 'Personnel Relations', label: 'Manage Rewards & Recognition' },
    { id: 'manage_disciplinary', group: 'Personnel Relations', label: 'Manage Disciplinary Actions' },
    { id: 'edit_disciplinary_report', group: 'Personnel Relations', label: 'Edit Disciplinary Report After Stage 1' },
    { id: 'manage_offboarding', group: 'Personnel Relations', label: 'Manage Offboarding' },
    { id: 'view_hr_evaluations', group: 'Personnel Relations', label: 'View & Manage HR Evaluations' },
    { id: 'manage_evaluation_control', group: 'Personnel Relations', label: 'Evaluation Control' },
    // --- Operations & Approvals ---
    // Duties that come with managing people rather than with belonging to one HR department. Most
    // are position defaults for every head; approve_hr_manager/approve_gm are designated-approver
    // permissions granted only by hat or individual grant.
    { id: 'manager_approvals', group: 'Operations & Approvals', label: 'Full Manager Approvals' },
    { id: 'manage_leaves', group: 'Operations & Approvals', label: 'Approve Leave Requests' },
    { id: 'approve_hr_manager', group: 'Operations & Approvals', label: 'Approve as Head of HR' },
    { id: 'approve_gm', group: 'Operations & Approvals', label: 'Approve as General Manager' },
    { id: 'view_evaluations', group: 'Operations & Approvals', label: 'View All Evaluations' },
    { id: 'submit_evaluations', group: 'Operations & Approvals', label: 'Submit Evaluations' },
    { id: 'nominate_exceptional_award', group: 'Operations & Approvals', label: 'Nominate for Exceptional Performance Award' },
    { id: 'manage_announcements', group: 'Operations & Approvals', label: 'Post Announcements' },
    // --- Administration ---
    { id: 'manage_users', group: 'Administration', label: 'Manage System Users & Hats' },
    { id: 'manage_groups', group: 'Administration', label: 'Manage Groups' },
    { id: 'manage_directorates', group: 'Administration', label: 'Manage Directorates' },
    { id: 'manage_divisions', group: 'Administration', label: 'Manage Divisions' },
    { id: 'manage_departments', group: 'Administration', label: 'Manage Departments' },
    { id: 'manage_units', group: 'Administration', label: 'Manage Units' },
    { id: 'manage_job_descriptions', group: 'Administration', label: 'Manage Job Descriptions' },
    { id: 'view_logs', group: 'Administration', label: 'View Activity Log' },
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
    // NOTE: 'HR_MANAGER' and 'PERSONNEL' are NOT positions and no longer appear here. They exist
    // only as Functional Hat keys (SYSTEM_HATS below). The system has exactly the positions in
    // POSITIONS; anyone needing HR-Manager or Personnel powers keeps their real chart position and
    // wears the matching hat on top. Nothing anywhere may test User.role against those two strings.
    // view_personnel_relations deliberately excluded from every Head/GM/Chairman default below —
    // no screen honors it alone anymore (each Personnel Relations tab requires its own specific
    // manage_* permission, which these roles never hold), so it only ever produced a dead-end nav
    // entry into a section with nothing they could actually do.
    HEAD_UNIT: ['manage_leaves', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_recruitment', 'nominate_exceptional_award'],
    HEAD_DEPARTMENT: ['manage_leaves', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_recruitment', 'manage_recruitment', 'nominate_exceptional_award'],
    HEAD_OFFICE: ['manage_leaves', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_recruitment', 'manage_recruitment', 'nominate_exceptional_award'],
    HEAD_DIVISION: ['manage_leaves', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'nominate_exceptional_award'],
    HEAD_DIRECTOR: ['view_contracts', 'manage_leaves', 'manage_announcements', 'manager_approvals', 'view_evaluations', 'submit_evaluations', 'view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'nominate_exceptional_award'],
    GENERAL_MANAGER: ['view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'submit_evaluations', 'manage_announcements', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
    CHAIRMAN: ['view_employees', 'view_contracts', 'view_payroll', 'view_evaluations', 'submit_evaluations', 'manager_approvals', 'view_recruitment', 'recruitment_approvals'],
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
            'view_employees', 'manage_employees', 'register_employees', 'edit_employees',
            'view_recruitment', 'manage_recruitment', 'recruitment_approvals', 'approve_hr_manager',
            'view_contracts', 'manage_contract_management', 'view_lifecycle', 'manage_lifecycle_control',
            'view_personnel_relations', 'manage_personnel_actions', 'manage_rewards', 'manage_disciplinary', 'manage_offboarding', 'manage_promotions',
            'view_payroll', 'manage_payroll', 'view_time_tracking', 'manage_time_tracking',
            'manage_leaves', 'manage_announcements', 'view_evaluations', 'submit_evaluations', 'view_hr_evaluations',
            'manage_evaluation_control', 'manage_job_descriptions',
        ],
    },
    {
        key: 'HEAD_ATTENDANCE',
        name: 'Head of Attendance',
        description: 'Owns attendance & time tracking, its settings, and attendance approvals.',
        permissions: ['view_time_tracking', 'manage_time_tracking', 'manage_attendance_settings', 'approve_attendance', 'manage_leaves'],
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
        // Lets the Administration group be delegated without handing out SUPER_ADMIN (which bypasses
        // every check in the app). Mirrors the Administration group in PERMISSIONS exactly.
        key: 'SYSTEM_ADMIN',
        name: 'System Administrator',
        description: 'Manages system configuration: users & hats, org structure, job descriptions, activity log.',
        permissions: [
            'manage_users', 'manage_groups', 'manage_directorates', 'manage_divisions',
            'manage_departments', 'manage_units', 'manage_job_descriptions', 'view_logs',
        ],
    },
    {
        key: 'PERSONNEL',
        name: 'Personnel',
        description: 'Full personnel operations on top of a real position: employees, contracts, lifecycle, rewards/disciplinary/offboarding/promotions, time tracking, evaluations.',
        permissions: [
            'view_employees', 'register_employees', 'edit_employees',
            'view_contracts', 'manage_contract_management', 'view_lifecycle',
            'view_personnel_relations', 'manage_personnel_actions', 'manage_rewards', 'manage_disciplinary', 'manage_offboarding', 'manage_promotions',
            'view_payroll', 'view_time_tracking', 'manage_time_tracking',
            'view_evaluations', 'submit_evaluations', 'view_hr_evaluations', 'manage_evaluation_control',
        ],
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
