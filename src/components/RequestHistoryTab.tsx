import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { staffHubService } from '../services/staffHubService';
import type { LeaveRequestWithEmployee } from '../services/staffHubService';
import { SERVER_URL } from '../services/apiClient';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Download, FileCheck } from 'lucide-react';

// Decision archive — every leave/permission/work-auth request this approver's scope has already
// resolved (COMPLETED or REJECTED). Moved out of the Manager Control Room into "My Approvals".
const RequestHistoryTab: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const [historyRequests, setHistoryRequests] = useState<LeaveRequestWithEmployee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const hist = await staffHubService.getPendingRequests({
                    departmentId: currentUser?.departmentId || undefined,
                    groupId: currentUser?.groupId || undefined,
                    unitId: currentUser?.unitId || undefined,
                    divisionId: currentUser?.divisionId || undefined,
                    status: 'COMPLETED,REJECTED',
                });
                setHistoryRequests(hist);
            } catch {
                toast.error(t('failed_to_load_data', { defaultValue: 'Failed to load data.' }));
            } finally {
                setLoading(false);
            }
        })();
    }, [currentUser]);

    const downloadRequestForm = async (requestId: string, type?: string) => {
        try {
            const blob = await staffHubService.getLeaveForm(requestId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const prefix = type === 'WORK_AUTHORIZATION'
                ? 'Work_Authorization'
                : type === 'EXCEPTIONAL_PERFORMANCE'
                    ? 'Exceptional_Performance_Nomination'
                    : (['LATE_COMING', 'EARLY_LEAVING', 'HOURS_LEAVE'].includes(type || '') ? 'Permission_Request' : 'Leave_Request');
            a.download = `${prefix}_${requestId.slice(0, 8)}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error(t('leave_form_failed', { defaultValue: 'Failed to generate the form.' }));
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">{t('loading_approvals', { defaultValue: 'Loading…' })}</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-800">{t('decision_archive', { defaultValue: 'Decision Archive' })}</h2>
                <p className="text-slate-400 text-sm">{historyRequests.length} {t('historical_records', { defaultValue: 'historical records' })}</p>
            </div>

            <div className="grid gap-4">
                {historyRequests.map(req => (
                    <div key={req.id} className="bg-white rounded-3xl p-6 border border-slate-100 flex flex-col md:flex-row items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-14 h-14 rounded-2xl bg-[#511d29]/5 flex flex-col items-center justify-center text-[#511d29] border border-[#511d29]/10">
                            <span className="text-[8px] font-bold uppercase">{format(new Date(req.startDate), 'MMM')}</span>
                            <span className="text-lg font-black">{format(new Date(req.startDate), 'dd')}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-slate-800">{(req as any).employee?.fullName || t('staff_member', { defaultValue: 'Staff Member' })}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${req.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                    {req.status}
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">{t(req.type.toLowerCase(), { defaultValue: req.type.replace(/_/g, ' ') })} • {format(new Date(req.startDate), 'PPP')}</div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl flex-1 max-w-md italic text-xs text-slate-500 border border-slate-100">
                            "{req.reason || t('no_specific_note', { defaultValue: 'No specific note' })}"
                        </div>

                        {req.finalDocumentUrl ? (
                            <a
                                href={`${SERVER_URL}${req.finalDocumentUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                title={req.finalDocumentName || t('final_document', { defaultValue: 'Final Document' })}
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors"
                            >
                                <FileCheck className="w-4 h-4" /> {t('view_document', { defaultValue: 'View Document' })}
                            </a>
                        ) : req.status === 'COMPLETED' && (
                            <button
                                onClick={() => downloadRequestForm(req.id, req.type)}
                                title={t('download_form', { defaultValue: 'Download Form' })}
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                            >
                                <Download className="w-4 h-4" /> {t('form', { defaultValue: 'Form' })}
                            </button>
                        )}

                        <div className="flex items-center gap-2 text-[8px] font-bold uppercase text-slate-400">
                            <div className="flex flex-col items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${req.status !== 'PENDING' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                <span className="text-slate-400">{t('unit_approval', { defaultValue: 'Unit' })}</span>
                            </div>
                            <div className="w-3 h-[1px] bg-slate-200"></div>
                            <div className="flex flex-col items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DEPT', 'APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                <span className="text-slate-400">{t('dept_approval', { defaultValue: 'Dept' })}</span>
                            </div>
                            <div className="w-3 h-[1px] bg-slate-200"></div>
                            <div className="flex flex-col items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${['APPROVED_BY_DIRECTOR', 'COMPLETED'].includes(req.status) ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                <span className="text-slate-400">{t('dir_approval', { defaultValue: 'Director' })}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {historyRequests.length === 0 && (
                    <div className="py-20 text-center glass-card rounded-3xl text-slate-400 italic">{t('no_historical_records_found', { defaultValue: 'No historical records found.' })}</div>
                )}
            </div>
        </div>
    );
};

export default RequestHistoryTab;
