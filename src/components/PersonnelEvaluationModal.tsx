import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { evaluationService } from '../services/evaluationService';
import type { Employee } from '../types';
import Modal from './Modal';

interface PersonnelForm {
    warningMessages: number;
    disciplinaryDeduction: number;
    appreciationMessages: number;
    exceptionalAssignments: number;
    specializedTraining: boolean;
    supportingTraining: boolean;
    languageTraining: boolean;
    softwareTraining: boolean;
}

const DEFAULT_FORM: PersonnelForm = {
    warningMessages: 0, disciplinaryDeduction: 0, appreciationMessages: 0, exceptionalAssignments: 0,
    specializedTraining: false, supportingTraining: false, languageTraining: false, softwareTraining: false,
};

interface Props {
    employee: Employee | null;
    month: string;
    isOpen: boolean;
    onClose: () => void;
    onSaved?: () => void;
}

// Shared "HR evaluation" popup — Exceptional Performance (±20%) + Training &
// Education (+10%), the two PersonnelEvaluation sections. Self-contained (own
// fetch/save) so it can be opened from anywhere with just an employee + month
// — the manager/Personnel fill-in screen and the HR admin overview both use
// this same component rather than duplicating the form.
const PersonnelEvaluationModal: React.FC<Props> = ({ employee, month, isOpen, onClose, onSaved }) => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [form, setForm] = useState<PersonnelForm>(DEFAULT_FORM);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && employee) fetchExisting();
    }, [isOpen, employee?.id, month]);

    const fetchExisting = async () => {
        if (!employee) return;
        setLoading(true);
        try {
            const rec = await evaluationService.getPersonnelEvaluation(employee.id, month);
            setForm(rec ? { ...DEFAULT_FORM, ...rec } : DEFAULT_FORM);
        } catch (error) {
            console.error('Error fetching personnel evaluation:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employee || !currentUser) return;
        try {
            await evaluationService.savePersonnelEvaluation({
                employeeId: employee.id,
                month,
                submittedBy: currentUser.id,
                ...form,
            } as any);
            onSaved?.();
            onClose();
        } catch (error) {
            console.error('Error saving personnel evaluation:', error);
            alert(error instanceof Error ? error.message : 'Failed to save');
        }
    };

    const renderCountInput = (label: string, description: string, value: number, max: number, onChange: (v: number) => void) => (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-5 border-b border-slate-100 last:border-0">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-slate-700">{label}</label>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded shrink-0">Max {max}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">{description}</p>
            </div>
            <div className="w-full sm:w-40 shrink-0">
                <input
                    type="number" min="0" max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-300 transition-all font-bold text-slate-800 text-base text-center"
                />
            </div>
        </div>
    );

    const renderToggleRow = (label: string, description: string, checked: boolean, onToggle: () => void) => (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-5 border-b border-slate-100 last:border-0">
            <div className="flex-1">
                <label className="text-sm font-bold text-slate-700">{label}</label>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">{description}</p>
            </div>
            <div className="w-full sm:w-40 shrink-0 flex sm:justify-center">
                <button type="button" onClick={onToggle} className={`w-14 h-7 rounded-full transition-colors relative ${checked ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-7' : ''}`} />
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={employee ? `${t('personnel_evaluation')} — ${employee.fullName}` : t('personnel_evaluation')}
            fullScreen
            fullScreenWidth="max-w-4xl"
        >
            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-white/60 rounded-2xl border border-slate-100 p-6">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-3 mb-1 flex justify-between">{t('activity_discipline')} <span className="text-indigo-600">±20%</span></h4>
                        {renderCountInput(t('warning_messages'), t('warning_messages_desc'), form.warningMessages, 3, v => setForm({ ...form, warningMessages: v }))}
                        {renderCountInput(t('disciplinary_days'), t('disciplinary_days_desc'), form.disciplinaryDeduction, 14, v => setForm({ ...form, disciplinaryDeduction: v }))}
                        {renderCountInput(t('appreciation_msg'), t('appreciation_msg_desc'), form.appreciationMessages, 3, v => setForm({ ...form, appreciationMessages: v }))}
                        {renderCountInput(t('exceptional_days'), t('exceptional_days_desc'), form.exceptionalAssignments, 30, v => setForm({ ...form, exceptionalAssignments: v }))}
                    </div>
                    <div className="bg-white/60 rounded-2xl border border-slate-100 p-6">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b pb-3 mb-1 flex justify-between">{t('training_development')} <span className="text-indigo-600">+10%</span></h4>
                        {renderToggleRow(t('specialized_training'), t('specialized_training_desc'), form.specializedTraining, () => setForm(prev => ({ ...prev, specializedTraining: !prev.specializedTraining })))}
                        {renderToggleRow(t('supporting_training'), t('supporting_training_desc'), form.supportingTraining, () => setForm(prev => ({ ...prev, supportingTraining: !prev.supportingTraining })))}
                        {renderToggleRow(t('language_courses'), t('language_courses_desc'), form.languageTraining, () => setForm(prev => ({ ...prev, languageTraining: !prev.languageTraining })))}
                        {renderToggleRow(t('software_electronic'), t('software_electronic_desc'), form.softwareTraining, () => setForm(prev => ({ ...prev, softwareTraining: !prev.softwareTraining })))}
                    </div>
                    <div className="pt-4 border-t sticky bottom-0 bg-white pb-2 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-4 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">{t('cancel')}</button>
                        <button type="submit" className="flex-1 px-6 py-4 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 bg-indigo-600 hover:bg-indigo-700">{t('save_record')}</button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default PersonnelEvaluationModal;
