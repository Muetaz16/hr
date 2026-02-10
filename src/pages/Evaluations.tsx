import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import { timeService } from '../services/timeService';
import { payrollService as payService } from '../services/payrollService';
import { isEvaluationEnabled } from '../services/evaluationPeriodService';
import type { Employee, DepartmentEvaluation, DirectorEvaluation, TimeRecord } from '../types';
import Modal from '../components/Modal';
import { format } from 'date-fns';
import {
    CheckCircle2,
    Lock,
    AlertCircle,
    ChevronRight,
    Search,
    User,
    Clock,
    Calendar,
    ArrowUpRight,
    TrendingUp,
    Filter,
    FileText
} from 'lucide-react';
import { roleThemes } from '../config/roleThemes';
import type { UserRole } from '../types';

const EvaluationsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [evaluationAllowed, setEvaluationAllowed] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    // Evaluation Data State
    const [deptEvals, setDeptEvals] = useState<Record<string, DepartmentEvaluation>>({});
    const [dirEvals, setDirEvals] = useState<Record<string, DirectorEvaluation>>({});

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [modalType, setModalType] = useState<'DEPT' | 'DIRECTOR'>('DEPT');

    // Form Data
    const [deptForm, setDeptForm] = useState({
        performance: 0, discipline: 0, teamwork: 0, productivity: 0, comments: ''
    });
    const [dirForm, setDirForm] = useState({
        leadership: 0, impact: 0, finalScore: 0
    });

    useEffect(() => {
        fetchData();
    }, [selectedMonth, currentUser]);

    const fetchData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const allowed = await isEvaluationEnabled(
                selectedMonth,
                currentUser.departmentId,
                currentUser.groupId
            );
            setEvaluationAllowed(allowed);

            let emps: Employee[] = [];
            if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER') {
                emps = await employeeService.getAllEmployees();
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
            } else if (currentUser.role === 'HEAD_DIRECTOR' && currentUser.groupId) {
                emps = await employeeService.getEmployeesByGroup(currentUser.groupId);
            }
            setEmployees(emps);

            const dEvals: Record<string, DepartmentEvaluation> = {};
            const diEvals: Record<string, DirectorEvaluation> = {};

            await Promise.all(emps.map(async (emp) => {
                const dEval = await evaluationService.getDeptEvaluation(emp.id, selectedMonth);
                if (dEval) dEvals[emp.id] = dEval;

                const diEval = await evaluationService.getDirectorEvaluation(emp.id, selectedMonth);
                if (diEval) diEvals[emp.id] = diEval;
            }));

            setDeptEvals(dEvals);
            setDirEvals(diEvals);

            // Simplified: Show all employees when evaluation is enabled
            // No need to wait for HR time approval
            setEmployees(emps);

        } catch (error) {
            console.error("Error fetching evaluations:", error);
        } finally {
            setLoading(false);
        }
    };

    const openEvaluationModal = (emp: Employee, type: 'DEPT' | 'DIRECTOR') => {
        setSelectedEmp(emp);
        setModalType(type);

        if (type === 'DEPT') {
            const existing = deptEvals[emp.id];
            setDeptForm({
                performance: existing?.performance || 0,
                discipline: existing?.discipline || 0,
                teamwork: existing?.teamwork || 0,
                productivity: existing?.productivity || 0,
                comments: existing?.comments || ''
            });
        } else {
            const existing = dirEvals[emp.id];
            setDirForm({
                leadership: existing?.leadership || 0,
                impact: existing?.impact || 0,
                finalScore: existing?.finalScore || 0
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp || !currentUser) return;

        try {
            if (modalType === 'DEPT') {
                await evaluationService.saveDeptEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    performance: Number(deptForm.performance),
                    discipline: Number(deptForm.discipline),
                    teamwork: Number(deptForm.teamwork),
                    productivity: Number(deptForm.productivity),
                    comments: deptForm.comments,
                    submittedAt: new Date().toISOString(),
                    submittedBy: currentUser.id
                });
            } else {
                if (!deptEvals[selectedEmp.id]) {
                    alert("Cannot submit Director evaluation before Department evaluation.");
                    return;
                }

                const id = await evaluationService.saveDirectorEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    leadership: Number(dirForm.leadership),
                    impact: Number(dirForm.impact),
                    finalScore: Number(dirForm.finalScore),
                    submittedBy: currentUser.id
                });

                if (window.confirm("Approve and Lock this evaluation? This cannot be undone.")) {
                    await evaluationService.lockEvaluation(id);

                    // Fetch time records for real payroll data
                    const timeRecords = await timeService.getTimeRecordsByMonth(selectedMonth);
                    const empTime = timeRecords.find((t: TimeRecord) => t.employeeId === selectedEmp.id) || {
                        assignedHours: 0, workedHours: 0, overtime: 0, absences: 0, lateMinutes: 0
                    };

                    // Simple logic: Base + OT - Absences penalty? 
                    // Or just save them for CSV export to handle.
                    // For now, let's store the raw values for the CSV.

                    await payService.savePayrollResult({
                        employeeId: selectedEmp.id,
                        month: selectedMonth,
                        totalHours: empTime.workedHours,
                        overtime: empTime.overtime,
                        absences: empTime.absences,
                        departmentScore: Number(deptForm.performance + deptForm.discipline + deptForm.teamwork + deptForm.productivity) / 4,
                        directorScore: Number(dirForm.finalScore),
                        finalScore: ((Number(deptForm.performance + deptForm.discipline + deptForm.teamwork + deptForm.productivity) / 4) + Number(dirForm.finalScore)) / 2,
                        finalSalary: Math.round(selectedEmp.baseSalary * ((((Number(deptForm.performance + deptForm.discipline + deptForm.teamwork + deptForm.productivity) / 4) + Number(dirForm.finalScore)) / 2) / 10)),
                        csvGenerated: false,
                        generatedAt: new Date().toISOString()
                    });
                }
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving evaluation:", error);
            alert(error instanceof Error ? error.message : "Failed to save");
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const completionRate = employees.length > 0
        ? Math.round((Object.keys(dirEvals).filter(id => dirEvals[id].locked).length / employees.length) * 100)
        : 0;

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section with Stats */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">Evaluations</h1>
                    <p className="text-slate-500 mt-1">Manage performance reviews for your team</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="glass-card flex items-center px-4 py-2 rounded-2xl shadow-sm border-slate-200">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-slate-800 font-bold focus:ring-0 text-sm p-0"
                        />
                    </div>
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-3xl border-l-4" style={{ borderLeftColor: theme.primary }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-slate-50 rounded-2xl">
                            <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800">{employees.length}</p>
                    <p className="text-sm text-slate-500 mt-1">Assigned Employees</p>
                </div>

                <div className="glass-card p-6 rounded-3xl border-l-4 border-yellow-400">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-yellow-50 rounded-2xl text-yellow-600">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800">
                        {employees.length - Object.keys(dirEvals).filter(id => dirEvals[id].locked).length}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">Requires Approval</p>
                </div>

                <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="flex items-center text-xs font-bold text-emerald-600">
                            <ArrowUpRight className="w-3 h-3 mr-1" /> Finish
                        </div>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800">{completionRate}%</p>
                    <p className="text-sm text-slate-500 mt-1">Completion Progress</p>
                </div>
            </div>

            {/* Warning if evaluation not enabled */}
            {!evaluationAllowed && currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'HR_MANAGER' && (
                <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 flex items-start space-x-4 animate-pulse">
                    <div className="p-2 bg-amber-100 rounded-xl text-amber-600 shrink-0">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-900">Evaluation Period Locked</h4>
                        <p className="text-amber-700 text-sm leading-relaxed mt-1">
                            The HR Manager has not yet enabled evaluations for this month.
                            You can browse existing records, but new submissions are temporarily disabled.
                        </p>
                    </div>
                </div>
            )}

            {/* Table Area */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                {/* Table Header / Filter Bar */}
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-64"
                        />
                    </div>
                    <button className="flex items-center text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                        <Filter className="w-4 h-4 mr-2" /> Show All
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dept. Status</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Director. Status</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => {
                                const dEval = deptEvals[emp.id];
                                const diEval = dirEvals[emp.id];
                                const isLocked = diEval?.locked;

                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm mr-4 group-hover:scale-105 transition-transform">
                                                    {emp.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 group-hover:text-slate-900">{emp.fullName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {emp.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            {dEval ? (
                                                <div className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold ring-1 ring-emerald-100">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Submitted
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-xs font-bold ring-1 ring-slate-100">
                                                    Pending
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5">
                                            {isLocked ? (
                                                <div className="inline-flex items-center px-3 py-1 bg-slate-900 text-white rounded-full text-xs font-bold">
                                                    <Lock className="w-3 h-3 mr-1" /> Approved
                                                </div>
                                            ) : diEval ? (
                                                <div className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold ring-1 ring-blue-100">
                                                    Drafting
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-xs font-bold ring-1 ring-slate-100">
                                                    Pending
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Dept Head Action */}
                                                {(currentUser?.role === 'HEAD_DEPARTMENT' || currentUser?.role === 'SUPER_ADMIN') && !isLocked && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'DEPT')}
                                                        disabled={!evaluationAllowed && currentUser?.role !== 'SUPER_ADMIN'}
                                                        className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                        title="Department Evaluation"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}

                                                {/* Director Action */}
                                                {(currentUser?.role === 'HEAD_DIRECTOR' || currentUser?.role === 'SUPER_ADMIN') && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'DIRECTOR')}
                                                        disabled={!dEval || !!isLocked || (!evaluationAllowed && currentUser?.role !== 'SUPER_ADMIN')}
                                                        className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                        title="Final Approval"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}

                                                <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="group-hover:hidden text-xs font-bold text-slate-300 uppercase tracking-widest">
                                                {isLocked ? 'View Only' : 'Manage'}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="max-w-xs mx-auto flex flex-col items-center">
                                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                                                <Search className="w-8 h-8" />
                                            </div>
                                            <p className="font-bold text-slate-800">No results found</p>
                                            <p className="text-slate-500 text-sm mt-1">We couldn't find any employees matching your filter.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal remains largely similar but with improved styling in its component */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalType === 'DEPT' ? 'Submit Evaluation' : 'Approve Decision'}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 text-slate-800 font-bold">
                            {selectedEmp?.fullName.charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 leading-none mb-1">{selectedEmp?.fullName}</p>
                            <p className="text-xs text-slate-500">{selectedMonth} • Assessment Period</p>
                        </div>
                    </div>

                    {modalType === 'DEPT' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {['Performance', 'Discipline', 'Teamwork', 'Productivity'].map(field => {
                                    const key = field.toLowerCase() as keyof typeof deptForm;
                                    if (key === 'comments') return null;
                                    return (
                                        <div key={field} className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{field} (0-10)</label>
                                            <input
                                                type="number" min="0" max="10" required
                                                value={deptForm[key]}
                                                onChange={(e) => setDeptForm({ ...deptForm, [key]: Number(e.target.value) })}
                                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Observer Comments</label>
                                <textarea
                                    value={deptForm.comments}
                                    onChange={(e) => setDeptForm({ ...deptForm, comments: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all text-slate-700 min-h-[120px]"
                                    placeholder="Add constructive feedback..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-indigo-700 italic">
                                "{deptEvals[selectedEmp!.id]?.comments || 'No comments provided by department head'}"
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Leadership</label>
                                    <input
                                        type="number" min="0" max="10"
                                        value={dirForm.leadership}
                                        onChange={(e) => setDirForm({ ...dirForm, leadership: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Impact</label>
                                    <input
                                        type="number" min="0" max="10"
                                        value={dirForm.impact}
                                        onChange={(e) => setDirForm({ ...dirForm, impact: Number(e.target.value) })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block underline underline-offset-4 decoration-indigo-200">Final Calculated Score / Bonus</label>
                                <input
                                    type="number" min="0"
                                    value={dirForm.finalScore}
                                    onChange={(e) => setDirForm({ ...dirForm, finalScore: Number(e.target.value) })}
                                    className="w-full px-5 py-4 bg-slate-900 text-white rounded-2xl transition-all font-bold text-xl shadow-xl shadow-indigo-500/20"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        {!dirEvals[selectedEmp?.id || '']?.locked && (
                            <button
                                type="submit"
                                className={`flex-1 px-6 py-4 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95
                                    bg-gradient-to-r ${theme.gradient}`}
                            >
                                {modalType === 'DEPT' ? 'Save Review' : 'Authorize & Lock'}
                            </button>
                        )}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default EvaluationsPage;
