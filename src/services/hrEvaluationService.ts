import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { HREvaluation } from '../types';

const COLLECTION = 'hr_evaluations';

// Presence limits from the evaluation criteria
const PRESENCE_LIMITS = {
    absenceWithoutPermission: 7, // days
    delayAndEarlyDeparture: 180, // minutes
    emergencyLeaves: 3, // days
    unpaidLeave: 14, // days
    annualPaidLeave: 14 // days
};

/**
 * Calculate presence score based on HR evaluation criteria
 * Score: 0-10 (10 = perfect presence, 0 = poor presence)
 */
export function calculatePresenceScore(evaluation: Omit<HREvaluation, 'presenceScore' | 'id' | 'submittedAt' | 'submittedBy' | 'status'>): number {
    let totalDeductions = 0;
    let maxPossibleDeductions = 0;

    // Calculate deductions for each criterion
    // Absence without permission: 0.5 points per day over 0
    const absenceDeduction = Math.min(evaluation.absenceWithoutPermission * 0.5, 3.5);
    totalDeductions += absenceDeduction;
    maxPossibleDeductions += 3.5;

    // Delay/early departure: 0.01 points per minute over 0
    const delayDeduction = Math.min(evaluation.delayAndEarlyDeparture * 0.01, 1.8);
    totalDeductions += delayDeduction;
    maxPossibleDeductions += 1.8;

    // Emergency leaves: 0.3 points per day over 0
    const emergencyDeduction = Math.min(evaluation.emergencyLeaves * 0.3, 0.9);
    totalDeductions += emergencyDeduction;
    maxPossibleDeductions += 0.9;

    // Unpaid leave: 0.2 points per day over 0
    const unpaidDeduction = Math.min(evaluation.unpaidLeave * 0.2, 2.8);
    totalDeductions += unpaidDeduction;
    maxPossibleDeductions += 2.8;

    // Annual paid leave: 0.1 points per day over 0 (considered normal)
    const annualDeduction = Math.min(evaluation.annualPaidLeave * 0.1, 1.4);
    totalDeductions += annualDeduction;
    maxPossibleDeductions += 1.4;

    // Calculate final score (10 - deductions, minimum 0)
    const finalScore = Math.max(0, 10 - totalDeductions);
    return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
}

/**
 * Create or update HR evaluation
 */
export async function createOrUpdateHREvaluation(
    employeeId: string,
    month: string,
    evaluationData: Omit<HREvaluation, 'id' | 'submittedAt' | 'submittedBy'>,
    submittedBy: string
): Promise<string> {
    const id = `${employeeId}_${month}`;
    const presenceScore = calculatePresenceScore(evaluationData);
    
    const hrEvaluation: HREvaluation = {
        id,
        ...evaluationData,
        presenceScore,
        submittedAt: new Date().toISOString(),
        submittedBy,
        status: evaluationData.status || 'draft'
    };

    const docRef = doc(db, COLLECTION, id);
    await setDoc(docRef, hrEvaluation, { merge: true });
    return id;
}

/**
 * Get HR evaluation for an employee and month
 */
export async function getHREvaluation(employeeId: string, month: string): Promise<HREvaluation | null> {
    const id = `${employeeId}_${month}`;
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? (snapshot.data() as HREvaluation) : null;
}

/**
 * Get all HR evaluations for a month
 */
export async function getHREvaluationsByMonth(month: string): Promise<HREvaluation[]> {
    const q = query(collection(db, COLLECTION), where('month', '==', month));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as HREvaluation);
}

/**
 * Get all HR evaluations for an employee
 */
export async function getHREvaluationsByEmployee(employeeId: string): Promise<HREvaluation[]> {
    const q = query(collection(db, COLLECTION), where('employeeId', '==', employeeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as HREvaluation);
}

/**
 * Submit HR evaluation (change status from draft to submitted)
 */
export async function submitHREvaluation(employeeId: string, month: string): Promise<void> {
    const id = `${employeeId}_${month}`;
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
        status: 'submitted',
        submittedAt: new Date().toISOString()
    });
}

/**
 * Delete HR evaluation
 */
export async function deleteHREvaluation(employeeId: string, month: string): Promise<void> {
    const id = `${employeeId}_${month}`;
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
}

/**
 * Check if HR evaluation is completed for an employee/month
 */
export async function isHREvaluationCompleted(employeeId: string, month: string): Promise<boolean> {
    const evaluation = await getHREvaluation(employeeId, month);
    return evaluation?.status === 'submitted';
}

/**
 * Get presence limits for validation
 */
export function getPresenceLimits() {
    return PRESENCE_LIMITS;
}

/**
 * Validate HR evaluation data against limits
 */
export function validateHREvaluation(evaluationData: Partial<HREvaluation>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (evaluationData.absenceWithoutPermission !== undefined) {
        if (evaluationData.absenceWithoutPermission < 0) {
            errors.push('Absence without permission cannot be negative');
        }
        if (evaluationData.absenceWithoutPermission > PRESENCE_LIMITS.absenceWithoutPermission) {
            errors.push(`Absence without permission cannot exceed ${PRESENCE_LIMITS.absenceWithoutPermission} days`);
        }
    }

    if (evaluationData.delayAndEarlyDeparture !== undefined) {
        if (evaluationData.delayAndEarlyDeparture < 0) {
            errors.push('Delay and early departure cannot be negative');
        }
        if (evaluationData.delayAndEarlyDeparture > PRESENCE_LIMITS.delayAndEarlyDeparture) {
            errors.push(`Delay and early departure cannot exceed ${PRESENCE_LIMITS.delayAndEarlyDeparture} minutes`);
        }
    }

    if (evaluationData.emergencyLeaves !== undefined) {
        if (evaluationData.emergencyLeaves < 0) {
            errors.push('Emergency leaves cannot be negative');
        }
        if (evaluationData.emergencyLeaves > PRESENCE_LIMITS.emergencyLeaves) {
            errors.push(`Emergency leaves cannot exceed ${PRESENCE_LIMITS.emergencyLeaves} days`);
        }
    }

    if (evaluationData.unpaidLeave !== undefined) {
        if (evaluationData.unpaidLeave < 0) {
            errors.push('Unpaid leave cannot be negative');
        }
        if (evaluationData.unpaidLeave > PRESENCE_LIMITS.unpaidLeave) {
            errors.push(`Unpaid leave cannot exceed ${PRESENCE_LIMITS.unpaidLeave} days`);
        }
    }

    if (evaluationData.annualPaidLeave !== undefined) {
        if (evaluationData.annualPaidLeave < 0) {
            errors.push('Annual paid leave cannot be negative');
        }
        if (evaluationData.annualPaidLeave > PRESENCE_LIMITS.annualPaidLeave) {
            errors.push(`Annual paid leave cannot exceed ${PRESENCE_LIMITS.annualPaidLeave} days`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
