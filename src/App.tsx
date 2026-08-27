import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ConfirmProvider } from './components/ConfirmDialog';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Lazy Load Pages
const TasksPage = lazy(() => import('./pages/Tasks'));
const GroupsPage = lazy(() => import('./pages/admin/Groups'));
const DepartmentsPage = lazy(() => import('./pages/admin/Departments'));
const UnitsPage = lazy(() => import('./pages/admin/Units'));
const JobDescriptionsPage = lazy(() => import('./pages/admin/JobDescriptions'));
const JobDescriptionFormPage = lazy(() => import('./pages/admin/JobDescriptionForm'));
const JobDescriptionsBrowsePage = lazy(() => import('./pages/JobDescriptionsBrowse'));
const EmployeesPage = lazy(() => import('./pages/admin/Employees'));
const EmployeeFormPage = lazy(() => import('./pages/admin/EmployeeForm'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const UserFormPage = lazy(() => import('./pages/admin/UserForm'));
const FunctionalHatsPage = lazy(() => import('./pages/admin/FunctionalHats'));
const SystemLogsPage = lazy(() => import('./pages/admin/SystemLogs'));
const EvaluationsPage = lazy(() => import('./pages/Evaluations'));
const EvaluationControlPage = lazy(() => import('./pages/hr/EvaluationControl'));
const ContractDetailPage = lazy(() => import('./pages/ContractDetail'));
const ContractManagementPage = lazy(() => import('./pages/ContractManagement'));
const StaffHubPage = lazy(() => import('./pages/StaffHub'));
const MyAttendancePage = lazy(() => import('./pages/MyAttendance'));
const EvaluationDetailPage = lazy(() => import('./pages/EvaluationDetail'));
const AnnouncementsFeedPage = lazy(() => import('./pages/AnnouncementsFeed'));
const OrganizationPage = lazy(() => import('./pages/Organization'));
const PersonnelRelationsPage = lazy(() => import('./pages/personnel-relations/PersonnelRelations'));
const AttendancePage = lazy(() => import('./pages/Attendance'));
const ApprovalsPage = lazy(() => import('./pages/Approvals'));
const ApprovedLeavesPage = lazy(() => import('./pages/ApprovedLeaves'));
const LifecycleControlPage = lazy(() => import('./pages/hr/LifecycleControl'));
const PositionsToFillPage = lazy(() => import('./pages/Recruitment').then(m => ({ default: () => <m.default mode="positions" /> })));
const RecruitmentRequestsPage = lazy(() => import('./pages/Recruitment').then(m => ({ default: () => <m.default mode="requests" /> })));
const RecruitmentApprovalsPage = lazy(() => import('./pages/Recruitment').then(m => ({ default: () => <m.default mode="approvals" /> })));
const RecruitmentCreatePage = lazy(() => import('./pages/Recruitment').then(m => ({ default: () => <m.default mode="create" /> })));
const HiringListPage = lazy(() => import('./pages/CandidatePipeline').then(m => ({ default: () => <m.default view="screening" /> })));
const InterviewsPage = lazy(() => import('./pages/CandidatePipeline').then(m => ({ default: () => <m.default view="interview" /> })));
const JobOffersPage = lazy(() => import('./pages/CandidatePipeline').then(m => ({ default: () => <m.default view="offer" /> })));
const OnboardingPage = lazy(() => import('./pages/CandidatePipeline').then(m => ({ default: () => <m.default view="onboarding" /> })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading Fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
  </div>
);

const Unauthorized = () => <div className="text-red-500 text-xl p-8">Unauthorized Access</div>;

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Toaster position="top-right" richColors />
        <AuthProvider>
          <ConfirmProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL']} allowedPermissions={['view_employees', 'manage_employees']} />}>
                    <Route path="/employees" element={<EmployeesPage />} />
                    <Route path="/employees/new" element={<EmployeeFormPage />} />
                    <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL']} allowedPermissions={['view_evaluations']} />}>
                    <Route path="/evaluations" element={<EvaluationsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL']} allowedPermissions={['view_contracts', 'manage_contract_management']} />}>
                    <Route path="/contracts/:id" element={<ContractDetailPage />} />
                    <Route path="/contract-management" element={<ContractManagementPage />} />
                  </Route>
                  <Route path="/staff-hub" element={<StaffHubPage />} />
                  <Route path="/my-attendance" element={<MyAttendancePage />} />
                  <Route path="/my-evaluation" element={<EvaluationDetailPage />} />
                  <Route path="/announcements" element={<AnnouncementsFeedPage />} />
                  <Route path="/organization" element={<OrganizationPage />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT']} allowedPermissions={['view_personnel_relations']} />}>
                    <Route path="/personnel-relations/:tab" element={<PersonnelRelationsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER']} allowedPermissions={['manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals', 'approve_attendance']} />}>
                    <Route path="/approvals" element={<ApprovalsPage />} />
                  </Route>
                  <Route path="/attendance" element={<Navigate to="/attendance/overview" replace />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL']} allowedPermissions={['view_time_tracking', 'manage_time_tracking']} />}>
                    <Route path="/attendance/:tab" element={<AttendancePage />} />
                    <Route path="/approved-leaves" element={<ApprovedLeavesPage />} />
                  </Route>
                  <Route path="/recruitment" element={<Navigate to="/recruitment/requests" replace />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT', 'GENERAL_MANAGER', 'CHAIRMAN']} allowedPermissions={['view_recruitment', 'manage_recruitment', 'recruitment_approvals']} />}>
                    <Route path="/recruitment/requests" element={<RecruitmentRequestsPage />} />
                    <Route path="/recruitment/new" element={<RecruitmentCreatePage />} />
                    <Route path="/recruitment/positions" element={<PositionsToFillPage />} />
                    <Route path="/recruitment/hiring" element={<HiringListPage />} />
                    <Route path="/recruitment/interviews" element={<InterviewsPage />} />
                    <Route path="/recruitment/offers" element={<JobOffersPage />} />
                    <Route path="/recruitment/onboarding" element={<OnboardingPage />} />
                    <Route path="/recruitment/approvals" element={<RecruitmentApprovalsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} allowedPermissions={['manage_evaluation_control']} />}>
                    <Route path="/evaluation-control" element={<EvaluationControlPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL']} allowedPermissions={['view_lifecycle', 'manage_lifecycle_control']} />}>
                    <Route path="/lifecycle-control" element={<LifecycleControlPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'GENERAL_MANAGER', 'CHAIRMAN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_OFFICE', 'HEAD_DEPARTMENT', 'HEAD_UNIT']} />}>
                    <Route path="/job-descriptions-browse" element={<JobDescriptionsBrowsePage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_departments']} />}>
                    <Route path="/departments" element={<DepartmentsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_units']} />}>
                    <Route path="/units" element={<UnitsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} allowedPermissions={['manage_job_descriptions']} />}>
                    <Route path="/job-descriptions" element={<JobDescriptionsPage />} />
                    <Route path="/job-descriptions/new" element={<JobDescriptionFormPage />} />
                    <Route path="/job-descriptions/:id/edit" element={<JobDescriptionFormPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_groups']} />}>
                    <Route path="/groups" element={<GroupsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_users']} />}>
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/users/new" element={<UserFormPage />} />
                    <Route path="/users/:id/edit" element={<UserFormPage />} />
                    <Route path="/access/hats" element={<FunctionalHatsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['view_logs']} />}>
                    <Route path="/system-logs" element={<SystemLogsPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </ConfirmProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
