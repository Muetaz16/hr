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
    annualPaidLeave: 30 // days (informational, default max)
};

/**
 * Calculate presence score based on HR evaluation criteria
 * Score: 0-10 (10 = perfect presence, 0 = poor presence)
 */
/**
 * Calculate presence score based on HR evaluation criteria
 * Returns a score out of 100 (which represents the 20% category).
 * Weights: Absence (7), Delay (7), Emergency (2), Unpaid (2), Annual/Other (2) = 20 Total.
 * Scaled to 100: Absence (35), Delay (35), Emergency (10), Unpaid (10), Other (10).
 */
/**
 * Calculate presence score based on HR evaluation criteria
 * Returns a score out of 100 (which represents the 20% category).
 * Input: 5 metrics graded 0-100.
 * Weights: Absence (0.35 of total 100), Delay (0.35), Emergency (0.10), Unpaid (0.10), Violation (0.10).
 * (Equating to 7, 7, 2, 2, 2 out of 20).
 */
/**
 * Calculate presence score based on HR evaluation criteria
 * Returns a score out of 100 (which represents the 20% category).
 * Input: 5 metrics graded 0-100.
 * Weights: Absence (0.35 of total 100), Delay (0.35), Emergency (0.10), Unpaid (0.10), Violation (0.10).
 * (Equating to 7, 7, 2, 2, 2 out of 20).
 */
export function calculatePresenceScore(evaluation: Partial<HREvaluation>): number {
    // Defaults to 100 if undefined
    const absence = evaluation.absenceScoreValue ?? 100;
    const delay = evaluation.delayScoreValue ?? 100;
    const emergency = evaluation.emergencyScoreValue ?? 100;
    const unpaid = evaluation.unpaidScoreValue ?? 100;
    const violation = evaluation.violationScoreValue ?? 100;

    // Weights (Sum = 1.0)
    // 7 points out of 20 = 35%
    // 2 points out of 20 = 10%
    const score =
        (absence * 0.35) +
        (delay * 0.35) +
        (emergency * 0.10) +
        (unpaid * 0.10) +
        (violation * 0.10);

    return Math.round(score * 100) / 100;
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
 * Submit all draft evaluations for a specific month
 */
export async function submitAllHREvaluationsForMonth(month: string): Promise<void> {
    const q = query(
        collection(db, COLLECTION),
        where('month', '==', month),
        where('status', '==', 'draft')
    );
    const snapshot = await getDocs(q);

    const batchPromises = snapshot.docs.map(docSnapshot => {
        return updateDoc(docSnapshot.ref, {
            status: 'submitted',
            submittedAt: new Date().toISOString()
        });
    });

    await Promise.all(batchPromises);
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
