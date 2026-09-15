// The overtime report an attendance officer sends to a head.
//
// Recorded overtime for a range, grouped by whoever is responsible for approving it. Two rules
// shape the whole file:
//
//  - NOBODY IS DROPPED. Measured on the live roster, only 4 of the 15 employees with overtime this
//    month resolve to a department: 6 have an HR record but no placement at all, and 5 exist only
//    in the attendance system with no HR record. Those are returned in `unassigned` and `notLinked`
//    groups carrying their own totals. A head's report that silently omits two-thirds of the
//    overtime is worse than no report.
//
//  - PLACEMENT IS WALKED, NOT MATCHED. An employee stamped only with a department belongs to that
//    department's division as well. `orgScope.buildOrgResolver` completes the chain upward;
//    comparing ids literally — as `staffHubController.getPendingRequests` does — misses them.
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { fetchPayrollAttendance } from '../utils/payrollAttendance';
import { buildOrgResolver } from '../utils/orgScope';
import { periodForDate } from '../utils/payrollPeriod';
import { ATTENDANCE_API_BASE } from '../utils/attendanceApiProxy';
import { WEEKLY_OFF_DAYS } from '../utils/attendanceAnomaly';
import { generateOvertimeReportDocx } from '../utils/overtimeReportDoc';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Scope = 'all' | 'division' | 'department' | 'unit' | 'employee';
const SCOPES: Scope[] = ['all', 'division', 'department', 'unit', 'employee'];

interface ReportRow {
    empCode: string;
    employeeId: string | null;
    name: string;
    nameArabic: string | null;
    placement: { unit: string | null; department: string | null; division: string | null; directorate: string | null };
    recordedMins: number;
    approvedMins: number;
    /** From our own log — what we pushed that touches this range, so an overlap is visible. */
    approvals: { startDate: string; endDate: string; minutes: number; status: string; headName: string | null; appliedAt: Date }[];
}

interface ReportGroup {
    key: string;
    label: string;
    /** `unassigned` and `notLinked` are not org nodes — they are the two ways out of one. */
    kind: 'unit' | 'department' | 'division' | 'all' | 'unassigned' | 'notLinked';
    rows: ReportRow[];
    recordedMins: number;
    approvedMins: number;
}

/** One day of an individual's overtime, for the detailed single-employee report. */
interface DetailDay {
    date: string;
    dayKind: 'weekday' | 'restDay' | 'holiday';
    holidayName: string | null;
    punches: string[];
    otMins: number;
    workMins: number;
}

/**
 * GET /api/attendance-integration/overtime-report?start&end&scope&scopeId&empCode
 *
 * `scope=employee` with an `empCode` additionally returns the day-by-day breakdown — which is where
 * a head can see WHY somebody has thirty hours, since work on the weekly rest day and on public
 * holidays is booked entirely as overtime.
 */
export const getOvertimeReport = async (req: Request, res: Response) => {
    try {
        const start = typeof req.query.start === 'string' ? req.query.start.trim() : '';
        const end = typeof req.query.end === 'string' ? req.query.end.trim() : '';
        const scope: Scope = SCOPES.includes(req.query.scope as Scope) ? (req.query.scope as Scope) : 'all';
        const scopeId = typeof req.query.scopeId === 'string' ? req.query.scopeId.trim() : '';
        const onlyEmpCode = typeof req.query.empCode === 'string' ? req.query.empCode.trim() : '';

        if (!DAY_RE.test(start) || !DAY_RE.test(end)) {
            return res.status(400).json({ error: 'start and end must both be YYYY-MM-DD dates.' });
        }
        if (start > end) return res.status(400).json({ error: 'start must not be after end.' });

        // Through fetchPayrollAttendance rather than a bare fetch: it carries the four-attempt
        // retry with backoff this service needs. The summary returned HTTP 500 three times in a
        // row during development and recovered on its own.
        let attendance;
        try {
            attendance = await fetchPayrollAttendance(start, end);
        } catch (error) {
            return res.status(502).json({ error: `Could not read attendance for this range: ${(error as Error).message}` });
        }

        const [employees, units, departments, divisions, directorates, org] = await Promise.all([
            prisma.employee.findMany({
                where: { staffId: { not: null } },
                select: {
                    id: true, staffId: true, fullName: true, fullNameArabic: true, bioId: true,
                    unitId: true, departmentId: true, divisionId: true, directorateId: true,
                },
            }),
            prisma.unit.findMany({ select: { id: true, name: true } }),
            prisma.department.findMany({ select: { id: true, name: true } }),
            prisma.division.findMany({ select: { id: true, name: true } }),
            prisma.directorate.findMany({ select: { id: true, name: true } }),
            buildOrgResolver(prisma),
        ]);
        const mapOf = (list: { id: string; name: string }[]) => new Map(list.map(x => [x.id, x.name]));
        const unitName = mapOf(units);
        const deptName = mapOf(departments);
        const divName = mapOf(divisions);
        const dirName = mapOf(directorates);
        const empByCode = new Map(employees.filter(e => e.staffId).map(e => [e.staffId as string, e]));

        // Only people who actually have overtime — this is a worklist, not a roster dump. Somebody
        // with an approval but no recorded overtime is kept: that is precisely a case to look at.
        const codes = attendance.rows
            .filter(r => r.empCode && ((r.totalOTMins || 0) > 0 || (r.totalApprovedOTMins || 0) > 0))
            .map(r => r.empCode)
            .filter(c => !onlyEmpCode || c === onlyEmpCode);

        const logged = codes.length
            ? await prisma.overtimeApproval.findMany({
                // Two periods overlap when each starts before the other ends.
                where: { empCode: { in: codes }, startDate: { lte: end }, endDate: { gte: start } },
                orderBy: { startDate: 'asc' },
                select: { empCode: true, startDate: true, endDate: true, minutes: true, status: true, headName: true, appliedAt: true },
            })
            : [];
        const logByCode = new Map<string, typeof logged>();
        for (const a of logged) {
            const list = logByCode.get(a.empCode) || [];
            list.push(a);
            logByCode.set(a.empCode, list);
        }

        const groups = new Map<string, ReportGroup>();
        const bucket = (key: string, label: string, kind: ReportGroup['kind']): ReportGroup => {
            let g = groups.get(key);
            if (!g) { g = { key, label, kind, rows: [], recordedMins: 0, approvedMins: 0 }; groups.set(key, g); }
            return g;
        };

        for (const code of codes) {
            const att = attendance.byEmpCode.get(code);
            if (!att) continue;
            const emp = empByCode.get(code);
            const placement = emp ? org.placementOf(emp as any) : null;

            const row: ReportRow = {
                empCode: code,
                employeeId: emp?.id ?? null,
                name: emp?.fullName || att.empName || code,
                nameArabic: emp?.fullNameArabic ?? null,
                placement: {
                    unit: placement?.unitId ? unitName.get(placement.unitId) ?? null : null,
                    department: placement?.departmentId ? deptName.get(placement.departmentId) ?? null : null,
                    division: placement?.divisionId ? divName.get(placement.divisionId) ?? null : null,
                    directorate: placement?.directorateId ? dirName.get(placement.directorateId) ?? null : null,
                },
                recordedMins: att.totalOTMins || 0,
                approvedMins: att.totalApprovedOTMins || 0,
                approvals: (logByCode.get(code) || []).map(a => ({
                    startDate: a.startDate, endDate: a.endDate, minutes: a.minutes,
                    status: a.status, headName: a.headName, appliedAt: a.appliedAt,
                })),
            };

            const add = (g: ReportGroup) => {
                g.rows.push(row);
                g.recordedMins += row.recordedMins;
                g.approvedMins += row.approvedMins;
            };

            // Known to the attendance system, unknown to HR: cannot be placed, cannot be routed to
            // a head, and cannot be paid. Named, never dropped — 5 of 15 people today.
            if (!emp) { add(bucket('__notLinked', 'Not linked to an HR record', 'notLinked')); continue; }

            // A scope filter narrows to one node by WALKING the chart, not matching an id.
            if (scopeId && (scope === 'unit' || scope === 'department' || scope === 'division')) {
                const node = scope === 'unit' ? { unitId: scopeId }
                    : scope === 'department' ? { departmentId: scopeId }
                        : { divisionId: scopeId };
                if (!org.isUnder(emp as any, node)) continue;
            }

            const level = scope === 'unit'
                ? { id: placement?.unitId ?? null, name: row.placement.unit, kind: 'unit' as const }
                : scope === 'department'
                    ? { id: placement?.departmentId ?? null, name: row.placement.department, kind: 'department' as const }
                    : scope === 'division'
                        ? { id: placement?.divisionId ?? null, name: row.placement.division, kind: 'division' as const }
                        : { id: '__all', name: 'All employees', kind: 'all' as const };

            add(level.id && level.name
                ? bucket(level.id, level.name, level.kind)
                : bucket('__unassigned', 'No org placement', 'unassigned'));
        }

        // Real org nodes first, then the two exception buckets. Those stay last but are never
        // hidden, and everything sorts by size so the biggest number is the one that catches the eye.
        const isException = (g: ReportGroup) => (g.kind === 'unassigned' || g.kind === 'notLinked' ? 1 : 0);
        const ordered = [...groups.values()].sort((a, b) =>
            (isException(a) - isException(b)) || (b.recordedMins - a.recordedMins));
        for (const g of ordered) g.rows.sort((x, y) => y.recordedMins - x.recordedMins);

        const allRows = ordered.flatMap(g => g.rows);
        const startPeriod = periodForDate(new Date(`${start}T00:00:00`));
        const endPeriod = periodForDate(new Date(`${end}T00:00:00`));

        // The individual report: day by day, so a head can see where the hours came from.
        let detail: DetailDay[] | null = null;
        if (scope === 'employee' && onlyEmpCode) {
            const emp = empByCode.get(onlyEmpCode);
            const bioId = emp?.bioId ?? attendance.byEmpCode.get(onlyEmpCode)?.empId ?? null;
            if (bioId) detail = await readDayDetail(Number(bioId), start, end);
        }

        res.json({
            start, end,
            period: startPeriod === endPeriod ? startPeriod : null,
            // A REPORT may span two financial months; an APPROVAL may not, because the service
            // counts an intersecting approval in full for every run it touches. Flagged so the
            // screen can say why the approval controls are unavailable rather than just greying out.
            crossesPayrollBoundary: startPeriod !== endPeriod,
            totals: {
                employees: allRows.length,
                recordedMins: allRows.reduce((s, r) => s + r.recordedMins, 0),
                approvedMins: allRows.reduce((s, r) => s + r.approvedMins, 0),
                unplaced: ordered.find(g => g.kind === 'unassigned')?.rows.length ?? 0,
                notLinked: ordered.find(g => g.kind === 'notLinked')?.rows.length ?? 0,
            },
            groups: ordered,
            detail,
            warnings: attendance.warnings,
        });
    } catch (error) {
        console.error('Error building the overtime report:', error);
        res.status(500).json({ error: 'Failed to build the overtime report.' });
    }
};

/**
 * One employee's overtime, day by day.
 *
 * The day KIND is the point of this: the attendance service books work on the weekly rest day and
 * on a public holiday entirely as overtime, with `totalWorkMins` zero. Without naming the kind, a
 * head reading "8 hours of overtime on the 20th" has no way to tell a long Tuesday from a whole
 * day worked on eid.
 */
const readDayDetail = async (bioEmpId: number, start: string, end: string): Promise<DetailDay[] | null> => {
    try {
        const url = new URL(`/api/attendance/monthly-report/${bioEmpId}`, ATTENDANCE_API_BASE);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end);
        const response = await fetch(url.toString());
        if (!response.ok) return null;
        const report: any = await response.json().catch(() => null);
        const rows: any[] = Array.isArray(report?.reportData) ? report.reportData : [];

        return rows
            .map((d): DetailDay => {
                const date = String(d?.date || '').slice(0, 10);
                // Local midnight, never a bare date string: that parses as UTC and can resolve to
                // the previous day, which would label the wrong day as the rest day.
                const isRestDay = !!date && WEEKLY_OFF_DAYS.includes(new Date(`${date}T00:00:00`).getDay());
                return {
                    date,
                    dayKind: d?.isHoliday ? 'holiday' : isRestDay ? 'restDay' : 'weekday',
                    holidayName: d?.isHoliday ? (d?.holidayName ?? null) : null,
                    punches: Array.isArray(d?.punches) ? d.punches.map((p: any) => `${p.punchTime} ${p.punchState}`) : [],
                    otMins: Number(d?.otMins) || 0,
                    workMins: Number(d?.totalWorkMins) || 0,
                };
            })
            .filter(d => d.date && d.otMins > 0);
    } catch {
        return null;
    }
};


/**
 * GET /api/attendance-integration/overtime-report/document?start&end&scope&scopeId&empCode
 *
 * The same report as a signable Word document — one file per group, so a head never receives
 * another department's staff. Built rather than filled: there is no overtime template in public/.
 */
export const getOvertimeReportDocument = async (req: Request, res: Response) => {
    try {
        // Reuse the report itself rather than re-querying, so the document and the screen can never
        // disagree about who is in the group or what they are owed.
        const captured: { payload?: any; status?: number } = {};
        const fake = {
            json: (payload: any) => { captured.payload = payload; return fake; },
            status: (code: number) => { captured.status = code; return fake; },
        } as unknown as Response;
        await getOvertimeReport(req, fake);

        if (captured.status && captured.status >= 400) {
            return res.status(captured.status).json(captured.payload);
        }
        const report = captured.payload;
        if (!report?.groups?.length) {
            return res.status(404).json({ error: 'There is no overtime to report for this range.' });
        }

        // With a scopeId the report already holds exactly one real group; without one, everything is
        // in a single bucket anyway. Either way the document is one group.
        const scopeId = typeof req.query.scopeId === 'string' ? req.query.scopeId.trim() : '';
        const group = (scopeId && report.groups.find((g: any) => g.key === scopeId)) || report.groups[0];

        const buffer = generateOvertimeReportDocx({
            groupLabel: group.label,
            start: report.start,
            end: report.end,
            rows: group.rows.map((r: any) => ({
                name: r.name,
                empCode: r.empCode,
                placement: r.placement.unit || r.placement.department || r.placement.division || r.placement.directorate || '',
                recordedMins: r.recordedMins,
                approvedMins: r.approvedMins,
            })),
            recordedMins: group.recordedMins,
            approvedMins: group.approvedMins,
        });

        const safe = String(group.label).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Overtime';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Overtime_${safe}_${report.start}_to_${report.end}.docx"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error building the overtime report document:', error);
        res.status(500).json({ error: 'Failed to build the overtime report document.' });
    }
};
