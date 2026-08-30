import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ExternalLink, UserSquare2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { personnelActionService } from '../../services/personnelActionService';
import { SERVER_URL } from '../../services/apiClient';

const fmt = (v?: string | null) => (v ? format(parseISO(v), 'dd MMM yyyy') : '—');

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <span className="block font-black uppercase text-[9px] tracking-wider text-slate-400">{label}</span>
        <div className="font-bold text-slate-700 break-words">{value}</div>
    </div>
);

const TransferDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: d, isLoading, error } = useQuery({
        queryKey: ['personnel-action', id],
        queryFn: () => personnelActionService.getById(id!),
        enabled: !!id,
    });

    if (isLoading) {
        return <div className="max-w-3xl mx-auto py-20 text-center text-sm font-bold text-slate-400">Loading transfer…</div>;
    }
    if (error || !d) {
        return (
            <div className="max-w-3xl mx-auto py-20 text-center space-y-4">
                <p className="text-sm font-bold text-slate-500">This transfer could not be found.</p>
                <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50">Go back</button>
            </div>
        );
    }

    const isIc = d.actionType === 'INTER_COMPANY_TRANSFER';
    const from = [d.currentDivision, d.currentDepartment, d.currentUnit].filter(Boolean).join(' · ');
    const toPlacement = [d.newDivisionName, d.newDepartmentName, d.newUnitName].filter(Boolean).join(' · ');
    const to = isIc ? [d.newCompany, toPlacement].filter(Boolean).join(' · ') : toPlacement;
    const statusStyle = d.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : d.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
    const docHref = d.documentUrl ? (d.documentUrl.startsWith('http') ? d.documentUrl : `${SERVER_URL}${d.documentUrl}`) : '';

    const factors: Array<[string, number | null | undefined]> = [
        ['English Factor', d.englishFactor], ['Position Factor', d.positionFactor],
        ['Location / Frontline Factor', d.locationFactor], ['Skill Factor', d.skillFactor],
    ];
    const shownFactors = factors.filter(([, v]) => v !== null && v !== undefined && (v as any) !== '');

    const rows: Array<[string, React.ReactNode]> = ([
        ['Type', isIc ? 'Inter-Company Transfer' : 'Internal Move'],
        ...(d.typeOfTransfer ? [['Transfer Type', d.typeOfTransfer]] : []),
        ...(isIc && d.newCompany ? [['Destination Company', d.newCompany]] : []),
        ['New Position', d.newPositionTitle],
        ['New Job Category', d.newJobCategory],
        ['New Job Grade', d.newJobGrade],
        ['Reports To', d.reportsTo],
        ['Place of Work', d.newPlaceOfWork],
    ] as Array<[string, React.ReactNode]>).filter(([, v]) => v);

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => d.employeeId ? navigate(`/personnel-relations/lifecycle?employeeId=${d.employeeId}`) : navigate(-1)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-black text-[#511d29] truncate">{d.employee?.fullName || 'Transfer'}</h1>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Career Transfer · {isIc ? 'Inter-Company' : 'Internal Move'}</p>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded shrink-0 ${statusStyle}`}>{d.status}</span>
                {d.employeeId && (
                    <button
                        onClick={() => navigate(`/personnel-relations/lifecycle?employeeId=${d.employeeId}`)}
                        className="flex-shrink-0 hidden sm:flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                    >
                        <UserSquare2 size={14} /> Employee File
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-700">{from || '—'}</span>
                    <ArrowRight className="w-4 h-4 shrink-0 text-[#aa7a51]" />
                    <span className="font-black text-[#511d29]">{to || '—'}</span>
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4 text-xs">
                    {rows.map(([label, value]) => <Field key={label} label={label} value={value} />)}
                </div>
            </div>

            {shownFactors.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#aa7a51] mb-3">Compensation Factors</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 text-xs">
                        {shownFactors.map(([label, v]) => <Field key={label} label={label} value={v} />)}
                    </div>
                </div>
            )}

            {d.justification && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#aa7a51] mb-2">Justification</p>
                    <p className="text-xs italic text-slate-500">"{d.justification}"</p>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="text-[11px] text-slate-400 space-y-0.5">
                    {d.effectiveDate && <p>Effective {fmt(d.effectiveDate)}</p>}
                    {d.createdByName && <p>Requested by {d.createdByName}{d.createdAt ? ` on ${fmt(d.createdAt)}` : ''}</p>}
                    {d.decidedByName && <p>Decided by {d.decidedByName}{d.decidedAt ? ` on ${fmt(d.decidedAt)}` : ''}</p>}
                </div>
                {d.documentUrl && (
                    <a href={docHref} target="_blank" rel="noopener noreferrer" className="text-[#511d29] hover:text-[#3a151d] inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                        View signed form <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>
        </div>
    );
};

export default TransferDetailPage;
