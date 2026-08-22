import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    pageSize: number;
    itemLabel?: string;
}

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onPageChange, totalItems, pageSize, itemLabel = 'items' }) => {
    const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Showing {start}–{end} of {totalItems} {itemLabel}
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    Page {page} of {totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
