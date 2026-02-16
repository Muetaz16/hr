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
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
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

            // Total Overtime
            const totalOvertime = timeRecords.reduce((acc, r) => acc + (r.overtime || 0), 0);

            // Org info
            let myDept = depts.find(d => d.id === currentUser.departmentId)?.name || 'Personal Dashboard';
            let myGroup = groups.find(g => g.id === currentUser.groupId)?.name || 'N/A';

            if (currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL') {
                myGroup = 'Human Resources IPH';
                myDept = 'Corporate Administration';
            } else if (currentUser.role === 'SUPER_ADMIN') {
                myGroup = 'Executive Board';
                myDept = 'System Administration';
            }

            setOrgInfo({ department: myDept, group: myGroup });

            // Pending Reviews Calculation
            let pendingCount = 0;
            if (currentUser.role === 'HEAD_DIRECTOR' || currentUser.role === 'SUPER_ADMIN') {
                // Pending if Director Eval is missing or unlocked
                // actually we fetched evals above.
                // finishedEvals = locked Director Evals.
                pendingCount = scopedEmps.length - finishedEvals;
            } else if (currentUser.role === 'HEAD_DEPARTMENT') {
                // Pending if Dept Eval is missing
                const deptEvalPromises = scopedEmps.map(e => evaluationService.getDeptEvaluation(e.id, currentMonth));
                const deptEvals = await Promise.all(deptEvalPromises);
                const finishedDeptEvals = deptEvals.filter(ev => ev !== null).length;
                pendingCount = scopedEmps.length - finishedDeptEvals;
            } else if (currentUser.role === 'PERSONNEL') {
                const persEvalPromises = scopedEmps.map(e => evaluationService.getPersonnelEvaluation(e.id, currentMonth));
                const persEvals = await Promise.all(persEvalPromises);
                const finishedPersEvals = persEvals.filter(ev => ev !== null).length;
                pendingCount = scopedEmps.length - finishedPersEvals;
            }

            setStats([
                { label: 'Active Employees', value: scopedEmps.length.toString(), icon: Users, change: 'Current', color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Evaluations Done', value: `${evalPercent}%`, icon: CheckCircle2, change: `${finishedEvals}/${scopedEmps.length}`, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Total Overtime', value: `${totalOvertime.toFixed(1)}h`, icon: Clock, change: 'This Month', color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Pending Reviews', value: pendingCount.toString(), icon: FileText, change: 'Critical', color: 'text-red-600', bg: 'bg-red-50' },
            ]);

            // Update hero text
            const heroTextElement = document.getElementById('dashboard-hero-text');
            if (heroTextElement) {
                // React way: state. But let's use the stats state.
            }

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    const pendingReviewCount = stats[3].value;

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Hero Welcome Section */}
            <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient} p-8 lg:p-12 text-white shadow-2xl shadow-indigo-500/30 group`}>
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm opacity-0 group-hover:opacity-10 transition-opacity duration-700"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="max-w-xl">
                        <span className="inline-flex items-center px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest mb-6 border border-white/20 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
                            Welcome Back
                        </span>
                        <h1 className="text-4xl lg:text-5xl font-outfit font-bold mb-4 tracking-tight drop-shadow-sm">
                            Hello, {currentUser?.fullName}!
                        </h1>
                        <p className="text-white/90 text-lg leading-relaxed mb-8 font-light max-w-lg">
                            Your dashboard has been updated with the latest activity.
                            You have <span onClick={() => navigate('/tasks')} className="font-bold text-white underline underline-offset-4 decoration-2 cursor-pointer hover:text-indigo-100 transition-colors">{pendingReviewCount !== '...' ? pendingReviewCount : '0'} pending notifications</span> requiring attention.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => navigate('/tasks')}
                                className="px-6 py-3.5 bg-white text-slate-900 rounded-xl font-bold flex items-center shadow-lg hover:bg-slate-50 transition-all hover:scale-105 active:scale-95"
                            >
                                View Tasks <ArrowRight className="ml-2 w-4 h-4" />
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        const blob = await import('../services/payrollService').then(m => m.payrollService.generateSixMonthExcel(format(new Date(), 'yyyy-MM')));
                                        const link = document.createElement('a');
                                        link.href = URL.createObjectURL(blob);
                                        link.download = `Evaluation_Report_6Months_${format(new Date(), 'yyyy-MM')}.xlsx`;
                                        link.click();
                                    } catch (e) {
                                        console.error(e);
                                        alert("Failed to download report");
                                    }
                                }}
                                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95"
                            >
                                Download Reports
                            </button>
                        </div>
                    </div>

                    {/* Decorative App Icon for Hero */}
                    <div className="hidden lg:flex items-center justify-center">
                        <div className="w-64 h-64 bg-white/5 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/10 relative shadow-2xl shadow-black/20">
                            <div className="absolute inset-0 rounded-full border border-white/20 animate-[spin_10s_linear_infinite]"></div>
                            <div className="w-48 h-48 bg-gradient-to-br from-white/20 to-transparent backdrop-blur-3xl rounded-full flex items-center justify-center border border-white/20 shadow-inner">
                                <Activity className="w-24 h-24 text-white drop-shadow-md" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Abstract background blobs */}
                <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-white/10 blur-3xl rounded-full mix-blend-overlay"></div>
                <div className="absolute top-0 right-1/3 w-64 h-64 bg-white/10 blur-[100px] rounded-full mix-blend-overlay"></div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <div
                        key={idx}
                        className="glass-card p-6 rounded-3xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group opacity-0 animate-[slideIn_0.5s_ease-out_forwards]"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3.5 rounded-2xl ${stat.bg} ${stat.color} transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${stat.bg} ${stat.color} border border-white/20 uppercase tracking-wider`}>
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-slate-400 font-semibold text-xs uppercase tracking-wider mb-2">{stat.label}</h3>
                        <p className="text-3xl font-outfit font-bold text-slate-800 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-slate-800 group-hover:to-slate-600 transition-all">
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Organization Info & Recent Updates */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left side info */}
                <div className="lg:col-span-2 space-y-8">
                    <section className="glass-card rounded-3xl overflow-hidden p-8 relative group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-blue-50/50 transition-colors duration-700"></div>

                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div>
                                <h2 className="text-xl font-outfit font-bold text-slate-800">Organization Profile</h2>
                                <p className="text-slate-500 text-sm">Overview of your current assignment</p>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-xl">
                                <TrendingUp className="w-5 h-5 text-slate-400" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            <div className="p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Department</span>
                                <div className="flex items-center">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mr-4 shadow-lg shadow-blue-500/20">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-lg">{orgInfo.department}</p>
                                        <p className="text-xs text-slate-500 font-medium">Global Corporate Center</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Group Membership</span>
                                <div className="flex items-center">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center mr-4 shadow-lg shadow-purple-500/20">
                                        <Briefcase className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-lg">{orgInfo.group}</p>
                                        <p className="text-xs text-slate-500 font-medium">Operation & Strategy Unit</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right side - Pending Actions */}
                <div className="space-y-8">
                    <section className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-8 text-white relative overflow-hidden h-full shadow-2xl shadow-slate-900/20 border border-white/10">
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="mb-8">
                                <h2 className="text-xl font-outfit font-bold">Quick Actions</h2>
                                <p className="text-slate-400 text-sm">Perform high-priority tasks</p>
                            </div>

                            <div className="space-y-3 flex-1">
                                <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-left flex items-center group font-medium border border-white/5 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg mr-4 group-hover:bg-indigo-500/30 transition-colors">
                                        <Calendar className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <span className="text-slate-200 group-hover:text-white transition-colors">Schedule Meeting</span>
                                    <ArrowRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1 text-slate-400" />
                                </button>
                                <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-left flex items-center group font-medium border border-white/5 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]">
                                    <div className="p-2 bg-orange-500/20 rounded-lg mr-4 group-hover:bg-orange-500/30 transition-colors">
                                        <Clock className="w-5 h-5 text-orange-400" />
                                    </div>
                                    <span className="text-slate-200 group-hover:text-white transition-colors">Log Time Manually</span>
                                    <ArrowRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1 text-slate-400" />
                                </button>
                                <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-left flex items-center group font-medium border border-white/5 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg mr-4 group-hover:bg-emerald-500/30 transition-colors">
                                        <Users className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <span className="text-slate-200 group-hover:text-white transition-colors">Employee Search</span>
                                    <ArrowRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1 text-slate-400" />
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/10">
                                <div className="flex items-center text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-4">
                                    System Status
                                </div>
                                <div className="flex items-center bg-white/5 rounded-xl p-3 border border-white/5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                                    <span className="text-sm font-medium text-slate-300">All systems operational</span>
                                </div>
                            </div>
                        </div>

                        {/* Decorative circle */}
                        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/20 blur-[80px] rounded-full pointer-events-none"></div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
