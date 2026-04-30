'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useSocket, useAlerts, useEmergencyAlerts } from '@/components/SocketProvider';
import { Icons } from '@/components/Icons';
import ConnectionStatus from '@/components/ConnectionStatus';
import Link from 'next/link';
import styles from './page.module.css';

export default function CaregiverDashboard() {
  const { user, token, loading, getAuthHeaders } = useAuth();
  const { isConnected, addEventListener } = useSocket();
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();

      const [patientsRes, alertsRes] = await Promise.all([
        fetch('/api/patients', { headers }),
        fetch('/api/alerts?unread=true', { headers })
      ]);

      const patientsData = await patientsRes.json();
      const alertsData = await alertsRes.json();

      setAlerts(alertsData.alerts || []);

      // Fetch vitals for each patient
      const patientsWithVitals = await Promise.all(
        (patientsData.patients || []).map(async (patient) => {
          try {
            const vitalsRes = await fetch(`/api/patients/${patient.id}/vitals?limit=1`, { headers });
            const vitalsData = await vitalsRes.json();
            return { ...patient, latestVitals: vitalsData.vitals?.[0] };
          } catch (e) {
            return patient;
          }
        })
      );
      setPatients(patientsWithVitals);
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

  // Real-time WebSocket updates for vitals
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = addEventListener('vitals_update', (data) => {
      setPatients(prev => prev.map(patient => {
        if (patient.id === data.patient_id) {
          return { ...patient, latestVitals: data.vitals };
        }
        return patient;
      }));
      setLastUpdated(new Date());
    });

    return cleanup;
  }, [isConnected, addEventListener]);

  // Real-time WebSocket updates for alerts
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = addEventListener('new_alert', (data) => {
      setAlerts(prev => [data, ...prev].slice(0, 10));
      setLastUpdated(new Date());
    });

    return cleanup;
  }, [isConnected, addEventListener]);

  // Real-time emergency alerts
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = addEventListener('emergency_alert', (data) => {
      // Show emergency notification
      const emergencyAlert = {
        id: `emergency_${Date.now()}`,
        alert_type: 'emergency',
        priority: 'high',
        title: 'EMERGENCY ALERT',
        message: data.data?.message || 'Emergency for patient',
        patient_id: data.patient_id,
        timestamp: data.timestamp
      };
      setAlerts(prev => [emergencyAlert, ...prev].slice(0, 10));
    });

    return cleanup;
  }, [isConnected, addEventListener]);

  // Fallback polling only when WebSocket is disconnected
  useEffect(() => {
    if (!token || isConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    // Polling fallback at 30 seconds when disconnected
    intervalRef.current = setInterval(fetchData, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, isConnected, fetchData]);

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
          <h1>Welcome, {user?.full_name || 'Caregiver'}</h1>
          <p>Caregiver Dashboard - Patient Overview</p>
        </div>
        <div className={styles.headerActions}>
          <ConnectionStatus />
          <Link href="/vitals" className="btn btn-primary"><Icons.Plus size={16} /> Record Vitals</Link>
          <Link href="/care-logs" className="btn btn-secondary"><Icons.FileText size={16} /> Add Care Log</Link>
        </div>
      </header>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <h3><Icons.AlertTriangle size={18} /> Unread Alerts</h3>
          <div className={styles.alertsList}>
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className={`${styles.alertCard} ${styles[alert.priority]}`}>
                <span className={styles.alertIcon}>
                  {alert.alert_type === 'emergency' ? <Icons.AlertCircle size={20} /> : alert.alert_type === 'medication' ? <Icons.Pill size={20} /> : <Icons.Bell size={20} />}
                </span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patients Section */}
      <section className={styles.patientsSection}>
        <div className={styles.sectionHeader}>
          <h2>My Patients</h2>
          <Link href="/patients" className={styles.viewAll}>View All →</Link>
        </div>

        <div className={`grid grid-2 ${styles.patientsGrid}`}>
          {patients.map((patient) => (
            <div key={patient.id} className={`card ${styles.patientCard}`}>
              <div className={styles.patientHeader}>
                <div className={styles.patientAvatar}>
                  {patient.name?.charAt(0) || 'P'}
                </div>
                <div>
                  <h3>{patient.name}</h3>
                  <p className={styles.condition}>{patient.condition}</p>
                </div>
              </div>

              {patient.latestVitals ? (
                <div className={styles.vitalsGrid}>
                  <div className={styles.vitalItem}>
                    <span className={styles.vitalLabel}>Heart Rate</span>
                    <span className={styles.vitalValue}>{patient.latestVitals.heart_rate} BPM</span>
                  </div>
                  <div className={styles.vitalItem}>
                    <span className={styles.vitalLabel}>Blood Pressure</span>
                    <span className={styles.vitalValue}>
                      {patient.latestVitals.blood_pressure_systolic}/{patient.latestVitals.blood_pressure_diastolic}
                    </span>
                  </div>
                  <div className={styles.vitalItem}>
                    <span className={styles.vitalLabel}>O2 Sat</span>
                    <span className={styles.vitalValue}>{patient.latestVitals.oxygen_saturation}%</span>
                  </div>
                  <div className={styles.vitalItem}>
                    <span className={styles.vitalLabel}>Temp</span>
                    <span className={styles.vitalValue}>{patient.latestVitals.temperature}°F</span>
                  </div>
                </div>
              ) : (
                <p className={styles.noData}>No recent vitals</p>
              )}

              <div className={styles.patientActions}>
                <Link href={`/patients/${patient.id}`} className="btn btn-secondary">View Details</Link>
                <Link href={`/video?patient=${patient.id}`} className="btn btn-primary"><Icons.Video size={16} /> Video Call</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className={styles.quickActions}>
        <h2>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          <Link href="/medications" className={styles.actionCard}>
            <span><Icons.Pill size={24} /></span>
            <span>Manage Medications</span>
          </Link>
          <Link href="/calendar" className={styles.actionCard}>
            <span><Icons.Calendar size={24} /></span>
            <span>View Calendar</span>
          </Link>
          <Link href="/reminders" className={styles.actionCard}>
            <span><Icons.Bell size={24} /></span>
            <span>Reminders</span>
          </Link>
          <Link href="/video" className={styles.actionCard}>
            <span><Icons.Video size={24} /></span>
            <span>Start Video Call</span>
          </Link>
        </div>
      </section>

      {/* Video Call Quick Access */}
      <section className={styles.quickActions}>
        <h2><Icons.Video size={20} /> Quick Video Calls</h2>
        <div className={styles.actionsGrid}>
          <Link href="/video" className={styles.actionCard}>
            <span><Icons.Stethoscope size={24} /></span>
            <span>Call Physician</span>
          </Link>
          <Link href="/video" className={styles.actionCard}>
            <span><Icons.Family size={24} /></span>
            <span>Call Family</span>
          </Link>
          <Link href="/video" className={styles.actionCard}>
            <span><Icons.User size={24} /></span>
            <span>Call Patient</span>
          </Link>
          <Link href="/video" className={styles.actionCard}>
            <span><Icons.Calendar size={24} /></span>
            <span>Schedule Call</span>
          </Link>
        </div>
      </section>
    </div>

  );
}
