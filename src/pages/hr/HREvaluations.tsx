import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { departmentService } from '../../services/departmentService';
import {
    createOrUpdateHREvaluation,
    getHREvaluationsByMonth,
    calculatePresenceScore
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
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Record<string, string>>({});
    const [evaluations, setEvaluations] = useState<Record<string, Partial<HREvaluation>>>({});
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');



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
                        presenceScore: 20,
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
            // alert('All changes saved successfully'); // Removed to avoid spam, or use toast
            await fetchData(); // Refresh to get IDs etc
        } catch (error) {
            console.error('Error saving evaluations:', error);
            alert('Failed to save some evaluations');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitAll = async () => {
        if (!confirm(t('finalize_confirm'))) {
            return;
        }

        setSubmitting(true);
        try {
            // First ensure all current data is saved
            await handleSaveAll();

            alert(t('all_evaluations_submitted_success'));
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
                (data.presenceScore || 20).toFixed(2),
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
        <div className="space-y-8 max-w-[1600px] mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-outfit font-black text-slate-800 tracking-tight leading-none mb-3">
                        {t('hr_evaluations_title')}
                    </h1>
                    <p className="text-slate-500 font-medium text-lg">{t('hr_evaluations_subtitle')}</p>
                </div>

                <div className="flex items-center gap-4 bg-white/60 backdrop-blur-xl p-2.5 rounded-[20px] shadow-sm border border-slate-200/60 group hover:border-primary-200 transition-all duration-300">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-4">{t('period_label')}</span>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none font-bold text-slate-800 focus:ring-0 cursor-pointer text-sm pr-4"
                    />
                </div>
            </div>

            {/* Premium Toolbar */}
            <div className="flex flex-col xl:flex-row justify-between gap-6">
                <div className="relative w-full xl:w-96 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-[20px] text-sm font-semibold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-400 transition-all duration-300 shadow-sm"
                    />
                </div>

                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={downloadCSV}
                        className="px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-[18px] hover:bg-slate-50 flex items-center shadow-sm transition-all hover:-translate-y-1 active:scale-95 group/btn"
                    >
                        <Download className="w-4 h-4 mr-2.5 group-hover/btn:text-primary-600 transition-colors" />
                        {t('save_as_csv')}
                    </button>
                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-[18px] hover:bg-slate-50 flex items-center shadow-sm transition-all hover:-translate-y-1 active:scale-95 group/btn"
                    >
                        <Save className="w-4 h-4 mr-2.5 group-hover/btn:text-emerald-600 transition-colors" />
                        {saving ? t('saving') : t('save_drafts')}
                    </button>
                    <button
                        onClick={handleSubmitAll}
                        disabled={submitting}
                        className="px-8 py-3.5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-[18px] hover:bg-slate-800 flex items-center shadow-xl transition-all hover:-translate-y-1 active:scale-95 hover:shadow-primary-500/20"
                    >
                        <Send className="w-4 h-4 mr-2.5 text-primary-400" />
                        {submitting ? t('sending') : t('submit_to_departments')}
                    </button>
                </div>
            </div>

            {/* Main Table Container */}
            <div className="glass-card rounded-[32px] overflow-hidden border-none shadow-premium-shadow flex flex-col min-h-[600px]">
                <div className="overflow-auto flex-1 no-scrollbar lg:scrollbar-thin">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-xl">
                            <tr className="border-b border-slate-100">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-80 sticky left-0 bg-slate-50 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100/50">
                                    {t('employee')}
                                </th>
                                {[
                                    { label: t('absence_score'), weight: 7, limit: 7, bg: 'bg-red-50/40', text: 'text-red-600' },
                                    { label: t('delay_score'), weight: 7, limit: 180, bg: 'bg-orange-50/40', text: 'text-orange-600' },
                                    { label: t('emergency_score'), weight: 2, limit: 3 },
                                    { label: t('unpaid_score'), weight: 2, limit: 14 },
                                    { label: t('annual_paid_leave'), weight: 2, limit: 14 },
                                ].map((h, i) => (
                                    <th key={i} className={`p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-32 text-center transition-colors hover:bg-slate-100/30 ${h.bg || ''}`}>
                                        <div className={h.text}>{h.label}</div>
                                        <div className="flex flex-col items-center mt-1">
                                            <div className="text-[8px] font-bold text-slate-300">{t('weight_label')}: {h.weight}</div>
                                            <div className="text-[8px] font-black text-slate-400">MAX: {h.limit}</div>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-32 text-center bg-slate-100/50 border-x border-slate-100">
                                    {t('total')}
                                </th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-24 text-center">{t('status')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                            {filteredEmployees.map((emp, eIdx) => {
                                const data = evaluations[emp.id] || {};
                                const isSubmitted = data.status === 'submitted';

                                return (
                                    <tr 
                                        key={emp.id} 
                                        className="hover:bg-slate-50/80 transition-all duration-300 group/row"
                                        style={{ animationDelay: `${eIdx * 30}ms` }}
                                    >
                                        <td className="p-6 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.03)] border-r border-slate-100 group-hover/row:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-outfit font-black text-sm group-hover/row:bg-white transition-colors border border-slate-50">
                                                    {emp.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="font-extrabold text-slate-800 group-hover/row:text-primary-600 transition-colors">{emp.fullName}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded-md">ID: {emp.staffId || 'N/A'}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">{departments[emp.departmentId] || emp.departmentId}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {[
                                            { field: 'absenceWithoutPermission', max: 7, color: 'text-red-600', bg: 'bg-red-50/10' },
                                            { field: 'delayAndEarlyDeparture', max: 180, color: 'text-orange-600', bg: 'bg-orange-50/10' },
                                            { field: 'emergencyLeaves', max: 3, isPercent: true },
                                            { field: 'unpaidLeave', max: 14, isPercent: true },
                                            { field: 'annualPaidLeave', max: 14, isPercent: true },
                                        ].map((inp, iIdx) => {
                                            const rawValue = data[inp.field as keyof HREvaluation] ?? 0;
                                            const displayValue = inp.isPercent 
                                                ? Math.round((1 - (Number(rawValue) / inp.max)) * 100) 
                                                : rawValue;

                                            return (
                                                <td key={iIdx} className={`p-4 border-r border-slate-100/50 ${inp.bg || ''}`}>
                                                    <div className="relative group/field">
                                                        <div className="absolute -top-2 right-0 flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                                                            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1 rounded uppercase tracking-tighter">
                                                                {inp.isPercent ? 'Score %' : 'Raw'}
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="number" min="0" max={inp.isPercent ? 100 : inp.max}
                                                            disabled={isSubmitted}
                                                            value={displayValue}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value);
                                                                const finalValue = inp.isPercent 
                                                                    ? Math.max(0, (1 - (val / 100)) * inp.max)
                                                                    : val;
                                                                handleInputChange(emp.id, inp.field as keyof HREvaluation, finalValue);
                                                            }}
                                                            className={`w-full text-center font-outfit font-black text-lg bg-transparent border-2 border-transparent hover:border-slate-200 focus:border-primary-400 focus:ring-4 focus:ring-primary-500/10 rounded-xl py-2 transition-all outline-none ${inp.color || 'text-slate-700'}`}
                                                            placeholder={inp.isPercent ? "100" : inp.max.toString()}
                                                        />
                                                        {inp.isPercent && (
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs pointer-events-none">%</div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        <td className="p-6 text-center bg-slate-50/50 font-outfit font-black text-xl text-slate-800 border-r border-slate-100 tabular-nums">
                                            {(data.presenceScore !== undefined ? data.presenceScore : 20).toFixed(2)}
                                        </td>

                                        <td className="p-6 text-center">
                                            {isSubmitted ? (
                                                <div className="inline-flex p-2 bg-emerald-50 text-emerald-600 rounded-xl shadow-inner border border-emerald-100/50 animate-in zoom-in duration-500">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                            ) : data.id ? (
                                                <div className="w-4 h-4 rounded-full bg-primary-500 mx-auto shadow-[0_0_12px_rgba(99,102,241,0.5)] animate-pulse" title={t('draft_saved')} />
                                            ) : (
                                                <div className="w-3 h-3 rounded-full bg-slate-200 mx-auto border border-slate-300/50" />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 rounded-[32px] p-8 gap-6 shadow-2xl relative overflow-hidden group/footer">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full pointer-events-none group-hover/footer:bg-primary-500/20 transition-colors duration-1000"></div>
                
                <div className="text-center sm:text-left relative z-10">
                    <h3 className="text-white font-outfit font-black text-xl mb-1 tracking-tight">{t('finalize_and_send')}</h3>
                    <p className="text-slate-400 text-sm font-medium">{t('finalize_helper')}</p>
                </div>

                <button
                    onClick={handleSubmitAll}
                    disabled={submitting}
                    className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 rounded-[24px] font-black text-sm uppercase tracking-wider flex items-center justify-center shadow-2xl hover:bg-slate-50 transition-all hover:scale-[1.05] active:scale-95 disabled:opacity-50 group/btn-final"
                >
                    <Send className="w-5 h-5 mr-3 group-hover/btn-final:translate-x-1 transition-transform" />
                    {submitting ? t('sending') : t('submit_all_evaluations')}
                </button>
            </div>
        </div>
    );
};

export default HREvaluations;
