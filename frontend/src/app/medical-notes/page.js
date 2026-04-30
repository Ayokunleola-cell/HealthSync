'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

const noteTypes = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'diagnosis', label: 'Diagnosis' },
    { value: 'prescription', label: 'Prescription' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'general', label: 'General Note' },
];

export default function MedicalNotesPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState('');
    const [notes, setNotes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ note_type: 'general', title: '', content: '', is_private: false });
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

    const fetchNotes = useCallback(async () => {
        if (!selectedPatient) return;
        try {
            const res = await fetch(`/api/patients/${selectedPatient}/medical-notes`, { headers: getAuthHeaders() });
            const data = await res.json();
            setNotes(data.medical_notes || []);
        } catch (err) {
            console.error('Failed to fetch notes:', err);
        }
    }, [selectedPatient, getAuthHeaders]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    // Real-time updates every 15 seconds
    useEffect(() => {
        if (!selectedPatient) return;
        intervalRef.current = setInterval(fetchNotes, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [selectedPatient, fetchNotes]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await fetch(`/api/patients/${selectedPatient}/medical-notes`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(formData)
        });
        setShowForm(false);
        setFormData({ note_type: 'general', title: '', content: '', is_private: false });
        const res = await fetch(`/api/patients/${selectedPatient}/medical-notes`, { headers: getAuthHeaders() });
        const data = await res.json();
        setNotes(data.medical_notes || []);
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.notesPage}`}>
            <header className={styles.header}>
                <div><h1><Icons.Clipboard size={24} /> Medical Notes</h1><p>Physician notes and documentation</p></div>
                {user?.role === 'physician' && <button onClick={() => setShowForm(true)} className="btn btn-primary"><Icons.Plus size={16} /> Add Note</button>}
            </header>

            <div className="input-group">
                <label className="input-label">Select Patient</label>
                <select className="input" value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)}>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {showForm && (
                <div className={`card ${styles.formCard}`}>
                    <h3>Add Medical Note</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group"><label className="input-label">Note Type*</label>
                            <select className="input" value={formData.note_type} onChange={(e) => setFormData({ ...formData, note_type: e.target.value })} required>
                                {noteTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select></div>
                        <div className="input-group"><label className="input-label">Title</label>
                            <input type="text" className="input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
                        <div className="input-group"><label className="input-label">Content*</label>
                            <textarea className="input" rows="5" value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} required></textarea></div>
                        <label className={styles.checkbox}>
                            <input type="checkbox" checked={formData.is_private} onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })} />
                            Private note (only visible to physicians)
                        </label>
                        <div className={styles.formActions}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                            <button type="submit" className="btn btn-primary"><Icons.Save size={16} /> Save Note</button>
                        </div>
                    </form>
                </div>
            )}

            <div className={styles.notesList}>
                {notes.map((note) => (
                    <div key={note.id} className={`card ${styles.noteCard}`}>
                        <div className={styles.noteHeader}>
                            <span className={`badge ${note.note_type === 'diagnosis' ? 'badge-warning' : 'badge-info'}`}>{note.note_type}</span>
                            <span className={styles.noteDate}>{new Date(note.created_at).toLocaleDateString()}</span>
                        </div>
                        {note.title && <h4>{note.title}</h4>}
                        <p>{note.content}</p>
                        <span className={styles.noteBy}>by {note.physician_name}</span>
                    </div>
                ))}
                {notes.length === 0 && <p className={styles.noData}>No medical notes found</p>}
            </div>
        </div>
    );
}
