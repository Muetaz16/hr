import React, { useState, useEffect } from 'react';
import { payrollService } from '../services/payrollService';
import { employeeService } from '../services/employeeService';
import { format } from 'date-fns';
import {
    Download,
    FileSpreadsheet,
    Calendar,
    Search,
    DollarSign,
    CheckCircle2,
    Users,
    AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Employee, PayrollResult } from '../types';

const PayrollPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [loading, setLoading] = useState(false);
    const [payrollData, setPayrollData] = useState<PayrollResult[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState('');


    useEffect(() => {
        if (currentUser) {
            fetchPayrollData();
        }
    }, [selectedMonth, currentUser]);

    const fetchPayrollData = async () => {
        setLoading(true);
        try {
            const [results, emps] = await Promise.all([
                payrollService.getPayrollByMonth(selectedMonth),
                employeeService.getAllEmployees()
            ]);

            // Filter based on user scope - HR Manager sees everyone, others are scoped
            let scopedEmps = emps;
            if (currentUser?.role === 'HEAD_DIRECTOR' && currentUser.groupId) {
                scopedEmps = emps.filter(e => e.groupId === currentUser.groupId);
            } else if (currentUser?.role === 'HEAD_DEPARTMENT' && currentUser.departmentId) {
                scopedEmps = emps.filter(e => e.departmentId === currentUser.departmentId);
            }

            setEmployees(scopedEmps);
            setPayrollData(results);
        } catch (error) {
            console.error("Error fetching payroll data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        try {
            const csvContent = await payrollService.generateCSV(selectedMonth);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payroll_${selectedMonth.replace('-', '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error generating CSV:", error);
            alert("Failed to generate CSV");
        } finally {
            setLoading(false);
        }
    };

    const getEmployeeName = (id: string) => employees.find(e => e.id === id)?.fullName || 'Member Removal Pending';

    const filteredResults = payrollData.filter(r => {
        const name = getEmployeeName(r.employeeId).toLowerCase();
        return name.includes(searchTerm.toLowerCase());
    });

    // Stats
    const totalPayroll = payrollData.reduce((acc, curr) => acc + curr.finalSalary, 0);
    const completedRecords = payrollData.length;

    if (currentUser?.role !== 'SUPER_ADMIN' && currentUser?.role !== 'HR_MANAGER') {
        return <div className="p-8 text-red-500 font-bold uppercase tracking-widest text-center glass-card rounded-3xl mt-20">Access Restricted: Authority Required</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">Financial Disbursements</h1>
                    <p className="text-slate-500 mt-1">Review and finalize payroll processing for the operational cycle</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={loading || payrollData.length === 0}
                        className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm group disabled:opacity-50 disabled:scale-100"
                    >
                        <Download size={18} className="mr-2 group-hover:translate-y-0.5 transition-transform" />
                        Export Master CSV
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Calculated Liabilities</span>
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-800">${totalPayroll.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 mb-1">Total Month</span>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-3xl border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Processed Units</span>
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-800">{completedRecords}</span>
                        <span className="text-xs text-slate-400 mb-1">Verified Entries</span>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-3xl border-l-4 border-indigo-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Operational Strength</span>
                        <Users className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-800">{employees.length}</span>
                        <span className="text-xs text-slate-400 mb-1">Active Staff</span>
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Query disbursement by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-80"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-slate-300" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Master Payroll Record</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beneficiary</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Work History</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Perf Index</th>
                                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Net Settlement</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredResults.map((result) => (
                                <tr key={result.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center mr-4 group-hover:bg-white transition-all">
                                                <Users size={18} />
                                            </div>
                                            <p className="font-bold text-slate-800">{getEmployeeName(result.employeeId)}</p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-5 text-center">
                                        <div className="text-sm font-bold text-slate-700">{result.totalHours}h Worked</div>
                                        <div className="text-[10px] text-emerald-500 font-bold uppercase">+{result.overtime} OT</div>
                                    </td>
                                    <td className="px-5 py-5 text-center">
                                        <div className="inline-flex items-center px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold">
                                            {result.finalScore.toFixed(1)} / 10
                                        </div>
                                    </td>
                                    <td className="px-5 py-5 text-center">
                                        <div className="text-lg font-outfit font-bold text-slate-800">${result.finalSalary.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Gross Disbursement</div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="inline-flex items-center text-emerald-500 font-bold text-[10px] uppercase tracking-widest px-3 py-1 bg-emerald-50 rounded-lg">
                                            <CheckCircle2 size={12} className="mr-1.5" /> Finalized
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredResults.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center">
                                        <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No payroll disbursements processed for this period</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PayrollPage;
