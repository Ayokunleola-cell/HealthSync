'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import Link from 'next/link';
import styles from './page.module.css';

export default function PatientPortal() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [medications, setMedications] = useState([]);
    const [nextAppointment, setNextAppointment] = useState(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Update time every minute
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!token || loading) return;

        const fetchData = async () => {
            try {
                const headers = getAuthHeaders();

                // Get patients (for current user)
                const patientsRes = await fetch('/api/patients', { headers });
                const patientsData = await patientsRes.json();

                if (patientsData.patients?.length > 0) {
                    const pat = patientsData.patients[0];

                    const [medsRes, aptRes] = await Promise.all([
                        fetch(`/api/patients/${pat.id}/medications`, { headers }),
                        fetch(`/api/appointments?patient_id=${pat.id}`, { headers })
                    ]);

                    const medsData = await medsRes.json();
                    const aptData = await aptRes.json();

                    setMedications(medsData.medications || []);

                    // Get next upcoming appointment
                    const upcoming = (aptData.appointments || [])
                        .filter(apt => new Date(apt.scheduled_at) > new Date())
                        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
                    setNextAppointment(upcoming[0] || null);
                }
            } catch (err) {
                console.error('Failed to fetch data', err);
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
    }, [token, loading, getAuthHeaders]);

    const handleEmergency = async () => {
        if (confirm('Are you sure you want to send an EMERGENCY ALERT to all caregivers?')) {
            try {
                const headers = getAuthHeaders();
                await fetch('/api/emergency', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        patient_id: 'pat_001',
                        message: 'Emergency alert triggered by patient!'
                    })
                });
                alert('Emergency alert sent! Help is on the way.');
            } catch (err) {
                alert('Failed to send alert. Please call for help!');
            }
        }
    };

    if (loading || dataLoading) {
        return (
            <div className={styles.loading}>
                <div className="spinner"></div>
                <p className={styles.loadingText}>Loading...</p>
            </div>
        );
    }

    return (
        <div className={`page ${styles.patientPortal}`}>
            {/* Large Time Display */}
            <div className={styles.timeDisplay}>
                <span className={styles.time}>
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
                <span className={styles.date}>
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
            </div>

            {/* Greeting */}
            <h1 className={styles.greeting}>
                Hello, {user?.full_name?.split(' ')[0] || 'Friend'}!
            </h1>

            {/* Today's Medications */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}><Icons.Pill size={24} /> Today&apos;s Medications</h2>
                <div className={styles.medGrid}>
                    {medications.slice(0, 4).map((med) => (
                        <div key={med.id} className={styles.medCard}>
                            <span className={styles.medIcon}><Icons.Pill size={24} /></span>
                            <div className={styles.medInfo}>
                                <span className={styles.medName}>{med.name}</span>
                                <span className={styles.medDose}>{med.dosage}</span>
                                <span className={styles.medTime}>{med.time_of_day}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Next Appointment */}
            {nextAppointment && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}><Icons.Calendar size={24} /> Next Appointment</h2>
                    <div className={styles.appointmentCard}>
                        <div className={styles.aptInfo}>
                            <span className={styles.aptTitle}>{nextAppointment.title}</span>
                            <span className={styles.aptDateTime}>
                                {new Date(nextAppointment.scheduled_at).toLocaleDateString('en-US', {
                                    weekday: 'long', month: 'long', day: 'numeric'
                                })} at {new Date(nextAppointment.scheduled_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                        </div>
                    </div>
                </section>
            )}

            {/* Large Action Buttons */}
            <div className={styles.actionButtons}>
                <Link href="/my-medications" className={styles.actionBtn}>
                    <span className={styles.actionIcon}><Icons.Pill size={32} /></span>
                    <span className={styles.actionLabel}>MEDICATIONS</span>
                </Link>
                <Link href="/my-appointments" className={styles.actionBtn}>
                    <span className={styles.actionIcon}><Icons.Calendar size={32} /></span>
                    <span className={styles.actionLabel}>APPOINTMENTS</span>
                </Link>
            </div>

            {/* Emergency Button */}
            <button onClick={handleEmergency} className={styles.emergencyBtn}>
                <span className={styles.emergencyIcon}><Icons.AlertCircle size={32} /></span>
                <span className={styles.emergencyText}>EMERGENCY</span>
                <span className={styles.emergencySubtext}>Press for Help</span>
            </button>

            {/* Caregiver Info */}
            <div className={styles.caregiverInfo}>
                <p>Your caregiver: <strong>Sarah Wilson</strong></p>
                <p><Icons.Phone size={14} /> If you need help, press the red button above</p>
            </div>
        </div>
    );
}
