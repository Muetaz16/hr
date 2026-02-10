import React from 'react';
import { useAuth } from '../context/AuthContext';
import { roleThemes } from '../config/roleThemes';
import type { UserRole } from '../types';
import {
    Users,
    Calendar,
    TrendingUp,
    ArrowRight,
    FileText,
    Clock,
    CheckCircle2,
    Activity,
    Building2,
    Briefcase
} from 'lucide-react';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { timeService } from '../services/timeService';
import { departmentService, groupService } from '../services/departmentService';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;
    const [loading, setLoading] = React.useState(true);
    const [stats, setStats] = React.useState([
        { label: 'Active Employees', value: '...', icon: Users, change: 'Updating', color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Evaluations Done', value: '...', icon: CheckCircle2, change: 'Updating', color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Avg. Attendance', value: '...', icon: Clock, change: 'Updating', color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Pending Reviews', value: '...', icon: FileText, change: 'Critical', color: 'text-red-600', bg: 'bg-red-50' },
    ]);
    const [orgInfo, setOrgInfo] = React.useState({
        department: 'Loading...',
        group: 'Loading...'
    });

    React.useEffect(() => {
        fetchDashboardData();
    }, [currentUser]);

    const fetchDashboardData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const currentMonth = format(new Date(), 'yyyy-MM');

            // Fetch everything in parallel
            const [emps, depts, groups, timeRecords] = await Promise.all([
                employeeService.getAllEmployees(),
                departmentService.getAllDepartments(),
                groupService.getAllGroups(),
                timeService.getTimeRecordsByMonth(currentMonth)
            ]);

            // Filter employees based on current user scope if needed? 
            // For dashboard, let's keep global or scope-based if Admin vs Dept Head
            let scopedEmps = emps;
            if (currentUser.role === 'HEAD_DIRECTOR' && currentUser.groupId) {
                scopedEmps = emps.filter(e => e.groupId === currentUser.groupId);
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                scopedEmps = emps.filter(e => e.departmentId === currentUser.departmentId);
            }

            // Evaluations progress
            // Check how many director evaluations exist for these employees
            const evalPromises = scopedEmps.map(e => evaluationService.getDirectorEvaluation(e.id, currentMonth));
            const evals = await Promise.all(evalPromises);
            const finishedEvals = evals.filter(ev => ev !== null).length;
            const evalPercent = scopedEmps.length > 0 ? Math.round((finishedEvals / scopedEmps.length) * 100) : 0;

            // Attendance average
            const attendanceSum = timeRecords.reduce((acc, r) => {
                const total = r.workedHours + r.overtime;
                const expected = r.assignedHours || 1;
                return acc + (total / expected);
            }, 0);
            const avgAttendance = timeRecords.length > 0 ? (attendanceSum / timeRecords.length * 100).toFixed(1) : '100';

            // Org info
            const myDept = depts.find(d => d.id === currentUser.departmentId)?.name || 'Personal Dashboard';
            const myGroup = groups.find(g => g.id === currentUser.groupId)?.name || 'N/A';

            setOrgInfo({ department: myDept, group: myGroup });

            setStats([
                { label: 'Active Employees', value: scopedEmps.length.toString(), icon: Users, change: 'Current', color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Evaluations Done', value: `${evalPercent}%`, icon: CheckCircle2, change: `${finishedEvals}/${scopedEmps.length}`, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Avg. Attendance', value: `${avgAttendance}%`, icon: Clock, change: 'Month', color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Pending Reviews', value: (scopedEmps.length - finishedEvals).toString(), icon: FileText, change: 'Critical', color: 'text-red-600', bg: 'bg-red-50' },
            ]);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Hero Welcome Section */}
            <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient} p-8 lg:p-12 text-white shadow-2xl shadow-indigo-500/20`}>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="max-w-xl">
                        <span className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/30">
                            Welcome Back
                        </span>
                        <h1 className="text-4xl lg:text-5xl font-outfit font-bold mb-4">
                            Hello, {currentUser?.fullName}!
                        </h1>
                        <p className="text-white/80 text-lg leading-relaxed mb-6 font-light">
                            Your dashboard has been updated with the latest activity across the company.
                            You have <span className="font-bold text-white underline underline-offset-4 decoration-2">3 pending notifications</span> requiring your attention.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold flex items-center shadow-lg hover:bg-slate-50 transition-all hover:scale-105">
                                View Tasks <ArrowRight className="ml-2 w-4 h-4" />
                            </button>
                            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 rounded-xl font-bold transition-all">
                                Download Reports
                            </button>
                        </div>
                    </div>

                    {/* Decorative App Icon for Hero */}
                    <div className="hidden lg:flex items-center justify-center">
                        <div className="w-56 h-56 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/20 relative">
                            <div className="w-40 h-40 bg-white/20 backdrop-blur-3xl rounded-full flex items-center justify-center border border-white/20 animate-pulse">
                                <Activity className="w-20 h-20 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Abstract background blobs */}
                <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-white/10 blur-3xl rounded-full"></div>
                <div className="absolute top-0 right-1/4 w-32 h-32 bg-white/10 blur-2xl rounded-full"></div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="glass-card p-6 rounded-3xl hover:shadow-2xl hover:-translate-y-1 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-colors group-hover:bg-white`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${stat.bg} ${stat.color}`}>
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-slate-500 font-medium text-sm mb-1">{stat.label}</h3>
                        <p className="text-2xl font-outfit font-bold text-slate-800 tracking-tight">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Organization Info & Recent Updates */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left side info */}
                <div className="lg:col-span-2 space-y-8">
                    <section className="glass-card rounded-3xl overflow-hidden p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-outfit font-bold text-slate-800">Organization Profile</h2>
                                <p className="text-slate-500 text-sm">Overview of your current assignment</p>
                            </div>
                            <TrendingUp className="w-5 h-5 text-slate-400" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-colors">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Department</span>
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mr-4">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{orgInfo.department}</p>
                                        <p className="text-xs text-slate-500">Global Corporate Center</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-purple-200 transition-colors">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Group Membership</span>
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mr-4">
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{orgInfo.group}</p>
                                        <p className="text-xs text-slate-500">Operation & Strategy Unit</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right side - Pending Actions */}
                <div className="space-y-8">
                    <section className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden h-full shadow-2xl">
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="mb-8">
                                <h2 className="text-xl font-outfit font-bold">Quick Actions</h2>
                                <p className="text-slate-400 text-sm">Perform high-priority tasks</p>
                            </div>

                            <div className="space-y-3 flex-1">
                                <button className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-left flex items-center group font-medium border border-white/5">
                                    <Calendar className="w-5 h-5 mr-3 text-indigo-400" />
                                    <span>Schedule Meeting</span>
                                    <ArrowRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                </button>
                                <button className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-left flex items-center group font-medium border border-white/5">
                                    <Clock className="w-5 h-5 mr-3 text-orange-400" />
                                    <span>Log Time Manually</span>
                                    <ArrowRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                </button>
                                <button className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-left flex items-center group font-medium border border-white/5">
                                    <Users className="w-5 h-5 mr-3 text-emerald-400" />
                                    <span>Employee Search</span>
                                    <ArrowRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/10">
                                <div className="flex items-center text-xs text-slate-500 uppercase tracking-widest font-bold mb-4">
                                    System Status
                                </div>
                                <div className="flex items-center">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                    <span className="text-sm font-medium text-slate-300">All systems operational</span>
                                </div>
                            </div>
                        </div>

                        {/* Decorative circle */}
                        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-white/5 blur-3xl rounded-full"></div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
