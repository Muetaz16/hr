import api from './apiClient';
import type { PayrollResult } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';

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

    // Generate the official IPH Monthly (Efficiency) Evaluation Word form for one employee + month.
    async generateEvaluationDoc(employeeId: string, month: string): Promise<Blob> {
        const response = await api.get(`/payroll/evaluation-doc/${employeeId}/${month}`, { responseType: 'blob' });
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
                'Exceptional performance (%)': typeof r.exceptionalScore === 'number' ? `${r.exceptionalScore >= 0 ? '+' : ''}${r.exceptionalScore.toFixed(1)}%` : '0.0%',
                'Training (%)': typeof r.trainingScore === 'number' ? `+${r.trainingScore.toFixed(1)}%` : '0.0%',
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
                    'Exceptional performance (%)': typeof r.exceptionalScore === 'number' ? `${r.exceptionalScore >= 0 ? '+' : ''}${r.exceptionalScore.toFixed(1)}%` : '0.0%',
                    'Training (%)': typeof r.trainingScore === 'number' ? `+${r.trainingScore.toFixed(1)}%` : '0.0%',
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
                    typeof r.exceptionalScore === 'number' ? `${r.exceptionalScore >= 0 ? '+' : ''}${r.exceptionalScore.toFixed(1)}%` : '0.0%',
                    typeof r.trainingScore === 'number' ? `+${r.trainingScore.toFixed(1)}%${r.trainingSummary ? ' (' + r.trainingSummary + ')' : ''}` : '-',
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
        // Calculate dynamic values for KPI cards
        const totalScores = dataRows.map(r => Number(r[30])).filter(val => !isNaN(val));
        const avgScore = totalScores.length > 0 ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : 0;
        const excellentCount = totalScores.filter(s => s >= 90).length;

        // Styles cast to any to bypass strict nested property typing issues in xlsx-js-style
        const baseStyle: any = {
            font: { name: "Segoe UI", sz: 10, color: { rgb: "300A15" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: "F1ECE6" } },
                bottom: { style: 'thin', color: { rgb: "F1ECE6" } },
                left: { style: 'thin', color: { rgb: "F1ECE6" } },
                right: { style: 'thin', color: { rgb: "F1ECE6" } }
            }
        };

        const zebraStyle: any = {
            ...baseStyle,
            fill: { fgColor: { rgb: "FAF8F6" } }
        };

        const titleStyle: any = {
            font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "E3C4A2" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: "541C2C" } }
        };
        
        const metaStyle: any = {
            font: { name: "Segoe UI", sz: 10, italic: true, color: { rgb: "AA7A51" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: "FAF7F5" } }
        };

        const kpiLabelStyle: any = {
            font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: "AA7A51" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: "FDFCF7" } },
            border: {
                top: { style: 'thin', color: { rgb: "E3C4A2" } },
                left: { style: 'thin', color: { rgb: "E3C4A2" } },
                right: { style: 'thin', color: { rgb: "E3C4A2" } }
            }
        };

        const kpiValueStyle = (colorHex: string): any => ({
            font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: colorHex } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: "FDFCF7" } },
            border: {
                bottom: { style: 'thin', color: { rgb: "E3C4A2" } },
                left: { style: 'thin', color: { rgb: "E3C4A2" } },
                right: { style: 'thin', color: { rgb: "E3C4A2" } }
            }
        });

        const headerStyle: any = {
            ...baseStyle,
            font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "E3C4A2" } },
            fill: { fgColor: { rgb: "541C2C" } },
            border: {
                top: { style: 'thin', color: { rgb: "AA7A51" } },
                bottom: { style: 'thin', color: { rgb: "AA7A51" } },
                left: { style: 'thin', color: { rgb: "AA7A51" } },
                right: { style: 'thin', color: { rgb: "AA7A51" } }
            }
        };
        
        const presenceStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "AA7A51" } }, font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } } };
        const adminStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "541C2C" } }, font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "E3C4A2" } } };
        const execStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "AA7A51" } }, font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } } };
        const careStyle: any = { ...headerStyle, fill: { fgColor: { rgb: "541C2C" } }, font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "E3C4A2" } } };

        const subPresenceStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FAF7F5" } }, font: { name: "Segoe UI", sz: 8, bold: true, color: { rgb: "AA7A51" } } };
        const subAdminStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FBF8F5" } }, font: { name: "Segoe UI", sz: 8, bold: true, color: { rgb: "541C2C" } } };
        const subExecStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FAF7F5" } }, font: { name: "Segoe UI", sz: 8, bold: true, color: { rgb: "AA7A51" } } };
        const subCareStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FBF8F5" } }, font: { name: "Segoe UI", sz: 8, bold: true, color: { rgb: "541C2C" } } };

        const scorePresenceStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FDFCF7" } }, font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: "541C2C" } } };
        const scoreAdminStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FAF7F5" } }, font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: "AA7A51" } } };
        const scoreExecStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FDFCF7" } }, font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: "541C2C" } } };
        const scoreCareStyle: any = { ...baseStyle, fill: { fgColor: { rgb: "FAF7F5" } }, font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: "AA7A51" } } };

        // 1. Title Row
        const row1 = [{ v: "IPH HR SYSTEM - WORKFORCE PERFORMANCE PAYROLL REPORT", s: titleStyle }];
        for (let i = 1; i < 31; i++) row1.push({ v: "", s: titleStyle });
        
        // 2. Metadata Row
        const row2 = [{ v: `Report Context: Performance-Driven Payroll | Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')} | Total Records: ${dataRows.length}`, s: metaStyle }];
        for (let i = 1; i < 31; i++) row2.push({ v: "", s: metaStyle });
        
        // 3. Spacer Row
        const row3 = Array(31).fill({ v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });

        // 4. KPI Card Labels Row
        const row4 = Array(31).fill({ v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });
        row4[1] = { v: "TOTAL EMPLOYEES", s: kpiLabelStyle };
        row4[2] = { v: "", s: kpiLabelStyle };
        row4[3] = { v: "", s: kpiLabelStyle };
        row4[11] = { v: "AVERAGE PERFORMANCE SCORE", s: kpiLabelStyle };
        row4[12] = { v: "", s: kpiLabelStyle };
        row4[13] = { v: "", s: kpiLabelStyle };
        row4[21] = { v: "EXCELLENT PERFORMERS (>=90%)", s: kpiLabelStyle };
        row4[22] = { v: "", s: kpiLabelStyle };
        row4[23] = { v: "", s: kpiLabelStyle };

        // 5. KPI Card Values Row
        const row5 = Array(31).fill({ v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });
        row5[1] = { v: dataRows.length, s: kpiValueStyle("541C2C") };
        row5[2] = { v: "", s: kpiValueStyle("541C2C") };
        row5[3] = { v: "", s: kpiValueStyle("541C2C") };
        row5[11] = { v: `${avgScore.toFixed(2)}%`, s: kpiValueStyle("059669") };
        row5[12] = { v: "", s: kpiValueStyle("059669") };
        row5[13] = { v: "", s: kpiValueStyle("059669") };
        row5[21] = { v: excellentCount, s: kpiValueStyle("4F46E5") };
        row5[22] = { v: "", s: kpiValueStyle("4F46E5") };
        row5[23] = { v: "", s: kpiValueStyle("4F46E5") };

        // 6. Spacer Row
        const row6 = Array(31).fill({ v: "", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });

        // 7. Header Rows with Styles (Shifted by 6 rows)
        const h1 = [
            { v: 'Staff ID', s: headerStyle }, { v: 'Employee Name', s: headerStyle }, { v: 'Month', s: headerStyle },
            { v: 'Presence (20%)', s: presenceStyle }, '', '', '', '', { v: 'Score', s: presenceStyle },
            { v: 'Admin (25%)', s: adminStyle }, '', '', '', '', { v: 'Score', s: adminStyle },
            { v: 'Exec (40%)', s: execStyle }, '', '', '', '', '', { v: 'Score', s: execStyle },
            { v: 'Care (15%)', s: careStyle }, '', '', '', '', { v: 'Score', s: careStyle },
            { v: 'Exceptional %', s: headerStyle }, { v: 'Training %', s: headerStyle }, { v: 'Final Score', s: { ...headerStyle, font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "E3C4A2" } } } }
        ];

        const h2 = [
            '', '', '',
            { v: 'Abs', s: subPresenceStyle }, { v: 'Dly', s: subPresenceStyle }, { v: 'Emg', s: subPresenceStyle }, { v: 'Unp', s: subPresenceStyle }, { v: 'Ann', s: subPresenceStyle }, '',
            { v: 'Peer', s: subAdminStyle }, { v: 'Team', s: subAdminStyle }, { v: 'Org', s: subAdminStyle }, { v: 'Comm', s: subAdminStyle }, { v: 'Rule', s: subAdminStyle }, '',
            { v: 'Qual', s: subExecStyle }, { v: 'Time', s: subExecStyle }, { v: 'Org', s: subExecStyle }, { v: 'Prob', s: subExecStyle }, { v: 'Pres', s: subExecStyle }, { v: 'Dev', s: subExecStyle }, '',
            { v: 'Rule', s: subCareStyle }, { v: 'Safe', s: subCareStyle }, { v: 'App', s: subCareStyle }, { v: 'Res', s: subCareStyle }, { v: 'Priv', s: subCareStyle }, '',
            '', '', ''
        ];

        // Format Data Rows with Premium Overlays
        const styledData = dataRows.map((row, rIdx) => row.map((val, idx) => {
            let s = rIdx % 2 === 0 ? baseStyle : zebraStyle;
            
            if (idx >= 3 && idx <= 7) s = { ...s, ...subPresenceStyle, font: { ...s.font, ...subPresenceStyle.font } };
            else if (idx === 8) s = { ...s, ...scorePresenceStyle, font: { ...s.font, ...scorePresenceStyle.font } };
            else if (idx >= 9 && idx <= 13) s = { ...s, ...subAdminStyle, font: { ...s.font, ...subAdminStyle.font } };
            else if (idx === 14) s = { ...s, ...scoreAdminStyle, font: { ...s.font, ...scoreAdminStyle.font } };
            else if (idx >= 15 && idx <= 20) s = { ...s, ...subExecStyle, font: { ...s.font, ...subExecStyle.font } };
            else if (idx === 21) s = { ...s, ...scoreExecStyle, font: { ...s.font, ...scoreExecStyle.font } };
            else if (idx >= 22 && idx <= 26) s = { ...s, ...subCareStyle, font: { ...s.font, ...subCareStyle.font } };
            else if (idx === 27) s = { ...s, ...scoreCareStyle, font: { ...s.font, ...scoreCareStyle.font } };
            else if (idx === 30) {
                const numericVal = Number(val);
                if (!isNaN(numericVal)) {
                    if (numericVal >= 90) {
                        s = {
                            ...s,
                            fill: { fgColor: { rgb: "E6F4EA" } },
                            font: { ...s.font, bold: true, color: { rgb: "047857" } }
                        };
                    } else if (numericVal >= 80) {
                        s = {
                            ...s,
                            fill: { fgColor: { rgb: "F0FDFA" } },
                            font: { ...s.font, bold: true, color: { rgb: "0D9488" } }
                        };
                    } else if (numericVal < 50) {
                        s = {
                            ...s,
                            fill: { fgColor: { rgb: "FEF2F2" } },
                            font: { ...s.font, bold: true, color: { rgb: "B91C1C" } }
                        };
                    } else {
                        s = {
                            ...s,
                            font: { ...s.font, bold: true, color: { rgb: "541C2C" } }
                        };
                    }
                } else {
                    s = {
                        ...s,
                        font: { ...s.font, bold: true }
                    };
                }
            }

            // Left align employee name
            if (idx === 1) {
                s = { ...s, alignment: { horizontal: 'left', vertical: 'center' } };
            }
            
            // Numbers should be fixed to 1 decimal for consistency if they are numbers (except Staff ID and Month)
            let displayVal = val;
            if (typeof val === 'number' && idx !== 0) displayVal = val.toFixed(1);

            return { v: displayVal, s };
        }));

        const aoa = [row1, row2, row3, row4, row5, row6, h1, h2, ...styledData];
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);

        // Define Merges (All indexes shifted down by 6 rows!)
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 30 } }, // Title
            { s: { r: 1, c: 0 }, e: { r: 1, c: 30 } }, // Metadata
            { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } }, // KPI 1 Label
            { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } }, // KPI 1 Value
            { s: { r: 3, c: 11 }, e: { r: 3, c: 13 } }, // KPI 2 Label
            { s: { r: 4, c: 11 }, e: { r: 4, c: 13 } }, // KPI 2 Value
            { s: { r: 3, c: 21 }, e: { r: 3, c: 23 } }, // KPI 3 Label
            { s: { r: 4, c: 21 }, e: { r: 4, c: 23 } }, // KPI 3 Value
            
            { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // Staff ID
            { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } }, // Name
            { s: { r: 6, c: 2 }, e: { r: 7, c: 2 } }, // Month
            { s: { r: 6, c: 3 }, e: { r: 6, c: 7 } }, // Presence group
            { s: { r: 6, c: 9 }, e: { r: 6, c: 13 } }, // Admin group
            { s: { r: 6, c: 15 }, e: { r: 6, c: 20 } }, // Exec group
            { s: { r: 6, c: 22 }, e: { r: 6, c: 26 } }, // Care group
            { s: { r: 6, c: 28 }, e: { r: 7, c: 28 } }, // Bonus
            { s: { r: 6, c: 29 }, e: { r: 7, c: 29 } }, // Training
            { s: { r: 6, c: 30 }, e: { r: 7, c: 30 } }, // Total
        ];

        // Freeze panes split at the subheaders (Row 8)
        worksheet['!views'] = [{ state: 'frozen', ySplit: 8, xSplit: 2 }];

        // Column Widths (Compact Layout)
        const wscols = ArrayObject(h1.length, 6); // Default compact
        wscols[0] = { wch: 10 }; // ID
        wscols[1] = { wch: 25 }; // Name
        wscols[2] = { wch: 10 }; // Month
        wscols[28] = { wch: 12 }; // Exceptional %
        wscols[29] = { wch: 25 }; // Training %
        wscols[30] = { wch: 12 }; // Final Score
        worksheet['!cols'] = wscols;

        return worksheet;
    }
};

function ArrayObject(len: number, w: number) {
    const arr = [];
    for (let i = 0; i < len; i++) arr.push({ wch: w });
    return arr;
}
