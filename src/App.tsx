import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Lazy Load Pages
const TasksPage = lazy(() => import('./pages/Tasks'));
const GroupsPage = lazy(() => import('./pages/admin/Groups'));
const DepartmentsPage = lazy(() => import('./pages/admin/Departments'));
const UnitsPage = lazy(() => import('./pages/admin/Units'));
const EmployeesPage = lazy(() => import('./pages/admin/Employees'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const TimeTrackingPage = lazy(() => import('./pages/TimeTracking'));
const EvaluationsPage = lazy(() => import('./pages/Evaluations'));
const PayrollPage = lazy(() => import('./pages/Payroll'));
const EvaluationControlPage = lazy(() => import('./pages/hr/EvaluationControl'));
const HREvaluationsPage = lazy(() => import('./pages/hr/HREvaluations'));
const ContractDetailPage = lazy(() => import('./pages/ContractDetail'));
const ContractManagementPage = lazy(() => import('./pages/ContractManagement'));
const StaffHubPage = lazy(() => import('./pages/StaffHub'));
const OrganizationPage = lazy(() => import('./pages/Organization'));
const ApprovalsPage = lazy(() => import('./pages/Approvals'));
const LifecycleControlPage = lazy(() => import('./pages/hr/LifecycleControl'));
const SupportCenterPage = lazy(() => import('./pages/SupportCenter'));
const AdminOperationsPage = lazy(() => import('./pages/admin/AdminOperations'));
const RecruitmentPage = lazy(() => import('./pages/Recruitment'));

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
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} allowedPermissions={['view_time_tracking', 'manage_time_tracking']} />}>
                    <Route path="/time-tracking" element={<TimeTrackingPage />} />
                  </Route>
                  <Route path="/evaluations" element={<EvaluationsPage />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL']} allowedPermissions={['view_contracts', 'manage_contract_management']} />}>
                    <Route path="/contracts/:id" element={<ContractDetailPage />} />
                    <Route path="/contract-management" element={<ContractManagementPage />} />
                  </Route>
                  <Route path="/staff-hub" element={<StaffHubPage />} />
                  <Route path="/organization" element={<OrganizationPage />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER']} allowedPermissions={['manage_leaves', 'manage_tasks', 'manage_announcements', 'manager_approvals']} />}>
                    <Route path="/approvals" element={<ApprovalsPage />} />
                  </Route>
                  <Route path="/recruitment" element={<RecruitmentPage />} />

                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} allowedPermissions={['manage_evaluation_control']} />}>
                    <Route path="/evaluation-control" element={<EvaluationControlPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} allowedPermissions={['view_hr_evaluations', 'manage_evaluation_control']} />}>
                    <Route path="/hr-evaluations" element={<HREvaluationsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} allowedPermissions={['view_payroll', 'manage_payroll']} />}>
                    <Route path="/payroll" element={<PayrollPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL']} allowedPermissions={['view_lifecycle', 'manage_lifecycle_control']} />}>
                    <Route path="/lifecycle-control" element={<LifecycleControlPage />} />
                  </Route>

                  <Route path="/support-center" element={<SupportCenterPage />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL']} allowedPermissions={['manage_onboarding', 'manage_it_issues']} />}>
                    <Route path="/admin-operations" element={<AdminOperationsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_departments']} />}>
                    <Route path="/departments" element={<DepartmentsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_units']} />}>
                    <Route path="/units" element={<UnitsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_groups']} />}>
                    <Route path="/groups" element={<GroupsPage />} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} allowedPermissions={['manage_users']} />}>
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
