'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext({
    user: null,
    token: null,
    login: async () => { },
    logout: () => { },
    loading: true,
    getAuthHeaders: () => ({}),
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Only run on client
        if (typeof window !== 'undefined') {
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                try {
                    setUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error('Failed to parse user data');
                }
            }
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const publicRoutes = ['/login', '/signup', '/register', '/forgot-password', '/reset-password'];
        if (!loading && !token && !publicRoutes.includes(pathname)) {
            router.push('/login');
        }
    }, [token, loading, pathname, router]);

    const login = async (username, password) => {
        try {
            const response = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Invalid credentials');
            }

            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setToken(data.access_token);
            setUser(data.user);

            // Redirect based on role
            const dashboardPath = getRoleDashboard(data.user.role);
            window.location.href = dashboardPath;

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        window.location.href = '/login';
    };

    const getAuthHeaders = () => ({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    });

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading, getAuthHeaders }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);

// Helper function to get role-specific dashboard
export function getRoleDashboard(role) {
    switch (role) {
        case 'admin':
            return '/admin';
        case 'patient':
            return '/patient';
        case 'caregiver':
            return '/';
        case 'physician':
            return '/physician';
        case 'family':
            return '/family';
        default:
            return '/';
    }
}
