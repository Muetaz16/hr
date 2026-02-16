import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeService } from '../services/employeeService';
import { evaluationService } from '../services/evaluationService';
import type { Employee, DepartmentEvaluation, DirectorEvaluation, PersonnelEvaluation } from '../types';
import Modal from '../components/Modal';
import { format } from 'date-fns';
import {
    CheckCircle2,
    Lock,
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
    const [searchTerm, setSearchTerm] = useState('');

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    // Evaluation Data State
    const [deptEvals, setDeptEvals] = useState<Record<string, DepartmentEvaluation>>({});
    const [dirEvals, setDirEvals] = useState<Record<string, DirectorEvaluation>>({});
    const [persEvals, setPersEvals] = useState<Record<string, PersonnelEvaluation>>({});

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [modalType, setModalType] = useState<'DEPT' | 'DIRECTOR' | 'PERSONNEL'>('DEPT');

    // Initial Form State with detailed metrics
    const initialMetrics = {
        relationshipWithColleagues: 0, teamworkParticipation: 0, workOrganization: 0, communicationSkills: 0, regulatoryCompliance: 0,
        taskQuality: 0, timeCommitment: 0, organizationalCompliance: 0, problemSolving: 0, pressureHandling: 0, continuousDevelopment: 0,
        regulationsAdherence: 0, safetyAdherence: 0, appearanceCommitment: 0, resourcePreservation: 0, dataPrivacy: 0,
        comments: ''
    };

    const [deptForm, setDeptForm] = useState(initialMetrics);
    const [dirForm, setDirForm] = useState({ ...initialMetrics, finalScore: 0 });
    const [persForm, setPersForm] = useState({
        warningMessages: 0, disciplinaryDeduction: 0, appreciationMessages: 0, exceptionalAssignments: 0,
        specializedTraining: false, supportingTraining: false, languageTraining: false, softwareTraining: false
    });

    useEffect(() => {
        fetchData();
    }, [selectedMonth, currentUser]);

    const fetchData = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            let emps: Employee[] = [];
            if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER' || currentUser.role === 'PERSONNEL') {
                emps = await employeeService.getAllEmployees();
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
            } else if (currentUser.role === 'HEAD_DIRECTOR') {
                // Director oversees the entire Group (Subsidiary)
                // Prioritize groupId over departmentId to ensure they see all depts
                if (currentUser.groupId) {
                    emps = await employeeService.getEmployeesByGroup(currentUser.groupId);
                } else if (currentUser.departmentId) {
                    emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
                }
            }
            setEmployees(emps);

            const dEvals: Record<string, DepartmentEvaluation> = {};
            const diEvals: Record<string, DirectorEvaluation> = {};
            const pEvals: Record<string, PersonnelEvaluation> = {};

            await Promise.all(emps.map(async (emp) => {
                const [dEval, diEval, pEval] = await Promise.all([
                    evaluationService.getDeptEvaluation(emp.id, selectedMonth),
                    evaluationService.getDirectorEvaluation(emp.id, selectedMonth),
                    evaluationService.getPersonnelEvaluation(emp.id, selectedMonth)
                ]);

                if (dEval) dEvals[emp.id] = dEval;
                if (diEval) diEvals[emp.id] = diEval;
                if (pEval) pEvals[emp.id] = pEval;
            }));

            setDeptEvals(dEvals);
            setDirEvals(diEvals);
            setPersEvals(pEvals);

        } catch (error) {
            console.error("Error fetching evaluations:", error);
        } finally {
            setLoading(false);
        }
    };

    const openEvaluationModal = (emp: Employee, type: 'DEPT' | 'DIRECTOR' | 'PERSONNEL') => {
        setSelectedEmp(emp);
        setModalType(type);

        if (type === 'DEPT') {
            const existing = deptEvals[emp.id];
            setDeptForm(existing ? { ...existing, comments: existing.comments || '' } : initialMetrics);
        } else if (type === 'DIRECTOR') {
            const existing = dirEvals[emp.id];
            setDirForm(existing ? { ...existing, finalScore: existing.finalScore || 0, comments: '' } : { ...initialMetrics, finalScore: 0 });
        } else {
            const existing = persEvals[emp.id];
            setPersForm(existing || {
                warningMessages: 0, disciplinaryDeduction: 0, appreciationMessages: 0, exceptionalAssignments: 0,
                specializedTraining: false, supportingTraining: false, languageTraining: false, softwareTraining: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp || !currentUser) return;

        try {
            // Helper to clean form data (remove UI specific fields if any)
            // For now, we pass the state directly as it matches the interface exactly

            if (modalType === 'DEPT') {
                await evaluationService.saveDeptEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    ...deptForm,
                    submittedAt: new Date().toISOString(),
                    submittedBy: currentUser.id,
                    totalScore: 0 // Service calculates this
                });
            } else if (modalType === 'PERSONNEL') {
                await evaluationService.savePersonnelEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    ...persForm,
                    submittedAt: new Date().toISOString(),
                    submittedBy: currentUser.id
                });
            } else {
                if (!deptEvals[selectedEmp.id]) {
                    // Warn but allow (Director overrides)
                    // alert("Note: Department Evaluation is missing.");
                }

                const id = await evaluationService.saveDirectorEvaluation({
                    employeeId: selectedEmp.id,
                    month: selectedMonth,
                    ...dirForm,
                    submittedBy: currentUser.id,
                    finalScore: 0 // Service calculates this
                });

                if (window.confirm("Approve and Lock this evaluation? This cannot be undone.")) {
                    await evaluationService.lockEvaluation(id);
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

    const renderMetricInput = (label: string, field: keyof typeof deptForm, maxScore: number) => {
        // Only for Dept/Director
        if (modalType === 'PERSONNEL') return null;

        const currentVal = modalType === 'DEPT' ? deptForm[field] : dirForm[field];
        const handleChange = (val: number) => {
            if (modalType === 'DEPT') {
                setDeptForm(prev => ({ ...prev, [field]: val }));
            } else {
                setDirForm(prev => ({ ...prev, [field]: val }));
            }
        };

        return (
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-tight">{label}</label>
                    <span className="text-[10px] font-mono text-slate-400">Max: {maxScore}%</span>
                </div>
                <input
                    type="number"
                    min="0"
                    max={maxScore}
                    step="0.1"
                    required
                    value={typeof currentVal === 'number' ? currentVal : 0}
                    onChange={(e) => handleChange(Math.min(maxScore, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-bold text-slate-800 text-sm"
                />
            </div>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-[slideIn_0.5s_ease-out_forwards]">
            {/* Header section with Stats */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/20">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">Evaluations</h1>
                    <p className="text-slate-500 mt-1">Manage performance reviews for your team</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="glass-card flex items-center px-4 py-2 rounded-2xl shadow-sm border border-white/40 bg-white/40 sticky top-0 backdrop-blur-md">
                        <Calendar className="w-4 h-4 text-slate-500 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-slate-800 font-bold focus:ring-0 text-sm p-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-3xl border-l-4 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300" style={{ borderLeftColor: theme.primary }}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-indigo-500/20"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-slate-50/50 rounded-2xl">
                            <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">Total</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">{employees.length}</p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">Assigned Employees</p>
                </div>

                <div className="glass-card p-6 rounded-3xl border-l-4 border-yellow-400 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-yellow-400/20"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-yellow-50/50 rounded-2xl text-yellow-600">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">Pending</span>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">
                        {employees.length - Object.keys(dirEvals).filter(id => dirEvals[id].locked).length}
                    </p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">Requires Approval</p>
                </div>

                <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-500 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-emerald-500/20"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-emerald-50/50 rounded-2xl text-emerald-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                            <ArrowUpRight className="w-3 h-3 mr-1" /> Finish
                        </div>
                    </div>
                    <p className="text-3xl font-outfit font-bold text-slate-800 relative z-10">{completionRate}%</p>
                    <p className="text-sm text-slate-500 mt-1 relative z-10">Completion Progress</p>
                </div>
            </div>

            {/* Table Area */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white/40">
                {/* Table Header / Filter Bar */}
                <div className="p-6 border-b border-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/30 backdrop-blur-md">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-4 py-2.5 bg-white/50 border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-80 shadow-sm"
                        />
                    </div>
                    <button className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors bg-white/40 px-3 py-2 rounded-xl border border-white/40">
                        <Filter className="w-4 h-4 mr-2" /> Show All
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-left">
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Employee</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Dept. Score</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Director Score</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Status</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => {
                                const dEval = deptEvals[emp.id];
                                const diEval = dirEvals[emp.id];
                                const isLocked = diEval?.locked;

                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm mr-4 group-hover:scale-105 transition-transform shadow-sm">
                                                    {(emp.fullName || 'U').charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{emp.fullName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {emp.staffId || emp.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            {dEval ? (
                                                <div className="font-bold text-slate-700 bg-slate-100/50 inline-block px-2 py-1 rounded-lg">{dEval.totalScore?.toFixed(2) || 'N/A'}%</div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic px-2">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            {diEval ? (
                                                <div className="font-bold text-slate-700 bg-slate-100/50 inline-block px-2 py-1 rounded-lg">{diEval.finalScore?.toFixed(2) || 'N/A'}%</div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic px-2">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            {isLocked ? (
                                                <div className="inline-flex items-center px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold shadow-md shadow-slate-900/20">
                                                    <Lock className="w-3 h-3 mr-1.5" /> Approved
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold ring-1 ring-amber-100">
                                                    In Progress
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {(currentUser?.role === 'HEAD_DEPARTMENT' || currentUser?.role === 'HEAD_DIRECTOR' || currentUser?.role === 'SUPER_ADMIN') && !isLocked && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'DEPT')}
                                                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm hover:shadow-md"
                                                        title="Department Evaluation"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(currentUser?.role === 'HEAD_DIRECTOR' || currentUser?.role === 'SUPER_ADMIN') && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'DIRECTOR')}
                                                        disabled={!!isLocked}
                                                        className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:shadow-none"
                                                        title="Final Approval"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(currentUser?.role === 'PERSONNEL') && (
                                                    <button
                                                        onClick={() => openEvaluationModal(emp, 'PERSONNEL')}
                                                        className={`p-2 rounded-xl border transition-all shadow-sm hover:shadow-md ${persEvals[emp.id] ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white'}`}
                                                        title="Personnel Assessment"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="max-w-xs mx-auto flex flex-col items-center">
                                            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
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
                title={modalType === 'DEPT' ? 'Department Assessment' : modalType === 'DIRECTOR' ? 'Director Validation' : 'Personnel Evaluation'}
            >
                <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4 sticky top-0 z-10">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 text-slate-800 font-bold">
                            {(selectedEmp?.fullName || 'U').charAt(0)}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 leading-none mb-1">{selectedEmp?.fullName}</p>
                            <p className="text-xs text-slate-500">{selectedMonth} • Assessment Period</p>
                        </div>
                    </div>

                    {/* Administrative Behavior (25%) */}
                    {/* Shared: Both Dept and Director evaluate this. */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2 flex justify-between">
                            Administrative Behavior <span className="text-indigo-600">25%</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {renderMetricInput("Relationship with Colleagues", "relationshipWithColleagues", 5)}
                            {renderMetricInput("Teamwork & Participation", "teamworkParticipation", 5)}
                            {renderMetricInput("Work Organization", "workOrganization", 5)}
                            {renderMetricInput("Written Communication", "communicationSkills", 5)}
                            {renderMetricInput("Regulatory Document Compliance", "regulatoryCompliance", 5)}
                        </div>
                    </div>

                    {/* Executive Performance (40%) */}
                    {/* Shared: Both Dept and Director evaluate this. */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2 flex justify-between">
                            Executive Performance <span className="text-indigo-600">40%</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {renderMetricInput("Quality of Completion", "taskQuality", 7)}
                            {renderMetricInput("Time Commitment", "timeCommitment", 7)}
                            {renderMetricInput("Organizational Compliance", "organizationalCompliance", 7)}
                            {renderMetricInput("Problem Solving & Obstacles", "problemSolving", 6)}
                            {renderMetricInput("Performance Under Pressure", "pressureHandling", 7)}
                            {renderMetricInput("Continuous Development", "continuousDevelopment", 6)}
                        </div>
                    </div>

                    {/* Care and Discipline (15%) */}
                    {/* Shared: Both Dept and Director evaluate this. */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2 flex justify-between">
                            Care & Discipline <span className="text-indigo-600">15%</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {renderMetricInput("Adherence to Regulations", "regulationsAdherence", 3)}
                            {renderMetricInput("Safety Rules Adherence", "safetyAdherence", 3)}
                            {renderMetricInput("Workplace Appearance", "appearanceCommitment", 3)}
                            {renderMetricInput("Resource Preservation", "resourcePreservation", 3)}
                            {renderMetricInput("Data Privacy", "dataPrivacy", 3)}
                        </div>
                    </div>

                    {modalType === 'DEPT' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Observer Comments</label>
                            <textarea
                                value={deptForm.comments}
                                onChange={(e) => setDeptForm({ ...deptForm, comments: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all text-slate-700 min-h-[80px]"
                                placeholder="Add constructive feedback..."
                            />
                        </div>
                    )}

                    <div className="pt-4 border-t sticky bottom-0 bg-white pb-2 flex gap-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`flex-1 px-6 py-4 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${theme.gradient}`}
                        >
                            {modalType === 'DEPT' ? 'Submit Assessment' : modalType === 'PERSONNEL' ? 'Save Record' : 'Finalize & Lock'}
                        </button>
                    </div>
                </form>

                {modalType === 'PERSONNEL' && (
                    <div className="space-y-6 pt-4">
                        {/* Discipline & Incentives */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2">Activity & Discipline</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Warning Messages</label>
                                    <input type="number" min="0" max="3" value={persForm.warningMessages} onChange={e => setPersForm({ ...persForm, warningMessages: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Disciplinary Days</label>
                                    <input type="number" min="0" max="14" value={persForm.disciplinaryDeduction} onChange={e => setPersForm({ ...persForm, disciplinaryDeduction: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Appreciation Msg</label>
                                    <input type="number" min="0" max="3" value={persForm.appreciationMessages} onChange={e => setPersForm({ ...persForm, appreciationMessages: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Exceptional Days</label>
                                    <input type="number" min="0" max="30" value={persForm.exceptionalAssignments} onChange={e => setPersForm({ ...persForm, exceptionalAssignments: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-50 border-transparent rounded-lg font-bold" />
                                </div>
                            </div>
                        </div>

                        {/* Training */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-2">Training & Development</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Specialized Training', key: 'specializedTraining' },
                                    { label: 'Supporting Training', key: 'supportingTraining' },
                                    { label: 'Language Courses', key: 'languageTraining' },
                                    { label: 'Software/Electronic', key: 'softwareTraining' },
                                ].map((item) => (
                                    <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <span className="text-xs font-bold text-slate-600 uppercase">{item.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => setPersForm(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof persForm] }))}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${persForm[item.key as keyof typeof persForm] ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${persForm[item.key as keyof typeof persForm] ? 'translate-x-6' : ''}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default EvaluationsPage;
