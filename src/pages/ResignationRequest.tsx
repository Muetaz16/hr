import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Paperclip, Send, Plus, ArrowLeft, MessageSquareText, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    offboardingService, type MyOffboardingCase, type ExitInterviewRatings,
} from '../services/offboardingService';
import {
    REASON_FOR_LEAVING_OPTIONS, RATING_OPTIONS, RATING_CATEGORIES,
    type ReasonForLeaving, type RatingOption,
} from '../constants/offboardingExitInterview';
import { useAuth } from '../context/AuthContext';

const todayIso = () => new Date().toISOString().slice(0, 10);
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

// Coarse status only — the employee never sees clearance/approval detail, just where their case
// stands in the process.
const caseStatus = (c: MyOffboardingCase): { label: string; cls: string } => {
    switch (c.stage) {
        case 'RESIGNATION_REQUEST': return { label: 'Pending HR Review', cls: 'bg-slate-100 text-slate-600' };
        case 'CLEARANCE': return { label: 'Clearance In Progress', cls: 'bg-blue-100 text-blue-800' };
        case 'SEPARATION_LETTER': return { label: 'Finalizing', cls: 'bg-amber-100 text-amber-800' };
        case 'CLOSED': return { label: 'Completed', cls: 'bg-emerald-100 text-emerald-800' };
        default: return { label: c.stage, cls: 'bg-slate-100 text-slate-600' };
    }
};

const emptyRatings: Record<string, RatingOption | ''> = RATING_CATEGORIES.reduce(
    (acc, cat) => ({ ...acc, [cat.key]: '' }), {},
);

const YesNoToggle: React.FC<{ label: string; value: boolean | null; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
        <div className="grid grid-cols-2 gap-3">
            <label className={`flex items-center justify-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${value === true ? 'border-slate-800 bg-slate-50' : 'border-slate-300'}`}>
                <input type="radio" checked={value === true} onChange={() => onChange(true)} /> Yes
            </label>
            <label className={`flex items-center justify-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${value === false ? 'border-slate-800 bg-slate-50' : 'border-slate-300'}`}>
                <input type="radio" checked={value === false} onChange={() => onChange(false)} /> No
            </label>
        </div>
    </div>
);

const ResignationRequest: React.FC = () => {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [showExitInterview, setShowExitInterview] = useState(false);

    const { data: myCases, isLoading: casesLoading } = useQuery({
        queryKey: ['my-offboarding-cases'],
        queryFn: () => offboardingService.getMyCases(),
    });

    const { data: identity } = useQuery({
        queryKey: ['my-offboarding-identity'],
        queryFn: () => offboardingService.getMyIdentity(),
        enabled: showForm || showExitInterview,
    });

    // Resignation Request form state
    const [reason, setReason] = useState('');
    const [letterText, setLetterText] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Exit Interview form state
    const [effectiveDate, setEffectiveDate] = useState(todayIso());
    const [reasonCategory, setReasonCategory] = useState<ReasonForLeaving | ''>('');
    const [reasonOther, setReasonOther] = useState('');
    const [ratings, setRatings] = useState<Record<string, RatingOption | ''>>(emptyRatings);
    const [appreciatedMost, setAppreciatedMost] = useState('');
    const [likedLeast, setLikedLeast] = useState('');
    const [improvementSuggestions, setImprovementSuggestions] = useState('');
    const [interestedInReemployment, setInterestedInReemployment] = useState<boolean | null>(null);
    const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
    const [contactEmail, setContactEmail] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [submittingExit, setSubmittingExit] = useState(false);

    const hasOpenCase = !!myCases?.some(c => c.stage !== 'CLOSED');
    // Exit interview is mandatory for every case except a disciplinary termination.
    const pendingExitInterview = myCases?.find(c => !c.exitInterviewSubmittedAt && !['DISCIPLINARY_TERMINATION', 'TERMINATION'].includes(c.source));

    const resetForm = () => {
        setReason('');
        setLetterText('');
        setAttachments([]);
    };

    const resetExitInterview = () => {
        setEffectiveDate(todayIso());
        setReasonCategory('');
        setReasonOther('');
        setRatings(emptyRatings);
        setAppreciatedMost('');
        setLikedLeast('');
        setImprovementSuggestions('');
        setInterestedInReemployment(null);
        setWouldRecommend(null);
        setContactEmail('');
        setContactNumber('');
    };

    const handleAttachmentsChange = (fileList: FileList | null) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const oversized = files.filter(f => f.size > MAX_ATTACHMENT_SIZE);
        const accepted = files.filter(f => f.size <= MAX_ATTACHMENT_SIZE);
        if (oversized.length) toast.error(`${oversized.length} file(s) exceed the 10 MB limit and were skipped.`);
        setAttachments(prev => {
            const combined = [...prev, ...accepted];
            if (combined.length > MAX_ATTACHMENTS) {
                toast.error(`A maximum of ${MAX_ATTACHMENTS} attachments is allowed.`);
                return combined.slice(0, MAX_ATTACHMENTS);
            }
            return combined;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) return toast.error('A reason for resignation is required.');
        if (!letterText.trim()) return toast.error('Your resignation letter is required.');

        setSubmitting(true);
        try {
            const created = await offboardingService.createResignationRequest({ reason, letterText });
            if (attachments.length) {
                await offboardingService.uploadResignationAttachments(created.id, attachments);
            }
            toast.success('Resignation request submitted. Human Resources will review it.');
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['my-offboarding-cases'] });
            setShowForm(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to submit the resignation request.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitExitInterview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!effectiveDate) return toast.error('Effective Date of Resignation is required.');
        if (!reasonCategory) return toast.error('Please select a reason for leaving.');
        if (reasonCategory === 'OTHERS' && !reasonOther.trim()) return toast.error('Please specify your reason for leaving.');
        const missingRating = RATING_CATEGORIES.find(cat => !ratings[cat.key]);
        if (missingRating) return toast.error(`Please rate "${missingRating.label}".`);
        if (!appreciatedMost.trim() || !likedLeast.trim() || !improvementSuggestions.trim()) {
            return toast.error('Please answer all three feedback questions.');
        }
        if (interestedInReemployment === null || wouldRecommend === null) {
            return toast.error('Please answer both yes/no questions.');
        }

        setSubmittingExit(true);
        try {
            await offboardingService.submitExitInterview({
                effectiveDate,
                reasonCategory,
                reasonOther: reasonCategory === 'OTHERS' ? reasonOther : undefined,
                ratings: ratings as ExitInterviewRatings,
                appreciatedMost,
                likedLeast,
                improvementSuggestions,
                interestedInReemployment,
                wouldRecommend,
                contactEmail: contactEmail || undefined,
                contactNumber: contactNumber || undefined,
            });
            toast.success('Thank you — your exit interview has been submitted.');
            resetExitInterview();
            queryClient.invalidateQueries({ queryKey: ['my-offboarding-cases'] });
            setShowExitInterview(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to submit the exit interview.');
        } finally {
            setSubmittingExit(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-start gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <LogOut size={22} />
                </div>
                <div>
                    <h1 className="text-xl font-semibold text-slate-800">Resignation Request</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        File your own resignation here — Human Resources will process it through clearance and
                        final settlement.
                    </p>
                </div>
            </div>

            {currentUser && !showForm && !showExitInterview && (
                <div className="space-y-4">
                    <button
                        onClick={() => setShowForm(true)}
                        disabled={hasOpenCase}
                        className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={16} /> {hasOpenCase ? 'You already have an open case' : 'File Resignation Request'}
                    </button>

                    {pendingExitInterview && (
                        <button
                            onClick={() => setShowExitInterview(true)}
                            className="flex items-center justify-center gap-2 w-full border border-amber-400 bg-amber-50 text-amber-800 rounded-lg py-2.5 text-sm font-medium hover:bg-amber-100"
                        >
                            <MessageSquareText size={16} /> Exit Interview required — Submit now
                        </button>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500">My Cases</span>
                        </div>
                        {casesLoading && <p className="text-sm text-slate-400 text-center py-6">Loading…</p>}
                        {!casesLoading && (myCases?.length ?? 0) === 0 && (
                            <p className="text-sm text-slate-400 text-center py-6">You haven't filed any cases yet.</p>
                        )}
                        {!casesLoading && !!myCases?.length && (
                            <table className="w-full text-left text-sm">
                                <tbody className="divide-y divide-slate-100">
                                    {myCases.map(c => {
                                        const status = caseStatus(c);
                                        return (
                                            <tr key={c.id}>
                                                <td className="px-5 py-3 text-slate-400 text-xs">{c.caseNumber}</td>
                                                <td className="px-5 py-3 text-slate-500 text-xs">
                                                    {(c.resignationFiledAt || c.createdAt).slice(0, 10)}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${status.cls}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {currentUser && showForm && (
                <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                        <div><span className="block text-[10px] font-black uppercase text-slate-400">Employee ID</span>{identity?.employeeId || '—'}</div>
                        <div><span className="block text-[10px] font-black uppercase text-slate-400">Employee Name</span>{identity?.employeeName || '—'}</div>
                        <div><span className="block text-[10px] font-black uppercase text-slate-400">Unit</span>{identity?.unit || '—'}</div>
                        <div><span className="block text-[10px] font-black uppercase text-slate-400">Department</span>{identity?.department || '—'}</div>
                        <div><span className="block text-[10px] font-black uppercase text-slate-400">Position</span>{identity?.position || '—'}</div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reason for resignation</label>
                        <input
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Resignation letter</label>
                        <textarea
                            value={letterText}
                            onChange={e => setLetterText(e.target.value)}
                            rows={6}
                            placeholder="Write your resignation letter here…"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                            <Paperclip size={14} /> Additional attachments (optional, up to 10 files, 10 MB each)
                        </label>
                        <input
                            type="file"
                            multiple
                            onChange={e => { handleAttachmentsChange(e.target.files); e.target.value = ''; }}
                            className="w-full text-sm text-slate-600"
                        />
                        {attachments.length > 0 && (
                            <ul className="mt-2 space-y-1">
                                {attachments.map((f, i) => (
                                    <li key={i} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                        <span className="truncate">{f.name}</span>
                                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-600">
                                            <X size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-900 disabled:opacity-60"
                    >
                        <Send size={16} /> {submitting ? 'Submitting…' : 'Submit request'}
                    </button>
                </form>
            )}

            {currentUser && showExitInterview && (
                <form onSubmit={handleSubmitExitInterview} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowExitInterview(false)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                        <div><span className="block text-[10px] font-black uppercase text-slate-400">Employee Name</span>{identity?.employeeName || '—'}</div>
                        <div><span className="block text-[10px] font-black uppercase text-slate-400">Unit</span>{identity?.unit || '—'}</div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date of Resignation</label>
                        <input
                            type="date"
                            value={effectiveDate}
                            onChange={e => setEffectiveDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Leaving</label>
                        <div className="space-y-1.5">
                            {REASON_FOR_LEAVING_OPTIONS.map(opt => (
                                <label key={opt.value} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${reasonCategory === opt.value ? 'border-slate-800 bg-slate-50' : 'border-slate-300'}`}>
                                    <input type="radio" checked={reasonCategory === opt.value} onChange={() => setReasonCategory(opt.value)} />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                        {reasonCategory === 'OTHERS' && (
                            <input
                                value={reasonOther}
                                onChange={e => setReasonOther(e.target.value)}
                                placeholder="Please specify"
                                className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">How would you rate IPH on the following aspects?</label>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr>
                                        <th className="text-left p-1"></th>
                                        {RATING_OPTIONS.map(r => <th key={r} className="p-1 font-medium text-slate-500">{r.charAt(0) + r.slice(1).toLowerCase()}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {RATING_CATEGORIES.map(cat => (
                                        <tr key={cat.key} className="border-t border-slate-100">
                                            <td className="p-1.5 text-slate-700">{cat.label}</td>
                                            {RATING_OPTIONS.map(r => (
                                                <td key={r} className="p-1.5 text-center">
                                                    <input
                                                        type="radio"
                                                        checked={ratings[cat.key] === r}
                                                        onChange={() => setRatings(prev => ({ ...prev, [cat.key]: r }))}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">What aspects of working at IPH did you appreciate the most?</label>
                        <textarea value={appreciatedMost} onChange={e => setAppreciatedMost(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">What did you like least about working at the company?</label>
                        <textarea value={likedLeast} onChange={e => setLikedLeast(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">What improvements would you like to recommend for the company?</label>
                        <textarea value={improvementSuggestions} onChange={e => setImprovementSuggestions(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" required />
                    </div>

                    <YesNoToggle label="Would you be interested in re-employment with IPH in the future?" value={interestedInReemployment} onChange={setInterestedInReemployment} />
                    <YesNoToggle label="Would you feel comfortable recommending IPH as an employer to friends and colleagues?" value={wouldRecommend} onChange={setWouldRecommend} />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email (optional)</label>
                            <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number (optional)</label>
                            <input value={contactNumber} onChange={e => setContactNumber(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submittingExit}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-900 disabled:opacity-60"
                    >
                        <Send size={16} /> {submittingExit ? 'Submitting…' : 'Submit exit interview'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default ResignationRequest;
