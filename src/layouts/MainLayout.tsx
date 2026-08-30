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
    Briefcase,
    UserPlus,
    Sun,
    Moon,
    Key,
    Eye,
    EyeOff,
    Megaphone,
    HeartHandshake,
    Clock,
    PenTool,
    AlertTriangle,
    UserMinus
} from 'lucide-react';
import { roleThemes } from '../config/roleThemes';
import { canAccess } from '../utils/access';
import type { UserRole } from '../types';
import { useQuery } from '@tanstack/react-query';
import { employeeService } from '../services/employeeService';
import { notificationService } from '../services/notificationService';
import type { AppNotification } from '../services/notificationService';
import api from '../services/apiClient';
import { toast } from 'sonner';
import Modal from '../components/Modal';
import SignaturePad from '../components/SignaturePad';

interface NavItemBase {
    label: string;
    icon: any;
    roles: string[];
    permissions?: string[];
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
    permissions?: string[];
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const MainLayout: React.FC = () => {
    const { currentUser, logout, updateCurrentUser } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});

    // Notifications
    const [notifOpen, setNotifOpen] = useState(false);
    const { data: notifData, refetch: refetchNotifs } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationService.getMine(),
        refetchInterval: 60000,
    });
    const notifications = notifData?.notifications || [];
    const unreadCount = notifData?.unread || 0;

    const handleNotifClick = async (n: AppNotification) => {
        if (!n.isRead) { await notificationService.markRead(n.id).catch(() => {}); refetchNotifs(); }
        setNotifOpen(false);
        if (n.link) navigate(n.link);
    };
    const handleMarkAllRead = async () => { await notificationService.markAllRead().catch(() => {}); refetchNotifs(); };

    // Compact relative timestamp for the notification list (just now / 5m / 3h / 2d / date).
    const timeAgo = (dateStr: string) => {
        const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return t('just_now', { defaultValue: 'just now' });
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d`;
        return new Date(dateStr).toLocaleDateString();
    };

    // Profile Dropdown & Password Modal State
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);
    // Global search (command palette): jump to accessible pages + employee lookup.
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchIdx, setSearchIdx] = useState(0);
    const [searchEmployees, setSearchEmployees] = useState<Array<{ id: string; fullName: string; staffId?: string }>>([]);

    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('iph-theme');
        return (saved as 'light' | 'dark') || 'dark';
    });

    useEffect(() => {
        if (themeMode === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        localStorage.setItem('iph-theme', themeMode);
    }, [themeMode]);

    const toggleTheme = () => {
        setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error(t('passwords_do_not_match', { defaultValue: 'Passwords do not match!' }));
            return;
        }
        if (newPassword.length < 6) {
            toast.error(t('password_too_short', { defaultValue: 'Password must be at least 6 characters.' }));
            return;
        }

        if (!currentUser?.id) return;

        setIsChangingPassword(true);
        try {
            await api.post('/auth/change-password', { newPassword });
            toast.success(t('password_changed_success', { defaultValue: 'Password updated successfully!' }));
            setIsPasswordModalOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error("Error changing password:", error);
            const msg = error.response?.data?.error || t('error_changing_password', { defaultValue: 'Failed to change password.' });
            toast.error(msg);
        } finally {
            setIsChangingPassword(false);
        }
    };

    // Every user can view & manage their own signature.
    const canManageSignature = !!currentUser;

    const handleSaveSignature = async (dataUrl: string | null) => {
        setIsSavingSignature(true);
        try {
            const res = await api.post('/auth/signature', { signature: dataUrl });
            updateCurrentUser({ signature: res.data?.signature ?? dataUrl ?? null });
            toast.success(dataUrl
                ? t('signature_saved_success', { defaultValue: 'Signature saved successfully!' })
                : t('signature_removed_success', { defaultValue: 'Signature removed.' }));
            setIsSignatureModalOpen(false);
        } catch (error: any) {
            console.error('Error saving signature:', error);
            const msg = error.response?.data?.error || t('error_saving_signature', { defaultValue: 'Failed to save signature.' });
            toast.error(msg);
        } finally {
            setIsSavingSignature(false);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.profile-dropdown-container')) {
                setIsProfileDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navGroups: NavGroup[] = [
        {
            title: t('nav_group_core', { defaultValue: 'Core' }),
            items: [
                { label: t('nav_dashboard'), path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                { label: t('nav_staff_hub', { defaultValue: 'Staff Hub' }), path: '/staff-hub', icon: Zap, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                { label: t('nav_report_incident', { defaultValue: 'Report an Incident' }), path: '/report-incident', icon: AlertTriangle, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                { label: t('nav_resignation_request', { defaultValue: 'Resignation Request' }), path: '/resignation-request', icon: UserMinus, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                { label: t('nav_my_attendance', { defaultValue: 'My Attendance' }), path: '/my-attendance', icon: Clock, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                { label: t('nav_my_evaluation_results', { defaultValue: 'My Evaluation' }), path: '/my-evaluation', icon: ClipboardCheck, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'PERSONNEL', 'GENERAL_MANAGER', 'CHAIRMAN', 'EMPLOYEE'] },
                { label: t('notice_board', { defaultValue: 'Announcements' }), path: '/announcements', icon: Megaphone, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
                {
                    label: t('nav_recruitment', { defaultValue: 'Recruitment' }),
                    icon: UserPlus,
                    roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HR_MANAGER', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT', 'GENERAL_MANAGER'],
                    children: [
                        { label: t('nav_req_hiring_jd', { defaultValue: 'Request Hiring & JD' }), path: '/recruitment/requests', roles: ['SUPER_ADMIN', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'HEAD_DIRECTOR', 'GENERAL_MANAGER'], permissions: ['view_recruitment', 'manage_recruitment'] },
                        { label: t('nav_job_descriptions', { defaultValue: 'Job Descriptions' }), path: '/job-descriptions-browse', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL', 'GENERAL_MANAGER', 'CHAIRMAN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT'], permissions: ['view_recruitment', 'manage_recruitment'] },
                        { label: t('nav_recruitment_approvals', { defaultValue: 'Approvals' }), path: '/recruitment/approvals', roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HR_MANAGER', 'GENERAL_MANAGER'], permissions: ['recruitment_approvals'] },
                        { label: t('nav_positions_to_fill', { defaultValue: 'Positions to Fill' }), path: '/recruitment/positions', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'GENERAL_MANAGER'], permissions: ['view_recruitment', 'manage_recruitment'] },
                        { label: t('nav_hiring_list', { defaultValue: 'Applicant List' }), path: '/recruitment/hiring', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT', 'GENERAL_MANAGER', 'CHAIRMAN'], permissions: ['view_recruitment', 'manage_recruitment'] },
                        { label: t('nav_interviews', { defaultValue: 'Interviews' }), path: '/recruitment/interviews', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT'], permissions: ['view_recruitment', 'manage_recruitment'] },
                        { label: t('nav_job_offers', { defaultValue: 'Job Offers' }), path: '/recruitment/offers', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT'], permissions: ['view_recruitment', 'manage_recruitment'] },
                        { label: t('nav_onboarding', { defaultValue: 'Onboarding' }), path: '/recruitment/onboarding', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_OFFICE', 'HEAD_UNIT'], permissions: ['view_recruitment', 'manage_recruitment'] },
                    ]
                },
                { label: t('nav_organization', { defaultValue: 'Our Organization' }), path: '/organization', icon: Users, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'EMPLOYEE'] },
            ]
        },
        {
            title: t('nav_group_ops', { defaultValue: 'Operations' }),
            items: [
                { label: t('nav_approvals', { defaultValue: 'Manager Approvals' }), path: '/approvals', icon: Briefcase, roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'GENERAL_MANAGER'], permissions: ['manage_leaves', 'manage_announcements', 'manager_approvals', 'approve_attendance', 'approve_gm'] },
            ]
        },
        {
            title: t('nav_group_hr', { defaultValue: 'HR & Personnel' }),
            items: [
                {
                    label: t('nav_attendance_payroll', { defaultValue: 'Attendance & Payroll' }),
                    icon: Clock,
                    roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'],
                    permissions: ['view_time_tracking', 'manage_time_tracking', 'view_payroll', 'manage_payroll'],
                    children: [
                        { label: 'Overview', path: '/attendance/overview', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_time_tracking', 'manage_time_tracking'] },
                        { label: t('nav_approved_leaves', { defaultValue: 'Approved Leaves' }), path: '/approved-leaves', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_time_tracking', 'manage_time_tracking'] },
                        { label: 'Exceptions', path: '/attendance/exceptions', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_time_tracking', 'manage_time_tracking'] },
                        { label: 'Daily Logging', path: '/attendance/daily-logging', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_time_tracking', 'manage_time_tracking'] },
                        { label: 'Employees', path: '/attendance/employees', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_time_tracking', 'manage_time_tracking'] },
                        { label: 'Settings', path: '/attendance/settings', roles: ['SUPER_ADMIN'] },
                    ]
                },
                {
                    label: 'Personnel Relations Department',
                    icon: HeartHandshake,
                    roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'PERSONNEL'],
                    permissions: ['view_personnel_relations'],
                    children: [
                        { label: 'Employee Lifecycle', path: '/personnel-relations/lifecycle', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_lifecycle'] },
                        { label: 'Contract Renewals', path: '/personnel-relations/renewals', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['manage_contract_management', 'view_lifecycle'] },
                        { label: 'Personnel Action Forms', path: '/personnel-relations/action-forms', roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_personnel_relations', 'manage_personnel_actions'] },
                        { label: 'Promotion Management', path: '/personnel-relations/promotions', roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_personnel_relations', 'manage_promotions'] },
                        { label: 'Rewards & Recognition', path: '/personnel-relations/rewards', roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_personnel_relations', 'manage_rewards'] },
                        { label: 'Disciplinary Actions', path: '/personnel-relations/disciplinary', roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_personnel_relations', 'manage_disciplinary'] },
                        { label: 'Offboarding', path: '/personnel-relations/offboarding', roles: ['SUPER_ADMIN', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_personnel_relations', 'manage_offboarding'] },
                        { label: t('nav_my_evaluations', { defaultValue: 'Performance Reviews' }), path: '/personnel-relations/evaluations', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'HEAD_DIRECTOR', 'HEAD_DIVISION', 'HEAD_DEPARTMENT', 'HEAD_UNIT', 'PERSONNEL'], permissions: ['manage_evaluation_control', 'view_evaluations'] },
                        { label: 'Employee Control', path: '/personnel-relations/employee-control', roles: ['SUPER_ADMIN', 'HR_MANAGER', 'PERSONNEL'], permissions: ['view_employees', 'manage_employees'] }
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
                        { label: t('nav_departments'), path: '/departments', roles: ['SUPER_ADMIN'], permissions: ['manage_departments'] },
                        { label: t('nav_units', { defaultValue: 'Units' }), path: '/units', roles: ['SUPER_ADMIN'], permissions: ['manage_units'] },
                        { label: t('nav_job_descriptions', { defaultValue: 'Job Descriptions' }), path: '/job-descriptions', roles: ['SUPER_ADMIN', 'HR_MANAGER'], permissions: ['manage_job_descriptions'] },
                        { label: t('nav_groups'), path: '/groups', roles: ['SUPER_ADMIN'], permissions: ['manage_groups'] },
                        { label: t('nav_users'), path: '/users', roles: ['SUPER_ADMIN'], permissions: ['manage_users'] },
                        { label: t('nav_functional_hats', { defaultValue: 'Functional Hats' }), path: '/access/hats', roles: ['SUPER_ADMIN'], permissions: ['manage_users'] },
                        { label: t('nav_system_logs', { defaultValue: 'Activity Log' }), path: '/system-logs', roles: ['SUPER_ADMIN'], permissions: ['view_logs'] },
                    ]
                }
            ]
        }
    ];

    const toggleSubMenu = (label: string) => {
        if (!isSidebarOpen) setIsSidebarOpen(true);
        setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    // --- Global search ---------------------------------------------------------------------------
    // Employee lookup is only offered to users who can actually open the Employees admin page.
    const canSearchEmployees = canAccess(currentUser, ['SUPER_ADMIN', 'HR_MANAGER'], ['view_employees', 'manage_employees']);

    // Load the roster once, the first time a permitted user opens search.
    useEffect(() => {
        if (searchOpen && canSearchEmployees && searchEmployees.length === 0) {
            employeeService.getAllEmployees()
                .then((list: any[]) => setSearchEmployees(list.map(e => ({ id: e.id, fullName: e.fullName, staffId: e.staffId }))))
                .catch(() => { /* ignore */ });
        }
    }, [searchOpen, canSearchEmployees]);

    // Accessible destinations drawn from the SAME nav config, so a result can never point at a page
    // the current user isn't allowed to open.
    const searchablePages: { label: string; path: string; group: string }[] = [];
    for (const group of navGroups) {
        for (const item of group.items) {
            if ('path' in item && item.path && canAccess(currentUser, item.roles, item.permissions)) {
                searchablePages.push({ label: item.label, path: item.path, group: group.title });
            }
            if ('children' in item && item.children) {
                for (const child of item.children) {
                    if (child.path && canAccess(currentUser, child.roles, child.permissions)) {
                        searchablePages.push({ label: child.label, path: child.path, group: item.label });
                    }
                }
            }
        }
    }

    const searchTerm = searchQuery.trim().toLowerCase();
    const pageMatches = searchTerm ? searchablePages.filter(p => p.label.toLowerCase().includes(searchTerm)).slice(0, 6) : [];
    const empMatches = (searchTerm && canSearchEmployees)
        ? searchEmployees.filter(e => (e.fullName || '').toLowerCase().includes(searchTerm) || (e.staffId || '').toLowerCase().includes(searchTerm)).slice(0, 6)
        : [];
    const searchResults: Array<{ type: 'page' | 'emp'; label: string; sub?: string; path: string }> = [
        ...pageMatches.map(p => ({ type: 'page' as const, label: p.label, sub: p.group, path: p.path })),
        ...empMatches.map(e => ({ type: 'emp' as const, label: e.fullName, sub: e.staffId, path: `/employees?q=${encodeURIComponent(e.fullName)}` })),
    ];

    const goToSearchResult = (r: { path: string }) => {
        setSearchQuery('');
        setSearchOpen(false);
        setSearchIdx(0);
        navigate(r.path);
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
        <div 
            className="flex h-screen bg-[#541c2c] overflow-hidden font-inter"
            style={{ '--sidebar-width': isSidebarOpen ? '16rem' : '5rem' } as React.CSSProperties}
        >
            {/* Desktop Sidebar */}
            <aside
                className={`flex flex-col bg-[#300a15] border-r border-[#e3c4a2]/15 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-30 shadow-2xl shadow-[#300a15]/50 relative
                    ${isSidebarOpen ? 'w-64' : 'w-20'}`}
            >
                {/* Logo Section */}
                <div className="h-22 flex items-center px-6 border-b border-[#e3c4a2]/15 justify-center">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3 animate-in fade-in duration-500">
                            <img src="/logo.png" alt="IPH SYSTEM Logo" className="h-10 object-contain" />
                            <div className="h-8 w-[1px] bg-[#e3c4a2]/20"></div>
                            <span className="font-outfit font-black text-xl tracking-tighter text-white uppercase">IPH <span className="text-primary-200">SYSTEM</span></span>
                        </div>
                    ) : (
                        <div className={`p-2 rounded-2xl bg-gradient-to-br ${theme.gradient} shadow-lg shadow-purple-500/20 shrink-0`}>
                            <Shield className="w-7 h-7 text-white" />
                        </div>
                    )}
                </div>

                {/* Nav groups */}
                <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-6 px-4 pb-10 space-y-8 scroll-smooth">
                    {navGroups.map((group, gIdx) => {
                        const visibleItems = group.items.filter(item =>
                            currentUser && (
                                ('path' in item && canAccess(currentUser, item.roles, item.permissions)) ||
                                ('children' in item && item.children && item.children.some(c => canAccess(currentUser, c.roles, c.permissions)))
                            )
                        );

                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={gIdx} className="space-y-2">
                                {isSidebarOpen && (
                                    <h3 className="px-4 text-[10px] font-black text-[#e3c4a2]/50 uppercase tracking-[0.2em] mb-4 opacity-0 animate-[slideIn_0.5s_ease-out_forwards]" style={{ animationDelay: `${gIdx * 100}ms` }}>
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
                                                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                                                : 'text-[#e3c4a2]/70 hover:bg-[#541c2c]/40 hover:text-white'}`}
                                                    >
                                                        <div className={`p-2 rounded-xl transition-all duration-300
                                                            ${isActive ? `bg-primary-600 text-primary-100` : 'bg-transparent group-hover:bg-white group-hover:shadow-sm'}`}>
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
                                                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                                                : 'text-[#e3c4a2]/70 hover:bg-[#541c2c]/40 hover:text-white'}`}
                                                    >
                                                        <div className={`p-2 rounded-xl transition-all duration-300
                                                            ${isActive ? `bg-primary-600 text-primary-100` : 'bg-transparent group-hover:bg-white group-hover:shadow-sm'}`}>
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
                                                    <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[640px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                                                        <div className="ml-10 space-y-1 relative before:absolute before:left-[-1.25rem] before:top-0 before:bottom-4 before:w-[2px] before:bg-[#e3c4a2]/15 before:rounded-full">
                                                            {children?.filter(c => canAccess(currentUser, c.roles, c.permissions)).map((child, cIdx) => (
                                                                <Link
                                                                    key={cIdx}
                                                                    to={child.path}
                                                                    className={`flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 relative
                                                                        ${location.pathname === child.path
                                                                            ? 'bg-primary-50 text-primary-500 shadow-sm border border-primary-100/50 translate-x-1'
                                                                            : 'text-[#e3c4a2]/60 hover:bg-[#541c2c]/30 hover:text-white hover:translate-x-1'}`}
                                                                >
                                                                    {location.pathname === child.path && (
                                                                        <div className="absolute left-[-1.35rem] w-1.5 h-1.5 rounded-full bg-primary-600 shadow-[0_0_8px_rgba(84,28,44,0.6)]" />
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
                <div className="p-4 border-t border-[#e3c4a2]/10 flex flex-col gap-2 bg-[#300a15]/50">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="w-full h-12 flex items-center justify-center rounded-2xl bg-[#541c2c]/40 hover:bg-[#541c2c]/75 text-[#e3c4a2]/70 hover:text-white transition-all shadow-sm border border-[#e3c4a2]/10"
                    >
                        {isSidebarOpen ? <Menu className="w-5 h-5 rotate-180" /> : <ChevronRight className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full h-12 flex items-center justify-center rounded-2xl bg-[#541c2c]/40 hover:bg-red-950/40 text-red-400 hover:text-red-300 transition-all shadow-sm border border-red-900/40 group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        {isSidebarOpen && <span className="ml-3 font-bold text-sm tracking-tight">{t('logout')}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Top Header */}
                <header className={`h-22 backdrop-blur-3xl border-b z-20 px-10 flex items-center justify-between sticky top-0 transition-all duration-300
                    ${themeMode === 'dark' 
                        ? 'bg-[#300a15]/80 border-[#e3c4a2]/15' 
                        : 'bg-white/90 border-slate-200/80 shadow-sm'}`}>
                    <div className="flex items-center gap-6">
                        <div className="lg:flex flex-col">
                            <h2 className={`text-xl font-outfit font-black tracking-tight leading-none mb-1 transition-colors duration-300
                                ${themeMode === 'dark' ? 'text-white' : 'text-[#541c2c]'}`}>
                                {activeInfo.label}
                            </h2>
                            <div className={`flex items-center text-[10px] font-bold uppercase tracking-[0.1em] transition-colors duration-300
                                ${themeMode === 'dark' ? 'text-[#e3c4a2]/60' : 'text-slate-500'}`}>
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

                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />

                        {/* Theme Toggle Button */}
                        <button
                            onClick={toggleTheme}
                            className={`p-2.5 rounded-2xl transition-all duration-300 active:scale-90 border flex items-center justify-center
                                ${themeMode === 'dark' 
                                    ? 'bg-[#541c2c]/50 text-[#e3c4a2]/70 hover:text-white border-[#e3c4a2]/15' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'}`}
                            title={themeMode === 'dark' ? 'Switch to Whiter Mode' : 'Switch to Dark Mode'}
                        >
                            {themeMode === 'dark' ? (
                                <Sun className="w-5 h-5 animate-[spin_4s_linear_infinite]" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>

                        {/* Global Search */}
                        <div className="relative hidden xl:block global-search-container">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className={`h-4 w-4 transition-colors duration-300 ${themeMode === 'dark' ? 'text-[#e3c4a2]/50' : 'text-slate-400'}`} />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                placeholder={t('search_placeholder')}
                                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); setSearchIdx(0); }}
                                onFocus={() => setSearchOpen(true)}
                                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                                onKeyDown={e => {
                                    if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx(i => Math.min(i + 1, searchResults.length - 1)); }
                                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx(i => Math.max(i - 1, 0)); }
                                    else if (e.key === 'Enter') { e.preventDefault(); if (searchResults[searchIdx]) goToSearchResult(searchResults[searchIdx]); }
                                    else if (e.key === 'Escape') { setSearchOpen(false); (e.target as HTMLInputElement).blur(); }
                                }}
                                className={`block w-72 pl-11 pr-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 border
                                    ${themeMode === 'dark'
                                        ? 'bg-[#541c2c]/50 text-white placeholder:text-[#e3c4a2]/50 border-[#e3c4a2]/10 focus:ring-2 focus:ring-primary-500/35 focus:bg-[#300a15]'
                                        : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:bg-white'}`}
                            />
                            {searchOpen && searchTerm && (
                                <div className={`absolute z-50 mt-2 w-80 max-h-96 overflow-auto rounded-2xl border shadow-2xl py-1.5
                                    ${themeMode === 'dark' ? 'bg-[#2a0f16] border-[#e3c4a2]/15' : 'bg-white border-slate-200'}`}>
                                    {searchResults.length === 0 ? (
                                        <div className={`px-4 py-3 text-sm font-medium ${themeMode === 'dark' ? 'text-[#e3c4a2]/50' : 'text-slate-400'}`}>
                                            {t('no_results', { defaultValue: 'No results' })}
                                        </div>
                                    ) : searchResults.map((r, i) => (
                                        <button
                                            key={`${r.type}-${r.path}-${i}`}
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => goToSearchResult(r)}
                                            onMouseEnter={() => setSearchIdx(i)}
                                            className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors
                                                ${i === searchIdx
                                                    ? (themeMode === 'dark' ? 'bg-[#541c2c]/60' : 'bg-slate-100')
                                                    : (themeMode === 'dark' ? 'hover:bg-[#541c2c]/40' : 'hover:bg-slate-50')}`}
                                        >
                                            {r.type === 'page'
                                                ? <Search className={`w-4 h-4 shrink-0 ${themeMode === 'dark' ? 'text-[#e3c4a2]/60' : 'text-slate-400'}`} />
                                                : <Users className={`w-4 h-4 shrink-0 ${themeMode === 'dark' ? 'text-[#e3c4a2]/60' : 'text-slate-400'}`} />}
                                            <span className="flex-1 min-w-0">
                                                <span className={`block text-sm font-bold truncate ${themeMode === 'dark' ? 'text-white' : 'text-slate-700'}`}>{r.label}</span>
                                                {r.sub && <span className={`block text-[11px] truncate ${themeMode === 'dark' ? 'text-[#e3c4a2]/40' : 'text-slate-400'}`}>{r.sub}</span>}
                                            </span>
                                            <span className={`text-[9px] uppercase font-black tracking-widest shrink-0 ${themeMode === 'dark' ? 'text-[#e3c4a2]/30' : 'text-slate-300'}`}>
                                                {r.type === 'page' ? t('page', { defaultValue: 'Page' }) : t('employee', { defaultValue: 'Employee' })}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Notifications */}
                        <div className="relative notif-dropdown-container">
                            <button
                                onClick={() => setNotifOpen(o => !o)}
                                title={t('notifications', { defaultValue: 'Notifications' })}
                                className={`relative p-2.5 rounded-2xl transition-all duration-300 active:scale-90 border flex items-center justify-center
                                    ${notifOpen
                                        ? (themeMode === 'dark' ? 'bg-[#541c2c] text-white border-[#e3c4a2]/25' : 'bg-primary-50 text-primary-700 border-primary-200')
                                        : (themeMode === 'dark'
                                            ? 'bg-[#541c2c]/50 text-[#e3c4a2]/70 hover:text-white border-[#e3c4a2]/15'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200')}`}
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-black text-white bg-red-500 border-2 shadow-[0_0_8px_rgba(239,68,68,0.5)]
                                        ${themeMode === 'dark' ? 'border-[#300a15]' : 'border-white'}`}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {notifOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                                    <div className={`absolute right-0 mt-4 w-96 max-w-[90vw] rounded-3xl shadow-2xl border z-50 animate-in slide-in-from-top-2 duration-200 overflow-hidden
                                        ${themeMode === 'dark' ? 'bg-[#300a15]/95 border-[#e3c4a2]/15' : 'bg-white border-slate-100'}`}>
                                        <div className={`flex items-center justify-between px-5 py-4 border-b ${themeMode === 'dark' ? 'border-[#e3c4a2]/10' : 'border-slate-100'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-black ${themeMode === 'dark' ? 'text-white' : 'text-slate-800'}`}>{t('notifications', { defaultValue: 'Notifications' })}</span>
                                                {unreadCount > 0 && (
                                                    <span className="min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black">
                                                        {unreadCount > 9 ? '9+' : unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            {unreadCount > 0 && (
                                                <button onClick={handleMarkAllRead} className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest">
                                                    {t('mark_all_read', { defaultValue: 'Mark all read' })}
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-96 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="px-4 py-12 flex flex-col items-center justify-center gap-3 text-center">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${themeMode === 'dark' ? 'bg-[#541c2c]/40 text-[#e3c4a2]/50' : 'bg-slate-100 text-slate-300'}`}>
                                                        <Bell className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">{t('no_notifications', { defaultValue: 'No notifications yet.' })}</span>
                                                </div>
                                            ) : notifications.map(n => (
                                                <button key={n.id} onClick={() => handleNotifClick(n)}
                                                    className={`w-full text-left px-4 py-3.5 border-b transition-colors flex gap-3 items-start group/notif
                                                        ${themeMode === 'dark' ? 'border-[#e3c4a2]/5 hover:bg-[#541c2c]/40' : 'border-slate-50 hover:bg-slate-50'}
                                                        ${!n.isRead ? (themeMode === 'dark' ? 'bg-[#541c2c]/20' : 'bg-indigo-50/40') : ''}`}>
                                                    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                                                        ${!n.isRead
                                                            ? 'bg-indigo-500/15 text-indigo-500'
                                                            : (themeMode === 'dark' ? 'bg-[#541c2c]/40 text-[#e3c4a2]/50' : 'bg-slate-100 text-slate-400')}`}>
                                                        <Bell className="w-4 h-4" />
                                                        {!n.isRead && <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 ${themeMode === 'dark' ? 'border-[#300a15]' : 'border-white'}`} />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-xs font-black truncate ${themeMode === 'dark' ? 'text-white' : 'text-slate-800'}`}>{n.title}</p>
                                                        <p className={`text-[11px] font-medium line-clamp-2 ${themeMode === 'dark' ? 'text-[#e3c4a2]/70' : 'text-slate-500'}`}>{n.content}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{timeAgo(n.createdAt)}</p>
                                                    </div>
                                                    {n.link && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1 opacity-0 group-hover/notif:opacity-100 transition-opacity" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className={`h-10 w-[1px] transition-colors duration-300 ${themeMode === 'dark' ? 'bg-[#e3c4a2]/20' : 'bg-slate-200'}`}></div>

                        {/* User Profile Container */}
                        <div className="relative profile-dropdown-container">
                            <div 
                                className="flex items-center gap-4 group cursor-pointer active:scale-95 transition-all"
                                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                            >
                                <div className="text-right hidden sm:block">
                                    <p className={`text-sm font-black leading-none mb-1.5 transition-colors duration-300
                                        ${themeMode === 'dark' ? 'text-white' : 'text-slate-800'}`}>{currentUser?.fullName}</p>
                                    <div className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary-500/20 border opacity-90 backdrop-blur-sm transition-all duration-300
                                        ${themeMode === 'dark' ? 'text-[#e3c4a2] border-[#e3c4a2]/25' : 'text-primary-700 border-primary-200'}`}>
                                        {theme.text}
                                    </div>
                                </div>
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-[2px] shadow-lg group-hover:rotate-6 transition-all duration-500`}>
                                    <div className={`w-full h-full rounded-[14px] flex items-center justify-center shadow-inner animate-[fadeIn_0.5s_ease-out] transition-colors duration-300
                                        ${themeMode === 'dark' ? 'bg-[#300a15]' : 'bg-white'}`}>
                                        <User className="w-6 h-6" style={{ color: themeMode === 'dark' ? theme.secondary : '#541c2c' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Dropdown Menu */}
                            {isProfileDropdownOpen && (
                                <div className={`absolute right-0 mt-4 w-56 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-2 duration-200 z-50
                                    ${themeMode === 'dark' 
                                        ? 'bg-[#300a15]/95 border-[#e3c4a2]/15 shadow-[#300a15]/50' 
                                        : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
                                    <div className="p-2 space-y-1">
                                        <button 
                                            onClick={() => {
                                                setIsProfileDropdownOpen(false);
                                                setIsPasswordModalOpen(true);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors
                                                ${themeMode === 'dark'
                                                    ? 'text-[#e3c4a2]/80 hover:bg-[#541c2c]/40 hover:text-white'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                                        >
                                            <Key className="w-4 h-4" />
                                            {t('change_password', { defaultValue: 'Change Password' })}
                                        </button>
                                        {canManageSignature && (
                                            <button
                                                onClick={() => {
                                                    setIsProfileDropdownOpen(false);
                                                    setIsSignatureModalOpen(true);
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors
                                                    ${themeMode === 'dark'
                                                        ? 'text-[#e3c4a2]/80 hover:bg-[#541c2c]/40 hover:text-white'
                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                                            >
                                                <PenTool className="w-4 h-4" />
                                                {t('my_signature', { defaultValue: 'My Signature' })}
                                            </button>
                                        )}
                                        <div className={`h-px w-full my-1 ${themeMode === 'dark' ? 'bg-[#e3c4a2]/10' : 'bg-slate-100'}`}></div>
                                        <button 
                                            onClick={handleLogout}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors
                                                ${themeMode === 'dark'
                                                    ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
                                                    : 'text-red-500 hover:bg-red-50 hover:text-red-600'}`}
                                        >
                                            <LogOut className="w-4 h-4" />
                                            {t('logout', { defaultValue: 'Logout' })}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content Container */}
                <main id="main-scroll-container" className={`flex-1 overflow-y-auto p-10 relative scroll-smooth transition-colors duration-500
                    ${themeMode === 'dark' ? 'bg-[#541c2c]' : 'bg-[#faf8f6]'}`}>
                    {/* Background Soft Blobs */}
                    <div className={`fixed top-0 right-0 w-[500px] h-[500px] blur-[120px] rounded-full pointer-events-none -mr-48 -mt-48 transition-colors duration-1000
                        ${themeMode === 'dark' ? 'bg-[#e3c4a2]/5' : 'bg-[#aa7a51]/3'}`}></div>
                    <div className={`fixed bottom-0 left-0 w-[500px] h-[500px] blur-[120px] rounded-full pointer-events-none -ml-48 -mb-48 transition-colors duration-1000
                        ${themeMode === 'dark' ? 'bg-[#aa7a51]/5' : 'bg-[#e3c4a2]/3'}`}></div>

                    {/* Content wrapper */}
                    <div className="relative z-10 page-enter min-h-full">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Change Password Modal */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                title={t('change_password', { defaultValue: 'Change Password' })}
            >
                <form onSubmit={handleChangePassword} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                {t('new_password', { defaultValue: 'New Password' })}
                            </label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type={showPasswords ? "text" : "password"}
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    placeholder={t('enter_new_password', { defaultValue: 'Enter new password' })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                {t('confirm_password', { defaultValue: 'Confirm Password' })}
                            </label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type={showPasswords ? "text" : "password"}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    placeholder={t('confirm_new_password', { defaultValue: 'Confirm new password' })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsPasswordModalOpen(false)}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isChangingPassword && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {t('save_password', { defaultValue: 'Save Password' })}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* My Signature Modal */}
            <Modal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                title={t('my_signature', { defaultValue: 'My Signature' })}
            >
                <SignaturePad
                    initialValue={currentUser?.signature ?? null}
                    onSave={handleSaveSignature}
                    onCancel={() => setIsSignatureModalOpen(false)}
                    saving={isSavingSignature}
                />
            </Modal>
        </div>
    );
};

export default MainLayout;


