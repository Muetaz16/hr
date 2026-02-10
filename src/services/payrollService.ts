import {
    collection,
    getDocs,
    addDoc,
    query,
    where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { PayrollResult } from '../types';
import Papa from 'papaparse';

const PAYROLL_Collection = 'payroll_results';

export const payrollService = {
    async savePayrollResult(result: Omit<PayrollResult, 'id'>) {
        // Check if exists? usually one per month per emp
        // For simplicity just add
        await addDoc(collection(db, PAYROLL_Collection), result);
    },

    async getPayrollByMonth(month: string): Promise<PayrollResult[]> {
        const q = query(collection(db, PAYROLL_Collection), where('month', '==', month));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult));
    },

    async generateCSV(month: string): Promise<string> {
        const results = await this.getPayrollByMonth(month);

        // Transform for CSV
        const data = results.map(r => ({
            EmployeeID: r.employeeId,
            Month: r.month,
            TotalHours: r.totalHours,
            Overtime: r.overtime,
            Absences: r.absences,
            DeptScore: r.departmentScore,
            DirScore: r.directorScore,
            FinalScore: r.finalScore,
            FinalSalary: r.finalSalary,
            GeneratedAt: r.generatedAt
        }));

        return Papa.unparse(data);
    }
};
