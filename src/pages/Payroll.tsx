import React, { useState, useEffect } from 'react';
import { payrollService } from '../services/payrollService';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { getHREvaluationsByMonth } from '../services/hrEvaluationService';
import { timeService } from '../services/timeService';
import { format } from 'date-fns';
import {
    Download,
    FileSpreadsheet,
    Calendar,
    Search,
    Trash2,
    CheckCircle2,
    Users,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Employee, PayrollResult, TimeRecord } from '../types';

const PayrollPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [loading, setLoading] = useState(false);
    const [payrollData, setPayrollData] = useState<PayrollResult[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState('');


    useEffect(() => {
        if (currentUser) {
            fetchPayrollData();
        }
    }, [selectedMonth, currentUser]);

    const fetchPayrollData = async () => {
        setLoading(true);
        try {
            const [results, emps] = await Promise.all([
                payrollService.getPayrollByMonth(selectedMonth),
                employeeService.getAllEmployees()
            ]);



            // Filter based on user scope - HR Manager sees everyone, others are scoped
            let scopedEmps = emps;
            if (currentUser?.role === 'HEAD_DIRECTOR' && currentUser.groupId) {
                scopedEmps = emps.filter(e => e.groupId === currentUser.groupId);
            } else if (currentUser?.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                scopedEmps = emps.filter(e => e.departmentId === currentUser.departmentId);
            }

            setEmployees(scopedEmps);
            setPayrollData(results);
        } catch (error) {
            console.error("Error fetching payroll data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePayroll = async () => {
        if (!window.confirm("This will compile/update the Evaluation Report for ALL employees for this month. Continue?")) return;

        setLoading(true);
        try {
            // 1. Fetch all necessary data
            const [emps, timeRecords, hrEvals] = await Promise.all([
                employeeService.getAllEmployees(),
                timeService.getTimeRecordsByMonth(selectedMonth),
                getHREvaluationsByMonth(selectedMonth)
            ]);

            // 2. Process each employee
            const promises = emps.map(async (emp) => {
                // Fetch evaluations
                const [deptEval, dirEval, persEval] = await Promise.all([
                    evaluationService.getDeptEvaluation(emp.id, selectedMonth),
                    evaluationService.getDirectorEvaluation(emp.id, selectedMonth),
                    evaluationService.getPersonnelEvaluation(emp.id, selectedMonth)
                ]);

                // Time data
                const empTime = timeRecords.find((t: TimeRecord) => t.employeeId === emp.id) || {
                    assignedHours: 0, workedHours: 0, overtime: 0, absences: 0, lateMinutes: 0
                };

                // HR Data
                const hrEval = hrEvals.find(h => h.employeeId === emp.id);

                // Scores
                // New system uses pre-calculated totalScore (0-100)
                // Calculate Category Scores from Director Evaluation (or Dept if Dir missing)
                // Calculate Category Scores - Shared Responsibility Logic
                // Both Dept and Director evaluate all 3 categories.
                // Final Score for each category = (DeptScore + DirScore) / 2
                // This means Dept contributes 50% and Director contributes 50% to each category.
                // e.g. Exec (40) -> Dept gives score out of 40, Dir gives score out of 40. We take average.
                // Or simplified: (DeptScore * 0.5) + (DirScore * 0.5).

                const calculateCategoryScore = (evalSource: any, keys: string[]) => {
                    if (!evalSource) return 0;
                    return keys.reduce((sum, key) => sum + (evalSource[key] || 0), 0);
                };

                const adminKeys = ['relationshipWithColleagues', 'teamworkParticipation', 'workOrganization', 'communicationSkills', 'regulatoryCompliance'];
                const execKeys = ['taskQuality', 'timeCommitment', 'organizationalCompliance', 'problemSolving', 'pressureHandling', 'continuousDevelopment'];
                const careKeys = ['regulationsAdherence', 'safetyAdherence', 'appearanceCommitment', 'resourcePreservation', 'dataPrivacy'];

                // Raw scores (out of 25, 40, 15 respectively)
                const deptAdmin = calculateCategoryScore(deptEval, adminKeys);
                const dirAdmin = calculateCategoryScore(dirEval, adminKeys);

                const deptExec = calculateCategoryScore(deptEval, execKeys);
                const dirExec = calculateCategoryScore(dirEval, execKeys);

                const deptCare = calculateCategoryScore(deptEval, careKeys);
                const dirCare = calculateCategoryScore(dirEval, careKeys);

                // Averaged Scores
                // If one is missing, it counts as 0 in the "Average" if we strict "Sum / 2" (which aligns with "20 each").
                // User said "20 each" for Exec (40). This implies Summing the Halves.
                // So if Dept is missing, you miss those 20 points.
                const adminScore = (deptAdmin / 2) + (dirAdmin / 2);
                const executiveScore = (deptExec / 2) + (dirExec / 2);
                const careScore = (deptCare / 2) + (dirCare / 2);

                // Personnel Score Calculation (Proposed Formula)
                let persScore = 0;
                let persDeduct = 0;
                let persBonus = 0;
                let trainingList: string[] = [];

                if (persEval) {
                    // Base 80 + Adjustments
                    let score = 80;
                    score += (persEval.appreciationMessages * 5);
                    score -= (persEval.warningMessages * 10);
                    score += (persEval.exceptionalAssignments * 0.5); // +0.5 per day
                    score -= (persEval.disciplinaryDeduction * 2);   // -2 per day score penalty

                    // Training (+5 each)
                    if (persEval.specializedTraining) { score += 5; trainingList.push("Specialized"); }
                    if (persEval.supportingTraining) { score += 5; trainingList.push("Supporting"); }
                    if (persEval.languageTraining) { score += 5; trainingList.push("Language"); }
                    if (persEval.softwareTraining) { score += 5; trainingList.push("Software"); }

                    persScore = Math.min(100, Math.max(0, score));

                    persDeduct = persEval.disciplinaryDeduction;
                    persBonus = persEval.exceptionalAssignments;
                }
                const trainingSummary = trainingList.join(", ");

                // HR Score (Calculated /100 in Service, Scaled to /20 for Final)
                const hrRawScore = hrEval?.presenceScore || 0;
                const hrScaledScore = (hrRawScore / 100) * 20;

                // Final Score Calculation (Sum of Categories)
                // Admin(25) + Exec(40) + Care(15) + HR(20) = 100
                const finalScore = hrScaledScore + adminScore + executiveScore + careScore;

                // Salary Calc - DISABLED per user request
                const finalSalary = 0;

                return payrollService.savePayrollResult({
                    employeeId: emp.id,
                    month: selectedMonth,

                    // Time & Attendance
                    totalHours: empTime.workedHours,
                    overtime: empTime.overtime,
                    absences: empTime.absences,

                    // HR Metrics
                    hrPresenceScore: hrRawScore, // Save raw /100 score for detail view
                    hrAbsenceDays: hrEval?.absenceWithoutPermission || 0,
                    hrDelayMinutes: hrEval?.delayAndEarlyDeparture || 0,

                    // Category Scores
                    adminScore,
                    executiveScore,
                    careScore,

                    // Legacy/Aggregate (Required by type but less important now)
                    deptPerformance: deptEval?.totalScore || 0, // Using totalScore for the main metric
                    deptDiscipline: 0, // Deprecated details in CSV for now to avoid complexity
                    departmentScore: deptEval?.totalScore || 0, // Using totalScore for the main metric
                    directorLeadership: 0, // Deprecated details
                    directorImpact: 0,
                    directorScore: dirEval?.finalScore || 0,

                    // Personnel Metrics
                    personnelScore: persScore, // Kept but not in finalScore
                    personnelDeductionDays: persDeduct,
                    personnelBonusDays: persBonus,
                    trainingSummary, // New field

                    finalScore: finalScore,
                    finalSalary: finalSalary,
                    csvGenerated: false,
                    generatedAt: new Date().toISOString()
                });
            });

            await Promise.all(promises);
            fetchPayrollData(); // Refresh table
            alert("Evaluation Report generated successfully!");

        } catch (error) {
            console.error("Error generating report:", error);
            alert("Failed to generate report.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this report?")) return;
        setLoading(true);
        try {
            await payrollService.deletePayrollResult(id);
            fetchPayrollData();
        } catch (error) {
            console.error("Error deleting report:", error);
            alert("Failed to delete report.");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        try {
            const blob = await payrollService.generateMonthlyExcel(selectedMonth);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payroll_report_${selectedMonth}.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error generating Excel:", error);
            alert("Failed to generate Excel Report");
        } finally {
            setLoading(false);
        }
    };

    const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.fullName || 'Member Removal Pending';

    const filteredResults = payrollData.filter(r => {
        const name = getEmployeeName(r.employeeId).toLowerCase();
        return name.includes(searchTerm.toLowerCase());
    });

    const completedRecords = payrollData.length;

    if (currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'HR_MANAGER') {
        return <div className="p-8 text-red-500 font-bold uppercase tracking-widest text-center glass-card rounded-3xl mt-20">Access Restricted: Authority Required</div>;
    }

    return (
        <div className="space-y-8 animate-[slideIn_0.5s_ease-out_forwards]">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/20">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">Appraisal Reports</h1>
                    <p className="text-slate-500 mt-1">Manage and export monthly performance evaluations</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center px-4 py-3 bg-white/50 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm hover:bg-white transition-colors">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none cursor-pointer"
                        />
                    </div>

                    <button
                        onClick={handleGeneratePayroll}
                        disabled={loading}
                        className="flex items-center px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all text-sm disabled:opacity-50"
                        title="Compile all current evaluations into a report"
                    >
                        <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Compile Report
                    </button>

                    <button
                        onClick={handleExport}
                        disabled={loading || payrollData.length === 0}
                        className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm group disabled:opacity-50 disabled:scale-100"
                    >
                        <Download size={18} className="mr-2 group-hover:translate-y-0.5 transition-transform" />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-3xl border-l-4 border-blue-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/10"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 px-2 py-1 rounded-md">Reports Generated</span>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        </div>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-4xl font-outfit font-bold text-slate-800">{completedRecords}</span>
                        <span className="text-xs text-slate-400 mb-1.5 font-medium">for {format(new Date(selectedMonth), 'MMMM yyyy')}</span>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-3xl border-l-4 border-indigo-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/10"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 px-2 py-1 rounded-md">Total Staff</span>
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Users className="w-5 h-5 text-indigo-500" />
                        </div>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-4xl font-outfit font-bold text-slate-800">{employees.length}</span>
                        <span className="text-xs text-slate-400 mb-1.5 font-medium">Active Employees</span>
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white/40">
                <div className="p-6 border-b border-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/30 backdrop-blur-md">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search employee..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-4 py-2.5 bg-white/50 border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-80 shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/40 rounded-xl border border-white/40">
                        <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Ledger</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-left">
                                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Employee</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Presence (20)</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Admin (25)</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Exec (40)</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Care (15)</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Exceptional</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Training</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-800 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Total (100)</th>
                                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredResults.map((result) => (
                                <tr key={result.id} className="group hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 mr-3 shadow-sm group-hover:scale-110 transition-transform">
                                                {getEmployeeName(result.employeeId).charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">{getEmployeeName(result.employeeId)}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">
                                                        ID: {employees.find(e => e.id === result.employeeId)?.staffId || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="text-sm font-bold text-slate-700 bg-slate-50/50 py-1 rounded-lg">
                                            {result.hrPresenceScore ? ((result.hrPresenceScore / 100) * 20).toFixed(1) : '0.0'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="text-sm font-bold text-slate-700">{result.adminScore?.toFixed(1) || '0.0'}</div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="text-sm font-bold text-slate-700">{result.executiveScore?.toFixed(1) || '0.0'}</div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="text-sm font-bold text-slate-700">{result.careScore?.toFixed(1) || '0.0'}</div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className={`text-xs font-bold px-2 py-1 rounded-lg ${result.personnelBonusDays ? 'bg-amber-50 text-amber-600' : 'text-slate-400'}`}>
                                            {result.personnelBonusDays ? `+${result.personnelBonusDays} days` : '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="text-[10px] font-bold text-slate-500 max-w-[150px] truncate mx-auto px-2 py-1 rounded bg-slate-50/50" title={result.trainingSummary}>
                                            {result.trainingSummary || '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="inline-flex items-center px-3 py-1 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-lg shadow-slate-900/20 group-hover:bg-indigo-600 transition-colors">
                                            {result.finalScore.toFixed(1)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(result.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete Record"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredResults.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-8 py-20 text-center">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                                            <AlertCircle className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No reports found</p>
                                        <p className="text-slate-400 text-xs mt-1">Try generating a report for this month</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PayrollPage;
