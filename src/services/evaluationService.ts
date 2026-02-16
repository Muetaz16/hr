import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    where,
    updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { DepartmentEvaluation, DirectorEvaluation, PersonnelEvaluation } from '../types';
import { isHREvaluationCompleted } from './hrEvaluationService';

const DEPT_EVAL_COLLECTION = 'department_evaluations';
const DIR_EVAL_COLLECTION = 'director_evaluations';
const PERS_EVAL_COLLECTION = 'personnel_evaluations';

export const evaluationService = {
    async getPersonnelEvaluation(employeeId: string, month: string): Promise<PersonnelEvaluation | null> {
        const q = query(collection(db, PERS_EVAL_COLLECTION), where('employeeId', '==', employeeId), where('month', '==', month));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PersonnelEvaluation;
        return null;
    },

    async savePersonnelEvaluation(evalData: Omit<PersonnelEvaluation, 'id'>) {
        const q = query(collection(db, PERS_EVAL_COLLECTION), where('employeeId', '==', evalData.employeeId), where('month', '==', evalData.month));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            await updateDoc(doc(db, PERS_EVAL_COLLECTION, snapshot.docs[0].id), evalData);
        } else {
            await addDoc(collection(db, PERS_EVAL_COLLECTION), evalData);
        }
    },
    async getDeptEvaluation(employeeId: string, month: string): Promise<DepartmentEvaluation | null> {
        // In real app better to query or use specific IDs
        // let's use query for safety
        const q = query(collection(db, DEPT_EVAL_COLLECTION), where('employeeId', '==', employeeId), where('month', '==', month));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DepartmentEvaluation;
        return null;
    },

    async saveDeptEvaluation(evalData: Omit<DepartmentEvaluation, 'id'>) {
        // Calculate total score ensures integrity even if UI sends wrong total
        // Sum of all 16 fields (weights are implicit if they are just raw scores out of 100 or something, 
        // but user request implies weights. 
        // Actually, the screenshots show "Percent" next to each. 
        // Let's assume the input is the Score (e.g. 0-10) and we might need to apply weights OR 
        // the user inputs the *weighted* score directly? 
        // The screenshot shows "5.00%", "5.00%", etc. which sums to 25%, 40%, 35%. 
        // So the user probably enters a score (e.g. 5/5) or strict percentage.
        // Let's assume user enters the value directly as per the max weight (e.g. max 5 for a 5% field).

        const totalScore =
            (evalData.relationshipWithColleagues || 0) +
            (evalData.teamworkParticipation || 0) +
            (evalData.workOrganization || 0) +
            (evalData.communicationSkills || 0) +
            (evalData.regulatoryCompliance || 0) +
            (evalData.taskQuality || 0) +
            (evalData.timeCommitment || 0) +
            (evalData.organizationalCompliance || 0) +
            (evalData.problemSolving || 0) +
            (evalData.pressureHandling || 0) +
            (evalData.continuousDevelopment || 0) +
            (evalData.regulationsAdherence || 0) +
            (evalData.safetyAdherence || 0) +
            (evalData.appearanceCommitment || 0) +
            (evalData.resourcePreservation || 0) +
            (evalData.dataPrivacy || 0);

        const dataToSave = { ...evalData, totalScore };

        const existing = await evaluationService.getDeptEvaluation(evalData.employeeId, evalData.month);
        if (existing) {
            await updateDoc(doc(db, DEPT_EVAL_COLLECTION, existing.id), dataToSave);
        } else {
            await addDoc(collection(db, DEPT_EVAL_COLLECTION), dataToSave);
        }
    },

    async getDirectorEvaluation(employeeId: string, month: string): Promise<DirectorEvaluation | null> {
        const q = query(collection(db, DIR_EVAL_COLLECTION), where('employeeId', '==', employeeId), where('month', '==', month));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DirectorEvaluation;
        return null;
    },

    async saveDirectorEvaluation(evalData: Omit<DirectorEvaluation, 'id' | 'locked' | 'lockedAt'>) {
        const finalScore =
            (evalData.relationshipWithColleagues || 0) +
            (evalData.teamworkParticipation || 0) +
            (evalData.workOrganization || 0) +
            (evalData.communicationSkills || 0) +
            (evalData.regulatoryCompliance || 0) +
            (evalData.taskQuality || 0) +
            (evalData.timeCommitment || 0) +
            (evalData.organizationalCompliance || 0) +
            (evalData.problemSolving || 0) +
            (evalData.pressureHandling || 0) +
            (evalData.continuousDevelopment || 0) +
            (evalData.regulationsAdherence || 0) +
            (evalData.safetyAdherence || 0) +
            (evalData.appearanceCommitment || 0) +
            (evalData.resourcePreservation || 0) +
            (evalData.dataPrivacy || 0);

        const dataToSave = { ...evalData, finalScore, locked: false };

        const existing = await evaluationService.getDirectorEvaluation(evalData.employeeId, evalData.month);
        if (existing) {
            if (existing.locked) throw new Error("Evaluation is locked");
            // If it was already locked in DB check, but here we just update
            await updateDoc(doc(db, DIR_EVAL_COLLECTION, existing.id), dataToSave);
            return existing.id;
        } else {
            const docRef = await addDoc(collection(db, DIR_EVAL_COLLECTION), dataToSave);
            return docRef.id;
        }
    },

    async lockEvaluation(id: string) {
        await updateDoc(doc(db, DIR_EVAL_COLLECTION, id), {
            locked: true,
            lockedAt: new Date().toISOString()
        });
    }
};
