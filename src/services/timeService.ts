import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TimeRecord } from '../types';

const TIME_COLLECTION = 'time_records';

export const timeService = {
    // Get records for a specific month (YYYY-MM)
    // Optional: filter by department if needed in future, currently unused so prefix with _
    async getTimeRecordsByMonth(month: string, _departmentId?: string): Promise<TimeRecord[]> {
        const q = query(
            collection(db, TIME_COLLECTION),
            where('month', '==', month)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as TimeRecord);
    },

    async getEmployeeTimeRecord(employeeId: string, month: string): Promise<TimeRecord | null> {
        const id = `${employeeId}_${month}`;
        const docRef = doc(db, TIME_COLLECTION, id);
        const snapshot = await getDocs(query(collection(db, TIME_COLLECTION), where('id', '==', id)));
        if (snapshot.empty) return null;
        return snapshot.docs[0].data() as TimeRecord;
    },

    async createOrUpdateTimeRecord(record: Partial<TimeRecord> & { employeeId: string, month: string }) {
        const id = `${record.employeeId}_${record.month}`;
        const docRef = doc(db, TIME_COLLECTION, id);
        await setDoc(docRef, {
            ...record,
            id,
            status: record.status || 'draft',
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }
};
