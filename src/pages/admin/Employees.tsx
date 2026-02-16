import React, { useEffect, useState } from 'react';
import { employeeService } from '../../services/employeeService';
import { departmentService, groupService } from '../../services/departmentService';
import type { Employee, Department, Group } from '../../types';
import Modal from '../../components/Modal';
import {
    Edit,
    Trash2,
    Search,
    Filter,
    MoreHorizontal,
    UserPlus,
    Calendar,
    Download,
    DollarSign
} from 'lucide-react';
import { evaluationService } from '../../services/evaluationService';
import { payrollService } from '../../services/payrollService';
import { format } from 'date-fns';
import type { DirectorEvaluation, PayrollResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { roleThemes } from '../../config/roleThemes';
import type { UserRole } from '../../types';

const EmployeesPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const theme = roleThemes[currentUser?.role as UserRole] || roleThemes.EMPLOYEE;

    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [dirEvals, setDirEvals] = useState<Record<string, DirectorEvaluation>>({});
    const [payrollRecords, setPayrollRecords] = useState<Record<string, PayrollResult>>({});

    const [formData, setFormData] = useState<Partial<Employee>>({
        fullName: '',
        departmentId: '',
        groupId: '',
        role: 'EMPLOYEE',
        baseSalary: 0,
        joinDate: new Date().toISOString().split('T')[0],
        staffId: ''
    });

    useEffect(() => {
        fetchData();
    }, [currentUser, selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [emps, depts, grps, pRecords] = await Promise.all([
                employeeService.getAllEmployees(),
                departmentService.getAllDepartments(),
                groupService.getAllGroups(),
                payrollService.getPayrollByMonth(selectedMonth)
            ]);

            setEmployees(emps);
            setDepartments(depts);
            setGroups(grps);

            const pMap: Record<string, PayrollResult> = {};
            pRecords.forEach(r => pMap[r.employeeId] = r);
            setPayrollRecords(pMap);

            // Fetch evaluations concurrently
            const evalPromises = emps.map(e => evaluationService.getDirectorEvaluation(e.id, selectedMonth));
            const evals = await Promise.all(evalPromises);
            const eMap: Record<string, DirectorEvaluation> = {};
            evals.forEach((ev, idx) => {
                if (ev) eMap[emps[idx].id] = ev;
            });
            setDirEvals(eMap);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const csv = await payrollService.generateCSV(selectedMonth);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_${selectedMonth}.csv`;
            a.click();
        } catch (error) {
            console.error("Export failed:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName) return;

        try {
            if (editingId) {
                await employeeService.updateEmployee(editingId, formData);
            } else {
                await employeeService.createEmployee(formData as Omit<Employee, 'id'>);
            }
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ fullName: '', departmentId: '', groupId: '', role: 'EMPLOYEE', baseSalary: 0, joinDate: new Date().toISOString().split('T')[0], staffId: '' });
            fetchData();
        } catch (error) {
            console.error("Error saving employee:", error);
        }
    };

    const handleEdit = (emp: Employee) => {
        setEditingId(emp.id);
        setFormData(emp);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this employee?')) {
            await employeeService.deleteEmployee(id);
            fetchData();
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.primary }}></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-outfit font-bold text-slate-800 tracking-tight">Personnel & Workforce</h1>
                    <p className="text-slate-500 mt-1">Manage personnel records, group assignments, and access linking</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
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
                        className="flex items-center px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all text-sm"
                    >
                        <Download size={18} className="mr-2" />
                        Export Payroll
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData({ fullName: '', departmentId: '', groupId: '', role: 'EMPLOYEE', baseSalary: 0, joinDate: new Date().toISOString().split('T')[0], staffId: '' });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-95 transition-all text-sm group"
                    >
                        <UserPlus size={18} className="mr-2 group-hover:rotate-12 transition-transform" />
                        Board New Employee
                    </button>
                </div>
            </div>

            {/* Content Table Area */}
            <div className="glass-card rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50">
                {/* Search / Filter Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter candidates..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-100 transition-all w-full sm:w-80"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                            <Filter className="w-5 h-5" />
                        </button>
                        <div className="h-4 w-[1px] bg-slate-200"></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredEmployees.length} Results</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personnel</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Performance Status</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Payroll Status</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.map((emp) => {
                                const empTheme = roleThemes[emp.role as UserRole] || theme;
                                return (
                                    <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${empTheme.gradient} flex items-center justify-center text-white font-bold text-lg mr-4 shadow-sm group-hover:scale-105 transition-transform`}>
                                                    {emp.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 group-hover:text-slate-900">{emp.fullName}</p>
                                                    <div className="flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                                                        <span className="mr-2 text-indigo-500">{emp.staffId || 'NO-ID'}</span>
                                                        <Calendar className="w-3 h-3 mr-1" /> Bound {emp.joinDate || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            {dirEvals[emp.id] ? (
                                                <div className="inline-flex flex-col items-center">
                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${dirEvals[emp.id].locked ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                                        {dirEvals[emp.id].locked ? 'Locked' : 'Drafting'}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400 mt-1">{dirEvals[emp.id].finalScore}/10</span>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-300 font-bold uppercase">Pending Rating</div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            {payrollRecords[emp.id] ? (
                                                <div className="inline-flex flex-col items-center">
                                                    <div className="text-sm font-bold text-emerald-600">${payrollRecords[emp.id].finalSalary.toLocaleString()}</div>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Settlement Ready</span>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-300 font-bold uppercase">Awaiting Lock</div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(emp)}
                                                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm group/btn"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(emp.id)}
                                                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-all border border-transparent">
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Modify Personnel' : 'Enroll Personnel'}
            >
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Identity Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Full Name</label>
                                    <input
                                        type="text" required
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="Full Legal Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Staff ID / Code</label>
                                    <input
                                        type="text"
                                        value={formData.staffId || ''}
                                        onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        placeholder="e.g. EMP-001"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Role Type</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="EMPLOYEE">Employee</option>
                                        <option value="HR_MANAGER">HR Manager</option>
                                        <option value="PERSONNEL">Personnel</option>
                                        <option value="HEAD_DEPARTMENT">Head of Department</option>
                                        <option value="HEAD_DIRECTOR">Head Director</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Organizational Units</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Corporate Group</label>
                                    <select
                                        value={formData.groupId}
                                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="">Select Group</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Department</label>
                                    <select
                                        value={formData.departmentId}
                                        onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800 appearance-none"
                                    >
                                        <option value="">Select Department</option>
                                        {departments
                                            .filter(d => !formData.groupId || d.groupId === formData.groupId)
                                            .map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Financials & Date</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Base Salary</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="number" min="0" required
                                            value={formData.baseSalary}
                                            onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Engagement Date</label>
                                    <input
                                        type="date" required
                                        value={formData.joinDate}
                                        onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-transparent rounded-xl focus:ring-2 focus:ring-slate-100 focus:bg-white transition-all font-bold text-slate-800"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-4 rounded-xl bg-slate-900 text-white font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            {editingId ? 'Commit Changes' : 'Confirm Enrollment'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default EmployeesPage;
