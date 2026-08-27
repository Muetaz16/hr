import { PrismaClient } from '@prisma/client';
import { ATTENDANCE_API_BASE } from './attendanceApiProxy';

import { prisma } from '../lib/prisma';

// Same weights/caps as the manual-entry formula in src/services/hrEvaluationService.ts
// (calculatePresenceScore) — mirrored here since frontend/backend code isn't shared in
// this repo (same pattern already used for evaluationHierarchy.ts).
const CAPS = {
    absence: 7,   // days, weight 7 points
    delay: 180,   // minutes, weight 7 points
    emergency: 3, // days, weight 2 points
    unpaid: 14,   // days, weight 2 points
    annual: 14,   // days, weight 2 points
};

export interface PresenceRawInputs {
    absenceUnauthorized: number;
    delayMinutes: number;
    emergencyLeaves: number;
    unpaidLeaves: number;
    annualPaidLeaves: number;
}

export function calculatePresenceScore(input: PresenceRawInputs): number {
    const absenceScore = Math.max(0, CAPS.absence - input.absenceUnauthorized);
    const delayScore = Math.max(0, CAPS.absence - (input.delayMinutes / CAPS.delay * 7));
    const emergencyScore = Math.max(0, 2 - (input.emergencyLeaves / CAPS.emergency * 2));
    const unpaidScore = Math.max(0, 2 - (input.unpaidLeaves / CAPS.unpaid * 2));
    const annualScore = Math.max(0, 2 - (input.annualPaidLeaves / CAPS.annual * 2));
    const total = absenceScore + delayScore + emergencyScore + unpaidScore + annualScore;
    return Math.round(total * 100) / 100;
}

// For evaluation month "YYYY-MM", the presence window is the 25th of the previous
// month through the 24th of that month (e.g. month=2026-08 -> 2026-07-25..2026-08-24).
export function getPresenceWindow(month: string): { start: string; end: string } {
    const [y, m] = month.split('-').map(Number);
    const end = new Date(y, m - 1, 24);
    const start = new Date(y, m - 2, 25);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(start), end: fmt(end) };
}

// Calls the attendance system directly for one employee's raw presence inputs over an
// arbitrary date range. Never throws — returns null on any error/404/malformed response,
// matching the fail-soft convention used elsewhere in attendanceApiProxy.ts.
export async function fetchPresenceInputs(bioId: number, start: string, end: string): Promise<PresenceRawInputs | null> {
    try {
        const url = new URL(`/api/attendance/monthly-report/${bioId}`, ATTENDANCE_API_BASE);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
        const response = await fetch(url.toString());
        if (!response.ok) return null;
        const data: any = await response.json();
        return {
            absenceUnauthorized: Number(data?.absenceDays) || 0,
            delayMinutes: Number(data?.totalDeduction) || 0,
            emergencyLeaves: Number(data?.emergencyLeaveDays) || 0,
            unpaidLeaves: Number(data?.unpaidLeaveDays) || 0,
            annualPaidLeaves: Number(data?.paidLeaveDays) || 0,
        };
    } catch (error) {
        console.error(`[PRESENCE] Failed to fetch monthly report for bioId ${bioId}:`, error);
        return null;
    }
}

export type ComputePresenceResult =
    | { status: 'stored'; presenceScore: number; wasFinalized: boolean }
    | { status: 'skipped'; reason: 'already_submitted' | 'fetch_failed' | 'finalized' };

// Fetches, scores, and upserts one employee's Presence (HREvaluation) row for a month.
// Leaves an already-submitted (locked) record alone unless force=true — mirrors the
// "manual override retained" precedent from the evaluation-period automation. A
// finalized month (EvaluationFinalization exists) is never touched unless
// bypassFinalized=true (SUPER_ADMIN's "edit anytime" — the caller is responsible for
// re-finalizing afterward so the frozen snapshot/Evaluation Index stay in sync).
export async function computeAndStorePresence(params: {
    employeeId: string;
    bioId: number;
    month: string;
    submittedById?: string | null;
    force?: boolean;
    bypassFinalized?: boolean;
}): Promise<ComputePresenceResult> {
    const { employeeId, bioId, month, submittedById, force, bypassFinalized } = params;

    const finalized = await prisma.evaluationFinalization.findUnique({
        where: { employeeId_month: { employeeId, month } }
    });
    if (finalized && !bypassFinalized) {
        return { status: 'skipped', reason: 'finalized' };
    }

    const existing = await prisma.hREvaluation.findFirst({ where: { employeeId, month } });
    if (existing && existing.status === 'submitted' && !force) {
        return { status: 'skipped', reason: 'already_submitted' };
    }

    const { start, end } = getPresenceWindow(month);
    const inputs = await fetchPresenceInputs(bioId, start, end);
    if (!inputs) {
        return { status: 'skipped', reason: 'fetch_failed' };
    }

    const presenceScore = calculatePresenceScore(inputs);
    const data = {
        employeeId,
        month,
        ...inputs,
        presenceScore,
        status: 'auto',
        submittedAt: new Date(),
        submittedById: submittedById ?? null,
    };

    if (existing) {
        await prisma.hREvaluation.update({ where: { id: existing.id }, data });
    } else {
        await prisma.hREvaluation.create({ data });
    }

    return { status: 'stored', presenceScore, wasFinalized: !!finalized };
}
