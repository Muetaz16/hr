import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { departmentService } from '../../services/departmentService';
import {
    enableEvaluationPeriod,
    disableEvaluationPeriod,
    getEvaluationPeriods,
    enableAllDepartments
} from '../../services/evaluationPeriodService';
import type { Department, EvaluationPeriod } from '../../types';
import { CheckCircle, XCircle, Calendar, Building2 } from 'lucide-react';

const EvaluationControl: React.FC = () => {
    const { currentUser } = useAuth();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [depts, allPeriods] = await Promise.all([
                departmentService.getAllDepartments(),
                getEvaluationPeriods()
            ]);
            setDepartments(depts);
            setPeriods(allPeriods);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEnablePeriod = async () => {
        if (!currentUser?.id || !selectedMonth) {
            alert('Please ensure you are logged in and a month is selected.');
            return;
        }

        try {
            // Enable for all departments by default for simplicity
            await enableAllDepartments(selectedMonth, currentUser.id);
            setNotes('');
            fetchData();
        } catch (error) {
            console.error('Error enabling period:', error);
            alert('Failed to enable evaluation period. Please try again.');
        }
    };


    const handleDisable = async (periodId: string) => {
        if (confirm('Are you sure you want to disable this evaluation period?')) {
            try {
                await disableEvaluationPeriod(periodId);
                fetchData();
            } catch (error) {
                console.error('Error disabling period:', error);
            }
        }
    };

    const getDepartmentName = (id?: string) => {
        if (!id) return 'All Departments';
        return departments.find(d => d.id === id)?.name || id;
    };

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Evaluation Period Control</h1>
                <p className="text-gray-600 mt-1">Enable or disable evaluation periods for departments</p>
            </div>

            {/* Enable New Period */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Enable Evaluation Period</h2>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="inline w-4 h-4 mr-1" />
                            Select Month to Enable Evaluations
                        </label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <button
                        onClick={handleEnablePeriod}
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center font-semibold text-lg"
                    >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Enable Evaluation for All Departments
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">This will allow Department Heads and Directors to evaluate employees for the selected month.</p>
                </div>
            </div>

            {/* Active Periods */}
            <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">Active Evaluation Periods</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enabled At</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {periods.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No evaluation periods enabled
                                    </td>
                                </tr>
                            ) : (
                                periods.map(period => (
                                    <tr key={period.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {period.month}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {getDepartmentName(period.departmentId)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                Enabled
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {period.notes || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(period.enabledAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => handleDisable(period.id)}
                                                className="text-red-600 hover:text-red-900 flex items-center justify-end"
                                            >
                                                <XCircle className="w-4 h-4 mr-1" />
                                                Disable
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EvaluationControl;
