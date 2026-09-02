import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { candidateService } from '../services/candidateService';
import { recruitmentService } from '../services/recruitmentService';
import api, { SERVER_URL } from '../services/apiClient';
import type { Candidate, RecruitmentRequest } from '../types';
import {
    UserPlus, Plus, Building2, Briefcase, Trash2, CheckCircle2, XCircle,
    CalendarDays, Star, Mail, Phone, Paperclip, ThumbsUp, ThumbsDown, ArrowRight, ArrowLeft, FileText, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';
import { canAccess } from '../utils/access';

type View = 'screening' | 'interview' | 'offer' | 'onboarding';
type ActionType = 'screen' | 'schedule' | 'hrEval' | 'techEval' | 'finalize' | 'offer' | 'details' | 'editOffer';

const fmtDateTime = (iso?: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return '—'; }
};

// ISO -> value for <input type="datetime-local">
const toLocalInput = (iso?: string) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
    } catch { return ''; }
};

// Detailed interview-evaluation criteria (mirrors the EVALUATION.docx form). Each scored 1-5.
const HR_CRITERIA = [
    { key: 'englishProficiency', label: 'English Proficiency' },
    { key: 'motivation', label: 'Motivation for Role' },
    { key: 'culturalFit', label: 'Cultural Fit & Attitude' },
    { key: 'communication', label: 'Communication Skills' },
    { key: 'professionalism', label: 'Professionalism' },
];
const TECH_CRITERIA = [
    { key: 'technicalKnowledge', label: 'Technical Knowledge' },
    { key: 'problemSolving', label: 'Problem-Solving Skills' },
    { key: 'relevantExperience', label: 'Relevant Experience' },
    { key: 'softwareProficiency', label: 'Software/Tool Proficiency' },
    { key: 'learningAdaptability', label: 'Learning Adaptability' },
];

const Stars: React.FC<{ value?: number }> = ({ value }) => (
    <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
            <Star key={n} className={`w-3.5 h-3.5 ${(value || 0) >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
        ))}
    </span>
);

const CandidatePipeline: React.FC<{ view: View }> = ({ view }) => {
    const { currentUser } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const confirm = useConfirm();

    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [requisitions, setRequisitions] = useState<RecruitmentRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const isHR = canAccess(currentUser, ['HR_MANAGER'], ['manage_recruitment']);
    const isAdmin = currentUser?.role === 'SUPER_ADMIN';
    // Higher management can accept/reject candidates as an override (in addition to the owning head).
    const isMgmt = canAccess(currentUser, ['GENERAL_MANAGER', 'CHAIRMAN'], ['recruitment_approvals']);

    // Add-candidate modal (screening view)
    const emptyAddForm = {
        requisitionId: '', fullName: '', phone: '', email: '', source: '', speciality: '',
        yearsExperience: '', salaryExpectation: '', nationality: '', dateOfBirth: '', placeOfLiving: '',
        // Job-offer parameters — captured here so the offer can be generated in one click later.
        salaryStructure: '', jobGrade: '', placeOfWork: '', contractMonths: 6 as number, residentStatus: '',
        cv: null as File | null, degree: null as File | null, portfolio: null as File | null,
    };
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ ...emptyAddForm });
    const setAdd = (patch: Partial<typeof emptyAddForm>) => setAddForm(prev => ({ ...prev, ...patch }));
    const [submitting, setSubmitting] = useState(false);

    // Generic action modal
    const [actCand, setActCand] = useState<Candidate | null>(null);
    const [actType, setActType] = useState<ActionType | null>(null);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [note, setNote] = useState('');
    const [criteria, setCriteria] = useState<Record<string, number>>({});
    const [recommend, setRecommend] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [salaryStructures, setSalaryStructures] = useState<any[]>([]);
    const [schedAt, setSchedAt] = useState('');
    const [schedLoc, setSchedLoc] = useState('');
    const [editOfferForm, setEditOfferForm] = useState({
        residentStatus: '', salaryStructure: '', jobGrade: '', jobCategory: '', placeOfWork: '', contractMonths: 6 as number
    });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        api.get('/salary-structures').then(res => setSalaryStructures(res.data)).catch(console.error);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cands, reqs] = await Promise.all([
                candidateService.getCandidates(),
                view === 'screening' ? recruitmentService.getAllRequests() : Promise.resolve([] as RecruitmentRequest[]),
            ]);
            setCandidates(cands);
            setRequisitions(reqs);
        } catch {
            toast.error(t('err_load_candidates', { defaultValue: 'Failed to load candidates.' }));
        } finally {
            setLoading(false);
        }
    };

    const isRequester = (c: Candidate) => isAdmin || isMgmt || c.requisition?.requester?.id === currentUser?.id;

    // Approved hire requisitions this user can source candidates against.
    // Also include filled (closed) requisitions if they already have candidates submitted to them.
    const openReqs = requisitions.filter(r => r.type === 'HIRE' && r.status === 'FULLY_APPROVED' && (!r.filled || candidates.some(c => c.requisitionId === r.id)));

    const cvUrl = (c: Candidate) => c.cvPath ? `${SERVER_URL}${c.cvPath}` : null;

    // ---- actions ----
    const openAdd = (reqId?: string) => {
        setAddForm({ ...emptyAddForm, requisitionId: reqId || '' });
        setAddOpen(true);
    };

    const submitAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.requisitionId) { toast.error(t('select_req_required', { defaultValue: 'Select the requisition this candidate is for.' })); return; }
        if (!addForm.fullName.trim()) { toast.error(t('cand_name_required', { defaultValue: 'The candidate name is required.' })); return; }
        setSubmitting(true);
        try {
            await candidateService.createCandidate(addForm);
            toast.success(t('cand_added', { defaultValue: 'Candidate added.' }));
            setAddOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('err_add_cand', { defaultValue: 'Failed to add candidate.' }));
        } finally { setSubmitting(false); }
    };

    const openAction = (c: Candidate, type: ActionType) => {
        setActCand(c); setActType(type);
        setNote('');
        setRecommend(true);
        // Seed the evaluation criteria: reuse an existing evaluation if present, else default each to 3.
        const defs = type === 'hrEval' ? HR_CRITERIA : type === 'techEval' ? TECH_CRITERIA : [];
        const existing = (type === 'hrEval' ? c.hrCriteria : type === 'techEval' ? c.techCriteria : undefined) as Record<string, number> | undefined;
        setCriteria(Object.fromEntries(defs.map(d => [d.key, existing?.[d.key] ?? 3])));
        setSchedAt(toLocalInput(c.interviewAt)); setSchedLoc(c.interviewLocation || '');
        if (type === 'editOffer') {
            setEditOfferForm({
                residentStatus: c.residentStatus || '',
                salaryStructure: c.salaryStructure || '',
                jobGrade: c.jobGrade || '',
                jobCategory: c.jobCategory || c.requisition?.jobDescription?.jobCategories?.[0] || '',
                placeOfWork: c.placeOfWork || (c.requisition?.jobDescription?.workLocations?.length === 1 ? c.requisition.jobDescription.workLocations[0] : ''),
                contractMonths: c.contractMonths || 6
            });
        }
    };
    const closeAction = () => { setActCand(null); setActType(null); };

    const runScreen = async (decision: 'ACCEPTED' | 'REJECTED') => {
        if (!actCand) return;
        try {
            await candidateService.screen(actCand.id, decision, note);
            toast.success(decision === 'ACCEPTED' ? t('cand_accepted', { defaultValue: 'Candidate accepted — moved to interviews.' }) : t('cand_rejected', { defaultValue: 'Candidate rejected.' }));
            closeAction(); fetchData();
        } catch (err: any) { toast.error(err.response?.data?.error || t('err_action', { defaultValue: 'Action failed.' })); }
    };

    const runSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!actCand) return;
        if (!schedAt) { toast.error(t('interview_date_required', { defaultValue: 'An interview date/time is required.' })); return; }
        try {
            await candidateService.scheduleInterview(actCand.id, { interviewAt: new Date(schedAt).toISOString(), interviewLocation: schedLoc, interviewNote: note });
            toast.success(t('interview_scheduled', { defaultValue: 'Interview scheduled.' }));
            closeAction(); fetchData();
        } catch (err: any) { toast.error(err.response?.data?.error || t('err_action', { defaultValue: 'Action failed.' })); }
    };

    const runEval = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!actCand || !actType) return;
        const defs = actType === 'hrEval' ? HR_CRITERIA : TECH_CRITERIA;
        if (!defs.every(d => criteria[d.key] >= 1 && criteria[d.key] <= 5)) {
            toast.error(t('all_criteria_required', { defaultValue: 'Please score every criterion (1-5).' }));
            return;
        }
        try {
            if (actType === 'hrEval') await candidateService.submitHrEval(actCand.id, { criteria, recommend, note });
            else await candidateService.submitTechEval(actCand.id, { criteria, recommend, note });
            toast.success(t('eval_saved', { defaultValue: 'Evaluation saved.' }));
            closeAction(); fetchData();
        } catch (err: any) { toast.error(err.response?.data?.error || t('err_action', { defaultValue: 'Action failed.' })); }
    };

    const runFinalize = async (decision: 'ACCEPTED' | 'REJECTED') => {
        if (!actCand) return;
        try {
            await candidateService.finalize(actCand.id, decision, note);
            toast.success(decision === 'ACCEPTED' ? t('cand_to_offer', { defaultValue: 'Accepted — moved to onboarding.' }) : t('cand_rejected', { defaultValue: 'Candidate rejected.' }));
            closeAction(); fetchData();
        } catch (err: any) { toast.error(err.response?.data?.error || t('err_action', { defaultValue: 'Action failed.' })); }
    };

    const runEditOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!actCand) return;
        try {
            await candidateService.updateOfferDetails(actCand.id, editOfferForm);
            toast.success(t('offer_details_updated', { defaultValue: 'Offer details updated.' }));
            closeAction(); fetchData();
        } catch (err: any) { toast.error(err.response?.data?.error || t('err_action', { defaultValue: 'Action failed.' })); }
    };

    const runOffer = async (decision: 'ACCEPTED' | 'DECLINED') => {
        if (!actCand) return;
        try {
            await candidateService.recordOffer(actCand.id, decision, note);
            toast.success(decision === 'ACCEPTED' ? t('offer_accepted', { defaultValue: 'Offer accepted — ready to enroll.' }) : t('offer_declined', { defaultValue: 'Offer declined.' }));
            closeAction(); fetchData();
        } catch (err: any) { toast.error(err.response?.data?.error || t('err_action', { defaultValue: 'Action failed.' })); }
    };

    // ---- Job offer generation ----
    // Experience → job grade brackets (matches the salary-structure table's grades).
    const EXPERIENCE_LEVELS = [
        { grade: 'Trainee', label: t('exp_trainee', { defaultValue: 'Trainee — under 3 months' }) },
        { grade: 'Intern', label: t('exp_intern', { defaultValue: 'Intern — under 1 year' }) },
        { grade: 'Junior', label: t('exp_junior', { defaultValue: 'Junior — 1 to 5 years' }) },
        { grade: 'Lead', label: t('exp_lead', { defaultValue: 'Lead — 5 to 10 years' }) },
        { grade: 'Senior', label: t('exp_senior', { defaultValue: 'Senior — over 10 years' }) },
    ];
    const SS_OPTIONS = ['SS-01-LYD', 'SS-02-USD', 'SS-03-USD', 'SS-04-EUR', 'SS-05-EUR'];
    // Residents are paid on the local structure (SS-01-LYD) only; (direct) non-residents pick a
    // foreign-currency structure.
    const allowedSalaryStructures = (status?: string): string[] => {
        if (status === 'RESDANT') return ['SS-01-LYD'];
        if (status === 'DIRCT NONE RESDANT' || status === 'NONE RESDANT') return SS_OPTIONS.filter(s => s !== 'SS-01-LYD');
        return SS_OPTIONS;
    };
    // Best-guess grade from the candidate's recorded years of experience (HR can override).
    const deriveGrade = (yrs?: string): string => {
        const y = parseFloat(yrs || '');
        if (isNaN(y)) return 'Junior';
        if (y >= 10) return 'Senior';
        if (y >= 5) return 'Lead';
        if (y >= 1) return 'Junior';
        return 'Intern';
    };

    // One-click generation using the details captured when the candidate was added.
    const [offerBusy, setOfferBusy] = useState<string | null>(null);
    const generateOffer = async (c: Candidate) => {
        // The offer can't be built without the salary structure / experience level. Rather than
        // hit the backend and surface a confusing "re-add the candidate" error, guide HR straight
        // to the Edit Offer Details form.
        if (!c.salaryStructure || !c.jobGrade) {
            toast.warning(t('offer_details_required', {
                defaultValue: 'Please add the offer details (salary structure & experience level) first.'
            }));
            openAction(c, 'editOffer');
            return;
        }
        setOfferBusy(c.id);
        try {
            const blob = await candidateService.generateOffer(c.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Job_Offer_${(c.fullName || 'candidate').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('offer_generated', { defaultValue: 'Job offer generated.' }));
        } catch (err: any) {
            // With responseType 'blob', an error body arrives as a Blob — read it back to JSON.
            let msg = t('err_generate_offer', { defaultValue: 'Failed to generate the job offer.' });
            const data = err.response?.data;
            if (data instanceof Blob) {
                try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep fallback */ }
            } else if (data?.error) {
                msg = data.error;
            }
            toast.error(msg);
        } finally {
            setOfferBusy(null);
        }
    };

    const [evalBusy, setEvalBusy] = useState<string | null>(null);
    const generateEvaluation = async (c: Candidate) => {
        setEvalBusy(c.id);
        try {
            const blob = await candidateService.generateEvaluation(c.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Interview_Evaluation_${(c.fullName || 'candidate').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('eval_generated', { defaultValue: 'Evaluation form generated.' }));
        } catch (err: any) {
            let msg = t('err_generate_eval', { defaultValue: 'Failed to generate the evaluation form.' });
            const data = err.response?.data;
            if (data instanceof Blob) {
                try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep fallback */ }
            } else if (data?.error) {
                msg = data.error;
            }
            toast.error(msg);
        } finally {
            setEvalBusy(null);
        }
    };

    const [letterBusy, setLetterBusy] = useState<string | null>(null);
    const generateHiringLetter = async (c: Candidate) => {
        setLetterBusy(c.id);
        try {
            const blob = await candidateService.generateHiringLetter(c.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Hiring_Letter_${(c.fullName || 'employee').replace(/[^a-zA-Z0-9]+/g, '_')}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(t('hiring_letter_generated', { defaultValue: 'Hiring letter generated.' }));
        } catch (err: any) {
            let msg = t('err_generate_hiring_letter', { defaultValue: 'Failed to generate the hiring letter.' });
            const data = err.response?.data;
            if (data instanceof Blob) {
                try { msg = JSON.parse(await data.text()).error || msg; } catch { /* keep fallback */ }
            } else if (data?.error) {
                msg = data.error;
            }
            toast.error(msg);
        } finally {
            setLetterBusy(null);
        }
    };

    // Show what the new hire submitted through their onboarding link.
    const [onbCand, setOnbCand] = useState<any | null>(null);
    const [onbLoading, setOnbLoading] = useState(false);
    const viewOnboarding = async (c: Candidate) => {
        setOnbCand(c);
        setOnbLoading(true);
        try {
            const full = await candidateService.getCandidateById(c.id);
            setOnbCand(full);
        } catch { /* fall back to the list record */ }
        finally { setOnbLoading(false); }
    };

    const handleDelete = async (c: Candidate) => {
        if (!(await confirm({ message: t('confirm_delete_cand', { defaultValue: 'Remove this candidate?' }), danger: true }))) return;
        try {
            await candidateService.deleteCandidate(c.id);
            toast.success(t('cand_removed', { defaultValue: 'Candidate removed.' }));
            fetchData();
        } catch (err: any) { toast.error(err.response?.data?.error || t('err_action', { defaultValue: 'Action failed.' })); }
    };

    const enroll = (c: Candidate) => {
        const r = c.requisition;
        // Guard: don't start an enrolment the requisition can't accept. Otherwise the employee
        // record gets created but the "hire" step is rejected (position already full), leaving an
        // orphan employee and a candidate stuck at OFFER.
        const quantity = r?.quantity ?? 1;
        const hiredCount = candidates.filter(x => x.requisitionId === c.requisitionId && x.stage === 'HIRED').length;
        if (r?.filled || hiredCount >= quantity) {
            toast.error(t('position_already_filled', {
                defaultValue: `This position has already been filled (${hiredCount}/${quantity}). Increase the requisition quantity or remove the existing hire before enrolling another candidate.`
            }));
            return;
        }
        const p = new URLSearchParams();
        if (r?.departmentId) p.set('departmentId', r.departmentId);
        if (r?.unitId) p.set('unitId', r.unitId);
        if (r?.jobDescriptionId) p.set('jobDescriptionId', r.jobDescriptionId);
        if (c.fullName) p.set('fullName', c.fullName);
        // NOTE: the candidate's email is intentionally NOT passed — onboarding creates a fresh
        // employee login account rather than reusing the address captured on the hiring list.
        // Position name comes from the requisition / its Job Description (the PRF position),
        // so HR doesn't retype it.
        const position = r?.jobDescription?.title || r?.jobTitle;
        if (position) p.set('position', position);
        // Carry the offer details captured on the hiring list so onboarding pre-fills (and locks) them.
        if (c.jobGrade) p.set('jobGrade', c.jobGrade);
        if (c.salaryStructure) p.set('salaryStructure', c.salaryStructure);
        if (c.residentStatus) p.set('residentStatus', c.residentStatus);
        if (c.placeOfWork) p.set('placeOfWork', c.placeOfWork);
        if (c.contractMonths) p.set('contractMonths', String(c.contractMonths));
        p.set('candidateId', c.id);
        navigate(`/employees/new?${p.toString()}`);
    };

    // Generate (or re-fetch) the private onboarding link and copy it for the hire.
    const copyOnboardingLink = async (c: Candidate) => {
        try {
            const { token } = await candidateService.generateOnboardingLink(c.id);
            const link = `${SERVER_URL}/careers/onboard.html?token=${token}`;
            try {
                await navigator.clipboard.writeText(link);
                toast.success(t('onboarding_link_copied', { defaultValue: 'Onboarding link copied — send it to the new hire.' }));
            } catch {
                setGeneratedLink(link);
                setLinkModalOpen(true);
            }
            fetchData();
        } catch (e: any) {
            toast.error(e?.response?.data?.error || t('onboarding_link_failed', { defaultValue: 'Failed to generate the onboarding link.' }));
        }
    };

    // ---- view-specific candidate sets ----
    // The Hiring List keeps showing a candidate after the head accepts them (they advance to
    // INTERVIEW and beyond) — only the displayed state changes, the candidate is not removed.
    const hiringListCands = candidates;
    const interviewCands = candidates.filter(c => c.stage === 'INTERVIEW');
    // Job Offer step: accepted candidates awaiting HR's offer, plus any who declined.
    const offerCands = candidates.filter(c => (c.stage === 'OFFER' && c.offerDecision !== 'ACCEPTED') || c.stage === 'WITHDRAWN');
    // Onboarding: only once the offer is accepted (ready to enroll) or already hired.
    const onboardingCands = candidates.filter(c => (c.stage === 'OFFER' && c.offerDecision === 'ACCEPTED') || c.stage === 'HIRED');

    const header = {
        screening: { title: t('nav_applicant_list', { defaultValue: 'Applicant List' }), sub: t('hiring_list_sub2', { defaultValue: 'Add candidates against an approved requisition; the requesting head accepts or rejects them.' }) },
        interview: { title: t('nav_interviews', { defaultValue: 'Interviews' }), sub: t('interviews_sub', { defaultValue: 'Schedule interviews, capture HR and technical evaluations, then decide.' }) },
        offer: { title: t('nav_job_offers', { defaultValue: 'Job Offers' }), sub: t('job_offers_sub', { defaultValue: 'Accepted candidates awaiting their job offer. HR issues the offer and records the response; once accepted they move to Onboarding.' }) },
        onboarding: { title: t('nav_onboarding', { defaultValue: 'Onboarding' }), sub: t('onboarding_sub', { defaultValue: 'Candidates who accepted their offer, ready to enroll as employees.' }) },
    }[view];

    if (loading) return <div className="p-12 text-center animate-pulse text-slate-400">{t('loading', { defaultValue: 'Loading…' })}</div>;

    const badge = (text: string, cls: string) => (
        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cls}`}>{text}</span>
    );

    // Current-stage badge used in the Hiring List so an accepted candidate stays visible with a
    // clear state instead of disappearing.
    const stageBadge = (c: Candidate) => {
        switch (c.stage) {
            case 'INTERVIEW': return badge(t('stage_interview', { defaultValue: 'In Interview' }), 'bg-blue-50 text-blue-600 border-blue-100');
            case 'OFFER': return badge(t('stage_offer', { defaultValue: 'Job Offer' }), 'bg-indigo-50 text-indigo-600 border-indigo-100');
            case 'HIRED': return badge(t('stage_hired', { defaultValue: 'Hired' }), 'bg-emerald-50 text-emerald-600 border-emerald-100');
            case 'REJECTED': return badge(t('stage_rejected', { defaultValue: 'Rejected' }), 'bg-rose-50 text-rose-600 border-rose-100');
            case 'WITHDRAWN': return badge(t('stage_declined', { defaultValue: 'Declined' }), 'bg-rose-50 text-rose-600 border-rose-100');
            default: return badge(t('stage_screening', { defaultValue: 'Awaiting Review' }), 'bg-amber-50 text-amber-600 border-amber-100');
        }
    };

    const docUrl = (p?: string) => p ? `${SERVER_URL}${p}` : null;
    const contactRow = (c: Candidate) => (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
            {c.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
            {c.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
            {cvUrl(c) && <a href={cvUrl(c)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline"><Paperclip className="w-3 h-3" />{t('view_cv', { defaultValue: 'CV' })}</a>}
            {docUrl(c.degreePath) && <a href={docUrl(c.degreePath)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline"><Paperclip className="w-3 h-3" />{t('view_degree', { defaultValue: 'Degree' })}</a>}
            {docUrl(c.portfolioPath) && <a href={docUrl(c.portfolioPath)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline"><Paperclip className="w-3 h-3" />{t('view_portfolio', { defaultValue: 'Portfolio' })}</a>}
        </div>
    );

    // Compact profile line (speciality · experience · nationality · salary · DOB · place · source)
    const profileMeta = (c: Candidate) => {
        const bits = [
            c.speciality,
            c.yearsExperience ? `${c.yearsExperience} ${t('yrs', { defaultValue: 'yrs exp' })}` : null,
            c.nationality,
            c.salaryExpectation,
            c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString() : null,
            c.placeOfLiving,
            c.source ? `${t('via', { defaultValue: 'via' })} ${c.source}` : null,
        ].filter(Boolean);
        if (!bits.length) return null;
        return <p className="text-[11px] text-slate-500 font-medium mt-1">{bits.join(' · ')}</p>;
    };

    // Full candidate dossier — every captured field + documents, so the reviewing head has
    // everything they need to accept or reject.
    const candidateDetails = (c: Candidate) => {
        const rows: [string, React.ReactNode][] = [
            [t('email', { defaultValue: 'Email' }), c.email],
            [t('phone_prefix', { defaultValue: 'Telephone' }), c.phone],
            [t('speciality', { defaultValue: 'Speciality' }), c.speciality],
            [t('years_experience', { defaultValue: 'Years of experience' }), c.yearsExperience],
            [t('nationality', { defaultValue: 'Nationality' }), c.nationality],
            [t('salary_expectation', { defaultValue: 'Salary expectation' }), c.salaryExpectation],
            [t('date_of_birth', { defaultValue: 'Date of birth' }), c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString() : null],
            [t('place_of_living', { defaultValue: 'Place of living' }), c.placeOfLiving],
            [t('source', { defaultValue: 'Source' }), c.source],
            [t('salary_structure', { defaultValue: 'Salary structure' }), c.salaryStructure],
            [t('experience_level', { defaultValue: 'Experience level' }), c.jobGrade],
            [t('place_of_work', { defaultValue: 'Place of work' }), c.placeOfWork],
            [t('contract_length', { defaultValue: 'Contract length' }), c.contractMonths ? `${c.contractMonths} ${t('months', { defaultValue: 'Months' })}` : null],
        ];
        const docs = [
            cvUrl(c) ? [t('view_cv', { defaultValue: 'CV' }), cvUrl(c)!] as const : null,
            docUrl(c.degreePath) ? [t('view_degree', { defaultValue: 'Degree' }), docUrl(c.degreePath)!] as const : null,
            docUrl(c.portfolioPath) ? [t('view_portfolio', { defaultValue: 'Portfolio' }), docUrl(c.portfolioPath)!] as const : null,
        ].filter(Boolean) as (readonly [string, string])[];
        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {rows.filter(([, v]) => v).map(([label, v]) => (
                        <div key={label}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                            <p className="text-xs font-bold text-slate-700 break-words">{v}</p>
                        </div>
                    ))}
                </div>
                {docs.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {docs.map(([label, url]) => (
                            <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 border border-indigo-100 transition-colors">
                                <Paperclip className="w-3.5 h-3.5" />{label}
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-[10px] text-slate-400 font-bold italic">{t('no_documents', { defaultValue: 'No documents uploaded.' })}</p>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-outfit font-black text-slate-800 tracking-tight">{header.title}</h1>
                    <p className="text-slate-500 font-medium mt-1">{header.sub}</p>
                </div>
                {view === 'screening' && isHR && (
                    <button onClick={() => openAdd()} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95">
                        <Plus className="w-5 h-5" /> {t('add_candidate', { defaultValue: 'Add Candidate' })}
                    </button>
                )}
            </div>

            {/* ===================== SEARCH BAR ===================== */}
            {view === 'screening' && (
                <div className="relative mb-6">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('search_applicants', { defaultValue: 'Search by candidate name, job title, or department...' })}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:font-medium"
                    />
                </div>
            )}

            {/* ===================== SCREENING (Applicant List) ===================== */}
            {view === 'screening' && (
                <div className="space-y-6">
                    {((isHR || isMgmt) ? openReqs : openReqs.filter(r => r.requesterId === currentUser?.id || r.requester?.id === currentUser?.id))
                        .filter(r => {
                            const q = searchTerm.toLowerCase();
                            const rMatch = (r.jobTitle || '').toLowerCase().includes(q) || (r.department?.name || '').toLowerCase().includes(q) || (r.division?.name || '').toLowerCase().includes(q);
                            const cMatch = hiringListCands.filter(c => c.requisitionId === r.id).some(c => (c.fullName || '').toLowerCase().includes(q));
                            return rMatch || cMatch;
                        })
                        .filter(r => isHR || isMgmt || hiringListCands.some(c => c.requisitionId === r.id))
                        .map(req => {
                            const reqCands = hiringListCands.filter(c => c.requisitionId === req.id).filter(c => {
                                const q = searchTerm.toLowerCase();
                                const rMatch = (req.jobTitle || '').toLowerCase().includes(q) || (req.department?.name || '').toLowerCase().includes(q) || (req.division?.name || '').toLowerCase().includes(q);
                                return rMatch || (c.fullName || '').toLowerCase().includes(q);
                            });
                            if (reqCands.length === 0 && searchTerm) return null;
                            return (
                                <div key={req.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between gap-4 p-6 bg-slate-50/60 border-b border-slate-100">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Briefcase className="w-4 h-4 text-indigo-500" />
                                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight truncate">{req.jobTitle}</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
                                                <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{req.department?.name || req.division?.name || '—'}{req.unit ? ` / ${req.unit.name}` : ''}</span>
                                                <span>{t('requested_by', { defaultValue: 'Requested by' })} {req.requester?.fullName}</span>
                                                {req.jobDescription && <span>{(req.jobDescription._count?.employees ?? 0)}/{req.jobDescription.plannedCount} {t('filled_lc', { defaultValue: 'filled' })}</span>}
                                                <span className="text-indigo-500">{t('hiring_n', { defaultValue: 'hiring' })} {req.hiredCount ?? 0}/{req.quantity ?? 1}</span>
                                            </div>
                                        </div>
                                        {isHR && !req.filled && (
                                            <button onClick={() => openAdd(req.id)} className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition-all">
                                                <Plus className="w-3.5 h-3.5" /> {t('add', { defaultValue: 'Add' })}
                                            </button>
                                        )}
                                        {req.filled && (
                                            <span className="shrink-0 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest border border-rose-100">
                                                {t('closed', { defaultValue: 'Closed' })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-4 md:p-6">
                                        {reqCands.length === 0 ? (
                                            <p className="text-sm text-slate-400 font-medium italic py-4 text-center">{t('no_candidates_yet', { defaultValue: 'No candidates yet.' })}</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {reqCands.map(c => (
                                                    <div key={c.id} className="p-4 rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-all space-y-3">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="font-black text-slate-800 truncate">{c.fullName}</p>
                                                                {contactRow(c)}
                                                                {profileMeta(c)}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {c.stage !== 'SCREENING' && stageBadge(c)}
                                                                {isHR && (
                                                                    <button onClick={() => handleDelete(c)} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {c.stage === 'SCREENING' && isRequester(c) && (
                                                                <button onClick={() => openAction(c, 'screen')} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all">{t('review', { defaultValue: 'Review' })}</button>
                                                            )}
                                                            <button onClick={() => openAction(c, 'details')} className="flex-1 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all inline-flex items-center justify-center gap-1.5"><FileText className="w-3.5 h-3.5" />{t('details', { defaultValue: 'Details' })}</button>
                                                        </div>
                                                        {c.stage === 'SCREENING' && !isRequester(c) && (
                                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{t('awaiting_head', { defaultValue: 'Awaiting head review' })}</p>
                                                        )}
                                                        {c.stage !== 'SCREENING' && (
                                                            <p className={`text-[10px] font-black uppercase tracking-widest ${c.stage === 'REJECTED' || c.stage === 'WITHDRAWN' ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                                {c.stage === 'REJECTED' || c.stage === 'WITHDRAWN'
                                                                    ? t('no_longer_in_process', { defaultValue: 'No longer in process' })
                                                                    : t('accepted_advanced', { defaultValue: 'Accepted — advanced in the pipeline' })}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    {((isHR || isMgmt) ? openReqs : openReqs.filter(r => r.requesterId === currentUser?.id || r.requester?.id === currentUser?.id)).filter(r => isHR || isMgmt || hiringListCands.some(c => c.requisitionId === r.id)).length === 0 && (
                        <EmptyState icon={UserPlus} text={isHR ? t('no_open_reqs_add', { defaultValue: 'No approved requisitions to source candidates for.' }) : t('no_cands_for_you', { defaultValue: 'No candidates awaiting your review.' })} />
                    )}
                </div>
            )}

            {/* ===================== INTERVIEW ===================== */}
            {view === 'interview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {interviewCands.map(c => {
                        const scheduled = !!c.interviewAt;
                        const hrDone = !!c.hrEvalById;
                        const techDone = !!c.techEvalById;
                        const canFinalize = hrDone && techDone && isRequester(c);
                        return (
                            <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.requisition?.jobTitle}</p>
                                        <h3 className="text-lg font-black text-slate-800 truncate">{c.fullName}</h3>
                                        {contactRow(c)}
                                        {profileMeta(c)}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {scheduled ? badge(t('scheduled', { defaultValue: 'Scheduled' }), 'bg-blue-50 text-blue-600 border-blue-100') : badge(t('pending_interview', { defaultValue: 'Pending Interview' }), 'bg-amber-50 text-amber-600 border-amber-100')}
                                        {isHR && (
                                            <button onClick={() => handleDelete(c)} title={t('remove_candidate', { defaultValue: 'Remove candidate' })} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                </div>

                                {scheduled && (
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 rounded-xl p-3">
                                        <CalendarDays className="w-4 h-4 text-indigo-500" />
                                        {fmtDateTime(c.interviewAt)}{c.interviewLocation ? ` · ${c.interviewLocation}` : ''}
                                    </div>
                                )}

                                {/* Evaluations */}
                                {scheduled && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <EvalTile label={t('hr_eval', { defaultValue: 'HR Evaluation' })} done={hrDone} score={c.hrScore} recommend={c.hrRecommend} by={c.hrEvalBy?.fullName}
                                            canDo={isHR} onDo={() => openAction(c, 'hrEval')} />
                                        <EvalTile label={t('tech_eval', { defaultValue: 'Technical Evaluation' })} done={techDone} score={c.techScore} recommend={c.techRecommend} by={c.techEvalBy?.fullName}
                                            canDo={isRequester(c)} onDo={() => openAction(c, 'techEval')} />
                                    </div>
                                )}

                                {/* Once both evaluations are in, the Evaluation Form can be generated here.
                                    The Job Offer is generated later, at the Job Offers stage — not in interviews. */}
                                {hrDone && techDone && (isHR || isRequester(c)) && (
                                    <div className="grid gap-2 grid-cols-1">
                                        <button
                                            onClick={() => generateEvaluation(c)}
                                            disabled={evalBusy === c.id}
                                            className="py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-slate-400 hover:bg-slate-50 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {evalBusy === c.id ? t('generating', { defaultValue: 'Generating…' }) : t('generate_evaluation', { defaultValue: 'Evaluation Form' })}
                                        </button>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-1">
                                    {!scheduled && isHR && (
                                        <button onClick={() => openAction(c, 'schedule')} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all">{t('schedule_interview', { defaultValue: 'Schedule Interview' })}</button>
                                    )}
                                    {scheduled && isHR && (
                                        <button onClick={() => openAction(c, 'schedule')} className="px-4 py-2.5 bg-slate-50 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">{t('reschedule', { defaultValue: 'Reschedule' })}</button>
                                    )}
                                    {canFinalize && (
                                        <button onClick={() => openAction(c, 'finalize')} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">{t('finalize_decision', { defaultValue: 'Finalize Decision' })}</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {interviewCands.length === 0 && <div className="lg:col-span-2"><EmptyState icon={CalendarDays} text={t('no_interview_cands', { defaultValue: 'No candidates in the interview stage.' })} /></div>}
                </div>
            )}

            {/* ===================== JOB OFFERS ===================== */}
            {view === 'offer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {offerCands.map(c => (
                        <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.requisition?.jobTitle}</p>
                                    <h3 className="text-lg font-black text-slate-800 truncate">{c.fullName}</h3>
                                    {contactRow(c)}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {c.stage === 'WITHDRAWN'
                                        ? badge(t('declined', { defaultValue: 'Declined' }), 'bg-rose-50 text-rose-600 border-rose-100')
                                        : badge(t('offer_pending', { defaultValue: 'Offer Pending' }), 'bg-amber-50 text-amber-600 border-amber-100')}
                                    {isHR && (
                                        <button onClick={() => handleDelete(c)} title={t('remove_candidate', { defaultValue: 'Remove candidate' })} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>

                            {c.stage === 'WITHDRAWN' ? (
                                <p className="text-xs font-medium text-slate-500 italic">{t('candidate_declined_offer', { defaultValue: 'The candidate declined the offer.' })}</p>
                            ) : isHR ? (
                                <div className="flex flex-col gap-2 pt-1">
                                    <button onClick={() => openAction(c, 'editOffer')}
                                        className="w-full py-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all inline-flex items-center justify-center gap-2">
                                        {t('edit_offer_details', { defaultValue: 'Edit Offer Details' })}
                                    </button>
                                    <button onClick={() => generateOffer(c)} disabled={offerBusy === c.id}
                                        className="w-full py-2.5 bg-white border-2 border-indigo-200 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-400 hover:bg-indigo-50 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60">
                                        <FileText className="w-4 h-4" />
                                        {offerBusy === c.id ? t('generating', { defaultValue: 'Generating…' }) : t('generate_job_offer', { defaultValue: 'Generate Job Offer' })}
                                    </button>
                                    <button onClick={() => openAction(c, 'offer')}
                                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all">
                                        {t('record_offer', { defaultValue: 'Record Offer Response' })}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{t('awaiting_hr_offer', { defaultValue: 'Awaiting HR to issue the offer' })}</p>
                            )}
                        </div>
                    ))}
                    {offerCands.length === 0 && <div className="md:col-span-2 lg:col-span-3"><EmptyState icon={FileText} text={t('no_offer_cands', { defaultValue: 'No candidates awaiting a job offer.' })} /></div>}
                </div>
            )}

            {/* ===================== ONBOARDING ===================== */}
            {view === 'onboarding' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {onboardingCands.map(c => (
                        <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.requisition?.jobTitle}</p>
                                    <h3 className="text-lg font-black text-slate-800 truncate">{c.fullName}</h3>
                                    {contactRow(c)}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {c.stage === 'HIRED' ? badge(t('hired', { defaultValue: 'Hired' }), 'bg-emerald-50 text-emerald-600 border-emerald-100')
                                        : c.stage === 'WITHDRAWN' ? badge(t('declined', { defaultValue: 'Declined' }), 'bg-rose-50 text-rose-600 border-rose-100')
                                        : c.offerDecision === 'ACCEPTED' ? badge(t('offer_accepted_b', { defaultValue: 'Offer Accepted' }), 'bg-blue-50 text-blue-600 border-blue-100')
                                        : badge(t('offer_pending', { defaultValue: 'Offer Pending' }), 'bg-amber-50 text-amber-600 border-amber-100')}
                                    {isHR && (
                                        <button onClick={() => handleDelete(c)} title={t('remove_candidate', { defaultValue: 'Remove candidate' })} className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>

                            {c.stage === 'HIRED' && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{t('enrolled_as_employee', { defaultValue: 'Enrolled as employee' })}</span>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={() => viewOnboarding(c)}
                                            className="flex-1 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all inline-flex items-center justify-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5" />{t('see_details', { defaultValue: 'See Details' })}
                                        </button>
                                        {isHR && (
                                            <button onClick={() => generateHiringLetter(c)} disabled={letterBusy === c.id}
                                                className="flex-1 py-2.5 bg-white border-2 border-emerald-200 text-emerald-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:border-emerald-400 hover:bg-emerald-50 transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
                                                <FileText className="w-3.5 h-3.5" />{letterBusy === c.id ? t('generating', { defaultValue: 'Generating…' }) : t('hiring_letter', { defaultValue: 'Hiring Letter' })}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {c.stage === 'OFFER' && (
                                <div className="flex flex-col gap-2 pt-1">
                                    {/* Onboarding status badge */}
                                    {c.onboardingStatus === 'SUBMITTED' ? (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">{t('onboarding_submitted', { defaultValue: 'Onboarding submitted' })}</span>
                                        </div>
                                    ) : c.onboardingStatus === 'PENDING' ? (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                                            <ArrowRight className="w-4 h-4 text-amber-600" />
                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">{t('onboarding_link_sent', { defaultValue: 'Link sent — awaiting the hire' })}</span>
                                        </div>
                                    ) : null}

                                    {isHR ? (
                                        <>
                                            <button onClick={() => copyOnboardingLink(c)} className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all inline-flex items-center justify-center gap-2">
                                                {c.onboardingToken ? t('copy_onboarding_link', { defaultValue: 'Copy Onboarding Link' }) : t('generate_onboarding_link', { defaultValue: 'Generate Onboarding Link' })}
                                            </button>
                                            <button onClick={() => enroll(c)} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all inline-flex items-center justify-center gap-2">
                                                {c.onboardingStatus === 'SUBMITTED' ? t('review_and_enroll', { defaultValue: 'Review & Enroll' }) : t('enroll_employee', { defaultValue: 'Enroll Employee' })} <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t('awaiting_enrollment', { defaultValue: 'Awaiting enrollment by HR' })}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {onboardingCands.length === 0 && <div className="md:col-span-2 lg:col-span-3"><EmptyState icon={CheckCircle2} text={t('no_onboarding_cands', { defaultValue: 'No candidates at the onboarding stage.' })} /></div>}
                </div>
            )}

            {/* ===================== Add Candidate Modal ===================== */}
            {addOpen && (
            <div className="fixed inset-0 z-40 bg-slate-50 overflow-y-auto animate-in fade-in duration-200">
                <div className="max-w-5xl mx-auto p-4 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <button type="button" onClick={() => setAddOpen(false)} className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
                        <div>
                            <h1 className="text-3xl font-outfit font-black text-slate-800 tracking-tight">{t('add_candidate', { defaultValue: 'Add Candidate' })}</h1>
                            <p className="text-slate-500 font-medium text-sm">{t('add_candidate_sub', { defaultValue: 'Register a candidate against an approved requisition.' })}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-8">
                <form onSubmit={submitAdd} className="space-y-4 py-2">
                    {/* Application for position/department */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('application_for', { defaultValue: 'Application for position / department' })}</label>
                        <select value={addForm.requisitionId} onChange={e => setAdd({ requisitionId: e.target.value })} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-700">
                            <option value="">{t('select_requisition', { defaultValue: '-- Select Requisition --' })}</option>
                            {openReqs.map(r => <option key={r.id} value={r.id}>{r.jobTitle} — {r.department?.name || r.division?.name || ''}{r.unit ? ` / ${r.unit.name}` : ''}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('candidate_name', { defaultValue: 'Candidate Name' })}</label>
                            <input value={addForm.fullName} onChange={e => setAdd({ fullName: e.target.value })} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder={t('ph_jane_doe', { defaultValue: 'Jane Doe' })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('source', { defaultValue: 'Source' })}</label>
                            <input value={addForm.source} onChange={e => setAdd({ source: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder={t('source_ph', { defaultValue: 'Referral / LinkedIn / Agency…' })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('email', { defaultValue: 'Email address' })}</label>
                            <input type="email" value={addForm.email} onChange={e => setAdd({ email: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder={t('ph_email_example', { defaultValue: 'jane@example.com' })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('phone_prefix', { defaultValue: 'Telephone (with prefix)' })}</label>
                            <input value={addForm.phone} onChange={e => setAdd({ phone: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder="+218 …" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('speciality', { defaultValue: 'Graduation certificate / speciality' })}</label>
                            <input value={addForm.speciality} onChange={e => setAdd({ speciality: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder={t('speciality_ph', { defaultValue: 'e.g. BSc Computer Science' })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('years_experience', { defaultValue: 'Years of relevant experience' })}</label>
                            <input value={addForm.yearsExperience} onChange={e => setAdd({ yearsExperience: e.target.value, jobGrade: addForm.jobGrade || deriveGrade(e.target.value) })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder="e.g. 3" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('salary_expectation', { defaultValue: 'Salary expectations' })}</label>
                            <input value={addForm.salaryExpectation} onChange={e => setAdd({ salaryExpectation: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder="e.g. 2500 USD" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('nationality', { defaultValue: 'Nationality' })}</label>
                            <input value={addForm.nationality} onChange={e => setAdd({ nationality: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder={t('ph_libyan', { defaultValue: 'Libyan' })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('date_of_birth', { defaultValue: 'Date of birth' })}</label>
                            <input type="date" value={addForm.dateOfBirth} onChange={e => setAdd({ dateOfBirth: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('place_of_living', { defaultValue: 'Place of living' })}</label>
                            <input value={addForm.placeOfLiving} onChange={e => setAdd({ placeOfLiving: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder={t('ph_tripoli', { defaultValue: 'Tripoli' })} />
                        </div>
                    </div>

                    {/* Job Offer Details — captured up front so the offer can be generated in one click after interviews */}
                    <div className="pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">{t('offer_details', { defaultValue: 'Job Offer Details' })}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('resident_status', { defaultValue: 'Resident / Non-Resident' })}</label>
                                <select value={addForm.residentStatus} onChange={e => {
                                    const rs = e.target.value;
                                    const allowed = allowedSalaryStructures(rs);
                                    // Keep the structure only if it's still valid for the new residency;
                                    // residents default straight to the single local structure.
                                    const nextSS = rs === 'RESDANT' ? 'SS-01-LYD' : (allowed.includes(addForm.salaryStructure) ? addForm.salaryStructure : '');
                                    setAdd({ residentStatus: rs, salaryStructure: nextSS });
                                }} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700">
                                    <option value="">{t('select_resident', { defaultValue: '-- Select Residency --' })}</option>
                                    <option value="RESDANT">{t('rs_resident', { defaultValue: 'Resident' })}</option>
                                    <option value="DIRCT NONE RESDANT">{t('rs_direct_non_resident', { defaultValue: 'Direct Non-Resident' })}</option>
                                    <option value="NONE RESDANT">{t('rs_non_resident', { defaultValue: 'Non-Resident' })}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('salary_structure', { defaultValue: 'Salary Structure' })}</label>
                                <select value={addForm.salaryStructure} onChange={e => setAdd({ salaryStructure: e.target.value })} disabled={!addForm.residentStatus} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400">
                                    <option value="">{addForm.residentStatus ? t('select_structure', { defaultValue: '-- Select Structure --' }) : t('select_residency_first', { defaultValue: '-- Select residency first --' })}</option>
                                    {allowedSalaryStructures(addForm.residentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('experience_level', { defaultValue: 'Experience Level' })}</label>
                                <select value={addForm.jobGrade} onChange={e => setAdd({ jobGrade: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700">
                                    <option value="">{t('select_experience', { defaultValue: '-- Select Experience --' })}</option>
                                    {EXPERIENCE_LEVELS.map(l => <option key={l.grade} value={l.grade}>{l.label}</option>)}
                                </select>
                            </div>
                            {(() => {
                                const locs = openReqs.find(r => r.id === addForm.requisitionId)?.jobDescription?.workLocations || [];
                                if (locs.length === 0) return null;
                                return (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('place_of_work', { defaultValue: 'Place of Work' })}</label>
                                        {locs.length > 1 ? (
                                            <select value={addForm.placeOfWork} onChange={e => setAdd({ placeOfWork: e.target.value })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700">
                                                <option value="">{t('select_place', { defaultValue: '-- Select Place of Work --' })}</option>
                                                {locs.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        ) : (
                                            <div className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-600">{locs[0]}</div>
                                        )}
                                    </div>
                                );
                            })()}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('contract_length', { defaultValue: 'Contract Length' })}</label>
                                <select value={addForm.contractMonths} onChange={e => setAdd({ contractMonths: Number(e.target.value) })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-medium text-slate-700">
                                    <option value={6}>6 {t('months', { defaultValue: 'Months' })}</option>
                                    <option value={3}>3 {t('months', { defaultValue: 'Months' })}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Documents */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('upload_cv', { defaultValue: 'Upload CV' })}</label>
                            <input type="file" accept=".pdf,.doc,.docx" onChange={e => setAdd({ cv: e.target.files?.[0] || null })} className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('upload_degree', { defaultValue: 'Upload Degree' })}</label>
                            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setAdd({ degree: e.target.files?.[0] || null })} className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('upload_portfolio', { defaultValue: 'Portfolio (designers)' })}</label>
                            <input type="file" accept=".pdf,.zip,image/*" onChange={e => setAdd({ portfolio: e.target.files?.[0] || null })} className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-bold" />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setAddOpen(false)} className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-100">{t('cancel', { defaultValue: 'Cancel' })}</button>
                        <button type="submit" disabled={submitting} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60">{t('add_candidate', { defaultValue: 'Add Candidate' })}</button>
                    </div>
                </form>
                    </div>
                </div>
            </div>
            )}

            {/* ===================== Generic Action Modal ===================== */}
            <Modal isOpen={!!actCand} onClose={closeAction} title={actCand?.fullName || ''} maxWidth="max-w-lg" fullScreen={actType === 'details'} fullScreenWidth="max-w-none">
                {actCand && (
                    <div className="space-y-5 py-2">
                        {actType !== 'details' && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{actCand.requisition?.jobTitle}</p>
                                {actType !== 'screen' && contactRow(actCand)}
                                {actType !== 'screen' && profileMeta(actCand)}
                            </div>
                        )}

                        {/* Screen accept/reject — show the full candidate dossier + documents so the head can decide */}
                        {actType === 'screen' && (
                            <>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                    {candidateDetails(actCand)}
                                </div>
                                <p className="text-sm font-medium text-slate-600">{t('screen_prompt', { defaultValue: 'Accept this candidate to move them into interviews, or reject to close them out.' })}</p>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('note_optional', { defaultValue: 'Note (optional)' })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 min-h-[70px]" />
                                <div className="flex gap-3">
                                    <button onClick={() => runScreen('REJECTED')} className="flex-1 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 inline-flex items-center justify-center gap-2"><XCircle className="w-4 h-4" />{t('reject', { defaultValue: 'Reject' })}</button>
                                    <button onClick={() => runScreen('ACCEPTED')} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 inline-flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" />{t('accept', { defaultValue: 'Accept' })}</button>
                                </div>
                            </>
                        )}

                        {/* Details — full dossier plus the recruitment timeline (offer-generated & evaluation dates) */}
                        {actType === 'details' && (() => {
                            const c = actCand;
                            const initials = (c.fullName || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                            const chip = (icon: React.ReactNode, text: React.ReactNode, key: string) => (
                                <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 text-[11px] font-bold text-slate-600">{icon}{text}</span>
                            );
                            const fields: [string, React.ReactNode][] = [
                                [t('speciality', { defaultValue: 'Speciality' }), c.speciality],
                                [t('years_experience', { defaultValue: 'Years of experience' }), c.yearsExperience],
                                [t('experience_level', { defaultValue: 'Experience Level' }), c.jobGrade],
                                [t('nationality', { defaultValue: 'Nationality' }), c.nationality],
                                [t('salary_expectation', { defaultValue: 'Salary expectation' }), c.salaryExpectation],
                                [t('salary_structure', { defaultValue: 'Salary Structure' }), c.salaryStructure],
                                [t('resident_status', { defaultValue: 'Residency' }), c.residentStatus],
                                [t('place_of_work', { defaultValue: 'Place of Work' }), c.placeOfWork],
                                [t('contract_length', { defaultValue: 'Contract Length' }), c.contractMonths ? `${c.contractMonths} ${t('months', { defaultValue: 'Months' })}` : null],
                                [t('date_of_birth', { defaultValue: 'Date of birth' }), c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString() : null],
                                [t('place_of_living', { defaultValue: 'Place of living' }), c.placeOfLiving],
                                [t('source', { defaultValue: 'Source' }), c.source],
                            ];
                            const docs = [
                                cvUrl(c) ? [t('view_cv', { defaultValue: 'CV' }), cvUrl(c)!] as const : null,
                                docUrl(c.degreePath) ? [t('view_degree', { defaultValue: 'Degree' }), docUrl(c.degreePath)!] as const : null,
                                docUrl(c.portfolioPath) ? [t('view_portfolio', { defaultValue: 'Portfolio' }), docUrl(c.portfolioPath)!] as const : null,
                            ].filter(Boolean) as (readonly [string, string])[];
                            const timeline: [string, string | undefined][] = [
                                [t('tl_added', { defaultValue: 'Added to applicant list' }), c.createdAt],
                                [t('tl_screened', { defaultValue: 'Screened by head' }), c.screenAt],
                                [t('tl_interview', { defaultValue: 'Interview scheduled' }), c.interviewAt],
                                [t('tl_hr_eval', { defaultValue: 'HR evaluation' }), c.hrEvalAt],
                                [t('tl_tech_eval', { defaultValue: 'Technical evaluation' }), c.techEvalAt],
                                [t('tl_offer_generated', { defaultValue: 'Job offer generated' }), c.offerGeneratedAt],
                                [t('tl_offer_response', { defaultValue: 'Offer response' }), c.offerAt],
                            ];
                            return (
                                <div className="space-y-5">
                                    {/* Header */}
                                    <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-200/60 shrink-0">{initials}</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-xl font-black text-slate-800 truncate">{c.fullName}</h3>
                                                    {stageBadge(c)}
                                                </div>
                                                <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest mt-1">{c.requisition?.jobTitle}</p>
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {c.email && chip(<Mail className="w-3 h-3 text-slate-400" />, c.email, 'email')}
                                                    {c.phone && chip(<Phone className="w-3 h-3 text-slate-400" />, c.phone, 'phone')}
                                                    {docs.map(([label, url]) => (
                                                        <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-black hover:bg-indigo-700 transition-colors">
                                                            <Paperclip className="w-3 h-3" />{label}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Candidate information */}
                                    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('candidate_information', { defaultValue: 'Candidate Information' })}</p>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                                            {fields.map(([label, value]) => (
                                                <div key={label} className="min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                                                    <p className={`text-sm font-bold break-words mt-0.5 ${value ? 'text-slate-700' : 'text-slate-300'}`}>{value || '—'}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {docs.length === 0 && <p className="text-[10px] text-slate-400 font-bold italic mt-5">{t('no_documents', { defaultValue: 'No documents uploaded.' })}</p>}
                                    </div>

                                    {/* Recruitment timeline */}
                                    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4">{t('recruitment_timeline', { defaultValue: 'Recruitment Timeline' })}</p>
                                        <div>
                                            {Array.isArray(c.events) && c.events.length > 0 ? (
                                                c.events.map((evt: any, i: number) => {
                                                    const last = i === (c.events || []).length - 1;
                                                    const label = t(`event_${evt.action.toLowerCase()}`, { defaultValue: evt.action.replace(/_/g, ' ') });
                                                    return (
                                                        <div key={i} className="flex gap-4">
                                                            <div className="flex flex-col items-center">
                                                                <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0 bg-indigo-600 border-indigo-600" />
                                                                {!last && <div className="w-0.5 flex-1 min-h-[1.75rem] bg-indigo-200" />}
                                                            </div>
                                                            <div className={`pb-5 -mt-1 flex-1 flex flex-col justify-center gap-1 ${last ? 'pb-0' : ''}`}>
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="text-sm font-bold text-slate-700 capitalize">{label.toLowerCase()}</span>
                                                                    <span className="text-xs font-black whitespace-nowrap text-slate-500">{fmtDateTime(evt.timestamp)}</span>
                                                                </div>
                                                                <div className="text-[11px] font-medium text-slate-400">
                                                                    {t('by', { defaultValue: 'By' })} {evt.performedBy || t('unknown_user', { defaultValue: 'Unknown User' })}
                                                                    {evt.note && <span className="italic ml-2">- {evt.note}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                timeline.map(([label, iso], i) => {
                                                    const done = !!iso;
                                                    const last = i === timeline.length - 1;
                                                    return (
                                                        <div key={label} className="flex gap-4">
                                                            <div className="flex flex-col items-center">
                                                                <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${done ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`} />
                                                                {!last && <div className={`w-0.5 flex-1 min-h-[1.75rem] ${done ? 'bg-indigo-200' : 'bg-slate-100'}`} />}
                                                            </div>
                                                            <div className={`pb-5 -mt-1 flex-1 flex items-center justify-between gap-3 ${last ? 'pb-0' : ''}`}>
                                                                <span className={`text-sm font-bold ${done ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
                                                                <span className={`text-xs font-black whitespace-nowrap ${done ? 'text-slate-500' : 'text-slate-300'}`}>{iso ? fmtDateTime(iso) : t('pending', { defaultValue: 'Pending' })}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Schedule interview */}
                        {actType === 'schedule' && (
                            <form onSubmit={runSchedule} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('interview_datetime', { defaultValue: 'Interview Date & Time' })}</label>
                                    <input type="datetime-local" required value={schedAt} onChange={e => setSchedAt(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('location', { defaultValue: 'Location' })}</label>
                                    <input value={schedLoc} onChange={e => setSchedLoc(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700" placeholder={t('location_ph', { defaultValue: 'Office / Meeting link' })} />
                                </div>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('note_optional', { defaultValue: 'Note (optional)' })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 min-h-[60px]" />
                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700">{t('save', { defaultValue: 'Save' })}</button>
                            </form>
                        )}

                        {/* HR / Tech evaluation */}
                        {(actType === 'hrEval' || actType === 'techEval') && (
                            <form onSubmit={runEval} className="space-y-4">
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{actType === 'hrEval' ? t('hr_eval', { defaultValue: 'HR Evaluation' }) : t('tech_eval', { defaultValue: 'Technical Evaluation' })}</p>
                                <div className="space-y-2.5">
                                    {(actType === 'hrEval' ? HR_CRITERIA : TECH_CRITERIA).map(crit => (
                                        <div key={crit.key} className="flex items-center justify-between gap-3">
                                            <span className="text-xs font-bold text-slate-600">{crit.label}</span>
                                            <div className="flex gap-0.5 shrink-0">
                                                {[1, 2, 3, 4, 5].map(n => (
                                                    <button type="button" key={n} onClick={() => setCriteria(prev => ({ ...prev, [crit.key]: n }))} className="p-0.5">
                                                        <Star className={`w-5 h-5 ${(criteria[crit.key] || 0) >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-[9px] font-bold text-slate-400 pt-1">{t('eval_scale', { defaultValue: '1 = Poor · 2 = Fair · 3 = Good · 4 = Very Good · 5 = Excellent' })}</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('recommendation', { defaultValue: 'Recommendation' })}</label>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setRecommend(true)} className={`flex-1 py-2.5 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest inline-flex items-center justify-center gap-2 ${recommend ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}><ThumbsUp className="w-4 h-4" />{t('recommend', { defaultValue: 'Recommend' })}</button>
                                        <button type="button" onClick={() => setRecommend(false)} className={`flex-1 py-2.5 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest inline-flex items-center justify-center gap-2 ${!recommend ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-400'}`}><ThumbsDown className="w-4 h-4" />{t('not_recommend', { defaultValue: 'Do Not Recommend' })}</button>
                                    </div>
                                </div>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('assessment_notes', { defaultValue: 'Assessment notes' })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 min-h-[80px]" />
                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700">{t('save_evaluation', { defaultValue: 'Save Evaluation' })}</button>
                            </form>
                        )}

                        {/* Finalize */}
                        {actType === 'finalize' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <SummaryTile label={t('hr_eval', { defaultValue: 'HR Evaluation' })} score={actCand.hrScore} recommend={actCand.hrRecommend} note={actCand.hrNote} />
                                    <SummaryTile label={t('tech_eval', { defaultValue: 'Technical Evaluation' })} score={actCand.techScore} recommend={actCand.techRecommend} note={actCand.techNote} />
                                </div>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('decision_note', { defaultValue: 'Decision note (optional)' })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 min-h-[60px]" />
                                <div className="flex gap-3">
                                    <button onClick={() => runFinalize('REJECTED')} className="flex-1 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100">{t('reject', { defaultValue: 'Reject' })}</button>
                                    <button onClick={() => runFinalize('ACCEPTED')} className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700">{t('accept_to_offer', { defaultValue: 'Accept → Onboarding' })}</button>
                                </div>
                            </>
                        )}

                        {/* Offer */}
                        {actType === 'offer' && (
                            <>
                                <p className="text-sm font-medium text-slate-600">{t('offer_prompt', { defaultValue: 'Record the candidate\'s response to the job offer.' })}</p>
                                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('note_optional', { defaultValue: 'Note (optional)' })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 min-h-[60px]" />
                                <div className="flex gap-3">
                                    <button onClick={() => runOffer('DECLINED')} className="flex-1 py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100">{t('declined_offer', { defaultValue: 'Declined' })}</button>
                                    <button onClick={() => runOffer('ACCEPTED')} className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700">{t('accepted_offer', { defaultValue: 'Accepted Offer' })}</button>
                                </div>
                            </>
                        )}

                        {/* Edit Offer Details */}
                        {actType === 'editOffer' && (
                            <form onSubmit={runEditOffer} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('resident_status', { defaultValue: 'Resident Status' })}</label>
                                    <select value={editOfferForm.residentStatus} onChange={e => setEditOfferForm({ ...editOfferForm, residentStatus: e.target.value })} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 bg-white">
                                        <option value="">{t('select', { defaultValue: 'Select...' })}</option>
                                        <option value="RESDANT">{t('resident', { defaultValue: 'RESDANT' })}</option>
                                        <option value="DIRCT NONE RESDANT">{t('dirct_non_resident', { defaultValue: 'DIRCT NONE RESDANT' })}</option>
                                        <option value="NONE RESDANT">{t('non_resident', { defaultValue: 'NONE RESDANT' })}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('job_category', { defaultValue: 'Job Category' })}</label>
                                    <select value={editOfferForm.jobCategory} onChange={e => setEditOfferForm({ ...editOfferForm, jobCategory: e.target.value, jobGrade: '', salaryStructure: '' })} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 bg-white">
                                        <option value="">{t('select', { defaultValue: 'Select...' })}</option>
                                        {(actCand?.requisition?.jobDescription?.jobCategories?.length ? actCand.requisition.jobDescription.jobCategories : Array.from(new Set(salaryStructures.map(s => s.jobCategory)))).map(cat => (
                                            <option key={cat as string} value={cat as string}>{cat as string}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('job_grade', { defaultValue: 'Job Grade' })}</label>
                                    <select value={editOfferForm.jobGrade} onChange={e => setEditOfferForm({ ...editOfferForm, jobGrade: e.target.value, salaryStructure: '' })} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 bg-white">
                                        <option value="">{t('select_experience', { defaultValue: '-- Select Experience --' })}</option>
                                        {EXPERIENCE_LEVELS.map(l => (
                                            <option key={l.grade} value={l.grade}>{l.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('salary_structure', { defaultValue: 'Salary Structure' })}</label>
                                    <select value={editOfferForm.salaryStructure} onChange={e => setEditOfferForm({ ...editOfferForm, salaryStructure: e.target.value })} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 bg-white" disabled={!editOfferForm.jobGrade}>
                                        <option value="">{t('select', { defaultValue: 'Select...' })}</option>
                                        {Array.from(new Set(salaryStructures.filter(s => s.jobCategory === editOfferForm.jobCategory && s.jobGrade === editOfferForm.jobGrade).map(s => s.structureLevel)))
                                            .filter(struct => editOfferForm.residentStatus === 'RESDANT' ? (struct as string).includes('SS-01') : true)
                                            .map(struct => (
                                                <option key={struct as string} value={struct as string}>{struct as string}</option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('place_of_work', { defaultValue: 'Place of Work' })}</label>
                                    <select value={editOfferForm.placeOfWork} onChange={e => setEditOfferForm({ ...editOfferForm, placeOfWork: e.target.value })} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 bg-white">
                                        <option value="">{t('select', { defaultValue: 'Select...' })}</option>
                                        {(actCand?.requisition?.jobDescription?.workLocations?.length ? actCand.requisition.jobDescription.workLocations : ['OFFICE', 'SITE']).map(loc => (
                                            <option key={loc as string} value={loc as string}>{loc as string}</option>
                                        ))}
                                    </select>
                                </div>
                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700">{t('save_details', { defaultValue: 'Save Details' })}</button>
                            </form>
                        )}
                    </div>
                )}
            </Modal>

            {/* Onboarding Link Modal */}
            <Modal isOpen={linkModalOpen} onClose={() => setLinkModalOpen(false)} title={t('onboarding_link_title', { defaultValue: 'Onboarding Link' })} maxWidth="max-w-md">
                <div className="space-y-4 py-2">
                    <p className="text-sm text-slate-600">{t('onboarding_link_prompt', { defaultValue: 'Copy this onboarding link:' })}</p>
                    <div className="flex items-center gap-2">
                        <input type="text" readOnly value={generatedLink} className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 focus:outline-none" />
                        <button onClick={() => {
                            const copyFallback = () => {
                                const textArea = document.createElement("textarea");
                                textArea.value = generatedLink;
                                textArea.style.position = "fixed";
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                try {
                                    document.execCommand('copy');
                                    toast.success(t('onboarding_link_copied', { defaultValue: 'Onboarding link copied — send it to the new hire.' }));
                                    setLinkModalOpen(false);
                                } catch (err) {
                                    toast.error(t('failed_to_copy_select_manually', { defaultValue: 'Failed to copy. Please select the link and copy manually.' }));
                                }
                                document.body.removeChild(textArea);
                            };

                            if (navigator.clipboard && window.isSecureContext) {
                                navigator.clipboard.writeText(generatedLink).then(() => {
                                    toast.success(t('onboarding_link_copied', { defaultValue: 'Onboarding link copied — send it to the new hire.' }));
                                    setLinkModalOpen(false);
                                }).catch(() => copyFallback());
                            } else {
                                copyFallback();
                            }
                        }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700">
                            {t('copy', { defaultValue: 'Copy' })}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Onboarding Submission Details — what the new hire filled in via their onboarding link */}
            <Modal isOpen={!!onbCand} onClose={() => setOnbCand(null)} title={t('onboarding_details', { defaultValue: 'Onboarding Details' })} maxWidth="max-w-2xl">
                {onbLoading ? (
                    <p className="text-sm text-slate-500 py-4">{t('loading', { defaultValue: 'Loading…' })}</p>
                ) : (() => {
                    const d = (onbCand?.onboardingData) || {};
                    const textEntries = ONB_FIELD_LABELS.filter(([k]) => d[k] !== undefined && d[k] !== null && String(d[k]).trim() !== '');
                    const docEntries = ONB_DOC_LABELS.filter(([k]) => d[k]);
                    if (!textEntries.length && !docEntries.length) {
                        return <p className="text-sm text-slate-500 py-4">{t('no_onboarding_data', { defaultValue: 'The new hire has not submitted any onboarding details.' })}</p>;
                    }
                    return (
                        <div className="space-y-6 py-1">
                            {onbCand?.onboardingSubmittedAt && (
                                <p className="text-xs text-slate-400 font-medium">
                                    {t('submitted_on', { defaultValue: 'Submitted' })} {new Date(onbCand.onboardingSubmittedAt).toLocaleString()}
                                </p>
                            )}
                            {textEntries.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                    {textEntries.map(([k, label]) => (
                                        <div key={k}>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                                            <p className="text-sm font-semibold text-slate-700 break-words">{String(d[k])}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {docEntries.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('documents', { defaultValue: 'Documents' })}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {docEntries.map(([k, label]) => (
                                            <a key={k} href={`${SERVER_URL}${d[k]}`} target="_blank" rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-indigo-600 hover:bg-slate-100 transition-all">
                                                <Paperclip className="w-3.5 h-3.5" />{label}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>

        </div>
    );
};

// Labels for the self-service onboarding data the new hire submits (keys match what the
// public onboarding form stores on the candidate).
const ONB_FIELD_LABELS: [string, string][] = [
    ['fullName', 'Full Name'], ['fullNameArabic', 'Full Name (Arabic)'],
    ['dateOfBirth', 'Date of Birth'], ['placeOfBirth', 'Place of Birth'], ['placeOfBirthArabic', 'Place of Birth (Arabic)'],
    ['gender', 'Gender'], ['bloodType', 'Blood Type'],
    ['nationality', 'Nationality'], ['nationalityArabic', 'Nationality (Arabic)'], ['nationalId', 'National ID'],
    ['academicQualification', 'Academic Qualification'], ['academicQualificationArabic', 'Academic Qualification (Arabic)'],
    ['idCardNumber', 'ID Card Number'], ['idPlaceOfIssue', 'ID Place of Issue'], ['idPlaceOfIssueArabic', 'ID Place of Issue (Arabic)'], ['idIssueDate', 'ID Issue Date'],
    ['passportNumber', 'Passport Number'], ['passportPlaceOfIssue', 'Passport Place of Issue'], ['passportPlaceOfIssueArabic', 'Passport Place of Issue (Arabic)'], ['passportExpiryDate', 'Passport Expiry'],
    ['drivingLicenseType', 'Driving License Type'], ['drivingLicenseNumber', 'Driving License Number'], ['drivingLicenseExpiry', 'Driving License Expiry'], ['drivingLicensePlaceOfIssue', 'Driving License Place of Issue'],
    ['personalPhone', 'Phone'], ['personalEmail', 'Email'], ['emergencyContactNumber', 'Emergency Contact'],
    ['residentialAddress', 'Address'], ['residentialAddressArabic', 'Address (Arabic)'],
    ['workedBefore', 'Worked Before'], ['hasRelativesInCompany', 'Has Relatives in Company'], ['relativesNames', 'Relatives Names'], ['relativesNamesArabic', 'Relatives Names (Arabic)'],
    ['bankName', 'Bank Name'], ['bankBranchName', 'Bank Branch'], ['bankAccountNumber', 'Bank Account Number'],
    ['serviceProviderCompany', 'Service Provider Company'], ['employeeTravelDate', 'Travel Date'], ['employeeStartDate', 'Start Date'],
];
const ONB_DOC_LABELS: [string, string][] = [
    ['cvUrl', 'CV'], ['degreeUrl', 'Degree'], ['birthCertUrl', 'Birth Certificate'], ['passportCopyUrl', 'Passport Copy'],
    ['bankCheckUrl', 'Bank Check'], ['photoUrl', 'Photo'], ['idCardUrl', 'ID Card'], ['jobOfferUrl', 'Job Offer'],
    ['healthCertUrl', 'Health Certificate'], ['ticketUrl', 'Ticket'], ['residencyDocumentUrl', 'Residency Document'], ['interviewEvaluationUrl', 'Interview Evaluation'],
];

const EmptyState: React.FC<{ icon: React.ElementType; text: string }> = ({ icon: Icon, text }) => (
    <div className="py-20 text-center space-y-4 bg-white/40 rounded-[2.5rem] border border-slate-100">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto"><Icon className="w-10 h-10 text-slate-200" /></div>
        <p className="text-slate-400 font-medium">{text}</p>
    </div>
);

const EvalTile: React.FC<{ label: string; done: boolean; score?: number; recommend?: boolean; by?: string; canDo: boolean; onDo: () => void }> =
    ({ label, done, score, recommend, by, canDo, onDo }) => {
        const { t } = useTranslation();
        return (
        <div className={`p-3 rounded-2xl border ${done ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/40'}`}>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            {done ? (
                <div className="space-y-1">
                    <Stars value={score} />
                    <p className={`text-[10px] font-black uppercase tracking-widest ${recommend ? 'text-emerald-600' : 'text-rose-600'}`}>{recommend ? t('recommend_check', { defaultValue: '✓ Recommend' }) : t('not_recommended_cross', { defaultValue: '✕ Not recommended' })}</p>
                    {by && <p className="text-[10px] text-slate-400 font-bold truncate">{by}</p>}
                </div>
            ) : canDo ? (
                <button onClick={onDo} className="mt-1 w-full py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:border-indigo-300">{t('add_plus', { defaultValue: '+ Add' })}</button>
            ) : (
                <p className="text-[10px] text-slate-400 font-bold italic mt-1">{t('pending', { defaultValue: 'Pending' })}</p>
            )}
        </div>
        );
    };

const SummaryTile: React.FC<{ label: string; score?: number; recommend?: boolean; note?: string }> = ({ label, score, recommend, note }) => {
    const { t } = useTranslation();
    return (
    <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <Stars value={score} />
        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${recommend ? 'text-emerald-600' : 'text-rose-600'}`}>{recommend ? t('recommend_check', { defaultValue: '✓ Recommend' }) : t('not_recommended_cross', { defaultValue: '✕ Not recommended' })}</p>
        {note && <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-3">"{note}"</p>}
    </div>
    );
};

export default CandidatePipeline;
