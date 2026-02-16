import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import {
    createOrUpdateHREvaluation,
    getHREvaluationsByMonth,
    getPresenceLimits,
    calculatePresenceScore,
    submitAllHREvaluationsForMonth
} from '../../services/hrEvaluationService';
import type { Employee, HREvaluation, Department } from '../../types';
import {
    CheckCircle2,
    Save,
    Send,
    Search,
    Download
} from 'lucide-react';

const HREvaluations: React.FC = () => {
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Record<string, string>>({});
    const [evaluations, setEvaluations] = useState<Record<string, Partial<HREvaluation>>>({});
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const presenceLimits = getPresenceLimits();

    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [emps, evalsList, depts] = await Promise.all([
                employeeService.getAllEmployees(),
                getHREvaluationsByMonth(selectedMonth),
                departmentService.getAllDepartments()
            ]);

            setEmployees(emps);

            // Map department IDs to names
            const deptMap: Record<string, string> = {};
            depts.forEach((d: Department) => {
                deptMap[d.id] = d.name;
            });
            setDepartments(deptMap);

            // Convert list to map for easier access
            const evalsMap: Record<string, Partial<HREvaluation>> = {};

            // Initialize all employees with default or existing data
            emps.forEach(emp => {
                const existing = evalsList.find(e => e.employeeId === emp.id);
                if (existing) {
                    evalsMap[emp.id] = existing;
                } else {
                    evalsMap[emp.id] = {
                        employeeId: emp.id,
                        month: selectedMonth,
                        absenceWithoutPermission: 0,
                        delayAndEarlyDeparture: 0,
                        emergencyLeaves: 0,
                        unpaidLeave: 0,
                        annualPaidLeave: 0,
                        presenceScore: 100,
                        status: 'draft'
                    };
                }
            });
            setEvaluations(evalsMap);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (employeeId: string, field: keyof HREvaluation, value: number) => {
        setEvaluations(prev => {
            const currentEval = { ...prev[employeeId] };

            // Update field
            // @ts-ignore - dynamic key assignment
            currentEval[field] = value;

            // Recalculate score
            // We need to cast to strictly Omit<HREvaluation, ...> for the calculator
            // but for partial updates, we can just pass the partial object as any to the helper
            // providing we ensure the fields exist.
            // Recalculate score
            const score = calculatePresenceScore(currentEval);
            currentEval.presenceScore = score;

            return {
                ...prev,
                [employeeId]: currentEval
            };
        });
    };

    const handleSaveAll = async () => {
        if (!currentUser) return;
        setSaving(true);
        try {
            const promises = Object.values(evaluations).map(evalData => {
                // Only save if it has changed from default? 
                // For now, save all to ensure consistency.
                if (!evalData.employeeId) return Promise.resolve();

                return createOrUpdateHREvaluation(
                    evalData.employeeId!,
                    selectedMonth,
                    evalData as Omit<HREvaluation, 'id' | 'submittedAt' | 'submittedBy'>,
                    currentUser.id || 'unknown'
                );
            });

            await Promise.all(promises);
            alert('All changes saved successfully');
            await fetchData(); // Refresh to get IDs etc
        } catch (error) {
            console.error('Error saving evaluations:', error);
            alert('Failed to save some evaluations');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitAll = async () => {
        if (!confirm('Are you sure you want to finalize ALL evaluations? This will send them to Department Heads and you will not be able to edit them efficiently anymore.')) {
            return;
        }

        setSubmitting(true);
        try {
            // First ensure all current data is saved
            await handleSaveAll();

            // Then mark all as submitted
            await submitAllHREvaluationsForMonth(selectedMonth);

            alert('All evaluations have been submitted to Department Heads!');
            await fetchData();
        } catch (error) {
            console.error('Error submitting evaluations:', error);
            alert('Failed to submit evaluations');
        } finally {
            setSubmitting(false);
        }
    };

    const downloadCSV = () => {
        // Headers
        const headers = [
            'Employee ID', 'Name', 'Department', 'Month',
            'Absence Without Permission', 'Delay & Early Departure (Mins)', 'Emergency Leaves',
            'Unpaid Leave', 'Annual Paid Leave', 'Presence Score', 'Evaluation Status'
        ];

        // Rows
        const rows = employees.map(emp => {
            const data = evaluations[emp.id] || {};
            const deptName = departments[emp.departmentId] || emp.departmentId; // Fallback to ID if name not found
            return [
                emp.id,
                emp.fullName,
                deptName,
                selectedMonth,
                data.absenceWithoutPermission || 0,
                data.delayAndEarlyDeparture || 0,
                data.emergencyLeaves || 0,
                data.unpaidLeave || 0,
                data.annualPaidLeave || 0,
                (data.presenceScore || 100).toFixed(2),
                data.status || 'draft'
            ].map(val => `"${val}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `HR_Evaluations_${selectedMonth}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.departmentId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-600"></div></div>;

    // Removed evaluationEnabled check to allow manual entry at any time as requested.

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">HR Presence Evaluations</h1>
                    <p className="text-slate-500">Enter attendance and presence metrics for all employees.</p>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <span className="text-sm font-bold text-slate-500 pl-2">Period:</span>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="border-none bg-transparent font-bold text-slate-800 focus:ring-0 cursor-pointer"
                    />
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={downloadCSV}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 flex items-center shadow-sm transition-all"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Save as CSV
                    </button>
                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50 flex items-center shadow-sm transition-all"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Drafts'}
                    </button>
                    <button
                        onClick={handleSubmitAll}
                        disabled={submitting}
                        className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex items-center shadow-md transition-all"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        {submitting ? 'Sending...' : 'Submit to Departments'}
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                            <tr className="border-b border-slate-200">
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-64 sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    Employee
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 bg-red-50/50 text-center">
                                    <div>Absence</div>
                                    <div className="text-[9px] text-red-300 font-normal">Weight: 7</div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 bg-orange-50/50 text-center">
                                    <div>Delay</div>
                                    <div className="text-[9px] text-orange-300 font-normal">Weight: 7</div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">
                                    <div>Emergency</div>
                                    <div className="text-[9px] text-slate-300 font-normal">Weight: 2</div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">
                                    <div>Unpaid</div>
                                    <div className="text-[9px] text-slate-300 font-normal">Weight: 2</div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">
                                    <div>Violation</div>
                                    <div className="text-[9px] text-slate-300 font-normal">Weight: 2</div>
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-24 text-center bg-slate-100">
                                    Score
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-16 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map(emp => {
                                const data = evaluations[emp.id] || {};
                                const isSubmitted = data.status === 'submitted';

                                return (
                                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100">
                                            <div>
                                                <div className="font-bold text-slate-800">{emp.fullName}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {emp.staffId || 'N/A'}</div>
                                                <div className="text-xs text-slate-400">{departments[emp.departmentId] || emp.departmentId}</div>
                                            </div>
                                        </td>

                                        {/* Absence Score */}
                                        <td className="p-2 border-r border-slate-100 bg-red-50/10">
                                            <input
                                                type="number" min="0" max="100"
                                                disabled={isSubmitted}
                                                value={data.absenceScoreValue ?? 100}
                                                onChange={(e) => handleInputChange(emp.id, 'absenceScoreValue', Number(e.target.value))}
                                                className="w-full text-center font-mono font-bold text-red-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md py-1"
                                                placeholder="100"
                                            />
                                        </td>

                                        {/* Delay Score */}
                                        <td className="p-2 border-r border-slate-100 bg-orange-50/10">
                                            <input
                                                type="number" min="0" max="100"
                                                disabled={isSubmitted}
                                                value={data.delayScoreValue ?? 100}
                                                onChange={(e) => handleInputChange(emp.id, 'delayScoreValue', Number(e.target.value))}
                                                className="w-full text-center font-mono font-bold text-orange-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md py-1"
                                                placeholder="100"
                                            />
                                        </td>

                                        {/* Emergency Score */}
                                        <td className="p-2 border-r border-slate-100">
                                            <input
                                                type="number" min="0" max="100"
                                                disabled={isSubmitted}
                                                value={data.emergencyScoreValue ?? 100}
                                                onChange={(e) => handleInputChange(emp.id, 'emergencyScoreValue', Number(e.target.value))}
                                                className="w-full text-center font-mono text-slate-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md py-1"
                                                placeholder="100"
                                            />
                                        </td>

                                        {/* Unpaid Score */}
                                        <td className="p-2 border-r border-slate-100">
                                            <input
                                                type="number" min="0" max="100"
                                                disabled={isSubmitted}
                                                value={data.unpaidScoreValue ?? 100}
                                                onChange={(e) => handleInputChange(emp.id, 'unpaidScoreValue', Number(e.target.value))}
                                                className="w-full text-center font-mono text-slate-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md py-1"
                                                placeholder="100"
                                            />
                                        </td>

                                        {/* Violation (Annual) Score */}
                                        <td className="p-2 border-r border-slate-100">
                                            <input
                                                type="number" min="0" max="100"
                                                disabled={isSubmitted}
                                                value={data.violationScoreValue ?? 100}
                                                onChange={(e) => handleInputChange(emp.id, 'violationScoreValue', Number(e.target.value))}
                                                className="w-full text-center font-mono text-slate-700 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md py-1"
                                                placeholder="100"
                                            />
                                        </td>

                                        {/* Score */}
                                        <td className="p-4 text-center bg-slate-50 font-bold text-slate-800 border-r border-slate-200">
                                            {(data.presenceScore !== undefined ? data.presenceScore : 100).toFixed(2)}
                                        </td>

                                        {/* Status */}
                                        <td className="p-4 text-center">
                                            {isSubmitted ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-slate-300 mx-auto" />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSubmitAll}
                    disabled={submitting}
                    className="flex flex-col items-center justify-center w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                >
                    <span className="font-bold text-lg flex items-center">
                        <Send className="w-5 h-5 mr-2" />
                        Finalize & Send to Departments
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                        This will unlock Department Head evaluations
                    </span>
                </button>
            </div>
        </div>
    );
};

export default HREvaluations;
