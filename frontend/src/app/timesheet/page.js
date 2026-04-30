'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function TimeTrackingPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [timeEntries, setTimeEntries] = useState([]);
    const [clockStatus, setClockStatus] = useState({ is_clocked_in: false, active_entry: null });
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [filter, setFilter] = useState({ start_date: '', end_date: '' });

    const fetchData = useCallback(async () => {
        try {
            const [statusRes, entriesRes, patientsRes] = await Promise.all([
                fetch('/api/time-entries/status', { headers: getAuthHeaders() }),
                fetch('/api/time-entries', { headers: getAuthHeaders() }),
                fetch('/api/patients', { headers: getAuthHeaders() })
            ]);

            const statusData = await statusRes.json();
            const entriesData = await entriesRes.json();
            const patientsData = await patientsRes.json();

            setClockStatus(statusData);
            setTimeEntries(entriesData.time_entries || []);
            setPatients(patientsData.patients || []);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchData();
    }, [token, loading, fetchData]);

    // Update current time every second when clocked in
    useEffect(() => {
        if (!clockStatus.is_clocked_in) return;
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [clockStatus.is_clocked_in]);

    const handleClockIn = async () => {
        setProcessing(true);
        try {
            const res = await fetch('/api/time-entries/clock-in', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    patient_id: selectedPatient || undefined,
                    notes: notes || undefined
                })
            });
            if (res.ok) {
                setNotes('');
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to clock in');
            }
        } catch (err) {
            console.error('Clock in failed:', err);
        }
        setProcessing(false);
    };

    const handleClockOut = async () => {
        setProcessing(true);
        try {
            const res = await fetch('/api/time-entries/clock-out', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ notes: notes || undefined })
            });
            if (res.ok) {
                setNotes('');
                fetchData();
            }
        } catch (err) {
            console.error('Clock out failed:', err);
        }
        setProcessing(false);
    };

    const getElapsedTime = () => {
        if (!clockStatus.active_entry) return '00:00:00';
        const start = new Date(clockStatus.active_entry.clock_in);
        const elapsed = Math.floor((currentTime - start) / 1000);
        const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
        });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
        });
    };

    const calculateWeeklyHours = () => {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        return timeEntries
            .filter(e => new Date(e.clock_in) >= weekStart && e.total_hours)
            .reduce((sum, e) => sum + e.total_hours, 0)
            .toFixed(1);
    };

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading...</p></div>;
    }

    if (user?.role !== 'caregiver') {
        return (
            <div className={`page ${styles.timePage}`}>
                <div className={styles.accessDenied}>
                    <Icons.Clock size={48} />
                    <h2>Time Tracking</h2>
                    <p>Time tracking is available for caregivers only.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`page ${styles.timePage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.Clock size={28} /> Time Tracking</h1>
                    <p>Track your work hours and shifts</p>
                </div>
            </header>

            {/* Clock In/Out Card */}
            <div className={`card ${styles.clockCard}`}>
                <div className={styles.clockDisplay}>
                    <div className={`${styles.statusIndicator} ${clockStatus.is_clocked_in ? styles.active : ''}`}>
                        {clockStatus.is_clocked_in ? 'CLOCKED IN' : 'CLOCKED OUT'}
                    </div>
                    {clockStatus.is_clocked_in && (
                        <div className={styles.timer}>
                            <span className={styles.timerValue}>{getElapsedTime()}</span>
                            <span className={styles.timerLabel}>Elapsed Time</span>
                        </div>
                    )}
                    <div className={styles.currentTime}>
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>

                <div className={styles.clockActions}>
                    {!clockStatus.is_clocked_in ? (
                        <>
                            <div className="input-group">
                                <label className="input-label">Patient (Optional)</label>
                                <select
                                    className="input"
                                    value={selectedPatient}
                                    onChange={(e) => setSelectedPatient(e.target.value)}
                                >
                                    <option value="">Select patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Notes (Optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add notes..."
                                />
                            </div>
                            <button
                                className={`btn ${styles.clockInBtn}`}
                                onClick={handleClockIn}
                                disabled={processing}
                            >
                                <Icons.Play size={20} />
                                {processing ? 'Processing...' : 'Clock In'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className={styles.shiftInfo}>
                                <p><strong>Started:</strong> {formatTime(clockStatus.active_entry?.clock_in)}</p>
                                {clockStatus.active_entry?.patient_name && (
                                    <p><strong>Patient:</strong> {clockStatus.active_entry.patient_name}</p>
                                )}
                            </div>
                            <div className="input-group">
                                <label className="input-label">Clock Out Notes (Optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add clock out notes..."
                                />
                            </div>
                            <button
                                className={`btn ${styles.clockOutBtn}`}
                                onClick={handleClockOut}
                                disabled={processing}
                            >
                                <Icons.Pause size={20} />
                                {processing ? 'Processing...' : 'Clock Out'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Weekly Summary */}
            <div className={styles.summaryGrid}>
                <div className={`card ${styles.summaryCard}`}>
                    <span className={styles.summaryIcon}><Icons.Clock size={24} /></span>
                    <span className={styles.summaryValue}>{calculateWeeklyHours()}</span>
                    <span className={styles.summaryLabel}>Hours This Week</span>
                </div>
                <div className={`card ${styles.summaryCard}`}>
                    <span className={styles.summaryIcon}><Icons.Calendar size={24} /></span>
                    <span className={styles.summaryValue}>{timeEntries.filter(e => e.status === 'completed').length}</span>
                    <span className={styles.summaryLabel}>Completed Shifts</span>
                </div>
                <div className={`card ${styles.summaryCard}`}>
                    <span className={styles.summaryIcon}><Icons.TrendingUp size={24} /></span>
                    <span className={styles.summaryValue}>
                        {timeEntries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0).toFixed(1)}
                    </span>
                    <span className={styles.summaryLabel}>Overtime Hours</span>
                </div>
            </div>

            {/* Time Entries Table */}
            <div className="card">
                <div className="card-header">
                    <h3><Icons.FileText size={18} /> Time History</h3>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.timeTable}>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Clock In</th>
                                <th>Clock Out</th>
                                <th>Total Hours</th>
                                <th>Patient</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timeEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className={styles.emptyTable}>No time entries yet</td>
                                </tr>
                            ) : (
                                timeEntries.map((entry) => (
                                    <tr key={entry.id}>
                                        <td>{formatDate(entry.clock_in)}</td>
                                        <td>{formatTime(entry.clock_in)}</td>
                                        <td>{entry.clock_out ? formatTime(entry.clock_out) : '-'}</td>
                                        <td>
                                            {entry.total_hours ? `${entry.total_hours.toFixed(2)} hrs` : '-'}
                                            {entry.overtime_hours > 0 && (
                                                <span className={styles.overtimeBadge}>+{entry.overtime_hours.toFixed(1)} OT</span>
                                            )}
                                        </td>
                                        <td>{entry.patient_name || '-'}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[entry.status]}`}>
                                                {entry.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
