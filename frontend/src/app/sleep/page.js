'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function SleepPage() {
    const { getAuthHeaders } = useAuth();
    const router = useRouter();
    const [formData, setFormData] = useState({
        duration: '',
        awakenings: '',
        heart_rate: ''
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/patient/patient1/sleep', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    duration: parseFloat(formData.duration),
                    awakenings: parseInt(formData.awakenings),
                    heart_rate: parseInt(formData.heart_rate)
                })
            });

            if (response.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/'), 2000);
            }
        } catch (err) {
            console.error('Failed to update sleep', err);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className={`page ${styles.successPage}`}>
                <div className={styles.successCard}>
                    <span className={styles.successIcon}><Icons.CheckCircle size={48} /></span>
                    <h2>Sleep Data Recorded!</h2>
                    <p>Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`page ${styles.sleepPage}`}>
            <header className={styles.header}>
                <h1>Sleep Tracker</h1>
                <p>Record your sleep data for analysis</p>
            </header>

            <div className={`card ${styles.formCard}`}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Sleep Duration (hours)</label>
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            className="input"
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                            placeholder="e.g., 7.5"
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Number of Awakenings</label>
                        <input
                            type="number"
                            min="0"
                            max="20"
                            className="input"
                            value={formData.awakenings}
                            onChange={(e) => setFormData({ ...formData, awakenings: e.target.value })}
                            placeholder="e.g., 2"
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Average Heart Rate (BPM)</label>
                        <input
                            type="number"
                            min="40"
                            max="120"
                            className="input"
                            value={formData.heart_rate}
                            onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })}
                            placeholder="e.g., 62"
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
                            {loading ? 'Saving...' : 'Record Sleep'}
                        </button>
                    </div>
                </form>
            </div>

            <div className={`card ${styles.tipsCard}`}>
                <h3><Icons.Info size={18} /> Sleep Tips</h3>
                <ul>
                    <li>Aim for 7-9 hours of sleep each night</li>
                    <li>Keep a consistent sleep schedule</li>
                    <li>Avoid screens 1 hour before bed</li>
                    <li>Keep your room cool and dark</li>
                </ul>
            </div>
        </div>
    );
}
