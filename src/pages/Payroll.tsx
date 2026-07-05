import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
        if (!window.confirm(t('confirm_compile_report'))) return;


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
                // Calculation Logic:
                // If both exist: (Dept + Director) / 2
                // If only one exists: Use the existing one (100%)
                // If none exist: 0

                const getWeightedScore = (deptVal: number, dirVal: number, deptExists: boolean, dirExists: boolean) => {
                    if (deptExists && dirExists) return (deptVal + dirVal) / 2;
                    if (deptExists) return deptVal;
                    if (dirExists) return dirVal;
                    return 0;
                };

                const adminScore = getWeightedScore(deptAdmin, dirAdmin, !!deptEval, !!dirEval);
                const executiveScore = getWeightedScore(deptExec, dirExec, !!deptEval, !!dirEval);
                const careScore = getWeightedScore(deptCare, dirCare, !!deptEval, !!dirEval);

                const getCriterionScore = (key: string, d: any, dr: any) => {
                    if (d && dr) return ((d[key] || 0) + (dr[key] || 0)) / 2;
                    if (d) return d[key] || 0;
                    if (dr) return dr[key] || 0;
                    return 0;
                };

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
                // const trainingSummary = trainingList.join(", "); // We will translate this in the render if possible, or just join simple strings. 
                // Actually, training types are hardcoded in DB probably, but we can translate them here for display if we want.
                // For now, let's just join them as is, or use regex in render.
                // But wait, trainingList pushes English strings "Specialized", "Supporting", etc.
                // We should push keys or translated strings?
                // If we push keys, we can translate in render.
                // But trainingSummary is saved to DB as string?
                // The interface says trainingSummary: string.
                // Let's save the keys or English for now, and maybe translate in render if possible.
                // Or better, let's just save English for consistency in DB, and frontend can translate if needed, but it's a "summary" field.
                // Let's stick to English for the DB value for now to avoid complexity with existing data.
                const trainingSummary = trainingList.join(", ");

                // HR Score (Now out of 20 directly)
                const hrRawScore = hrEval?.presenceScore || 0;
                const hrScaledScore = hrRawScore;

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
                    hrEmergencyDays: hrEval?.emergencyLeaves || 0,
                    hrUnpaidLeaves: hrEval?.unpaidLeave || 0,
                    hrAnnualPaidLeaves: hrEval?.annualPaidLeave || 0,

                    // Category Scores
                    adminScore,
                    relColleagues: getCriterionScore('relationshipWithColleagues', deptEval, dirEval),
                    teamwork: getCriterionScore('teamworkParticipation', deptEval, dirEval),
                    workOrg: getCriterionScore('workOrganization', deptEval, dirEval),
                    commSkills: getCriterionScore('communicationSkills', deptEval, dirEval),
                    regCompliance: getCriterionScore('regulatoryCompliance', deptEval, dirEval),

                    executiveScore,
                    taskQuality: getCriterionScore('taskQuality', deptEval, dirEval),
                    timeCommit: getCriterionScore('timeCommitment', deptEval, dirEval),
                    orgCompliance: getCriterionScore('organizationalCompliance', deptEval, dirEval),
                    probSolving: getCriterionScore('problemSolving', deptEval, dirEval),
                    pressureHandling: getCriterionScore('pressureHandling', deptEval, dirEval),
                    contDev: getCriterionScore('continuousDevelopment', deptEval, dirEval),

                    careScore,
                    regAdherence: getCriterionScore('regulationsAdherence', deptEval, dirEval),
                    safetyAdherence: getCriterionScore('safetyAdherence', deptEval, dirEval),
                    appearance: getCriterionScore('appearanceCommitment', deptEval, dirEval),
                    resPreservation: getCriterionScore('resourcePreservation', deptEval, dirEval),
                    dataPrivacy: getCriterionScore('dataPrivacy', deptEval, dirEval),

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
            await Promise.all(promises);
            fetchPayrollData(); // Refresh table
            alert(t('report_generated_success'));

        } catch (error) {
            console.error("Error generating report:", error);
            alert(t('report_generated_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('confirm_delete_report'))) return;
        setLoading(true);
        try {
            await payrollService.deletePayrollResult(id);
            fetchPayrollData();
        } catch (error) {
            console.error("Error deleting report:", error);
            alert(t('report_delete_failed'));
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
        return <div className="p-8 text-red-500 font-bold uppercase tracking-widest text-center glass-card rounded-3xl mt-20">{t('access_restricted')}</div>;
    }

    return (
        <div className="space-y-8 animate-[slideIn_0.5s_ease-out_forwards]">
            {/* Header */}
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/20">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('appraisal_reports_title')}</h1>
                    <p className="text-slate-500 mt-1">{t('appraisal_reports_subtitle')}</p>
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
                        title={t('compile_report')}
                    >
                        <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        {t('compile_report')}
                    </button>

                    <button
                        onClick={handleExport}
                        disabled={loading || payrollData.length === 0}
                        className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all text-sm group disabled:opacity-50 disabled:scale-100"
                    >
                        <Download size={18} className="mr-2 group-hover:translate-y-0.5 transition-transform" />
                        {t('export_excel')}
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-3xl border-l-4 border-[#aa7a51] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#aa7a51]/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-[#aa7a51]/10"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <span className="text-[10px] font-bold text-[#aa7a51] uppercase tracking-widest bg-[#541c2c]/40 px-2 py-1 rounded-md border border-[#e3c4a2]/15">{t('reports_generated')}</span>
                        <div className="p-2 bg-[#541c2c]/60 rounded-lg border border-[#e3c4a2]/15">
                            <CheckCircle2 className="w-5 h-5 text-[#e3c4a2]" />
                        </div>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-4xl font-outfit font-bold text-[#e3c4a2]">{completedRecords}</span>
                        <span className="text-xs text-[#aa7a51] mb-1.5 font-medium">for {format(new Date(selectedMonth), 'MMMM yyyy')}</span>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-3xl border-l-4 border-[#aa7a51] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#aa7a51]/5 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-[#aa7a51]/10"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <span className="text-[10px] font-bold text-[#aa7a51] uppercase tracking-widest bg-[#541c2c]/40 px-2 py-1 rounded-md border border-[#e3c4a2]/15">{t('total_staff')}</span>
                        <div className="p-2 bg-[#541c2c]/60 rounded-lg border border-[#e3c4a2]/15">
                            <Users className="w-5 h-5 text-[#e3c4a2]" />
                        </div>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-4xl font-outfit font-bold text-[#e3c4a2]">{employees.length}</span>
                        <span className="text-xs text-[#aa7a51] mb-1.5 font-medium">{t('active_employees')}</span>
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
                            placeholder={t('search_employee_placeholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-4 py-2.5 bg-white/50 border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-80 shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/40 rounded-xl border border-white/40">
                        <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('monthly_ledger')}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#e3c4a2]/20">
                                <th rowSpan={2} className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest sticky left-0 top-0 backdrop-blur-sm z-30 min-w-[200px] shadow-[6px_0_12px_-4px_rgba(0,0,0,0.15)] payroll-header-cell-primary">{t('employee')}</th>
                                <th colSpan={6} className="px-2 py-2 text-[9px] font-black uppercase tracking-tighter text-center sticky top-0 backdrop-blur-sm z-20 border-b payroll-header-cell payroll-cat-presence payroll-presence-text">{t('presence_20')}</th>
                                <th colSpan={6} className="px-2 py-2 text-[9px] font-black uppercase tracking-tighter text-center sticky top-0 backdrop-blur-sm z-20 border-b payroll-header-cell payroll-cat-admin payroll-admin-text">{t('admin_25')}</th>
                                <th colSpan={7} className="px-2 py-2 text-[9px] font-black uppercase tracking-tighter text-center sticky top-0 backdrop-blur-sm z-20 border-b payroll-header-cell payroll-cat-exec payroll-exec-text">{t('exec_40')}</th>
                                <th colSpan={6} className="px-2 py-2 text-[9px] font-black uppercase tracking-tighter text-center sticky top-0 backdrop-blur-sm z-20 border-b payroll-header-cell payroll-cat-care payroll-care-text">{t('care_15')}</th>
                                <th rowSpan={2} className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-center sticky top-0 backdrop-blur-sm z-20 min-w-[100px] payroll-header-cell">{t('exceptional')}</th>
                                <th rowSpan={2} className="px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-center sticky top-0 backdrop-blur-sm z-20 min-w-[120px] payroll-header-cell">{t('training')}</th>
                                <th rowSpan={2} className="px-4 py-5 text-[10px] font-extrabold uppercase tracking-widest text-center sticky top-0 backdrop-blur-sm z-20 min-w-[100px] payroll-header-cell-primary payroll-bonus-text">{t('total_100')}</th>
                                <th rowSpan={2} className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-right sticky top-0 backdrop-blur-sm z-20 min-w-[120px] payroll-header-cell">{t('actions')}</th>
                            </tr>
                            <tr className="border-b border-[#e3c4a2]/20">
                                {/* Presence Sub-Headers */}
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">ABS</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">DLY</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">EMG</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">UNP</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">ANN</th>
                                <th className="px-1 py-1.5 text-[8px] font-black uppercase text-center payroll-header-cell payroll-sc-presence payroll-presence-text">SC</th>

                                {/* Admin Sub-Headers */}
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">PEER</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">TEAM</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">ORG</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">COMM</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">RULE</th>
                                <th className="px-1 py-1.5 text-[8px] font-black uppercase text-center payroll-header-cell payroll-sc-admin payroll-admin-text">SC</th>

                                {/* Exec Sub-Headers */}
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">QUAL</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">TIME</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">ORG</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">PROB</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">PRES</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">DEV</th>
                                <th className="px-1 py-1.5 text-[8px] font-black uppercase text-center payroll-header-cell payroll-sc-exec payroll-exec-text">SC</th>

                                {/* Care Sub-Headers */}
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">RULE</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">SAFE</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">APP</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">RES</th>
                                <th className="px-1 py-1.5 text-[7px] font-bold uppercase text-center min-w-[32px] payroll-header-cell">PRIV</th>
                                <th className="px-1 py-1.5 text-[8px] font-black uppercase text-center payroll-header-cell payroll-sc-care payroll-care-text">SC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredResults.map((result) => {
                                const emp = employees.find(e => e.id === result.employeeId);
                                return (
                                    <tr key={result.id} className="transition-all duration-200 group border-b border-[#e3c4a2]/10">
                                        <td className="px-6 py-4 sticky left-0 backdrop-blur-sm z-10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.15)] payroll-sticky-employee">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#541c2c] to-[#aa7a51] flex items-center justify-center text-[#e3c4a2] font-black text-sm shadow-md uppercase">
                                                    {emp?.fullName?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold leading-tight payroll-employee-name">{emp?.fullName}</div>
                                                    <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-block mt-1 border payroll-employee-id">ID: {emp?.staffId}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Presence Details */}
                                        <td className="px-0.5 py-4 text-center payroll-score-cell">
                                            <div className="text-[9px] font-bold payroll-score-text">{Math.round((Math.max(0, 7 - (result.hrAbsenceDays || 0)) / 7) * 100)}</div>
                                        </td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell">
                                            <div className="text-[9px] font-bold payroll-score-text">{Math.round((Math.max(0, 7 - ((result.hrDelayMinutes || 0) / 180 * 7)) / 7) * 100)}</div>
                                        </td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell">
                                            <div className="text-[9px] font-bold payroll-score-text">{Math.round((Math.max(0, 2 - ((result.hrEmergencyDays || 0) / 3 * 2)) / 2) * 100)}</div>
                                        </td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell">
                                            <div className="text-[9px] font-bold payroll-score-text">{Math.round((Math.max(0, 2 - ((result.hrUnpaidLeaves || 0) / 14 * 2)) / 2) * 100)}</div>
                                        </td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell">
                                            <div className="text-[9px] font-bold payroll-score-text">{Math.round((Math.max(0, 2 - ((result.hrAnnualPaidLeaves || 0) / 14 * 2)) / 2) * 100)}</div>
                                        </td>
                                        <td className="px-0.5 py-4 text-center payroll-sc-presence payroll-score-cell">
                                            <div className="text-[10px] font-black payroll-presence-text">
                                                {typeof result.hrPresenceScore === 'number' ? Math.round((result.hrPresenceScore / 20) * 100) : '0'}
                                            </div>
                                        </td>

                                        {/* Admin Details */}
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.relColleagues === 'number' ? Math.round((result.relColleagues / 5) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.teamwork === 'number' ? Math.round((result.teamwork / 5) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.workOrg === 'number' ? Math.round((result.workOrg / 5) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.commSkills === 'number' ? Math.round((result.commSkills / 5) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.regCompliance === 'number' ? Math.round((result.regCompliance / 5) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-sc-admin payroll-score-cell">
                                            <div className="text-[10px] font-black payroll-admin-text">
                                                {result.adminScore ? result.adminScore.toFixed(1) : '0.0'}
                                            </div>
                                        </td>

                                        {/* Exec Details */}
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.taskQuality === 'number' ? Math.round((result.taskQuality / 7) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.timeCommit === 'number' ? Math.round((result.timeCommit / 7) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.orgCompliance === 'number' ? Math.round((result.orgCompliance / 7) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.probSolving === 'number' ? Math.round((result.probSolving / 6) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.pressureHandling === 'number' ? Math.round((result.pressureHandling / 7) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.contDev === 'number' ? Math.round((result.contDev / 6) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-sc-exec payroll-score-cell">
                                            <div className="text-[10px] font-black payroll-exec-text">
                                                {result.executiveScore ? result.executiveScore.toFixed(1) : '0.0'}
                                            </div>
                                        </td>

                                        {/* Care Details */}
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.regAdherence === 'number' ? Math.round((result.regAdherence / 3) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.safetyAdherence === 'number' ? Math.round((result.safetyAdherence / 3) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.appearance === 'number' ? Math.round((result.appearance / 3) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.resPreservation === 'number' ? Math.round((result.resPreservation / 3) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-score-cell"><div className="text-[9px] font-bold payroll-score-text">{typeof result.dataPrivacy === 'number' ? Math.round((result.dataPrivacy / 3) * 100) : '0'}</div></td>
                                        <td className="px-0.5 py-4 text-center payroll-sc-care payroll-score-cell">
                                            <div className="text-[10px] font-black payroll-care-text">
                                                {result.careScore ? result.careScore.toFixed(1) : '0.0'}
                                            </div>
                                        </td>

                                        <td className="px-4 py-4 text-center payroll-score-cell">
                                            <div className="text-[10px] font-bold payroll-bonus-text">
                                                {result.personnelBonusDays ? `+${result.personnelBonusDays}d` : '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 payroll-score-cell">
                                            <div className="text-[9px] font-medium leading-tight line-clamp-2 max-w-[120px] payroll-training-text">
                                                {result.trainingSummary || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center payroll-final-score-cell">
                                            <div className="text-sm font-black payroll-final-score-text">
                                                {result.finalScore.toFixed(1)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(result.id)}
                                                className="p-2 text-[#aa7a51] hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-all"
                                                title={t('delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredResults.length === 0 && (
                                <tr>
                                    <td colSpan={25} className="px-8 py-20 text-center">
                                        <div className="w-20 h-20 bg-[#541c2c]/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-[#e3c4a2]/20">
                                            <AlertCircle className="w-8 h-8 text-[#aa7a51]" />
                                        </div>
                                        <p className="text-[#e3c4a2] font-bold uppercase tracking-widest text-xs">{t('no_reports_found')}</p>
                                        <p className="text-[#aa7a51] text-xs mt-1">{t('try_generating_report')}</p>
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
