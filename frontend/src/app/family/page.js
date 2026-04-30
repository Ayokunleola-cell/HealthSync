'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function FamilyDashboard() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [patient, setPatient] = useState(null);
    const [vitals, setVitals] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        if (!token || loading) return;

        const fetchData = async () => {
            try {
                const headers = getAuthHeaders();

                // Get patients (family member has access to)
                const patientsRes = await fetch('/api/patients', { headers });
                const patientsData = await patientsRes.json();

                if (patientsData.patients?.length > 0) {
                    const pat = patientsData.patients[0];
                    setPatient(pat);

                    // Fetch patient details
                    const [vitalsRes, aptRes, alertsRes] = await Promise.all([
                        fetch(`/api/patients/${pat.id}/vitals?limit=1`, { headers }),
                        fetch(`/api/appointments?patient_id=${pat.id}`, { headers }),
                        fetch('/api/alerts', { headers })
                    ]);

                    const vitalsData = await vitalsRes.json();
                    const aptData = await aptRes.json();
                    const alertsData = await alertsRes.json();

                    setVitals(vitalsData.vitals?.[0]);
                    setAppointments(aptData.appointments || []);
                    setAlerts(alertsData.alerts || []);
                }
            } catch (err) {
                console.error('Failed to fetch data', err);
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
    }, [token, loading, getAuthHeaders]);

    if (loading || dataLoading) {
        return (
            <div className={styles.loading}>
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    const upcomingApts = appointments.filter(apt => new Date(apt.scheduled_at) > new Date()).slice(0, 3);
    const unreadAlerts = alerts.filter(a => !a.is_read);

    return (
        <div className={`page ${styles.dashboard}`}>
            <header className={styles.header}>
                <div>
                    <h1>Welcome, {user?.full_name || 'Family Member'}</h1>
                    <p>Family Dashboard - Monitor {patient?.name || 'Loved One'}&apos;s Health</p>
                </div>
            </header>

            {/* Alert Banner */}
            {unreadAlerts.length > 0 && (
                <div className={styles.alertBanner}>
                    <span className={styles.alertIcon}><Icons.Bell size={18} /></span>
                    <span>You have {unreadAlerts.length} unread alert(s)</span>
                    <Link href="/alerts">View Alerts</Link>
                </div>
            )}

            {/* Patient Status Card */}
            {patient && (
                <div className={`card ${styles.patientCard}`}>
                    <div className={styles.patientHeader}>
                        <div className={styles.patientPhoto}>
                            {patient.name?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h2>{patient.name}</h2>
                            <p className={styles.condition}>{patient.condition}</p>
                        </div>
                        <span className={`badge badge-success ${styles.statusBadge}`}>Stable</span>
                    </div>

                    {vitals ? (
                        <div className={styles.vitalsOverview}>
                            <div className={styles.vitalCard}>
                                <span className={styles.vitalIcon}><Icons.Heart size={20} /></span>
                                <div>
                                    <span className={styles.vitalValue}>{vitals.heart_rate}</span>
                                    <span className={styles.vitalLabel}>BPM</span>
                                </div>
                            </div>
                            <div className={styles.vitalCard}>
                                <span className={styles.vitalIcon}><Icons.Droplet size={20} /></span>
                                <div>
                                    <span className={styles.vitalValue}>{vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic}</span>
                                    <span className={styles.vitalLabel}>Blood Pressure</span>
                                </div>
                            </div>
                            <div className={styles.vitalCard}>
                                <span className={styles.vitalIcon}><Icons.Thermometer size={20} /></span>
                                <div>
                                    <span className={styles.vitalValue}>{vitals.temperature}°F</span>
                                    <span className={styles.vitalLabel}>Temperature</span>
                                </div>
                            </div>
                            <div className={styles.vitalCard}>
                                <span className={styles.vitalIcon}><Icons.Wind size={20} /></span>
                                <div>
                                    <span className={styles.vitalValue}>{vitals.oxygen_saturation}%</span>
                                    <span className={styles.vitalLabel}>O2 Saturation</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className={styles.noData}>No recent vitals recorded</p>
                    )}

                    <p className={styles.lastUpdated}>
                        Last updated: {vitals ? new Date(vitals.recorded_at).toLocaleString() : 'N/A'}
                    </p>
                </div>
            )}

            <div className={`grid grid-2 ${styles.infoGrid}`}>
                {/* Upcoming Appointments */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Icons.Calendar size={18} /> Upcoming Appointments</h3>
                    </div>
                    {upcomingApts.length > 0 ? (
                        <div className={styles.aptList}>
                            {upcomingApts.map((apt) => (
                                <div key={apt.id} className={styles.aptItem}>
                                    <div className={styles.aptDate}>
                                        {new Date(apt.scheduled_at).toLocaleDateString('en-US', {
                                            weekday: 'short', month: 'short', day: 'numeric'
                                        })}
                                    </div>
                                    <div className={styles.aptTime}>
                                        {new Date(apt.scheduled_at).toLocaleTimeString('en-US', {
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </div>
                                    <div className={styles.aptTitle}>{apt.title}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.noData}>No upcoming appointments</p>
                    )}
                </div>

                {/* Caregiver Contact */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Icons.Nurse size={18} /> Care Team Contact</h3>
                    </div>
                    <div className={styles.contactInfo}>
                        <div className={styles.contactItem}>
                            <span>Sarah Wilson</span>
                            <span>Primary Caregiver</span>
                        </div>
                        <div className={styles.contactActions}>
                            <Link href="/video" className="btn btn-primary"><Icons.Video size={16} /> Video Call</Link>
                            <button className="btn btn-secondary"><Icons.Phone size={16} /> Call</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions for Video Calls */}
            <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                    <h3 className="card-title"><Icons.Video size={18} /> Quick Video Calls</h3>
                </div>
                <div className={styles.quickVideoActions}>
                    <Link href="/video" className={styles.videoActionCard}>
                        <span className={styles.videoIcon}><Icons.Nurse size={24} /></span>
                        <span>Call Caregiver</span>
                    </Link>
                    <Link href="/video" className={styles.videoActionCard}>
                        <span className={styles.videoIcon}><Icons.Doctor size={24} /></span>
                        <span>Call Physician</span>
                    </Link>
                    <Link href="/video" className={styles.videoActionCard}>
                        <span className={styles.videoIcon}><Icons.Calendar size={24} /></span>
                        <span>Schedule Call</span>
                    </Link>
                </div>
            </div>

            {/* Emergency Button */}
            <div className={styles.emergencySection}>
                <Link href="/emergency" className={styles.emergencyButton}>
                    <Icons.AlertTriangle size={20} /> EMERGENCY ALERT
                </Link>
                <p>Press to immediately alert all caregivers and emergency contacts</p>
            </div>
        </div>
    );
}
