import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { 
    createOrUpdateHREvaluation, 
    getHREvaluation, 
    submitHREvaluation,
    getHREvaluationsByMonth,
    getPresenceLimits,
    validateHREvaluation
} from '../../services/hrEvaluationService';
import { isEvaluationEnabled } from '../../services/evaluationPeriodService';
import type { Employee, HREvaluation } from '../../types';
import { 
    AlertCircle, 
    CheckCircle2, 
    Save,
    Send,
    Eye,
    Edit
} from 'lucide-react';

const HREvaluations: React.FC = () => {
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [evaluations, setEvaluations] = useState<HREvaluation[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [currentEvaluation, setCurrentEvaluation] = useState<Partial<HREvaluation> | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
    const [evaluationEnabled, setEvaluationEnabled] = useState(false);

    const presenceLimits = getPresenceLimits();

    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [emps, evals, enabled] = await Promise.all([
                employeeService.getAllEmployees(),
                getHREvaluationsByMonth(selectedMonth),
                isEvaluationEnabled(selectedMonth)
            ]);
            
            setEmployees(emps);
            setEvaluations(evals);
            setEvaluationEnabled(enabled);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectEmployee = async (employee: Employee) => {
        setSelectedEmployee(employee);
        const existingEvaluation = await getHREvaluation(employee.id, selectedMonth);
        
        if (existingEvaluation) {
            setCurrentEvaluation(existingEvaluation);
        } else {
            setCurrentEvaluation({
                employeeId: employee.id,
                month: selectedMonth,
                absenceWithoutPermission: 0,
                delayAndEarlyDeparture: 0,
                emergencyLeaves: 0,
                unpaidLeave: 0,
                annualPaidLeave: 0,
                presenceScore: 10,
                status: 'draft'
            });
        }
        setErrors([]);
        setViewMode('edit');
    };

    const handleInputChange = (field: keyof HREvaluation, value: number) => {
        if (!currentEvaluation) return;
        
        const updated = { ...currentEvaluation, [field]: value };
        setCurrentEvaluation(updated);
        
        // Validate on change
        const validation = validateHREvaluation(updated);
        setErrors(validation.errors);
    };

    const handleSave = async () => {
        if (!currentEvaluation || !selectedEmployee || !currentUser) return;

        const validation = validateHREvaluation(currentEvaluation);
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        setSaving(true);
        try {
            await createOrUpdateHREvaluation(
                selectedEmployee.id,
                selectedMonth,
                currentEvaluation as Omit<HREvaluation, 'id' | 'submittedAt' | 'submittedBy'>,
                currentUser.id
            );
            
            await fetchData();
            setViewMode('list');
            setSelectedEmployee(null);
            setCurrentEvaluation(null);
        } catch (error) {
            console.error('Error saving evaluation:', error);
            setErrors(['Failed to save evaluation']);
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async () => {
        if (!currentEvaluation || !selectedEmployee) return;

        const validation = validateHREvaluation(currentEvaluation);
        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        setSaving(true);
        try {
            await createOrUpdateHREvaluation(
                selectedEmployee.id,
                selectedMonth,
                currentEvaluation as Omit<HREvaluation, 'id' | 'submittedAt' | 'submittedBy'>,
                currentUser!.id
            );
            
            await submitHREvaluation(selectedEmployee.id, selectedMonth);
            
            await fetchData();
            setViewMode('list');
            setSelectedEmployee(null);
            setCurrentEvaluation(null);
        } catch (error) {
            console.error('Error submitting evaluation:', error);
            setErrors(['Failed to submit evaluation']);
        } finally {
            setSaving(false);
        }
    };

    const getStatusBadge = (evaluation: HREvaluation) => {
        if (evaluation.status === 'submitted') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Submitted
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <Edit className="w-3 h-3 mr-1" />
                Draft
            </span>
        );
    };

    if (loading) {
        return <div className="p-6">Loading...</div>;
    }

    if (!evaluationEnabled) {
        return (
            <div className="p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                        <h3 className="text-lg font-medium text-yellow-800">Evaluation Period Not Enabled</h3>
                    </div>
                    <p className="text-yellow-700 mt-2">
                        HR evaluations for {selectedMonth} are not enabled yet. Please enable the evaluation period first.
                    </p>
                </div>
            </div>
        );
    }

    if (viewMode === 'edit' && selectedEmployee && currentEvaluation) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">HR Presence Evaluation</h1>
                        <p className="text-gray-600 mt-1">
                            {selectedEmployee.fullName} - {selectedMonth}
                        </p>
                    </div>
                    <button
                        onClick={() => setViewMode('list')}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Back to List
                    </button>
                </div>

                {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                            <h3 className="text-sm font-medium text-red-800">Validation Errors</h3>
                        </div>
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                            {errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-800">Presence Criteria</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Based on the evaluation limits. Presence score will be calculated automatically.
                        </p>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Absence without permission */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Absence without permission (days)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={presenceLimits.absenceWithoutPermission}
                                    value={currentEvaluation.absenceWithoutPermission || 0}
                                    onChange={(e) => handleInputChange('absenceWithoutPermission', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: {presenceLimits.absenceWithoutPermission} days
                                </p>
                            </div>

                            {/* Delay and early departure */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Delay and early departure (minutes)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={presenceLimits.delayAndEarlyDeparture}
                                    value={currentEvaluation.delayAndEarlyDeparture || 0}
                                    onChange={(e) => handleInputChange('delayAndEarlyDeparture', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: {presenceLimits.delayAndEarlyDeparture} minutes
                                </p>
                            </div>

                            {/* Emergency leaves */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Emergency leaves (days)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={presenceLimits.emergencyLeaves}
                                    value={currentEvaluation.emergencyLeaves || 0}
                                    onChange={(e) => handleInputChange('emergencyLeaves', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: {presenceLimits.emergencyLeaves} days
                                </p>
                            </div>

                            {/* Unpaid leave */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Unpaid leave (days)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={presenceLimits.unpaidLeave}
                                    value={currentEvaluation.unpaidLeave || 0}
                                    onChange={(e) => handleInputChange('unpaidLeave', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: {presenceLimits.unpaidLeave} days
                                </p>
                            </div>

                            {/* Annual paid leave */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Annual paid leave (days)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={presenceLimits.annualPaidLeave}
                                    value={currentEvaluation.annualPaidLeave || 0}
                                    onChange={(e) => handleInputChange('annualPaidLeave', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Maximum: {presenceLimits.annualPaidLeave} days
                                </p>
                            </div>

                            {/* Calculated presence score */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Calculated Presence Score
                                </label>
                                <div className="text-2xl font-bold text-blue-600">
                                    {currentEvaluation.presenceScore?.toFixed(2) || '10.00'} / 10
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Automatically calculated based on presence criteria
                                </p>
                            </div>
                        </div>

                        {/* Comments */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Comments (optional)
                            </label>
                            <textarea
                                rows={3}
                                value={currentEvaluation.comments || ''}
                                onChange={(e) => setCurrentEvaluation({ ...currentEvaluation, comments: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Add any additional comments about this evaluation..."
                            />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end space-x-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || currentEvaluation.status === 'submitted'}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        {saving ? 'Submitting...' : 'Submit Evaluation'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">HR Presence Evaluations</h1>
                <p className="text-gray-600 mt-1">Evaluate employee presence for {selectedMonth}</p>
            </div>

            {/* Month selector */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-gray-700">Month:</label>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Employee list */}
            <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">Employees</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Presence Score</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No employees found
                                    </td>
                                </tr>
                            ) : (
                                employees.map((employee) => {
                                    const evaluation = evaluations.find(e => e.employeeId === employee.id);
                                    return (
                                        <tr key={employee.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{employee.fullName}</div>
                                                <div className="text-sm text-gray-500">{employee.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {employee.departmentId}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {evaluation ? getStatusBadge(evaluation) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        Not Started
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {evaluation ? (
                                                    <div className="flex items-center">
                                                        <span className="font-medium">{evaluation.presenceScore.toFixed(2)}</span>
                                                        <span className="text-gray-400 ml-1">/10</span>
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleSelectEmployee(employee)}
                                                    className="text-blue-600 hover:text-blue-900 flex items-center justify-end"
                                                >
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    {evaluation ? 'View/Edit' : 'Evaluate'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HREvaluations;
