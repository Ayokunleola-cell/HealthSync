'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function MedicationPage() {
    const { getAuthHeaders } = useAuth();
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        dose: '',
        time: ''
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/patient/patient1/medication', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/'), 2000);
            }
        } catch (err) {
            console.error('Failed to schedule medication', err);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className={`page ${styles.successPage}`}>
                <div className={styles.successCard}>
                    <span className={styles.successIcon}><Icons.CheckCircle size={48} /></span>
                    <h2>Medication Scheduled!</h2>
                    <p>Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`page ${styles.medicationPage}`}>
            <header className={styles.header}>
                <h1>Medication Scheduler</h1>
                <p>Schedule and manage medications</p>
            </header>

            <div className={`card ${styles.formCard}`}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Medication Name</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Aspirin"
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Dosage</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.dose}
                            onChange={(e) => setFormData({ ...formData, dose: e.target.value })}
                            placeholder="e.g., 100mg"
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Scheduled Time</label>
                        <input
                            type="time"
                            className="input"
                            value={formData.time}
                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            required
                        />
                    </div>

                    <div className={styles.formActions}>
                        <button
                            type="button"
                            onClick={() => router.push('/')}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Schedule Medication'}
                        </button>
                    </div>
                </form>
            </div>

            <div className={`card ${styles.infoCard}`}>
                <h3><Icons.AlertTriangle size={18} /> Important Reminders</h3>
                <ul>
                    <li>Take medications at the same time each day</li>
                    <li>Never skip doses without consulting your doctor</li>
                    <li>Store medications properly</li>
                    <li>Check expiration dates regularly</li>
                </ul>
            </div>
        </div>
    );
}
