import { staffHubService } from '../services/staffHubService';
import type { LeaveRequest, LeaveApprovalStep, LeaveRequestWithEmployee } from '../services/staffHubService';
import { recruitmentService } from '../services/recruitmentService';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import type { RecruitmentRequest, User } from '../types';
import { canAccess } from './access';

// Leave types decided through the org-based approval-step chain (fetched via getMyPendingSteps);
// everything else is a legacy status-ladder request. Kept in sync with MyApprovals.tsx.
const CHAIN_LEAVE_TYPES = ['PAID_HOLIDAY', 'UNPAID_LEAVE', 'EMERGENCY_LEAVE', 'LATE_COMING', 'EARLY_LEAVING', 'HOURS_LEAVE', 'WORK_AUTHORIZATION', 'EXCEPTIONAL_PERFORMANCE', 'MISSING_PUNCH'];
const PRF_STAGES = ['deptHead', 'divHead', 'hrRecruitment', 'hrManager', 'gm'] as const;

export interface MyApprovalCounts {
    total: number;
    staff: number;
    exceptional: number;
    recruitment: number;
    cover: number;
}

type CurrentUser = Pick<User, 'role' | 'permissions' | 'departmentId' | 'groupId' | 'unitId' | 'divisionId'> | null | undefined;

// Counts every item awaiting THIS user's decision across all approval surfaces, using the exact
// same eligibility rules the unified "My Approvals" inbox uses. Returns zeros on any failure so the
// dashboard card never breaks the page. Kept intentionally read-only.
export async function fetchMyApprovalCounts(currentUser: CurrentUser): Promise<MyApprovalCounts> {
    const empty: MyApprovalCounts = { total: 0, staff: 0, exceptional: 0, recruitment: 0, cover: 0 };
    if (!currentUser) return empty;

    const isHR = canAccess(currentUser, [], ['manage_recruitment']);
    const isDirector = canAccess(currentUser, ['HEAD_DIRECTOR'], ['recruitment_approvals']);
    const isDivisionHead = canAccess(currentUser, ['HEAD_DIVISION'], ['recruitment_approvals']);

    let statusFilter = 'PENDING';
    if (currentUser.role === 'HEAD_DEPARTMENT') statusFilter = 'PENDING,APPROVED_BY_UNIT';
    else if (currentUser.role === 'HEAD_DIVISION') statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT';
    else if (currentUser.role === 'HEAD_DIRECTOR') statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT,APPROVED_BY_DIVISION';
    else if (currentUser.role === 'SUPER_ADMIN' || currentUser.permissions?.includes('approve_hr_manager')) statusFilter = 'PENDING,APPROVED_BY_UNIT,APPROVED_BY_DEPT,APPROVED_BY_DIVISION,APPROVED_BY_DIRECTOR';

    try {
        const [steps, legacy, recruitment, coverReqs, departments, myRecord] = await Promise.all([
            staffHubService.getMyPendingSteps().catch(() => [] as LeaveApprovalStep[]),
            staffHubService.getPendingRequests({
                departmentId: currentUser.departmentId || undefined,
                groupId: currentUser.groupId || undefined,
                unitId: currentUser.unitId || undefined,
                divisionId: currentUser.divisionId || undefined,
                status: statusFilter,
            }).catch(() => [] as LeaveRequest[]),
            recruitmentService.getAllRequests().catch(() => [] as RecruitmentRequest[]),
            staffHubService.getMyReplacementRequests().catch(() => [] as LeaveRequestWithEmployee[]),
            departmentService.getAllDepartments().catch(() => [] as any[]),
            employeeService.getMyEmployeeRecord().catch(() => null),
        ]);

        const staff = steps.filter((s: LeaveApprovalStep) => s.leaveRequest?.type !== 'EXCEPTIONAL_PERFORMANCE').length
            + (legacy as LeaveRequest[]).filter((r: LeaveRequest) => !CHAIN_LEAVE_TYPES.includes(r.type)).length;
        const exceptional = steps.filter((s: LeaveApprovalStep) => s.leaveRequest?.type === 'EXCEPTIONAL_PERFORMANCE').length;

        // Recruitment eligibility mirrors Recruitment.tsx / MyApprovals.tsx exactly.
        const myDepartmentId = myRecord?.departmentId || currentUser.departmentId || null;
        const myDivisionId = myRecord?.divisionId || departments.find((d: any) => d.id === myDepartmentId)?.divisionId || null;
        const reqDivisionId = (r: RecruitmentRequest) => r.divisionId || departments.find((d: any) => d.id === r.departmentId)?.divisionId || null;
        const prfNextStage = (r: RecruitmentRequest): string | null => {
            const a: any = (r as any).prfApprovals || {};
            return PRF_STAGES.find(s => !a[s]) || null;
        };
        const canActPrfStage = (stage: string): boolean => {
            const role = currentUser.role;
            const perms = currentUser.permissions || [];
            if (role === 'SUPER_ADMIN') return true;
            switch (stage) {
                case 'deptHead': return role === 'HEAD_DEPARTMENT' || role === 'HEAD_OFFICE' || perms.includes('manage_recruitment');
                case 'divHead': return role === 'HEAD_DIVISION' || role === 'HEAD_OFFICE' || perms.includes('recruitment_approvals');
                case 'hrManager': return perms.includes('approve_hr_manager');
                case 'hrRecruitment': return perms.includes('approve_hr_recruitment');
                case 'gm': return role === 'GENERAL_MANAGER' || perms.includes('approve_gm');
                default: return false;
            }
        };
        const canActOn = (r: RecruitmentRequest): boolean => {
            if (r.status === 'REJECTED' || r.status === 'FULLY_APPROVED') return false;
            if (r.type === 'HIRE') { const stage = prfNextStage(r); return stage ? canActPrfStage(stage) : false; }
            if (r.status === 'PENDING') return currentUser.role === 'SUPER_ADMIN' || (isDivisionHead && reqDivisionId(r) === myDivisionId);
            if (r.status === 'DEPT_APPROVED') return isHR;
            if (r.status === 'HR_APPROVED') return isDirector;
            return false;
        };

        const recruitmentCount = recruitment.filter(canActOn).length;
        const cover = coverReqs.length;

        const total = staff + exceptional + recruitmentCount + cover;
        return { total, staff, exceptional, recruitment: recruitmentCount, cover };
    } catch {
        return empty;
    }
}
