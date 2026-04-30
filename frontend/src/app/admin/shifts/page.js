'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import Link from 'next/link';
import styles from './page.module.css';

// Status colors
const statusColors = {
    scheduled: { bg: '#3b82f6', label: 'Scheduled' },
    confirmed: { bg: '#10b981', label: 'Confirmed' },
    in_progress: { bg: '#f59e0b', label: 'In Progress' },
    completed: { bg: '#6b7280', label: 'Completed' },
    cancelled: { bg: '#ef4444', label: 'Cancelled' },
    no_show: { bg: '#dc2626', label: 'No Show' }
};

export default function AdminShiftsPage() {
    const { token, loading, getAuthHeaders, user } = useAuth();
    const [shifts, setShifts] = useState([]);
    const [patients, setPatients] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [physicians, setPhysicians] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState({ staff_type: '', status: '', date_from: '', date_to: '' });
    const [message, setMessage] = useState({ text: '', type: '' });

    const [formData, setFormData] = useState({
        staff_type: 'caregiver',
        staff_id: '',
        patient_id: '',
        shift_date: '',
        start_time: '08:00',
        end_time: '16:00',
        notes: ''
    });

    const fetchShifts = async () => {
        const params = new URLSearchParams();
        if (filter.staff_type) params.append('staff_type', filter.staff_type);
        if (filter.status) params.append('status', filter.status);
        if (filter.date_from) params.append('date_from', filter.date_from);
        if (filter.date_to) params.append('date_to', filter.date_to);

        const res = await fetch(`/api/shifts?${params.toString()}`, { headers: getAuthHeaders() });
        const data = await res.json();
        setShifts(data.shifts || []);
    };

    const fetchDropdownData = async () => {
        try {
            const [patientsRes, caregiversRes, physiciansRes] = await Promise.all([
                fetch('/api/admin/patients', { headers: getAuthHeaders() }),
                fetch('/api/users/by-role/caregiver', { headers: getAuthHeaders() }),
                fetch('/api/users/by-role/physician', { headers: getAuthHeaders() })
            ]);
            const patientsData = await patientsRes.json();
            const caregiversData = await caregiversRes.json();
            const physiciansData = await physiciansRes.json();

            setPatients(patientsData.patients || []);
            setCaregivers(caregiversData.users || []);
            setPhysicians(physiciansData.users || []);
        } catch (err) {
            console.error('Failed to fetch dropdown data:', err);
        }
    };

    useEffect(() => {
        if (!token || loading) return;
        fetchShifts();
        fetchDropdownData();
    }, [token, loading]);

    useEffect(() => {
        if (token) fetchShifts();
    }, [filter]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        const res = await fetch('/api/shifts', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (res.ok) {
            setMessage({ text: 'Shift created successfully!', type: 'success' });
            setShowForm(false);
            setFormData({ staff_type: 'caregiver', staff_id: '', patient_id: '', shift_date: '', start_time: '08:00', end_time: '16:00', notes: '' });
            fetchShifts();
        } else {
            setMessage({ text: data.error || 'Failed to create shift', type: 'error' });
        }
    };

    const handleApprove = async (shiftId) => {
        await fetch(`/api/shifts/${shiftId}/approve`, { method: 'POST', headers: getAuthHeaders() });
        fetchShifts();
    };

    const handleCancel = async (shiftId) => {
        if (!confirm('Cancel this shift?')) return;
        await fetch(`/api/shifts/${shiftId}/cancel`, { method: 'POST', headers: getAuthHeaders() });
        fetchShifts();
    };

    const handleDelete = async (shiftId) => {
        if (!confirm('Delete this shift permanently?')) return;
        await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchShifts();
    };

    const getStaffOptions = () => {
        return formData.staff_type === 'caregiver' ? caregivers : physicians;
    };

    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.shiftsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1>Shift Management</h1>
                    <p>Schedule and manage caregiver & physician shifts</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">
                    + Schedule Shift
                </button>
            </header>

            {message.text && (
                <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>
            )}

            {/* Filters */}
            <div className={`card ${styles.filterCard}`}>
                <div className={styles.filters}>
                    <div className="input-group">
                        <label className="input-label">Staff Type</label>
                        <select className="input" value={filter.staff_type} onChange={(e) => setFilter({ ...filter, staff_type: e.target.value })}>
                            <option value="">All Types</option>
                            <option value="caregiver">Caregivers</option>
                            <option value="physician">Physicians</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Status</label>
                        <select className="input" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                            <option value="">All Statuses</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">From Date</label>
                        <input type="date" className="input" value={filter.date_from} onChange={(e) => setFilter({ ...filter, date_from: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label className="input-label">To Date</label>
                        <input type="date" className="input" value={filter.date_to} onChange={(e) => setFilter({ ...filter, date_to: e.target.value })} />
                    </div>
                </div>
            </div>

            {/* Create Shift Modal */}
            {showForm && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>Schedule New Shift</h3>
                            <button onClick={() => setShowForm(false)}><Icons.X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.formGrid}>
                                    <div className="input-group">
                                        <label className="input-label">Staff Type*</label>
                                        <select className="input" value={formData.staff_type}
                                            onChange={(e) => setFormData({ ...formData, staff_type: e.target.value, staff_id: '' })}>
                                            <option value="caregiver">Caregiver</option>
                                            <option value="physician">Physician</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">{formData.staff_type === 'caregiver' ? 'Caregiver' : 'Physician'}*</label>
                                        <select className="input" value={formData.staff_id}
                                            onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })} required>
                                            <option value="">Select {formData.staff_type}...</option>
                                            {getStaffOptions().map(s => (
                                                <option key={s.id} value={s.id}>{s.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Patient*</label>
                                        <select className="input" value={formData.patient_id}
                                            onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })} required>
                                            <option value="">Select patient...</option>
                                            {patients.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Shift Date*</label>
                                        <input type="date" className="input" value={formData.shift_date}
                                            onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })} required />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Start Time*</label>
                                        <input type="time" className="input" value={formData.start_time}
                                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} required />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">End Time*</label>
                                        <input type="time" className="input" value={formData.end_time}
                                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="input-group" style={{ marginTop: '1rem' }}>
                                    <label className="input-label">Notes</label>
                                    <textarea className="input" value={formData.notes} rows={3}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Any special instructions..."></textarea>
                                </div>
                            </div>
                            <div className={styles.formActions}>
                                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Shift</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Shifts Table */}
            <div className="card">
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Staff</th>
                            <th>Type</th>
                            <th>Patient</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Hours</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shifts.length === 0 ? (
                            <tr><td colSpan={8} className={styles.noData}>No shifts found</td></tr>
                        ) : shifts.map((shift) => (
                            <tr key={shift.id}>
                                <td><strong>{shift.staff_name}</strong></td>
                                <td>
                                    <span className={styles.typeBadge} data-type={shift.staff_type}>
                                        {shift.staff_type}
                                    </span>
                                </td>
                                <td>{shift.patient_name}</td>
                                <td>{new Date(shift.shift_date).toLocaleDateString()}</td>
                                <td>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</td>
                                <td>
                                    <span className={styles.statusBadge} style={{ background: statusColors[shift.status]?.bg }}>
                                        {statusColors[shift.status]?.label}
                                    </span>
                                </td>
                                <td>{shift.actual_hours ? `${shift.actual_hours}h` : '-'}</td>
                                <td>
                                    <div className={styles.actions}>
                                        {shift.status === 'scheduled' && (
                                            <button onClick={() => handleApprove(shift.id)} className="btn btn-sm btn-primary">Approve</button>
                                        )}
                                        {['scheduled', 'confirmed'].includes(shift.status) && (
                                            <button onClick={() => handleCancel(shift.id)} className="btn btn-sm btn-secondary">Cancel</button>
                                        )}
                                        {shift.status === 'cancelled' && (
                                            <button onClick={() => handleDelete(shift.id)} className="btn btn-sm btn-danger">Delete</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
