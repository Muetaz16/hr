import api from './apiClient';
import type { PayrollResult } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx-js-style';

export const payrollService = {
    async savePayrollResult(result: Omit<PayrollResult, 'id'>) {
        const payload = { ...result };
        await api.post('/payroll', payload);
    },

    async deletePayrollResult(id: string) {
        await api.delete(`/payroll/${id}`);
    },

    async getPayrollByMonth(month: string): Promise<PayrollResult[]> {
        const response = await api.get(`/payroll/month/${month}`);
        return response.data;
    },

    async generateCSV(month: string): Promise<string> {
        const results = await this.getPayrollByMonth(month);
        const employeesResponse = await api.get('/employees');
        const empMap = new Map<string, any>(employeesResponse.data.map((emp: any) => [emp.id, emp]));

        const data = results.map(r => {
            const emp = empMap.get(r.employeeId);
            return {
                'Staff ID': emp?.staffId || 'N/A',
                'Employee Name': emp?.fullName || 'Unknown',
                'Month': r.month,
                'Presence': r.hrPresenceScore?.toFixed(2) || '0.00',
                'Absence Score (7)': Math.max(0, 7 - (r.hrAbsenceDays || 0)).toFixed(2),
                'Delay Score (7)': Math.max(0, 7 - ((r.hrDelayMinutes || 0) / 180 * 7)).toFixed(2),
                'Administrative Behavior': r.adminScore?.toFixed(2) || '0.00',
                'Executive Performance': r.executiveScore?.toFixed(2) || '0.00',
                'Care and discipline': r.careScore?.toFixed(2) || '0.00',
                'Exceptional performance': r.personnelBonusDays ? `+${r.personnelBonusDays} days` : '0',
                'Training and Education': r.trainingSummary || '',
                'Total': r.finalScore.toFixed(2)
            };
        });

        return Papa.unparse(data);
    },

    async generateSixMonthCSV(endMonth: string): Promise<string> {
        const months = [];
        let [year, month] = endMonth.split('-').map(Number);
        for (let i = 0; i < 6; i++) {
            months.push(`${year}-${String(month).padStart(2, '0')}`);
            month--;
            if (month === 0) { month = 12; year--; }
        }

        const allResults: any[] = [];
        const employeesResponse = await api.get('/employees');
        const empMap = new Map<string, any>(employeesResponse.data.map((emp: any) => [emp.id, emp]));

        for (const m of months) {
            const results = await this.getPayrollByMonth(m);
            const monthData = results.map(r => {
                const emp = empMap.get(r.employeeId);
                return {
                    'Staff ID': emp?.staffId || 'N/A',
                    'Employee Name': emp?.fullName || 'Unknown',
                    'Month': r.month,
                    'Presence': r.hrPresenceScore?.toFixed(2) || '0.00',
                    'Absence Score (7)': Math.max(0, 7 - (r.hrAbsenceDays || 0)).toFixed(2),
                    'Delay Score (7)': Math.max(0, 7 - ((r.hrDelayMinutes || 0) / 180 * 7)).toFixed(2),
                    'Administrative Behavior': r.adminScore?.toFixed(2) || '0.00',
                    'Executive Performance': r.executiveScore?.toFixed(2) || '0.00',
                    'Care and discipline': r.careScore?.toFixed(2) || '0.00',
                    'Exceptional performance': r.personnelBonusDays ? `+${r.personnelBonusDays} days` : '0',
                    'Training and Education': r.trainingSummary || '',
                    'Total': r.finalScore.toFixed(2)
                };
            });
            allResults.push(...monthData);
        }
        return Papa.unparse(allResults);
    },

    async generateSixMonthExcel(endMonth: string): Promise<Blob> {
        const months = [];
        let [year, month] = endMonth.split('-').map(Number);
        for (let i = 0; i < 6; i++) {
            months.push(`${year}-${String(month).padStart(2, '0')}`);
            month--;
            if (month === 0) { month = 12; year--; }
        }

        const employeesResponse = await api.get('/employees');
        const empMap = new Map<string, any>(employeesResponse.data.map((emp: any) => [emp.id, emp]));

        const allDataRows: any[][] = [];
        for (const m of months) {
            const results = await this.getPayrollByMonth(m);
            results.forEach(r => {
                const emp = empMap.get(r.employeeId);
                allDataRows.push([
                    emp?.staffId || 'N/A',
                    emp?.fullName || 'Unknown',
                    r.month,
                    Math.max(0, 7 - (r.hrAbsenceDays || 0)),
                    Math.max(0, 7 - ((r.hrDelayMinutes || 0) / 180 * 7)),
                    Math.max(0, 2 - ((r.hrEmergencyDays || 0) / 3 * 2)),
                    Math.max(0, 2 - ((r.hrUnpaidLeaves || 0) / 14 * 2)),
                    Math.max(0, 2 - ((r.hrAnnualPaidLeaves || 0) / 14 * 2)),
                    r.hrPresenceScore || 0,
                    r.relColleagues || 0,
                    r.teamwork || 0,
                    r.workOrg || 0,
                    r.commSkills || 0,
                    r.regCompliance || 0,
                    r.adminScore || 0,
                    r.taskQuality || 0,
                    r.timeCommit || 0,
                    r.orgCompliance || 0,
                    r.probSolving || 0,
                    r.pressureHandling || 0,
                    r.contDev || 0,
                    r.executiveScore || 0,
                    r.regAdherence || 0,
                    r.safetyAdherence || 0,
                    r.appearance || 0,
                    r.resPreservation || 0,
                    r.dataPrivacy || 0,
                    r.careScore || 0,
                    r.personnelBonusDays ? `+${r.personnelBonusDays} days` : '-',
                    r.trainingSummary || '-',
                    r.finalScore
                ]);
            });
        }

        const worksheet = this.createNestedHeaderSheet(allDataRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "6-Month Report");

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    },

    async generateMonthlyExcel(month: string): Promise<Blob> {
        const results = await this.getPayrollByMonth(month);
        const employeesResponse = await api.get('/employees');
        const empMap = new Map<string, any>(employeesResponse.data.map((emp: any) => [emp.id, emp]));

        const dataRows = results.map(r => {
            const emp = empMap.get(r.employeeId);
            return [
                emp?.staffId || 'N/A',
                emp?.fullName || 'Unknown',
                r.month,
                Math.max(0, 7 - (r.hrAbsenceDays || 0)),
                Math.max(0, 7 - ((r.hrDelayMinutes || 0) / 180 * 7)),
                Math.max(0, 2 - ((r.hrEmergencyDays || 0) / 3 * 2)),
                Math.max(0, 2 - ((r.hrUnpaidLeaves || 0) / 14 * 2)),
                Math.max(0, 2 - ((r.hrAnnualPaidLeaves || 0) / 14 * 2)),
                r.hrPresenceScore || 0,
                r.relColleagues || 0,
                r.teamwork || 0,
                r.workOrg || 0,
                r.commSkills || 0,
                r.regCompliance || 0,
                r.adminScore || 0,
                r.taskQuality || 0,
                r.timeCommit || 0,
                r.orgCompliance || 0,
                r.probSolving || 0,
                r.pressureHandling || 0,
                r.contDev || 0,
                r.executiveScore || 0,
                r.regAdherence || 0,
                r.safetyAdherence || 0,
                r.appearance || 0,
                r.resPreservation || 0,
                r.dataPrivacy || 0,
                r.careScore || 0,
                r.personnelBonusDays ? `+${r.personnelBonusDays} days` : '-',
                r.trainingSummary || '-',
                r.finalScore
            ];
        });

        const worksheet = this.createNestedHeaderSheet(dataRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Report ${month}`);

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    },

    createNestedHeaderSheet(dataRows: any[][]): XLSX.WorkSheet {
        // Styles cast to any to bypass strict nested property typing issues in xlsx-js-style
        const baseStyle: any = { font: { sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
        const headerStyle: any = { ...baseStyle, font: { ...baseStyle.font, bold: true }, fill: { fgColor: { rgb: "F1F5F9" } } };
        
        const presenceStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "E0E7FF" } }, font: { ...headerStyle.font, color: { rgb: "4338CA" } } };
        const adminStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "D1FAE5" } }, font: { ...headerStyle.font, color: { rgb: "047857" } } };
        const execStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "DBEAFE" } }, font: { ...headerStyle.font, color: { rgb: "1D4ED8" } } };
        const careStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "FEF3C7" } }, font: { ...headerStyle.font, color: { rgb: "B45309" } } };

        const subPresenceStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "F5F7FF" } }, font: { ...baseStyle.font, sz: 8 } };
        const subAdminStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "F0FDF4" } }, font: { ...baseStyle.font, sz: 8 } };
        const subExecStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "EFF6FF" } }, font: { ...baseStyle.font, sz: 8 } };
        const subCareStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FFFBEB" } }, font: { ...baseStyle.font, sz: 8 } };

        const scorePresenceStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "EEF2FF" } }, font: { ...baseStyle.font, bold: true, color: { rgb: "4338CA" } } };
        const scoreAdminStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "ECFDF5" } }, font: { ...baseStyle.font, bold: true, color: { rgb: "047857" } } };
        const scoreExecStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "EFF6FF" } }, font: { ...baseStyle.font, bold: true, color: { rgb: "1D4ED8" } } };
        const scoreCareStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FFFBEB" } }, font: { ...baseStyle.font, bold: true, color: { rgb: "B45309" } } };

        // Header Rows with Styles
        const h1 = [
            { v: 'Staff ID', s: headerStyle }, { v: 'Employee Name', s: headerStyle }, { v: 'Month', s: headerStyle },
            { v: 'Presence (20%)', s: presenceStyle }, '', '', '', '', { v: 'Score', s: presenceStyle },
            { v: 'Admin (25%)', s: adminStyle }, '', '', '', '', { v: 'Score', s: adminStyle },
            { v: 'Exec (40%)', s: execStyle }, '', '', '', '', '', { v: 'Score', s: execStyle },
            { v: 'Care (15%)', s: careStyle }, '', '', '', '', { v: 'Score', s: careStyle },
            { v: 'Bonus', s: headerStyle }, { v: 'Training', s: headerStyle }, { v: 'Total', s: { ...headerStyle, font: { ...headerStyle.font, sz: 11 } } }
        ];

        const h2 = [
            '', '', '',
            { v: 'Abs', s: subPresenceStyle }, { v: 'Dly', s: subPresenceStyle }, { v: 'Emg', s: subPresenceStyle }, { v: 'Unp', s: subPresenceStyle }, { v: 'Ann', s: subPresenceStyle }, '',
            { v: 'Peer', s: subAdminStyle }, { v: 'Team', s: subAdminStyle }, { v: 'Org', s: subAdminStyle }, { v: 'Comm', s: subAdminStyle }, { v: 'Rule', s: subAdminStyle }, '',
            { v: 'Qual', s: subExecStyle }, { v: 'Time', s: subExecStyle }, { v: 'Org', s: subExecStyle }, { v: 'Prob', s: subExecStyle }, { v: 'Pres', s: subExecStyle }, { v: 'Dev', s: subExecStyle }, '',
            { v: 'Rule', s: subCareStyle }, { v: 'Safe', s: subCareStyle }, { v: 'App', s: subCareStyle }, { v: 'Res', s: subCareStyle }, { v: 'Priv', s: subCareStyle }, '',
            '', '', ''
        ];

        // Format Data Rows
        const styledData = dataRows.map(row => row.map((val, idx) => {
            let s = baseStyle;
            if (idx >= 3 && idx <= 7) s = subPresenceStyle;
            else if (idx === 8) s = scorePresenceStyle;
            else if (idx >= 9 && idx <= 13) s = subAdminStyle;
            else if (idx === 14) s = scoreAdminStyle;
            else if (idx >= 15 && idx <= 20) s = subExecStyle;
            else if (idx === 21) s = scoreExecStyle;
            else if (idx >= 22 && idx <= 26) s = subCareStyle;
            else if (idx === 27) s = scoreCareStyle;
            else if (idx === 30) s = { ...baseStyle, font: { ...baseStyle.font, bold: true, sz: 11 } };
            
            // Numbers should be fixed to 1 decimal for consistency if they are numbers
            let displayVal = val;
            if (typeof val === 'number') displayVal = val.toFixed(1);

            return { v: displayVal, s };
        }));

        const aoa = [h1, h2, ...styledData];
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);

        // Define Merges
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Staff ID
            { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Name
            { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Month
            { s: { r: 0, c: 3 }, e: { r: 0, c: 7 } }, // Presence
            { s: { r: 0, c: 9 }, e: { r: 0, c: 13 } }, // Admin
            { s: { r: 0, c: 15 }, e: { r: 0, c: 20 } }, // Exec
            { s: { r: 0, c: 22 }, e: { r: 0, c: 26 } }, // Care
            { s: { r: 0, c: 28 }, e: { r: 1, c: 28 } }, // Bonus
            { s: { r: 0, c: 29 }, e: { r: 1, c: 29 } }, // Training
            { s: { r: 0, c: 30 }, e: { r: 1, c: 30 } }, // Total
        ];

        // Column Widths (Compact Layout)
        const wscols = ArrayObject(h1.length, 6); // Default compact
        wscols[0] = { wch: 10 }; // ID
        wscols[1] = { wch: 25 }; // Name
        wscols[2] = { wch: 10 }; // Month
        wscols[28] = { wch: 15 }; // Bonus
        wscols[29] = { wch: 30 }; // Training
        wscols[30] = { wch: 10 }; // Total
        worksheet['!cols'] = wscols;

        return worksheet;
    }
};

function ArrayObject(len: number, w: number) {
    const arr = [];
    for (let i = 0; i < len; i++) arr.push({ wch: w });
    return arr;
}
