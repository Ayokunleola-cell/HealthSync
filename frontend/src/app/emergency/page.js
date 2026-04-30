'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function EmergencyPage() {
    const { token, getAuthHeaders } = useAuth();
    const router = useRouter();
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const sendEmergency = async () => {
        if (!confirm('Are you sure you want to send an EMERGENCY ALERT?\n\nThis will notify ALL caregivers, family members, and medical staff immediately.')) return;

        setSending(true);
        try {
            await fetch('/api/emergency', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ patient_id: 'pat_001', message: 'Emergency alert triggered! Immediate assistance required.' })
            });
            setSent(true);
        } catch (err) {
            alert('Failed to send alert. Please call emergency services directly!');
        }
        setSending(false);
    };

    if (sent) {
        return (
            <div className={`page ${styles.emergencyPage}`}>
                <div className={styles.sentCard}>
                    <span className={styles.checkIcon}><Icons.CheckCircle size={48} /></span>
                    <h1>Emergency Alert Sent!</h1>
                    <p>All caregivers and emergency contacts have been notified.</p>
                    <p>Help is on the way. Stay calm and wait for assistance.</p>
                    <button onClick={() => router.back()} className="btn btn-secondary"><Icons.ArrowLeft size={14} /> Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`page ${styles.emergencyPage}`}>
            <div className={styles.warningCard}>
                <span className={styles.warningIcon}><Icons.AlertTriangle size={48} /></span>
                <h1>Emergency Alert</h1>
                <p>Press the button below to immediately alert all caregivers, family members, and medical contacts.</p>
                <p className={styles.note}>Only use this in case of a real emergency.</p>
            </div>

            <button
                onClick={sendEmergency}
                disabled={sending}
                className={styles.emergencyButton}
            >
                <span className={styles.btnIcon}><Icons.AlertCircle size={32} /></span>
                <span className={styles.btnText}>{sending ? 'SENDING...' : 'SEND EMERGENCY ALERT'}</span>
            </button>

            <div className={styles.alternativeCard}>
                <h3>Alternative Emergency Contacts</h3>
                <p><strong>Emergency Services:</strong> 911</p>
                <p><strong>Primary Caregiver:</strong> Sarah Wilson - (555) 010-2</p>
                <p><strong>Primary Physician:</strong> Dr. James Smith - (555) 010-3</p>
            </div>
        </div>
    );
}
