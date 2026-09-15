import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { staffHubService } from '../services/staffHubService';
import type { LeaveApprovalStep } from '../services/staffHubService';
import { SERVER_URL } from '../services/apiClient';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Download, FileCheck, CheckCircle2, XCircle } from 'lucide-react';

// This approver's OWN decision record: the requests THEY approved or rejected, newest first.
//
// It used to list every resolved request in the user's department/division scope, which answers a
// different question — a head saw decisions made by other people, and a request they personally
// signed elsewhere in the org was missing from their own history. The list is now keyed on who
// decided, scoped server-side by approverUserId exactly as the inbox is.
//
// Rejections are kept, not just approvals: a decision archive that hides the requests you turned
// down is the half you are most likely to be asked about later.
const RequestHistoryTab: React.FC = () => {
    const { t } = useTranslation();
    const [steps, setSteps] = useState<LeaveApprovalStep[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                setSteps(await staffHubService.getMyDecidedSteps());
            } catch {
                toast.error(t('failed_to_load_data', { defaultValue: 'Failed to load data.' }));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

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
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{t('decision_archive', { defaultValue: 'Decision Archive' })}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {t('decision_archive_subtitle', { defaultValue: 'Requests you decided yourself — not everything your department filed.' })}
                    </p>
                </div>
                <p className="text-slate-400 text-sm">{steps.length} {t('historical_records', { defaultValue: 'historical records' })}</p>
            </div>

            <div className="grid gap-4">
                {steps.map(step => {
                    const req = step.leaveRequest;
                    if (!req) return null;
                    const mine = step.status === 'APPROVED';
                    const MineIcon = mine ? CheckCircle2 : XCircle;
                    return (
                        <div key={step.id} className="bg-white rounded-3xl p-6 border border-slate-100 flex flex-col md:flex-row items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 rounded-2xl bg-[#511d29]/5 flex flex-col items-center justify-center text-[#511d29] border border-[#511d29]/10 shrink-0">
                                <span className="text-[8px] font-bold uppercase">{format(new Date(req.startDate), 'MMM')}</span>
                                <span className="text-lg font-black">{format(new Date(req.startDate), 'dd')}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-bold text-slate-800">{req.employee?.fullName || t('staff_member', { defaultValue: 'Staff Member' })}</span>
                                    {/* What THIS person did, which is the point of the page. */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                        mine ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                                    }`}>
                                        <MineIcon className="w-3 h-3" />
                                        {mine
                                            ? t('you_approved', { defaultValue: 'You approved' })
                                            : t('you_rejected', { defaultValue: 'You rejected' })}
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    {t(req.type.toLowerCase(), { defaultValue: req.type.replace(/_/g, ' ') })} • {format(new Date(req.startDate), 'PPP')}
                                    {step.decidedAt && <> • {t('decided_on', { defaultValue: 'decided' })} {format(new Date(step.decidedAt), 'PPP')}</>}
                                </div>
                                {/* The request's own outcome, which may differ from this decision — a
                                    later approver can still reject something this person approved. */}
                                <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                                    {t('final_outcome', { defaultValue: 'Outcome' })}: {t(`request_status_${req.status}`, { defaultValue: String(req.status).replace(/_/g, ' ') })}
                                </div>
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
                            ) : (
                                <button
                                    onClick={() => downloadRequestForm(req.id, req.type)}
                                    title={t('download_form', { defaultValue: 'Download Form' })}
                                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                                >
                                    <Download className="w-4 h-4" /> {t('form', { defaultValue: 'Form' })}
                                </button>
                            )}
                        </div>
                    );
                })}

                {steps.length === 0 && (
                    <div className="py-20 text-center glass-card rounded-3xl text-slate-400 italic">
                        {t('no_decisions_yet', { defaultValue: 'You have not decided any requests yet.' })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RequestHistoryTab;
