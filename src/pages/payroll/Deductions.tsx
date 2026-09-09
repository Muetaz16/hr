// Payroll -> Deductions (الخصومات).
//
// Everything taken off a salary that is not an advance instalment. The categories are fixed rather
// than free text because each one is a printed row on the payslip template — a category with no row
// could never be shown to the employee.
//
// A deduction is only picked up by a payroll run once it is APPROVED, and once a run has collected
// it, it is frozen: the payslip has already been handed over.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, CheckCircle2, Ban, Loader2, Receipt, Repeat } from 'lucide-react';

import PayrollTabs from '../../components/payroll/PayrollTabs';
import Modal from '../../components/Modal';
import SearchSelect from '../../components/SearchSelect';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';
import { employeeService } from '../../services/employeeService';
import { payrollDeductionService } from '../../services/payrollDeductionService';
import type { EmployeeDeduction, DeductionStatus } from '../../services/payrollDeductionService';

const STATUS_STYLES: Record<DeductionStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    APPLIED: 'bg-blue-50 text-blue-700',
    CANCELLED: 'bg-slate-100 text-slate-400',
};

const CURRENCIES = ['LYD', 'USD', 'EUR'];

const money = (n: number, currency: string) =>
    `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const defaultPeriod = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 25 ? 1 : 0), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const EMPTY = {
    employeeId: '', category: 'TICKET_COST', currency: 'LYD', amount: '',
    recurring: false, period: defaultPeriod(), startPeriod: defaultPeriod(), endPeriod: '', notes: '',
};

const DeductionsPage: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const confirm = useConfirm();
    const qc = useQueryClient();

    const canManage = canAccess(currentUser, ['SUPER_ADMIN'], ['manage_payroll']);

    const [statusFilter, setStatusFilter] = useState('');
    const [periodFilter, setPeriodFilter] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ ...EMPTY });

    const { data: categories = [] } = useQuery({
        queryKey: ['payroll', 'deduction-categories'],
        queryFn: () => payrollDeductionService.categories(),
        staleTime: Infinity,
    });

    const { data: deductions = [], isLoading } = useQuery({
        queryKey: ['payroll', 'deductions', statusFilter, periodFilter],
        queryFn: () => payrollDeductionService.list({
            status: statusFilter || undefined,
            period: periodFilter || undefined,
        }),
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees', 'for-payroll-picker'],
        queryFn: () => employeeService.getAllEmployees(),
        staleTime: 5 * 60 * 1000,
    });

    const sortedEmployees = useMemo(
        () => [...employees].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')),
        [employees],
    );
    // value/label/sub — SearchSelect matches the query against all three, so typing either the name
    // or the staff ID finds the person.
    const employeeOptions = useMemo(
        () => sortedEmployees.map((e: any) => ({ value: e.id, label: e.fullName || '—', sub: e.staffId || undefined })),
        [sortedEmployees],
    );


    const refresh = () => qc.invalidateQueries({ queryKey: ['payroll', 'deductions'] });
    const set = (patch: Partial<typeof EMPTY>) => setForm(prev => ({ ...prev, ...patch }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await payrollDeductionService.create({
                employeeId: form.employeeId,
                category: form.category,
                currency: form.currency,
                amount: Number(form.amount),
                recurring: form.recurring,
                period: form.recurring ? undefined : form.period,
                startPeriod: form.recurring ? form.startPeriod : undefined,
                endPeriod: form.recurring && form.endPeriod ? form.endPeriod : undefined,
                notes: form.notes || undefined,
            });
            toast.success(t('deduction_created', { defaultValue: 'Deduction added. It is only collected once approved.' }));
            setIsOpen(false);
            setForm({ ...EMPTY });
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        } finally {
            setSaving(false);
        }
    };

    const doApprove = async (d: EmployeeDeduction) => {
        try {
            await payrollDeductionService.approve(d.id);
            toast.success(t('approved', { defaultValue: 'Approved' }));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        }
    };

    const doCancel = async (d: EmployeeDeduction) => {
        const ok = await confirm({ message: t('deduction_confirm_cancel', { defaultValue: 'Cancel this deduction?' }), danger: true });
        if (!ok) return;
        try {
            await payrollDeductionService.cancel(d.id);
            toast.success(t('cancelled', { defaultValue: 'Cancelled' }));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        }
    };

    const catLabel = (key: string) => categories.find(c => c.key === key)?.ar || key;

    return (
        <div className="p-6">
            <PayrollTabs
                subtitle={t('deductions_hint', {
                    defaultValue: 'Amounts taken off a salary other than advance instalments — ticket costs, penalties, health-insurance overruns and corrections of a previous overpayment. Each category is a printed row on the payslip. A deduction is only collected once it has been approved.',
                })}
                actions={canManage && (
                    <button onClick={() => { setForm({ ...EMPTY }); setIsOpen(true); }}
                        className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <Plus size={18} className="me-2" />
                        {t('deduction_new', { defaultValue: 'New Deduction' })}
                    </button>
                )}
            />

            <div className="flex flex-wrap items-center gap-2 mb-4">
                {['', 'PENDING', 'APPROVED', 'APPLIED', 'CANCELLED'].map(s => (
                    <button key={s || 'ALL'} onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            statusFilter === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}>
                        {s || t('all', { defaultValue: 'All' })}
                    </button>
                ))}
                <div className="ms-auto flex items-center gap-2">
                    <label className="text-xs text-slate-400">{t('period', { defaultValue: 'Period' })}</label>
                    <input type="month" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
                        className="px-2 py-1.5 border border-slate-200 rounded-md text-sm" />
                    {periodFilter && (
                        <button onClick={() => setPeriodFilter('')} className="text-xs text-slate-400 hover:text-slate-600">
                            {t('clear', { defaultValue: 'Clear' })}
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" /></div>
            ) : deductions.length === 0 ? (
                <div className="bg-white rounded-lg shadow py-16 text-center">
                    <Receipt size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400">{t('deductions_none', { defaultValue: 'No deductions recorded for this filter.' })}</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {[
                                    ['employee', 'Employee'], ['deduction_category', 'Category'], ['amount', 'Amount'],
                                    ['period', 'Period'], ['status', 'Status'], ['actions', 'Actions'],
                                ].map(([k, d], i) => (
                                    <th key={k} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${i === 5 ? 'text-end' : 'text-start'}`}>
                                        {t(k, { defaultValue: d })}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {deductions.map(d => (
                                <tr key={d.id}>
                                    <td className="px-5 py-4 text-sm">
                                        <div className="font-medium text-gray-900">{d.employee?.fullName || '—'}</div>
                                        <div className="text-xs text-gray-400">{d.employee?.staffId || ''}</div>
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-600">
                                        {catLabel(d.category)}
                                        {d.notes && <div className="text-xs text-gray-400 mt-0.5">{d.notes}</div>}
                                    </td>
                                    <td className="px-5 py-4 text-sm font-bold text-slate-700 whitespace-nowrap">{money(d.amount, d.currency)}</td>
                                    <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                                        {d.recurring ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Repeat size={12} className="text-blue-500" />
                                                {d.startPeriod} → {d.endPeriod || '∞'}
                                            </span>
                                        ) : d.period}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLES[d.status]}`}>{d.status}</span>
                                    </td>
                                    <td className="px-5 py-4 text-end whitespace-nowrap">
                                        {canManage && d.status === 'PENDING' && (
                                            <button onClick={() => doApprove(d)} title={t('approve', { defaultValue: 'Approve' })}
                                                className="text-emerald-600 hover:text-emerald-800 me-3"><CheckCircle2 size={18} /></button>
                                        )}
                                        {canManage && ['PENDING', 'APPROVED'].includes(d.status) && (
                                            <button onClick={() => doCancel(d)} title={t('cancel', { defaultValue: 'Cancel' })}
                                                className="text-slate-500 hover:text-slate-700"><Ban size={18} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('deduction_new', { defaultValue: 'New Deduction' })}>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('employee', { defaultValue: 'Employee' })} *</label>
                        {/* Searchable rather than a plain <select>: the roster is long enough that
                            scrolling it is the bottleneck, and payroll knows people by staff ID as
                            often as by name — both are matched. */}
                        <div className="mt-1">
                            <SearchSelect
                                value={form.employeeId}
                                onChange={v => set({ employeeId: v })}
                                options={employeeOptions}
                                placeholder={t('select_employee', { defaultValue: '— Select —' })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('deduction_category', { defaultValue: 'Category' })} *</label>
                        <select required value={form.category} onChange={e => set({ category: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                            {categories.map(c => <option key={c.key} value={c.key}>{c.ar} — {c.en}</option>)}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-1">
                            {t('deduction_category_hint', { defaultValue: 'Each category prints on its own row of the payslip. Advance instalments are handled on the Advances screen, not here.' })}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('amount', { defaultValue: 'Amount' })} *</label>
                            <input type="number" required min="0.01" step="0.01" value={form.amount}
                                onChange={e => set({ amount: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('currency', { defaultValue: 'Currency' })} *</label>
                            <select required value={form.currency} onChange={e => set({ currency: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={form.recurring} onChange={e => set({ recurring: e.target.checked })} />
                        {t('deduction_recurring', { defaultValue: 'Repeats every month' })}
                    </label>

                    {form.recurring ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('deduction_from', { defaultValue: 'From' })} *</label>
                                <input type="month" required value={form.startPeriod} onChange={e => set({ startPeriod: e.target.value })}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('deduction_until', { defaultValue: 'Until (optional)' })}</label>
                                <input type="month" value={form.endPeriod} onChange={e => set({ endPeriod: e.target.value })}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('period', { defaultValue: 'Period' })} *</label>
                            <input type="month" required value={form.period} onChange={e => set({ period: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('notes', { defaultValue: 'Notes' })}</label>
                        <textarea rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setIsOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700">{t('cancel', { defaultValue: 'Cancel' })}</button>
                        <button type="submit" disabled={saving || !form.employeeId}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">{t('create', { defaultValue: 'Create' })}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DeductionsPage;
