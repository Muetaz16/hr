import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from '../types';
import { employeeService } from '../services/employeeService';
import { userService } from '../services/userService';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    loading: true,
    isAdmin: false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch extended user data from Firestore
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setCurrentUser(userDoc.data() as User);
                } else {
                    // Search for a matching Employee record to auto-promote
                    const employee = await employeeService.getEmployeeByEmail(user.email || '');
                    if (employee) {
                        const newUser: User = {
                            id: user.uid,
                            email: user.email || '',
                            role: employee.role,
                            fullName: employee.fullName,
                            groupId: employee.groupId,
                            departmentId: employee.departmentId
                        };
                        try {
                            await userService.syncUser(user.uid, newUser);
                        } catch (e) {
                            console.error("Failed to sync user role to Firestore:", e);
                        }
                        setCurrentUser(newUser);
                    } else {
                        // Fallback if no employee record found
                        setCurrentUser({
                            id: user.uid,
                            email: user.email || '',
                            role: 'EMPLOYEE',
                            fullName: user.displayName || 'User'
                        });
                    }
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const isAdmin = currentUser?.role === 'SUPER_ADMIN';

    return (
        <AuthContext.Provider value={{ currentUser, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};
