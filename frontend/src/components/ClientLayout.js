'use client';

import { AuthProvider } from './AuthProvider';
import Sidebar from './Sidebar';

export default function ClientLayout({ children }) {
    return (
        <AuthProvider>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </AuthProvider>
    );
}
