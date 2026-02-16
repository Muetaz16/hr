import {
    collection,
    getDocs,
    // addDoc removed
    query,
    where,
    deleteDoc,
    doc,
    setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PayrollResult } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const PAYROLL_Collection = 'payroll_results';

export const payrollService = {
    async savePayrollResult(result: Omit<PayrollResult, 'id'>) {
        // Enforce uniqueness: One report per employee per month
        const id = `${result.employeeId}_${result.month}`;
        await setDoc(doc(db, PAYROLL_Collection, id), { ...result, id }, { merge: true });
    },

    async deletePayrollResult(id: string) {
        await deleteDoc(doc(db, PAYROLL_Collection, id));
    },

    async getPayrollByMonth(month: string): Promise<PayrollResult[]> {
        const q = query(collection(db, PAYROLL_Collection), where('month', '==', month));
        // ...
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult));
    },

    async generateCSV(month: string): Promise<string> {
        const results = await this.getPayrollByMonth(month);

        // Fetch employees for names/IDs
        const employeesSnapshot = await getDocs(collection(db, 'employees'));
        const empMap = new Map(employeesSnapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as any]));

        const data = results.map(r => {
            const emp = empMap.get(r.employeeId);
            return {
                'Staff ID': emp?.staffId || 'N/A',
                'Employee Name': emp?.fullName || 'Unknown',
                'Month': r.month,

                // User Requested Columns
                'Presence': r.hrPresenceScore ? ((r.hrPresenceScore / 100) * 20).toFixed(2) : '0.00',
                'Administrative Behavior': r.adminScore?.toFixed(2) || '0.00',
                'Executive': r.executiveScore?.toFixed(2) || '0.00',
                'Care and discipline': r.careScore?.toFixed(2) || '0.00',
                'Exceptional performance': r.personnelBonusDays ? `+${r.personnelBonusDays} days` : '0',
                'Training and Education': r.trainingSummary || '',

                'Total': r.finalScore.toFixed(2)
            };
        });

        return Papa.unparse(data);
    },

    async generateSixMonthCSV(endMonth: string): Promise<string> {
        // Calculate last 6 months
        const months = [];
        let [year, month] = endMonth.split('-').map(Number);

        for (let i = 0; i < 6; i++) {
            months.push(`${year}-${String(month).padStart(2, '0')}`);
            month--;
            if (month === 0) {
                month = 12;
                year--;
            }
        }

        // Fetch all data
        const allResults: any[] = [];
        const employeesSnapshot = await getDocs(collection(db, 'employees'));
        const empMap = new Map(employeesSnapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as any]));

        for (const m of months) {
            const results = await this.getPayrollByMonth(m);
            const monthData = results.map(r => {
                const emp = empMap.get(r.employeeId);
                return {
                    'Staff ID': emp?.staffId || 'N/A',
                    'Employee Name': emp?.fullName || 'Unknown',
                    'Month': r.month,

                    'Presence': r.hrPresenceScore ? ((r.hrPresenceScore / 100) * 20).toFixed(2) : '0.00',
                    'Administrative Behavior': r.adminScore?.toFixed(2) || '0.00',
                    'Executive': r.executiveScore?.toFixed(2) || '0.00',
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
        // Calculate last 6 months
        const months = [];
        let [year, month] = endMonth.split('-').map(Number);

        for (let i = 0; i < 6; i++) {
            months.push(`${year}-${String(month).padStart(2, '0')}`);
            month--;
            if (month === 0) {
                month = 12;
                year--;
            }
        }

        // Fetch all data
        const allResults: any[] = [];
        const employeesSnapshot = await getDocs(collection(db, 'employees'));
        const empMap = new Map(employeesSnapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as any]));

        for (const m of months) {
            const results = await this.getPayrollByMonth(m);
            const monthData = results.map(r => {
                const emp = empMap.get(r.employeeId);
                return {
                    'Staff ID': emp?.staffId || 'N/A',
                    'Employee Name': emp?.fullName || 'Unknown',
                    'Month': r.month,

                    'Presence (20%)': r.hrPresenceScore ? ((r.hrPresenceScore / 100) * 20) : 0,
                    'Admin Behavior (25%)': r.adminScore || 0,
                    'Executive (40%)': r.executiveScore || 0,
                    'Care & Discipline (15%)': r.careScore || 0,
                    'Exceptional Bonus': r.personnelBonusDays ? `+${r.personnelBonusDays} days` : '-',
                    'Training Summary': r.trainingSummary || '-',

                    'Total Score': r.finalScore
                };
            });
            allResults.push(...monthData);
        }

        // Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(allResults);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "6-Month Report");

        // Style Columns (Width)
        const wscols = [
            { wch: 15 }, // Staff ID
            { wch: 25 }, // Employee Name
            { wch: 10 }, // Month
            { wch: 15 }, // Presence
            { wch: 20 }, // Admin
            { wch: 15 }, // Exec
            { wch: 20 }, // Care
            { wch: 20 }, // Bonus
            { wch: 30 }, // Training
            { wch: 10 }, // Total
        ];
        worksheet['!cols'] = wscols;

        // Generate Blob
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    },

    async generateMonthlyExcel(month: string): Promise<Blob> {
        // Fetch only specific month data
        const results = await this.getPayrollByMonth(month);

        // Fetch employees
        const employeesSnapshot = await getDocs(collection(db, 'employees'));
        const empMap = new Map(employeesSnapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as any]));

        const monthData = results.map(r => {
            const emp = empMap.get(r.employeeId);
            return {
                'Staff ID': emp?.staffId || 'N/A',
                'Employee Name': emp?.fullName || 'Unknown',
                'Month': r.month,

                'Presence (20%)': r.hrPresenceScore ? ((r.hrPresenceScore / 100) * 20) : 0,
                'Admin Behavior (25%)': r.adminScore || 0,
                'Executive (40%)': r.executiveScore || 0,
                'Care & Discipline (15%)': r.careScore || 0,
                'Exceptional Bonus': r.personnelBonusDays ? `+${r.personnelBonusDays} days` : '-',
                'Training Summary': r.trainingSummary || '-',

                'Total Score': r.finalScore
            };
        });

        // Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(monthData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Report ${month}`);

        // Style Columns (Width)
        const wscols = [
            { wch: 15 }, // Staff ID
            { wch: 25 }, // Employee Name
            { wch: 10 }, // Month
            { wch: 15 }, // Presence
            { wch: 20 }, // Admin
            { wch: 15 }, // Exec
            { wch: 20 }, // Care
            { wch: 20 }, // Bonus
            { wch: 30 }, // Training
            { wch: 10 }, // Total
        ];
        worksheet['!cols'] = wscols;

        // Generate Blob
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
};
