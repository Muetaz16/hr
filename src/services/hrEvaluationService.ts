import api from './apiClient';
import type { HREvaluation } from '../types';

const PRESENCE_LIMITS = {
    absenceWithoutPermission: 7, // days (Weight: 7)
    delayAndEarlyDeparture: 180, // minutes (Weight: 7)
    emergencyLeaves: 3,          // days (Weight: 2)
    unpaidLeave: 14,             // days (Weight: 2)
    annualPaidLeave: 14          // days (Weight: 2)
};

export function calculatePresenceScore(evaluation: Partial<HREvaluation>): number {
    // 1. Absence without permission (Max 7 points)
    const absenceDays = evaluation.absenceWithoutPermission ?? 0;
    const absenceScore = Math.max(0, 7 - absenceDays);

    // 2. Delay & Early Departure (Max 7 points)
    const delayMins = evaluation.delayAndEarlyDeparture ?? 0;
    const delayScore = Math.max(0, 7 - (delayMins / PRESENCE_LIMITS.delayAndEarlyDeparture * 7));

    // 3. Emergency Leaves (Max 2 points)
    const emergencyDays = evaluation.emergencyLeaves ?? 0;
    const emergencyScore = Math.max(0, 2 - (emergencyDays / PRESENCE_LIMITS.emergencyLeaves * 2));

    // 4. Unpaid Leave (Max 2 points)
    const unpaidDays = evaluation.unpaidLeave ?? 0;
    const unpaidScore = Math.max(0, 2 - (unpaidDays / PRESENCE_LIMITS.unpaidLeave * 2));

    // 5. Annual Paid Leave (Max 2 points) - Replaces violationScore
    const annualDays = evaluation.annualPaidLeave ?? 0;
    const annualScore = Math.max(0, 2 - (annualDays / PRESENCE_LIMITS.annualPaidLeave * 2));

    const totalScore = absenceScore + delayScore + emergencyScore + unpaidScore + annualScore;

    return Math.round(totalScore * 100) / 100;
}

export async function createOrUpdateHREvaluation(
    employeeId: string,
    month: string,
    evaluationData: Omit<HREvaluation, 'id' | 'submittedAt' | 'submittedBy'>,
    submittedBy: string
): Promise<string> {
    const presenceScore = calculatePresenceScore(evaluationData);
    const payload = {
        ...evaluationData,
        employeeId,
        month,
        presenceScore,
        submittedBy
    };
    const response = await api.post('/evaluations/hr', payload);
    return response.data.id;
}

export async function getHREvaluation(employeeId: string, month: string): Promise<HREvaluation | null> {
    try {
        const response = await api.get(`/evaluations/hr?employeeId=${employeeId}&month=${month}`);
        return response.data || null;
    } catch (error) {
        return null;
    }
}

export async function getHREvaluationsByMonth(month: string): Promise<HREvaluation[]> {
    try {
        const response = await api.get(`/evaluations/hr/month/${month}`);
        return response.data;
    } catch (error) {
        return [];
    }
}

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
