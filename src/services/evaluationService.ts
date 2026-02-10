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
import type { DepartmentEvaluation, DirectorEvaluation } from '../types';
import { isHREvaluationCompleted } from './hrEvaluationService';

const DEPT_EVAL_COLLECTION = 'department_evaluations';
const DIR_EVAL_COLLECTION = 'director_evaluations';

export const evaluationService = {
    async getDeptEvaluation(employeeId: string, month: string): Promise<DepartmentEvaluation | null> {
        // In real app better to query or use specific IDs
        // let's use query for safety
        const q = query(collection(db, DEPT_EVAL_COLLECTION), where('employeeId', '==', employeeId), where('month', '==', month));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DepartmentEvaluation;
        return null;
    },

    async saveDeptEvaluation(evalData: Omit<DepartmentEvaluation, 'id'>) {
        // Check if HR evaluation is completed first
        const hrCompleted = await isHREvaluationCompleted(evalData.employeeId, evalData.month);
        if (!hrCompleted) {
            throw new Error('HR evaluation must be completed before department evaluation');
        }

        // Check if exists
        const existing = await evaluationService.getDeptEvaluation(evalData.employeeId, evalData.month);
        if (existing) {
            await updateDoc(doc(db, DEPT_EVAL_COLLECTION, existing.id), evalData);
        } else {
            await addDoc(collection(db, DEPT_EVAL_COLLECTION), evalData);
        }
    },

    async getDirectorEvaluation(employeeId: string, month: string): Promise<DirectorEvaluation | null> {
        const q = query(collection(db, DIR_EVAL_COLLECTION), where('employeeId', '==', employeeId), where('month', '==', month));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DirectorEvaluation;
        return null;
    },

    async saveDirectorEvaluation(evalData: Omit<DirectorEvaluation, 'id' | 'locked' | 'lockedAt'>) {
        const existing = await evaluationService.getDirectorEvaluation(evalData.employeeId, evalData.month);
        if (existing) {
            if (existing.locked) throw new Error("Evaluation is locked");
            await updateDoc(doc(db, DIR_EVAL_COLLECTION, existing.id), evalData);
            return existing.id;
        } else {
            const docRef = await addDoc(collection(db, DIR_EVAL_COLLECTION), { ...evalData, locked: false });
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
