import api from './apiClient';
import type { EvaluationPeriod } from '../types';

export async function enableEvaluationPeriod(
    month: string,
    _enabledBy: string, // Kept for interface compatibility but backend uses token
    departmentId?: string,
    groupId?: string,
    notes?: string
): Promise<string> {
    const response = await api.post('/evaluation-periods', {
        month,
        departmentId,
        groupId,
        notes,
        // enabledBy is handled by backend token
    });
    return response.data.id;
}

export async function disableEvaluationPeriod(id: string): Promise<void> {
    await api.delete(`/evaluation-periods/${id}`);
}

export async function isEvaluationEnabled(
    month: string,
    departmentId?: string,
    _groupId?: string
): Promise<boolean> {
    // We fetch all periods for the month and check if any match
    // This is less efficient than a specific endpoint but simpler given the current API
    // Optimization: Create a specific check endpoint if needed
    try {
        const response = await api.get(`/evaluation-periods?month=${month}`);
        const periods: EvaluationPeriod[] = response.data;

        // Logic:
        // 1. Check for specific department match
        if (departmentId) {
            const match = periods.find(p => p.departmentId === departmentId && p.enabled);
            if (match) return true;
        }

        // 2. Check for "All Departments" (departmentId is null)
        const allMatch = periods.find(p => !p.departmentId && p.enabled);
        if (allMatch) return true;

        return false;
    } catch (error) {
        console.error("Error checking evaluation status:", error);
        return false;
    }
}

export async function getEvaluationPeriods(): Promise<EvaluationPeriod[]> {
    const response = await api.get('/evaluation-periods');
    return response.data;
}

export async function getEvaluationPeriodsByMonth(month: string): Promise<EvaluationPeriod[]> {
    const response = await api.get(`/evaluation-periods?month=${month}`);
    return response.data;
}

export async function enableAllDepartments(month: string, _enabledBy: string): Promise<string> {
    return enableEvaluationPeriod(month, _enabledBy, undefined, undefined, 'All departments enabled');
}
