import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Employee } from '../types';

const EMPLOYEES_COLLECTION = 'employees';

export const employeeService = {
    async getAllEmployees(): Promise<Employee[]> {
        const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    },

    async getEmployeesByDepartment(deptId: string): Promise<Employee[]> {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where('departmentId', '==', deptId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    },

    async getEmployeesByGroup(groupId: string): Promise<Employee[]> {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where('groupId', '==', groupId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    },

    async getEmployeeByEmail(email: string): Promise<Employee | null> {
        const q = query(collection(db, EMPLOYEES_COLLECTION), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Employee;
    },

    async createEmployee(emp: Omit<Employee, 'id'>) {
        await addDoc(collection(db, EMPLOYEES_COLLECTION), emp);
    },

    async updateEmployee(id: string, data: Partial<Employee>) {
        await updateDoc(doc(db, EMPLOYEES_COLLECTION, id), data);
    },

    async deleteEmployee(id: string) {
        await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
    }
};
