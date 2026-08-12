import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';

// import api from '../services/apiClient';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    isAdmin: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    updateCurrentUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    loading: true,
    isAdmin: false,
    login: () => { },
    logout: () => { },
    updateCurrentUser: () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');

            if (token && savedUser) {
                try {
                    // Verify token with backend to catch expired/invalid tokens
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
                    const response = await fetch(`${apiUrl}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.user) {
                            setCurrentUser(data.user);
                            localStorage.setItem('user', JSON.stringify(data.user));
                        } else {
                            setCurrentUser(JSON.parse(savedUser));
                        }
                    } else if (response.status === 401) {
                        // Token is definitely invalid - clear
                        console.warn('[Auth] Token unauthorized, clearing session.');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                    } else {
                        // For 403 or others, maybe server is in a weird state? 
                        // Let's trust the local user for now if we can't verify 100%
                        console.warn(`[Auth] Verification returned ${response.status}. Keeping local session.`);
                        setCurrentUser(JSON.parse(savedUser));
                    }
                } catch (error) {
                    // Network error (server not running) - keep user logged in locally
                    console.warn('[Auth] Could not verify token against server (network error). Keeping local session.');
                    setCurrentUser(JSON.parse(savedUser));
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = (token: string, user: User) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setCurrentUser(user);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        window.location.href = '/login';
    };

    // Merge a partial update into the current user and persist it (e.g. after
    // saving a signature) so the change is reflected without a re-login.
    const updateCurrentUser = (patch: Partial<User>) => {
        setCurrentUser(prev => {
            if (!prev) return prev;
            const next = { ...prev, ...patch };
            localStorage.setItem('user', JSON.stringify(next));
            return next;
        });
    };

    const isAdmin = currentUser?.role === 'SUPER_ADMIN';

    return (
        <AuthContext.Provider value={{ currentUser, loading, isAdmin, login, logout, updateCurrentUser }}>
            {children}
        </AuthContext.Provider>
    );
};
