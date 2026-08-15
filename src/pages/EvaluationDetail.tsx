import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { employeeService } from '../services/employeeService';
import { fetchEvaluationBreakdown, type EvaluationBreakdown } from '../utils/evaluationScoring';
import type { OrgPlacement } from '../utils/evaluationHierarchy';
import type { Employee } from '../types';
import EvaluationBreakdownView from '../components/EvaluationBreakdownView';

// Self-service "My Evaluation" page — resolves the logged-in user's own
// Employee record server-side (GET /employees/me), same pattern as
// MyAttendance.tsx, so there is never a client-supplied employeeId to trust.
const EvaluationDetail: React.FC = () => {
    const { t } = useTranslation();
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [breakdown, setBreakdown] = useState<EvaluationBreakdown | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { fetchMe(); }, []);
    useEffect(() => { if (employee) fetchBreakdown(employee); }, [month, employee]);

    const fetchMe = async () => {
        try {
            const me = await employeeService.getMyEmployeeRecord();
            setEmployee(me);
        } catch (err) {
            console.error('Error resolving my employee record:', err);
            setError(t('no_employee_record', { defaultValue: 'No employee record is linked to your account yet.' }));
            setLoading(false);
        }
    };

    const fetchBreakdown = async (emp: Employee) => {
        setLoading(true);
        try {
            const result = await fetchEvaluationBreakdown(emp as unknown as OrgPlacement & { id: string }, month);
            setBreakdown(result);
        } catch (err) {
            console.error('Error fetching evaluation breakdown:', err);
        } finally {
            setLoading(false);
        }
    };

    if (error) return <div className="p-6 text-center text-slate-400">{error}</div>;

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto animate-[fadeIn_0.5s_ease-out]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">{t('nav_my_evaluation_results', { defaultValue: 'My Evaluation' })}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t('evaluations_subtitle')}</p>
                </div>
                <div className="glass-card flex items-center px-4 py-2 rounded-2xl border border-slate-200 bg-white">
                    <Calendar className="w-4 h-4 text-slate-500 mr-2" />
                    <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent border-none text-slate-800 font-bold focus:ring-0 text-sm p-0 cursor-pointer" />
                </div>
            </div>

            {loading || !employee || !breakdown ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
                </div>
            ) : (
                <EvaluationBreakdownView employee={employee} breakdown={breakdown} />
            )}
        </div>
    );
};

export default EvaluationDetail;
