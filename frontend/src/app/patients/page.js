'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import Link from 'next/link';
import styles from './page.module.css';

export default function PatientsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        if (!token || loading) return;

        const fetchPatients = async () => {
            try {
                const headers = getAuthHeaders();
                const res = await fetch('/api/patients', { headers });
                const data = await res.json();

                // Fetch vitals for each patient
                const patientsWithVitals = await Promise.all(
                    (data.patients || []).map(async (patient) => {
                        const vitalsRes = await fetch(`/api/patients/${patient.id}/vitals?limit=1`, { headers });
                        const vitalsData = await vitalsRes.json();
                        return { ...patient, latestVitals: vitalsData.vitals?.[0] };
                    })
                );
                setPatients(patientsWithVitals);
            } catch (err) {
                console.error('Failed to fetch patients', err);
            } finally {
                setDataLoading(false);
            }
        };

        fetchPatients();
    }, [token, loading, getAuthHeaders]);

    if (loading || dataLoading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading patients...</p></div>;
    }

    return (
        <div className={`page ${styles.patientsPage}`}>
            <header className={styles.header}>
                <h1>Patients</h1>
                <p>Manage and monitor your patients</p>
            </header>

            <div className={styles.patientsList}>
                {patients.map((patient) => (
                    <div key={patient.id} className={`card ${styles.patientCard}`}>
                        <div className={styles.patientInfo}>
                            <div className={styles.avatar}>{patient.name?.charAt(0)}</div>
                            <div>
                                <h3>{patient.name}</h3>
                                <p>{patient.condition}</p>
                                <span className="badge badge-info">{patient.date_of_birth}</span>
                            </div>
                        </div>

                        {patient.latestVitals && (
                            <div className={styles.vitalsPreview}>
                                <span><Icons.Heart size={14} /> {patient.latestVitals.heart_rate} BPM</span>
                                <span><Icons.Droplet size={14} /> {patient.latestVitals.blood_pressure_systolic}/{patient.latestVitals.blood_pressure_diastolic}</span>
                                <span><Icons.Wind size={14} /> {patient.latestVitals.oxygen_saturation}%</span>
                            </div>
                        )}

                        <div className={styles.actions}>
                            <Link href={`/vitals?patient=${patient.id}`} className="btn btn-primary">Record Vitals</Link>
                            <Link href={`/care-logs?patient=${patient.id}`} className="btn btn-secondary">Add Care Log</Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
