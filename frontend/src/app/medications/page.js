'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function MedicationsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [medications, setMedications] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', dosage: '', frequency: '', time_of_day: '', instructions: '' });
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

    const fetchMeds = useCallback(async () => {
        if (!selectedPatient) return;
        try {
            const res = await fetch(`/api/patients/${selectedPatient}/medications`, { headers: getAuthHeaders() });
            const data = await res.json();
            setMedications(data.medications || []);
        } catch (err) {
            console.error('Failed to fetch medications:', err);
        }
    }, [selectedPatient, getAuthHeaders]);

    useEffect(() => {
        fetchMeds();
    }, [fetchMeds]);

    // Real-time updates every 15 seconds
    useEffect(() => {
        if (!selectedPatient) return;
        intervalRef.current = setInterval(fetchMeds, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [selectedPatient, fetchMeds]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await fetch(`/api/patients/${selectedPatient}/medications`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(formData)
        });
        setShowForm(false);
        setFormData({ name: '', dosage: '', frequency: '', time_of_day: '', instructions: '' });
        // Refresh
        const res = await fetch(`/api/patients/${selectedPatient}/medications`, { headers: getAuthHeaders() });
        const data = await res.json();
        setMedications(data.medications || []);
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.medsPage}`}>
            <header className={styles.header}>
                <div><h1><Icons.Pill size={24} /> Medications</h1><p>Manage patient medications</p></div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary"><Icons.Plus size={16} /> Add Medication</button>
            </header>

            <div className="input-group">
                <label className="input-label">Select Patient</label>
                <select className="input" value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)}>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {showForm && (
                <div className={`card ${styles.formCard}`}>
                    <h3>Add New Medication</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group"><label className="input-label">Medication Name*</label>
                            <input type="text" className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                        <div className="input-group"><label className="input-label">Dosage</label>
                            <input type="text" className="input" placeholder="e.g., 10mg" value={formData.dosage} onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Frequency</label>
                            <input type="text" className="input" placeholder="e.g., Once daily" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Time of Day</label>
                            <input type="text" className="input" placeholder="e.g., Morning, Evening" value={formData.time_of_day} onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Instructions</label>
                            <textarea className="input" rows="2" value={formData.instructions} onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}></textarea></div>
                        <div className={styles.formActions}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                            <button type="submit" className="btn btn-primary"><Icons.Save size={16} /> Save Medication</button>
                        </div>
                    </form>
                </div>
            )}

            <div className={styles.medsList}>
                {medications.map((med) => (
                    <div key={med.id} className={`card ${styles.medCard}`}>
                        <div className={styles.medIcon}><Icons.Pill size={24} /></div>
                        <div className={styles.medInfo}>
                            <h4>{med.name}</h4>
                            <p>{med.dosage} • {med.frequency}</p>
                            <span className="badge badge-info">{med.time_of_day}</span>
                        </div>
                        {med.instructions && <p className={styles.instructions}>{med.instructions}</p>}
                    </div>
                ))}
                {medications.length === 0 && <p className={styles.noData}>No medications found</p>}
            </div>
        </div>
    );
}
