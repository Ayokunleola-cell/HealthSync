'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import styles from './page.module.css';

export default function AppointmentsPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ patient_id: '', title: '', scheduled_at: '', duration_mins: 30, appointment_type: 'checkup' });
    const intervalRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const [aptRes, patRes] = await Promise.all([
                fetch('/api/appointments', { headers: getAuthHeaders() }),
                fetch('/api/patients', { headers: getAuthHeaders() })
            ]);
            const aptData = await aptRes.json();
            const patData = await patRes.json();
            setAppointments(aptData.appointments || []);
            setPatients(patData.patients || []);
            if (patData.patients?.length > 0 && !formData.patient_id) setFormData(f => ({ ...f, patient_id: patData.patients[0].id }));
        } catch (err) {
            console.error('Failed to fetch appointments:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchData();
    }, [token, loading, fetchData]);

    // Real-time updates every 15 seconds
    useEffect(() => {
        if (!token) return;
        intervalRef.current = setInterval(fetchData, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await fetch('/api/appointments', {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(formData)
        });
        setShowForm(false);
        const res = await fetch('/api/appointments', { headers: getAuthHeaders() });
        const data = await res.json();
        setAppointments(data.appointments || []);
    };

    const updateStatus = async (id, status) => {
        await fetch(`/api/appointments/${id}`, {
            method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ status })
        });
        const res = await fetch('/api/appointments', { headers: getAuthHeaders() });
        const data = await res.json();
        setAppointments(data.appointments || []);
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    const upcoming = appointments.filter(a => new Date(a.scheduled_at) > new Date() && a.status !== 'cancelled');
    const past = appointments.filter(a => new Date(a.scheduled_at) <= new Date() || a.status === 'cancelled');

    return (
        <div className={`page ${styles.aptPage}`}>
            <header className={styles.header}>
                <div><h1>Appointments</h1><p>Schedule and manage appointments</p></div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Schedule Appointment</button>
            </header>

            {showForm && (
                <div className={`card ${styles.formCard}`}>
                    <h3>Schedule New Appointment</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group"><label className="input-label">Patient*</label>
                            <select className="input" value={formData.patient_id} onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })} required>
                                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select></div>
                        <div className="input-group"><label className="input-label">Title*</label>
                            <input type="text" className="input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Monthly Check-up" required /></div>
                        <div className="input-group"><label className="input-label">Date and Time*</label>
                            <input type="datetime-local" className="input" value={formData.scheduled_at} onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })} required /></div>
                        <div className="input-group"><label className="input-label">Duration (minutes)</label>
                            <select className="input" value={formData.duration_mins} onChange={(e) => setFormData({ ...formData, duration_mins: parseInt(e.target.value) })}>
                                <option value="15">15 mins</option><option value="30">30 mins</option><option value="45">45 mins</option><option value="60">60 mins</option>
                            </select></div>
                        <div className={styles.formActions}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                            <button type="submit" className="btn btn-primary">Schedule</button>
                        </div>
                    </form>
                </div>
            )}

            <div className={styles.sectionBlock}>
                <h2 className={styles.sectionTitle}>Upcoming ({upcoming.length})</h2>
                <div className={styles.aptList}>
                    {upcoming.map((apt) => (
                        <div key={apt.id} className={`card ${styles.aptCard}`}>
                            <div className={styles.aptTime}>
                                <span className={styles.aptDate}>{new Date(apt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                <span className={styles.aptHour}>{new Date(apt.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={styles.aptInfo}><strong>{apt.title}</strong><p>{apt.duration_mins} mins - {apt.appointment_type}</p></div>
                            <div className={styles.aptActions}>
                                <a href={apt.video_call_link || '/video'} className="btn btn-primary btn-sm">Join</a>
                                <button onClick={() => updateStatus(apt.id, 'cancelled')} className="btn btn-secondary btn-sm">Cancel</button>
                            </div>
                        </div>
                    ))}
                    {upcoming.length === 0 && <p className={styles.noData}>No upcoming appointments</p>}
                </div>
            </div>

            <div className={styles.sectionBlock}>
                <h2 className={styles.sectionTitle}>Past Appointments</h2>
                <div className={styles.aptList}>
                    {past.slice(0, 5).map((apt) => (
                        <div key={apt.id} className={`card ${styles.aptCard} ${styles.past}`}>
                            <div className={styles.aptTime}>
                                <span className={styles.aptDate}>{new Date(apt.scheduled_at).toLocaleDateString()}</span>
                            </div>
                            <div className={styles.aptInfo}><strong>{apt.title}</strong><span className={`badge ${apt.status === 'cancelled' ? 'badge-warning' : 'badge-success'}`}>{apt.status}</span></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
