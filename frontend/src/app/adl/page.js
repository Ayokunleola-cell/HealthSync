'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

const ADL_CATEGORIES = [
    { key: 'bathing', label: 'Bathing', icon: 'Droplet' },
    { key: 'dressing', label: 'Dressing', icon: 'User' },
    { key: 'grooming', label: 'Grooming', icon: 'User' },
    { key: 'toileting', label: 'Toileting', icon: 'Activity' },
    { key: 'transferring', label: 'Transferring', icon: 'Activity' },
    { key: 'ambulation', label: 'Ambulation', icon: 'Run' },
    { key: 'feeding', label: 'Feeding', icon: 'Utensils' },
    { key: 'continence', label: 'Continence', icon: 'Activity' }
];

const ASSISTANCE_LEVELS = [
    { value: 'independent', label: 'Independent', color: '#22c55e' },
    { value: 'supervision', label: 'Supervision', color: '#84cc16' },
    { value: 'minimal_assist', label: 'Minimal Assist', color: '#eab308' },
    { value: 'moderate_assist', label: 'Moderate Assist', color: '#f97316' },
    { value: 'maximal_assist', label: 'Maximal Assist', color: '#ef4444' },
    { value: 'total_assist', label: 'Total Assist', color: '#dc2626' },
    { value: 'not_done', label: 'Not Done', color: '#6b7280' }
];

export default function ADLPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [adlLogs, setAdlLogs] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newLog, setNewLog] = useState({
        log_date: new Date().toISOString().split('T')[0],
        bathing: '',
        dressing: '',
        grooming: '',
        toileting: '',
        transferring: '',
        ambulation: '',
        feeding: '',
        continence: '',
        notes: ''
    });

    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch('/api/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            setPatients(data.patients || []);
            if (data.patients?.length > 0 && !selectedPatient) {
                setSelectedPatient(data.patients[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch patients:', err);
        }
    }, [getAuthHeaders, selectedPatient]);

    const fetchADLLogs = useCallback(async () => {
        if (!selectedPatient) return;
        try {
            const res = await fetch(`/api/patients/${selectedPatient}/adl-logs`, { headers: getAuthHeaders() });
            const data = await res.json();
            setAdlLogs(data.adl_logs || []);
        } catch (err) {
            console.error('Failed to fetch ADL logs:', err);
        }
    }, [selectedPatient, getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchPatients();
    }, [token, loading, fetchPatients]);

    useEffect(() => {
        if (selectedPatient) {
            fetchADLLogs();
        }
    }, [selectedPatient, fetchADLLogs]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!selectedPatient) return;

        setCreating(true);
        try {
            const res = await fetch(`/api/patients/${selectedPatient}/adl-logs`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newLog)
            });
            if (res.ok) {
                setShowCreate(false);
                setNewLog({
                    log_date: new Date().toISOString().split('T')[0],
                    bathing: '',
                    dressing: '',
                    grooming: '',
                    toileting: '',
                    transferring: '',
                    ambulation: '',
                    feeding: '',
                    continence: '',
                    notes: ''
                });
                fetchADLLogs();
            }
        } catch (err) {
            console.error('Create failed:', err);
        }
        setCreating(false);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const getAssistanceInfo = (value) => {
        return ASSISTANCE_LEVELS.find(l => l.value === value) || { label: '-', color: '#6b7280' };
    };

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading...</p></div>;
    }

    if (user?.role !== 'caregiver') {
        return (
            <div className={`page ${styles.adlPage}`}>
                <div className={styles.accessDenied}>
                    <Icons.Clipboard size={48} />
                    <h2>ADL Logging</h2>
                    <p>ADL logging is available for caregivers only.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`page ${styles.adlPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.ClipboardList size={28} /> ADL Tracking</h1>
                    <p>Track Activities of Daily Living</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Icons.Plus size={16} /> New ADL Entry
                </button>
            </header>

            {/* Patient Selector */}
            <div className={styles.patientSelector}>
                <label>Select Patient:</label>
                <select
                    className="input"
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                >
                    {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* ADL Logs */}
            {adlLogs.length === 0 ? (
                <div className={styles.emptyState}>
                    <Icons.Clipboard size={48} />
                    <h3>No ADL logs found</h3>
                    <p>Create an ADL entry to track activities</p>
                </div>
            ) : (
                <div className={styles.logsList}>
                    {adlLogs.map((log) => (
                        <div key={log.id} className={`card ${styles.logCard}`}>
                            <div className={styles.logHeader}>
                                <h3><Icons.Calendar size={18} /> {formatDate(log.log_date)}</h3>
                                <span className={styles.caregiver}>by {log.caregiver_name}</span>
                            </div>
                            <div className={styles.adlGrid}>
                                {ADL_CATEGORIES.map((cat) => {
                                    const value = log[cat.key];
                                    const info = getAssistanceInfo(value);
                                    return (
                                        <div key={cat.key} className={styles.adlItem}>
                                            <span className={styles.adlLabel}>{cat.label}</span>
                                            {value ? (
                                                <span
                                                    className={styles.adlValue}
                                                    style={{ backgroundColor: `${info.color}20`, color: info.color }}
                                                >
                                                    {info.label}
                                                </span>
                                            ) : (
                                                <span className={styles.adlEmpty}>-</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {log.notes && (
                                <div className={styles.logNotes}>
                                    <strong>Notes:</strong> {log.notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><Icons.Plus size={20} /> New ADL Entry</h3>
                            <button className={styles.closeBtn} onClick={() => setShowCreate(false)}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className={styles.createForm}>
                            <div className="input-group">
                                <label className="input-label">Date</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={newLog.log_date}
                                    onChange={(e) => setNewLog({ ...newLog, log_date: e.target.value })}
                                />
                            </div>

                            <div className={styles.adlInputGrid}>
                                {ADL_CATEGORIES.map((cat) => (
                                    <div key={cat.key} className="input-group">
                                        <label className="input-label">{cat.label}</label>
                                        <select
                                            className="input"
                                            value={newLog[cat.key]}
                                            onChange={(e) => setNewLog({ ...newLog, [cat.key]: e.target.value })}
                                        >
                                            <option value="">Not recorded</option>
                                            {ASSISTANCE_LEVELS.map(level => (
                                                <option key={level.value} value={level.value}>
                                                    {level.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Notes</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={newLog.notes}
                                    onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })}
                                    placeholder="Additional observations..."
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? 'Saving...' : 'Save ADL Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
