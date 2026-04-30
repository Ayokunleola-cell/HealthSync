'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function RemindersPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [reminders, setReminders] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const intervalRef = useRef(null);

    const fetchReminders = useCallback(async () => {
        try {
            const headers = getAuthHeaders();

            // Get patients first
            const patientsRes = await fetch('/api/patients', { headers });
            const patientsData = await patientsRes.json();
            const patients = patientsData.patients || [];

            if (patients.length === 0) {
                setDataLoading(false);
                return;
            }

            const allReminders = [];

            // Fetch data for each patient
            for (const patient of patients) {
                // Get medications as reminders
                const medsRes = await fetch(`/api/patients/${patient.id}/medications`, { headers });
                const medsData = await medsRes.json();

                (medsData.medications || []).forEach(med => {
                    // Add medication reminders based on time_of_day
                    const times = (med.time_of_day || 'Morning').split(',').map(t => t.trim());
                    times.forEach(time => {
                        allReminders.push({
                            id: `med-${med.id}-${time}`,
                            type: 'medication',
                            title: `Give ${med.name} (${med.dosage})`,
                            description: `${patient.name} - ${med.instructions || 'Take as directed'}`,
                            time: time,
                            priority: 'high',
                            patientId: patient.id,
                            patientName: patient.name
                        });
                    });
                });

                // Get today's appointments as reminders
                const aptsRes = await fetch(`/api/appointments?patient_id=${patient.id}`, { headers });
                const aptsData = await aptsRes.json();

                const today = new Date();
                const upcoming = (aptsData.appointments || []).filter(apt => {
                    const aptDate = new Date(apt.scheduled_at);
                    return aptDate > today && aptDate < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                });

                upcoming.forEach(apt => {
                    allReminders.push({
                        id: `apt-${apt.id}`,
                        type: 'appointment',
                        title: apt.title,
                        description: `${patient.name} - ${apt.duration_mins} mins`,
                        time: new Date(apt.scheduled_at).toLocaleString(),
                        priority: 'normal',
                        patientId: patient.id,
                        patientName: patient.name
                    });
                });

                // Add standard care reminders
                allReminders.push({
                    id: `vitals-${patient.id}`,
                    type: 'vitals',
                    title: 'Record vital signs',
                    description: `Check ${patient.name}'s vitals`,
                    time: 'Morning & Evening',
                    priority: 'normal',
                    patientId: patient.id,
                    patientName: patient.name
                });

                allReminders.push({
                    id: `activity-${patient.id}`,
                    type: 'activity',
                    title: 'Log daily activity',
                    description: `Record ${patient.name}'s daily activities`,
                    time: 'End of day',
                    priority: 'low',
                    patientId: patient.id,
                    patientName: patient.name
                });
            }

            setReminders(allReminders);
        } catch (err) {
            console.error('Failed to fetch reminders', err);
        } finally {
            setDataLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchReminders();
    }, [token, loading, fetchReminders]);

    // Real-time updates every 30 seconds
    useEffect(() => {
        if (!token) return;
        intervalRef.current = setInterval(fetchReminders, 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchReminders]);

    const getIcon = (type) => {
        switch (type) {
            case 'medication': return <Icons.Pill size={20} />;
            case 'appointment': return <Icons.Calendar size={20} />;
            case 'vitals': return <Icons.Heart size={20} />;
            case 'activity': return <Icons.FileText size={20} />;
            case 'sleep': return <Icons.Moon size={20} />;
            default: return <Icons.Bell size={20} />;
        }
    };

    const getPriorityClass = (priority) => {
        switch (priority) {
            case 'high': return 'badge-error';
            case 'normal': return 'badge-warning';
            default: return 'badge-info';
        }
    };

    const [completedIds, setCompletedIds] = useState(new Set());

    const handleComplete = (id) => {
        setCompletedIds(prev => new Set([...prev, id]));
    };

    const pendingReminders = reminders.filter(r => !completedIds.has(r.id));
    const completedReminders = reminders.filter(r => completedIds.has(r.id));

    // Group by type
    const medicationReminders = pendingReminders.filter(r => r.type === 'medication');
    const appointmentReminders = pendingReminders.filter(r => r.type === 'appointment');
    const otherReminders = pendingReminders.filter(r => !['medication', 'appointment'].includes(r.type));

    if (loading || dataLoading) {
        return (
            <div className={styles.loading}>
                <div className="spinner"></div>
                <p>Loading reminders...</p>
            </div>
        );
    }

    return (
        <div className={`page ${styles.remindersPage}`}>
            <header className={styles.header}>
                <h1><Icons.Bell size={24} /> Reminders</h1>
                <p>Your pending health tasks and reminders</p>
                <div className={styles.stats}>
                    <span className={styles.statItem}>
                        <strong>{pendingReminders.length}</strong> pending
                    </span>
                    <span className={styles.statItem}>
                        <strong>{completedReminders.length}</strong> completed today
                    </span>
                </div>
            </header>

            {pendingReminders.length === 0 ? (
                <div className={`card ${styles.emptyState}`}>
                    <span className={styles.emptyIcon}><Icons.Check size={40} /></span>
                    <h3>All caught up!</h3>
                    <p>You have no pending reminders.</p>
                </div>
            ) : (
                <>
                    {/* Medication Reminders - High Priority */}
                    {medicationReminders.length > 0 && (
                        <section className={styles.section}>
                            <h2><Icons.Pill size={20} /> Medications ({medicationReminders.length})</h2>
                            <div className={styles.remindersList}>
                                {medicationReminders.map((reminder) => (
                                    <div key={reminder.id} className={`card ${styles.reminderCard} ${styles.highPriority}`}>
                                        <div className={styles.reminderIcon}>{getIcon(reminder.type)}</div>
                                        <div className={styles.reminderContent}>
                                            <h4>{reminder.title}</h4>
                                            <p>{reminder.description}</p>
                                            <div className={styles.reminderMeta}>
                                                <span className={`badge ${getPriorityClass(reminder.priority)}`}>{reminder.time}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleComplete(reminder.id)} className="btn btn-primary">
                                            <Icons.Check size={16} /> Done
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Appointment Reminders */}
                    {appointmentReminders.length > 0 && (
                        <section className={styles.section}>
                            <h2><Icons.Calendar size={20} /> Upcoming Appointments ({appointmentReminders.length})</h2>
                            <div className={styles.remindersList}>
                                {appointmentReminders.map((reminder) => (
                                    <div key={reminder.id} className={`card ${styles.reminderCard}`}>
                                        <div className={styles.reminderIcon}>{getIcon(reminder.type)}</div>
                                        <div className={styles.reminderContent}>
                                            <h4>{reminder.title}</h4>
                                            <p>{reminder.description}</p>
                                            <div className={styles.reminderMeta}>
                                                <span className={`badge badge-info`}>{reminder.time}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleComplete(reminder.id)} className="btn btn-secondary">
                                            <Icons.Check size={16} /> Noted
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Other Reminders */}
                    {otherReminders.length > 0 && (
                        <section className={styles.section}>
                            <h2><Icons.Clipboard size={20} /> Care Tasks ({otherReminders.length})</h2>
                            <div className={styles.remindersList}>
                                {otherReminders.map((reminder) => (
                                    <div key={reminder.id} className={`card ${styles.reminderCard}`}>
                                        <div className={styles.reminderIcon}>{getIcon(reminder.type)}</div>
                                        <div className={styles.reminderContent}>
                                            <h4>{reminder.title}</h4>
                                            <p>{reminder.description}</p>
                                            <div className={styles.reminderMeta}>
                                                <span className={`badge badge-info`}>{reminder.time}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleComplete(reminder.id)} className="btn btn-secondary">
                                            <Icons.Check size={16} /> Done
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* Completed Section */}
            {completedReminders.length > 0 && (
                <section className={styles.section}>
                    <h2><Icons.Check size={20} /> Completed Today ({completedReminders.length})</h2>
                    <div className={styles.completedList}>
                        {completedReminders.map((reminder) => (
                            <div key={reminder.id} className={styles.completedItem}>
                                <span>{getIcon(reminder.type)}</span>
                                <span>{reminder.title}</span>
                                <span className="badge badge-success">Done</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
