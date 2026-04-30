'use client';

import { useState, useEffect } from 'react';
import { AuthProvider } from './AuthProvider';
import { SocketProvider } from './SocketProvider';
import Sidebar from './Sidebar';

export default function ClientWrapper({ children }) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: '#0f1419',
                color: '#fff'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="#48bb78"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                    </div>
                    <p>Loading HealthSync...</p>
                </div>
            </div>
        );
    }

    return (
        <AuthProvider>
            <SocketProvider>
                <div className="app-container">
                    <Sidebar />
                    <main className="main-content">
                        {children}
                    </main>
                </div>
            </SocketProvider>
        </AuthProvider>
    );
}
