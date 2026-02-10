import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Department, Group } from '../types';

const DEPTS_COLLECTION = 'departments';
const GROUPS_COLLECTION = 'groups';

export const departmentService = {
    async getAllDepartments(): Promise<Department[]> {
        const snapshot = await getDocs(collection(db, DEPTS_COLLECTION));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
    },

    async createDepartment(dept: Omit<Department, 'id'>) {
        await addDoc(collection(db, DEPTS_COLLECTION), dept);
    },

    async updateDepartment(id: string, data: Partial<Department>) {
        await updateDoc(doc(db, DEPTS_COLLECTION, id), data);
    },

    async deleteDepartment(id: string) {
        await deleteDoc(doc(db, DEPTS_COLLECTION, id));
    }
};

export const groupService = {
    async getAllGroups(): Promise<Group[]> {
        const snapshot = await getDocs(collection(db, GROUPS_COLLECTION));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
    },

    async createGroup(group: Omit<Group, 'id'>) {
        await addDoc(collection(db, GROUPS_COLLECTION), group);
    },

    async updateGroup(id: string, data: Partial<Group>) {
        await updateDoc(doc(db, GROUPS_COLLECTION, id), data);
    },

    async deleteGroup(id: string) {
        await deleteDoc(doc(db, GROUPS_COLLECTION, id));
    }
};
