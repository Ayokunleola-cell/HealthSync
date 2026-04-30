'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function MyAppointmentsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [appointments, setAppointments] = useState([]);

    useEffect(() => {
        if (!token || loading) return;
        const fetchData = async () => {
            const res = await fetch('/api/appointments', { headers: getAuthHeaders() });
            const data = await res.json();
            setAppointments((data.appointments || []).filter(a => new Date(a.scheduled_at) > new Date()));
        };
        fetchData();
    }, [token, loading, getAuthHeaders]);

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.aptPage}`}>
            <header className={styles.header}><h1><Icons.Calendar size={24} /> My Appointments</h1></header>

            <div className={styles.aptList}>
                {appointments.map((apt) => (
                    <div key={apt.id} className={styles.aptCard}>
                        <div className={styles.aptDate}>
                            <span className={styles.day}>{new Date(apt.scheduled_at).getDate()}</span>
                            <span className={styles.month}>{new Date(apt.scheduled_at).toLocaleDateString('en-US', { month: 'short' })}</span>
                        </div>
                        <div className={styles.aptInfo}>
                            <h2>{apt.title}</h2>
                            <p className={styles.time}><Icons.Clock size={14} /> {new Date(apt.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                ))}
                {appointments.length === 0 && <p className={styles.noData}>No upcoming appointments</p>}
            </div>
        </div>
    );
}
