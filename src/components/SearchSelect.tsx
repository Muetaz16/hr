import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search } from 'lucide-react';

export interface SearchOption { value: string; label: string; sub?: string; group?: string }

// Two visual themes exist in the app today: the standard admin-forms look (rounded-lg inputs,
// indigo focus ring — used by Departments/Units/JobDescriptionForm and most other admin CRUD
// screens) and Personnel Relations' own sharp-cornered maroon theme. Pass `variant` to match
// whichever screen this is dropped into instead of it looking visually foreign next to the
// surrounding plain <select>/<input> fields.
const VARIANTS = {
    default: {
        trigger: 'w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-start flex items-center justify-between gap-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        panel: 'absolute z-50 mt-1 w-full bg-white border border-gray-200 shadow-xl rounded-lg max-h-64 overflow-auto',
        searchInput: 'w-full ps-8 pe-2 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
        option: 'w-full text-start px-3 py-2 text-xs hover:bg-indigo-50',
        optionSelected: 'bg-indigo-50 font-black text-indigo-700',
        optionDefault: 'text-slate-600',
    },
    maroon: {
        trigger: 'w-full p-2 border border-[#511d29]/20 bg-white text-start flex items-center justify-between gap-2',
        panel: 'absolute z-50 mt-1 w-full bg-white border border-[#511d29]/20 shadow-xl rounded-lg max-h-64 overflow-auto',
        searchInput: 'w-full ps-8 pe-2 py-1.5 border border-slate-200 rounded text-xs',
        option: 'w-full text-start px-3 py-2 text-xs hover:bg-[#511d29]/5',
        optionSelected: 'bg-[#511d29]/10 font-black text-[#511d29]',
        optionDefault: 'text-slate-600',
    },
} as const;

// A compact searchable dropdown (combobox): shows the selected label, opens a filterable list on
// click, groups options by `group`, and closes on outside-click. Use this instead of a plain
// <select> once the option list gets long enough that scrolling through it becomes the bottleneck
// (e.g. picking one department/office out of dozens).
const SearchSelect: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: SearchOption[];
    placeholder?: string;
    emptyText?: string;
    variant?: keyof typeof VARIANTS;
}> = ({ value, onChange, options, placeholder, emptyText, variant = 'default' }) => {
    const { t } = useTranslation();
    const style = VARIANTS[variant];
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);
    const selected = options.find(o => o.value === value);
    const q = query.trim().toLowerCase();
    const filtered = q
        ? options.filter(o => `${o.label} ${o.sub || ''} ${o.group || ''}`.toLowerCase().includes(q))
        : options;
    const groups: Record<string, SearchOption[]> = {};
    filtered.forEach(o => { const g = o.group || ''; (groups[g] = groups[g] || []).push(o); });
    const groupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={() => setOpen(o => !o)} className={style.trigger}>
                <span className={`truncate ${selected ? 'text-slate-700' : 'text-slate-400'}`}>{selected ? selected.label : (placeholder || t('select_ellipsis', { defaultValue: 'Select…' }))}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className={style.panel}>
                    <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                                placeholder={t('search_ellipsis', { defaultValue: 'Search…' })} className={style.searchInput} />
                        </div>
                    </div>
                    {filtered.length === 0 && <div className="px-3 py-4 text-center text-slate-400 text-xs">{emptyText || t('no_matches', { defaultValue: 'No matches' })}</div>}
                    {groupKeys.map(g => (
                        <div key={g}>
                            {g && <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 sticky top-[49px]">{g}</div>}
                            {groups[g].map(o => (
                                <button type="button" key={o.value} onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                                    className={`${style.option} ${o.value === value ? style.optionSelected : style.optionDefault}`}>
                                    {o.label}{o.sub ? <span className="text-slate-400 font-normal"> · {o.sub}</span> : null}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchSelect;
