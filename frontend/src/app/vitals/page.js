'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useSocket } from '@/components/SocketProvider';
import { Icons } from '@/components/Icons';
import ConnectionStatus from '@/components/ConnectionStatus';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function VitalsPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const { isConnected, addEventListener, subscribeToPatient } = useSocket();
    const searchParams = useSearchParams();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(searchParams.get('patient') || '');
    const [vitalsHistory, setVitalsHistory] = useState([]);
    const [isRealtime, setIsRealtime] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [formData, setFormData] = useState({
        heart_rate: '', blood_pressure_systolic: '', blood_pressure_diastolic: '',
        temperature: '', oxygen_saturation: '', respiratory_rate: '', notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const intervalRef = useRef(null);

    const fetchVitals = useCallback(async () => {
        if (!selectedPatient || !token) return;
        try {
            const res = await fetch(`/api/patients/${selectedPatient}/vitals?limit=20`, { headers: getAuthHeaders() });
            const data = await res.json();
            setVitalsHistory(data.vitals || []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch vitals:', err);
        }
    }, [selectedPatient, token, getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        const fetchPatients = async () => {
            const res = await fetch('/api/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            setPatients(data.patients || []);
            if (!selectedPatient && data.patients?.length > 0) {
                setSelectedPatient(data.patients[0].id);
            }
        };
        fetchPatients();
    }, [token, loading, getAuthHeaders]);

    useEffect(() => {
        fetchVitals();
    }, [fetchVitals]);

    // Subscribe to patient updates via WebSocket
    useEffect(() => {
        if (!isConnected || !selectedPatient) return;
        subscribeToPatient(selectedPatient);
    }, [isConnected, selectedPatient, subscribeToPatient]);

    // Real-time WebSocket updates
    useEffect(() => {
        if (!isConnected || !selectedPatient) return;

        const cleanup = addEventListener('vitals_update', (data) => {
            if (data.patient_id === selectedPatient) {
                setVitalsHistory(prev => [data.vitals, ...prev].slice(0, 20));
                setLastUpdated(new Date());
            }
        });

        return cleanup;
    }, [isConnected, selectedPatient, addEventListener]);

    // Fallback polling when WebSocket is disconnected
    useEffect(() => {
        if (!isRealtime || !selectedPatient || isConnected) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }
        intervalRef.current = setInterval(fetchVitals, 10000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRealtime, selectedPatient, isConnected, fetchVitals]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch(`/api/patients/${selectedPatient}/vitals`, {
                method: 'POST', headers: getAuthHeaders(),
                body: JSON.stringify({
                    heart_rate: parseInt(formData.heart_rate),
                    blood_pressure_systolic: parseInt(formData.blood_pressure_systolic),
                    blood_pressure_diastolic: parseInt(formData.blood_pressure_diastolic),
                    temperature: parseFloat(formData.temperature) || null,
                    oxygen_saturation: parseInt(formData.oxygen_saturation) || null,
                    respiratory_rate: parseInt(formData.respiratory_rate) || null,
                    notes: formData.notes
                })
            });
            if (res.ok) {
                setSuccess(true);
                setFormData({ heart_rate: '', blood_pressure_systolic: '', blood_pressure_diastolic: '', temperature: '', oxygen_saturation: '', respiratory_rate: '', notes: '' });
                setTimeout(() => setSuccess(false), 3000);
                fetchVitals();
            }
        } catch (err) { console.error(err); }
        finally { setSubmitting(false); }
    };

    // Vital status indicators
    const getVitalStatus = (type, value) => {
        if (!value) return 'normal';
        switch (type) {
            case 'heart_rate':
                if (value < 60 || value > 100) return value < 50 || value > 120 ? 'critical' : 'warning';
                return 'normal';
            case 'systolic':
                if (value > 140 || value < 90) return value > 180 || value < 70 ? 'critical' : 'warning';
                return 'normal';
            case 'diastolic':
                if (value > 90 || value < 60) return value > 120 || value < 40 ? 'critical' : 'warning';
                return 'normal';
            case 'oxygen':
                if (value < 95) return value < 90 ? 'critical' : 'warning';
                return 'normal';
            case 'temp':
                if (value > 99.5 || value < 97) return value > 103 || value < 95 ? 'critical' : 'warning';
                return 'normal';
            default:
                return 'normal';
        }
    };

    const latestVitals = vitalsHistory[0];
    const selectedPatientData = patients.find(p => p.id === selectedPatient);

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.vitalsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.Activity /> Vital Signs Monitor</h1>
                    <p>Real-time patient vital signs tracking and recording</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={`${styles.realtimeToggle} ${isRealtime ? styles.active : ''}`}
                        onClick={() => setIsRealtime(!isRealtime)}
                    >
                        <span className={styles.liveDot}></span>
                        {isRealtime ? 'Live Updates ON' : 'Live Updates OFF'}
                    </button>
                    <button className={styles.refreshBtn} onClick={fetchVitals}>
                        <Icons.Refresh /> Refresh
                    </button>
                </div>
            </header>

            <div className={styles.patientSelector}>
                <label>Patient:</label>
                <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)}>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {lastUpdated && (
                    <span className={styles.lastUpdate}>
                        <Icons.Clock /> Last updated: {lastUpdated.toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Current Vitals Display */}
            {latestVitals && (
                <div className={styles.currentVitals}>
                    <div className={`${styles.vitalCard} ${styles[getVitalStatus('heart_rate', latestVitals.heart_rate)]}`}>
                        <div className={styles.vitalIcon}><Icons.Heart /></div>
                        <div className={styles.vitalValue}>{latestVitals.heart_rate}</div>
                        <div className={styles.vitalLabel}>Heart Rate</div>
                        <div className={styles.vitalUnit}>BPM</div>
                    </div>
                    <div className={`${styles.vitalCard} ${styles[getVitalStatus('systolic', latestVitals.blood_pressure_systolic)]}`}>
                        <div className={styles.vitalIcon}><Icons.Droplet /></div>
                        <div className={styles.vitalValue}>{latestVitals.blood_pressure_systolic}/{latestVitals.blood_pressure_diastolic}</div>
                        <div className={styles.vitalLabel}>Blood Pressure</div>
                        <div className={styles.vitalUnit}>mmHg</div>
                    </div>
                    <div className={`${styles.vitalCard} ${styles[getVitalStatus('oxygen', latestVitals.oxygen_saturation)]}`}>
                        <div className={styles.vitalIcon}><Icons.Wind /></div>
                        <div className={styles.vitalValue}>{latestVitals.oxygen_saturation || '--'}</div>
                        <div className={styles.vitalLabel}>O2 Saturation</div>
                        <div className={styles.vitalUnit}>%</div>
                    </div>
                    <div className={`${styles.vitalCard} ${styles[getVitalStatus('temp', latestVitals.temperature)]}`}>
                        <div className={styles.vitalIcon}><Icons.Thermometer /></div>
                        <div className={styles.vitalValue}>{latestVitals.temperature || '--'}</div>
                        <div className={styles.vitalLabel}>Temperature</div>
                        <div className={styles.vitalUnit}>°F</div>
                    </div>
                </div>
            )}

            {!latestVitals && (
                <div className={styles.noVitals}>
                    <Icons.AlertTriangle />
                    <p>No vitals recorded for this patient yet</p>
                </div>
            )}

            <div className={styles.mainGrid}>
                {/* Record Form */}
                <div className={`card ${styles.formCard}`}>
                    <h3>Record New Vitals</h3>
                    {success && (
                        <div className={styles.successMsg}>
                            <Icons.Check /> Vitals recorded successfully!
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Heart Rate (BPM) *</label>
                                <input type="number" value={formData.heart_rate} onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })} required placeholder="60-100" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Systolic BP *</label>
                                <input type="number" value={formData.blood_pressure_systolic} onChange={(e) => setFormData({ ...formData, blood_pressure_systolic: e.target.value })} required placeholder="120" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Diastolic BP *</label>
                                <input type="number" value={formData.blood_pressure_diastolic} onChange={(e) => setFormData({ ...formData, blood_pressure_diastolic: e.target.value })} required placeholder="80" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Temperature (°F)</label>
                                <input type="number" step="0.1" value={formData.temperature} onChange={(e) => setFormData({ ...formData, temperature: e.target.value })} placeholder="98.6" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>O2 Saturation (%)</label>
                                <input type="number" value={formData.oxygen_saturation} onChange={(e) => setFormData({ ...formData, oxygen_saturation: e.target.value })} placeholder="95-100" />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Respiratory Rate</label>
                                <input type="number" value={formData.respiratory_rate} onChange={(e) => setFormData({ ...formData, respiratory_rate: e.target.value })} placeholder="12-20" />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Notes</label>
                            <textarea rows="2" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional observations..."></textarea>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Vitals'}
                        </button>
                    </form>
                </div>

                {/* History */}
                <div className={`card ${styles.historyCard}`}>
                    <h3>Vitals History</h3>
                    <div className={styles.historyList}>
                        {vitalsHistory.map((v, idx) => (
                            <div key={v.id} className={`${styles.historyItem} ${idx === 0 ? styles.latest : ''}`}>
                                <div className={styles.historyTime}>
                                    <Icons.Clock />
                                    {new Date(v.recorded_at).toLocaleString()}
                                    {idx === 0 && <span className={styles.latestBadge}>Latest</span>}
                                </div>
                                <div className={styles.historyVitals}>
                                    <span className={styles[getVitalStatus('heart_rate', v.heart_rate)]}>
                                        <Icons.Heart /> {v.heart_rate} BPM
                                    </span>
                                    <span className={styles[getVitalStatus('systolic', v.blood_pressure_systolic)]}>
                                        <Icons.Droplet /> {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}
                                    </span>
                                    <span className={styles[getVitalStatus('oxygen', v.oxygen_saturation)]}>
                                        <Icons.Wind /> {v.oxygen_saturation || '--'}%
                                    </span>
                                    {v.temperature && (
                                        <span className={styles[getVitalStatus('temp', v.temperature)]}>
                                            <Icons.Thermometer /> {v.temperature}°F
                                        </span>
                                    )}
                                </div>
                                {v.notes && <div className={styles.historyNotes}>{v.notes}</div>}
                            </div>
                        ))}
                        {vitalsHistory.length === 0 && <p className={styles.noData}>No vitals recorded yet</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
