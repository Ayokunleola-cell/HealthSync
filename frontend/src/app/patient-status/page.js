'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function PatientStatusPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [patient, setPatient] = useState(null);
    const [vitals, setVitals] = useState(null);
    const intervalRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.patients?.length > 0) {
                setPatient(data.patients[0]);
                const vitalsRes = await fetch(`/api/patients/${data.patients[0].id}/vitals?limit=1`, { headers: getAuthHeaders() });
                const vitalsData = await vitalsRes.json();
                setVitals(vitalsData.vitals?.[0]);
            }
        } catch (err) {
            console.error('Failed to fetch patient status:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchData();
    }, [token, loading, fetchData]);

    // Real-time updates every 15 seconds
    useEffect(() => {
        if (!token) return;
        intervalRef.current = setInterval(fetchData, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchData]);

    if (loading || !patient) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.statusPage}`}>
            <header className={styles.header}><h1><Icons.User size={24} /> Patient Status</h1><p>{patient.name}</p></header>

            <div className={`card ${styles.patientCard}`}>
                <h3>Current Condition</h3>
                <p>{patient.condition}</p>
                <p className={styles.notes}>{patient.condition_notes}</p>
            </div>

            <div className={`card ${styles.vitalsCard}`}>
                <h3>Latest Vitals</h3>
                {vitals ? (
                    <div className={styles.vitalsGrid}>
                        <div><span><Icons.Heart size={20} /></span><strong>{vitals.heart_rate}</strong><span>BPM</span></div>
                        <div><span><Icons.Droplet size={20} /></span><strong>{vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic}</strong><span>BP</span></div>
                        <div><span><Icons.Wind size={20} /></span><strong>{vitals.oxygen_saturation}%</strong><span>O2</span></div>
                        <div><span><Icons.Thermometer size={20} /></span><strong>{vitals.temperature}°F</strong><span>Temp</span></div>
                    </div>
                ) : <p>No vitals recorded</p>}
                {vitals && <p className={styles.updated}>Last updated: {new Date(vitals.recorded_at).toLocaleString()}</p>}
            </div>
        </div>
    );
}
