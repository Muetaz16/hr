// Payroll → Salary Structures.
//
// The rate table every salary is computed from: job category x grade x structure level, where the
// level's suffix is also the currency. Editable by payroll, because a yearly rate revision is a
// real thing and doing it in the database is not a plan.
//
// Two deliberate restrictions, both because this table is where salaries come from:
//   · Only the HOURLY rate is typed. The monthly rate is derived (x 208) on the server, so the two
//     can never drift apart and quote different salaries on different screens.
//   · A rate someone is actually paid on cannot be deleted. It would not lower their pay — it would
//     make them unpayable, showing up as a blocked line with no obvious cause.
//
// The "used by" column is the point of the screen: it turns an abstract grid into "this row pays
// nine people", which is what makes an edit here feel as consequential as it is.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Table2, Search, Info, Pencil, Check, X, Plus, Trash2, AlertTriangle, Users } from 'lucide-react';

import PayrollTabs from '../../components/payroll/PayrollTabs';
import { salaryStructureService } from '../../services/salaryStructureService';
import type { SalaryStructureRow } from '../../services/salaryStructureService';
import { canAccess } from '../../utils/access';
import { useAuth } from '../../context/AuthContext';

// The suffix of the structure level is the currency the salary is paid in.
const currencyOf = (level: string) => level.split('-').pop() || '';

const CURRENCY_STYLES: Record<string, string> = {
    LYD: 'bg-emerald-50 text-emerald-700',
    USD: 'bg-blue-50 text-blue-700',
    EUR: 'bg-violet-50 text-violet-700',
};

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SalaryStructuresPage: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();
    const canManage = canAccess(currentUser, [], ['manage_payroll']);

    const [level, setLevel] = useState('');
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [adding, setAdding] = useState(false);
    const [newRow, setNewRow] = useState({ jobCategory: '', jobGrade: '', structureLevel: '', hourlyRate: '' });

    const { data: rows = [], isLoading } = useQuery<SalaryStructureRow[]>({
        queryKey: ['salary-structures'],
        queryFn: salaryStructureService.list,
    });
    const { data: coverage } = useQuery({
        queryKey: ['salary-structures', 'coverage'],
        queryFn: salaryStructureService.coverage,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['salary-structures'] });

    const save = useMutation({
        mutationFn: ({ id, rate }: { id: string; rate: number }) => salaryStructureService.update(id, rate),
        onSuccess: () => {
            toast.success(t('structures_saved', { defaultValue: 'Rate updated. It applies the next time a period is computed.' }));
            setEditing(null);
            invalidate();
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || t('structures_save_failed', { defaultValue: 'Could not update the rate.' })),
    });

    const create = useMutation({
        mutationFn: () => salaryStructureService.create({
            jobCategory: newRow.jobCategory.trim(),
            jobGrade: newRow.jobGrade.trim(),
            structureLevel: newRow.structureLevel.trim(),
            hourlyRate: Number(newRow.hourlyRate),
        }),
        onSuccess: () => {
            toast.success(t('structures_created', { defaultValue: 'Rate added.' }));
            setAdding(false);
            setNewRow({ jobCategory: '', jobGrade: '', structureLevel: '', hourlyRate: '' });
            invalidate();
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || t('structures_create_failed', { defaultValue: 'Could not add the rate.' })),
    });

    const remove = useMutation({
        mutationFn: (id: string) => salaryStructureService.remove(id),
        onSuccess: () => {
            toast.success(t('structures_deleted', { defaultValue: 'Rate removed.' }));
            invalidate();
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || t('structures_delete_failed', { defaultValue: 'Could not remove the rate.' })),
    });

    const levels = useMemo(() => [...new Set(rows.map(r => r.structureLevel))].sort(), [rows]);
    const categories = useMemo(() => [...new Set(rows.map(r => r.jobCategory))].sort(), [rows]);
    const grades = useMemo(() => [...new Set(rows.map(r => r.jobGrade))].sort(), [rows]);

    // How many employees each row pays, keyed the same way payroll resolves a rate.
    const usage = useMemo(() => {
        const m = new Map<string, number>();
        for (const u of coverage?.usage || []) {
            m.set(`${u.jobCategory}|${u.jobGrade}|${u.structureLevel}`, u.employeeCount);
        }
        return m;
    }, [coverage]);

    const filtered = useMemo(() => rows.filter(r => {
        if (level && r.structureLevel !== level) return false;
        if (category && r.jobCategory !== category) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!r.jobCategory.toLowerCase().includes(q) && !r.jobGrade.toLowerCase().includes(q)) return false;
        }
        return true;
    }), [rows, level, category, search]);

    const beginEdit = (r: SalaryStructureRow) => { setEditing(r.id); setDraft(String(r.hourlyRate)); };

    const gaps = coverage?.missingInUse || [];

    return (
        <div className="p-6">
            <PayrollTabs
                subtitle={t('structures_hint', {
                    defaultValue: 'The rate table every salary is computed from. A rate is found by job category + job grade + structure level; the level also decides the currency. An employee missing any of the three has no rate, and payroll blocks their line rather than paying them zero.',
                })}
                actions={canManage && !adding && (
                    <button
                        onClick={() => setAdding(true)}
                        className="flex items-center gap-2 bg-[#511d29] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#3f1620]"
                    >
                        <Plus size={16} /> {t('structures_add', { defaultValue: 'Add a rate' })}
                    </button>
                )}
            />

            {/* Only gaps an employee actually points at matter. An unused hole in the grid costs
                nobody anything, and reporting it as a problem would send people chasing nothing. */}
            {gaps.length > 0 ? (
                <div className="border border-amber-200 bg-amber-50 rounded-xl px-5 py-4 mb-4 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-black text-amber-800">
                            {t('structures_gaps', { defaultValue: '{{n}} combination(s) are in use but have no rate', n: gaps.length })}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {gaps.map(g => (
                                <li key={`${g.jobCategory}|${g.jobGrade}|${g.structureLevel}`} className="text-xs text-amber-900/85 font-medium">
                                    · {g.jobCategory} · {g.jobGrade} · {g.structureLevel} — {g.employeeCount} {t('payroll_employees', { defaultValue: 'employees' })}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : coverage && (
                <div className="border border-emerald-100 bg-emerald-50/60 rounded-xl px-5 py-3 mb-4 flex items-start gap-2">
                    <Info size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-emerald-800">
                        {t('structures_complete', {
                            defaultValue: 'The card holds {{total}} rates and covers every combination an employee is on. A blocked payroll line is therefore missing a field on the employee record, not a rate here.',
                            total: coverage.total,
                        })}
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative">
                    <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('structures_search', { defaultValue: 'Search category or grade…' }) as string}
                        className="ps-9 pe-3 py-2 border border-slate-200 rounded-md text-sm w-64" />
                </div>
                <select value={level} onChange={e => setLevel(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-md text-sm">
                    <option value="">{t('structures_all_levels', { defaultValue: 'All structure levels' })}</option>
                    {levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={category} onChange={e => setCategory(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-md text-sm">
                    <option value="">{t('structures_all_categories', { defaultValue: 'All job categories' })}</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-xs text-slate-400 ms-auto">
                    {t('structures_count', { defaultValue: '{{shown}} of {{total}} rates', shown: filtered.length, total: rows.length })}
                </span>
            </div>

            {adding && (
                <div className="bg-white border-2 border-[#511d29]/15 rounded-xl p-5 mb-4">
                    <p className="text-sm font-black text-slate-700 mb-3">{t('structures_add', { defaultValue: 'Add a rate' })}</p>
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Field label={t('job_category', { defaultValue: 'Job Category' })}>
                            <input list="ss-categories" value={newRow.jobCategory}
                                onChange={e => setNewRow(v => ({ ...v, jobCategory: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium" />
                            <datalist id="ss-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
                        </Field>
                        <Field label={t('job_grade', { defaultValue: 'Job Grade' })}>
                            <input list="ss-grades" value={newRow.jobGrade}
                                onChange={e => setNewRow(v => ({ ...v, jobGrade: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium" />
                            <datalist id="ss-grades">{grades.map(g => <option key={g} value={g} />)}</datalist>
                        </Field>
                        <Field label={t('structure_level', { defaultValue: 'Structure Level' })}>
                            <input list="ss-levels" value={newRow.structureLevel}
                                onChange={e => setNewRow(v => ({ ...v, structureLevel: e.target.value }))}
                                placeholder="SS-01-LYD" dir="ltr"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium" />
                            <datalist id="ss-levels">{levels.map(l => <option key={l} value={l} />)}</datalist>
                        </Field>
                        <Field label={t('hourly_rate', { defaultValue: 'Hourly Rate' })}>
                            <input type="number" min="0" step="0.01" value={newRow.hourlyRate}
                                onChange={e => setNewRow(v => ({ ...v, hourlyRate: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" />
                        </Field>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-2">
                        {t('structures_monthly_derived', {
                            defaultValue: 'The monthly rate is derived as hourly x 208 and is not typed, so the two can never disagree.',
                        })}
                        {Number(newRow.hourlyRate) > 0 && (
                            <> {t('structures_monthly_preview', {
                                defaultValue: 'This would be {{v}} a month.',
                                v: money(Number(newRow.hourlyRate) * 208),
                            })}</>
                        )}
                    </p>
                    <div className="flex items-center gap-3 mt-4">
                        <button
                            onClick={() => create.mutate()}
                            disabled={create.isPending || !newRow.jobCategory.trim() || !newRow.jobGrade.trim() || !newRow.structureLevel.trim() || !(Number(newRow.hourlyRate) > 0)}
                            className="inline-flex items-center gap-2 bg-[#511d29] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#3f1620] disabled:opacity-40"
                        >
                            {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                            {t('save', { defaultValue: 'Save' })}
                        </button>
                        <button onClick={() => setAdding(false)} className="text-sm font-bold text-slate-400 hover:text-slate-600">
                            {t('cancel', { defaultValue: 'Cancel' })}
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="py-16 text-center text-slate-400"><Loader2 className="animate-spin inline" /></div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-lg shadow py-16 text-center">
                    <Table2 size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400">{t('structures_none', { defaultValue: 'No rates match this filter.' })}</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {[
                                    ['job_category', 'Job Category', 'start'], ['job_grade', 'Job Grade', 'start'],
                                    ['structure_level', 'Structure Level', 'start'],
                                    ['structures_used_by', 'Paid to', 'start'],
                                    ['hourly_rate', 'Hourly Rate', 'end'], ['monthly_rate', 'Monthly Rate', 'end'],
                                    ['actions', '', 'end'],
                                ].map(([k, d, align]) => (
                                    <th key={k} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-${align}`}>
                                        {d ? t(k, { defaultValue: d }) : ''}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filtered.map(r => {
                                const cur = currencyOf(r.structureLevel);
                                const used = usage.get(`${r.jobCategory}|${r.jobGrade}|${r.structureLevel}`) || 0;
                                const isEditing = editing === r.id;
                                return (
                                    <tr key={r.id} className={used > 0 ? '' : 'opacity-60'}>
                                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{r.jobCategory}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600">{r.jobGrade}</td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${CURRENCY_STYLES[cur] || 'bg-slate-100 text-slate-600'}`}>
                                                {r.structureLevel}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            {used > 0 ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                                    <Users size={12} className="text-slate-400" /> {used}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300 font-semibold">
                                                    {t('structures_unused', { defaultValue: 'nobody' })}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-end whitespace-nowrap">
                                            {isEditing ? (
                                                <input
                                                    type="number" min="0" step="0.01" value={draft} autoFocus
                                                    onChange={e => setDraft(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && Number(draft) > 0) save.mutate({ id: r.id, rate: Number(draft) });
                                                        if (e.key === 'Escape') setEditing(null);
                                                    }}
                                                    className="w-28 px-2 py-1 border border-[#511d29]/40 rounded-lg text-sm font-bold text-end"
                                                />
                                            ) : (
                                                <span className="font-bold text-slate-700">{money(r.hourlyRate)} {cur}</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-end text-slate-500 whitespace-nowrap">
                                            {money(isEditing && Number(draft) > 0 ? Number(draft) * 208 : r.monthlyRate)} {cur}
                                        </td>
                                        <td className="px-5 py-3 text-end whitespace-nowrap">
                                            {!canManage ? null : isEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => save.mutate({ id: r.id, rate: Number(draft) })}
                                                        disabled={!(Number(draft) > 0) || save.isPending}
                                                        className="text-emerald-600 hover:text-emerald-800 me-3 disabled:opacity-30"
                                                        title={t('save', { defaultValue: 'Save' }) as string}
                                                    >
                                                        {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                    <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600" title={t('cancel', { defaultValue: 'Cancel' }) as string}>
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => beginEdit(r)} className="text-slate-400 hover:text-[#511d29] me-3" title={t('edit', { defaultValue: 'Edit' }) as string}>
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(t('structures_delete_confirm', {
                                                                defaultValue: 'Remove the rate for {{c}} / {{g}} / {{l}}?',
                                                                c: r.jobCategory, g: r.jobGrade, l: r.structureLevel,
                                                            }) as string)) remove.mutate(r.id);
                                                        }}
                                                        disabled={remove.isPending}
                                                        className="text-slate-300 hover:text-rose-600 disabled:opacity-30"
                                                        title={t('delete', { defaultValue: 'Delete' }) as string}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {canManage && (
                <p className="text-xs text-slate-400 font-medium mt-4 flex items-start gap-2">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {t('structures_edit_note', {
                        defaultValue: 'A changed rate applies the next time a period is computed. Periods already closed keep the rate they were signed off with — every run stores its own copy.',
                    })}
                </p>
            )}
        </div>
    );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs font-bold text-slate-500 mb-1">{label}</span>
        {children}
    </label>
);

export default SalaryStructuresPage;
