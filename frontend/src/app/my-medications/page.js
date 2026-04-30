'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function MyMedicationsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [medications, setMedications] = useState([]);

    useEffect(() => {
        if (!token || loading) return;
        const fetchData = async () => {
            const pRes = await fetch('/api/patients', { headers: getAuthHeaders() });
            const pData = await pRes.json();
            if (pData.patients?.length > 0) {
                const mRes = await fetch(`/api/patients/${pData.patients[0].id}/medications`, { headers: getAuthHeaders() });
                const mData = await mRes.json();
                setMedications(mData.medications || []);
            }
        };
        fetchData();
    }, [token, loading, getAuthHeaders]);

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.medsPage}`}>
            <header className={styles.header}><h1><Icons.Pill size={24} /> My Medications</h1></header>

            <div className={styles.medsList}>
                {medications.map((med) => (
                    <div key={med.id} className={styles.medCard}>
                        <span className={styles.medIcon}><Icons.Pill size={24} /></span>
                        <div className={styles.medInfo}>
                            <h2>{med.name}</h2>
                            <p className={styles.dosage}>{med.dosage}</p>
                            <p className={styles.time}><Icons.Clock size={14} /> {med.time_of_day}</p>
                            {med.instructions && <p className={styles.instructions}>{med.instructions}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
