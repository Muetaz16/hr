import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import {
    Users,
    Clock,
    FileText,
    LogOut,
    LayoutDashboard,
    Building2,
    Briefcase,
    DollarSign,
    Settings,
    Shield,
    Bell,
    User,
    Menu,
    X,
    ChevronRight,
    Search
} from 'lucide-react';
import { roleThemes } from '../config/roleThemes';
import type { UserRole } from '../types';

const MainLayout: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const navItems = [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HR_MANAGER', 'EMPLOYEE'] },
        { label: 'Employees', path: '/employees', icon: Users, roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT'] },
        { label: 'Time Tracking', path: '/time-tracking', icon: Clock, roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT'] },
        { label: 'Evaluations', path: '/evaluations', icon: FileText, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT'] },
        { label: 'HR Evaluations', path: '/hr-evaluations', icon: Settings, roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
        { label: 'Evaluation Control', path: '/evaluation-control', icon: Settings, roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
        { label: 'Departments', path: '/departments', icon: Building2, roles: ['SUPER_ADMIN'] },
        { label: 'Groups', path: '/groups', icon: Briefcase, roles: ['SUPER_ADMIN'] },
        { label: 'Users', path: '/users', icon: Users, roles: ['SUPER_ADMIN'] },
        { label: 'Payroll', path: '/payroll', icon: DollarSign, roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
    ];

    const filteredNavItems = navItems.filter(item =>
        currentUser && item.roles.includes(currentUser.role)
    );

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;
    const activeItem = navItems.find(item => item.path === location.pathname) || navItems[0];

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-inter">
            {/* Desktop Sidebar */}
            <aside
                className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out z-30 shadow-sm
                    ${isSidebarOpen ? 'w-72' : 'w-20'}`}
            >
                {/* Logo Section */}
                <div className="h-20 flex items-center px-6 border-b border-slate-100">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.gradient} shadow-lg shadow-purple-500/20 mr-3 shrink-0 uppercase`}>
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    {isSidebarOpen && (
                        <span className="font-outfit font-bold text-xl tracking-tight text-slate-800">
                            IPH <span className="text-slate-400">HR</span>
                        </span>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scroll-smooth">
                    {filteredNavItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`group flex items-center px-3 py-3 rounded-xl transition-all duration-200 relative
                                    ${isActive
                                        ? 'bg-slate-50 text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                            >
                                <div className={`relative z-10 p-2 rounded-lg transition-colors
                                    ${isActive ? `bg-white text-[${theme.primary}] shadow-sm` : 'bg-transparent group-hover:bg-white'}`}>
                                    <item.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110
                                        ${isActive ? '' : 'stroke-[1.5]'}`}
                                        style={isActive ? { color: theme.primary } : {}}
                                    />
                                </div>

                                {isSidebarOpen && (
                                    <span className={`ml-3 font-medium transition-all duration-200 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                        {item.label}
                                    </span>
                                )}

                                {isActive && (
                                    <div className="absolute left-0 w-1 h-6 rounded-r-full" style={{ backgroundColor: theme.primary }} />
                                )}

                                {!isSidebarOpen && isActive && (
                                    <div className="absolute -right-3 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom section (Toggle/Logout) */}
                <div className="p-4 border-t border-slate-100 space-y-2">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="w-full h-12 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        {isSidebarOpen ? <Menu className="w-5 h-5rotate-180" /> : <ChevronRight className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full h-12 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        {isSidebarOpen && <span className="ml-3 font-semibold">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Top Header */}
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 z-20 px-8 flex items-center justify-between sticky top-0">
                    <div className="flex items-center">
                        <div className="hidden lg:flex items-center text-sm font-medium text-slate-400 space-x-2">
                            <span>Main</span>
                            <ChevronRight className="w-4 h-4" />
                            <span className="text-slate-800 font-semibold">{activeItem.label}</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-6">
                        {/* Search Bar Placeholder */}
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Global search..."
                                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:ring-2 focus:ring-slate-200 transition-all w-64"
                            />
                        </div>

                        {/* Notifications */}
                        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>

                        <div className="h-8 w-[1px] bg-slate-200"></div>

                        {/* User Profile Info - AT THE TOP as requested */}
                        <div className="flex items-center space-x-4 pl-2 group cursor-pointer">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-800 leading-none mb-1 group-hover:text-slate-900 transition-colors">{currentUser?.fullName}</p>
                                <div className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${theme.badge} border border-current opacity-70`}>
                                    {theme.text}
                                </div>
                            </div>
                            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-[2px] shadow-md group-hover:scale-105 transition-transform`}>
                                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                                    <User className="w-5 h-5" style={{ color: theme.primary }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Container */}
                <main className="flex-1 overflow-y-auto p-8 lg:p-10 relative scroll-smooth bg-[#f8fafc]">
                    {/* Background Decorative Elements */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-slate-200/20 blur-[100px] rounded-full pointer-events-none -mr-48 -mt-48"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/20 blur-[100px] rounded-full pointer-events-none -ml-48 -mb-48"></div>

                    {/* Content wrapper with fade-in animation */}
                    <div className="relative z-10 page-enter">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
