'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function PatientDetailsPage() {
    const { id } = useParams();
    const { token, loading, getAuthHeaders } = useAuth();
    const [patient, setPatient] = useState(null);
    const [vitals, setVitals] = useState([]);
    const [medications, setMedications] = useState([]);
    const [medicationLogs, setMedicationLogs] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [careLogs, setCareLogs] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [administeringMed, setAdministeringMed] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const intervalRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const headers = getAuthHeaders();
            const [patientRes, vitalsRes, medsRes, aptRes, logsRes, medLogsRes] = await Promise.all([
                fetch(`/api/patients/${id}`, { headers }),
                fetch(`/api/patients/${id}/vitals?limit=5`, { headers }),
                fetch(`/api/patients/${id}/medications`, { headers }),
                fetch(`/api/appointments?patient_id=${id}`, { headers }),
                fetch(`/api/patients/${id}/care-logs?limit=5`, { headers }),
                fetch(`/api/patients/${id}/medication-logs?limit=20`, { headers })
            ]);

            const patientData = await patientRes.json();
            const vitalsData = await vitalsRes.json();
            const medsData = await medsRes.json();
            const aptData = await aptRes.json();
            const logsData = await logsRes.json();
            const medLogsData = await medLogsRes.json();

            setPatient(patientData.patient);
            setVitals(vitalsData.vitals || []);
            setMedications(medsData.medications || []);
            setAppointments(aptData.appointments || []);
            setCareLogs(logsData.care_logs || []);
            setMedicationLogs(medLogsData.medication_logs || []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch patient data', err);
        } finally {
            setDataLoading(false);
        }
    }, [id, getAuthHeaders]);

    useEffect(() => {
        if (!token || loading || !id) return;
        fetchData();
    }, [token, loading, id, fetchData]);

    // Real-time updates every 15 seconds
    useEffect(() => {
        if (!token || !id) return;
        intervalRef.current = setInterval(fetchData, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, id, fetchData]);

    const administerMedication = async (med) => {
        setAdministeringMed(med.id);
        try {
            await fetch(`/api/patients/${id}/medication-logs`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    medication_id: med.id,
                    administered_at: new Date().toISOString(),
                    dosage_given: med.dosage,
                    notes: `Administered ${med.name} as prescribed`
                })
            });
            await fetchData();
        } catch (err) {
            console.error('Failed to log medication', err);
        }
        setAdministeringMed(null);
    };

    // Check if medication was administered today
    const getMedStatus = (med) => {
        const today = new Date().toDateString();
        const todayLogs = medicationLogs.filter(log =>
            log.medication_id === med.id &&
            new Date(log.administered_at).toDateString() === today
        );
        return todayLogs.length > 0 ? todayLogs[0] : null;
    };

    if (loading || dataLoading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading patient details...</p></div>;
    }

    if (!patient) {
        return <div className={styles.error}><h2>Patient not found</h2><Link href="/patients">Back to Patients</Link></div>;
    }

    const latestVitals = vitals[0];
    const upcomingApts = appointments.filter(a => new Date(a.scheduled_at) > new Date());

    // Separate medications into administered and pending
    const administeredToday = medications.filter(med => getMedStatus(med));
    const pendingToday = medications.filter(med => !getMedStatus(med));

    return (
        <div className={`page ${styles.detailsPage}`}>
            {/* Header */}
            <header className={styles.header}>
                <Link href="/patients" className={styles.backLink}><Icons.ArrowLeft size={16} /> Back to Patients</Link>
                <div className={styles.patientHeader}>
                    <div className={styles.avatar}>{patient.name?.charAt(0)}</div>
                    <div>
                        <h1>{patient.name}</h1>
                        <p className={styles.condition}>{patient.condition}</p>
                        <span className="badge badge-info">{patient.date_of_birth}</span>
                    </div>
                    <div className={styles.actions}>
                        <Link href={`/patients/${id}/history`} className="btn btn-secondary"><Icons.History size={16} /> Care History</Link>
                        <Link href={`/vitals?patient=${id}`} className="btn btn-primary"><Icons.Activity size={16} /> Record Vitals</Link>
                        <Link href={`/video?patient=${id}`} className="btn btn-secondary"><Icons.Video size={16} /> Video Call</Link>
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className={`grid grid-4 ${styles.statsGrid}`}>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statIcon}><Icons.Heart size={20} /></span>
                    <div>
                        <span className={styles.statValue}>{latestVitals?.heart_rate || '--'}</span>
                        <span className={styles.statLabel}>BPM</span>
                    </div>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statIcon}><Icons.Droplet size={20} /></span>
                    <div>
                        <span className={styles.statValue}>{latestVitals ? `${latestVitals.blood_pressure_systolic}/${latestVitals.blood_pressure_diastolic}` : '--'}</span>
                        <span className={styles.statLabel}>Blood Pressure</span>
                    </div>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statIcon}><Icons.Wind size={20} /></span>
                    <div>
                        <span className={styles.statValue}>{latestVitals?.oxygen_saturation || '--'}%</span>
                        <span className={styles.statLabel}>O2 Saturation</span>
                    </div>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statIcon}><Icons.Thermometer size={20} /></span>
                    <div>
                        <span className={styles.statValue}>{latestVitals?.temperature || '--'}°F</span>
                        <span className={styles.statLabel}>Temperature</span>
                    </div>
                </div>
            </div>

            {/* Medication Administration Section - Full Width */}
            <section className={`card ${styles.medicationSection}`}>
                <div className="card-header">
                    <h3><Icons.Pill size={18} /> Medication Administration - Today</h3>
                    <Link href={`/medications?patient=${id}`} className={styles.viewAll}>Manage Medications</Link>
                </div>

                <div className={styles.medGrid}>
                    {/* Pending Medications */}
                    <div className={styles.medColumn}>
                        <h4 className={styles.medColumnTitle}>
                            <span className={styles.pendingDot}></span>
                            Pending ({pendingToday.length})
                        </h4>
                        {pendingToday.length === 0 ? (
                            <p className={styles.allDone}><Icons.CheckCircle size={16} /> All medications administered!</p>
                        ) : (
                            <div className={styles.medList}>
                                {pendingToday.map((med) => (
                                    <div key={med.id} className={styles.medCard}>
                                        <div className={styles.medInfo}>
                                            <strong>{med.name}</strong>
                                            <span className={styles.medDosage}>{med.dosage}</span>
                                            <span className={styles.medTime}><Icons.Clock size={12} /> Scheduled: {med.time_of_day}</span>
                                            {med.instructions && <span className={styles.medInstructions}>{med.instructions}</span>}
                                        </div>
                                        <button
                                            onClick={() => administerMedication(med)}
                                            className="btn btn-primary"
                                            disabled={administeringMed === med.id}
                                        >
                                            {administeringMed === med.id ? 'Logging...' : 'Administer'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Administered Medications */}
                    <div className={styles.medColumn}>
                        <h4 className={styles.medColumnTitle}>
                            <span className={styles.doneDot}></span>
                            Administered ({administeredToday.length})
                        </h4>
                        {administeredToday.length === 0 ? (
                            <p className={styles.noneYet}>No medications administered yet</p>
                        ) : (
                            <div className={styles.medList}>
                                {administeredToday.map((med) => {
                                    const log = getMedStatus(med);
                                    return (
                                        <div key={med.id} className={`${styles.medCard} ${styles.administered}`}>
                                            <div className={styles.medInfo}>
                                                <strong>{med.name}</strong>
                                                <span className={styles.medDosage}>{log?.dosage_given || med.dosage}</span>
                                                <span className={styles.medTime}>
                                                    <Icons.Check size={12} /> Given at: {new Date(log?.administered_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={styles.medBy}>by {log?.caregiver_name || 'Caregiver'}</span>
                                            </div>
                                            <span className={`badge badge-success ${styles.doneBadge}`}><Icons.Check size={12} /> Done</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Today's Medication Log */}
                {medicationLogs.length > 0 && (
                    <div className={styles.medLogSection}>
                        <h4><Icons.FileText size={16} /> Administration Log</h4>
                        <table className={styles.logTable}>
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Medication</th>
                                    <th>Dosage</th>
                                    <th>Administered By</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {medicationLogs.slice(0, 10).map((log) => (
                                    <tr key={log.id}>
                                        <td>{new Date(log.administered_at).toLocaleString()}</td>
                                        <td>{log.medication_name}</td>
                                        <td>{log.dosage_given}</td>
                                        <td>{log.caregiver_name}</td>
                                        <td>{log.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <div className={`grid grid-2 ${styles.mainGrid}`}>
                {/* Left Column */}
                <div>
                    {/* Condition Details */}
                    <section className="card">
                        <h3><Icons.Info size={18} /> Condition Details</h3>
                        <p className={styles.conditionNotes}>{patient.condition_notes || 'No additional notes'}</p>
                        <div className={styles.contactInfo}>
                            <strong><Icons.Phone size={14} /> Emergency Contact:</strong>
                            <p>{patient.emergency_contact_name} - {patient.emergency_contact_phone}</p>
                        </div>
                    </section>

                    {/* Vitals History */}
                    <section className="card">
                        <div className="card-header">
                            <h3><Icons.Activity size={18} /> Recent Vitals</h3>
                            <Link href={`/vitals?patient=${id}`} className={styles.viewAll}>View All</Link>
                        </div>
                        <div className={styles.vitalsHistory}>
                            {vitals.map((v) => (
                                <div key={v.id} className={styles.vitalRow}>
                                    <span className={styles.vitalTime}>{new Date(v.recorded_at).toLocaleDateString()}</span>
                                    <span>HR: {v.heart_rate}</span>
                                    <span>BP: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}</span>
                                    <span>O2: {v.oxygen_saturation}%</span>
                                </div>
                            ))}
                            {vitals.length === 0 && <p className={styles.noData}>No vitals recorded</p>}
                        </div>
                    </section>
                </div>

                {/* Right Column */}
                <div>
                    {/* Upcoming Appointments */}
                    <section className="card">
                        <div className="card-header">
                            <h3><Icons.Calendar size={18} /> Upcoming Appointments</h3>
                            <Link href="/appointments" className={styles.viewAll}>Schedule</Link>
                        </div>
                        <div className={styles.aptList}>
                            {upcomingApts.slice(0, 3).map((apt) => (
                                <div key={apt.id} className={styles.aptItem}>
                                    <div className={styles.aptDate}>
                                        <span>{new Date(apt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        <span>{new Date(apt.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div>
                                        <strong>{apt.title}</strong>
                                        <p>{apt.duration_mins} mins</p>
                                    </div>
                                </div>
                            ))}
                            {upcomingApts.length === 0 && <p className={styles.noData}>No upcoming appointments</p>}
                        </div>
                    </section>

                    {/* Recent Care Logs */}
                    <section className="card">
                        <div className="card-header">
                            <h3><Icons.Clipboard size={18} /> Recent Care Logs</h3>
                            <Link href={`/care-logs?patient=${id}`} className={styles.viewAll}>Add Log</Link>
                        </div>
                        <div className={styles.logsList}>
                            {careLogs.map((log) => (
                                <div key={log.id} className={styles.logItem}>
                                    <div className={styles.logHeader}>
                                        <span className={styles.logType}>{log.log_type}</span>
                                        <span className={styles.logTime}>{new Date(log.recorded_at).toLocaleDateString()}</span>
                                    </div>
                                    <p>{log.details?.substring(0, 100)}{log.details?.length > 100 ? '...' : ''}</p>
                                </div>
                            ))}
                            {careLogs.length === 0 && <p className={styles.noData}>No care logs</p>}
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section className="card">
                        <h3><Icons.Settings size={18} /> Quick Actions</h3>
                        <div className={styles.quickActions}>
                            <Link href={`/patients/${id}/history`} className="btn btn-secondary"><Icons.History size={16} /> Full Care History</Link>
                            <Link href={`/vitals?patient=${id}`} className="btn btn-secondary"><Icons.Activity size={16} /> Record Vitals</Link>
                            <Link href={`/care-logs?patient=${id}`} className="btn btn-secondary"><Icons.FileText size={16} /> Add Care Log</Link>
                            <Link href={`/medications?patient=${id}`} className="btn btn-secondary"><Icons.Pill size={16} /> Manage Meds</Link>
                            <Link href="/emergency" className="btn btn-primary"><Icons.AlertTriangle size={16} /> Emergency</Link>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
