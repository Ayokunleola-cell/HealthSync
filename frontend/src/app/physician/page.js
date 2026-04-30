'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import Link from 'next/link';
import styles from './page.module.css';

export default function PhysicianDashboard() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const intervalRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const headers = getAuthHeaders();

            const [patientsRes, appointmentsRes] = await Promise.all([
                fetch('/api/patients', { headers }),
                fetch('/api/appointments', { headers })
            ]);

            const patientsData = await patientsRes.json();
            const appointmentsData = await appointmentsRes.json();

            setPatients(patientsData.patients || []);
            setAppointments(appointmentsData.appointments || []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setDataLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchData();
    }, [token, loading, fetchData]);

    // Real-time updates every 30 seconds
    useEffect(() => {
        if (!token) return;
        intervalRef.current = setInterval(fetchData, 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchData]);

    const upcomingAppointments = appointments
        .filter(apt => new Date(apt.scheduled_at) > new Date())
        .slice(0, 5);

    if (loading || dataLoading) {
        return (
            <div className={styles.loading}>
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className={`page ${styles.dashboard}`}>
            <header className={styles.header}>
                <div>
                    <h1>Welcome, {user?.full_name || 'Doctor'}</h1>
                    <p>Physician Dashboard - Patient Care Management</p>
                    {lastUpdated && <small className={styles.lastUpdated}>Last updated: {lastUpdated.toLocaleTimeString()}</small>}
                </div>
                <div className={styles.headerActions}>
                    <Link href="/appointments" className="btn btn-primary"><Icons.Calendar size={16} /> Schedule Appointment</Link>
                    <Link href="/medical-notes" className="btn btn-secondary"><Icons.Clipboard size={16} /> Add Medical Note</Link>
                </div>
            </header>

            <div className={`grid grid-3 ${styles.statsGrid}`}>
                <div className="card">
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}><Icons.Users size={24} /></span>
                        <div>
                            <span className="stat-value">{patients.length}</span>
                            <span className="stat-label">Patients</span>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}><Icons.Calendar size={24} /></span>
                        <div>
                            <span className="stat-value">{upcomingAppointments.length}</span>
                            <span className="stat-label">Upcoming Appointments</span>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}><Icons.Video size={24} /></span>
                        <div>
                            <span className="stat-value">Ready</span>
                            <span className="stat-label">Video Consult</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`grid grid-2 ${styles.mainGrid}`}>
                {/* Appointments Section */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Icons.Calendar size={18} /> Upcoming Appointments</h3>
                        <Link href="/appointments" className={styles.viewAll}>View All →</Link>
                    </div>

                    {upcomingAppointments.length > 0 ? (
                        <div className={styles.appointmentsList}>
                            {upcomingAppointments.map((apt) => (
                                <div key={apt.id} className={styles.appointmentItem}>
                                    <div className={styles.aptTime}>
                                        <span className={styles.aptDate}>
                                            {new Date(apt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className={styles.aptHour}>
                                            {new Date(apt.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className={styles.aptDetails}>
                                        <strong>{apt.title}</strong>
                                        <p>Duration: {apt.duration_mins} mins</p>
                                    </div>
                                    <Link href={apt.video_call_link || '/video'} className="btn btn-primary btn-sm">
                                        <Icons.Video size={14} /> Join
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.noData}>No upcoming appointments</p>
                    )}
                </div>

                {/* Patients Section */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Icons.Users size={18} /> My Patients</h3>
                        <Link href="/patients" className={styles.viewAll}>View All →</Link>
                    </div>

                    <div className={styles.patientsList}>
                        {patients.map((patient) => (
                            <div key={patient.id} className={styles.patientItem}>
                                <div className={styles.patientAvatar}>
                                    {patient.name?.charAt(0) || 'P'}
                                </div>
                                <div className={styles.patientInfo}>
                                    <strong>{patient.name}</strong>
                                    <p>{patient.condition}</p>
                                </div>
                                <Link href={`/patients/${patient.id}`} className="btn btn-secondary btn-sm">
                                    View
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <section className={styles.quickActions}>
                <h2>Quick Actions</h2>
                <div className={styles.actionsGrid}>
                    <Link href="/vitals" className={styles.actionCard}>
                        <Icons.Heart size={24} />
                        <span>Review Vitals</span>
                    </Link>
                    <Link href="/medical-notes" className={styles.actionCard}>
                        <Icons.Clipboard size={24} />
                        <span>Medical Notes</span>
                    </Link>
                    <Link href="/video" className={styles.actionCard}>
                        <Icons.Video size={24} />
                        <span>Video Consult</span>
                    </Link>
                    <Link href="/appointments" className={styles.actionCard}>
                        <Icons.Plus size={24} />
                        <span>New Appointment</span>
                    </Link>
                </div>
            </section>

            {/* Video Call Quick Access */}
            <section className={styles.quickActions}>
                <h2><Icons.Video size={20} /> Quick Video Calls</h2>
                <div className={styles.actionsGrid}>
                    <Link href="/video" className={styles.actionCard}>
                        <Icons.User size={24} />
                        <span>Call Patient</span>
                    </Link>
                    <Link href="/video" className={styles.actionCard}>
                        <Icons.Nurse size={24} />
                        <span>Call Caregiver</span>
                    </Link>
                    <Link href="/video" className={styles.actionCard}>
                        <Icons.Family size={24} />
                        <span>Call Family</span>
                    </Link>
                    <Link href="/video" className={styles.actionCard}>
                        <Icons.Calendar size={24} />
                        <span>Schedule Call</span>
                    </Link>
                </div>
            </section>

        </div>
    );
}
