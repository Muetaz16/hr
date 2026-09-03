import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { departmentService } from '../../services/departmentService';
import {
    disableEvaluationPeriod,
    getEvaluationPeriods,
    enableAllDepartments
} from '../../services/evaluationPeriodService';
import type { Department, EvaluationPeriod } from '../../types';
import { CheckCircle, XCircle, Calendar, RefreshCw } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmDialog';
import { recomputePresence } from '../../services/hrEvaluationService';
import EvaluationOverview from './EvaluationOverview';

// `embedded`: rendered inside another page's own padded container (e.g. the
// Personnel Relations "evaluations" tab) — drop this component's own outer
// page padding so the two don't stack.
const EvaluationControl: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
    const { t, i18n } = useTranslation();
    const { currentUser } = useAuth();
    const confirm = useConfirm();

    const [departments, setDepartments] = useState<Department[]>([]);
    const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [depts, allPeriods] = await Promise.all([
                departmentService.getAllDepartments(),
                getEvaluationPeriods(),
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
            alert(t('login_error'));
            return;
        }
        try {
            await enableAllDepartments(selectedMonth, currentUser.id);
            const allPeriods = await getEvaluationPeriods();
            setPeriods(allPeriods);
        } catch (error) {
            console.error('Error enabling period:', error);
            alert(t('failed_to_enable_evaluation_period', { defaultValue: 'Failed to enable evaluation period.' }));
        }
    };

    const handleDisable = async (periodId: string) => {
        if (await confirm({ message: t('disable_period_confirm'), danger: false })) {
            try {
                await disableEvaluationPeriod(periodId);
                const allPeriods = await getEvaluationPeriods();
                setPeriods(allPeriods);
            } catch (error) {
                console.error('Error disabling period:', error);
            }
        }
    };

    const handleSyncPresence = async () => {
        if (!selectedMonth) return;
        setSyncing(true);
        try {
            const result = await recomputePresence(selectedMonth);
            alert(`${t('presence_sync_result', { stored: result.stored, skipped: result.skipped })}`);
            setOverviewRefreshKey(k => k + 1);
        } catch (error) {
            console.error('Error syncing presence:', error);
            alert(t('presence_sync_failed'));
        } finally {
            setSyncing(false);
        }
    };

    const getDepartmentName = (id?: string) => {
        if (!id) return t('all_departments', { defaultValue: 'All Departments' });
        return departments.find(d => d.id === id)?.name || id;
    };

    if (loading) return <div className="p-6">{t('loading', { defaultValue: 'Loading...' })}</div>;

    return (
        <div className={`${embedded ? '' : 'p-6 '}space-y-8 animate-[fadeIn_0.5s_ease-out]`}>
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800">{t('evaluation_control_title')}</h1>
                <p className="text-slate-500 mt-1">{t('evaluation_control_subtitle')}</p>
            </div>

            {/* Evaluation Period Control */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:col-span-1 flex flex-col">
                    <h2 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><Calendar className="w-4 h-4" /></span>
                        {t('enable_evaluation_period')}
                    </h2>
                    <div className="space-y-4 flex-1 flex flex-col">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                {t('select_month_enable')}
                            </label>
                            <input
                                type="month"
                                lang={i18n.language}
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={handleEnablePeriod}
                            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            {t('enable_all_departments')}
                        </button>
                        <button
                            onClick={handleSyncPresence}
                            disabled={syncing}
                            className="w-full mt-auto px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                            {t('sync_presence_from_attendance')}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-2 flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                        <h2 className="text-base font-bold text-slate-800">{t('active_evaluation_periods')}</h2>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-start">
                            <thead className="bg-slate-50 text-slate-400">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('month')}</th>
                                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('department')}</th>
                                    <th className="px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-start">{t('status')}</th>
                                    <th className="px-6 py-3 text-end text-[10px] uppercase tracking-widest font-bold">{t('actions')}</th>
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
                                                {period.enabled ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                                        <CheckCircle className="w-3 h-3 me-1" />
                                                        {t('enabled', { defaultValue: 'Enabled' })}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                        <XCircle className="w-3 h-3 me-1" />
                                                        {t('disabled', { defaultValue: 'Disabled' })}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-end">
                                                {period.enabled ? (
                                                    <button
                                                        onClick={() => handleDisable(period.id)}
                                                        className="inline-flex items-center text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors text-xs font-bold"
                                                    >
                                                        <XCircle className="w-4 h-4 me-1" />
                                                        {t('disable', { defaultValue: 'Disable' })}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <EvaluationOverview key={overviewRefreshKey} month={selectedMonth} />
        </div>
    );
};

export default EvaluationControl;
