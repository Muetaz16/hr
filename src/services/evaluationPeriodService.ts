import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { EvaluationPeriod } from '../types';

const COLLECTION = 'evaluation_periods';

/**
 * Enable evaluation period for a specific department/month
 */
export async function enableEvaluationPeriod(
    month: string,
    enabledBy: string,
    departmentId?: string,
    groupId?: string,
    notes?: string
): Promise<string> {
    const id = `${month}_${departmentId || 'all'}_${groupId || 'all'}`;

    // Build period data object, excluding undefined fields
    const periodData: EvaluationPeriod = {
        id,
        month,
        enabled: true,
        enabledBy,
        enabledAt: new Date().toISOString()
    };

    // Only add optional fields if they have values
    if (departmentId) periodData.departmentId = departmentId;
    if (groupId) periodData.groupId = groupId;
    if (notes) periodData.notes = notes;

    await setDoc(doc(db, COLLECTION, id), periodData);
    return id;
}

/**
 * Disable evaluation period
 */
export async function disableEvaluationPeriod(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Check if evaluation is enabled for a specific department/month
 */
export async function isEvaluationEnabled(
    month: string,
    departmentId?: string,
    groupId?: string
): Promise<boolean> {
    // Check specific department/group
    if (departmentId || groupId) {
        const specificId = `${month}_${departmentId || 'all'}_${groupId || 'all'}`;
        const specificDoc = await getDoc(doc(db, COLLECTION, specificId));
        if (specificDoc.exists() && specificDoc.data().enabled) {
            return true;
        }
    }

    // Check if "all departments" is enabled for this month
    const allId = `${month}_all_all`;
    const allDoc = await getDoc(doc(db, COLLECTION, allId));
    return allDoc.exists() && allDoc.data().enabled;
}

/**
 * Get all evaluation periods (for HR dashboard)
 */
export async function getEvaluationPeriods(): Promise<EvaluationPeriod[]> {
    const q = query(collection(db, COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as EvaluationPeriod);
}

/**
 * Get evaluation periods for a specific month
 */
export async function getEvaluationPeriodsByMonth(month: string): Promise<EvaluationPeriod[]> {
    const q = query(collection(db, COLLECTION), where('month', '==', month));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as EvaluationPeriod);
}

/**
 * Enable evaluation for all departments in a month
 */
export async function enableAllDepartments(month: string, enabledBy: string): Promise<string> {
    return enableEvaluationPeriod(month, enabledBy, undefined, undefined, 'All departments enabled');
}
