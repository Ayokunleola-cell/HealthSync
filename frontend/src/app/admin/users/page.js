'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import Link from 'next/link';
import styles from './page.module.css';

export default function AdminUsersPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [users, setUsers] = useState([]);
    const [patients, setPatients] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '', password: '', email: '', full_name: '', role: 'caregiver', phone: '',
        patient_ids: [], relationship: ''
    });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [selectedUserCareTeam, setSelectedUserCareTeam] = useState(null);
    const [careTeam, setCareTeam] = useState([]);

    const fetchUsers = async () => {
        const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
        const data = await res.json();
        setUsers(data.users || []);
    };

    const fetchPatients = async () => {
        const res = await fetch('/api/admin/patients', { headers: getAuthHeaders() });
        const data = await res.json();
        setPatients(data.patients || []);
    };

    useEffect(() => {
        if (!token || loading) return;
        fetchUsers();
        fetchPatients();
    }, [token, loading, getAuthHeaders]);

    const resetForm = () => {
        setFormData({ username: '', password: '', email: '', full_name: '', role: 'caregiver', phone: '', patient_ids: [], relationship: '' });
        setEditingUser(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        if (editingUser) {
            const updateData = { ...formData };
            delete updateData.patient_ids;
            delete updateData.relationship;
            if (!updateData.password) delete updateData.password;
            await fetch(`/api/admin/users/${editingUser.id}`, {
                method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            setMessage({ text: 'User updated successfully', type: 'success' });
        } else {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ text: 'User created successfully', type: 'success' });
            } else {
                setMessage({ text: data.error || 'Error creating user', type: 'error' });
                return;
            }
        }
        resetForm();
        fetchUsers();
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username, password: '', email: user.email || '',
            full_name: user.full_name || '', role: user.role, phone: user.phone || '',
            patient_ids: [], relationship: ''
        });
        setShowForm(true);
    };

    const handleDelete = async (userId) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE', headers: getAuthHeaders()
        });
        if (res.ok) {
            setMessage({ text: 'User deleted', type: 'success' });
            fetchUsers();
        }
    };

    const togglePatientSelection = (patientId) => {
        setFormData(prev => {
            const ids = prev.patient_ids.includes(patientId)
                ? prev.patient_ids.filter(id => id !== patientId)
                : [...prev.patient_ids, patientId];
            return { ...prev, patient_ids: ids };
        });
    };

    // Only family members need patient assignment at registration
    // Caregivers and physicians are assigned via Staff Assignments page
    const showPatientSelector = formData.role === 'family';
    const isPatientRequired = formData.role === 'family';

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    const roleColors = {
        admin: '#805ad5', caregiver: '#38a169', physician: '#3182ce',
        family: '#dd6b20', patient: '#38a169'
    };

    const roleIcons = {
        admin: <Icons.Settings size={14} />,
        caregiver: <Icons.User size={14} />,
        physician: <Icons.Activity size={14} />,
        family: <Icons.Users size={14} />,
        patient: <Icons.Heart size={14} />
    };

    return (
        <div className={`page ${styles.usersPage}`}>
            <header className={styles.header}>
                <div>
                    <h1>Manage Users</h1>
                    <p>{users.length} total users</p>
                </div>
                <div className={styles.headerActions}>
                    <Link href="/admin/assignments" className="btn btn-secondary"><Icons.Users size={14} /> Staff Assignments</Link>
                    <Link href="/admin/shifts" className="btn btn-secondary"><Icons.Calendar size={14} /> Manage Shifts</Link>
                    <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary">
                        <Icons.Plus size={14} /> Add User
                    </button>
                </div>
            </header>

            {message.text && (
                <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>
            )}

            {/* User Form Modal */}
            {showForm && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
                            <button onClick={resetForm}><Icons.X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className={styles.formGrid}>
                                <div className="input-group">
                                    <label className="input-label">Full Name*</label>
                                    <input type="text" className="input" value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Username*</label>
                                    <input type="text" className="input" value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        disabled={!!editingUser} required />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">{editingUser ? 'New Password (leave blank to keep)' : 'Password*'}</label>
                                    <input type="password" className="input" value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Email*</label>
                                    <input type="email" className="input" value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Role*</label>
                                    <select className="input" value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value, patient_ids: [] })}>
                                        <option value="caregiver">Caregiver</option>
                                        <option value="physician">Physician</option>
                                        <option value="family">Family Member</option>
                                        <option value="patient">Patient</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Phone</label>
                                    <input type="tel" className="input" value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                            </div>

                            {/* Patient Assignment Section - Only for Family */}
                            {showPatientSelector && !editingUser && (
                                <div className={styles.patientSection}>
                                    <label className="input-label">
                                        Assign to Patient(s) <span className={styles.required}>*Required</span>
                                    </label>
                                    <p className={styles.helpText}>
                                        Family members must be assigned to at least one patient they are related to.
                                    </p>
                                    <div className={styles.patientGrid}>
                                        {patients.map(p => (
                                            <div
                                                key={p.id}
                                                className={`${styles.patientChip} ${formData.patient_ids.includes(p.id) ? styles.selected : ''}`}
                                                onClick={() => togglePatientSelection(p.id)}
                                            >
                                                <span className={styles.patientAvatar}>{p.name?.charAt(0)}</span>
                                                <span>{p.name}</span>
                                                {formData.patient_ids.includes(p.id) && <Icons.Check size={14} />}
                                            </div>
                                        ))}
                                    </div>
                                    {formData.role === 'family' && (
                                        <div className="input-group" style={{ marginTop: '1rem' }}>
                                            <label className="input-label">Relationship to Patient</label>
                                            <select className="input" value={formData.relationship}
                                                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}>
                                                <option value="">Select relationship...</option>
                                                <option value="Spouse">Spouse</option>
                                                <option value="Child">Son/Daughter</option>
                                                <option value="Parent">Parent</option>
                                                <option value="Sibling">Sibling</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={styles.formActions}>
                                <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingUser ? 'Update User' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="card">
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td><strong>{user.full_name}</strong></td>
                                <td>{user.username}</td>
                                <td>
                                    <span className={styles.roleBadge} style={{ background: `${roleColors[user.role]}20`, color: roleColors[user.role] }}>
                                        {roleIcons[user.role]} {user.role}
                                    </span>
                                </td>
                                <td>{user.email}</td>
                                <td>{user.phone || '-'}</td>
                                <td>
                                    <div className={styles.actions}>
                                        <button onClick={() => handleEdit(user)} className="btn btn-secondary btn-sm">Edit</button>
                                        <button onClick={() => handleDelete(user.id)} className="btn btn-danger btn-sm">Delete</button>
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
