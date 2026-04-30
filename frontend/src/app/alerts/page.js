'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import styles from './page.module.css';

const alertIcons = { medication: 'Rx', vital: 'HR', appointment: 'Cal', emergency: '!', system: '*' };

export default function AlertsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [alerts, setAlerts] = useState([]);
    const intervalRef = useRef(null);

    const fetchAlerts = useCallback(async () => {
        try {
            const res = await fetch('/api/alerts', { headers: getAuthHeaders() });
            const data = await res.json();
            setAlerts(data.alerts || []);
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchAlerts();
    }, [token, loading, fetchAlerts]);

    // Real-time updates every 10 seconds
    useEffect(() => {
        if (!token) return;
        intervalRef.current = setInterval(fetchAlerts, 10000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchAlerts]);

    const markRead = async (id) => {
        await fetch(`/api/alerts/${id}/read`, { method: 'PUT', headers: getAuthHeaders() });
        const res = await fetch('/api/alerts', { headers: getAuthHeaders() });
        const data = await res.json();
        setAlerts(data.alerts || []);
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    const unread = alerts.filter(a => !a.is_read);
    const read = alerts.filter(a => a.is_read);

    return (
        <div className={`page ${styles.alertsPage}`}>
            <header className={styles.header}><h1>Alerts</h1><p>{unread.length} unread alerts</p></header>

            {unread.length > 0 && (
                <div className={styles.sectionBlock}>
                    <h2 className={styles.sectionTitle}>Unread</h2>
                    <div className={styles.alertsList}>
                        {unread.map((alert) => (
                            <div key={alert.id} className={`card ${styles.alertCard} ${styles[alert.priority]}`}>
                                <span className={styles.alertIcon}>{alertIcons[alert.alert_type] || '*'}</span>
                                <div className={styles.alertContent}>
                                    <strong>{alert.title}</strong>
                                    <p>{alert.message}</p>
                                    <span className={styles.alertTime}>{new Date(alert.created_at).toLocaleString()}</span>
                                </div>
                                <button onClick={() => markRead(alert.id)} className="btn btn-secondary btn-sm">Mark Read</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.sectionBlock}>
                <h2 className={styles.sectionTitle}>All Alerts</h2>
                <div className={styles.alertsList}>
                    {read.map((alert) => (
                        <div key={alert.id} className={`card ${styles.alertCard} ${styles.read}`}>
                            <span className={styles.alertIcon}>{alertIcons[alert.alert_type] || '*'}</span>
                            <div className={styles.alertContent}>
                                <strong>{alert.title}</strong>
                                <p>{alert.message}</p>
                                <span className={styles.alertTime}>{new Date(alert.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                    {alerts.length === 0 && <p className={styles.noData}>No alerts</p>}
                </div>
            </div>
        </div>
    );
}
