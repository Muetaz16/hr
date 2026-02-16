import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TasksPage from './pages/Tasks';
import GroupsPage from './pages/admin/Groups';
import DepartmentsPage from './pages/admin/Departments';
import EmployeesPage from './pages/admin/Employees';
import UsersPage from './pages/admin/Users';
import TimeTrackingPage from './pages/TimeTracking';
import EvaluationsPage from './pages/Evaluations';
import PayrollPage from './pages/Payroll';
import EvaluationControlPage from './pages/hr/EvaluationControl';
import HREvaluationsPage from './pages/hr/HREvaluations';

const Unauthorized = () => <div className="text-red-500 text-xl p-8">Unauthorized Access</div>;

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <AuthProvider>
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

              <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HR_MANAGER']} />}>
                <Route path="/evaluation-control" element={<EvaluationControlPage />} />
                <Route path="/hr-evaluations" element={<HREvaluationsPage />} />
                <Route path="/payroll" element={<PayrollPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/groups" element={<GroupsPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
