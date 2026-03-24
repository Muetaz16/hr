import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Users,
    LogOut,
    LayoutDashboard,
    Shield,
    Bell,
    User,
    Menu,
    ChevronRight,
    Search,
    ChevronDown,
    ClipboardCheck,
    ShieldCheck,
    Zap,
    Briefcase
} from 'lucide-react';
import { roleThemes } from '../config/roleThemes';
import type { UserRole } from '../types';
import { useQuery } from '@tanstack/react-query';
import { employeeService } from '../services/employeeService';
import { toast } from 'sonner';

interface NavItemBase {
    label: string;
    icon: any;
    roles: string[];
}

interface NavItemSingle extends NavItemBase {
    path: string;
    children?: never;
}

interface NavItemParent extends NavItemBase {
    path?: never;
    children: SubNavItem[];
}

type NavItem = NavItemSingle | NavItemParent;

interface SubNavItem {
    label: string;
    path: string;
    roles: string[];
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const MainLayout: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navGroups: NavGroup[] = [
        {
            title: t('nav_group_core', { defaultValue: 'Core' }),
            items: [
                { label: t('nav_dashboard'), path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                { label: t('nav_staff_hub', { defaultValue: 'Staff Hub' }), path: '/staff-hub', icon: Zap, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                { label: t('nav_organization', { defaultValue: 'Our Organization' }), path: '/organization', icon: Users, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
            ]
        },
        {
            title: t('nav_group_ops', { defaultValue: 'Operations' }),
            items: [
                { label: t('nav_approvals', { defaultValue: 'Manager Approvals' }), path: '/approvals', icon: Briefcase, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER'] },
            ]
        },
        {
            title: t('nav_group_hr', { defaultValue: 'HR & Personnel' }),
            items: [
                {
                    label: t('nav_hr', { defaultValue: 'HR Management' }),
                    icon: Users,
                    roles: ['SUPER_ADMIN', 'HR_MANAGER'],
                    children: [
                        { label: t('nav_employees'), path: '/employees', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
                        { label: t('nav_lifecycle_control', { defaultValue: 'Lifecycle Control' }), path: '/lifecycle-control', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
                        { label: t('nav_contract_management'), path: '/contract-management', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
                        { label: t('nav_payroll'), path: '/payroll', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
                        { label: t('nav_time_tracking'), path: '/time-tracking', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
                    ]
                }
            ]
        },
        {
            title: t('nav_group_evaluations', { defaultValue: 'Evaluations' }),
            items: [
                {
                    label: t('nav_evaluations'),
                    icon: ClipboardCheck,
                    roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL', 'HR_MANAGER'],
                    children: [
                        { label: t('nav_my_evaluations', { defaultValue: 'Performance Reviews' }), path: '/evaluations', roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL'] },
                        { label: t('nav_hr_evaluations'), path: '/hr-evaluations', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
                        { label: t('nav_evaluation_control'), path: '/evaluation-control', roles: ['SUPER_ADMIN', 'HR_MANAGER'] },
                    ]
                }
            ]
        },
        {
            title: t('nav_group_admin', { defaultValue: 'Administration' }),
            items: [
                {
                    label: t('nav_system_admin', { defaultValue: 'System' }),
                    icon: ShieldCheck,
                    roles: ['SUPER_ADMIN'],
                    children: [
                        { label: t('nav_departments'), path: '/departments', roles: ['SUPER_ADMIN'] },
                        { label: t('nav_units', { defaultValue: 'Units' }), path: '/units', roles: ['SUPER_ADMIN'] },
                        { label: t('nav_groups'), path: '/groups', roles: ['SUPER_ADMIN'] },
                        { label: t('nav_users'), path: '/users', roles: ['SUPER_ADMIN'] },
                    ]
                }
            ]
        }
    ];

    const toggleSubMenu = (label: string) => {
        if (!isSidebarOpen) setIsSidebarOpen(true);
        setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    const { data: expiringCount } = useQuery({
        queryKey: ['expiring-contracts-count', currentUser?.id],
        queryFn: async () => {
            if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER' || currentUser?.role === 'PERSONNEL') {
                const data = await employeeService.getExpiringContracts(30);
                return data.length;
            }
            return 0;
        },
        enabled: !!currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL'),
        refetchInterval: 300000
    });

    useEffect(() => {
        const checkUrgentContracts = async () => {
            if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'HR_MANAGER' || currentUser?.role === 'PERSONNEL') {
                try {
                    const expiringurgent = await employeeService.getExpiringContracts(7);
                    if (expiringurgent.length > 0) {
                        toast.error(`${t('urgent_contracts_alert')}: ${expiringurgent.length}`, {
                            duration: 8000,
                            id: 'urgent-contracts-toast'
                        });
                    }
                } catch (err) {
                    console.error("Failed to check urgent contracts", err);
                }
            }
        };
        if (currentUser) {
            checkUrgentContracts();
        }
    }, [currentUser, t]);

    // Determine current section title for header breadcrumb
    const findActiveItem = () => {
        for (const group of navGroups) {
            for (const item of group.items) {
                if ('path' in item && item.path === location.pathname) return { label: item.label };
                if ('children' in item && item.children) {
                    const child = item.children.find(c => c.path === location.pathname);
                    if (child) return { label: child.label, parent: item.label };
                }
            }
        }
        return { label: t('nav_dashboard') };
    };

    const activeInfo = findActiveItem();

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-inter">
            {/* Desktop Sidebar */}
            <aside
                className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-30 shadow-2xl shadow-slate-200/40 relative
                    ${isSidebarOpen ? 'w-64' : 'w-20'}`}
            >
                {/* Logo Section */}
                <div className="h-22 flex items-center px-6 border-b border-slate-100 justify-center">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3 animate-in fade-in duration-500">
                            <img src="/logo.png" alt="IPH SYSTEM Logo" className="h-10 object-contain" />
                            <div className="h-8 w-[1px] bg-slate-200"></div>
                            <span className="font-outfit font-black text-xl tracking-tighter text-slate-800 uppercase">IPH <span className="text-primary-500">SYSTEM</span></span>
                        </div>
                    ) : (
                        <div className={`p-2 rounded-2xl bg-gradient-to-br ${theme.gradient} shadow-lg shadow-purple-500/20 shrink-0`}>
                            <Shield className="w-7 h-7 text-white" />
                        </div>
                    )}
                </div>

                {/* Nav groups */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scroll-smooth no-scrollbar">
                    {navGroups.map((group, gIdx) => {
                        const visibleItems = group.items.filter(item =>
                            currentUser && (
                                ('path' in item && item.roles.includes(currentUser.role)) ||
                                ('children' in item && item.children && item.children.some(c => c.roles.includes(currentUser.role)))
                            )
                        );

                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={gIdx} className="space-y-2">
                                {isSidebarOpen && (
                                    <h3 className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 opacity-0 animate-[slideIn_0.5s_ease-out_forwards]" style={{ animationDelay: `${gIdx * 100}ms` }}>
                                        {group.title}
                                    </h3>
                                )}
                                <div className="space-y-1">
                                    {visibleItems.map((item, iIdx) => {
                                        const hasChildren = 'children' in item;
                                        const children = 'children' in item ? (item.children || []) : [];
                                        const isChildActive = children.some(c => c.path === location.pathname);
                                        const isActive = ('path' in item && item.path === location.pathname) || isChildActive;
                                        const isOpen = openSubMenus[item.label] || isChildActive;

                                        return (
                                            <div key={iIdx} className="space-y-1">
                                                {('path' in item) ? (
                                                    <Link
                                                        to={item.path!}
                                                        className={`group flex items-center px-4 py-3.5 rounded-2xl transition-all duration-300 relative
                                                            ${isActive
                                                                ? 'bg-primary-50 text-slate-900'
                                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                                                    >
                                                        <div className={`p-2 rounded-xl transition-all duration-300
                                                            ${isActive ? `bg-white text-primary-600 shadow-sm border border-primary-100` : 'bg-transparent group-hover:bg-white group-hover:shadow-sm'}`}>
                                                            <item.icon className="w-5 h-5" />
                                                        </div>
                                                        {isSidebarOpen && (
                                                            <div className="flex-1 flex items-center justify-between ml-3 overflow-hidden">
                                                                <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>
                                                                {item.path === '/contract-management' && (expiringCount || 0) > 0 && (
                                                                    <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg shadow-sm animate-pulse ml-2">
                                                                        {expiringCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {isActive && (
                                                            <div className="absolute right-0 w-1 h-6 bg-primary-600 rounded-l-full" />
                                                        )}
                                                    </Link>
                                                ) : (
                                                    <button
                                                        onClick={() => toggleSubMenu(item.label)}
                                                        className={`w-full group flex items-center px-4 py-3.5 rounded-2xl transition-all duration-300 relative
                                                            ${isActive
                                                                ? 'bg-slate-50 text-slate-900'
                                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                                                    >
                                                        <div className={`p-2 rounded-xl transition-all duration-300
                                                            ${isActive ? `bg-white text-slate-800 shadow-sm border border-slate-200` : 'bg-transparent group-hover:bg-white group-hover:shadow-sm'}`}>
                                                            <item.icon className="w-5 h-5" />
                                                        </div>
                                                        {isSidebarOpen && (
                                                            <div className="flex-1 flex items-center justify-between ml-3 overflow-hidden">
                                                                <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>
                                                                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                                                            </div>
                                                        )}
                                                    </button>
                                                )}

                                                {/* Sub-menu block */}
                                                {hasChildren && isSidebarOpen && (
                                                    <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-64 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                                        <div className="ml-10 space-y-1 relative before:absolute before:left-[-1.25rem] before:top-0 before:bottom-4 before:w-[2px] before:bg-slate-100 before:rounded-full">
                                                            {children?.filter(c => currentUser && c.roles.includes(currentUser.role)).map((child, cIdx) => (
                                                                <Link
                                                                    key={cIdx}
                                                                    to={child.path}
                                                                    className={`flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 relative
                                                                        ${location.pathname === child.path
                                                                            ? 'bg-white text-primary-600 shadow-sm border border-primary-50 translate-x-1'
                                                                            : 'text-slate-500 hover:bg-white hover:text-slate-700 hover:translate-x-1'}`}
                                                                >
                                                                    {location.pathname === child.path && (
                                                                        <div className="absolute left-[-1.35rem] w-1.5 h-1.5 rounded-full bg-primary-600 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                                                                    )}
                                                                    {child.label}
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Bottom section (Toggle/Logout) */}
                <div className="p-4 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/30">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="w-full h-12 flex items-center justify-center rounded-2xl bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all shadow-sm border border-slate-200/50"
                    >
                        {isSidebarOpen ? <Menu className="w-5 h-5 rotate-180" /> : <ChevronRight className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full h-12 flex items-center justify-center rounded-2xl bg-white hover:bg-red-50 text-red-500 transition-all shadow-sm border border-red-100 group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        {isSidebarOpen && <span className="ml-3 font-bold text-sm tracking-tight">{t('logout')}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Top Header */}
                <header className="h-22 bg-white/80 backdrop-blur-3xl border-b border-slate-200/60 z-20 px-10 flex items-center justify-between sticky top-0">
                    <div className="flex items-center gap-6">
                        <div className="lg:flex flex-col">
                            <h2 className="text-xl font-outfit font-black text-slate-800 tracking-tight leading-none mb-1">
                                {activeInfo.label}
                            </h2>
                            <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                                <span>{t('main')}</span>
                                {activeInfo.parent && (
                                    <>
                                        <ChevronRight className="w-3 h-3 mx-1 mt-[-1px]" />
                                        <span>{activeInfo.parent}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <LanguageSwitcher />

                        {/* Search Bar */}
                        <div className="relative hidden xl:block">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder={t('search_placeholder')}
                                className="block w-72 pl-11 pr-4 py-2.5 bg-slate-100 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:bg-white transition-all duration-300"
                            />
                        </div>

                        {/* Notifications */}
                        <button
                            onClick={() => navigate('/tasks')}
                            className="relative p-2.5 rounded-2xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600 active:scale-90"
                        >
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                        </button>

                        <div className="h-10 w-[1px] bg-slate-200"></div>

                        {/* User Profile */}
                        <div className="flex items-center gap-4 group cursor-pointer active:scale-95 transition-all">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-black text-slate-800 leading-none mb-1.5">{currentUser?.fullName}</p>
                                <div className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${theme.badge} border border-current opacity-80 backdrop-blur-sm`}>
                                    {theme.text}
                                </div>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-[2px] shadow-lg group-hover:rotate-6 transition-all duration-500`}>
                                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center shadow-inner">
                                    <User className="w-6 h-6" style={{ color: theme.primary }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Container */}
                <main className="flex-1 overflow-y-auto p-10 relative scroll-smooth bg-[#f8fafc]">
                    {/* Background Soft Blobs */}
                    <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary-100/10 blur-[120px] rounded-full pointer-events-none -mr-48 -mt-48 transition-colors duration-1000"></div>
                    <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-purple-100/10 blur-[120px] rounded-full pointer-events-none -ml-48 -mb-48 transition-colors duration-1000"></div>

                    {/* Content wrapper */}
                    <div className="relative z-10 page-enter min-h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;


