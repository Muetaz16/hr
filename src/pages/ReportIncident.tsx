import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Paperclip, Send, Plus, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import { disciplinaryService, type MyDisciplinaryReport } from '../services/disciplinaryService';
import type { Employee, Department } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const todayIso = () => new Date().toISOString().slice(0, 10);

// Coarse status only — the reporting employee never sees investigation details, just whether HR
// has started looking at it yet and how it ended up, if it's over.
const reportStatus = (r: MyDisciplinaryReport): { label: string; cls: string } => {
    if (r.stage === 'CLOSED') {
        return r.closureReason
            ? { label: 'Dismissed', cls: 'bg-amber-100 text-amber-800' }
            : { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800' };
    }
    if (r.stage === 'INCIDENT_REPORT') return { label: 'Pending', cls: 'bg-slate-100 text-slate-600' };
    return { label: 'Under Investigation', cls: 'bg-blue-100 text-blue-800' };
};

const ReportIncident: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const { data: myReports, isLoading: reportsLoading } = useQuery({
        queryKey: ['my-disciplinary-reports'],
        queryFn: () => disciplinaryService.getMyReports(),
    });
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

    const [subjectQuery, setSubjectQuery] = useState('');
    const [subjectEmployee, setSubjectEmployee] = useState<Employee | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const blurTimeout = useRef<number | null>(null);

    const [reportedDate, setReportedDate] = useState(todayIso());
    const [positionTitle, setPositionTitle] = useState('');
    const [department, setDepartment] = useState('');
    const [incidentDate, setIncidentDate] = useState(todayIso());
    const [incidentPlace, setIncidentPlace] = useState('');
    const [description, setDescription] = useState('');

    const [isAnonymous, setIsAnonymous] = useState(false);
    const [files, setFiles] = useState<File[]>([]);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        employeeService.getAllEmployees().then(setEmployees).catch(() => toast.error(t('failed_to_load_employees', { defaultValue: 'Failed to load employees.' })));
        departmentService.getAllDepartments().then(setDepartments).catch(() => {});
    }, []);

    const suggestions = useMemo(() => {
        const q = subjectQuery.trim().toLowerCase();
        if (!q || subjectEmployee) return [];
        return employees
            .filter(emp => emp.fullName.toLowerCase().includes(q) || (emp.staffId || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [subjectQuery, subjectEmployee, employees]);

    const selectSubject = (emp: Employee) => {
        setSubjectEmployee(emp);
        setSubjectQuery(emp.fullName);
        setPositionTitle(emp.position || '');
        setDepartment(departments.find(d => d.id === emp.departmentId)?.name || '');
        setShowSuggestions(false);
    };

    const handleSubjectChange = (value: string) => {
        setSubjectQuery(value);
        if (subjectEmployee && value !== subjectEmployee.fullName) {
            setSubjectEmployee(null);
            setPositionTitle('');
            setDepartment('');
        }
        setShowSuggestions(true);
    };

    const handleFilesChange = (fileList: FileList | null) => {
        const picked = Array.from(fileList || []);
        if (picked.length > MAX_FILES) {
            toast.error(t('you_can_attach_up_to_max_files', { max: MAX_FILES, defaultValue: 'You can attach up to {{max}} files.' }));
            return;
        }
        const tooBig = picked.find(f => f.size > MAX_FILE_SIZE);
        if (tooBig) {
            toast.error(t('name_exceeds_the_100_mb_limit_per_file', { name: tooBig.name, defaultValue: '"{{name}}" exceeds the 100 MB limit per file.' }));
            return;
        }
        setFiles(picked);
    };

    const resetForm = () => {
        setSubjectQuery('');
        setSubjectEmployee(null);
        setReportedDate(todayIso());
        setPositionTitle('');
        setDepartment('');
        setIncidentDate(todayIso());
        setIncidentPlace('');
        setDescription('');
        setIsAnonymous(false);
        setFiles([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subjectEmployee) return toast.error(t('select_the_subject_employee_from_the_suggestions', { defaultValue: 'Select the subject employee from the suggestions.' }));
        if (!positionTitle.trim()) return toast.error(t('position_title_of_the_subject_employee_is', { defaultValue: 'Position title of the subject employee is required.' }));
        if (!department.trim()) return toast.error(t('department_of_the_subject_employee_is_required', { defaultValue: 'Department of the subject employee is required.' }));
        if (!incidentDate) return toast.error(t('date_happened_is_required', { defaultValue: 'Date happened is required.' }));
        if (!incidentPlace.trim()) return toast.error(t('place_of_incident_is_required', { defaultValue: 'Place of incident is required.' }));
        if (!description.trim()) return toast.error(t('a_description_of_the_incident_is_required', { defaultValue: 'A description of the incident is required.' }));

        setSubmitting(true);
        try {
            const created = await disciplinaryService.createIncidentReport({
                employeeId: subjectEmployee.id,
                reportedDate,
                incidentDate,
                incidentPlace,
                incidentDescription: description,
                subjectPositionTitle: positionTitle,
                subjectDepartment: department,
                isAnonymous,
            });
            if (files.length) {
                await disciplinaryService.addEvidence(created.id, files);
            }
            toast.success(t('incident_report_submitted_personnel_relations_will_review_it', { defaultValue: 'Incident report submitted. Personnel Relations will review it.' }));
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['my-disciplinary-reports'] });
            setShowForm(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || t('failed_to_submit_the_incident_report', { defaultValue: 'Failed to submit the incident report.' }));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-start gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <AlertTriangle size={22} />
                </div>
                <div>
                    <h1 className="text-xl font-semibold text-slate-800">{t('report_an_incident', { defaultValue: 'Report an Incident' })}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {t('any_employee_may_file_an_incident_report_about', { defaultValue: 'Any employee may file an incident report — about yourself or a colleague. Personnel Relations reviews every report confidentially per the Disciplinary Action Procedure.' })}
                    </p>
                </div>
            </div>

            {currentUser && !showForm && (
                <div className="space-y-4">
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-900"
                    >
                        <Plus size={16} /> {t('report_new_incident', { defaultValue: 'Report New Incident' })}
                    </button>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500">{t('my_submitted_reports', { defaultValue: 'My Submitted Reports' })}</span>
                        </div>
                        {reportsLoading && <p className="text-sm text-slate-400 text-center py-6">{t('loading', { defaultValue: 'Loading…' })}</p>}
                        {!reportsLoading && (myReports?.length ?? 0) === 0 && (
                            <p className="text-sm text-slate-400 text-center py-6">{t('no_reports_submitted_yet', { defaultValue: "You haven't submitted any reports yet." })}</p>
                        )}
                        {!reportsLoading && !!myReports?.length && (
                            <table className="w-full text-left text-sm">
                                <tbody className="divide-y divide-slate-100">
                                    {myReports.map(r => {
                                        const status = reportStatus(r);
                                        return (
                                            <tr key={r.id}>
                                                <td className="px-5 py-3 text-slate-400 text-xs">{r.caseNumber}</td>
                                                <td className="px-5 py-3 text-slate-500 text-xs">
                                                    {(r.reportedDate || r.createdAt).slice(0, 10)}
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
                        <ArrowLeft size={14} /> {t('back_to_my_reports', { defaultValue: 'Back to my reports' })}
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('date_reported', { defaultValue: 'Date reported' })}</label>
                            <input
                                type="date"
                                value={reportedDate}
                                onChange={e => setReportedDate(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('date_happened', { defaultValue: 'Date happened' })}</label>
                            <input
                                type="date"
                                value={incidentDate}
                                onChange={e => setIncidentDate(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('subject_employee_s', { defaultValue: 'Subject employee/s' })}</label>
                        <input
                            type="text"
                            value={subjectQuery}
                            onChange={e => handleSubjectChange(e.target.value)}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => { blurTimeout.current = window.setTimeout(() => setShowSuggestions(false), 150); }}
                            placeholder={t('start_typing_employee_name', { defaultValue: "Start typing the employee's name…" })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            autoComplete="off"
                            required
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-md max-h-56 overflow-auto">
                                {suggestions.map(emp => (
                                    <li key={emp.id}>
                                        <button
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => selectSubject(emp)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                        >
                                            {emp.fullName}{emp.staffId ? ` (${emp.staffId})` : ''}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('position_title', { defaultValue: 'Position title' })}</label>
                            <input
                                type="text"
                                value={positionTitle}
                                onChange={e => setPositionTitle(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('department', { defaultValue: 'Department' })}</label>
                            <input
                                type="text"
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('place_of_incident', { defaultValue: 'Place of incident' })}</label>
                        <input
                            type="text"
                            value={incidentPlace}
                            onChange={e => setIncidentPlace(e.target.value)}
                            placeholder={t('place_of_incident_placeholder', { defaultValue: 'e.g. Warehouse 2, Head Office' })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('description_of_the_incident', { defaultValue: 'Description of the incident' })}</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={5}
                            placeholder={t('incident_description_placeholder', { defaultValue: 'Describe what happened, when, and who was involved or witnessed it.' })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">{t('how_should_this_report_be_filed', { defaultValue: 'How should this report be filed?' })}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${!isAnonymous ? 'border-slate-800 bg-slate-50' : 'border-slate-300'}`}>
                                <input type="radio" name="isAnonymous" checked={!isAnonymous} onChange={() => setIsAnonymous(false)} className="mt-0.5" />
                                <span>
                                    <span className="block font-medium text-slate-700">{t('under_my_name', { defaultValue: 'Under my name' })}</span>
                                    <span className="block text-xs text-slate-500">{currentUser?.fullName}</span>
                                </span>
                            </label>
                            <label className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${isAnonymous ? 'border-slate-800 bg-slate-50' : 'border-slate-300'}`}>
                                <input type="radio" name="isAnonymous" checked={isAnonymous} onChange={() => setIsAnonymous(true)} className="mt-0.5" />
                                <span>
                                    <span className="block font-medium text-slate-700">{t('anonymously', { defaultValue: 'Anonymously' })}</span>
                                    <span className="block text-xs text-slate-500">{t('hr_wont_see_your_name', { defaultValue: "HR won't see your name" })}</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                            <Paperclip size={14} /> {t('supporting_documents_optional', { count: MAX_FILES, defaultValue: 'Supporting documents (optional, up to {{count}} files, 100 MB each)' })}
                        </label>
                        <input
                            type="file"
                            multiple
                            onChange={e => handleFilesChange(e.target.files)}
                            className="w-full text-sm text-slate-600"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-900 disabled:opacity-60"
                    >
                        <Send size={16} /> {submitting ? t('submitting', { defaultValue: 'Submitting…' }) : t('submit_report', { defaultValue: 'Submit report' })}
                    </button>
                </form>
            )}
        </div>
    );
};

export default ReportIncident;
