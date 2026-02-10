import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeService } from '../services/employeeService';
import { timeService } from '../services/timeService';
import type { Employee, TimeRecord, UserRole } from '../types';
import {
    Clock,
    Calendar,
    Save,
    Search,
    Filter,
    AlertCircle,
    CheckCircle2,
    Timer,
    ArrowUpRight,
    ArrowDownRight,
    User as UserIcon,
    ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { roleThemes } from '../config/roleThemes';

const TimeTrackingPage: React.FC = () => {
    const { currentUser } = useAuth();
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">Time & Attendance</h1>
                    <p className="text-slate-500 mt-1">Monitor working hours and operational engagement</p>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center px-4 py-2 bg-slate-50 rounded-xl">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Row for HR/Admins */}
            {(currentUser?.role === 'HR_MANAGER' || currentUser?.role === 'SUPER_ADMIN') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 rounded-3xl border-l-4 border-blue-500">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Capacity</span>
                            <Timer className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold text-slate-800">{totalAssigned}h</span>
                            <span className="text-xs text-slate-400 mb-1">Assigned Total</span>
                        </div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-500">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Actual Engagement</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold text-slate-800">{totalWorked}h</span>
                            <span className="text-xs text-emerald-500 mb-1 font-bold">{((totalWorked / (totalAssigned || 1)) * 100).toFixed(1)}% Yield</span>
                        </div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-l-4 border-orange-500">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Overtime Burn</span>
                            <ArrowUpRight className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold text-slate-800">{totalOvertime}h</span>
                            <span className="text-xs text-orange-500 mb-1 font-bold">Priority Status</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Table */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Find workforce member..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-80"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredEmployees.length} Members List</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identity</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Assigned</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Worked</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Overtime</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Absence</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Late (M)</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Commit</th>
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
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mr-4 group-hover:bg-white group-hover:shadow-sm transition-all`}>
                                                    <UserIcon size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{emp.fullName}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Active Engagement</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-5">
                                            <input
                                                type="number" min="0"
                                                className="w-20 mx-auto block px-3 py-2 bg-slate-50 border-transparent rounded-lg text-center text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all outline-none"
                                                value={record.assignedHours}
                                                onChange={(e) => handleInputChange(emp.id, 'assignedHours', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-5 py-5">
                                            <input
                                                type="number" min="0"
                                                className="w-20 mx-auto block px-3 py-2 bg-slate-50 border-transparent rounded-lg text-center text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all outline-none"
                                                value={record.workedHours}
                                                onChange={(e) => handleInputChange(emp.id, 'workedHours', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-5 py-5">
                                            <input
                                                type="number" min="0"
                                                className="w-20 mx-auto block px-3 py-2 bg-slate-50 border-transparent rounded-lg text-center text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all outline-none"
                                                value={record.overtime}
                                                onChange={(e) => handleInputChange(emp.id, 'overtime', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-5 py-5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <input
                                                    type="number" min="0"
                                                    className="w-16 px-2 py-2 bg-red-50 border-transparent rounded-lg text-center text-sm font-bold text-red-600 focus:bg-white focus:ring-2 focus:ring-red-100 transition-all outline-none"
                                                    value={record.absences}
                                                    onChange={(e) => handleInputChange(emp.id, 'absences', Number(e.target.value))}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-5 py-5 text-center">
                                            <input
                                                type="number" min="0"
                                                className="w-16 mx-auto block px-2 py-2 bg-orange-50 border-transparent rounded-lg text-center text-sm font-bold text-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all outline-none"
                                                value={record.lateMinutes}
                                                onChange={(e) => handleInputChange(emp.id, 'lateMinutes', Number(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button
                                                onClick={() => saveRecord(emp.id)}
                                                disabled={saving === emp.id}
                                                className={`p-2.5 rounded-xl transition-all shadow-sm ${saving === emp.id ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:scale-110 active:scale-90 shadow-slate-200'}`}
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
                            <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Workforce Records Detected</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimeTrackingPage;
