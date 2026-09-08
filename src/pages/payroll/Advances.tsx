// Payroll -> Advances (السلف).
//
// The register of salary advances and loans. An advance does NOT start being collected when it is
// created: it has to be approved with the signed agreement attached, and only then are the monthly
// instalments scheduled. That two-step is deliberate — nothing that moves money is a single click.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, CheckCircle2, XCircle, Ban, Loader2, HandCoins, Upload, Phone } from 'lucide-react';

import PayrollTabs from '../../components/payroll/PayrollTabs';
import Modal from '../../components/Modal';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { canAccess } from '../../utils/access';
import { employeeService } from '../../services/employeeService';
import { payrollAdvanceService } from '../../services/payrollAdvanceService';
import type { EmployeeAdvance, AdvanceStatus } from '../../services/payrollAdvanceService';

const STATUS_STYLES: Record<AdvanceStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    ACTIVE: 'bg-blue-50 text-blue-700',
    SETTLED: 'bg-slate-100 text-slate-500',
    REJECTED: 'bg-rose-50 text-rose-600',
    CANCELLED: 'bg-slate-100 text-slate-400',
};

const TYPES = [
    { value: 'SALARY_ADVANCE', en: 'Salary advance', ar: 'سلفة راتب' },
    { value: 'LOAN', en: 'Loan', ar: 'قرض' },
    { value: 'TRAVEL_TICKET', en: 'Travel ticket', ar: 'تذكرة سفر' },
    { value: 'OTHER', en: 'Other', ar: 'أخرى' },
];
const CURRENCIES = ['LYD', 'USD', 'EUR'];

const money = (n: number, currency: string) =>
    `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

/** The current financial period: on or after the 25th we are already working on next month. */
const defaultPeriod = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 25 ? 1 : 0), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const EMPTY = {
    employeeId: '', type: 'SALARY_ADVANCE', currency: 'LYD',
    principal: '', instalmentCount: '1', firstDeductionPeriod: defaultPeriod(), reason: '',
};

const AdvancesPage: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const confirm = useConfirm();
    const qc = useQueryClient();

    const canManage = canAccess(currentUser, ['SUPER_ADMIN'], ['manage_payroll']);

    const [statusFilter, setStatusFilter] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ ...EMPTY });
    const [approving, setApproving] = useState<EmployeeAdvance | null>(null);
    const [signedFile, setSignedFile] = useState<File | null>(null);

    const { data: advances = [], isLoading } = useQuery({
        queryKey: ['payroll', 'advances', statusFilter],
        queryFn: () => payrollAdvanceService.list({ ...(statusFilter ? { status: statusFilter } : {}), scope: 'direct' }),
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

    const refresh = () => qc.invalidateQueries({ queryKey: ['payroll', 'advances'] });

    const set = (patch: Partial<typeof EMPTY>) => setForm(prev => ({ ...prev, ...patch }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await payrollAdvanceService.create({
                employeeId: form.employeeId,
                type: form.type,
                currency: form.currency,
                principal: Number(form.principal),
                instalmentCount: Number(form.instalmentCount),
                firstDeductionPeriod: form.firstDeductionPeriod,
                reason: form.reason || undefined,
            });
            toast.success(t('advance_created', { defaultValue: 'Advance request created. It is not collected until it is approved.' }));
            setIsOpen(false);
            setForm({ ...EMPTY });
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        } finally {
            setSaving(false);
        }
    };

    const doApprove = async () => {
        if (!approving || !signedFile) return;
        setSaving(true);
        try {
            const uploaded = await payrollAdvanceService.uploadDocument(signedFile);
            await payrollAdvanceService.approve(approving.id, { documentUrl: uploaded.url, documentName: uploaded.name });
            toast.success(t('advance_approved', { defaultValue: 'Approved — the instalments are now scheduled.' }));
            setApproving(null);
            setSignedFile(null);
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        } finally {
            setSaving(false);
        }
    };

    const doReject = async (a: EmployeeAdvance) => {
        const reason = window.prompt(t('advance_reject_reason', { defaultValue: 'Why is this advance being rejected?' }) || '');
        if (!reason?.trim()) return;
        try {
            await payrollAdvanceService.reject(a.id, reason.trim());
            toast.success(t('rejected', { defaultValue: 'Rejected' }));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        }
    };

    const doCancel = async (a: EmployeeAdvance) => {
        const ok = await confirm({
            message: t('advance_confirm_cancel', { defaultValue: 'Stop collecting the rest of this advance? Instalments already taken stay as they are.' }),
            danger: true,
        });
        if (!ok) return;
        try {
            await payrollAdvanceService.cancel(a.id);
            toast.success(t('advance_cancelled', { defaultValue: 'Remaining instalments waived.' }));
            refresh();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('save_failed', { defaultValue: 'Save failed.' }));
        }
    };

    const collected = (a: EmployeeAdvance) =>
        a.instalments.filter(i => i.status === 'DEDUCTED').reduce((s, i) => s + i.amount, 0);

    return (
        <div className="p-6">
            <PayrollTabs
                subtitle={t('advances_hint', {
                    defaultValue: 'Salary advances and loans. An advance is only collected once it has been approved with the signed agreement attached — approving it is what schedules the monthly instalments.',
                })}
                actions={canManage && (
                    <button onClick={() => { setForm({ ...EMPTY }); setIsOpen(true); }}
                        className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <Plus size={18} className="me-2" />
                        {t('advance_new', { defaultValue: 'New Advance' })}
                    </button>
                )}
            />

            <div className="flex items-center gap-2 mb-4">
                {['', 'PENDING', 'ACTIVE', 'SETTLED', 'REJECTED', 'CANCELLED'].map(s => (
                    <button key={s || 'ALL'} onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            statusFilter === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}>
                        {s || t('all', { defaultValue: 'All' })}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" /></div>
            ) : advances.length === 0 ? (
                <div className="bg-white rounded-lg shadow py-16 text-center">
                    <HandCoins size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400">{t('advances_none', { defaultValue: 'No advances recorded yet.' })}</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['advance_ref', 'employee', 'advance_type', 'advance_amount', 'advance_progress', 'advance_first_period', 'status', 'actions'].map((k, i) => (
                                    <th key={k} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${i === 7 ? 'text-end' : 'text-start'}`}>
                                        {t(k, { defaultValue: { advance_ref: 'Ref', employee: 'Employee', advance_type: 'Type', advance_amount: 'Amount', advance_progress: 'Collected', advance_first_period: 'From', status: 'Status', actions: 'Actions' }[k] })}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {advances.map(a => (
                                <tr key={a.id}>
                                    <td className="px-5 py-4 text-xs font-mono text-slate-500">{a.requestNumber}</td>
                                    <td className="px-5 py-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">{a.employee?.fullName || '—'}</span>
                                            {a.requestSource === 'SELF' && (
                                                <span
                                                    title={t('advance_from_employee_hint', { defaultValue: 'Filed by the employee from their own screen' }) as string}
                                                    className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider"
                                                >
                                                    {t('advance_from_employee', { defaultValue: 'Self-filed' })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400">{a.employee?.staffId || ''}</div>
                                        {a.whatsappNumber && (
                                            <a
                                                href={`https://wa.me/${a.whatsappNumber.replace(/[^0-9]/g, '')}`}
                                                target="_blank" rel="noreferrer" dir="ltr"
                                                className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-700 hover:underline"
                                            >
                                                <Phone size={10} /> {a.whatsappNumber}
                                            </a>
                                        )}
                                        {a.serviceProviderName && (
                                            <div className="text-[11px] text-slate-400 font-medium">{a.serviceProviderName}</div>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-sm text-gray-500">
                                        {TYPES.find(x => x.value === a.type)?.ar || a.type}
                                    </td>
                                    <td className="px-5 py-4 text-sm whitespace-nowrap">
                                        <div className="font-bold text-slate-700">{money(a.principal, a.currency)}</div>
                                        {a.basicSalaryMonths && (
                                            <div
                                                className="text-[11px] text-slate-400 font-medium"
                                                title={a.basicSalarySnapshot
                                                    ? (t('advance_basic_at_request', { defaultValue: 'Basic salary when requested: {{v}}', v: money(a.basicSalarySnapshot, a.currency) }) as string)
                                                    : undefined}
                                            >
                                                {t('advance_n_basic_salaries', {
                                                    defaultValue: '{{n}} basic salary/salaries',
                                                    count: a.basicSalaryMonths, n: a.basicSalaryMonths,
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-sm whitespace-nowrap">
                                        <span className="text-slate-700 font-semibold">{money(collected(a), a.currency)}</span>
                                        <span className="text-slate-300 mx-1">/</span>
                                        <span className="text-slate-400">{a.instalmentCount} × {money(a.principal / a.instalmentCount, a.currency)}</span>
                                    </td>
                                    <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">{a.firstDeductionPeriod}</td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                                    </td>
                                    <td className="px-5 py-4 text-end whitespace-nowrap">
                                        {canManage && a.status === 'PENDING' && (
                                            <>
                                                <button onClick={() => { setApproving(a); setSignedFile(null); }}
                                                    title={t('approve', { defaultValue: 'Approve' })}
                                                    className="text-emerald-600 hover:text-emerald-800 me-3"><CheckCircle2 size={18} /></button>
                                                <button onClick={() => doReject(a)} title={t('reject', { defaultValue: 'Reject' })}
                                                    className="text-rose-600 hover:text-rose-800"><XCircle size={18} /></button>
                                            </>
                                        )}
                                        {canManage && a.status === 'ACTIVE' && (
                                            <button onClick={() => doCancel(a)} title={t('advance_stop', { defaultValue: 'Stop collecting' })}
                                                className="text-slate-500 hover:text-slate-700"><Ban size={18} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* New advance */}
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('advance_new', { defaultValue: 'New Advance' })}>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('employee', { defaultValue: 'Employee' })} *</label>
                        <select required value={form.employeeId} onChange={e => set({ employeeId: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="">{t('select_employee', { defaultValue: '— Select —' })}</option>
                            {sortedEmployees.map(e => (
                                <option key={e.id} value={e.id}>{e.fullName}{e.staffId ? ` (${e.staffId})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('advance_type', { defaultValue: 'Type' })}</label>
                            <select value={form.type} onChange={e => set({ type: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                                {TYPES.map(x => <option key={x.value} value={x.value}>{x.ar}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('currency', { defaultValue: 'Currency' })} *</label>
                            <select required value={form.currency} onChange={e => set({ currency: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md">
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('advance_amount', { defaultValue: 'Amount' })} *</label>
                            <input type="number" required min="0.01" step="0.01" value={form.principal}
                                onChange={e => set({ principal: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('advance_instalments', { defaultValue: 'Instalments' })} *</label>
                            <input type="number" required min="1" max="60" step="1" value={form.instalmentCount}
                                onChange={e => set({ instalmentCount: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('advance_first_period', { defaultValue: 'First deduction period' })} *</label>
                        <input type="month" required value={form.firstDeductionPeriod}
                            onChange={e => set({ firstDeductionPeriod: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                        <p className="text-[10px] text-gray-400 mt-1">
                            {t('advance_period_hint', { defaultValue: 'The payroll month the first instalment is taken from. The last instalment absorbs any rounding, so the parts always add back up to the full amount.' })}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('reason', { defaultValue: 'Reason' })}</label>
                        <textarea rows={2} value={form.reason} onChange={e => set({ reason: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setIsOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700">{t('cancel', { defaultValue: 'Cancel' })}</button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">{t('create', { defaultValue: 'Create' })}</button>
                    </div>
                </form>
            </Modal>

            {/* Approve — the signed agreement is mandatory, so the button stays disabled without it */}
            <Modal isOpen={!!approving} onClose={() => setApproving(null)} title={t('advance_approve_title', { defaultValue: 'Approve Advance' })}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        {t('advance_approve_hint', { defaultValue: 'Approving schedules the instalments and starts collecting them from the chosen month. Attach the signed agreement first.' })}
                    </p>
                    {approving && (
                        <div className="bg-slate-50 rounded-lg p-3 text-sm">
                            <div className="font-semibold text-slate-800">{approving.employee?.fullName}</div>
                            <div className="text-slate-500">
                                {money(approving.principal, approving.currency)} · {approving.instalmentCount} × {money(approving.principal / approving.instalmentCount, approving.currency)} · {t('from', { defaultValue: 'from' })} {approving.firstDeductionPeriod}
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('advance_signed_doc', { defaultValue: 'Signed agreement' })} *
                        </label>
                        <input type="file" onChange={e => setSignedFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm border border-gray-300 rounded-md p-2" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setApproving(null)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700">{t('cancel', { defaultValue: 'Cancel' })}</button>
                        <button onClick={doApprove} disabled={!signedFile || saving}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50 flex items-center gap-2">
                            <Upload size={16} />
                            {t('approve', { defaultValue: 'Approve' })}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AdvancesPage;
