import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { employeeService } from '../services/employeeService';
import { timeService } from '../services/timeService';
import type { Employee, TimeRecord, UserRole } from '../types';
import {
    Calendar,
    Save,
    Search,
    Filter,
    AlertCircle,
    CheckCircle2,
    Timer,
    ArrowUpRight,
    User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { roleThemes } from '../config/roleThemes';

const TimeTrackingPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [timeRecords, setTimeRecords] = useState<Record<string, TimeRecord>>({});
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [saving, setSaving] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    useEffect(() => {
        fetchData();
    }, [selectedMonth, currentUser]);

    const fetchData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            let emps: Employee[] = [];
            if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'HR_MANAGER') {
                emps = await employeeService.getAllEmployees();
            } else if (currentUser.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                emps = await employeeService.getEmployeesByDepartment(currentUser.departmentId);
            } else if (currentUser.role === 'HEAD_DIRECTOR' && currentUser.groupId) {
                emps = await employeeService.getEmployeesByGroup(currentUser.groupId);
            }

            setEmployees(emps);

            const records = await timeService.getTimeRecordsByMonth(selectedMonth);
            const recordsMap: Record<string, TimeRecord> = {};
            records.forEach(r => recordsMap[r.employeeId] = r);
            setTimeRecords(recordsMap);

        } catch (error) {
            console.error("Error fetching time tracking data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (employeeId: string, field: keyof TimeRecord, value: number) => {
        setTimeRecords(prev => ({
            ...prev,
            [employeeId]: {
                ...prev[employeeId],
                employeeId,
                month: selectedMonth,
                [field]: value
            } as TimeRecord
        }));
    };

    const saveRecord = async (employeeId: string) => {
        const record = timeRecords[employeeId];
        if (!record) return;

        setSaving(employeeId);
        try {
            await timeService.createOrUpdateTimeRecord({
                employeeId,
                month: selectedMonth,
                assignedHours: Number(record.assignedHours || 0),
                workedHours: Number(record.workedHours || 0),
                overtime: Number(record.overtime || 0),
                absences: Number(record.absences || 0),
                lateMinutes: Number(record.lateMinutes || 0)
            });
        } catch (error) {
            console.error("Error saving time record:", error);
            alert("Failed to save record");
        } finally {
            setSaving(null);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Summary stats for HR
    const totalAssigned = Object.values(timeRecords).reduce((acc, r) => acc + (r.assignedHours || 0), 0);
    const totalWorked = Object.values(timeRecords).reduce((acc, r) => acc + (r.workedHours || 0), 0);
    const totalOvertime = Object.values(timeRecords).reduce((acc, r) => acc + (r.overtime || 0), 0);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-[slideIn_0.5s_ease-out_forwards]">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/20">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">{t('time_attendance_title')}</h1>
                    <p className="text-slate-500 mt-1">{t('time_attendance_subtitle')}</p>
                </div>

                <div className="flex items-center gap-4 bg-white/40 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-white/40">
                    <div className="flex items-center px-4 py-2 bg-white/60 rounded-xl shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-500 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Row for HR/Admins */}
            {(currentUser?.role === 'HR_MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 rounded-3xl border-l-4 border-blue-500 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-blue-500/20"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">{t('global_capacity')}</span>
                            <div className="p-2 bg-blue-50/80 rounded-lg">
                                <Timer className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>
                        <div className="flex items-end gap-2 relative z-10">
                            <span className="text-3xl font-outfit font-bold text-slate-800">{totalAssigned}h</span>
                            <span className="text-xs text-slate-400 mb-1.5 font-medium">{t('assigned_total')}</span>
                        </div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-500 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-emerald-500/20"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">{t('actual_engagement')}</span>
                            <div className="p-2 bg-emerald-50/80 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            </div>
                        </div>
                        <div className="flex items-end gap-2 relative z-10">
                            <span className="text-3xl font-outfit font-bold text-slate-800">{totalWorked}h</span>
                            <span className="text-xs text-emerald-600 mb-1.5 font-bold bg-emerald-50 px-1.5 rounded">{((totalWorked / (totalAssigned || 1)) * 100).toFixed(1)}% {t('yield')}</span>
                        </div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-l-4 border-orange-500 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-xl -mr-6 -mt-6 transition-all group-hover:bg-orange-500/20"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">{t('overtime_burn')}</span>
                            <div className="p-2 bg-orange-50/80 rounded-lg">
                                <ArrowUpRight className="w-5 h-5 text-orange-500" />
                            </div>
                        </div>
                        <div className="flex items-end gap-2 relative z-10">
                            <span className="text-3xl font-outfit font-bold text-slate-800">{totalOvertime}h</span>
                            <span className="text-xs text-orange-600 mb-1.5 font-bold bg-orange-50 px-1.5 rounded">{t('priority_status')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Table */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white/40">
                <div className="p-6 border-b border-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/30 backdrop-blur-md">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('find_workforce_member')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-4 py-2.5 bg-white/50 border-white/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all w-full sm:w-80 shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/40 rounded-xl border border-white/40">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{filteredEmployees.length} {t('members_list')}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-left">
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('identity')}</th>
                                <th className="px-5 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('assigned')}</th>
                                <th className="px-5 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('worked')}</th>
                                <th className="px-5 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('overtime')}</th>
                                <th className="px-5 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('absence')}</th>
                                <th className="px-5 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('late')}</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">{t('commit')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => {
                                const record = timeRecords[emp.id] || {
                                    assignedHours: 0,
                                    workedHours: 0,
                                    overtime: 0,
                                    absences: 0,
                                    lateMinutes: 0
                                };

                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 mr-4 group-hover:scale-105 transition-all shadow-sm`}>
                                                    <UserIcon size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">{emp.fullName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{t('active_engagement')}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <input
                                                type="number" min="0"
                                                className="w-20 mx-auto block px-3 py-2 bg-slate-50 border-transparent rounded-lg text-center text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all outline-none group-hover:bg-white border border-slate-100"
                                                value={record.assignedHours}
                                                onChange={(e) => handleInputChange(emp.id, 'assignedHours', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-5 py-4">
                                            <input
                                                type="number" min="0"
                                                className="w-20 mx-auto block px-3 py-2 bg-slate-50 border-transparent rounded-lg text-center text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all outline-none group-hover:bg-white border border-slate-100"
                                                value={record.workedHours}
                                                onChange={(e) => handleInputChange(emp.id, 'workedHours', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-5 py-4">
                                            <input
                                                type="number" min="0"
                                                className="w-20 mx-auto block px-3 py-2 bg-slate-50 border-transparent rounded-lg text-center text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all outline-none group-hover:bg-white border border-slate-100"
                                                value={record.overtime}
                                                onChange={(e) => handleInputChange(emp.id, 'overtime', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <input
                                                    type="number" min="0"
                                                    className="w-16 px-2 py-2 bg-red-50 border-transparent rounded-lg text-center text-sm font-bold text-red-600 focus:bg-white focus:ring-2 focus:ring-red-100 transition-all outline-none border border-red-50"
                                                    value={record.absences}
                                                    onChange={(e) => handleInputChange(emp.id, 'absences', Number(e.target.value))}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <input
                                                type="number" min="0"
                                                className="w-16 mx-auto block px-2 py-2 bg-orange-50 border-transparent rounded-lg text-center text-sm font-bold text-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all outline-none border border-orange-50"
                                                value={record.lateMinutes}
                                                onChange={(e) => handleInputChange(emp.id, 'lateMinutes', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <button
                                                onClick={() => saveRecord(emp.id)}
                                                disabled={saving === emp.id}
                                                className={`p-2.5 rounded-xl transition-all shadow-sm ${saving === emp.id ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:scale-110 active:scale-90 shadow-slate-200 hover:bg-indigo-600'}`}
                                            >
                                                {saving === emp.id ? <div className="w-5 h-5 border-2 border-slate-300 border-t-white animate-spin rounded-full"></div> : <Save size={18} />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredEmployees.length === 0 && (
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                                <AlertCircle className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t('no_workforce_records')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimeTrackingPage;
