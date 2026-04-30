'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import Link from 'next/link';
import styles from './page.module.css';

// Status configuration
const statusConfig = {
    scheduled: { icon: 'calendar', label: 'Scheduled', color: '#3b82f6' },
    confirmed: { icon: 'check', label: 'Confirmed', color: '#10b981' },
    in_progress: { icon: 'clock', label: 'In Progress', color: '#f59e0b' },
    completed: { icon: 'checkCircle', label: 'Completed', color: '#6b7280' },
    cancelled: { icon: 'x', label: 'Cancelled', color: '#ef4444' },
    no_show: { icon: 'alert', label: 'No Show', color: '#dc2626' }
};

export default function MyShiftsPage() {
    const { token, loading, getAuthHeaders, user } = useAuth();
    const [todaysShifts, setTodaysShifts] = useState([]);
    const [upcomingShifts, setUpcomingShifts] = useState([]);
    const [activeShift, setActiveShift] = useState(null);
    const [shiftSummary, setShiftSummary] = useState({});
    const [clockingIn, setClockingIn] = useState(false);
    const [clockingOut, setClockingOut] = useState(false);
    const [timer, setTimer] = useState('00:00:00');

    const fetchData = useCallback(async () => {
        if (!token) return;

        try {
            const [todayRes, upcomingRes, activeRes, summaryRes] = await Promise.all([
                fetch('/api/shifts/today', { headers: getAuthHeaders() }),
                fetch('/api/shifts/upcoming?days=7', { headers: getAuthHeaders() }),
                fetch('/api/shifts/active', { headers: getAuthHeaders() }),
                fetch('/api/shifts/summary', { headers: getAuthHeaders() })
            ]);

            const todayData = await todayRes.json();
            const upcomingData = await upcomingRes.json();
            const activeData = await activeRes.json();
            const summaryData = await summaryRes.json();

            setTodaysShifts(todayData.shifts || []);
            setUpcomingShifts(upcomingData.shifts || []);
            setActiveShift(activeData.active_shift);
            setShiftSummary(summaryData);
        } catch (err) {
            console.error('Failed to fetch shifts:', err);
        }
    }, [token, getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [token, loading, fetchData]);

    // Timer for active shift
    useEffect(() => {
        if (!activeShift?.check_in_time) return;

        const updateTimer = () => {
            const checkIn = new Date(activeShift.check_in_time);
            const now = new Date();
            const diff = Math.floor((now - checkIn) / 1000);
            const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
            const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const secs = (diff % 60).toString().padStart(2, '0');
            setTimer(`${hours}:${mins}:${secs}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeShift]);

    const handleClockIn = async (shiftId) => {
        setClockingIn(true);
        try {
            const res = await fetch(`/api/shifts/${shiftId}/check-in`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                fetchData();
            } else {
                alert(data.error || 'Failed to clock in');
            }
        } catch (err) {
            alert('Failed to clock in: ' + err.message);
        }
        setClockingIn(false);
    };

    const handleClockOut = async () => {
        if (!activeShift) return;
        setClockingOut(true);
        try {
            const res = await fetch(`/api/shifts/${activeShift.id}/check-out`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Clocked out! You worked ${data.actual_hours} hours.`);
                fetchData();
            } else {
                alert(data.error || 'Failed to clock out');
            }
        } catch (err) {
            alert('Failed to clock out: ' + err.message);
        }
        setClockingOut(false);
    };

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    const formatDateTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div><p>Loading shifts...</p></div>;

    return (
        <div className={`page ${styles.shiftsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1>My Shifts</h1>
                    <p>Welcome, {user?.full_name}</p>
                </div>
            </header>

            {/* Active Shift Card */}
            {activeShift && (
                <div className={styles.activeShiftCard}>
                    <div className={styles.activeHeader}>
                        <span className={styles.liveIndicator}>
                            <span className={styles.liveDot}></span> SHIFT IN PROGRESS
                        </span>
                    </div>
                    <div className={styles.activeContent}>
                        <div className={styles.timerSection}>
                            <div className={styles.timer}>{timer}</div>
                            <span>Time Elapsed</span>
                        </div>
                        <div className={styles.activeDetails}>
                            <div className={styles.patientInfo}>
                                <div className={styles.patientAvatar}>{activeShift.patient_name?.charAt(0)}</div>
                                <div>
                                    <strong>{activeShift.patient_name}</strong>
                                    <span>Patient</span>
                                </div>
                            </div>
                            <div className={styles.shiftTimes}>
                                <div>
                                    <label>Scheduled</label>
                                    <span>{formatTime(activeShift.start_time)} - {formatTime(activeShift.end_time)}</span>
                                </div>
                                <div>
                                    <label>Clocked In</label>
                                    <span>{formatDateTime(activeShift.check_in_time)}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            className={styles.clockOutBtn}
                            onClick={handleClockOut}
                            disabled={clockingOut}
                        >
                            {clockingOut ? 'Clocking Out...' : 'Clock Out'}
                        </button>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{shiftSummary.total_shifts || 0}</span>
                    <span className={styles.summaryLabel}>Total Shifts</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{shiftSummary.completed_shifts || 0}</span>
                    <span className={styles.summaryLabel}>Completed</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{shiftSummary.total_hours?.toFixed(1) || '0.0'}</span>
                    <span className={styles.summaryLabel}>Hours Worked</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryValue}>{todaysShifts.length}</span>
                    <span className={styles.summaryLabel}>Today&apos;s Shifts</span>
                </div>
            </div>

            {/* Today's Shifts */}
            <section className={styles.section}>
                <h2><Icons.Calendar size={20} /> Today's Shifts</h2>
                {todaysShifts.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Icons.Smile size={32} />
                        <p>No shifts scheduled for today</p>
                    </div>
                ) : (
                    <div className={styles.shiftsGrid}>
                        {todaysShifts.map(shift => (
                            <div key={shift.id} className={`${styles.shiftCard} ${shift.status === 'in_progress' ? styles.active : ''}`}>
                                <div className={styles.shiftHeader}>
                                    <span className={styles.statusBadge} style={{ background: statusConfig[shift.status]?.color }}>
                                        {statusConfig[shift.status]?.icon} {statusConfig[shift.status]?.label}
                                    </span>
                                    <span className={styles.shiftTime}>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                                </div>
                                <div className={styles.shiftPatient}>
                                    <div className={styles.patientAvatar}>{shift.patient_name?.charAt(0)}</div>
                                    <div>
                                        <strong>{shift.patient_name}</strong>
                                        <span>Patient Care</span>
                                    </div>
                                </div>
                                {shift.notes && <p className={styles.shiftNotes}>{shift.notes}</p>}
                                <div className={styles.shiftActions}>
                                    {shift.status === 'scheduled' && !activeShift && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleClockIn(shift.id)}
                                            disabled={clockingIn}
                                        >
                                            {clockingIn ? 'Clocking In...' : 'Clock In'}
                                        </button>
                                    )}
                                    {shift.status === 'confirmed' && !activeShift && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleClockIn(shift.id)}
                                            disabled={clockingIn}
                                        >
                                            {clockingIn ? 'Clocking In...' : 'Clock In'}
                                        </button>
                                    )}
                                    {shift.status === 'completed' && (
                                        <span className={styles.hoursWorked}>
                                            <Icons.Clock size={14} /> {shift.actual_hours}h worked
                                        </span>
                                    )}
                                    <Link href={`/patients/${shift.patient_id}`} className="btn btn-secondary">
                                        View Patient
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Upcoming Shifts */}
            <section className={styles.section}>
                <h2><Icons.Calendar size={20} /> Upcoming Shifts (Next 7 Days)</h2>
                {upcomingShifts.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Icons.Inbox size={32} />
                        <p>No upcoming shifts scheduled</p>
                    </div>
                ) : (
                    <div className={styles.upcomingList}>
                        {upcomingShifts.map(shift => (
                            <div key={shift.id} className={styles.upcomingItem}>
                                <div className={styles.upcomingDate}>
                                    <span className={styles.dateDay}>{new Date(shift.shift_date).getDate()}</span>
                                    <span className={styles.dateMonth}>{new Date(shift.shift_date).toLocaleString('en-US', { month: 'short' })}</span>
                                </div>
                                <div className={styles.upcomingDetails}>
                                    <strong>{shift.patient_name}</strong>
                                    <span>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                                </div>
                                <span className={styles.statusBadge} style={{ background: statusConfig[shift.status]?.color }}>
                                    {statusConfig[shift.status]?.label}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
