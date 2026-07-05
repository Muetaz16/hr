import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import { evaluationService } from '../../services/evaluationService';
import { getHREvaluationsByMonth } from '../../services/hrEvaluationService';
import {
    disableEvaluationPeriod,
    getEvaluationPeriods,
    enableAllDepartments
} from '../../services/evaluationPeriodService';
import type { Department, EvaluationPeriod, Employee } from '../../types';
import { CheckCircle, XCircle, Calendar, Trash2, AlertTriangle, Search } from 'lucide-react';

type EvaluationType = 'HR' | 'DEPT' | 'DIRECTOR' | 'PERSONNEL';

const EvaluationControl: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();

    // State
    const [departments, setDepartments] = useState<Department[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(true);

    // Monitoring State
    const [activeTab, setActiveTab] = useState<EvaluationType>('DIRECTOR'); // Default to Director
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [monitorLoading, setMonitorLoading] = useState(false);
    const [monitorSearchTerm, setMonitorSearchTerm] = useState('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchEvaluations();
    }, [selectedMonth, activeTab]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [depts, allPeriods, allEmps] = await Promise.all([
                departmentService.getAllDepartments(),
                getEvaluationPeriods(),
                employeeService.getAllEmployees()
            ]);
            setDepartments(depts);
            setPeriods(allPeriods);
            setEmployees(allEmps);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEvaluations = async () => {
        setMonitorLoading(true);
        setEvaluations([]);
        try {
            let data: any[] = [];
            if (activeTab === 'HR') {
                data = await getHREvaluationsByMonth(selectedMonth);
            } else if (activeTab === 'DEPT') {
                data = await evaluationService.getDeptEvaluationsByMonth(selectedMonth);
            } else if (activeTab === 'DIRECTOR') {
                data = await evaluationService.getDirectorEvaluationsByMonth(selectedMonth);
            } else if (activeTab === 'PERSONNEL') {
                data = await evaluationService.getPersonnelEvaluationsByMonth(selectedMonth);
            }
            setEvaluations(data);
        } catch (error) {
            console.error("Error fetching evaluations:", error);
        } finally {
            setMonitorLoading(false);
        }
    };

    const handleEnablePeriod = async () => {
        if (!currentUser?.id || !selectedMonth) {
            alert(t('login_error'));
            return;
        }
        try {
            await enableAllDepartments(selectedMonth, currentUser.id);
            // Refresh periods
            const allPeriods = await getEvaluationPeriods();
            setPeriods(allPeriods);
        } catch (error) {
            console.error('Error enabling period:', error);
            alert('Failed to enable evaluation period.');
        }
    };

    const handleDisable = async (periodId: string) => {
        if (confirm(t('disable_period_confirm'))) {
            try {
                await disableEvaluationPeriod(periodId);
                const allPeriods = await getEvaluationPeriods();
                setPeriods(allPeriods);
            } catch (error) {
                console.error('Error disabling period:', error);
            }
        }
    };

    const handleDeleteEvaluation = async (id: string, type: EvaluationType) => {
        if (!window.confirm("Are you sure you want to DELETE this evaluation? This action cannot be undone.")) return;

        try {
            if (type === 'HR') await evaluationService.deleteHREvaluation(id);
            if (type === 'DEPT') await evaluationService.deleteDeptEvaluation(id);
            if (type === 'DIRECTOR') await evaluationService.deleteDirectorEvaluation(id);
            if (type === 'PERSONNEL') await evaluationService.deletePersonnelEvaluation(id);

            // Refresh list
            fetchEvaluations();
        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete evaluation");
        }
    };

    const getEmployeeName = (id?: string) => {
        if (!id) return 'Unknown';
        return employees.find(e => e.id === id)?.fullName || 'Unknown';
    };

    const filteredEvaluations = evaluations.filter(ev => {
        const name = getEmployeeName(ev.employeeId).toLowerCase();
        return name.includes(monitorSearchTerm.toLowerCase());
    });

    const getDepartmentName = (id?: string) => {
        if (!id) return 'All Departments';
        return departments.find(d => d.id === id)?.name || id;
    };

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 space-y-8 animate-[fadeIn_0.5s_ease-out]">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800">{t('evaluation_control_title')}</h1>
                <p className="text-slate-500 mt-1">{t('evaluation_control_subtitle')}</p>
            </div>

            {/* Control Section (Enable/Disable) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Enable New Period */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:col-span-1">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        {t('enable_evaluation_period')}
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                                {t('select_month_enable')}
                            </label>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleEnablePeriod}
                            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            {t('enable_all_departments')}
                        </button>
                    </div>
                </div>

                {/* Active Periods List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-0 overflow-hidden lg:col-span-2 flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-lg font-bold text-slate-800">{t('active_evaluation_periods')}</h2>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold">{t('month')}</th>
                                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold">{t('department')}</th>
                                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold">{t('status')}</th>
                                    <th className="px-6 py-3 text-right text-[10px] uppercase tracking-widest font-bold">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {periods.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                                            {t('no_periods_enabled')}
                                        </td>
                                    </tr>
                                ) : (
                                    periods.map(period => (
                                        <tr key={period.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-700">{period.month}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{getDepartmentName(period.departmentId)}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Enabled
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDisable(period.id)}
                                                    className="inline-flex items-center text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors text-xs font-bold"
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

            {/* Monitoring Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Evaluation Monitor & Control
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            View and manage all submitted evaluations for <strong>{selectedMonth}</strong>.
                        </p>
                    </div>

                    {/* Search and Tabs */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input 
                                type="text"
                                placeholder="Search employee..."
                                value={monitorSearchTerm}
                                onChange={(e) => setMonitorSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-64 outline-none"
                            />
                        </div>

                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            {(['DIRECTOR', 'DEPT', 'HR', 'PERSONNEL'] as EvaluationType[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {monitorLoading ? (
                        <div className="p-12 text-center text-slate-400">Loading evaluations...</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold">Employee</th>
                                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold">Score</th>
                                    <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold">Status</th>
                                    <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest font-bold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEvaluations.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm">
                                            No {activeTab.toLowerCase()} evaluations found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEvaluations.map((evalItem) => (
                                        <tr key={evalItem.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700">{getEmployeeName(evalItem.employeeId)}</div>
                                                <div className="text-xs text-slate-400">ID: {evalItem.employeeId}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                    {evalItem.finalScore || evalItem.totalScore || evalItem.presenceScore || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {evalItem.locked ? (
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded flex items-center w-fit gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Locked
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded flex items-center w-fit gap-1">
                                                        Open
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteEvaluation(evalItem.id, activeTab)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete Evaluation"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EvaluationControl;
