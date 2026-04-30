'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import styles from './page.module.css';

export default function AdminPatientsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);

    useEffect(() => {
        if (!token || loading) return;
        const fetchPatients = async () => {
            const res = await fetch('/api/admin/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            setPatients(data.patients || []);
        };
        fetchPatients();
    }, [token, loading, getAuthHeaders]);

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.patientsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1>All Patients</h1>
                    <p>{patients.length} registered patients</p>
                </div>
            </header>

            <div className="card">
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Condition</th>
                            <th>Date of Birth</th>
                            <th>Emergency Contact</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map((patient) => (
                            <tr key={patient.id}>
                                <td><strong>{patient.name}</strong></td>
                                <td>{patient.condition || '-'}</td>
                                <td>{patient.date_of_birth || '-'}</td>
                                <td>{patient.emergency_contact_name || '-'}</td>
                                <td>
                                    <Link href={`/patients/${patient.id}`} className="btn btn-secondary btn-sm">
                                        View Details
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {patients.length === 0 && (
                            <tr><td colSpan="5" className={styles.noData}>No patients registered</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
