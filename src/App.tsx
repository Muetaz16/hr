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

const queryClient = new QueryClient();

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
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/time-tracking" element={<TimeTrackingPage />} />
                  <Route path="/evaluations" element={<EvaluationsPage />} />
                  <Route path="/contracts/:id" element={<ContractDetailPage />} />
                  <Route path="/contract-management" element={<ContractManagementPage />} />
                  <Route path="/staff-hub" element={<StaffHubPage />} />
                  <Route path="/organization" element={<OrganizationPage />} />
                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER']} />}>
                    <Route path="/approvals" element={<ApprovalsPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} />}>
                    <Route path="/evaluation-control" element={<EvaluationControlPage />} />
                    <Route path="/hr-evaluations" element={<HREvaluationsPage />} />
                    <Route path="/payroll" element={<PayrollPage />} />
                    <Route path="/lifecycle-control" element={<LifecycleControlPage />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
                    <Route path="/departments" element={<DepartmentsPage />} />
                    <Route path="/units" element={<UnitsPage />} />
                    <Route path="/groups" element={<GroupsPage />} />
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
