'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

const logTypes = [
    { value: 'activity', label: 'Activity', icon: 'Run' },
    { value: 'meal', label: 'Meal', icon: 'Utensils' },
    { value: 'sleep', label: 'Sleep', icon: 'Moon' },
    { value: 'mood', label: 'Mood', icon: 'Smile' },
    { value: 'incident', label: 'Incident', icon: 'AlertTriangle' },
    { value: 'note', label: 'Note', icon: 'FileText' },
];

export default function CareLogsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [logs, setLogs] = useState([]);
    const [formData, setFormData] = useState({ log_type: 'note', title: '', details: '' });
    const [submitting, setSubmitting] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!token || loading) return;
        const fetchData = async () => {
            const res = await fetch('/api/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            setPatients(data.patients || []);
            if (data.patients?.length > 0) setSelectedPatient(data.patients[0].id);
        };
        fetchData();
    }, [token, loading, getAuthHeaders]);

    const fetchLogs = useCallback(async () => {
        if (!selectedPatient) return;
        try {
            const res = await fetch(`/api/patients/${selectedPatient}/care-logs?limit=20`, { headers: getAuthHeaders() });
            const data = await res.json();
            setLogs(data.care_logs || []);
        } catch (err) {
            console.error('Failed to fetch care logs:', err);
        }
    }, [selectedPatient, getAuthHeaders]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Real-time updates every 15 seconds
    useEffect(() => {
        if (!selectedPatient) return;
        intervalRef.current = setInterval(fetchLogs, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [selectedPatient, fetchLogs]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        await fetch(`/api/patients/${selectedPatient}/care-logs`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(formData)
        });
        setFormData({ log_type: 'note', title: '', details: '' });
        const res = await fetch(`/api/patients/${selectedPatient}/care-logs?limit=20`, { headers: getAuthHeaders() });
        const data = await res.json();
        setLogs(data.care_logs || []);
        setSubmitting(false);
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    const getLogIcon = (type) => {
        const logType = logTypes.find(l => l.value === type);
        const IconComponent = Icons[logType?.icon || 'FileText'];
        return <IconComponent size={20} />;
    };

    return (
        <div className={`page ${styles.carePage}`}>
            <header className={styles.header}><h1><Icons.FileText size={24} /> Care Logs</h1><p>Document daily care activities</p></header>

            <div className="input-group">
                <label className="input-label">Select Patient</label>
                <select className="input" value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)}>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            <div className={`grid grid-2 ${styles.mainGrid}`}>
                <div className="card">
                    <h3>Add Care Log Entry</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group"><label className="input-label">Log Type</label>
                            <select className="input" value={formData.log_type} onChange={(e) => setFormData({ ...formData, log_type: e.target.value })}>
                                {logTypes.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                            </select></div>
                        <div className="input-group"><label className="input-label">Title</label>
                            <input type="text" className="input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Brief title..." /></div>
                        <div className="input-group"><label className="input-label">Details*</label>
                            <textarea className="input" rows="4" value={formData.details} onChange={(e) => setFormData({ ...formData, details: e.target.value })} required></textarea></div>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : <><Icons.Save size={16} /> Save Log</>}</button>
                    </form>
                </div>

                <div className="card">
                    <h3>Recent Logs</h3>
                    <div className={styles.logsList}>
                        {logs.map((log) => (
                            <div key={log.id} className={styles.logItem}>
                                <span className={styles.logIcon}>{getLogIcon(log.log_type)}</span>
                                <div className={styles.logContent}>
                                    <div className={styles.logHeader}>
                                        <strong>{log.title || log.log_type}</strong>
                                        <span className={styles.logTime}>{new Date(log.recorded_at).toLocaleString()}</span>
                                    </div>
                                    <p>{log.details}</p>
                                    <span className={styles.logBy}>by {log.caregiver_name}</span>
                                </div>
                            </div>
                        ))}
                        {logs.length === 0 && <p className={styles.noData}>No care logs yet</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
