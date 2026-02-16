import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    updateDoc,
    deleteDoc,
    query,
    where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { User, UserRole } from '../types';

const USERS_COLLECTION = 'users';

export const userService = {
    // Create or Update user in Firestore (sync with Auth)
    async syncUser(uid: string, data: Partial<User>) {
        const userRef = doc(db, USERS_COLLECTION, uid);
        await setDoc(userRef, data, { merge: true });
    },

    async getUser(uid: string): Promise<User | null> {
        const userRef = doc(db, USERS_COLLECTION, uid);
        const snapshot = await getDoc(userRef);
        return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as User) : null;
    },

    async getAllUsers(): Promise<User[]> {
        const q = query(collection(db, USERS_COLLECTION));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    async getUsersByRole(role: UserRole): Promise<User[]> {
        const q = query(collection(db, USERS_COLLECTION), where('role', '==', role));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    },

    async updateUser(uid: string, data: Partial<User>) {
        if (!uid) throw new Error("User ID is required for update");

        // Remove undefined fields to prevent Firestore errors
        const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key as keyof User] = value;
            }
            return acc;
        }, {} as Partial<User>);

        const userRef = doc(db, USERS_COLLECTION, uid);
        await updateDoc(userRef, cleanData);
    },

    async deleteUser(uid: string) {
        const userRef = doc(db, USERS_COLLECTION, uid);
        await deleteDoc(userRef);
    }
};
